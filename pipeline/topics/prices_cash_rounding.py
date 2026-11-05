"""物價與消費：付現金時湊整到多少（2026-11-05，製作手冊第二十二批 395；步驟 prices-cash-rounding，輸出 topics/fiscal/）。

- 資料：英文維基「Cash rounding」固定版本（REVID，2026-09-16），讀 `/wiki/Cash_rounding?oldid=` 的 HTML
  （action=raw、Special:Export 在 robots.txt 不允許）。授權 CC BY-SA 4.0，輸出的 cash-rounding*.json 依同樣授權分享。
- 使用者決定完整做（2026-11-05）：「湊到 0.05 或 5」那一節有表（38 列），「0.10 或 10」「0.25」「0.50」「1.00」四節是散文，
  逐國整理成下面的 PERIODS（這個版本的條目，人工讀過）：(開始年, 結束年, 級距)。級距是最小單位的幾倍：
  1 = 5（0.05 或 5 個單位）、2 = 10（0.10 或 10）、3 = 0.25、4 = 0.50、5 = 1（整數）、6 = 其他（越南湊到 1,000 盾）。
  - 表的「Dates」是「1972 to 1985」這種寫法，接下一個級距的那一年算新的級距（瑞典 1985 年起是 0.10）。
  - 條目沒寫開始年份的（阿爾巴尼亞、阿根廷、哈薩克、土耳其、越南、中國、南韓、阿聯、卡達、泰國）只畫在最新的一年。
  - 墨西哥：表寫 1992–2002 湊到 0.05，備註寫「現在一般湊到 10 centavos」，2003 年起當成 0.10。
  - 阿聯在 0.05 的表裡沒有年份，0.25 那一節寫阿聯與卡達用 0.25，照 0.25。
  - 美國 2025 年起停鑄 1 分，商家「可以但不一定要」湊整，算 0.05 並在附註寫明。
- 條目會被改；換版本時要重讀散文、更新 PERIODS。程式會檢查表的國家跟 PERIODS 一致、散文裡的國名都還在。
"""
from __future__ import annotations

import re

from common import OUT_DIR, indicator_file, write_json
from sources import wikipedia_html

OUT = OUT_DIR / "topics" / "fiscal"
TITLE = "Cash rounding"
REVID = 1375275378
FIRST, LAST = 1960, 2026
N = None
PERIODS: dict[str, list[tuple[int | None, int | None, int]]] = {
    "ALB": [(N, N, 1)], "ARG": [(N, N, 1)], "AUS": [(1992, N, 1)], "BHS": [(2021, N, 1)], "BHR": [(1966, N, 1)],
    "BEL": [(2019, N, 1)], "BIH": [(2006, N, 1)], "BRA": [(2005, N, 1)], "CAN": [(2013, N, 1)],
    "PYF": [(2022, N, 1)], "NCL": [(2022, N, 1)], "WLF": [(2022, N, 1)], "HRV": [(2009, 2023, 1)],
    "EST": [(2025, N, 1)], "FIN": [(1980, N, 1)], "GEO": [(2019, N, 1)], "HUN": [(2011, N, 1)], "IRL": [(2015, N, 1)],
    "ISR": [(1991, 2007, 1), (2008, N, 2)], "ITA": [(1918, 2002, 1), (2018, N, 1)], "KAZ": [(N, N, 1)],
    "LTU": [(2025, N, 1)], "MYS": [(2008, N, 1)], "MEX": [(1992, 2002, 1), (2003, N, 2)], "MDA": [(2017, N, 1)],
    "NLD": [(1980, 2002, 1), (2004, N, 1)], "NZL": [(1990, 2005, 1), (2006, N, 2)], "PER": [(2011, 2018, 1), (2019, N, 2)],
    "ROU": [(2005, N, 1)], "SGP": [(2011, N, 1)], "SVK": [(2022, N, 1)], "ZAF": [(2002, 2011, 1), (2012, N, 2)],
    "SWE": [(1972, 1984, 1), (1985, 1991, 2), (1992, 2009, 4), (2010, N, 5)], "CHE": [(2007, N, 1)],
    "TTO": [(2018, N, 1)], "TUR": [(N, N, 1)], "ARE": [(N, N, 3)], "USA": [(2025, N, 1)], "VUT": [(2011, N, 1)],
    "VNM": [(N, N, 6)],
    # 0.10 或 10
    "HKG": [(1989, N, 2)], "CHN": [(N, N, 2)], "CHL": [(2017, N, 2)], "KOR": [(N, N, 2)], "UKR": [(2019, N, 2)],
    # 0.25、0.50、1.00
    "DNK": [(1989, 2007, 3), (2008, N, 4)], "QAT": [(N, N, 3)], "THA": [(N, N, 3)], "NOR": [(1993, 2011, 4), (2012, N, 5)],
    "IND": [(2011, 2018, 4), (2019, N, 5)], "NGA": [(2007, N, 4)], "CZE": [(2008, N, 5)], "JAM": [(2018, N, 5)],
}
# 表的列名 → ISO3（CFP 法郎區一列是三個屬地）
TABLE = {
    "Albania": ["ALB"], "Argentina": ["ARG"], "Australia": ["AUS"], "The Bahamas": ["BHS"], "Bahrain": ["BHR"],
    "Belgium": ["BEL"], "Bosnia and Herzegovina": ["BIH"], "Brazil": ["BRA"], "Canada": ["CAN"],
    "CFP franc area (French Polynesia, New Caledonia, Wallis and Futuna)": ["PYF", "NCL", "WLF"], "Croatia": ["HRV"],
    "Estonia": ["EST"], "Finland": ["FIN"], "Georgia": ["GEO"], "Hungary": ["HUN"], "Ireland": ["IRL"], "Israel": ["ISR"],
    "Italy": ["ITA"], "Kazakhstan": ["KAZ"], "Lithuania": ["LTU"], "Malaysia": ["MYS"], "Mexico": ["MEX"], "Moldova": ["MDA"],
    "Netherlands": ["NLD"], "New Zealand": ["NZL"], "Peru": ["PER"], "Romania": ["ROU"], "Singapore": ["SGP"],
    "Slovakia": ["SVK"], "South Africa": ["ZAF"], "Sweden": ["SWE"], "Switzerland": ["CHE"], "Trinidad and Tobago": ["TTO"],
    "Turkey": ["TUR"], "United Arab Emirates": ["ARE"], "United States": ["USA"], "Vanuatu": ["VUT"], "Vietnam": ["VNM"],
}
PROSE = ["Hong Kong", "China", "Chile", "South Korea", "Ukraine", "Denmark", "Qatar", "Thailand", "Norway", "India",
         "Nigeria", "Czechia", "Jamaica"]
