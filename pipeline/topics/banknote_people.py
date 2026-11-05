"""鈔票上是誰（2026-11-05，製作手冊第二十二批 397，使用者決定做；步驟 banknote-people，輸出 topics/banknotes/）。

- 資料：英文維基「List of people on banknotes」固定版本（REVID，2026-10-26 前後），讀 `/wiki/<條目>?oldid=` 的 HTML
  （action=raw、Special:Export 在 robots.txt 不允許）。條目依國家分節（h2／h3），每節一張或幾張表：人物、生卒年、
  被紀念的理由（Reason for honour）、貨幣、面額、正面或反面、流通年份。授權 CC BY-SA 4.0，輸出的資料檔依同樣授權分享。
- 「現在還在流通」：流通年份裡有開放式的區間（「2001–」「2001–, 2018–」），而且不是只有紀念鈔（「(commemorative)」）、
  也沒寫「discontinue」；只有單一年份、或有結束年份的都算已經不流通。條目常常沒更新，判斷會有錯，說明寫明。
- 人像分類：依 Reason for honour 的關鍵字（CATEGORIES 依序比對，先比到的算），規則寫在說明，tooltip 與側欄顯示原文。
  一國的類別取現在流通的人像裡最多的那一類，一樣多時取面額最大那張上的人。
- 英國只算英格蘭銀行的鈔票（Scotland、Northern Ireland 兩節是商業銀行的鈔票，不收）；東加勒比中央銀行的鈔票
  算 8 個成員（安地卡、多米尼克、格瑞那達、聖克里斯多福、聖露西亞、聖文森、安圭拉、蒙哲臘）。
- 歐元區：歐元紙鈔上沒有人像，畫成「鈔票上沒有人」（條目裡這些國家的章節寫的是舊貨幣）。
- 台灣：條目的「Taiwan (Republic of China)」一節；新臺幣 100 元孫中山、200 元蔣中正，500、1,000、2,000 元上面沒有人。
"""
from __future__ import annotations

import re

import pycountry

from common import OUT_DIR, indicator_file, write_json
from sources import wikipedia_html

OUT = OUT_DIR / "topics" / "banknotes"
TITLE = "List of people on banknotes"
REVID = 1381887954
YEAR = 2026
# 依序比對 Reason for honour（小寫），先比到的算；類別值見 src/topics/banknotes.ts 的 PORTRAIT
CATEGORIES: list[tuple[int, re.Pattern]] = [
    (2, re.compile(r"\b(king|queen|emperor|empress|sultan|emir|shah|tsar|czar|monarch|sovereign|grand duke|pharaoh|"
                   r"yang di-pertuan agong|prince of|princess|duke of|lord of|khagan|raja|maharaja|negus|nawab|caliph|"
                   r"druk gyalpo|amir of|sheikh)\b|^khan$")),
    (3, re.compile(r"(founding father|father of the (nation|country|homeland)|father of (modern|the)|founder of modern|"
                   r"founder of (the )?[^;,]{0,60}\b(republic|state|nation|country|kingdom|federation|union)\b|"
                   r"founder of (chile|pakistan|turkey|bangladesh|singapore|israel|kenya)|independence|liberat|"
                   r"national hero|heroine|revolution|freedom fighter|nationalist|anti-colonial|resistance|"
                   r"coloni[sz]ation|insurrection|rebellion|uprising|revolt)")),
    (7, re.compile(r"\b(saint|st\.|bishop|priest|prophet|monk|religious|ayatollah|imam|missionary|cardinal|pope|nun|"
                   r"theologian|spiritual)\b")),
    (4, re.compile(r"(scientist|scientific|physicist|chemist|mathematician|inventor|engineer|astronomer|biologist|"
                   r"naturalist|physician|surgeon|bacteriolog|biolog|geolog|zoolog|seismolog|meteorolog|virolog|patholog|"
                   r"geographer|botanist|explorer|economist|aviator|researcher|geophysic|discover|academic)")),
    (5, re.compile(r"(writer|poet|novel|author|painter|artist|composer|musician|singer|architect|sculptor|playwright|"
                   r"dramatist|philosopher|educator|educationist|historian|linguist|journalist|actor|actress|dancer|"
                   r"film|photograph|literat|folk|calligraph|teacher|soprano|opera|guitarist|pianist|violinist|"
                   r"choreograph|humanist|lyric|bard|storyteller|embroider|scholar|ballerina|ballet|potter|ceramic|philolog)")),
    (1, re.compile(r"(president|prime minister|premier|chancellor|governor|statesman|stateswoman|politician|minister|"
                   r"senator|secretary|leader|head of state|head of (the )?government|ruler|chief|first lady|activist|"
                   r"unionist|parliament|congress|mayor|diplomat|chairman|consul|bailiff|legislator|regent|viceroy|"
                   r"suffrag|feminist|reformer|vizier)")),
    (6, re.compile(r"\b(general|admiral|marshal|military|soldier|warrior|commander|colonel|army|navy|hero of the war|"
                   r"captain|lieutenant|guerrilla|officer)\b")),
]
OTHER, NOBODY = 8, 9
EURO = ["AUT", "BEL", "HRV", "CYP", "EST", "FIN", "FRA", "DEU", "GRC", "IRL", "ITA", "LVA", "LTU", "LUX", "MLT", "NLD",
        "PRT", "SVK", "SVN", "ESP", "AND", "MCO", "SMR", "VAT", "XKX", "MNE"]
