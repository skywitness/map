"""國家小檔案：國會是一院還是兩院、席次與每席代表多少人（2026-11-05，製作手冊第二十二批 379；步驟 profiles-legislature）。

- 國會幾院（chambers.json，1900–2025 年，前端唯一有時間軸的小檔案指標）：V-Dem v16 的 v2lgbicam
  （0 沒有立法機關、1 一院、2 兩院以上；國家—年取那一年最後的狀態），CC BY-SA 4.0，國家的接續方式跟民主與自由主題一樣
  （topics/democracy.py 的 country_series）。V-Dem 的 0 是「沒有運作中的立法機關」，包含國會被解散、暫停的國家
  （2025 年緬甸、阿富汗、科威特、海地等），不是憲法上沒有國會：tooltip 寫從哪一年起沒有（依 V-Dem 自己的序列算）。
- 席次（seats.json、seat-population.json、legislature.json，2026 年的快照）：英文維基百科
  「List of legislatures by number of members」固定版本（REVID）的表，只用席次欄（下議院、上議院、合計）與議會名稱。
  這個條目掛著過時的標記（「Number of seats and population of some countries are not updated…」），
  所以表裡的人口與每席人口都不用，每席代表多少人用 UN WPP 2024 的 2026 年人口（人口主題的 total.json）自己算：
  總人口 ÷ 下議院（或單一議院）席次。英國上議院的人數在條目裡是即時算的，以這個版本為準。
  維基百科是 CC BY-SA 4.0，這幾個檔也用 CC BY-SA 4.0 分享。
  歐盟與屬地（profiles.py 的 TERRITORIES）不收；科索沃這類非聯合國會員在表上是斜體，地圖上有形狀的照收。
- 讀條目的方式：robots.txt 不准程式抓 /w/ 與 Special:（sources/wikipedia_html.py），讀 /wiki/<條目>?oldid= 的 HTML。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import vdem, wikipedia_html
import pycountry

from sources.countries import ISO3, NAME_ALIASES
from topics.democracy import FIRST_YEAR, NOTES, country_series
from topics.profiles import TERRITORIES, _read_indicator

OUT = OUT_DIR / "topics" / "profiles"
TITLE = "List of legislatures by number of members"
REVID = 1378639172  # 2026-11-05 讀的版本
YEAR = 2026  # 席次是 2026 年的快照（跟小檔案其他指標一樣），人口也用 WPP 的 2026 年
# 表上的國名 → 地圖代碼（pycountry 對不到或會對錯的）
NAMES = {
    "Kosovo": "XKX",
    "Taiwan": "TWN",
    "Republic of the Congo": "COG",
    "Democratic Republic of the Congo": "COD",
    "East Timor": "TLS",
    "Ivory Coast": "CIV",
    "Cape Verde": "CPV",
    "Micronesia": "FSM",
    "Federated States of Micronesia": "FSM",
    "North Korea": "PRK",
    "South Korea": "KOR",
    "Vatican City": "VAT",
    "Palestine": "PSE",
    "Somaliland": "_SOL",
    "Turkey": "TUR",
    "Laos": "LAO",
    "Russia": "RUS",
    "Syria": "SYR",
    "Iran": "IRN",
    "Bolivia": "BOL",
    "Venezuela": "VEN",
    "Tanzania": "TZA",
    "Moldova": "MDA",
    "Vietnam": "VNM",
    "Brunei": "BRN",
    "Eswatini": "SWZ",
    "The Gambia": "GMB",
    "Gambia": "GMB",
    "The Bahamas": "BHS",
    "Bahamas": "BHS",
    "Korea, North": "PRK",
    "Korea, South": "KOR",
    "Congo, Democratic Republic of the": "COD",
    "Congo, Republic of the": "COG",
    "São Tomé and Príncipe": "STP",
    "Bahamas, The": "BHS",
    "Gambia, The": "GMB",
    # 屬地：對到代碼後由 TERRITORIES 濾掉
    "Saint Martin": "MAF",
    "Saint Barthelemy": "BLM",
    "Sint Maarten": "SXM",
    "United States Virgin Islands": "VIR",
    "Falkland Islands": "FLK",
    "Pitcairn Islands": "PCN",
}
# 不收：歐盟；地圖上沒有自己形狀的地區（德涅斯特河沿岸、阿布哈茲、南奧塞提亞，喬治亞的阿札爾自治共和國）；
# 塔利班的「領導委員會」（約 30 人，不是選出來的立法機關，V-Dem 也記阿富汗 2021 年起沒有立法機關）
SKIP = {"European Union", "Transnistria", "Abkhazia", "South Ossetia", "Adjara", "Islamic Emirate of Afghanistan"}


def _chambers() -> dict[str, int]:
    rows = vdem.rows()
    last = max(int(r["year"]) for r in rows)
    years = list(range(FIRST_YEAR, last + 1))
    series, _gaza = country_series(rows, ["v2lgbicam"])
    values = {c: to_ints(s, years) for c, s in sorted(series["v2lgbicam"].items())}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    for c, s in values.items():
        if s[-1] != 0:
            continue
        # 這一段「沒有」從哪一年開始
        start = next((years[i + 1] for i in range(len(s) - 2, -1, -1) if s[i] not in (0, None)), None)
        hints[c] = f"{start} 年起沒有運作中的立法機關（解散或暫停）" if start else f"{years[0]} 年以來都沒有立法機關"
        hints_en[c] = f"No functioning legislature since {start} (dissolved or suspended)" if start else f"No legislature since {years[0]}"
    notes = {k: zh for k, (zh, _en) in NOTES.items()}
    notes_en = {k: en for k, (_zh, en) in NOTES.items()}
    notes["TWN"] += "V-Dem 從 1949 年起算一院（立法院）；2005 年修憲廢除以前的國民大會不算在內。"
    notes_en["TWN"] += " V-Dem counts one chamber (the Legislative Yuan) from 1949; the National Assembly, abolished in 2005, is not counted."
    write_json(OUT / "chambers.json", indicator_file(
        "chambers", "類別", years, values, hints=hints, hintsEn=hints_en, notes=notes, notesEn=notes_en,
    ))
    latest = {c: s[-1] for c, s in values.items() if s[-1] is not None}
    print(f"  國會幾院（V-Dem）：{len(values)} 國；{last} 年一院 {sum(v == 1 for v in latest.values())}、"
          f"兩院 {sum(v == 2 for v in latest.values())}、沒有 {sum(v == 0 for v in latest.values())}："
          + "、".join(f"{c}（{hints[c]}）" for c in sorted(hints)))
    return latest


def to_ints(by_year: dict[int, float], years: list[int]) -> list[int | None]:
    return [None if (v := by_year.get(y)) is None else int(v) for y in years]


def _lookup(name: str) -> str | None:
    """只用完全相符的名稱（不用模糊比對：阿布哈茲會被對成喬治亞）"""
    try:
        return pycountry.countries.lookup(name).alpha_3
    except LookupError:
        return None


def _seats(chambers: dict[str, int]) -> None:
    """chambers：V-Dem 最近一年的國會幾院；記為沒有運作中的立法機關（0）的國家不畫席次（表上的是名義上的席次）"""
    table = next(t for t in wikipedia_html.tables(wikipedia_html.page(TITLE, REVID)) if t[0][0][0] == "Country")
    header = [c[0] for c in table[1]]
    expect = ["Country", "Legislature", "Type", "Lower house", "Upper house", "L/U ratio", "Total"]
    if header[:7] != expect:
        raise RuntimeError(f"維基百科的國會席次表欄位變了：{header}")
    population = _read_indicator(OUT_DIR / "topics" / "population" / "total.json")
    pop_year = population["years"].index(YEAR)
    rows: dict[str, list] = {}
    unknown: list[str] = []
    for r in table[2:]:
        name = r[0][0]
        if name in SKIP:
            continue
        iso3 = NAMES.get(name) or NAME_ALIASES.get(name) or _lookup(name)
        if not iso3 or (iso3 not in ISO3 and not iso3.startswith("_")):
            unknown.append(name)
            continue
        if iso3 in TERRITORIES:
            continue
        lower = wikipedia_html.number(r[3][0])
        upper = wikipedia_html.number(r[4][0])
        kind = r[2][0].lower()
        if lower is None or kind not in ("unicameral", "bicameral"):
            raise RuntimeError(f"維基百科的國會席次表：{name} 的格式不對 {[c[0] for c in r]}")
        if iso3 in rows:
            raise RuntimeError(f"維基百科的國會席次表：{name}（{iso3}）出現兩次")
        rows[iso3] = [r[1][0], 1 if kind == "unicameral" else 2, int(lower), None if upper is None else int(upper)]
    if unknown:
        raise RuntimeError(f"維基百科的國會席次表有對不到地圖的國名（加進 NAMES）：{unknown}")

    suspended = sorted(c for c in rows if chambers.get(c) == 0)
    for c in suspended:
        rows.pop(c)
    print(f"  V-Dem 記為沒有運作中的立法機關、不畫席次：{suspended}")
    no_value = {c: "沒有運作中的立法機關（V-Dem）" for c, v in chambers.items() if v == 0}
    no_value_en = {c: "No functioning legislature (V-Dem)" for c, v in chambers.items() if v == 0}
    total = {c: [v[2] + (v[3] or 0)] for c, v in rows.items()}
    per_seat: dict[str, list] = {}
    for c, v in rows.items():
        pop = population["values"].get(c, [None] * (pop_year + 1))[pop_year]
        if pop:
            per_seat[c] = [round(pop / v[2])]
    license_note = "英文維基百科 CC BY-SA 4.0（這個資料檔也用 CC BY-SA 4.0）"
    write_json(OUT / "seats.json", indicator_file(
        "seats", "席", [YEAR], dict(sorted(total.items())), license=license_note, noValue=no_value, noValueEn=no_value_en,
    ))
    write_json(OUT / "seat-population.json", indicator_file(
        "seat-population", "人", [YEAR], dict(sorted(per_seat.items())), license=license_note, noValue=no_value, noValueEn=no_value_en,
    ))
    # 側欄：[議會名稱（英文）, 1 一院、2 兩院, 下議院席次, 上議院席次或 null]
    write_json(OUT / "legislature.json", {
        "source": f"https://en.wikipedia.org/w/index.php?title={TITLE.replace(' ', '_')}&oldid={REVID}",
        "license": "CC BY-SA 4.0",
        "countries": dict(sorted(rows.items())),
    })
    top = sorted(per_seat.items(), key=lambda kv: -kv[1][0])
    print(f"  席次（維基百科 oldid {REVID}）：{len(rows)} 國；台灣 {rows.get('TWN')}、每席 {per_seat.get('TWN')}；"
          f"每席人口最多 {top[:4]}，最少 {top[-4:]}；總席次最多 {sorted(total.items(), key=lambda kv: -kv[1][0])[:3]}")


def build() -> None:
    _seats(_chambers())
