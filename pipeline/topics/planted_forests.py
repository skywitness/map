"""人工林（新主題，2026-10-30）：各國的人工林面積與占森林的比例（FAOSTAT），加上全球人工林與樹作物的範圍（SDPT v2.0）。

**國家**（FAOSTAT 土地利用 RL，CC BY 4.0）：Planted Forest（6716）、Forest land（6646），面積（element 5110，千公頃），
1990–2025 年；森林不到 5 萬公頃的不算比例（只有面積）。FAOSTAT 沒有台灣：用農業部「第四次森林資源調查全島森林林型分布圖」（data.gov.tw 57873，政府資料開放授權
條款第 1 版）的林地功能：生產性人工林與保護性人工林的面積加起來，除以全部林地的面積；第四次調查是 2008–2013 年，
標在 TW_YEAR（同水資源與森林主題），指標檔加 latestWithin 讓之後的年份也顯示它（附註寫明）。

**範圍圖**（WRI Spatial Database of Planted Trees v2.0，Richter 等 2024，CC BY 4.0）：GFW 網站的 6 級向量圖磚
（sources/sdpt_tiles.py），每張圖磚的多邊形依 simpletype 柵格化成 1024 × 1024（Planted forest 是 1、Tree crops 是 2），
再加總到 0.1° 的格子（像素的面積依緯度加權）：人工林與樹作物合計占一格 MIN_SHARE 以上才畫，代碼是兩者較多的一種。
伺服器產生不出來的圖磚（sources/sdpt_tiles.py，8 級還是不行的 59 張：瑞典 22、芬蘭、南韓、泰國各 5、印尼、智利各 4…）
沒有畫。SDPT 把台灣的人工林標成 CHN／China；台灣的格子（國界內）改用林型分布圖：人工林的多邊形（依外框的中心）加總到同樣的
0.1° 格子，代碼一律是人工林（林型圖沒有樹作物）。
- grid/planted.png：全球 3600 × 1800（同氣候分區的格式），0 不畫、1 人工林、2 樹作物

第一次：SDPT 約 1,000 張圖磚（約 1 小時）、林型分布圖 420 MB 的 zip（1.4 GB 的 shapefile，讀一次約 5 分鐘，之後用
.cache/moa-forest/taiwan.json）。
"""
from __future__ import annotations

import json
import zipfile
from collections import defaultdict

import numpy as np

from common import CACHE_DIR, OUT_DIR, download, indicator_file, now_iso, write_json
from geoindex import countries_at
from sources import faostat, sdpt_tiles
from topics.koppen import png_gray

OUT = OUT_DIR / "topics" / "planted-forests"
TW_URL = ("https://data.moa.gov.tw///Upload/OD_E31/43335/"
          "%e5%85%a8%e5%b3%b6%e6%a3%ae%e6%9e%97%e6%9e%97%e5%9e%8b%e5%88%86%e5%b8%83%e5%9c%96_%e5%93%81%e8%b3%aa%e8%99%95%e7%90%86.zip")
TW_YEAR = 2010
WITHIN = 15
PLANTED_FUNCTIONS = {"生產性人工林", "保護性人工林"}
CELL = 0.1
MIN_SHARE = 0.05
MIN_FOREST = 50  # 千公頃
RASTER = 1024
SIMPLE = {"Planted forest": 1, "Tree crops": 2}


# ── 台灣：第四次森林資源調查全島森林林型分布圖 ─────────────────────────


def taiwan() -> dict:
    """{'planted': 公頃, 'forest': 公頃, 'cells': {格子編號: 人工林公頃}}"""
    cache = CACHE_DIR / "moa-forest" / "taiwan.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    import shapefile
    from rasterio.warp import transform

    path = download(TW_URL, "moa-forest", "forest_type.zip")
    folder = path.parent / "x"
    if not any(folder.glob("*.shp")):
        with zipfile.ZipFile(path) as z:
            z.extractall(folder)
    shp = next(folder.glob("*.shp"))
    planted = forest = 0.0
    xs, ys, has = [], [], []
    with shapefile.Reader(str(shp), encoding="utf-8") as r:
        for rec in r.iterShapeRecords(fields=["Function", "Area_ha"]):
            ha = float(rec.record[1] or 0)
            forest += ha
            if rec.record[0] not in PLANTED_FUNCTIONS:
                continue
            planted += ha
            x0, y0, x1, y1 = rec.shape.bbox
            xs.append((x0 + x1) / 2)
            ys.append((y0 + y1) / 2)
            has.append(ha)
    lons, lats = transform("EPSG:3826", "EPSG:4326", xs, ys)
    cells: dict[int, float] = defaultdict(float)
    for lon, lat, ha in zip(lons, lats, has):
        cells[cell_index(lon, lat)] += ha
    out = {"planted": planted, "forest": forest, "cells": {str(k): v for k, v in cells.items()}}
    cache.write_text(json.dumps(out), encoding="utf-8")
    return out


