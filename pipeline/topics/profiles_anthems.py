"""國家小檔案：國歌哪一年採用、唱多久（2026-11-05，製作手冊第二十二批 394；步驟 profiles-anthems，輸出 topics/profiles/）。

- 資料：英文維基百科「List of national anthems」固定版本（REVID，2026-10-27）的兩張表：主權國家 197 列（丹麥、
  紐西蘭各有兩首同等地位的國歌）與部分承認的國家（台灣、科索沃、北賽普勒斯、索馬利蘭、西撒哈拉…）。
  讀 `/wiki/<條目>?oldid=` 的 HTML（sources/wikipedia_html.py；action=raw、Special:Export 在 robots.txt 不允許）。
  授權 CC BY-SA 4.0，這一步輸出的 anthem-*.json 依 CC BY-SA 4.0 分享。
- 採用年份：格子裡最早的年份（「1937 (de facto) 1943 (de jure)」→ 1937、「1745 de facto (never adopted de jure)」→ 1745），
  也就是這首歌最早成為國歌的那一年；完整原文寫在 tooltip（hints）與側欄。
- 長度：格子裡第一個「Xm Ys」（敘利亞的「1m 6s (de jure) 2m 11s (de facto)」取 1m 6s）。是表上某一個錄音版本的長度，
  不是法定長度（很多國家只唱第一段）；台灣那一列沒有長度欄，留空。
- 兩首國歌的國家，地圖用表上的第一首，側欄兩首都列。
"""
from __future__ import annotations

import re

import pycountry

from common import OUT_DIR, indicator_file, write_json
from sources import wikipedia_html

OUT = OUT_DIR / "topics" / "profiles"
TITLE = "List of national anthems"
REVID = 1382197461
YEAR = 2026
NAMES = {
    "Bolivia": "BOL", "Brunei": "BRN", "Cape Verde": "CPV", "Democratic Republic of the Congo": "COD",
    "Republic of the Congo": "COG", "East Timor": "TLS", "Timor-Leste": "TLS", "Iran": "IRN", "Ivory Coast": "CIV",
    "Laos": "LAO", "Micronesia": "FSM", "Federated States of Micronesia": "FSM", "Moldova": "MDA", "North Korea": "PRK",
    "South Korea": "KOR", "Russia": "RUS", "Syria": "SYR", "Tanzania": "TZA", "Turkey": "TUR", "Vatican City": "VAT",
    "Venezuela": "VEN", "Vietnam": "VNM", "Palestine": "PSE", "State of Palestine": "PSE", "Czech Republic": "CZE",
    "Taiwan": "TWN", "Kosovo": "XKX", "Northern Cyprus": "_CYN", "Somaliland": "_SOL",
    "Sahrawi Arab Democratic Republic": "ESH", "The Gambia": "GMB", "Gambia": "GMB", "The Bahamas": "BHS",
    "Bahamas": "BHS", "Eswatini": "SWZ", "São Tomé and Príncipe": "STP", "Netherlands": "NLD",
}
SKIP = {"Abkhazia", "South Ossetia", "Transnistria", "Sovereign Military Order of Malta"}  # 地圖上沒有自己的區塊
NO_LENGTH = (
    "維基「部分承認的國家」那張表沒有長度欄",
    "The Wikipedia table of partially recognised states gives no length",
)


def _iso3(name: str) -> str | None:
    if name in NAMES:
        return NAMES[name]
    try:
        return pycountry.countries.lookup(name).alpha_3
    except LookupError:
        return None


def _seconds(text: str) -> int | None:
    m = re.search(r"(?:(\d+)\s*m\s*)?(\d+)\s*s\b", text)
    return int(m.group(1) or 0) * 60 + int(m.group(2)) if m else None


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def build() -> None:
    tables = wikipedia_html.tables(wikipedia_html.page(TITLE, REVID))
    rows: dict[str, list[dict]] = {}
    unknown = []
    for table in tables[:2]:
        header = [c[0].strip() for c in table[0]]
        col = {name: i for i, name in enumerate(header)}
        composer = col.get("Composer/Artist", col.get("Composer"))
        for r in table[1:]:
            state = _clean(r[0][0])
            if state in SKIP:
                continue
            iso3 = _iso3(state)
            if not iso3:
                unknown.append(state)
                continue
            cell = lambda i: _clean(r[i][0]) if i is not None and i < len(r) else ""  # noqa: E731
            adopted = cell(col["Date adopted"])
            years = [int(y) for y in re.findall(r"\b(1[5-9]\d\d|20[0-2]\d)\b", adopted)]
            rows.setdefault(iso3, []).append({
                "name": cell(col["National anthem"]), "adopted": adopted, "year": min(years) if years else None,
                "seconds": _seconds(cell(col["Length"])) if "Length" in col else None,
                "lyricist": cell(col["Lyricist"]), "composer": cell(composer),
            })
    if unknown:
        raise RuntimeError(f"國名對不上 ISO：{unknown}")

    years, lengths, hints, hints_en, detail = {}, {}, {}, {}, {}
    for iso3, anthems in sorted(rows.items()):
        first = anthems[0]
        if first["year"]:
            years[iso3] = [first["year"]]
            if not re.fullmatch(r"\d{4}", first["adopted"]):
                hints[iso3] = f"維基原文：{first['adopted']}"
                hints_en[iso3] = f"Wikipedia: {first['adopted']}"
        if first["seconds"]:
            lengths[iso3] = [first["seconds"]]
        detail[iso3] = [[a["name"], a["adopted"], a["seconds"], a["lyricist"], a["composer"]] for a in anthems]
    write_json(OUT / "anthem-year.json", indicator_file(
        "anthem-year", "年", [YEAR], years, hints=hints, hintsEn=hints_en,
    ))
    write_json(OUT / "anthem-length.json", indicator_file(
        "anthem-length", "秒", [YEAR], lengths,
        noValue={c: NO_LENGTH[0] for c in rows if c not in lengths}, noValueEn={c: NO_LENGTH[1] for c in rows if c not in lengths},
    ))
    write_json(OUT / "anthem-detail.json", {"revid": REVID, "countries": detail})

    by_year = sorted(years.items(), key=lambda kv: kv[1][0])
    by_len = sorted(lengths.items(), key=lambda kv: kv[1][0])
    med = sorted(v[0] for v in lengths.values())[len(lengths) // 2]
    print(f"  國歌 {len(rows)} 國；採用年份 {len(years)} 國，最早 {by_year[:6]}，最晚 {by_year[-6:]}")
    print(f"  長度 {len(lengths)} 國，中位數 {med} 秒；最短 {by_len[:6]}；最長 {by_len[-6:]}")
    print(f"  沒有長度：{[c for c in rows if c not in lengths]}；台灣 {detail['TWN']}")
    eras = {}
    for (y,) in years.values():
        eras[y // 50 * 50] = eras.get(y // 50 * 50, 0) + 1
    print(f"  每 50 年：{dict(sorted(eras.items()))}")
