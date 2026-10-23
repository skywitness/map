"""Global Solar Atlas 2（Solargis 為世界銀行 ESMAP 製作）：全球的太陽光電發電潛力 PVOUT。

- 用的是「World」GIS 資料的 PVOUT 長期年平均（LTAy，每日平均）：每 1 kWp 的太陽光電系統平均每天可以發多少 kWh，
  30 角秒（赤道約 0.93 km）的 GeoTIFF。zip 345 MB（2026-04 的版本，期間依地區從 1994–2019 年起到 2025 年；
  下載頁 https://globalsolaratlas.info/download/world，檔案清單 https://api.globalsolaratlas.info/download/World）。
  - 不用 GHI（水平面全天空日射量）：GHI 是物理上的日照資源，世界檔 zip 2.6 GB；PVOUT 已經考慮
    氣溫、傾角與系統損失，比較接近「潛力」，檔案也小得多。
- PVOUT 的定義：地面型、固定支架、最佳傾角的典型矽晶系統（理論潛力，不扣除不能蓋電廠的土地）。
- 範圍：北緯 65° 到南緯 60° 的陸地（實際有資料到南緯 56.6°）；海面、冰島、凱爾蓋朗群島等沒有資料。
  北緯 65° 以北（北歐北部、俄羅斯北部、阿拉斯加、加拿大北部、格陵蘭）沒有資料。
- 授權：CC BY 4.0，另加爭議先調解、再仲裁的條款（https://globalsolaratlas.info/support/terms-of-use；
  檔案裡的 XML 也寫著「© 2026 Solargis … CC BY 4.0」），要求的引用文字見 ATTRIBUTION_FULL。

下載後解壓出 PVOUT.tif，再把 30 角秒的格子每 2 × 2 平均成 1 角分（CELL，赤道約 1.85 km），
存成 .npy 放在快取，國家指標（topics/renewables.py）與網格圖磚（topics/renewables_grid_tiles.py）共用。
"""
from __future__ import annotations

import time
import zipfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from affine import Affine

import common
from common import CACHE_DIR, download

SOURCE = "gsa"
NAME = "World_PVOUT_GISdata_LTAy_AvgDailyTotals_GlobalSolarAtlas-v2_GEOTIFF.zip"
# 下載頁的 API 會轉址到 S3 的簽名網址（15 分鐘內有效）
URL = f"https://api.globalsolaratlas.info/download/World/{NAME}"
INFO_URL = "https://globalsolaratlas.info/download/world"
LICENSE_URL = "https://globalsolaratlas.info/support/terms-of-use"
# 使用條款要求的引用文字
ATTRIBUTION_FULL = (
    "Data obtained from the Global Solar Atlas 2.0, a free, web-based application is developed and operated by the "
    "company Solargis s.r.o. on behalf of the World Bank Group, utilizing Solargis data, with funding provided by the "
    "Energy Sector Management Assistance Program (ESMAP). For additional information: https://globalsolaratlas.info"
)
# 地圖右下角的短標示（純文字）
ATTRIBUTION = "Global Solar Atlas 2.0 (Solargis, World Bank/ESMAP), CC BY 4.0"
# 長期平均的期間：起始年依地區不同（1994、1999、2005、2007、2018 或 2019 年起，看衛星），都到 2025 年（檔案的 XML 說明）
PERIOD = (1994, 2025)
LAT_RANGE = (-60.0, 65.0)  # 檔案的範圍（南緯 56.6° 以南已經沒有陸地資料）
FACTOR = 2  # 30 角秒 → 1 角分
CELL = 1 / 60
FORMAT = 1  # 快取的 .npy 格式改了就加一


@dataclass
class Grid:
    """PVOUT（kWh/kWp/日）的 1 角分網格：values[列, 欄]，北邊在上，沒有資料是 NaN"""

    values: np.ndarray  # float32
    transform: Affine


def raster_path() -> Path:
    """解壓出的 30 角秒 PVOUT GeoTIFF"""
    tif = CACHE_DIR / SOURCE / "PVOUT.tif"
    if tif.exists() and not common.REFRESH:
        return tif
    archive = download(URL, SOURCE, NAME)
    with zipfile.ZipFile(archive) as z:
        member = next(n for n in z.namelist() if n.lower().endswith("pvout.tif"))
        tmp = tif.with_suffix(".tif.part")
        with z.open(member) as src, open(tmp, "wb") as dst:
            while chunk := src.read(1 << 24):
                dst.write(chunk)
        tmp.replace(tif)
    return tif


def load() -> Grid:
    """1 角分的 PVOUT 網格（第一次約 1 分鐘，之後讀快取）"""
    cache = CACHE_DIR / SOURCE / f"pvout_1min_v{FORMAT}.npz"
    if cache.exists() and not common.REFRESH:
        with np.load(cache) as f:
            return Grid(f["values"], Affine(*f["transform"]))
    import rasterio
    from rasterio.windows import Window

    started = time.perf_counter()
    with rasterio.open(raster_path()) as src:
        t = src.transform
        if abs(t.a * FACTOR - CELL) > 1e-9 or abs(t.e * FACTOR + CELL) > 1e-9:
            raise ValueError(f"PVOUT 的格子大小不是 30 角秒：{t}")
        rows, cols = src.height // FACTOR, src.width // FACTOR
        out = np.full((rows, cols), np.nan, np.float32)
        nodata = src.nodata
        step = 1200  # 每次讀 1200 列（10°）
        for r0 in range(0, rows * FACTOR, step):
            h = min(step, rows * FACTOR - r0)
            a = src.read(1, window=Window(0, r0, cols * FACTOR, h)).astype(np.float32)
            bad = ~np.isfinite(a) | (a < 0)
            if nodata is not None and np.isfinite(nodata):
                bad |= a == nodata
            a[bad] = 0
            n = (~bad).reshape(h // FACTOR, FACTOR, cols, FACTOR).sum(axis=(1, 3))
            s = a.reshape(h // FACTOR, FACTOR, cols, FACTOR).sum(axis=(1, 3), dtype=np.float64)
            with np.errstate(invalid="ignore", divide="ignore"):
                out[r0 // FACTOR : (r0 + h) // FACTOR] = np.where(n > 0, s / np.maximum(n, 1), np.nan)
        transform = Affine(CELL, 0, t.c, 0, -CELL, t.f)
    np.savez(cache, values=out, transform=np.array(transform)[:6])
    print(f"  Global Solar Atlas PVOUT：{src.width} × {src.height} → {cols} × {rows}，{time.perf_counter() - started:.0f} 秒")
    return Grid(out, transform)