# 章節名稱（h2／h3 的 id）→ ISO3；歷史政權（蘇聯、南斯拉夫、捷克斯洛伐克…）不對應
SECTIONS = {
    "The_Bahamas": "BHS", "Bolivia": "BOL", "Bosnia_and_Herzegovina": "BIH", "Burma/Myanmar": "MMR",
    "Cape_Verde": "CPV", "Central_African_Republic/Central_African_Empire": "CAF",
    "Congo,_Democratic_Republic_(Congo-Kinshasa)": "COD", "Czech_Republic": "CZE", "Iran/Persia": "IRN",
    "Korea": None, "South_Korea": "KOR", "North_Korea": "PRK", "Laos": "LAO", "Macau": "MAC", "Moldova": "MDA",
    "Russia": "RUS", "Taiwan_(Republic_of_China)": "TWN", "Tanzania": "TZA", "Thailand/Siam": "THA", "Thailand": "THA",
    "The_Gambia": "GMB", "United_States_of_America": "USA", "Venezuela": "VEN", "Vietnam": "VNM", "Syria": "SYR",
    "England_and_Wales": "GBR", "Scotland": None, "Northern_Ireland": None, "Turkey": "TUR", "Brunei": "BRN",
    "São_Tomé_and_Príncipe": "STP", "Eswatini": "SWZ", "Gibraltar": "GIB", "Guernsey": "GGY", "Jersey": "JEY",
    "Faroe_Islands": "FRO", "French_Polynesia": "PYF", "Guadeloupe": None, "Republika_Srpska": None,
    "Eastern_Caribbean_States": ["ATG", "DMA", "GRD", "KNA", "LCA", "VCT", "AIA", "MSR"], "Transnistria": None, "Artsakh": None, "Katanga": None,
    "Confederate_States_of_America": None, "Czechoslovakia": None, "East_Germany": None, "FR_Yugoslavia": None,
    "Federated_Malay_States": None, "Federation_of_Malaya": None, "Portuguese_India": None, "Portuguese_Timor": None,
    "Sarawak,_Raj_of": None, "South_Vietnam": None, "Soviet_Union": None, "Straits_Settlements": None,
    "Weimar_Republic_and_Nazi_Germany": None, "Yugoslavia": None, "Zaire": None,
}


def _iso3(section: str) -> list[str]:
    if section in SECTIONS:
        v = SECTIONS[section]
        return v if isinstance(v, list) else [v] if v else []
    try:
        return [pycountry.countries.lookup(section.replace("_", " ")).alpha_3]
    except LookupError:
        return []


def current(text: str) -> bool:
    """流通年份有開放式的區間，而且不是只有紀念鈔"""
    t = re.sub(r"\s+", " ", text)
    if "discontinu" in t.lower():
        return False
    for seg in re.split(r"[;,]| and ", t):
        seg = seg.strip()
        if (re.search(r"\d{4}\s*[–-]+\s*(present|today|now|\(|$)", seg, re.I) or re.search(r"\bsince \d{4}", seg, re.I)) \
                and "commemorative" not in seg.lower():
            return True
    return False


def classify(reason: str) -> int:
    r = reason.lower()
    for value, pattern in CATEGORIES:
        if pattern.search(r):
            return value
    return OTHER


def denomination(text: str) -> float:
    """面額格子裡最大的數字（排序用）"""
    nums = [float(n.replace(",", "")) for n in re.findall(r"\d[\d,]*(?:\.\d+)?", text)]
    return max(nums) if nums else 0.0


