"""IMF 世界稅收資料庫（World Revenue Longitudinal Data, WoRLD），透過 IMF 的 SDMX API（api.imf.org）。

195 國、1990 年起，沒有台灣。資料來自 IMF 的經濟監測（Article IV 等），依政府財政統計手冊（GFSM）分類。
政府層級各國不同：有的是一般政府（S13，含地方政府與社會保險基金），有的只有中央政府（S1311MIXED）。
"""
from __future__ import annotations

import xml.etree.ElementTree as ET

from common import download
from sources.countries import to_iso3

# 維度：COUNTRY.INDICATOR.TYPE_OF_TRANSFORMATION.FREQUENCY；G11 稅收、G121 社會安全捐，都是占 GDP %。
# 只回傳 XML（format 參數沒有作用），用 StructureSpecificData 格式解析。資料流版本留空 = 最新版。
URL = "https://api.imf.org/external/sdmx/2.1/data/IMF.FAD,WORLD/.G11_POGDP_PT_R+G121_POGDP_PT_R..A?startPeriod=1990"
CODES = {"G11_POGDP_PT_R": "taxes", "G121_POGDP_PT_R": "social"}
CENTRAL = "S1311MIXED"  # 中央政府（含預算外單位）


def taxes_and_social_contributions() -> tuple[dict[str, dict[str, dict[int, float]]], dict[str, str]]:
    """回傳 ({'taxes' | 'social': {iso3: {year: 占 GDP %}}}, {iso3: 政府層級代碼})。"""
    path = download(URL, "imf-world", "taxes-social.xml")
    out: dict[str, dict[str, dict[int, float]]] = {"taxes": {}, "social": {}}
    sector: dict[str, str] = {}
    for _, el in ET.iterparse(path):
        tag = el.tag.rsplit("}", 1)[-1]
        if tag == "Group" and el.get("SECTOR") and (iso3 := to_iso3(el.get("COUNTRY"))):
            sector[iso3] = el.get("SECTOR")
        elif tag == "Series":
            key, iso3 = CODES.get(el.get("INDICATOR", "")), to_iso3(el.get("COUNTRY"))
            if key and iso3:
                for obs in el:
                    if obs.get("OBS_VALUE") not in (None, "", "NaN"):
                        out[key].setdefault(iso3, {})[int(obs.get("TIME_PERIOD"))] = float(obs.get("OBS_VALUE"))
            el.clear()
    if not out["taxes"]:
        raise RuntimeError("IMF WoRLD 沒有資料，API 格式可能變了")
    return out, sector
