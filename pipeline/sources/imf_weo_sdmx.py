"""IMF World Economic Outlook 的完整資料庫，透過 IMF 新資料平台的 SDMX 2.1 API（IMF 資料可自由使用，需註明出處）。

DataMapper API（`sources/imf.py`）只有一部分 WEO 指標，例如沒有國民儲蓄毛額占 GDP（NGSD_NGDP），
所以另外查 https://api.imf.org/external/sdmx/2.1/data/IMF.RES,WEO/.<指標>.A。
key 的維度是 COUNTRY.INDICATOR.FREQUENCY；國家是 ISO3（科索沃 KOS），G001 是世界，其他 G… 是區域。
回傳 structure-specific XML：`<Series COUNTRY="TWN" …><Obs TIME_PERIOD="2024" OBS_VALUE="42.7"/></Series>`。
跟 DataMapper 一樣有台灣，也有未來幾年的推估值。
"""
from __future__ import annotations

import xml.etree.ElementTree as ET

from common import download
from sources.countries import to_iso3

URL = "https://api.imf.org/external/sdmx/2.1/data/IMF.RES,WEO/.{code}.A"
WORLD = "G001"


def fetch(code: str) -> tuple[dict[str, dict[int, float]], dict[int, float]]:
    """回傳 (各國 {iso3: {年: 值}}, 世界 {年: 值})。"""
    path = download(URL.format(code=code), "imf-weo", f"{code}.xml")
    countries: dict[str, dict[int, float]] = {}
    world: dict[int, float] = {}
    for _event, element in ET.iterparse(path):
        if not element.tag.endswith("Series"):
            continue
        area = element.get("COUNTRY")
        target = world if area == WORLD else countries.setdefault(iso3, {}) if (iso3 := to_iso3(area)) else None
        if target is not None:
            for obs in element:
                value = obs.get("OBS_VALUE")
                if value not in (None, "", "NaN"):
                    target[int(obs.get("TIME_PERIOD")[:4])] = float(value)
        element.clear()
    if not countries:
        raise RuntimeError(f"IMF WEO 沒有 {code} 的資料，API 格式可能變了")
    return {k: v for k, v in countries.items() if v}, world
