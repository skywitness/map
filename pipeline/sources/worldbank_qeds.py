"""世界銀行 Quarterly External Debt Statistics（QEDS，世界銀行與 IMF 合編，CC BY 4.0）：各國的外債總額。

- 資料目錄：https://datacatalog.worldbank.org/search/dataset/0037740（授權 Creative Commons Attribution 4.0），
  DataBank 的來源是「Quarterly External Debt Statistics SDDS (New)」。
- World Bank API 的 source id 是 22（`/v2/sources/22/indicators`）。GDDS 的 23 號查這個代碼回「Data not found」，
  阿富汗、貝南這些 GDDS 國家也在 22 號裡。
- 一般的 `/v2/country/all/indicator/<代碼>?source=22` 會回 HTTP 500，要用「進階」的
  `/v2/sources/22/country/all/series/<代碼>/time/all`，回傳 `source.data[]`，每筆是
  `{variable: [{concept: Country, id}, {concept: Series}, {concept: Time, id: "YR2024Q4"}], value}`，檔頭有 BOM。
- 外債總額用 `DT.DOD.DECT.CD.AR.US`（Gross External Debt Position, All Sectors, All maturities, All instruments,
  USD）：依 IMF《外債統計指南》，居民欠非居民、需要還本或付息的所有負債（存款、借款、債券、貿易信用、
  直接投資的公司間債務、SDR 分配），不含股權與衍生性商品，等於國際投資部位表的債務工具負債。
- 季資料、期末餘額；年底值取第 4 季。EMU（歐元區合計）不是國家，不收。
"""
from __future__ import annotations

import json

from common import download
from sources.countries import to_iso3

URL = "https://api.worldbank.org/v2/sources/22/country/all/series/{code}/time/all?format=json&per_page=50000"
GROSS_DEBT = "DT.DOD.DECT.CD.AR.US"


def year_end(code: str = GROSS_DEBT) -> dict[str, dict[int, float]]:
    """{iso3: {年: 第 4 季底的值}}（美元）。"""
    path = download(URL.format(code=code), "worldbank", f"qeds-{code}.json")
    with open(path, encoding="utf-8-sig") as f:
        data = json.load(f)
    if data.get("pages", 1) > 1:
        raise RuntimeError(f"QEDS {code} 超過一頁（{data.get('total')} 筆），需要分頁下載")
    out: dict[str, dict[int, float]] = {}
    for row in data["source"]["data"]:
        if row["value"] is None:
            continue
        keys = {v["concept"]: v["id"] for v in row["variable"]}
        period = keys["Time"]  # YR2024Q4
        if not period.endswith("Q4"):
            continue
        if iso3 := to_iso3(keys["Country"]):
            out.setdefault(iso3, {})[int(period[2:6])] = float(row["value"])
    if not out:
        raise RuntimeError(f"QEDS {code} 沒有資料，API 格式可能變了")
    return out