# 怎麼湊（tooltip 多寫一句）：down 一律往下捨、voluntary 商家自願、law 法律規定、shop 商家自己截去
HOW = {"ARG": "down", "SGP": "down", "IRL": "voluntary", "ITA": "voluntary", "USA": "voluntary", "CHN": "shop", "BEL": "law"}
STEP = {1: ("5（0.05）", "5 (0.05)"), 2: ("10（0.10）", "10 (0.10)"), 3: ("0.25", "0.25"), 4: ("0.50", "0.50"),
        5: ("1（整數）", "1 (whole units)"), 6: ("1,000 盾", "1,000 dong")}
HOW_TEXT = {
    "down": ("一律往下捨", "always rounded down"),
    "voluntary": ("商家可以選擇要不要湊整", "rounding is optional for merchants"),
    "shop": ("很多商店直接截去零頭", "many shops simply drop the remainder"),
    "law": ("法律規定", "required by law"),
}
NO_TW = ("英文維基的條目沒有台灣", "Taiwan is not in the Wikipedia article")


def _check(html: str) -> None:
    tables = wikipedia_html.tables(html)
    rows = {re.sub(r"\s+", " ", r[0][0]).strip() for r in tables[0][1:]}
    if rows != set(TABLE):
        raise RuntimeError(f"「Cash rounding」0.05 的表跟 TABLE 不一樣：多了 {rows - set(TABLE)}，少了 {set(TABLE) - rows}")
    covered = {c for codes in TABLE.values() for c in codes}
    text = re.sub(r"<[^>]+>", " ", html)
    for name in PROSE:
        if name not in text:
            raise RuntimeError(f"「Cash rounding」的散文裡找不到 {name}，條目可能改了，要重讀")
    missing = set(PERIODS) - covered
    if len(missing) != len(PROSE):
        raise RuntimeError(f"PERIODS 裡散文的國家數不對：{sorted(missing)}")


def build() -> None:
    _check(wikipedia_html.page(TITLE, REVID))
    years = list(range(FIRST, LAST + 1))
    values, hints, hints_en, detail = {}, {}, {}, {}
    for iso3, periods in sorted(PERIODS.items()):
        series: list[int | None] = []
        for y in years:
            v = None
            for start, end, step in periods:
                if start is None:
                    v = step if y == LAST else v
                elif start <= y and (end is None or y <= end):
                    v = step
            series.append(v)
        values[iso3] = series
        parts_zh, parts_en = [], []
        for start, end, step in periods:
            zh, en = STEP[step]
            if start is None:
                parts_zh.append(f"湊到 {zh}（條目沒寫開始年份）")
                parts_en.append(f"to {en} (no start year given)")
            elif end is None:
                parts_zh.append(f"{start} 年起湊到 {zh}")
                parts_en.append(f"to {en} since {start}")
            else:
                parts_zh.append(f"{start}–{end} 年湊到 {zh}")
                parts_en.append(f"to {en} in {start}–{end}")
        if iso3 in HOW:
            parts_zh.append(HOW_TEXT[HOW[iso3]][0])
            parts_en.append(HOW_TEXT[HOW[iso3]][1])
        hints[iso3] = "；".join(parts_zh)
        hints_en[iso3] = "; ".join(parts_en)
        detail[iso3] = {"periods": [list(p) for p in periods], "how": HOW.get(iso3)}
    write_json(OUT / "cash-rounding.json", indicator_file(
        "cash-rounding", "類別", years, values, hints=hints, hintsEn=hints_en,
        noValue={"TWN": NO_TW[0]}, noValueEn={"TWN": NO_TW[1]},
    ))
    write_json(OUT / "cash-rounding-detail.json", {"revid": REVID, "countries": detail})
    now = {c: s[-1] for c, s in values.items() if s[-1] is not None}
    counts: dict[int, list[str]] = {}
    for c, v in now.items():
        counts.setdefault(v, []).append(c)
    print(f"  現金湊整 {len(values)} 國；{LAST} 年：" + "；".join(f"{STEP[k][0]} {len(v)} {v}" for k, v in sorted(counts.items())))
    print(f"  已經不湊整（歷史）：{[c for c, s in values.items() if s[-1] is None]}")
