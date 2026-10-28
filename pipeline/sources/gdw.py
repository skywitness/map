"""Global Dam Watch（GDW）database v1.0：全世界 41,145 座水壩與攔河堰（DESIGN.md 第 8 節第 96 點）。

- 下載：figshare 的直連（https://doi.org/10.6084/m9.figshare.25988293.v1，2024-07-25 發布），不必填官網的表單；
  GDW_v1_0_shp.zip 69.7 MB，裡面的 GDW_barriers_v1_0.txt 是點的屬性表（逗號分隔、UTF-8），經緯度也在裡面，不必讀 .shp。
- 授權：CC BY 4.0（figshare API 的 license 欄）。
- 缺值寫 -99；YEAR_DAM 只有 15,230 座有年份，CAP_MCM（庫容，百萬立方公尺）35,334 座有，DAM_HGT_M（壩高）9,311 座有。
- 位置：LONG_DAM、LAT_DAM（壩的位置，只有 6,113 座有）優先，沒有就用 LONG_RIV、LAT_RIV（對到 HydroRIVERS 河道上的點）。
"""
from __future__ import annotations

import csv
import io
import zipfile
from dataclasses import dataclass

from common import download

URL = "https://ndownloader.figshare.com/files/47913754"
ZIP = "GDW_v1_0_shp.zip"
TABLE = "GDW_v1_0_shp/GDW_barriers_v1_0.txt"
DOI = "https://doi.org/10.6084/m9.figshare.25988293.v1"
CITATION = (
    "Lehner, Bernhard; Beames, Penny; Mulligan, Mark; Zarfl, Christiane; De Felice, Luca; van Soesbergen, Arnout; "
    "et al. (2024). Global Dam Watch database version 1.0. figshare. Dataset. "
    "https://doi.org/10.6084/m9.figshare.25988293.v1"
)

# 用途欄位（USE_*，值是 Main、Major、Multi、Sec 或空白）→ 位元；前端 src/topics/rivers.ts 的 USES 一致
USES = {
    "USE_IRRI": 1,  # 灌溉
    "USE_ELEC": 2,  # 發電
    "USE_SUPP": 4,  # 給水（公共、工業）
    "USE_FCON": 8,  # 防洪
    "USE_RECR": 16,  # 觀光遊憩
    "USE_NAVI": 32,  # 航運
    "USE_FISH": 64,  # 漁業
    "USE_PCON": 128,  # 污染防治
    "USE_LIVE": 256,  # 牲畜用水
    "USE_OTHR": 512,  # 其他
}
# MAIN_USE → 主要用途的位元（Multipurpose 是 0：多目標，沒有單一的主要用途）
MAIN_USE = {
    "Irrigation": 1,
    "Hydroelectricity": 2,
    "Water supply": 4,
    "Flood control": 8,
    "Recreation": 16,
    "Navigation": 32,
    "Fisheries": 64,
    "Pollution control": 128,
    "Livestock": 256,
    "Other": 512,
    "Multipurpose": 0,
}


@dataclass
class Dam:
    gdw_id: int
    name: str | None  # 壩名，沒有就是水庫名
    reservoir: str | None
    river: str | None
    country: str  # GDW 的國家（英文名）；統計用點的位置（geoindex），不用這個
    dam_type: str  # Dam、Lock、Low Permeable Dam、Lake Control Dam
    year: int | None
    removed: int | None
    timeline: str | None  # Modified、Removed、Planned、Destroyed…
    height: float | None  # 公尺
    capacity: float | None  # 百萬立方公尺
    uses: int  # USES 的位元
    main_use: int | None  # MAIN_USE 的位元；None 是沒寫
    lon: float
    lat: float


def _num(v: str) -> float | None:
    try:
        x = float(v)
    except ValueError:
        return None
    return None if x == -99 else x


def _text(v: str) -> str | None:
    v = v.strip()
    return v or None


def dams() -> list[Dam]:
    archive = download(URL, "gdw", ZIP)
    with zipfile.ZipFile(archive) as z, z.open(TABLE) as raw:
        rows = list(csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig")))
    out = []
    for r in rows:
        lon, lat = _num(r["LONG_DAM"]), _num(r["LAT_DAM"])
        if lon is None or lat is None:
            lon, lat = float(r["LONG_RIV"]), float(r["LAT_RIV"])
        year, removed = _num(r["YEAR_DAM"]), _num(r["REM_YEAR"])
        uses = 0
        for field, bit in USES.items():
            if r[field].strip():
                uses |= bit
        main = _text(r["MAIN_USE"])
        out.append(Dam(
            gdw_id=int(r["GDW_ID"]),
            name=_text(r["DAM_NAME"]) or _text(r["RES_NAME"]),
            reservoir=_text(r["RES_NAME"]),
            river=_text(r["RIVER"]),
            country=r["COUNTRY"],
            dam_type=r["DAM_TYPE"],
            year=int(year) if year else None,
            removed=int(removed) if removed else None,
            timeline=_text(r["TIMELINE"]),
            height=_num(r["DAM_HGT_M"]),
            capacity=_num(r["CAP_MCM"]),
            uses=uses,
            main_use=MAIN_USE.get(main) if main else None,
            lon=lon,
            lat=lat,
        ))
    return out
