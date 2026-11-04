"""各國健康與醫療：微創（腹腔鏡）手術的比例（2026-11-04，製作手冊第二十批 316）。

- OECD Health Statistics `DSD_HEALTH_PROC@DF_SURG_PROC,1.2`（OECD 資料條款）。整份 62.6 MB，用 SDMX key 只抓 6 個手術代碼
  （約 17 MB）。比例自己算：同一國同一年的「腹腔鏡的每十萬人手術數」÷「全部的每十萬人手術數」（`PRC_10P5PS`、
  `MODE_PROVISION=_T`，住院加當日手術）：闌尾切除 CM4701_4711 ÷ CM470_471、膽囊切除 CM5123 ÷ CM5122_5123、
  疝氣修補 CM_LPR ÷ CM530_531。資料集裡的「Percentage of procedures」是住院占全部的比例，不是腹腔鏡的比例，不用。
- 台灣：健保的處置代碼分得出腹腔鏡與開腹，但沒有找到可下載的全國統計（已請本機 session 找健保署的開放資料），先不畫。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import oecd

OUT = OUT_DIR / "topics" / "health"
FLOW = "OECD.ELS.HD,DSD_HEALTH_PROC@DF_SURG_PROC,1.2"
PAIRS = {
    "hernia": ("CM_LPR", "CM530_531"),
    "appendix": ("CM4701_4711", "CM470_471"),
    "gallbladder": ("CM5123", "CM5122_5123"),
}
KEY = "...CM4701_4711+CM470_471+CM5123+CM5122_5123+CM_LPR+CM530_531" + "." * 14  # 18 個維度，第 4 個是手術
FIRST = 2005
WITHIN = 5


def build() -> None:
    for item, (num_code, den_code) in PAIRS.items():
        num, _ = oecd.series(FLOW, KEY, MEDICAL_PROCEDURE=num_code, UNIT_MEASURE="PRC_10P5PS", MODE_PROVISION="_T")
        den, _ = oecd.series(FLOW, KEY, MEDICAL_PROCEDURE=den_code, UNIT_MEASURE="PRC_10P5PS", MODE_PROVISION="_T")
        share = {c: {y: v / den[c][y] * 100 for y, v in s.items() if den.get(c, {}).get(y) and y >= FIRST} for c, s in num.items()}
        share = {c: s for c, s in share.items() if s}
        over = [(c, y, round(v, 1)) for c, s in share.items() for y, v in s.items() if v > 100.5]
        if over:
            raise RuntimeError(f"腹腔鏡的比例超過 100%（分子分母沒對上）：{over}")
        last = max(y for s in share.values() for y in s)
        years = list(range(FIRST, last + 1))
        write_json(OUT / f"laparoscopic-{item}.json", indicator_file(
            f"laparoscopic-{item}", "%", years, {c: to_series({y: min(v, 100) for y, v in s.items()}, years, 1) for c, s in sorted(share.items())},
            latestWithin=WITHIN,
            noValue={"TWN": "台灣沒有可下載的全國統計（健保的處置代碼分得出腹腔鏡與開腹）"},
            noValueEn={"TWN": "No downloadable national statistics for Taiwan (National Health Insurance codes do distinguish laparoscopic from open surgery)"}))
        latest = sorted(((s[max(s)], c, max(s)) for c, s in share.items()), reverse=True)
        print(f"  {item}：{len(share)} 國；最高 {[(c, round(v, 1), y) for v, c, y in latest[:5]]}；最低 {[(c, round(v, 1), y) for v, c, y in latest[-5:]]}")
