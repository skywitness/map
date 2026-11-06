"""各國飲食：外食花多少錢（2026-11-06，製作手冊第二十四批 421；步驟 eating-out-share，輸出 topics/diet/）。

- Eurostat 家庭預算調查 HBS `hbs_str_t211`（Structure of consumption expenditure by COICOP），COICOP CP1111
  「Restaurants, cafés and the like」占家庭消費支出的千分比（unit=PM），換成百分比。HBS 大約五年一次：
  1988、1994、1999、2005、2010、2015、2020 七波，各國實際調查年份不一定是那一年。
- Eurostat 的再利用規定：歐盟、EFTA、候選國以外的資料只准非商業，英國、科索沃的列由 sources/eurostat.py 統一排除。
- 2020 年那一波是疫情年，兩波都有的 27 國裡 12 國比 2015 年低（西班牙 8.3% → 5.5%），預設看 2015 年。
- 台灣沒有：主計總處的家庭收支調查把外食放在食品類下，跟 COICOP 對不上，不並列。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "diet"


def build() -> None:
    raw = eurostat.series("hbs_str_t211", coicop="CP1111", unit="PM")
    years = sorted({y for s in raw.values() for y in s})
    values = {k: [round(s[y] / 10, 1) if y in s else None for y in years] for k, s in sorted(raw.items())}
    write_json(OUT / "eating-out-share.json", indicator_file("eating-out-share", "%", years, values, license="CC BY 4.0"))
    for y in (2015, 2020):
        v = sorted(((s[y] / 10, k) for k, s in raw.items() if y in s), reverse=True)
        print(f"  {y}：{len(v)} 國；最高 {v[:6]}；最低 {v[-4:]}")
