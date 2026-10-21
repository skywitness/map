"""JRC GHS-POP R2023A 網格人口（CC BY 4.0）：WGS84、30 角秒（赤道約 1 km）。

原始檔是 43202 × 21384 的 float64 GeoTIFF，每格是「住在這一格的人數」。
這裡用逐列區塊讀取（每次 256 列），把每個像素歸到所屬國家，再加總成粗網格，
記憶體用量固定在幾百 MB 以內。
"""
from __future__ import annotations

import zipfile
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine
from rasterio.features import rasterize
from rasterio.windows import Window
from rasterio.windows import transform as window_transform

from common import download

EPOCH = 2020  # R2023A 的 2025、2030 是推估；2020 是最接近實測的一期
NAME = f"GHS_POP_E{EPOCH}_GLOBE_R2023A_4326_30ss_V1_0"
URL = (
    "https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_POP_GLOBE_R2023A/"
    f"GHS_POP_E{EPOCH}_GLOBE_R2023A_4326_30ss/V1-0/{NAME}.zip"
)
CITATION = (
    "Schiavina, M., Freire, S., Carioli, A., MacManus, K. (2023): GHS-POP R2023A - "
    "GHS population grid multitemporal (1975-2030). European Commission, Joint Research Centre (JRC). "
    "doi:10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE"
)

ROWS_PER_WINDOW = 256  # 原始檔的區塊大小是 256 × 256，一次讀一整排區塊最快
# 1:50m 的海岸線比 1 km 網格粗，沿海城市（孟買、香港、里約）有不少像素落在所有國界外。
# 這些像素改歸最近的國家，最多往外找這麼多格（約 20 km）；更遠的（例如沒有形狀的小島）就不歸國。
GAP_FILL_PIXELS = 24


@dataclass(frozen=True)
class Override:
    """矩形範圍內原本歸給 source 的像素改歸 target；source 為 0 代表不在任何國界內。"""

    source: int
    target: int
    lon0: float
    lat0: float
    lon1: float
    lat1: float


@dataclass
class GridResult:
    cell: np.ndarray  # 粗網格編號：row * cols + col，row 0 是北緯 90° 那一列
    code: np.ndarray  # 國家編號（0 = 不在任何國界內）
    pop: np.ndarray  # 人數
    raw_total: float  # 原始網格的全球總人數


def raster_path() -> Path:
    """下載 zip 並把 GeoTIFF 解壓到快取（zip 內是 deflate 壓縮，直接隨機讀取很慢）。"""
    archive = download(URL, "ghsl", f"{NAME}.zip")
    tif = archive.with_suffix(".tif")
    if not tif.exists() or tif.stat().st_mtime < archive.stat().st_mtime:
        print(f"  解壓 {tif.name}")
        with zipfile.ZipFile(archive) as z, z.open(f"{NAME}.tif") as src, open(tif, "wb") as dst:
            while chunk := src.read(1 << 24):
                dst.write(chunk)
    return tif


