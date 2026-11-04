"""各國健康與醫療：生產造成的產道嚴重撕裂傷（2026-11-04，製作手冊第二十批 319）。

OECD Health Care Quality Indicators `DSD_HCQO@DF_PS,2.1`（病人安全，OECD 資料條款）：每 100 次陰道生產中發生
三度、四度產道撕裂傷的次數（粗率，`STATISTICAL_OPERATION=OBS`），分器械助產（真空吸引或產鉗，OBSTVDWI）與
非器械助產（OBSTVDWO），32 國。高的國家多半是記錄得完整（OECD 自己的提醒），說明要寫。同資料集另外三個指標
（髖膝置換後的肺栓塞、深層靜脈栓塞、腹腔骨盆手術後的敗血症）國家太少，不做。台灣沒有。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import oecd

OUT = OUT_DIR / "topics" / "health"
FLOW = "OECD.ELS.HD,DSD_HCQO@DF_PS,2.1"
MEASURES = {"instrument": "OBSTVDWI", "spontaneous": "OBSTVDWO"}
WITHIN = 5


def build() -> None:
    for item, code in MEASURES.items():
        s, _ = oecd.series(FLOW, MEASURE=code, STATISTICAL_OPERATION="OBS")
        first = min(y for v in s.values() for y in v)
        last = max(y for v in s.values() for y in v)
        years = list(range(first, last + 1))
        write_json(OUT / f"obstetric-trauma-{item}.json", indicator_file(
            f"obstetric-trauma-{item}", "每 100 次生產", years, {c: to_series(v, years, 1) for c, v in sorted(s.items())},
            latestWithin=WITHIN,
            noValue={"TWN": "沒有向 OECD 回報"}, noValueEn={"TWN": "Not reported to the OECD"}))
        latest = sorted(((v[max(v)], c, max(v)) for c, v in s.items()), reverse=True)
        print(f"  {item}：{len(s)} 國，{first}–{last}；最高 {[(c, round(v, 1), y) for v, c, y in latest[:4]]}；最低 {[(c, round(v, 1), y) for v, c, y in latest[-4:]]}")
