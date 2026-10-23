"""IMF Primary Commodity Prices（PCPS），透過 IMF 新資料平台的 SDMX 2.1 API（IMF 資料可自由使用，需註明出處）。

只用來估算台灣央行黃金的市值：`https://api.imf.org/external/sdmx/2.1/data/IMF.RES,PCPS/.PGOLD..M`
是黃金的月平均價格（倫敦，美元／盎司），1992 年起。key 的維度是 COUNTRY.INDICATOR.DATA_TRANSFORMATION.FREQUENCY，
同一個指標有 INDEX、INDEX_PCH、INDEX_PCHY、USD 四條序列，取 `DATA_TRANSFORMATION="USD"`；
TIME_PERIOD 寫成「2024-M12」。
"""
from __future__ import annotations

import xml.etree.ElementTree as ET

from common import download

URL = "https://api.imf.org/external/sdmx/2.1/data/IMF.RES,PCPS/.{code}..M"


def monthly_usd(code: str = "PGOLD") -> dict[tuple[int, int], float]:
    """{(年, 月): 美元價格}"""
    path = download(URL.format(code=code), "imf-pcps", f"{code}.xml")
    out: dict[tuple[int, int], float] = {}
    for _event, element in ET.iterparse(path):
        if not element.tag.endswith("Series"):
            continue
        if element.get("DATA_TRANSFORMATION") == "USD" and element.get("FREQUENCY") == "M":
            for obs in element:
                period, value = obs.get("TIME_PERIOD"), obs.get("OBS_VALUE")
                if period and value not in (None, "", "NaN"):
                    year, month = period.split("-M")
                    out[(int(year), int(month))] = float(value)
        element.clear()
    if not out:
        raise RuntimeError(f"IMF PCPS 沒有 {code} 的美元價格，API 格式可能變了")
    return out


def december_gold_price() -> dict[int, float]:
    """{年: 12 月的黃金平均價格（美元／盎司）}，接近年底的市價。"""
    return {year: v for (year, month), v in monthly_usd("PGOLD").items() if month == 12}