def aggregate(
    tif: Path,
    cell_deg: float,
    shapes: Sequence[tuple[dict, int, tuple[float, float, float, float]]],
    overrides: Sequence[Override] = (),
) -> GridResult:
    """把 30 角秒人口加總到 cell_deg 度的網格，並依國界拆開。

    shapes：(GeoJSON 幾何, 國家編號 ≥ 1, (lon0, lat0, lon1, lat1))。
    回傳每個「網格 × 國家」的人數，一個跨國界的網格會有好幾筆。
    """
    cols = round(360 / cell_deg)
    rows = round(180 / cell_deg)
    max_code = max(code for _g, code, _b in shapes)
    parts: list[tuple[np.ndarray, np.ndarray]] = []
    raw_total = 0.0

    with rasterio.open(tif) as src:
        t = src.transform
        width = src.width
        # 每一欄、每一列的像素中心 → 粗網格的欄、列（原始檔左右各多出約 1 格，超出 ±180° 的繞回另一側）
        lon = t.c + (np.arange(width) + 0.5) * t.a
        lon = (lon + 180) % 360 - 180
        cell_col = np.clip(np.floor((lon + 180) / cell_deg).astype(np.int64), 0, cols - 1)

        for row_off in range(0, src.height, ROWS_PER_WINDOW):
            h = min(ROWS_PER_WINDOW, src.height - row_off)
            pop = src.read(1, window=Window(0, row_off, width, h))
            pop[~np.isfinite(pop) | (pop < 0)] = 0
            if not pop.any():
                continue
            raw_total += float(pop.sum())

            # 國界多畫上下各 GAP_FILL_PIXELS 列，補海岸像素時才找得到區塊外的國家
            top = max(0, row_off - GAP_FILL_PIXELS)
            bottom = min(src.height, row_off + h + GAP_FILL_PIXELS)
            codes = country_codes(shapes, Window(0, top, width, bottom - top), t)
            fill_gaps(codes, row_off - top, pop)
            codes = codes[row_off - top : row_off - top + h]

            lat = t.f + (row_off + np.arange(h) + 0.5) * t.e
            for o in overrides:
                r = (lat >= o.lat0) & (lat <= o.lat1)
                c = (lon >= o.lon0) & (lon <= o.lon1)
                if r.any() and c.any():
                    block = codes[np.ix_(r, c)]
                    block[block == o.source] = o.target
                    codes[np.ix_(r, c)] = block

            cell_row = np.clip(np.floor((90 - lat) / cell_deg).astype(np.int64), 0, rows - 1)
            mask = pop > 0
            rr, cc = np.nonzero(mask)
            cell = cell_row[rr] * cols + cell_col[cc]
            key = cell * (max_code + 1) + codes[rr, cc]
            uniq, inverse = np.unique(key, return_inverse=True)
            parts.append((uniq, np.bincount(inverse, weights=pop[rr, cc])))

    # 跨兩個讀取區塊的網格會出現兩次，最後再合併
    keys = np.concatenate([k for k, _ in parts])
    sums = np.concatenate([s for _, s in parts])
    uniq, inverse = np.unique(keys, return_inverse=True)
    totals = np.bincount(inverse, weights=sums)
    return GridResult(cell=uniq // (max_code + 1), code=uniq % (max_code + 1), pop=totals, raw_total=raw_total)


def country_codes(shapes: Sequence[tuple[dict, int, tuple[float, ...]]], window: Window, t: Affine) -> np.ndarray:
    """把國界畫成跟人口網格對齊的國家編號（像素中心在多邊形內才算）。"""
    lat_top = t.f + window.row_off * t.e
    lat_bottom = lat_top + window.height * t.e
    nearby = [(g, code) for g, code, (_x0, y0, _x1, y1) in shapes if y1 >= lat_bottom and y0 <= lat_top]
    shape = (window.height, window.width)
    if not nearby:
        return np.zeros(shape, dtype=np.uint16)
    return rasterize(nearby, out_shape=shape, transform=window_transform(window, t), fill=0, dtype="uint16")


def fill_gaps(codes: np.ndarray, row0: int, pop: np.ndarray) -> None:
    """有人口卻不在任何國界內的像素，一格一格往外長，歸給最先碰到的國家（就地修改 codes）。

    codes 比 pop 多了上下的緩衝列，pop 的第 0 列對應 codes 的第 row0 列。
    """
    rows = slice(row0, row0 + pop.shape[0])
    if not ((codes[rows] == 0) & (pop > 0)).any():
        return
    for _ in range(GAP_FILL_PIXELS):
        grown = codes.copy()
        np.maximum(grown[1:], codes[:-1], out=grown[1:])
        np.maximum(grown[:-1], codes[1:], out=grown[:-1])
        np.maximum(grown[:, 1:], codes[:, :-1], out=grown[:, 1:])
        np.maximum(grown[:, :-1], codes[:, 1:], out=grown[:, :-1])
        empty = codes == 0
        codes[empty] = grown[empty]
        if not ((codes[rows] == 0) & (pop > 0)).any():
            return
