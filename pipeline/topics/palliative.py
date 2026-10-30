"""安寧緩和醫療（健康主題的擴充，2026-10-30，製作手冊第六批 91；輸出到 topics/health/）。

- WHO 非傳染病國家能力調查（NCD CCS）的兩題，各國政府自己回答公立醫療體系是不是「普遍提供」安寧緩和醫療：
  NCD_CCS_palliative_prim（基層醫療）、NCD_CCS_palliative_home（社區或居家），2015、2017、2019、2021 年，194 國
  （xmart，CC BY 4.0，`sources/who_xmart.py`）。Yes／No 畫成兩類，No response、Don't know、No data received、NR 不畫。
  是有沒有，不是服務量。
- WHPCA《Global Atlas of Palliative Care》第 3 版的發展等級不能用（All Rights Reserved）。
- 台灣：WHO 的調查沒有台灣。全民健保給付安寧住院、安寧共同照護、安寧居家療護與社區安寧照護（基層診所參與），
  兩題都編成「可以」，附註寫明不是 WHO 的調查。健保署「接受安寧緩和醫療意願之比率」是品質指標，口徑不同，沒有用。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import who_xmart

OUT = OUT_DIR / "topics" / "health"
ANSWERS = {"Yes": 1, "No": 0}
CODES = {"palliative-primary": "NCD_CCS_palliative_prim", "palliative-home": "NCD_CCS_palliative_home"}

NOTE = ("WHO 的調查沒有台灣。全民健康保險給付安寧住院、安寧共同照護、安寧居家療護與社區安寧照護（基層診所也可以參與），"
        "這裡編成「可以」，不是台灣政府對 WHO 的回答。")
NOTE_EN = ("Taiwan is not in the WHO survey. National Health Insurance covers inpatient hospice care, hospice shared care, home "
           "hospice care and community palliative care (in which primary care clinics can take part), so it is coded as available "
           "here; this is not an answer from Taiwan's government to WHO.")


def build() -> None:
    for name, code in CODES.items():
        answers = who_xmart.answers(code)
        years = sorted({y for s in answers.values() for y in s})
        values = {
            iso3: [ANSWERS.get(s.get(y, "")) for y in years]
            for iso3, s in sorted(answers.items())
            if any(ANSWERS.get(v) is not None for v in s.values())
        }
        values["TWN"] = [1 for _ in years]
        write_json(OUT / f"{name}.json", indicator_file(
            name, "", years, values, notes={"TWN": NOTE}, notesEn={"TWN": NOTE_EN},
        ))
        last = [s[-1] for k, s in values.items() if k != "TWN"]
        print(f"  {name}：{years}，{years[-1]} 年 可以 {last.count(1)}、不行 {last.count(0)}、沒有答案 {last.count(None)}（不含台灣）")
