"""世界銀行／IMF 的 Global Shipping Traffic Density（全球航運密度）。

- 世界銀行資料目錄 0037580（https://datacatalog.worldbank.org/search/dataset/0037580），授權 CC BY 4.0。
- IMF World Seaborne Trade Monitoring System（Cerdeiro, Komaromi, Liu & Saeed 2020）分析 2015 年 1 月到 2021 年 2 月
  每小時的 AIS 船位，每個 0.005°（赤道約 500 m）格子的值是這段期間所有船回報的 AIS 位置數（航行中與停泊的都算），
  「所有船種」那一層（shipdensity_global.zip，535 MB；裡面的 GeoTIFF 解壓後 9.8 GB，72,006 × 33,998 格，北緯 85° 到南緯 85°）。
- 數值的分布很怪：有船經過的格子多半是 10 到 100 以下，主要航道上卻是千萬以上（英吉利海峽約 3,000 萬），中間很少，
  所以只當成相對的強度（取對數分級），不寫成「每小時幾艘船」這類絕對的意思。
- 讀法：不解壓到磁碟，用 GDAL 的 /vsizip/ 依序讀原始解析度（內附的縮小版 .ovr 是取樣、不是平均，不能用），
  每 4 × 4 格平均成 0.02°（約 2 km，含 0 的格子，所以是「每個 500 m 格子的平均 AIS 位置數」），存成 .npy 快取。
"""
from __future__ import annotations

import os
import time

import numpy as np
from affine import Affine

from common import CACHE_DIR, download

URL = "https://datacatalogfiles.worldbank.org/ddh-published/0037580/5/DR0045406/shipdensity_global.zip"
INFO_URL = "https://datacatalog.worldbank.org/search/dataset/0037580"
PERIOD = ("2015-01", "2021-02")
FACTOR = 4  # 0.005° × 4 = 0.02°
NODATA = 2147483647
ATTRIBUTION = "World Bank / IMF, Global Shipping Traffic Density (CC BY 4.0)"
CITATION = (
    "World Bank (2021). Global Shipping Traffic Density. https://datacatalog.worldbank.org/search/dataset/0037580 "
    "(CC BY 4.0). Data: IMF World Seaborne Trade Monitoring System (Cerdeiro, Komaromi, Liu and Saeed, 2020), "
    "hourly AIS positions January 2015 – February 2021."
)


def load() -> tuple[np.ndarray, Affine]:
    """0.02° 的平均 AIS 位置數（float32，沒有資料的是 NaN）與它的 transform"""
    import rasterio

    cache = CACHE_DIR / "ship-density" / f"global_mean_{FACTOR}.npz"
    if cache.exists():
        with np.load(cache) as z:
            return z["values"], Affine(*z["transform"][:6])
    zip_path = download(URL, "ship-density", "shipdensity_global.zip")
    started = time.perf_counter()
    with rasterio.Env(GDAL_CACHEMAX=1024), rasterio.open(f"/vsizip/{zip_path.as_posix()}/shipdensity_global.tif") as ds:
        if ds.nodata != NODATA or ds.dtypes[0] != "int32":
            raise ValueError(f"航運密度的 GeoTIFF 格式跟預期不同：{ds.profile}")
        rows, cols = (ds.height // FACTOR) * FACTOR, (ds.width // FACTOR) * FACTOR
        out = np.full((rows // FACTOR, cols // FACTOR), np.nan, np.float32)
        strip = 128 * FACTOR  # GeoTIFF 是 128 × 128 的區塊，一次讀 4 排區塊
        for r0 in range(0, rows, strip):
            n = min(strip, rows - r0)
            a = ds.read(1, window=((r0, r0 + n), (0, cols)))
            valid = a != NODATA
            v = np.where(valid, a, 0).astype(np.float64)
            shape = (n // FACTOR, FACTOR, cols // FACTOR, FACTOR)
            s = v.reshape(shape).sum(axis=(1, 3))
            c = valid.reshape(shape).sum(axis=(1, 3))
            with np.errstate(invalid="ignore", divide="ignore"):
                out[r0 // FACTOR : (r0 + n) // FACTOR] = np.where(c > 0, s / c, np.nan)
            if os.environ.get("SHIP_DENSITY_VERBOSE") and r0 % (strip * 16) == 0:
                print(f"    第 {r0:,} 列（{time.perf_counter() - started:.0f} 秒）")
        t = ds.transform * Affine.scale(FACTOR)
    cache.parent.mkdir(parents=True, exist_ok=True)
    np.savez(cache, values=out, transform=np.array(tuple(t)))
    print(f"  航運密度：讀原始網格並平均成 0.02° 共 {time.perf_counter() - started:.0f} 秒")
    return out, t
