"""菸酒的擴充：電子菸的規範、室內全面禁菸的場所數（2026-10-30，製作手冊第六批 92；輸出到 topics/tobacco-alcohol/）。

- 電子菸的規範（候選 499）：英文維基百科「Regulation of electronic cigarettes」（固定 revid 1377697236，2026-09-30）的
  「Legal status by jurisdiction」表，含尼古丁的電子菸（Nicotine-containing cartridges）那一欄。使用者決定：「legal」與
  「below 20 mg/ml legal」（歐盟菸草製品指令的濃度上限）合成「合法」一類。歸類：
    合法（legal、below 20 mg/ml legal）＝1、要處方或只在藥局買（only with prescription、澳洲的 legal only at pharmacies）＝2、
    事實上禁止（de facto ban：日本、土耳其、巴西、委內瑞拉）＝3、禁止（banned）＝4；unknown 不畫。
  表裡的州、省、屬地不算國家（OVERRIDES 逐一寫明），授權 CC BY-SA 4.0，資料檔同樣 CC BY-SA 4.0。
  台灣表上是 banned，用《菸害防制法》（民國 112 年 2 月 15 日修正，同年 3 月 22 日施行）第 15 條核對：
  「任何人不得製造、輸入、販賣、供應、展示或廣告……類菸品或其組合元件」「任何人不得使用類菸品」。
- 室內全面禁菸的場所數（候選 502）：WHO GHO「Tobacco MPOWER Protect people: P1 smoke-free places」
  （TOBACCO_MPOWER_P1_SMOKEFREEPLACES，經 xmart 讀，CC BY 4.0），8 類場所（醫療、學校、大學、政府機關、辦公室、
  餐廳、酒吧、大眾運輸）全國法律規定全面禁菸的有幾類，2007–2024 年。「. . .」（沒有資料）那一類當成沒有值，
  8 類都要有答案才算。WHO 把准設吸菸室算成不是全面禁菸。
  台灣不在 WHO 的資料裡，依《菸害防制法》第 18 條照 WHO 的標準編碼：醫療機構（第 3 款）、各級學校與大學（第 1 款）、
  政府機關（第 4 款）、三人以上共用的室內工作場所（第 12 款）、大眾運輸（第 5 款）全面禁菸；餐飲店、酒吧（第 11 款）
  可以設獨立空調與隔間的吸菸室，不算 → 6 類。2009 年 1 月 11 日施行的修正版（第 15 條）同樣是這 6 類，
  餐飲、酒吧一樣可以設吸菸室，所以 2010 年起都是 6；2007、2008 年是舊法，不編。
"""
from __future__ import annotations

import re

import pycountry

from common import OUT_DIR, download, indicator_file, write_json
from sources import who_xmart

OUT = OUT_DIR / "topics" / "tobacco-alcohol"
WIKI_REVID = 1377697236
WIKI_DATE = "2026-09-30"
WIKI_URL = f"https://en.wikipedia.org/w/index.php?title=Regulation_of_electronic_cigarettes&action=raw&oldid={WIKI_REVID}"
ECIG_YEAR = 2026

STATUS = [
    ("legal only at pharmacies", 2),
    ("only with prescription", 2),
    ("de facto ban", 3),
    ("banned", 4),
    ("below 20", 1),
    ("legal", 1),
]

