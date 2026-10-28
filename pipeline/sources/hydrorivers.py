"""HydroRIVERS v1.0（WWF HydroSHEDS 衍生的全球河道，15 角秒，847.8 萬段河道）。

- 授權：HydroSHEDS 第 1 版的授權協議（HydroSHEDS Technical Documentation v1.4 的附錄 A；HydroRIVERS 的技術文件
  第 4.1 節寫明適用同一份協議）。可以商業與非商業使用（官方網站：「freely available for scientific, educational and
  commercial use」）；第 2.1.2 條准許把資料「incorporated into any Derivative Works」散布給使用者，但不能當成獨立的
  產品（「as a stand-alone product」）散布；第 2.2 條與附錄 B 要求固定的版權聲明。這裡只輸出簡化、篩選、量化過的
  河道（地圖的一部分），不轉載原始檔（DESIGN.md 第 8 節第 86 點）。
- 引用：Lehner, B., Grill G. (2013): Global river hydrography and network routing: baseline data and new approaches to
  study the world's large river systems. Hydrological Processes, 27(15): 2171–2186.
- 下載：https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_shp.zip（全球的 shapefile，544 MB，不必登入），
  解壓到 .cache/hydrosheds/（.shp 1.25 GB、.dbf 873 MB、.shx 68 MB）。

讀法：標準函式庫加 numpy（不需要 GDAL）。屬性從 .dbf 依欄位寬度切出來轉成數字，存成 .npz 快取（之後約 1 秒）；
幾何用 .shx 的位移直接到 .shp 讀（numpy memmap），只讀需要的河道。每段河道是一條由上游往下游畫的線
（最後一個點是這段的出口，HydroRIVERS 技術文件的 DIST_DN_KM 從這一點量）。
"""
from __future__ import annotations

import zipfile
from functools import lru_cache
from pathlib import Path

import numpy as np

from common import CACHE_DIR, download

URL = "https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_shp.zip"
ZIP = "HydroRIVERS_v10_shp.zip"
DIR = CACHE_DIR / "hydrosheds"
STEM = "HydroRIVERS_v10_shp/HydroRIVERS_v10"
INFO_URL = "https://www.hydrosheds.org/products/hydrorivers"
CITATION = (
    "Lehner, B., Grill G. (2013): Global river hydrography and network routing: baseline data and new approaches to "
    "study the world's large river systems. Hydrological Processes, 27(15): 2171–2186."
)
# HydroSHEDS 授權協議附錄 B（Exhibit B）規定的版權聲明，[ ] 裡換成這個衍生產品的名稱
ATTRIBUTION = (
    "This product World Data Map (Rivers and drainage basins) incorporates data from the HydroSHEDS version 1 "
    "database which is © World Wildlife Fund, Inc. (2006-2022) and has been used herein under license. WWF has not "
    "evaluated the data as altered and incorporated within World Data Map (Rivers and drainage basins), and therefore "
    "gives no warranty regarding its accuracy, completeness, currency or suitability for any particular purpose. "
    "Portions of the HydroSHEDS v1 database incorporate data which are the intellectual property rights of © USGS "
    "(2006-2008), NASA (2000-2005), ESRI (1992-1998), CIAT (2004-2006), UNEP-WCMC (1993), WWF (2004), Commonwealth "
    "of Australia (2007), and Her Royal Majesty and the British Crown and are used under license. The HydroSHEDS v1 "
    "database and more information are available at https://www.hydrosheds.org."
)

# 要用的欄位（.dbf 的名稱）→ numpy 型別
FIELDS = {
    "HYRIV_ID": np.int64,
    "NEXT_DOWN": np.int64,
    "MAIN_RIV": np.int64,
    "LENGTH_KM": np.float32,
    "DIST_DN_KM": np.float32,
    "DIST_UP_KM": np.float32,
    "CATCH_SKM": np.float32,
    "UPLAND_SKM": np.float64,
    "ENDORHEIC": np.int8,
    "DIS_AV_CMS": np.float64,
    "ORD_STRA": np.int8,
    "ORD_CLAS": np.int8,
}
ATTR_CACHE = "hydrorivers_v10_attributes.npz"
ENDS_CACHE = "hydrorivers_v10_ends.npz"


def _extract() -> Path:
    """解壓 .shp、.shx、.dbf（已經解壓過就直接用）"""
    shp = DIR / f"{STEM}.shp"
    if all((DIR / f"{STEM}.{ext}").exists() for ext in ("shp", "shx", "dbf")):
        return shp
    archive = download(URL, "hydrosheds", ZIP)
    print("  解壓 HydroRIVERS（約 2.2 GB）")
    with zipfile.ZipFile(archive) as z:
        for ext in ("shp", "shx", "dbf"):
            z.extract(f"{STEM}.{ext}", DIR)
    return shp


