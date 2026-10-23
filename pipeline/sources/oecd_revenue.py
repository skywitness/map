"""OECD 全球稅收統計（Global Revenue Statistics Database），透過 OECD 的 SDMX API。

彙整 Revenue Statistics 與拉丁美洲、非洲、亞太三本區域版，約 140 個國家，1990 年起，沒有台灣。
稅收含社會安全捐（OECD 的定義：強制繳給一般政府、換取未來社會給付的保費也算稅），各級政府合計。
少數國家前面的年份沒有社會安全捐（例如中國 2019 年起才有社會保險基金的資料），總額在那一年會突然跳高。
"""
from __future__ import annotations

import csv

from common import download
from sources.countries import to_iso3

# 維度：REF_AREA.MEASURE.SECTOR.STANDARD_REVENUE.CTRY_SPECIFIC_REVENUE.UNIT_MEASURE.FREQ
# 一般政府（S13）的某一類稅收（STANDARD_REVENUE：_T 全部、T_2000 社會安全捐）占 GDP。版本留空 = 最新版。
URL = (
    "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_REV_COMP_GLOBAL@DF_RSGLOBAL,/"
    ".TAX_REV.S13.{revenue}._T.PT_B1GQ.A?startPeriod=1990&format=csvfile"
)


def _series(revenue: str, filename: str) -> dict[str, dict[int, float]]:
    """{iso3: {year: 占 GDP %}}；OECD 平均、非洲平均這類合計（代碼不是 ISO）不收。"""
    path = download(URL.format(revenue=revenue), "oecd-revenue", filename)
    out: dict[str, dict[int, float]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["STANDARD_REVENUE"] != revenue or row["SECTOR"] != "S13" or not row["OBS_VALUE"]:
                continue
            if iso3 := to_iso3(row["REF_AREA"]):
                out.setdefault(iso3, {})[int(row["TIME_PERIOD"])] = float(row["OBS_VALUE"])
    if not out:
        raise RuntimeError(f"OECD 全球稅收統計（{revenue}）沒有資料，API 格式可能變了")
    return out


def total_tax_revenue() -> dict[str, dict[int, float]]:
    """稅收總額（含社會安全捐）占 GDP %。"""
    return _series("_T", "total-tax-revenue.csv")


def social_security_contributions() -> dict[str, dict[int, float]]:
    """其中的社會安全捐占 GDP %，用來找出前面年份沒有社會安全捐的國家。"""
    return _series("T_2000", "social-security-contributions.csv")
