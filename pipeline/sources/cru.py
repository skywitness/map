"""CRU TS（東英吉利大學氣候研究中心 CRU 與英國國家大氣科學中心 NCAS）：全球陸地 0.5° 的逐月氣候網格。

- 1901 年到最近一年（4.10 版到 2025 年），不含南極洲。這裡用月平均氣溫（tmp，°C）、月降雨量（pre，mm/月）與雨日（wet，日雨量 ≥ 0.1 mm 的日數）。
- 由測站觀測內插而成：每個月的測站距平（相對 1961–1990 年）內插到網格，再加上 1961–1990 年的氣候平均值。
  **離測站太遠（氣溫約 1,200 km、降雨約 450 km）的格子距平是 0，也就是直接填氣候平均值**，
  所以早期測站稀少的地方（非洲、南美內陸、北極）看起來變化很小。
- 授權：Open Database License（ODbL）＋ Database Contents License，要標示
  「Climatic Research Unit, University of East Anglia」、衍生的資料庫也要用同樣的授權
  （https://crudata.uea.ac.uk/cru/data/hrg/ 的 License 一節）。

下載 ASCII 版（`.dat.gz`，一個變數約 160 MB），只要 numpy 就能讀，不必裝 NetCDF 的套件：
- 每個月 360 列 × 720 欄的整數，單位是 0.1（0.1 °C、0.1 mm；雨日是 0.01 天），沒有資料是 −999。
- 每個值 8 個字元寬、每列 720 個值；**第一列是最南邊**（南緯 89.75°），經度從 −179.75° 開始。

解析一次約 1 分鐘，結果（只留陸地格子）存成 .npz 放在快取，國家指標與暖化網格圖磚兩個步驟共用。
"""
from __future__ import annotations

import gzip
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from common import CACHE_DIR, download

VERSION = "4.10"
RUN = "cruts.2604091129.v4.10"  # CRU 網站上這一版的資料夾名稱
FIRST_YEAR, LAST_YEAR = 1901, 2025
BASE = f"https://crudata.uea.ac.uk/cru/data/hrg/cru_ts_{VERSION}/{RUN}"
INFO_URL = "https://crudata.uea.ac.uk/cru/data/hrg/"
CITATION = (
    f"CRU TS v{VERSION}. Harris, I., Osborn, T.J., Jones, P. & Lister, D. (2020). Version 4 of the CRU TS monthly "
    "high-resolution gridded multivariate climate dataset. Scientific Data 7, 109. "
    "https://doi.org/10.1038/s41597-020-0453-3"
)
# 地圖右下角的短標示（純文字）
ATTRIBUTION = f"CRU TS {VERSION} (UEA CRU, NCAS)"

CELL = 0.5
ROWS, COLS = 360, 720
MISSING = -999
WIDTH = 8  # 每個值的字元數
LINE = COLS * WIDTH + 1  # 含換行
SOURCE = "cru"
# ASCII 檔裡的整數要除以多少：多數變數是 0.1（°C、mm），雨日（wet）是 0.01 天
DIVISOR = {"wet": 100}


@dataclass
class Grid:
    """一個變數的陸地格子：values[月, 格子]，格子依 mask（北邊在上，row 0 = 北緯 89.75°）的 row-major 順序。"""

    var: str
    mask: np.ndarray  # (360, 720) bool，有資料的陸地格子
    values: np.ndarray  # (月數, 陸地格數) float32，單位 °C 或 mm/月
    first_year: int

    @property
    def years(self) -> list[int]:
        return list(range(self.first_year, self.first_year + self.values.shape[0] // 12))

    @property
    def lat(self) -> np.ndarray:
        """每個陸地格子中心的緯度"""
        rows = np.nonzero(self.mask)[0]
        return 90 - (rows + 0.5) * CELL

    def monthly(self, year: int) -> np.ndarray:
        """(12, 陸地格數)"""
        i = (year - self.first_year) * 12
        return self.values[i : i + 12]


def raw_path(var: str) -> Path:
    name = f"cru_ts{VERSION}.{FIRST_YEAR}.{LAST_YEAR}.{var}.dat.gz"
    return download(f"{BASE}/{var}/{name}", SOURCE, name)


def load(var: str) -> Grid:
    """讀一個變數（'tmp'、'pre' 或 'wet'）的全部月份。第一次會下載並解析，之後讀快取的 .npz。"""
    div = DIVISOR.get(var, 10)
    cached = CACHE_DIR / SOURCE / f"cru_ts{VERSION}.{var}.land.npz"
    if cached.exists():
        with np.load(cached) as z:
            return Grid(var, z["mask"], z["values"].astype(np.float32) / div, int(z["first_year"]))
    path = raw_path(var)
    print(f"  解析 {path.name}（約 1 分鐘）")
    months = (LAST_YEAR - FIRST_YEAR + 1) * 12
    mask = None
    out = None
    with gzip.open(path, "rb") as f:
        for m in range(months):
            block = f.read(ROWS * LINE)
            if len(block) != ROWS * LINE:
                raise ValueError(f"{path.name} 第 {m + 1} 個月不完整（{len(block)} 位元組）")
            lines = np.frombuffer(block, dtype="S1").reshape(ROWS, LINE)
            if not (lines[:, -1] == b"\n").all():
                raise ValueError(f"{path.name} 第 {m + 1} 個月的格式不是每列 {COLS} 個 {WIDTH} 字元寬的值")
            grid = np.ascontiguousarray(lines[:, :-1]).view(f"S{WIDTH}").astype(np.int32)[::-1]  # 改成北邊在上
            if mask is None:
                mask = grid != MISSING
                out = np.empty((months, int(mask.sum())), dtype=np.int32)
            land = grid[mask]
            if (land == MISSING).any() or ((grid != MISSING) & ~mask).any():
                raise ValueError(f"{path.name} 第 {m + 1} 個月的陸地範圍跟第一個月不同")
            out[m] = land
        if f.read(1):
            raise ValueError(f"{path.name} 比預期的 {months} 個月長，檢查 LAST_YEAR")
    assert mask is not None and out is not None
    # 氣溫存成 int16 就夠；降雨有些格子一個月超過 3,276.7 mm（int16 的上限），要用 int32
    small = out.min() >= np.iinfo(np.int16).min and out.max() <= np.iinfo(np.int16).max
    np.savez(cached, mask=mask, values=out.astype(np.int16) if small else out, first_year=FIRST_YEAR)
    print(f"  陸地 {mask.sum():,} 格 × {months} 個月")
    return Grid(var, mask, out.astype(np.float32) / div, FIRST_YEAR)


def annual_mean(grid: Grid) -> np.ndarray:
    """(年數, 陸地格數)：12 個月的平均"""
    return grid.values.reshape(-1, 12, grid.values.shape[1]).mean(axis=1)


def annual_total(grid: Grid) -> np.ndarray:
    """(年數, 陸地格數)：12 個月的加總"""
    return grid.values.reshape(-1, 12, grid.values.shape[1]).sum(axis=1)