@lru_cache(maxsize=1)
def attributes() -> dict[str, np.ndarray]:
    """所有河道的屬性，每個欄位一個陣列（依檔案順序，第 i 個是第 i 段河道）"""
    cache = DIR / ATTR_CACHE
    if cache.exists():
        with np.load(cache) as z:
            return {k: z[k] for k in z.files}
    _extract()
    path = DIR / f"{STEM}.dbf"
    raw = np.memmap(path, dtype=np.uint8, mode="r")
    n = int(raw[4:8].view("<u4")[0])
    header = int(raw[8:10].view("<u2")[0])
    size = int(raw[10:12].view("<u2")[0])
    # 欄位描述從第 32 個位元組開始，每個 32 位元組，0x0D 結束；每筆紀錄第一個位元組是刪除標記
    fields: dict[str, tuple[int, int]] = {}
    pos, offset = 32, 1
    while raw[pos] != 0x0D:
        name = bytes(raw[pos : pos + 11]).split(b"\0")[0].decode()
        width = int(raw[pos + 16])
        fields[name] = (offset, width)
        offset += width
        pos += 32
    if offset != size:
        raise ValueError(f"HydroRIVERS 的 .dbf 欄位寬度合計 {offset}，紀錄長度卻是 {size}")
    records = raw[header : header + n * size].reshape(n, size)
    out: dict[str, np.ndarray] = {}
    for name, dtype in FIELDS.items():
        start, width = fields[name]
        text = np.ascontiguousarray(records[:, start : start + width]).view(f"S{width}").ravel()
        out[name] = text.astype(np.float64).astype(dtype)
        print(f"  讀 {name}")
    np.savez(cache, **out)
    return out


def _shx() -> np.ndarray:
    """每段河道在 .shp 裡的位移（位元組）"""
    shx = np.fromfile(DIR / f"{STEM}.shx", dtype=np.uint8)[100:]
    return shx.reshape(-1, 8)[:, :4].copy().view(">i4").ravel().astype(np.int64) * 2


def _gather(mm: np.ndarray, offsets: np.ndarray, nbytes: int, dtype: str) -> np.ndarray:
    """從 memmap 的這些位移各讀 nbytes 個位元組，轉成 dtype（分批，控制記憶體）"""
    out = []
    step = 1_000_000
    k = np.arange(nbytes)
    for s in range(0, len(offsets), step):
        idx = offsets[s : s + step, None] + k[None, :]
        out.append(np.ascontiguousarray(mm[idx]).view(dtype))
    return np.concatenate(out)


@lru_cache(maxsize=1)
def ends() -> tuple[np.ndarray, np.ndarray]:
    """每段河道的頭尾：(first[n, 2], last[n, 2]) 經緯度。最後一個點是這段的出口（下游端）"""
    cache = DIR / ENDS_CACHE
    if cache.exists():
        with np.load(cache) as z:
            return z["first"], z["last"]
    shp = _extract()
    mm = np.memmap(shp, dtype=np.uint8, mode="r")
    offsets = _shx()
    content = offsets + 8
    shape_type = _gather(mm, content, 4, "<i4").ravel()
    if not np.all(shape_type == 3):
        raise ValueError("HydroRIVERS 的 .shp 有不是 PolyLine 的紀錄")
    parts = _gather(mm, content + 36, 4, "<i4").ravel()
    npoints = _gather(mm, content + 40, 4, "<i4").ravel().astype(np.int64)
    start = content + 44 + 4 * parts.astype(np.int64)
    first = _gather(mm, start, 16, "<f8").reshape(-1, 2)
    last = _gather(mm, start + 16 * (npoints - 1), 16, "<f8").reshape(-1, 2)
    np.savez(cache, first=first, last=last, parts=parts, npoints=npoints)
    return first, last


class Geometry:
    """依河道的索引讀出整條線（經緯度的 [m, 2] 陣列）"""

    def __init__(self) -> None:
        shp = _extract()
        self.mm = np.memmap(shp, dtype=np.uint8, mode="r")
        self.offsets = _shx()

    def line(self, i: int) -> np.ndarray:
        o = int(self.offsets[i]) + 8
        head = np.frombuffer(self.mm, dtype="<i4", count=3, offset=o + 36)
        parts, npoints = int(head[0]), int(head[1])
        start = o + 44 + 4 * parts
        # 河道都是單一段（parts = 1）；多段時照順序接起來
        return np.frombuffer(self.mm, dtype="<f8", count=2 * npoints, offset=start).reshape(-1, 2)
