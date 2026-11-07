"""農業：農產品的產地價格（2026-11-07，製作手冊第二十五批 443 的候選 1076；步驟 agriculture-prices，輸出 topics/agriculture/）。

- 資料：FAOSTAT PP（Producer Prices，CC BY 4.0）element 5532（美元／公噸），1991 年起；Flag X 不用。
- 品項對到農業主題原本的 22 個子項目（ITEMS）：加工品用原料的價格（棕櫚油→油棕果、糖→甘蔗、棉花→籽棉），
  肉類是帶骨鮮肉、乳品是生乳。各國只報自己重要的品項，很多國家空白；台灣不在 PP 裡。
- 美元價受匯率影響，跨年比較要小心（說明寫明）。
"""
from __future__ import annotations

import statistics
from collections import defaultdict

from common import OUT_DIR, indicator_file, to_series, write_json, write_manifest_part
from sources import faostat

OUT = OUT_DIR / "topics" / "agriculture"
FIRST, LAST = 1991, 2025
ITEMS = {"rice": 27, "wheat": 15, "maize": 56, "barley": 44, "soybeans": 236, "palm-oil": 254, "sugar": 156, "coffee": 656,
         "cocoa": 661, "cotton": 328, "rubber": 836, "potatoes": 116, "tomatoes": 388, "bananas": 486, "apples": 515,
         "oranges": 490, "grapes": 560, "beef": 867, "pork": 1035, "chicken": 1058, "milk": 882, "eggs": 1062}


def build() -> None:
    by_code = {v: k for k, v in ITEMS.items()}
    series: dict[str, dict[str, dict[int, float]]] = {k: defaultdict(dict) for k in ITEMS}
    for r in faostat.rows("PP", {5532}, set(ITEMS.values())):
        if r.flag == "X" or r.area == "WLD" or r.year > LAST:
            continue
        series[by_code[r.item]][r.area][r.year] = r.value
    years = list(range(FIRST, LAST + 1))
    no = {"TWN": "台灣不在 FAOSTAT 的產地價格裡"}
    no_en = {"TWN": "Taiwan is not in FAOSTAT’s producer prices"}
    for key, s in series.items():
        values = {a: to_series(v, years, 0) for a, v in sorted(s.items())}
        write_json(OUT / "producer-price" / f"{key}.json", indicator_file("producer-price", "美元/公噸", years, values,
                                                                          noValue=no, noValueEn=no_en, license="CC BY 4.0"), quiet=True)
        y = 2023
        vals = sorted(v[y] for v in s.values() if y in v)
        if len(vals) >= 5:
            q = statistics.quantiles(vals, n=10)
            top = sorted(((round(v[y]), a) for a, v in s.items() if y in v), reverse=True)
            print(f"  {key}：{y} 年 {len(vals)} 國，中位數 {statistics.median(vals):,.0f}，十分位 {[round(x) for x in q]}；"
                  f"最高 {top[:5]}；最低 {top[-4:]}")
    write_manifest_part(OUT, "agriculture", "agriculture-prices", {"sources": ["FAOSTAT PP (CC BY 4.0; Flag X not used)"]})
