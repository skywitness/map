"""山口與越嶺點（新主題，2026-11-07，製作手冊第二十七批 546，候選 1231；步驟 mountain-passes，輸出 topics/mountain-passes/）。

資料：Wikidata（CC0，經 QLever）P31/P279* = Q133056（mountain pass）：24,641 個項目、23,790 個有座標（一個座標不是點）、
6,641 個有海拔（P2044，用 psn: 換成公尺的正規化值；同一個山口寫了好幾個海拔的取最高的）。國家依座標判斷（geoindex），
找不到時用 P17。

手冊的建議：Wikidata 的覆蓋極不平均（韓國與北韓是大量匯入的小地名、瑞士是當地編者勤勞），所以國家只用「最高的山口」
上色，數量只當點的密度、不做成指標。邊界上的山口（聖母峰的南坳在中國與尼泊爾的邊界上）依座標歸到一國，說明寫明。
輸出 passes.json（點，k 是顏色的分級）、highest.json（各國最高的山口，公尺；hints 是名稱）。
"""
from __future__ import annotations

import re
from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json
from geoindex import countries_at
from sources import qlever_wikidata
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "mountain-passes"
YEAR = 2026
QUERY = qlever_wikidata.PREFIXES + "PREFIX psn: <http://www.wikidata.org/prop/statement/value-normalized/>\n" + """SELECT ?item ?wkt ?elev ?iso ?sl ?en ?mul ?zhtw ?zhhant ?zh ?enwiki ?zhwiki WHERE {
  ?item wdt:P31/wdt:P279* wd:Q133056 ; wikibase:sitelinks ?sl .
  OPTIONAL { ?item wdt:P625 ?coord . BIND(STR(?coord) AS ?wkt) }
  OPTIONAL { ?item p:P2044/psn:P2044/wikibase:quantityAmount ?elev }
  OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
  OPTIONAL { ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?zhwiki schema:about ?item ; schema:isPartOf <https://zh.wikipedia.org/> }
}"""
MAX_M = 9000  # 比這高的海拔是寫錯的（地球上沒有）


def build() -> None:
    items: dict[str, dict] = {}
    for r in qlever_wikidata.cached("mountain-passes", QUERY):
        q = r["item"]["value"].rsplit("/", 1)[1]
        d = items.setdefault(q, {"q": q, "sl": int(r["sl"]["value"]), "elev": set(), "w": 0})
        for k in ("wkt", "iso", "en", "mul", "zhtw", "zhhant", "zh"):
            if k in r and k not in d:
                d[k] = r[k]["value"]
        if "elev" in r and -500 < float(r["elev"]["value"]) < MAX_M:
            d["elev"].add(float(r["elev"]["value"]))
        if "enwiki" in r or "zhwiki" in r:
            d["w"] = 1
    names = qlever_wikidata.fallback_names(sorted(q for q, d in items.items() if not (d.get("en") or d.get("mul"))),
                                           "mountain-passes")
    rows = []
    for d in items.values():
        m = re.match(r"(?i)POINT\(([-\d.eE]+) ([-\d.eE]+)\)", d.get("wkt", ""))
        if not m:
            continue
        en = d.get("en") or d.get("mul") or names.get(d["q"])
        zh = wikidata_zh(d.get("zhtw") or d.get("zhhant"), d.get("zh"), place=True)
        if not (en or zh):
            continue
        rows.append({"lon": round(float(m.group(1)), 4), "lat": round(float(m.group(2)), 4), "q": d["q"],
                     "e": round(max(d["elev"])) if d["elev"] else None, "sl": d["sl"], "w": d["w"],
                     "en": en, "zh": zh if zh and zh != en else None, "p17": d.get("iso")})
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3 or r["p17"]
        # 點的顏色：0 沒有海拔、1 2,000 公尺以下、2 2,000–3,999、3 4,000 以上
        r["k"] = 0 if r["e"] is None else 1 if r["e"] < 2000 else 2 if r["e"] < 4000 else 3
    rows.sort(key=lambda r: r["lon"])
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "passes.json", points_file(rows, ["lon", "lat", "e", "k", "sl", "w", "iso3", "en", "zh"],
                                                {"lon": 0.0001, "lat": 0.0001}, delta=("lon",), strings=("iso3",)))
    best: dict[str, dict] = {}
    for r in rows:
        if r["iso3"] and r["e"] is not None and (r["iso3"] not in best or r["e"] > best[r["iso3"]]["e"]):
            best[r["iso3"]] = r
    hints = {c: (r["zh"] or r["en"]) for c, r in best.items()}
    hints_en = {c: (r["en"] or r["zh"]) for c, r in best.items()}
    write_json(OUT / "highest.json", indicator_file("highest", "m", [YEAR], {c: [r["e"]] for c, r in sorted(best.items())},
                                                    hints=hints, hintsEn=hints_en, license="CC0"))

    counts = Counter(r["iso3"] for r in rows if r["iso3"])
    print(f"  {len(items)} 個項目、畫出 {len(rows)} 個；有海拔的 {sum(1 for r in rows if r['e'] is not None)} 個；"
          f"有英文或中文條目的 {sum(r['w'] for r in rows)} 個；{len(best)} 國有最高的山口")
    print("  各國的數量：" + "、".join(f"{c} {n}" for c, n in counts.most_common(14)))
    top = sorted(best.values(), key=lambda r: -r["e"])[:14]
    print("  最高：" + "、".join(f"{r['iso3']} {r['en'] or r['zh']} {r['e']}" for r in top))
    tw = sorted((r for r in rows if r["iso3"] == "TWN"), key=lambda r: -(r["e"] or 0))
    print(f"  台灣 {len(tw)}：" + "、".join(f"{r['zh'] or r['en']} {r['e']}" for r in tw))
