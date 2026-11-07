"""有名字的人工島（2026-11-07，製作手冊第二十七批 545，候選 1232；擴充「填海造陸」；步驟 artificial-islands，
輸出到 topics/reclamation/）。

資料：Wikidata（CC0，經 QLever）P31 是人工島（Q13691）或它的子類別的項目：克蘭諾格（crannog，Q91759，蘇格蘭、
愛爾蘭史前到中世紀的湖上人工島）、人工島機場（Q28692646）、日本的海堡、能源島、圩田島等。418 個、403 個有座標。
國家依座標判斷（geoindex），找不到時用 P17。

點的顏色（c）：1 克蘭諾格；2 人工島機場；其他依建成年份 P571：3 1900 年以前、4 1900–1999、5 2000 年以後、6 不知道。
索羅門群島的 49 個是馬萊塔島沿岸潟湖裡用珊瑚石堆成的傳統聚落，Wikidata 沒有建成年份，畫成「不知道」，說明寫明。
輸出 islands.json（點）、islands-count.json（各國有幾個）。
"""
from __future__ import annotations

import re
from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json
from geoindex import countries_at
from sources import qlever_wikidata
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "reclamation"
YEAR = 2026
CRANNOG, AIRPORT = "Q91759", "Q28692646"
QUERY = """SELECT ?item ?cls ?wkt ?iso ?inc ?sl ?en ?mul ?zhtw ?zhhant ?zh WHERE {
  ?item wdt:P31 ?cls . ?cls wdt:P279* wd:Q13691 .
  ?item wikibase:sitelinks ?sl .
  OPTIONAL { ?item wdt:P625 ?coord . BIND(STR(?coord) AS ?wkt) }
  OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?item wdt:P571 ?inc }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}"""


def _v(r: dict, k: str) -> str | None:
    return r.get(k, {}).get("value")


def _year(t: str | None) -> int | None:
    m = re.match(r"^(-?\d+)-", t or "")
    return int(m.group(1)) if m else None


def build() -> None:
    items: dict[str, dict] = {}
    for r in qlever_wikidata.cached("artificial-islands", QUERY):
        q = r["item"]["value"].rsplit("/", 1)[1]
        d = items.setdefault(q, {"q": q, "sl": int(r["sl"]["value"]), "cls": set(), "years": set()})
        d["cls"].add(r["cls"]["value"].rsplit("/", 1)[1])
        if _v(r, "inc") and _year(_v(r, "inc")) is not None:
            d["years"].add(_year(_v(r, "inc")))
        m = re.match(r"(?i)POINT\(([-\d.eE]+) ([-\d.eE]+)\)", _v(r, "wkt") or "")
        if m and "lon" not in d:
            d["lon"], d["lat"] = float(m.group(1)), float(m.group(2))
        for k in ("iso", "en", "mul", "zhtw", "zhhant", "zh"):
            if _v(r, k) and not d.get(k):
                d[k] = _v(r, k)
    names = qlever_wikidata.fallback_names(sorted(q for q, d in items.items() if not (d.get("en") or d.get("mul"))),
                                           "artificial-islands")
    rows = []
    for d in items.values():
        if "lon" not in d:
            continue
        year = min(d["years"]) if d["years"] else None
        if CRANNOG in d["cls"]:
            c = 1
        elif AIRPORT in d["cls"]:
            c = 2
        elif year is None:
            c = 6
        else:
            c = 3 if year < 1900 else 4 if year < 2000 else 5
        en = d.get("en") or d.get("mul") or names.get(d["q"])
        zh = wikidata_zh(d.get("zhtw") or d.get("zhhant"), d.get("zh"), place=True)
        rows.append({"lon": round(d["lon"], 4), "lat": round(d["lat"], 4), "q": d["q"], "c": c, "y": year, "sl": d["sl"],
                     "en": en, "zh": zh if zh and zh != en else None, "p17": d.get("iso")})
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3 or r["p17"]
    rows.sort(key=lambda r: (r["lon"]))
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "islands.json", points_file(rows, ["lon", "lat", "q", "c", "y", "sl", "iso3", "en", "zh"],
                                                 {"lon": 0.0001, "lat": 0.0001}, delta=("lon",), strings=("iso3",)))
    counts = Counter(r["iso3"] for r in rows if r["iso3"])
    write_json(OUT / "islands-count.json", indicator_file("islands-count", "個", [YEAR],
                                                          {c: [n] for c, n in sorted(counts.items())}, license="CC0"))
    print(f"  {len(items)} 個項目、{len(rows)} 個有座標；各類：{dict(sorted(Counter(r['c'] for r in rows).items()))}")
    print("  各國：" + "、".join(f"{c} {n}" for c, n in counts.most_common(16)))
    print("  有建成年份的最早與最晚：" + "、".join(f"{r['en']} {r['y']}" for r in sorted((r for r in rows if r["y"] is not None), key=lambda r: r["y"])[:3])
          + " … " + "、".join(f"{r['en']} {r['y']}" for r in sorted((r for r in rows if r["y"] is not None), key=lambda r: r["y"])[-4:]))
    print(f"  台灣：{[r['zh'] or r['en'] for r in rows if r['iso3'] == 'TWN']}")
    print(f"  阿聯：{[(r['en'], r['y']) for r in rows if r['iso3'] == 'ARE']}")