def build() -> None:
    html = wikipedia_html.page(TITLE, REVID)
    parts = re.split(r'(<h[23][^>]*id="[^"]+")', html)
    people: dict[str, list[dict]] = {}
    section = None
    unknown = set()
    for p in parts:
        m = re.match(r'<h[23][^>]*id="([^"]+)"', p)
        if m:
            section = m.group(1)
            continue
        if section is None:
            continue
        codes = _iso3(section)
        for table in wikipedia_html.tables(p):
            # 有的表在表頭前多一列銀行名稱（英格蘭銀行、蘇格蘭銀行…），找「Person」那一列當表頭
            start = next((i for i, row in enumerate(table) if row and row[0][0].strip().lower() == "person"), None)
            if start is None:
                continue
            header = [c[0].strip().lower() for c in table[start]]
            col = lambda *names: next((i for i, h in enumerate(header) if any(n in h for n in names)), None)  # noqa: E731
            ci, ri, di, si, li = col("circulation"), col("reason"), col("denomination"), col("obverse"), col("lifespan")
            if ci is None or ri is None:
                continue
            for r in table[start + 1:]:
                if len(r) <= max(ci, ri):
                    continue
                cell = lambda i: re.sub(r"\s+", " ", r[i][0]).strip() if i is not None and i < len(r) else ""  # noqa: E731
                if header[ci].startswith("in circulation"):
                    # 「In Circulation (since)」欄：單一年份是「從那年起」；有結束年份或只是紀念鈔的不算
                    v = cell(ci)
                    ok = bool(re.search(r"\d{4}", v)) and not re.search(r"\d{4}\s*[–-]\s*\d{4}", v) \
                        and not re.fullmatch(r"\d{4} \(commemorative\)", v)
                elif not current(cell(ci)):
                    ok = False
                else:
                    ok = True
                if not ok:
                    continue
                if not codes:
                    unknown.add(section)
                    continue
                for iso3 in codes:
                    people.setdefault(iso3, []).append({
                        "name": cell(0), "life": cell(li), "reason": cell(ri), "denom": cell(di), "side": cell(si),
                        "circ": cell(ci), "cat": classify(cell(ri)),
                    })
    print(f"  沒有對應國家的章節（有現在流通的列）：{sorted(unknown)}")

    values, hints, hints_en, detail = {}, {}, {}, {}
    for iso3, rows in sorted(people.items()):
        rows.sort(key=lambda x: -denomination(x["denom"]))
        counts: dict[int, int] = {}
        for x in rows:
            counts[x["cat"]] = counts.get(x["cat"], 0) + 1
        best = max(counts.values())
        cat = next(x["cat"] for x in rows if counts[x["cat"]] == best)  # 一樣多時取面額最大的那張
        if cat in (6, 7):
            cat = OTHER  # 地圖的類別色最多 8 類：軍人、宗教人物為主的國家併進其他（側欄的個人照舊分）
        values[iso3] = [cat]
        top = rows[0]
        hints[iso3] = f"最大面額（{top['denom']}）：{top['name']}"
        hints_en[iso3] = f"Highest denomination ({top['denom']}): {top['name']}"
        detail[iso3] = [[x["name"], x["life"], x["reason"], x["denom"], x["side"], x["circ"], x["cat"]] for x in rows]
    for iso3 in EURO:
        if iso3 not in values:
            values[iso3] = [NOBODY]
    notes = {"TWN": "新臺幣 500 元（少棒）、1,000 元（兒童與地球儀）、2,000 元（衛星與帝雉）上面沒有人，只有 100 元孫中山、200 元蔣中正。"}
    notes_en = {"TWN": "The NT$500 (Little League baseball), NT$1,000 (children and a globe) and NT$2,000 (a satellite and the Mikado pheasant) notes show no people; only the NT$100 (Sun Yat-sen) and NT$200 (Chiang Kai-shek) do."}
    write_json(OUT / "portrait.json", indicator_file(
        "portrait", "類別", [YEAR], values, hints=hints, hintsEn=hints_en, notes=notes, notesEn=notes_en,
    ))
    write_json(OUT / "people.json", {"revid": REVID, "countries": detail})
    by_cat: dict[int, list[str]] = {}
    for c, (v,) in values.items():
        by_cat.setdefault(v, []).append(c)
    print(f"  {len(people)} 國、{sum(len(v) for v in people.values())} 人；" + "；".join(f"{k}: {len(v)} {v if len(v) < 30 else ''}" for k, v in sorted(by_cat.items())))
    print(f"  台灣：{detail.get('TWN')}")