# 表上的名稱（{{flag|…}}）→ ISO alpha-3：pycountry 查不到的、或不是國家要跳過的（None）
NAMES = {
    "Turkey": "TUR",
    "Russia": "RUS",
    "Iran": "IRN",
    "Syria": "SYR",
    "North Korea": "PRK",
    "South Korea": "KOR",
    "Vietnam": "VNM",
    "Taiwan": "TWN",
    "Laos": "LAO",
    "Brunei": "BRN",
    "East Timor": "TLS",
    "Palestine": "PSE",
    "Kosovo": "XKX",
    "Cape Verde": "CPV",
    "Republic of the Congo": "COG",
    "Democratic Republic of the Congo": "COD",
    "Micronesia, Federated States of": None,  # 只有各州的列（Chuuk、Kosrae…），都是 unknown
    "Bolivia": "BOL",
    "Venezuela": "VEN",
    "Moldova": "MDA",
    "Tanzania": "TZA",
    "Czech Republic": "CZE",
    "Georgia": "GEO",
    "Mauritania": "MRT",
    "Western Sahara": "ESH",
    "Macau": "MAC",
}
# 有「行政區」欄的列：第三欄是州、省或屬地。依第三欄的旗子決定這一列算哪裡（None 是不算）
DIVISIONS = {
    "China": "CHN",  # 第三欄是 China (mainland)
    "Malaysia": "MYS",  # 第三欄是 Malaysia 本身；另一列是檳城、吉打、柔佛、吉蘭丹四州禁止
    "United States": "USA",  # 美洲那一列的第三欄是 United States 本身；大洋洲那一列是美屬薩摩亞（unknown）
    "Canada": "CAN",  # 第三欄是亞伯達等省（below 20 mg/ml legal）；其他省只差購買年齡
}


def _clean(cell: str) -> str:
    cell = re.sub(r"<ref[^>]*/>", "", cell)
    cell = re.sub(r"<ref[^>]*>.*?</ref>", "", cell, flags=re.S)
    cell = cell.lstrip("|").strip()
    head = cell.split("|", 1)
    if len(head) == 2 and re.search(r"style=|align=|colspan|rowspan", head[0]):
        cell = head[1]
    return cell.strip()


def _status(text: str) -> int | None:
    text = re.sub(r"&nbsp;", " ", text).lower()
    for key, code in STATUS:
        if text.startswith(key):
            return code
    return None


def _iso3(name: str) -> str | None:
    if name in NAMES:
        return NAMES[name]
    try:
        return pycountry.countries.lookup(name).alpha_3
    except LookupError:
        return None


def ecig_status() -> dict[str, tuple[int, str]]:
    """{iso3: (歸類, 表上的原文)}"""
    text = open(download(WIKI_URL, "wikipedia", f"Regulation_of_electronic_cigarettes-{WIKI_REVID}.wiki"), encoding="utf-8").read()
    start = text.index("== Legal status by jurisdiction ==")
    table = text[start:text.index("\n|}", start)]
    out: dict[str, tuple[int, str]] = {}
    for row in table.split("\n|-")[4:]:
        lines = [line for line in row.strip("\n").split("\n") if line.startswith("|")]
        cells = [_clean(line) for line in lines]
        if cells and cells[0] == "-":  # 印度那一列前面多一格
            cells = cells[1:]
        if len(cells) < 4:
            continue
        flag = re.match(r"''?\{\{flag\|([^}|]+)", cells[1], re.I) or re.match(r"\{\{flag\|([^}|]+)", cells[1], re.I)
        if not flag:
            continue
        name = flag.group(1)
        status = cells[2]
        if cells[2].startswith(("{{flag", "''{{flag")):
            division = re.search(r"\{\{flag\|([^}|]+)", cells[2]).group(1)
            if name not in DIVISIONS or (division != name and name not in ("China", "Canada")):
                continue  # 州、省、屬地的列
            status = cells[3]
            iso3 = DIVISIONS[name]
        else:
            iso3 = _iso3(name)
        code = _status(status)
        if not iso3 or code is None or iso3 in out:
            continue
        out[iso3] = (code, re.sub(r"<[^>]+>|&nbsp;", " ", status).split("(")[0].strip())
    return out


