"""內政部戶政司的開放資料 API（政府資料開放授權條款第 1 版）：各縣市的戶籍人口。

用「村里戶數、人口數（按戶別、性別）」（ODRP019，https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP019/<民國年>，
每年一筆、全國約 7,750 個村里、每頁 2,000 筆）：每個村里的共同生活戶、共同事業戶、單獨生活戶的男女人口，
加總成縣市（site_id 的前三個字，例如「新北市板橋區」→「新北市」）。年份是那一年年底的戶籍登記。
城市主題拿它跟 GHSL 的城市人口對照（只是對照，台灣的城市人口仍是 GHSL 的）。
"""
from __future__ import annotations

import json
from collections import Counter

from common import download

API = "https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP019/{roc}?page={page}"


def county_population(year: int) -> dict[str, int]:
    """{縣市: 年底戶籍人口}。"""
    roc = year - 1911
    totals: Counter[str] = Counter()
    page = 1
    while True:
        path = download(API.format(roc=roc, page=page), "ris", f"odrp019-{roc}-{page}.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if data.get("responseCode") != "OD-0101-S":
            raise RuntimeError(f"戶政司 API 沒有 {roc} 年的資料：{data.get('responseMessage')}")
        for row in data["responseData"]:
            people = sum(int(v) for k, v in row.items() if k.startswith("household_") and k[-2:] in ("_m", "_f"))
            totals[row["site_id"][:3]] += people
        if page >= int(data["totalPage"]):
            break
        page += 1
    total = sum(totals.values())
    if not 22_000_000 < total < 25_000_000:
        raise RuntimeError(f"戶政司 {roc} 年的人口加總是 {total}，不像台灣的總人口")
    return dict(totals)
