"""IMF Financial Access Survey（FAS）：各國存款餘額占 GDP 的比例（IMF 資料可自由使用，需註明出處）。

- IMF 新資料平台的 SDMX 2.1 API（https://api.imf.org/external/sdmx/2.1/），資料流 IMF.STA,FAS。
  key 的維度依序是 COUNTRY.INDICATOR.SECTOR.COUNTERPARTY_SECTOR.SEX.TYPE_OF_TRANSFORMATION.FREQUENCY；
  OUTD = 存款餘額（outstanding deposits），POGDP = 占 GDP 的百分比。預設回傳 structure-specific XML：
  `<Series COUNTRY=… COUNTERPARTY_SECTOR=…><Obs TIME_PERIOD="2024" OBS_VALUE="58.4"/></Series>`。
- FAS 的存款是國內的家庭與非金融企業（公營、民營）在各類機構的存款（活期與定期），不含政府、金融機構。
  依收受存款的機構分成（COUNTERPARTY_SECTOR）：
  - COMBANK 商業銀行（API 的標籤寫成「Deposit-taking corporations, except the central bank」，實際是商業銀行）；
  - CUCC 信用合作社、合作金庫（法國的農業信貸、德國的合作銀行、日本的信用金庫與農協都在這類）；
  - ODT 其他收受存款機構（德國的儲蓄銀行、美國的儲貸機構；FAS 的填報手冊規定貨幣市場基金也算在這裡）。
  只看商業銀行的話，德國（33%）、法國（42%）這類儲蓄銀行、合作銀行很多的國家會少算一大半，所以三類加總。
- 愛爾蘭的 ODT 是 GDP 的 1.4～1.6 倍、商業銀行的近 4 倍，是都柏林那些主要賣給外國投資人的貨幣市場基金，
  不是愛爾蘭家庭與企業的存款（愛爾蘭央行統計的家庭存款 2024 年底約 1,600 億歐元，不到 GDP 的三成），
  所以不算（`EXCLUDE`）。
- 機構類別的申報年份不一：某一類只零星申報（少於 5 年，例如安哥拉 2019 年的信用合作社）就不算；
  曾經占合計 3% 以上的類別，哪一年沒有申報就不收那一年，否則合計會突然掉下去（奧地利 2023 年起沒有 ODT）。
  沒有商業銀行資料的國家（賴比瑞亞）不收。
"""
from __future__ import annotations

import xml.etree.ElementTree as ET

from common import download
from sources.countries import to_iso3

URL = "https://api.imf.org/external/sdmx/2.1/data/IMF.STA,FAS/.OUTD._Z.COMBANK+CUCC+ODT._T.POGDP.A"
INSTITUTIONS = ("COMBANK", "CUCC", "ODT")
MIN_YEARS = 5  # 申報少於這麼多年的機構類別不算
MATERIAL = 0.03  # 占合計這個比例以上的類別，缺了那一年就不收
EXCLUDE = {"IRL": {"ODT"}}  # 不算的機構類別（見上面的說明）


def _components() -> dict[str, dict[str, dict[int, float]]]:
    """{iso3: {機構類別: {年: 占 GDP %}}}"""
    path = download(URL, "imf-fas", "outstanding-deposits-gdp.xml")
    out: dict[str, dict[str, dict[int, float]]] = {}
    for _event, element in ET.iterparse(path):
        if not element.tag.endswith("Series"):
            continue
        iso3 = to_iso3(element.get("COUNTRY"))
        institution = element.get("COUNTERPARTY_SECTOR")
        if iso3 and institution in INSTITUTIONS:
            for obs in element:
                value = obs.get("OBS_VALUE")
                if value not in (None, "", "NaN"):
                    out.setdefault(iso3, {}).setdefault(institution, {})[int(obs.get("TIME_PERIOD")[:4])] = float(value)
        element.clear()
    return out


def deposits_to_gdp() -> tuple[dict[str, dict[int, float]], dict[str, str]]:
    """各國存款（商業銀行＋信用合作社＋其他收受存款機構）占 GDP 的 %，與每國用了哪幾類（給附註用）。"""
    values: dict[str, dict[int, float]] = {}
    used: dict[str, str] = {}
    for iso3, parts in _components().items():
        if "COMBANK" not in parts:
            continue
        parts = {k: s for k, s in parts.items() if len(s) >= MIN_YEARS and k not in EXCLUDE.get(iso3, ())}
        years = set().union(*(set(s) for s in parts.values()))
        totals = {y: sum(s.get(y, 0) for s in parts.values()) for y in years}
        material = [
            k for k, s in parts.items() if any(totals[y] and v / totals[y] >= MATERIAL for y, v in s.items())
        ]
        series = {y: total for y, total in totals.items() if all(y in parts[k] for k in material)}
        if series:
            values[iso3] = series
            used[iso3] = "+".join(k for k in INSTITUTIONS if k in parts)
    return values, used
