"""性別平等主題：女性政治賦權指數（2026-11-05，製作手冊第二十二批 378；V-Dem v16，CC BY-SA 4.0）。

- 地圖：v2x_gender（0–1，越高越好），三個子指數同等權重：女性的公民自由（v2x_gencl：國內遷徙、財產權、
  不受強迫勞動、訴諸司法）、女性的公民社會參與（v2x_gencs：公開討論政治、參加公民團體、女性記者）、
  女性的政治參與（v2x_genpp：國會女性比例、權力分配）。
- 側欄：三個子指數的歷年折線（vdem/<子指數>.json）與總指數的 68% 可信區間（intervals/）。
- 1900 年起，國家的接續方式跟民主與自由主題一樣（topics/democracy.py 的 country_series）；世界值是簡單平均。
- 跟 GII 方向相反（GII 越低越平等），前端的 GII 標 lowerIsBetter。
"""
from __future__ import annotations

from common import OUT_DIR
from sources import vdem
from topics.democracy import FIRST_YEAR, index_files

OUT = OUT_DIR / "topics" / "gender"
SUBINDICES = {"civil-liberties": "v2x_gencl", "civil-society": "v2x_gencs", "political-participation": "v2x_genpp"}


def build() -> None:
    rows = vdem.rows()
    last = max(int(r["year"]) for r in rows)
    years = list(range(FIRST_YEAR, last + 1))
    values = index_files(OUT, "women-political-empowerment", "v2x_gender", rows, years)
    latest = {c: s[-1] for c, s in values.items() if s[-1] is not None}
    top = sorted(latest.items(), key=lambda kv: -kv[1])
    print(f"  女性政治賦權指數：{len(values)} 國，{last} 年 {len(latest)} 國；台灣 {latest.get('TWN')}；"
          f"最高 {top[:5]}；最低 {top[-5:]}")
    for key, variable in SUBINDICES.items():
        index_files(OUT / "vdem", key, variable, rows, years, intervals=False)
