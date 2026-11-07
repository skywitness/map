"""婚姻與家庭的擴充：出生有沒有被登記（2026-11-07，製作手冊第二十七批 563，候選 1265；步驟 birth-registration，
輸出 topics/marriage/）。

- World Bank WDI `SP.REG.BRTH.ZS`（5 歲以下兒童出生有登記的比例；原始來源 UNICEF 的 MICS、DHS 與各國的戶政統計），
  CC BY 4.0，2000 年起。調查不是每年做，前端用 latestWithin 往後補，tooltip 寫調查年份。
- 高所得國家多半直接填 100%（不是調查），說明寫明、色階在 90% 以上切細。
- 台灣：WDI 沒有台灣。依戶籍法（第 48 條）出生後 60 日內須辦理出生登記，戶政司的出生登記涵蓋全部出生（手冊建議），
  畫 100%、標成 2022 年，tooltip 與說明寫明這不是同一個來源。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import worldbank

OUT = OUT_DIR / "topics" / "marriage"
FIRST, LAST = 2000, 2025
TAIWAN_YEAR = 2022


def build() -> None:
    data, world = worldbank.fetch("SP.REG.BRTH.ZS", FIRST, LAST)
    data["TWN"] = {TAIWAN_YEAR: 100.0}
    years = sorted({y for s in data.values() for y in s})
    hints = {"TWN": "世界銀行沒有台灣；依戶籍法，出生後 60 日內須辦理出生登記，戶政司的登記涵蓋全部出生"}
    hints_en = {"TWN": "Not in World Bank data; under Taiwan’s Household Registration Act births must be registered within 60 days, "
                       "and registrations cover all births"}
    write_json(OUT / "birth-registration.json", indicator_file(
        "birth-registration", "%", years, {c: to_series(s, years, 1) for c, s in sorted(data.items())},
        hints=hints, hintsEn=hints_en, latestWithin=16, license="CC BY 4.0"))
    last = {c: (max(s), s[max(s)]) for c, s in data.items()}
    low = sorted((v, y, c) for c, (y, v) in last.items())
    print(f"  {len(last)} 國；最低 {low[:10]}；100% 的 {sum(1 for v, _, _ in low if v >= 99.95)}；99% 以上 {sum(1 for v, _, _ in low if v >= 99)}")
    print(f"  世界 {world}")
