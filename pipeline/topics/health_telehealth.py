"""各國健康與醫療：遠距醫療（2026-11-04，製作手冊第二十批 321）。

OECD Health Statistics `DSD_HEALTH_PROC@DF_CONSULT,1.2`（OECD 資料條款）：醫師的每人每年問診次數，分遠距
（`CONSULTATION_TYPE=CTC`，Teleconsultations）、面對面（CIP）與合計（_T），2015 年起。
- 遠距問診的比例 = 同國同年的遠距 ÷ 合計（只有兩個都有的國家算得出來）。
- 每人每年遠距問診次數 = CTC。
「什麼算遠距問診」各國不同（電話算不算、有沒有給付代碼），0 是真的報 0。台灣：健保署 2024 年起有通訊診察治療的
申報統計，但沒有找到可下載的全國數字（已請本機 session 找），先不畫。WHO eHealth 的政策調查只在 GHO、2015 年，不用。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import oecd

OUT = OUT_DIR / "topics" / "health"
FLOW = "OECD.ELS.HD,DSD_HEALTH_PROC@DF_CONSULT,1.2"
WITHIN = 3
TW = ({"TWN": "健保署有通訊診察治療的申報統計，但沒有可下載的全國數字"},
      {"TWN": "Taiwan's insurer reports telemedicine claims, but no downloadable national figures were found"})


def build() -> None:
    tele, _ = oecd.series(FLOW, CONSULTATION_TYPE="CTC", OCCUPATION="OC221", UNIT_MEASURE="CN_PS")
    total, _ = oecd.series(FLOW, CONSULTATION_TYPE="_T", OCCUPATION="OC221", UNIT_MEASURE="CN_PS")
    share = {c: {y: v / total[c][y] * 100 for y, v in s.items() if total.get(c, {}).get(y)} for c, s in tele.items()}
    share = {c: s for c, s in share.items() if s}
    for name, series, unit, digits in (("teleconsult-share", share, "%", 1), ("teleconsult-per-person", tele, "次", 1)):
        first = min(y for s in series.values() for y in s)
        last = max(y for s in series.values() for y in s)
        years = list(range(first, last + 1))
        write_json(OUT / f"{name}.json", indicator_file(
            name, unit, years, {c: to_series(s, years, digits) for c, s in sorted(series.items())},
            latestWithin=WITHIN, noValue=TW[0], noValueEn=TW[1]))
        latest = sorted(((s[max(s)], c, max(s)) for c, s in series.items()), reverse=True)
        print(f"  {name}：{len(series)} 國，{first}–{last}；最高 {[(c, round(v, 2), y) for v, c, y in latest[:6]]}；最低 {[(c, round(v, 2), y) for v, c, y in latest[-6:]]}")
