"""電動車主題的擴充（2026-10-30，製作手冊第六批 105）：各國停售燃油新車的年份與狀態。

- 資料：英文維基百科「Phase-out of fossil fuel vehicles」（固定 revid 1380317959，2026-10-15，CC BY-SA 4.0）的
  「Countries」表（Country、Start year、Status、Scope、Details，58 列），加上同一條目的兩段文字：
  - 「European Union」一節：歐盟 27 國的部長 2022 年同意、2023 年立法（新車與輕型商用車 2035 年起二氧化碳排放減 100%）。
    表裡只列了 19 個成員國，其他 8 國（法國、保加利亞、捷克、愛沙尼亞、匈牙利、拉脫維亞、羅馬尼亞、斯洛伐克）
    依同一條歐盟法規補上，附註寫明。
  - 「Places with existing phase-out」：挪威 2017 年訂 2025 年起不賣內燃機新車的目標（政策目標，不是禁令），
    衣索比亞 2024 年禁止進口燃油車（已實施）。
- 狀態（使用者決定分三種，逐國判斷）：Status 是「EU regulation」的與衣索比亞 → 已立法或已實施；
  只寫「Signatory of the Glasgow Declaration」→ 只簽了格拉斯哥宣言；其他（政府計畫、氣候計畫、提案）→ 政策目標。
  印度同時有政府計畫（2034）與宣言（2040），算政策目標、年份取 2034。
- 年份：Start year 的第一個年份（英國寫 2030、2035、2040：2030 年停售純汽柴油車，取 2030）；新加坡寫了 2023（公部門）、
  2025（柴油車），條目的 Details 說 2030 年起新車都要是較乾淨的能源，取 2030。
- 表裡沒有的國家是「沒有宣布」（代碼 0），值寫進指標檔，地圖才分得出「沒有宣布」與「沒有資料」；國家清單用
  國家小檔案的政體指標（所有國家與屬地）。美國聯邦沒有、加州等州有，附註寫明。
- 台灣：表裡是 2040（引 2017 年 Taipei Times 報導的環保署計畫）。手冊要求用官方較新的資料核對：國發會的網頁從 cloud
  被 Cloudflare 擋，2026-10-30 由使用者電腦上的本機 session 下載（skywitness/map-plan 的 data/ndc/，commit 8201bf0）。
  《臺灣2050淨零排放路徑及策略總說明》（2022-03-30）第 40 頁：「於2040 年所有新售小客車均為電動車」「於2040 年所有新售
  機車均為電動機車」，年份跟條目一樣是 2040；機車從 2017 年計畫的 2035 年延到 2040 年。交通部「運具電動化及無碳化」
  行動計畫核定本（2023 年 4 月）第 19 頁明說是市售比目標、不是禁售，所以狀態是政策目標。國發會網站採 CC BY 4.0。
- 輸出 public/data/topics/ev/phaseout-year.json、phaseout-status.json（一年 2026），hints 是範圍（哪些車）。
"""
from __future__ import annotations

import json
import re

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import from_name

URL = "https://en.wikipedia.org/w/index.php?title=Phase-out_of_fossil_fuel_vehicles&action=raw&oldid=1380317959"
OUT = OUT_DIR / "topics" / "ev"
YEAR = 2026

LEGISLATED, POLICY, DECLARATION, NONE = 1, 2, 3, 0
NAMES = {"People's Republic of China": "CHN", "Republic of Korea": "KOR", "Holy See": "VAT", "Cape Verde": "CPV",
         "Turkey": "TUR", "Macau": "MAC", "Hong Kong": "HKG", "Taiwan": "TWN"}
