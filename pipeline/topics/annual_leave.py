"""薪資與工時：法定最低年假天數（2026-11-04，製作手冊第二十一批 359）。

- 英文維基「List of minimum annual leave by country」固定版本（`OLDID`，CC BY-SA 4.0，資料檔同樣授權）的主表：
  有薪年假（換算成一週工作 5 天）、有薪國定假日、合計、備註。條目主要引 ILO 2012 年的《Working conditions laws report》，
  有些國家已經修法，只能看大概。
- 年假欄常是範圍（「10–20」「5/10/15」）：最少的是剛滿資格（多半是滿一年）的天數，最多的是年資最長的天數，分成兩個指標。
  國定假日欄不用（各國的算法不同，日本寫 0 是因為國定假日不給薪；要看國定假日看「國定假日」主題）。
- 台灣：條目寫 3–30（3 天是滿半年），依勞動基準法第 38 條改成滿一年 7 天、最多 30 天（十年以上每年加一天，加到 30 天）。
"""
from __future__ import annotations

import re

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import from_name
from sources.medical_cannabis import _Tables

OUT = OUT_DIR / "topics" / "wages"
OLDID = 1380870617
URL = f"https://en.wikipedia.org/w/index.php?title=List_of_minimum_annual_leave_by_country&oldid={OLDID}"
YEAR = 2026
NAMES = {"Taiwan": "TWN", "South Korea": "KOR", "North Korea": "PRK", "Kosovo": "XKX", "Congo, Republic of the": "COG",
         "Congo, Democratic Republic of the": "COD", "Democratic Republic of the Congo": "COD", "Republic of the Congo": "COG",
         "Ivory Coast": "CIV", "Micronesia": "FSM", "Palestine": "PSE", "Vatican City": "VAT", "East Timor": "TLS"}
TAIWAN = (7, 30)


def _days(text: str) -> tuple[float, float] | None:
    head = re.split(r"\(", text)[0]
    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", head)]
    return (min(nums), max(nums)) if nums else None


def build() -> None:
    parser = _Tables()
    parser.feed(download(URL, "wikipedia", f"annual-leave-{OLDID}.html").read_text(encoding="utf-8"))
    table = next(t for t in parser.tables if t and [c[0] for c in t[0]][:2] == ["Country", "Paid vacation days by year (five-day workweek)"])
    low, high, hints, hints_en = {}, {}, {}, {}
    missing = []
    for row in table[1:]:
        name, cell = row[0][0].strip(), row[1][0].strip()
        iso3 = NAMES.get(name) or from_name(name)
        days = _days(cell)
        if not iso3 or days is None:
            missing.append((name, cell))
            continue
        lo, hi = TAIWAN if iso3 == "TWN" else days
        low[iso3], high[iso3] = [lo], [hi]
        if lo != hi:
            hints[iso3] = f"依年資 {lo:g}–{hi:g} 天（條目原文「{cell}」）"
            hints_en[iso3] = f"{lo:g}–{hi:g} days depending on seniority (article: “{cell}”)"
    tw_note = ("勞動基準法第 38 條：滿半年 3 天、滿一年 7 天、滿二年 10 天、滿三年 14 天、滿五年 15 天，十年以上每一年加一天，"
               "加到 30 天為止（條目寫 3–30）",
               "Labour Standards Act Art. 38: 3 days after six months, 7 after one year, 10 after two, 14 after three, 15 after five, "
               "then one more day per year from ten years up to 30 (the article lists 3–30)")
    for ind, data in (("annual-leave", low), ("annual-leave-max", high)):
        write_json(OUT / f"{ind}.json", indicator_file(
            ind, "天", [YEAR], {c: v for c, v in sorted(data.items())}, hints=hints, hintsEn=hints_en,
            notes={"TWN": tw_note[0]}, notesEn={"TWN": tw_note[1]}, license="CC BY-SA 4.0"))
    print(f"  年假：{len(low)} 國；對不到的 {missing}")
    print(f"  最少 {sorted((v[0], c) for c, v in low.items())[:8]}；最多 {sorted((v[0], c) for c, v in low.items())[-8:]}")
    print(f"  台灣 {low['TWN']} {high['TWN']}；日本 {low.get('JPN')} {high.get('JPN')}；南韓 {low.get('KOR')}；美國 {low.get('USA')}")