def build_ecig() -> None:
    status = ecig_status()
    if status.get("TWN", (0,))[0] != 4:
        raise RuntimeError(f"維基百科的表上台灣不是 banned（{status.get('TWN')}），要重新核對菸害防制法")
    values = {k: [v[0]] for k, v in sorted(status.items())}
    note = ("台灣：《菸害防制法》（民國 112 年 2 月 15 日修正、3 月 22 日施行）第 15 條規定任何人不得製造、輸入、販賣、供應、"
            "展示或廣告類菸品（電子菸），也不得使用。")
    note_en = ("Taiwan: Article 15 of the Tobacco Hazards Prevention Act (amended 15 February 2023, in force 22 March 2023) bans "
               "manufacturing, importing, selling, supplying, displaying or advertising imitation tobacco products (e-cigarettes), "
               "and using them.")
    write_json(OUT / "e-cigarettes.json", indicator_file(
        "e-cigarettes", "", [ECIG_YEAR], values, notes={"TWN": note}, notesEn={"TWN": note_en},
    ))
    counts = {c: sum(1 for v in status.values() if v[0] == c) for c in (1, 2, 3, 4)}
    print(f"  電子菸：{len(status)} 國（含台灣）；合法 {counts[1]}、處方或藥局 {counts[2]}、事實上禁止 {counts[3]}、禁止 {counts[4]}")
    print(f"  處方或藥局 {sorted(k for k, v in status.items() if v[0] == 2)}；事實上禁止 {sorted(k for k, v in status.items() if v[0] == 3)}")


PLACES = ["P1_healthcare", "P2_education", "P3_universities", "P4_govt", "P5_indoor_off", "P6_restaurants", "P7_pubs", "P8_pub_transp"]
TWN_PLACES = {"P1_healthcare", "P2_education", "P3_universities", "P4_govt", "P5_indoor_off", "P8_pub_transp"}
TWN_FROM = 2010


def build_smokefree() -> None:
    by_place = {p: who_xmart.answers("TOBACCO_MPOWER_P1_SMOKEFREEPLACES", DIMENSION_MEMBER_1=p) for p in PLACES}
    years = sorted({y for s in by_place.values() for c in s.values() for y in c})
    countries = sorted({c for s in by_place.values() for c in s})
    values: dict[str, list[int | None]] = {}
    for iso3 in countries:
        row: list[int | None] = []
        for y in years:
            answers = [by_place[p].get(iso3, {}).get(y) for p in PLACES]
            row.append(sum(a == "Yes" for a in answers) if all(a in ("Yes", "No") for a in answers) else None)
        if any(v is not None for v in row):
            values[iso3] = row
    values["TWN"] = [len(TWN_PLACES) if y >= TWN_FROM else None for y in years]
    note = ("WHO 沒有台灣，這裡依《菸害防制法》第 18 條照 WHO 的標準編碼：醫療機構、各級學校（含大學）、政府機關、"
            "三人以上共用的室內工作場所、大眾運輸全面禁菸；餐飲店、酒吧可以設獨立空調與隔間的室內吸菸室，不算全面禁菸。"
            f"2009 年施行的修正版也是這 6 類，地圖從 {TWN_FROM} 年畫起。")
    note_en = ("Taiwan is not in the WHO data; it is coded here from Article 18 of the Tobacco Hazards Prevention Act using WHO's "
               "criteria: health-care facilities, schools and universities, government buildings, indoor workplaces shared by "
               "three or more people and public transport are completely smoke-free; restaurants and bars may have enclosed, "
               "separately ventilated smoking rooms, so they do not count. The 2009 version of the act covered the same six, "
               f"so the map shows Taiwan from {TWN_FROM}.")
    write_json(OUT / "smoke-free.json", indicator_file(
        "smoke-free", "類", years, values, notes={"TWN": note}, notesEn={"TWN": note_en},
    ))
    last = [v[-1] for v in values.values() if v[-1] is not None]
    print(f"  室內禁菸：{len(values)} 國，{years}；{years[-1]} 年 8 類 {last.count(8)} 國、0 類 {last.count(0)} 國")
    print(f"  {years[-1]}：日本 {values['JPN'][-1]}、韓國 {values['KOR'][-1]}、美國 {values['USA'][-1]}、德國 {values['DEU'][-1]}、"
          f"英國 {values['GBR'][-1]}、中國 {values['CHN'][-1]}")


def build() -> None:
    build_ecig()
    build_smokefree()