EU = ["AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "IRL", "ITA", "LVA",
      "LTU", "LUX", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE"]
YEAR_OVERRIDES = {"SGP": 2030}  # 見上面的說明
EXTRA = {  # 表以外（條目的其他段落）：iso3 → (年份, 狀態, 範圍)
    "NOR": (2025, POLICY, "Emitting"),
}
# 範圍 → (中文, 英文)
SCOPES = [
    (r"only", ("只有純汽油、柴油車（油電混合車不算）", "Petrol- and diesel-only cars (hybrids allowed)")),
    (r"^non-electric$", ("非電動車", "Non-electric vehicles")),
    (r"emitting", ("所有會排放廢氣的新車", "All new vehicles with tailpipe emissions")),
    (r"diesel|petrol", ("汽油車、柴油車", "Petrol and diesel vehicles")),
]
STATUS_TEXT = {LEGISLATED: ("已立法或已實施", "Legislated or in force"), POLICY: ("政策目標", "Policy target"),
               DECLARATION: ("只簽了格拉斯哥宣言", "Glasgow Declaration signatory only")}


def _clean(text: str) -> str:
    text = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    return text.strip()


def _scope(text: str) -> tuple[str, str]:
    for pattern, names in SCOPES:
        if re.search(pattern, text, re.I):
            return names
    raise ValueError(f"看不懂的範圍「{text}」")


def _table() -> dict[str, tuple[int, int, str]]:
    raw = download(URL, "wikipedia", "phase-out-of-fossil-fuel-vehicles-1380317959.txt").read_text(encoding="utf-8")
    section = raw[raw.index("===Countries==="):raw.index("=== Cities and territories ===")]
    rows = section.split("\n|-")[1:]
    out: dict[str, tuple[int, int, str]] = {}
    for row in rows:
        row = _clean(row)
        cells = [c.strip() for c in re.split(r"\n\||\|\|", "\n" + row) if c.strip()]
        if len(cells) < 4 or cells[0].startswith("!"):
            continue
        name = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", cells[0]).split("(")[0].strip()
        iso3 = NAMES.get(name) or from_name(name)
        if not iso3:
            raise RuntimeError(f"燃油車禁售的表：對不到國家「{name}」")
        years = [int(y) for y in re.findall(r"\b(20\d\d)\b", cells[1])]
        status_text = cells[2]
        if "EU regulation" in status_text or iso3 == "ETH":
            status = LEGISLATED
        elif status_text.startswith("Signatory of the Glasgow Declaration") and "plan" not in status_text.lower():
            # 土耳其另外簽了卡車與巴士的宣言，也只是宣言
            status = DECLARATION
        else:
            status = POLICY
        out[iso3] = (YEAR_OVERRIDES.get(iso3, years[0]), status, cells[3])
    if len(out) < 50:
        raise RuntimeError(f"燃油車禁售的表只讀到 {len(out)} 國，條目的版面可能變了")
    return out


def build() -> None:
    table = _table()
    listed_eu = [c for c in EU if c in table]
    for iso3 in EU:
        table.setdefault(iso3, (2035, LEGISLATED, "Emitting"))
    for iso3, v in EXTRA.items():
        table.setdefault(iso3, v)
    countries = json.loads((OUT_DIR / "topics" / "profiles" / "government.json").read_text(encoding="utf-8"))["values"]
    years_v: dict[str, list] = {c: [NONE] for c in countries}
    status_v: dict[str, list] = {c: [NONE] for c in countries}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    for iso3, (year, status, scope) in table.items():
        years_v[iso3] = [year]
        status_v[iso3] = [status]
        zh, en = _scope(scope)
        if iso3 == "TWN":  # 條目寫汽油、柴油車；國發會的目標是所有新售小客車與機車
            zh, en = "所有新售小客車與機車", "All new cars and motorcycles"
        hints[iso3] = f"{STATUS_TEXT[status][0]}：{zh}"
        hints_en[iso3] = f"{STATUS_TEXT[status][1]}: {en}"
    notes = {c: "條目的國家表沒有列，依歐盟 2035 年起新車零排放的法規補上" for c in EU if c not in listed_eu}
    notes_en = {c: "Not listed in the article's country table; added under the EU rule requiring zero-emission new cars "
                   "from 2035" for c in EU if c not in listed_eu}
    notes["NOR"] = "挪威 2017 年訂下 2025 年起新車不再賣內燃機車的目標（不是禁令），2022 年新車已有近九成是電動車"
    notes_en["NOR"] = ("Norway set a target in 2017 of selling no new combustion-engine cars from 2025 (a target, not a "
                       "ban); by 2022 nearly nine in ten new cars sold were electric")
    notes["ETH"] = "衣索比亞 2024 年起禁止進口燃油車"
    notes_en["ETH"] = "Ethiopia banned imports of combustion-engine vehicles in 2024"
    notes["USA"] = "聯邦沒有停售的年份；加州等十幾州採用加州的零排放車規定，訂 2035 年起新車零排放"
    notes_en["USA"] = ("No federal phase-out date; about a dozen states that follow California's zero-emission vehicle "
                       "rules set 2035 for all new cars to be zero-emission")
    notes["TWN"] = ("國發會《臺灣2050淨零排放路徑及策略總說明》（2022 年）：2040 年所有新售小客車與機車都是電動車"
                    "（2030 年市售比 30%、35%，2035 年 60%、70%），2030 年市區公車與公務車全面電動化。交通部的行動計畫說明"
                    "這是靠補貼達成的市售比目標，不是禁售或禁買燃油車")
    notes_en["TWN"] = ("National Development Council, Taiwan's 2050 net-zero pathway (2022): all new cars and motorcycles sold "
                       "from 2040 are to be electric (sales shares of 30% and 35% in 2030, 60% and 70% in 2035), with city "
                       "buses and government cars fully electric by 2030. The transport ministry's action plan says this is "
                       "a sales-share target reached through subsidies, not a ban on selling or buying combustion vehicles")
    for name, values in (("phaseout-year", years_v), ("phaseout-status", status_v)):
        write_json(OUT / f"{name}.json", indicator_file(
            name, "", [YEAR], values, hints=hints, hintsEn=hints_en, notes=notes, notesEn=notes_en))
    counts = {s: sum(1 for v in table.values() if v[1] == s) for s in (LEGISLATED, POLICY, DECLARATION)}
    print(f"  燃油車禁售：{len(table)} 國（已立法 {counts[LEGISLATED]}、政策目標 {counts[POLICY]}、只簽宣言 "
          f"{counts[DECLARATION]}），表裡沒有的歐盟國家 {len(EU) - len(listed_eu)} 國補上；台灣 {table.get('TWN')}")
