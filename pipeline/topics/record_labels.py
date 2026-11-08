"""新主題「唱片公司與錄音室在哪裡」（2026-11-08，製作手冊第二十七批 664，候選 1453、1454；步驟 record-labels，
輸出 topics/record-labels/）。

- 唱片公司：Wikidata（CC0）經 QLever，P31（含子類別）是唱片公司 Q18127 的項目；國家 P17；座標用自己的 P625，沒有的用總部
  P159 的 P625；成立 P571、解散 P576（解散的另一色、國家的家數不算）；母公司 P749（大集團的子廠牌各算一家，說明寫明）。
  IFPI 與 CISAC 的市場數字不准轉載，所以只做「公司在哪裡」。Wikidata 的收錄偏歐美與獨立小廠（挪威特別多）。
- 錄音室與攝影棚：OpenStreetMap（ODbL 1.0）經 QLever，`studio=audio`（錄音室）、`radio`（廣播）、`television`（電視）、
  `video`（影片）；`amenity=studio` 很多國家拿去標攝影館、舞蹈教室，所以照手冊只用有 `studio=*` 子標籤的。
- 國家的值：唱片公司家數（比例圓）、每百萬人（面量圖，WPP 2024；人口不到 100 萬的不畫）、四種錄音室與攝影棚的處數（子項目）。
"""
from __future__ import annotations

import re
from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import osm_qlever, qlever_wikidata, wpp
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "record-labels"
YEAR = 2026
MIN_POP = 1000  # 千人
STUDIOS = ("audio", "radio", "television", "video")


def _year(v: str | None) -> int | None:
    m = re.match(r"(-?\d{4})", v or "")
    return int(m.group(1)) if m else None


