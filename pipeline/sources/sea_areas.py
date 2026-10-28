"""海域多邊形（Marine Regions，VLIZ，CC BY 4.0）：判斷河口流進哪一片海、哪一個大洋。

- IHO Sea Areas 第 3 版（2018）：國際水文組織 S-23《Limits of Oceans and Seas》1953 年第 3 版的 101 個海域
  （南海、東海、孟加拉灣、墨西哥灣、哈德遜灣、地中海的各部分…），彼此相連、蓋滿整個海洋，河口一定找得到最近的一片。
  引用：Flanders Marine Institute (2018). IHO Sea Areas, version 3. https://doi.org/10.14284/323
- Global Oceans and Seas 第 1 版（2021）：依 IHO S-23 2002 年第 4 版草案的 10 章（北冰洋、北大西洋、南大西洋、
  地中海區域、波羅的海、印度洋、南海與東部群島諸海、北太平洋、南太平洋、南冰洋）劃的多邊形，用來決定每個 IHO 海域
  屬於哪一個大洋（大部分面積落在哪一章）。引用：Flanders Marine Institute (2021). Global Oceans and Seas, version 1.
  https://doi.org/10.14284/542
- 授權：https://www.marineregions.org/disclaimer.php（Marine Regions 的產品是 CC BY 4.0，見 marine_regions.py）。
  這裡只用來分類，不輸出海域的形狀。
- 下載：VLIZ 公開的 WFS（geo.vliz.be 的 GeoServer，不必登入）。整份 GeoJSON 很大（GOaS 211 MB、IHO 約 130 MB），
  伺服器要先產生好幾分鐘才開始傳。

判斷方法：兩份多邊形各自畫成 0.025°（赤道約 2.8 km）的網格，河口所在的格子是海就用它，不是海就找最近的
「靠岸的海格子」（球面上的直線距離，KD 樹）。
"""
from __future__ import annotations

import json
from functools import lru_cache

import numpy as np

from common import CACHE_DIR, download

WFS = (
    "https://geo.vliz.be/geoserver/MarineRegions/wfs?service=WFS&version=1.0.0&request=GetFeature"
    "&outputFormat=application/json&typeName=MarineRegions:{layer}"
)
IHO_FILE = "iho_v3.json"
GOAS_FILE = "goas_v01.json"
RES = 0.025
W, H = round(360 / RES), round(180 / RES)
RASTER_CACHE = CACHE_DIR / "rivers" / "sea_rasters_0025.npz"

IHO_DOI = "https://doi.org/10.14284/323"
GOAS_DOI = "https://doi.org/10.14284/542"


def _features(layer: str, filename: str) -> list[dict]:
    path = download(WFS.format(layer=layer), "marine-regions", filename)
    with open(path, encoding="utf-8") as f:
        return json.load(f)["features"]


@lru_cache(maxsize=1)
def rasters() -> tuple[np.ndarray, list[str], np.ndarray, list[str]]:
    """(IHO 網格, IHO 海域名稱, GOaS 網格, GOaS 名稱)：網格的值是名稱的索引 + 1，0 是陸地（或兩份都沒有的地方）"""
    if RASTER_CACHE.exists():
        with np.load(RASTER_CACHE, allow_pickle=False) as z:
            return z["iho"], list(z["iho_names"]), z["goas"], list(z["goas_names"])
    from rasterio import features as rfeatures
    from rasterio.transform import from_origin

    transform = from_origin(-180, 90, RES, RES)
    out = []
    for layer, filename in (("iho", IHO_FILE), ("goas", GOAS_FILE)):
        feats = _features(layer, filename)
        names = [f["properties"]["name"] for f in feats]
        print(f"  畫 {layer} 的網格（{len(feats)} 個多邊形）")
        grid = rfeatures.rasterize(
            ((f["geometry"], i + 1) for i, f in enumerate(feats)),
            out_shape=(H, W), transform=transform, fill=0, dtype="int16",
        )
        out += [grid, names]
    RASTER_CACHE.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(RASTER_CACHE, iho=out[0], iho_names=np.array(out[1]), goas=out[2], goas_names=np.array(out[3]))
    return out[0], out[1], out[2], out[3]


def _xyz(lon, lat):
    lon, lat = np.radians(lon), np.radians(lat)
    return np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], axis=1)


def nearest_sea(grid: np.ndarray, lons, lats) -> tuple[np.ndarray, np.ndarray]:
    """每個點的海域標籤與距離（km）：所在的格子是海就是它（距離 0），否則是最近的靠岸海格子"""
    from scipy import ndimage
    from scipy.spatial import cKDTree

    lons, lats = np.asarray(lons, float), np.asarray(lats, float)
    col = np.clip(((lons + 180) / RES).astype(np.int64), 0, W - 1)
    row = np.clip(((90 - lats) / RES).astype(np.int64), 0, H - 1)
    label = grid[row, col].astype(np.int32)
    dist = np.zeros(len(lons))
    miss = np.nonzero(label == 0)[0]
    if len(miss):
        sea = grid > 0
        coast = sea & ndimage.binary_dilation(~sea, structure=np.ones((3, 3), bool))
        r, c = np.nonzero(coast)
        tree = cKDTree(_xyz((c + 0.5) * RES - 180, 90 - (r + 0.5) * RES))
        d, k = tree.query(_xyz(lons[miss], lats[miss]))
        label[miss] = grid[r[k], c[k]]
        dist[miss] = 2 * np.arcsin(np.clip(d / 2, 0, 1)) * 6371.0
    return label, dist


def chapter_of_areas() -> dict[str, tuple[str, float]]:
    """每個 IHO 海域大部分的面積落在 GOaS 的哪一章：{IHO 名稱: (GOaS 名稱, 占海域格子的比例)}"""
    iho, iho_names, goas, goas_names = rasters()
    both = (iho > 0) & (goas > 0)
    key = iho[both].astype(np.int64) * 16 + goas[both]
    counts = np.bincount(key, minlength=(len(iho_names) + 1) * 16).reshape(-1, 16)
    out = {}
    for i, name in enumerate(iho_names, start=1):
        row = counts[i]
        if row.sum() == 0:
            continue
        g = int(row.argmax())
        out[name] = (goas_names[g - 1], float(row[g] / row.sum()))
    return out
