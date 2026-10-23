"""行政院主計總處：台灣的薪資與工時（政府資料開放授權條款）。

- 薪資及生產力統計（廠商調查，工業及服務業的受僱員工，不含農林漁牧業與公共行政）：
  總體統計資料庫 nstatdb 的 A046201010（每人每月總薪資）、A046301010（經常性薪資）、
  A046401010（每人每月工時），這裡取 1981 年起。API 參數見 dgbas.py。
  - 總薪資 = 經常性薪資（本薪與按月給付的津貼）+ 非經常性薪資（加班費、年終獎金、績效獎金等）。
- 人力資源調查（家戶調查，所有就業者，含自營作業者與雇主）：就業者之平均每週主要工作時數，
  政府資料開放平臺資料集 37969（https://data.gov.tw/dataset/37969），一年一個 XML，2015 年（104 年）起。
  - XML 的欄名與「總計」列的寫法每年不一樣（項目別_Item／項目別，「總計_Total」「總　　　計」），用開頭比對。
"""
from __future__ import annotations

import json
import re
from datetime import date
from xml.etree import ElementTree

from common import download
from sources.dgbas import ROC_OFFSET, _num, _table

MANPOWER_DATASET = "https://data.gov.tw/api/v2/rest/dataset/37969"


def _industry_and_services_total(funid: str) -> dict[int, float]:
    """薪資及生產力統計的「工業及服務業」「合計」欄（第一欄的男女合計），{西元年: 值}。今年還沒結束，不收。

    下載快取的檔名只有 funid，參數跟其他主題一樣（1981 年起、第一欄、合計／男／女）才不會互相覆蓋成不同格式；
    不論哪一種，第二格都是工業及服務業的合計。
    """
    _header, data = _table(funid, 70, "0,1", "0,3")
    this_year = date.today().year
    return {year: v for year, row in data.items() if year < this_year and (v := _num(row[1])) is not None}


def monthly_earnings() -> dict[int, float]:
    """工業及服務業受僱員工每人每月總薪資（新臺幣，全年平均）"""
    return _industry_and_services_total("A046201010")


def monthly_regular_earnings() -> dict[int, float]:
    """工業及服務業受僱員工每人每月經常性薪資（新臺幣，全年平均），附註對照用"""
    return _industry_and_services_total("A046301010")


def monthly_hours() -> dict[int, float]:
    """工業及服務業受僱員工每人每月工時（小時，全年平均），乘 12 跟 PWT 的年工時對照用"""
    return _industry_and_services_total("A046401010")


def weekly_hours() -> dict[int, float]:
    """人力資源調查：就業者之平均每週主要工作時數（小時），{西元年: 值}。"""
    meta = download(MANPOWER_DATASET, "dgbas", "dataset-37969.json")
    with open(meta, encoding="utf-8") as f:
        distributions = json.load(f)["result"]["distribution"]
    out: dict[int, float] = {}
    for dist in distributions:
        match = re.match(r"(\d+)年", dist["resourceDescription"])
        if not match:
            continue
        roc = int(match.group(1))
        path = download(dist["resourceDownloadUrl"], "dgbas", f"mp04066-{roc}.xml")
        first = ElementTree.parse(path).getroot()[0]  # 第一筆是全體就業者的總計
        cells = {child.tag: (child.text or "").strip() for child in first}
        label = next((v for k, v in cells.items() if k.startswith("項目別")), "")
        total = next((v for k, v in cells.items() if k.startswith("總計")), None)
        if not re.sub(r"\s", "", label).startswith("總計") or total is None:
            raise RuntimeError(f"{roc} 年的就業者每週工時 XML 格式變了：{cells}")
        out[roc + ROC_OFFSET] = float(total)
    if not out:
        raise RuntimeError("政府資料開放平臺 37969 沒有任何年份的資料")
    return out
