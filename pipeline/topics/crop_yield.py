"""農業主題的每公頃產量（單產）：FAOSTAT QCL 的 Yield（5412，公斤／公頃）（製作手冊第十七批 273，2026-11-02）。

跟產量同一個檔（Production_Crops_Livestock_E_All_Data），只讀 Yield 一個 element，輸出 topics/agriculture/yield/<id>.json。
- 22 種農產品裡只有作物有每公頃產量；畜產品（牛肉、豬肉、雞肉、乳品、雞蛋）FAOSTAT 的單產是每頭（每隻）的屠體重或產量，
  不是每公頃，不做。
- 棕櫚油、糖、棉花（皮棉）是加工品，沒有單產，改用原料作物：油棕果（254）、甘蔗（156）、籽棉（328）；
  前端的選項名稱寫明（甜菜糖的國家沒有甘蔗，地圖上是空的）。
- 稻米是稻穀的單產（跟產量一樣）。
- 台灣是 China, Taiwan Province of（sources/faostat.py 換成 TWN），世界值用 FAOSTAT 的 World。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, to_series, write_json, year_span
from sources import faostat

YIELD = 5412  # 公斤／公頃

# 前端 agriculture.ts 的 YIELD_PRODUCTS 同一組 id（id 跟農產品選單相同，換指標時選的東西不變）
CROPS: dict[str, int] = {
    "rice": 27,  # 稻穀
    "wheat": 15,
    "maize": 56,
    "barley": 44,
    "soybeans": 236,
    "palm-oil": 254,  # 油棕果
    "sugar": 156,  # 甘蔗
    "coffee": 656,
    "cocoa": 661,
    "cotton": 328,  # 籽棉
    "rubber": 836,
    "potatoes": 116,
    "tomatoes": 388,
    "bananas": 486,
    "apples": 515,
    "oranges": 490,
    "grapes": 560,
}


def build() -> None:
    out = OUT_DIR / "topics" / "agriculture" / "yield"
    by_item = {code: crop for crop, code in CROPS.items()}
    data: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for r in faostat.rows("QCL", {YIELD}, set(by_item)):
        data[by_item[r.item]][r.area][r.year] = r.value
    for crop in CROPS:
        series = data[crop]
        world = series.pop("WLD", {})
        years = year_span(series)
        write_json(out / f"{crop}.json", indicator_file(
            f"yield/{crop}", "公斤／公頃", years,
            {area: to_series(s, years, 0) for area, s in series.items() if any(y in s for y in years)},
            aggregates={"WLD": to_series(world, years, 0)},
        ), quiet=True)
        last = years[-1]
        n = sum(1 for s in series.values() if last in s)
        tw = series.get("TWN", {})
        print(f"  {crop}：{years[0]}–{last}，{last} 年 {n} 國；世界 {world.get(last, float('nan')):,.0f}、"
              f"台灣 {tw.get(last, float('nan')):,.0f}（{years[0]} 年 {tw.get(years[0], float('nan')):,.0f}）公斤／公頃")
