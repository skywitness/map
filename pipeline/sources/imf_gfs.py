"""IMF 的政府支出依用途（GFS COFOG）與歷史公共債務（Historical Public Debt），透過 IMF 的 SDMX API（api.imf.org）。

- GFS_COFOG（IMF.STA）：一般政府（S13）的支出依政府功能分類（COFOG）占總支出的比例（POTO_PT），
  維度 COUNTRY.SECTOR.GFS_GRP.INDICATOR.TYPE_OF_TRANSFORMATION.FREQUENCY；GF01_T 一般公共服務、GF02_T 國防、
  GF04_T 經濟事務、GF07_T 醫療保健、GF09_T 教育、GF10_T 社會保障。約 88 國有值，最新一年的國家少
  （2026 年 10 月：2024 年 44 國、2023 年 21 國），有的國家只有很舊的一般政府資料（南韓到 2010 年），沒有台灣。
- HPD（IMF.FAD）：Historical Public Debt Database，政府總債務占 GDP（G63G_S13_POFYGDP「Percent of fiscal year
  GDP」），1800–2015，191 個經濟體；不再更新。早年多半是中央政府，跟 WEO 的一般政府不完全一樣。
- 跟 WoRLD（`imf_revenue.py`）一樣用 SDMX 2.1 的 XML（StructureSpecificData），不必金鑰；資料流版本留空 = 最新版。
- 授權：IMF 的資料條款（註明來源即可轉載、改作；商業再利用要另外申請），DESIGN.md 第 8 節第 12 點已記。
"""
from __future__ import annotations

import xml.etree.ElementTree as ET

from common import download
from sources.countries import to_iso3

COFOG_URL = "https://api.imf.org/external/sdmx/2.1/data/IMF.STA,GFS_COFOG/.S13..{codes}.POTO_PT.A"
HPD_URL = "https://api.imf.org/external/sdmx/2.1/data/IMF.FAD,HPD/.G63G_S13_POFYGDP.A"


def _parse(path) -> dict[str, dict[str, dict[int, float]]]:
    """{INDICATOR: {iso3: {year: value}}}"""
    out: dict[str, dict[str, dict[int, float]]] = {}
    for _, el in ET.iterparse(path):
        if el.tag.rsplit("}", 1)[-1] != "Series":
            continue
        iso3 = to_iso3(el.get("COUNTRY"))
        if iso3:
            series = out.setdefault(el.get("INDICATOR", ""), {}).setdefault(iso3, {})
            for obs in el:
                if obs.get("OBS_VALUE") not in (None, "", "NaN"):
                    series[int(obs.get("TIME_PERIOD"))] = float(obs.get("OBS_VALUE"))
            if not series:
                del out[el.get("INDICATOR", "")][iso3]
        el.clear()
    return out


def cofog(functions: list[str]) -> dict[str, dict[str, dict[int, float]]]:
    """{COFOG 代碼（GF09）: {iso3: {year: 占一般政府總支出 %}}}"""
    codes = "+".join(f"{f}_T" for f in functions)
    path = download(COFOG_URL.format(codes=codes), "imf-gfs", "cofog.xml")
    data = _parse(path)
    out = {f: data.get(f"{f}_T", {}) for f in functions}
    if not any(out.values()):
        raise RuntimeError("IMF GFS_COFOG 沒有資料，API 格式可能變了")
    return out


def historical_debt() -> dict[str, dict[int, float]]:
    """{iso3: {year: 政府總債務占 GDP %}}，1800–2015"""
    data = _parse(download(HPD_URL, "imf-gfs", "hpd.xml")).get("G63G_S13_POFYGDP", {})
    if not data:
        raise RuntimeError("IMF HPD 沒有資料，API 格式可能變了")
    return data
