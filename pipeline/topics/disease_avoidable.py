"""疾病與死因：可避免的死亡：可預防與可治療（2026-11-04，製作手冊第二十批 318）。

OECD Health Statistics `DSD_HEALTH_STAT@DF_AM,1.1`（OECD 資料條款）：75 歲以下每十萬人的死亡率（年齡標準化，
`CALC_METHODOLOGY=STANDARD`、`DT_10P5HB`，兩性合計），依 OECD 與 Eurostat 2019 年修訂的清單分：
- 可治療（TRTM，treatable）：及時、有效的醫療本來救得回來；
- 可預防（PREVM，preventable）：公共衛生與預防本來可以避免；
- 可避免（AVM）：兩者合計（缺血性心臟病這類死因是兩邊各算一半，不是互斥的臨床判斷）。
台灣不在 OECD 的資料裡；要用 ICD-10 清單乘衛福部的細分類死因再年齡標準化，清單原文這次沒找到，先不做（手冊的建議）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import oecd

OUT = OUT_DIR / "topics" / "disease"
FLOW = "OECD.ELS.HD,DSD_HEALTH_STAT@DF_AM,1.1"
MEASURES = {"treatable": "TRTM", "preventable": "PREVM", "avoidable": "AVM"}
FIRST = 2000
WITHIN = 5


def build() -> None:
    for item, code in MEASURES.items():
        s, _ = oecd.series(FLOW, MEASURE=code, UNIT_MEASURE="DT_10P5HB", SEX="_T", CALC_METHODOLOGY="STANDARD")
        s = {c: {y: v for y, v in v_.items() if y >= FIRST} for c, v_ in s.items()}
        s = {c: v for c, v in s.items() if v}
        last = max(y for v in s.values() for y in v)
        years = list(range(FIRST, last + 1))
        write_json(OUT / f"avoidable-{item}.json", indicator_file(
            f"avoidable-{item}", "每十萬人", years, {c: to_series(v, years, 1) for c, v in sorted(s.items())},
            latestWithin=WITHIN,
            noValue={"TWN": "台灣不在 OECD 的資料裡（要用衛福部的細分類死因自己算，還沒做）"},
            noValueEn={"TWN": "Taiwan is not in OECD data (it would have to be computed from detailed causes of death)"}))
        latest = sorted(((v[max(v)], c, max(v)) for c, v in s.items()), reverse=True)
        print(f"  {item}：{len(s)} 國，{years[0]}–{years[-1]}；最高 {[(c, round(v), y) for v, c, y in latest[:6]]}；最低 {[(c, round(v), y) for v, c, y in latest[-5:]]}")