def cell_index(lon: float, lat: float) -> int:
    w = round(360 / CELL)
    return int((90 - lat) // CELL) * w + int((lon + 180) // CELL)


# ── SDPT 的範圍圖 ──────────────────────────────────────


def sdpt_grid() -> tuple[np.ndarray, np.ndarray]:
    """每一格人工林、樹作物的面積（km²），各是 (1800 × 3600) 攤平"""
    import mapbox_vector_tile
    from rasterio.features import rasterize
    from rasterio.transform import Affine
    from shapely.geometry import shape

    cache = CACHE_DIR / "sdpt" / "grid.npz"
    if cache.exists():
        d = np.load(cache)
        return d["planted"], d["crops"]
    w, h = round(360 / CELL), round(180 / CELL)
    area = np.zeros((3, w * h))
    tiles = sdpt_tiles.fetch_all()
    for k, (z, x, y) in enumerate(tiles):
        data = sdpt_tiles.path_of(z, x, y).read_bytes()
        if not data:
            continue
        layers = mapbox_vector_tile.decode(data, default_options={"y_coord_down": True})
        shapes = []
        for layer in layers.values():
            scale = RASTER / layer["extent"]
            for f in layer["features"]:
                code = SIMPLE.get(f["properties"].get("simpletype"))
                if code:
                    shapes.append((shape(f["geometry"]), code))
        if not shapes:
            continue
        grid = rasterize(shapes, out_shape=(RASTER, RASTER), transform=Affine.scale(1 / scale), fill=0, dtype="uint8")
        rows, cols = np.nonzero(grid)
        n = 2 ** z
        # 像素中心的經緯度（Web Mercator 的圖磚）
        lon = (x + (cols + 0.5) / RASTER) / n * 360 - 180
        lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (y + (rows + 0.5) / RASTER) / n))))
        # 像素的面積：赤道上 (40075 / n / RASTER)² km²，乘上 cos²(緯度)
        px = (40075.017 / n / RASTER) ** 2 * np.cos(np.radians(lat)) ** 2
        idx = ((90 - lat) // CELL).astype(np.int64) * w + ((lon + 180) // CELL).astype(np.int64)
        for c in (1, 2):
            m = grid[rows, cols] == c
            area[c] += np.bincount(idx[m], weights=px[m], minlength=w * h)
        if k % 100 == 0:
            print(f"    SDPT 柵格化 {k + 1} / {len(tiles)}", flush=True)
    np.savez_compressed(cache, planted=area[1], crops=area[2])
    return area[1], area[2]


def build() -> None:
    # 國家：FAOSTAT
    series: dict[str, dict[int, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for r in faostat.rows("RL", {5110}, {6716, 6646}):
        series[r.area][r.item][r.year] = r.value
    years = sorted({y for s in series.values() for v in s.values() for y in v})
    area: dict[str, list[float | None]] = {}
    share: dict[str, list[float | None]] = {}
    for iso3, s in series.items():
        if iso3 == "WLD" or 6716 not in s:
            continue
        area[iso3] = [round(s[6716][y] / 10, 3) if y in s[6716] else None for y in years]  # 千公頃 → 萬公頃
        # 森林不到 MIN_FOREST 千公頃的（法羅群島、格陵蘭、科威特這類）幾公頃就是 100%，不算比例
        share[iso3] = [round(s[6716][y] / s[6646][y] * 100, 2) if y in s[6716] and s[6646].get(y, 0) >= MIN_FOREST else None
                       for y in years]
    tw = taiwan()
    tw_area, tw_share = tw["planted"] / 1e4, tw["planted"] / tw["forest"] * 100
    area["TWN"] = [round(tw_area, 2) if y == TW_YEAR else None for y in years]
    share["TWN"] = [round(tw_share, 2) if y == TW_YEAR else None for y in years]
    print(f"  台灣：人工林 {tw['planted']:,.0f} 公頃、林地 {tw['forest']:,.0f} 公頃、{tw_share:.1f}%")
    wld = series["WLD"]
    notes = {
        "TWN": (f"FAOSTAT 沒有台灣。用農業部第四次森林資源調查（2008–2013 年）的全島森林林型分布圖：生產性人工林與保護性人工林"
                f"共 {tw['planted'] / 1e4:,.1f} 萬公頃，占林地 {tw['forest'] / 1e4:,.1f} 萬公頃的 {tw_share:.1f}%，標在 {TW_YEAR} 年；"
                "之後沒有新的調查，之後的年份也顯示這個值。"),
    }
    notes_en = {
        "TWN": (f"FAOSTAT does not cover Taiwan. The forest-type map of the Ministry of Agriculture's fourth national forest "
                f"inventory (2008–2013) is used instead: production and protection plantations total {tw['planted'] / 1e3:,.0f},000 ha, "
                f"{tw_share:.1f}% of {tw['forest'] / 1e6:,.2f} million ha of forest land, shown as {TW_YEAR}; "
                "with no later inventory, later years show the same value."),
    }
    common = {"latestWithin": WITHIN, "notes": notes, "notesEn": notes_en}
    write_json(OUT / "planted-share.json", indicator_file(
        "planted-share", "%", years, share, **common,
        aggregates={"WLD": [round(wld[6716][y] / wld[6646][y] * 100, 2) for y in years]}))
    write_json(OUT / "planted-area.json", indicator_file(
        "planted-area", "萬公頃", years, area, **common,
        aggregates={"WLD": [round(wld[6716][y] / 10, 1) for y in years]}))
    top = sorted(((k, v[-1]) for k, v in area.items() if v[-1]), key=lambda kv: -kv[1])[:6]
    print(f"  {years[-1]} 年人工林最多：" + "、".join(f"{k} {v:,.0f} 萬公頃" for k, v in top))

    # 範圍圖
    planted, crops = sdpt_grid()
    w, h = round(360 / CELL), round(180 / CELL)
    rows = np.arange(h)
    cell_km2 = np.repeat((CELL * 111.32) ** 2 * np.cos(np.radians(90 - (rows + 0.5) * CELL)), w)
    # 台灣的格子：SDPT 標成中國，換成林型分布圖
    tw_cells = np.zeros(w * h)
    for k, ha in tw["cells"].items():
        tw_cells[int(k)] += ha / 100
    lat0, lat1, lon0, lon1 = 21.5, 26.5, 118.0, 122.5
    r0, r1 = int((90 - lat1) // CELL), int((90 - lat0) // CELL) + 1
    c0, c1 = int((lon0 + 180) // CELL), int((lon1 + 180) // CELL) + 1
    box = [(r, c) for r in range(r0, r1) for c in range(c0, c1)]
    in_tw = countries_at([-180 + (c + 0.5) * CELL for _, c in box], [90 - (r + 0.5) * CELL for r, _ in box], nearest=False)
    tw_idx = np.array([r * w + c for (r, c), iso in zip(box, in_tw) if iso == "TWN"])
    planted[tw_idx], crops[tw_idx] = tw_cells[tw_idx], 0
    total = planted + crops
    drawn = total / cell_km2 >= MIN_SHARE
    codes = np.where(drawn, np.where(planted >= crops, 1, 2), 0).astype(np.uint8)
    (OUT / "grid").mkdir(parents=True, exist_ok=True)
    (OUT / "grid" / "planted.png").write_bytes(png_gray(codes.reshape(h, w)))
    print(f"  輸出 public/data/topics/planted-forests/grid/planted.png "
          f"({(OUT / 'grid' / 'planted.png').stat().st_size / 1024:.0f} KB)；畫出的格子 {int(drawn.sum()):,}"
          f"（人工林 {int((codes == 1).sum()):,}、樹作物 {int((codes == 2).sum()):,}）；台灣 {int(drawn[tw_idx].sum())} 格")
    write_json(OUT / "manifest.json", {
        "topic": "planted-forests", "generatedAt": now_iso(),
        "sources": ["FAOSTAT Land Use (RL), CC BY 4.0",
                    "Richter et al. 2024, Spatial Database of Planted Trees (SDPT Version 2.0), CC BY 4.0, GFW vector tiles v20231128 zoom 6",
                    "農業部 第四次森林資源調查全島森林林型分布圖（data.gov.tw 57873，政府資料開放授權條款第 1 版）"],
        "taiwan": {"plantedHa": round(tw["planted"]), "forestHa": round(tw["forest"]), "year": TW_YEAR},
        "grid": {"cell": CELL, "minShare": MIN_SHARE},
    })
