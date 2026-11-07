"""旅行實用：出境要繳的錢（2026-11-07，製作手冊第二十四批 433；步驟 departure-tax，輸出 topics/travel/）。

- 資料：英文維基百科「Departure tax」revid 1371947177 的表（37 國，Country、Local currency、Notes），CC BY-SA 4.0，只引用事實；
  讀 /wiki/Departure_tax?oldid= 的 HTML（robots.txt 禁止 /w/）。表上的美元換算是維基模板當下算的，不用，只列當地幣別。
- 怎麼收依 Notes 的寫法分類（規則見 _kind）：只向本國人收、航空乘客稅（依距離或艙等）、要另外付（現場付現、出境前繳）、
  含在機票裡、說明沒寫。金額沒有逐國跟官方核對（手冊也沒驗證），說明寫明；斯里蘭卡的 193,080 盧比（約 970 美元）明顯
  不合理，標「金額存疑」不列。
- 台灣不在表上（機場服務費新臺幣 500 元含在機票裡，手冊沒讀到法源，這裡不寫）。
- 外國旅客退稅（手冊合併的候選 1026）沒做：維基的 55 國清單掛 2017 年的 citation needed、30 國的門檻表明顯過期，
  手冊寫要逐國回各國稅務機關核對才能上線。
"""
from __future__ import annotations

import html
import re

from common import OUT_DIR, download, indicator_file, write_json, write_manifest_part
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "travel"
YEAR = 2026
URL = "https://en.wikipedia.org/wiki/Departure_tax?oldid=1371947177"
# 怎麼收（src/topics/travel-fees.ts 的 FEE_KINDS）
CITIZENS, AIR_DUTY, PAY, INCLUDED, UNKNOWN = 1, 2, 3, 4, 5
DOUBTFUL = {"LKA"}  # 金額明顯不合理，不列


def _cell(s: str) -> str:
    s = re.sub(r"<sup.*?</sup>", "", s, flags=re.S)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def _kind(notes: str) -> int:
    n = notes.lower()
    if re.search(r"only applies to \w+ citizens|turkish citizens|iranian citizens", n):
        return CITIZENS
    if re.search(r"air passenger duty|luftverkehrsteuer|aviation tax|air passenger tax|flugabgab|levied through carrier", n):
        return AIR_DUTY
    if re.search(r"\bcash\b|payable at|paid at|be paid|before departure|upon departure|land border", n):
        return PAY
    if re.search(r"included|added to the cost of the ticket|airfare|ticket price|levied to the owner of airline", n):
        return INCLUDED
    return UNKNOWN


def build() -> None:
    page = download(URL, "wikipedia", "departure-tax-1371947177.html").read_text(encoding="utf-8")
    table = re.search(r'<table class="wikitable.*?</table>', page, re.S).group(0)
    kinds, hints, hints_en, notes_all = {}, {}, {}, {}
    for tr in re.findall(r"<tr.*?</tr>", table, re.S)[1:]:
        cells = [_cell(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        if len(cells) < 2 or not cells[0]:
            continue
        iso3 = from_name(cells[0])
        if not iso3:
            raise RuntimeError(f"出境稅：認不得國名 {cells[0]!r}")
        amount = re.sub(r"\s*\(\s*US\$[^)]*\)", "", cells[1]).strip()
        notes = cells[2] if len(cells) > 2 else ""
        kinds[iso3] = [_kind(notes)]
        if iso3 in DOUBTFUL:
            hints[iso3] = "維基表上的金額明顯不合理，不列"
            hints_en[iso3] = "The amount in the Wikipedia table is clearly implausible and is not shown"
        else:
            hints[iso3] = amount
            hints_en[iso3] = f"{amount}. {notes}".strip(". ") if notes else amount
        notes_all[iso3] = notes
    write_json(OUT / "departure-tax.json", indicator_file(
        "departure-tax", "類別", [YEAR], dict(sorted(kinds.items())), hints=dict(sorted(hints.items())),
        hintsEn=dict(sorted(hints_en.items())), license="CC BY-SA 4.0"))
    write_manifest_part(OUT, "travel", "departure-tax", {"sources": [URL + " (CC BY-SA 4.0)"]})
    from collections import Counter
    print(f"  出境稅 {len(kinds)} 國：{Counter(v[0] for v in kinds.values())}")
    for k in (CITIZENS, AIR_DUTY, PAY, INCLUDED, UNKNOWN):
        print(f"    {k}：{sorted(c for c, v in kinds.items() if v[0] == k)}")
    for c in ("JPN", "CHN", "HKG", "THA", "GBR", "AUS", "TUR", "LKA"):
        print(f"    {c}：{hints.get(c)} | {notes_all.get(c, '')[:80]}")
