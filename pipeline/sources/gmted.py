"""USGS GMTED2010 全球數值高程模型（公有領域）：WGS84、30 角秒（赤道約 1 km）。

每一格是 7.5 角秒原始資料（主要來自 2000 年的 SRTM）的統計值，這裡用三份：
- mn30 平均值：北緯 84° 到南緯 90°（含南極洲），算平均海拔、高度分布、坡度
- mx30 最大值、mi30 最小值：北緯 84° 到南緯 56°，找最高點、最低點；格陵蘭沒有這兩份（值是 0）

注意：
- **海洋的值是 0，不是 nodata**，所以「三份都是 0」的格子當成海（真的剛好在海平面、而且整格都平的陸地極少）。
- 湖泊是水面的高度（裏海 −27 m、貝加爾湖 449 m），不是湖底。
- 原始檔是 ESRI ArcInfo 二進位網格（zip 約 250 MB 一份），GDAL 的 AIG 驅動可以直接讀。
"""
from __future__ import annotations

import zipfile
from pathlib import Path

from common import download

BASE = "https://edcintl.cr.usgs.gov/downloads/sciweb1/shared/topo/downloads/GMTED/Grid_ZipFiles"
PRODUCTS = ("mn30", "mx30", "mi30")
INFO_URL = "https://www.usgs.gov/coastal-changes-and-impacts/gmted2010"
CITATION = (
    "Danielson, J.J., and Gesch, D.B., 2011, Global multi-resolution terrain elevation data 2010 (GMTED2010): "
    "U.S. Geological Survey Open-File Report 2011-1073"
)


def grid_paths() -> dict[str, Path]:
    """{產品: 解壓後的網格資料夾}。第一次會下載三個 zip（共約 760 MB）並解壓到快取。"""
    out = {}
    for product in PRODUCTS:
        archive = download(f"{BASE}/{product}_grd.zip", "gmted", f"{product}_grd.zip")
        folder = archive.parent / f"{product}_grd"
        if not (folder / "hdr.adf").exists():
            print(f"  解壓 {archive.name}")
            with zipfile.ZipFile(archive) as z:
                z.extractall(archive.parent)
        out[product] = folder
    return out
