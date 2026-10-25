"""行政院主計總處 消費者物價基本分類暨項目群指數（政府資料開放平臺 9158，政府資料開放授權條款第 1 版）。

- 政府資料開放平臺的資料集 API（https://data.gov.tw/api/v2/rest/dataset/9158）列出下載網址，
  檔案是 XML（約 27 MB），每個 <Obs> 一個月一個項目：Item（「總指數(指數基期：民國110年=100)」）、
  TIME_PERIOD（「2013M01」）、TYPE（原始值、年增率(%)）、Item_VALUE。2013 年 1 月起。
- 房價主題用「總指數」（平減用）與「195住宅租金」（只有住宅租金，不含「1.房租」類裡的學校住宿費）。
- 年資料是 12 個月的平均，今年還沒滿 12 個月的不收。
"""
from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from collections import defaultdict

from common import download

DATASET = "https://data.gov.tw/api/v2/rest/dataset/9158"
ITEMS = {"總指數": "all", "195住宅租金": "rent"}


def _xml_url() -> str:
    path = download(DATASET, "dgbas", "cpi-dataset-9158.json")
    with open(path, encoding="utf-8") as f:
        meta = json.load(f)
    for res in meta.get("result", {}).get("distribution", []):
        if res.get("resourceFormat") == "XML" and res.get("resourceDownloadUrl"):
            return res["resourceDownloadUrl"]
    raise RuntimeError("政府資料開放平臺 9158 沒有 XML 的下載網址")


def annual() -> dict[str, dict[int, float]]:
    """{"all": {年: 總指數}, "rent": {年: 住宅租金指數}}，民國 110 年（2021）= 100，12 個月的平均。"""
    path = download(_xml_url(), "dgbas", "cpi-basic-categories.xml")
    months: dict[str, dict[int, list[float]]] = {key: defaultdict(list) for key in ITEMS.values()}
    for _, el in ET.iterparse(path):
        if el.tag != "Obs":
            continue
        item = (el.findtext("Item") or "").split("(")[0]
        if item in ITEMS and el.findtext("TYPE") == "原始值":
            period = el.findtext("TIME_PERIOD") or ""
            value = el.findtext("Item_VALUE")
            if period[4:5] == "M" and value not in (None, "", "-"):
                months[ITEMS[item]][int(period[:4])].append(float(value))
        el.clear()
    out = {key: {y: sum(v) / 12 for y, v in by_year.items() if len(v) == 12} for key, by_year in months.items()}
    if any(len(v) < 10 for v in out.values()):
        raise RuntimeError(f"主計總處消費者物價的項目名稱可能變了：{ {k: len(v) for k, v in out.items()} }")
    return out