def labels() -> None:
    rows = qlever_wikidata.cached("record-labels", """
SELECT ?s ?iso ?coord ?hq ?inc ?end ?parentEn ?en ?zhtw ?zhhant ?zh WHERE {
  ?s wdt:P31/wdt:P279* wd:Q18127 .
  OPTIONAL { ?s wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?s wdt:P625 ?coord }
  OPTIONAL { ?s wdt:P159 ?h . ?h wdt:P625 ?hq }
  OPTIONAL { ?s wdt:P571 ?inc }
  OPTIONAL { ?s wdt:P576 ?end }
  OPTIONAL { ?s wdt:P749 ?parent . ?parent rdfs:label ?parentEn FILTER(LANG(?parentEn) = "en") }
  OPTIONAL { ?s rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?s rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?s rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?s rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}""")
    items: dict[str, dict] = {}
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("s").rsplit("/", 1)[1]
        d = items.setdefault(q, {"iso": set(), "coord": None, "hq": None, "inc": None, "end": None, "parent": None,
                                 "en": v("en"), "zh": wikidata_zh(v("zhtw") or v("zhhant"), v("zh"), terms=False)})
        if v("iso"):
            d["iso"].add(v("iso"))
        for k in ("coord", "hq"):
            if v(k) and not d[k]:
                d[k] = v(k)
        for k in ("inc", "end"):
            y = _year(v(k))
            if y and (d[k] is None or y < d[k]):
                d[k] = y
        if v("parentEn") and not d["parent"]:
            d["parent"] = v("parentEn")
    counts: Counter = Counter()
    points = []
    for q, d in items.items():
        if not d["en"] and not d["zh"]:
            continue
        for iso in d["iso"]:
            if not d["end"]:
                counts[iso] += 1
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", d["coord"] or d["hq"] or "", re.I)
        if not m or not d["iso"]:
            continue
        points.append({"lon": round(float(m.group(1)), 4), "lat": round(float(m.group(2)), 4), "k": 2 if d["end"] else 1,
                       "iso3": sorted(d["iso"])[0], "y": d["inc"], "end": d["end"], "en": d["en"] or q, "zh": d["zh"], "parent": d["parent"]})
    points.sort(key=lambda p: (p["k"], p["iso3"], p["en"]))
    write_points(OUT / "labels.json", points_file(points, ["lon", "lat", "k", "iso3", "y", "end", "en", "zh", "parent"],
                                                  {"lon": 0.0001, "lat": 0.0001, "k": 1, "y": 1, "end": 1}, strings=("iso3",)),
                 ("en", "zh", "parent"))
    write_json(OUT / "labels-count.json", indicator_file("labels-count", "家", [YEAR], {c: [v] for c, v in sorted(counts.items())},
                                                         license="CC0"))
    pop = {c: s[2024] for c, s in wpp.demographic(["TPopulation1July"], last_year=2024)["TPopulation1July"].items() if s.get(2024)}
    per = {c: [round(v / (pop[c] * 1000) * 1e6, 2)] for c, v in sorted(counts.items()) if pop.get(c, 0) >= MIN_POP}
    nv = {c: "人口不到 100 萬，一兩家就差很多，不畫" for c in counts if c in pop and pop[c] < MIN_POP}
    nv_en = {c: "Population under 1 million, too small for a stable rate, so not shown" for c in nv}
    write_json(OUT / "labels-per.json", indicator_file("labels-per", "家/百萬人", [YEAR], per, license="CC0", noValue=nv, noValueEn=nv_en))
    alive = sum(1 for d in items.values() if not d["end"])
    subs = sum(1 for d in items.values() if d["parent"] and not d["end"])
    print(f"  唱片公司：{len(items):,} 家（已解散 {len(items) - alive:,}；還在的有母公司的 {subs:,}），有國家而且沒解散的 "
          f"{sum(counts.values()):,}、{len(counts)} 國；點 {len(points):,}（已解散 {sum(1 for p in points if p['k'] == 2)}）")
    print(f"    最多：{counts.most_common(18)}；台灣 {counts.get('TWN')}（點 {sum(1 for p in points if p['iso3'] == 'TWN')}）")
    r = sorted(per.items(), key=lambda kv: -kv[1][0])
    print("    每百萬人：" + "、".join(f"{c} {v[0]}" for c, v in r[:12]) + " … "
          + "、".join(f"{c} {per[c][0]}" for c in ("TWN", "JPN", "USA", "KOR", "GBR", "DEU", "CHN") if c in per))


def studios() -> None:
    rows = []
    for k, value in enumerate(STUDIOS, 1):
        n = osm_qlever.counts("studio", value)
        write_json(OUT / "studios" / f"{value}.json", indicator_file(f"studios-{value}", "處", [YEAR], {c: [v] for c, v in sorted(n.items())},
                                                                     license="ODbL 1.0"))
        seen = set()
        for r in osm_qlever.features("studio", value, ("name", "name:zh", "name:en")):
            if r["osm"] in seen or not r["iso3"]:
                continue
            c = osm_qlever.centroid(r["wkt"])
            if not c:
                continue
            seen.add(r["osm"])
            rows.append({"lon": round(c[0], 4), "lat": round(c[1], 4), "k": k, "iso3": r["iso3"], "n": r["name"] or None,
                         "nz": r["name:zh"] or None, "ne": r["name:en"] or None})
        top = sorted(n.items(), key=lambda kv: -kv[1])
        print(f"  studio={value}：{sum(n.values()):,} 處、{len(n)} 國；" + "、".join(f"{c} {v}" for c, v in top[:12]) + f"；台灣 {n.get('TWN')}；點 {len(seen):,}")
    rows.sort(key=lambda p: (p["k"], p["iso3"], p["lon"]))
    write_points(OUT / "studios.json", points_file(rows, ["lon", "lat", "k", "iso3", "n", "nz", "ne"], {"lon": 0.0001, "lat": 0.0001, "k": 1},
                                                   strings=("iso3",)), ("n", "nz", "ne"))
    print(f"    點 {len(rows):,}（有名稱 {sum(1 for r in rows if r['n'])}）")


def build() -> None:
    labels()
    studios()
