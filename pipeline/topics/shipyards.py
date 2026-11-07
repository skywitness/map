"""航運與港口的擴充：造船廠地圖（含已關閉的）（2026-11-07，製作手冊第二十七批 582，候選 1300；步驟 shipyards，
輸出 topics/shipping/）。

資料：Wikidata（CC0）經 QLever（sources/qlever_wikidata.py）：P31/P279* Q190928（造船廠）有 P17（國家）的，
座標 P625、創立 P571、關閉 P576、所在地 P131 的英文標籤。手冊的陷阱：Wikidata 偏歐洲（德荷挪瑞加起來比中日韓多好幾倍），
**絕對不能當產業規模**，所以不做國家的面量圖或比例圓，只畫點（依開業中、已關閉上色）與左邊的清單；國家的家數只寫在 tooltip。
OSM 的 industrial=shipyard 南韓只有 7 個，手冊建議不用。
"""
from __future__ import annotations

import re
from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json
from sources import qlever_wikidata
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "shipping"
YEAR = 2026
QUERY = """SELECT ?s ?en ?zh ?cc ?coord ?start ?end ?city WHERE {
  ?s wdt:P31/wdt:P279* wd:Q190928 ; wdt:P17 ?c .
  OPTIONAL { ?c wdt:P297 ?iso }
  # 荷蘭（Q55）與英國的構成國（英格蘭、蘇格蘭、威爾斯、北愛爾蘭）沒有 ISO 代碼，另外對
  BIND(IF(?c = wd:Q55, "NL", IF(?c IN (wd:Q21, wd:Q22, wd:Q25, wd:Q26), "GB", ?iso)) AS ?cc)
  FILTER(BOUND(?cc))
  OPTIONAL { ?s wdt:P625 ?coord }
  OPTIONAL { ?s rdfs:label ?en . FILTER(LANG(?en) = "en") }
  OPTIONAL { ?s rdfs:label ?zh . FILTER(LANG(?zh) = "zh-tw") }
  OPTIONAL { ?s wdt:P571 ?a . BIND(YEAR(?a) AS ?start) }
  OPTIONAL { ?s wdt:P576 ?b . BIND(YEAR(?b) AS ?end) }
  OPTIONAL { ?s wdt:P131 ?l . ?l rdfs:label ?city . FILTER(LANG(?city) = "en") }
}"""


def build() -> None:
    rows = qlever_wikidata.cached("shipyards", QUERY)
    yards: dict[str, dict] = {}
    for r in rows:
        q = r["s"]["value"].rsplit("/", 1)[1]
        y = yards.setdefault(q, {"cc": set(), "coord": None, "en": "", "zh": "", "start": None, "end": None, "city": ""})
        y["cc"].add(r["cc"]["value"])
        if "coord" in r and not y["coord"]:
            m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"]["value"], re.I)
            if m:
                y["coord"] = (float(m.group(1)), float(m.group(2)))
        y["en"] = y["en"] or r.get("en", {}).get("value", "")
        y["zh"] = y["zh"] or r.get("zh", {}).get("value", "")
        y["city"] = y["city"] or r.get("city", {}).get("value", "")
        for k in ("start", "end"):
            if k in r:
                v = int(float(r[k]["value"]))
                y[k] = v if y[k] is None else min(y[k], v)
    # 沒有英文標籤的（252 家，多半是德、荷、挪威的小船廠）用其他語言的標籤（qlever_wikidata.FALLBACK_LANGS 的順序）
    names = qlever_wikidata.fallback_names([q for q, y in yards.items() if not y["en"]], "shipyards")
    per_country, closed_country = Counter(), Counter()
    points = []
    for q, y in yards.items():
        iso3s = {c for c in (from_alpha2(cc) for cc in y["cc"]) if c}
        for c in iso3s:
            per_country[c] += 1
            if y["end"] is not None:
                closed_country[c] += 1
        if not y["coord"]:
            continue
        points.append({"lon": round(y["coord"][0], 3), "lat": round(y["coord"][1], 3), "n": y["en"] or names.get(q) or q, "nz": y["zh"],
                       "a": y["start"], "b": y["end"], "closed": 1 if y["end"] is not None else 0, "city": y["city"],
                       "iso3": min(iso3s) if iso3s else "", "q": q})
    write_json(OUT / "shipyards.json", points_file(
        points, ["lon", "lat", "n", "nz", "a", "b", "closed", "city", "iso3", "q"], {"lon": 0.001, "lat": 0.001, "a": 1, "b": 1, "closed": 1},
        strings=["iso3"]))
    hints = {c: f"Wikidata 有 {n} 家造船廠，其中 {closed_country[c]} 家記了關閉年份" for c, n in per_country.items()}
    hints_en = {c: f"{n} shipyards in Wikidata, {closed_country[c]} with a closing year" for c, n in per_country.items()}
    write_json(OUT / "shipyards-count.json", indicator_file(
        "shipyards", "家", [YEAR], {c: [n] for c, n in sorted(per_country.items())}, hints=hints, hintsEn=hints_en, license="CC0"))
    print(f"  造船廠 {len(yards):,} 家（有座標 {len(points):,}）、記了關閉年份 {sum(1 for y in yards.values() if y['end'] is not None):,}")
    print(f"  各國：{per_country.most_common(16)}；TWN {per_country.get('TWN')} KOR {per_country.get('KOR')}")
    print(f"  台灣：{[(y['zh'] or y['en'], y['start'], y['end']) for y in yards.values() if 'TW' in y['cc']]}")
