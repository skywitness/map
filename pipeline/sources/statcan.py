"""加拿大統計局（Statistics Canada）的矯正統計：加拿大的在監人數，只用在治安與司法主題的監禁人口率。

- 表 35-10-0154-01「Average counts of adults in provincial and territorial correctional programs」的
  「Total actual-in count」（省與地方的監獄：已判決、羈押候審 remand、其他暫時拘留，當時真的在監的人）
  加上表 35-10-0155-01「Average counts of offenders in federal programs」加拿大全國的「Actual-in count」（聯邦監獄，刑期 2 年以上）。
- 都是會計年度（4 月 1 日到隔年 3 月 31 日）的平均每日人數，不是某一天的人數；2023/2024 年度記在 2023 年。
- 只算成年人：少年矯正（表 35-10-0003-01）沒有加。
- 省與地方的合計是「有報的轄區」的合計（表的附註 2），有轄區沒報的年度不收（例如 2013/2014 年度亞伯達省、
  2021/2022 與 2022/2023 年度紐芬蘭與拉布拉多省沒有資料），避免把不完整的合計當成全國的數字。

授權：Statistics Canada Open Licence（https://www.statcan.gc.ca/en/terms-conditions/open-licence），
要註明「Source: Statistics Canada, Table …」，改作的要寫「Adapted from」，不得暗示加拿大統計局背書。
"""
from __future__ import annotations

import csv
import io
import zipfile

from common import download

URL = "https://www150.statcan.gc.ca/n1/tbl/csv/{pid}-eng.zip"
PROVINCIAL, FEDERAL = "35100154", "35100155"
# 省與地方合計要有這 13 個轄區（1999/2000 年度起有努納武特）
JURISDICTIONS = {
    "Newfoundland and Labrador", "Prince Edward Island", "Nova Scotia", "New Brunswick", "Quebec", "Ontario",
    "Manitoba", "Saskatchewan", "Alberta", "British Columbia", "Yukon", "Northwest Territories", "Nunavut",
}


def _rows(pid: str) -> list[dict[str, str]]:
    path = download(URL.format(pid=pid), "statcan", f"{pid}-eng.zip")
    with zipfile.ZipFile(path) as z:
        text = z.read(f"{pid}.csv").decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def _year(ref: str) -> int:
    # 「2023/2024」→ 2023
    return int(ref.split("/")[0])


def custody() -> dict[int, float]:
    """{年度的第一年: 省與地方＋聯邦監獄的平均每日在監人數}，只收所有轄區都有資料的年度"""
    prov: dict[int, float] = {}
    reported: dict[int, set[str]] = {}
    for r in _rows(PROVINCIAL):
        if r["Custodial and community supervision"] != "Total actual-in count" or not r["VALUE"]:
            continue
        y = _year(r["REF_DATE"])
        if r["GEO"] == "Provinces and Territories":
            prov[y] = float(r["VALUE"])
        else:
            reported.setdefault(y, set()).add(r["GEO"])
    fed = {
        _year(r["REF_DATE"]): float(r["VALUE"])
        for r in _rows(FEDERAL)
        if r["GEO"] == "Canada" and r["Custodial and community supervision"] == "Actual-in count" and r["VALUE"]
    }
    if not prov or not fed:
        raise RuntimeError("加拿大統計局的矯正統計表欄位變了")
    return {y: prov[y] + fed[y] for y in prov if y in fed and JURISDICTIONS <= reported.get(y, set())}
