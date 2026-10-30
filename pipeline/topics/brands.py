"""品牌的發源地（新主題，經濟類，2026-10-30，製作手冊第六批 112，候選 635、636）：時尚品牌與汽車品牌。

使用者決定：兩項合併成一個主題（子項目「時尚品牌」「汽車品牌」），只收現存、有維基百科條目的品牌。

- 資料：Wikidata（CC0）的 SPARQL：
  - 時尚：類別 fashion label（Q1618899）、fashion house（Q1941779）、clothing brand（Q133459332），
    或產業（P452）是時尚（Q12684）、成衣業（Q11828862）、高級訂製服（Q216053）。
  - 汽車：汽車製造商（Q786820）、汽車品牌（Q10429667）。
  - 都要：沒有停業日期（P576）、至少一種語言的維基百科有條目。「現存」只能這樣判斷：Wikidata 常常沒有填停業日期，
    早年的小車廠會被當成現存，說明寫明。
- 國家：以創立地為準（使用者的手冊寫「國籍以創立地為準」）。創立地（P740）有座標時用座標所在的國家（`countries_at`，
  德意志帝國這種歷史國家也能歸到今天的國家）；沒有的用原產國（P495）、國家（P17）的 ISO 代碼，再沒有用總部（P159）的座標。
- 點：創立地的座標，沒有的用總部的座標；都沒有的只算在國家的品牌數裡。大小依維基百科的語言數（有名的程度），
  顏色依創立年份（1900 年以前、1900–1949、1950–1999、2000 年以後、不詳）。
- 輸出 public/data/topics/companies/（2026-10-30 起跟最古老的公司同一個主題）：count/{item}.json（各國品牌數，一年 2026，timeless）、points/{item}.json、
  list/{item}.json（側欄：每個品牌 [語言數, 英文名, 中文名, 創立年份, 國家]，依語言數排）。
"""
from __future__ import annotations

import json
import re
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, indicator_file, points_file, write_json, write_manifest_part
from geoindex import countries_at
from sources.wikidata_attractions import _sparql

OUT = OUT_DIR / "topics" / "companies"  # 企業與品牌（2026-10-30 最古老的公司、品牌的發源地合併）
YEAR = 2026
KINDS = {
    "fashion": ("{ VALUES ?cls { wd:Q1618899 wd:Q1941779 wd:Q133459332 } ?item wdt:P31 ?cls . } UNION "
                "{ VALUES ?ind { wd:Q12684 wd:Q11828862 wd:Q216053 } ?item wdt:P452 ?ind . }"),
    "cars": "{ VALUES ?cls { wd:Q786820 wd:Q10429667 } ?item wdt:P31 ?cls . }",
}
QUERY = """SELECT ?item ?links ?pcoord ?hcoord ?oiso ?ciso ?inc ?en ?zhtw ?zhhant ?zh WHERE {{
  {classes}
  FILTER NOT EXISTS {{ ?item wdt:P576 [] }}
  ?item wikibase:sitelinks ?links .
  FILTER EXISTS {{ ?a schema:about ?item ; schema:isPartOf/wikibase:wikiGroup "wikipedia" . }}
  OPTIONAL {{ ?item wdt:P740/wdt:P625 ?pcoord }}
  OPTIONAL {{ ?item wdt:P159/wdt:P625 ?hcoord }}
  OPTIONAL {{ ?item wdt:P495/wdt:P298 ?oiso }}
  OPTIONAL {{ ?item wdt:P17/wdt:P298 ?ciso }}
  OPTIONAL {{ ?item wdt:P571 ?inc }}
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
}}"""


def _point(v: str | None) -> tuple[float, float] | None:
    m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", v or "")
    return (float(m.group(1)), float(m.group(2))) if m else None


def _items(kind: str) -> dict[str, dict]:
    path = CACHE_DIR / "wikidata" / f"brands-{kind}.json"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(_sparql(QUERY.format(classes=KINDS[kind]))), encoding="utf-8")
    items: dict[str, dict] = {}
    for r in json.loads(path.read_text(encoding="utf-8")):
        qid = r["item"]["value"].rsplit("/", 1)[-1]
        d = items.setdefault(qid, defaultdict(list))
        for k, v in r.items():
            if v["value"] not in d[k]:
                d[k].append(v["value"])
    return items


def build() -> None:
    from opencc import OpenCC

    s2tw, s2twp = OpenCC("s2tw"), OpenCC("s2twp")

    def zh_name(d: dict, en: str) -> str | None:
        zh = (d.get("zhtw") or d.get("zhhant") or [None])[0]
        zh = s2tw.convert(zh) if zh else (s2twp.convert(d["zh"][0]) if d.get("zh") else None)
        return zh if zh and zh != en else None

    manifest = {}
    for kind in KINDS:
        items = _items(kind)
        brands = []
        for qid, d in items.items():
            en = (d.get("en") or [qid])[0]
            place = next((p for v in d.get("pcoord", []) if (p := _point(v))), None)
            hq = next((p for v in d.get("hcoord", []) if (p := _point(v))), None)
            years = [int(m.group(1)) for v in d.get("inc", []) if (m := re.match(r"(-?\d{4})-", v))]
            brands.append({"qid": qid, "en": en, "zh": zh_name(d, en), "links": int(d["links"][0]),
                           "place": place, "hq": hq, "y": min(years) if years else None,
                           "iso_o": sorted(d.get("oiso", [])), "iso_c": sorted(d.get("ciso", []))})
        located = [b for b in brands if b["place"] or b["hq"]]
        at_place = countries_at([b["place"][0] for b in brands if b["place"]], [b["place"][1] for b in brands if b["place"]])
        at_hq = countries_at([b["hq"][0] for b in brands if b["hq"]], [b["hq"][1] for b in brands if b["hq"]])
        it_place, it_hq = iter(at_place), iter(at_hq)
        how = defaultdict(int)
        for b in brands:
            p = next(it_place) if b["place"] else None
            h = next(it_hq) if b["hq"] else None
            single = lambda xs: xs[0] if len(xs) == 1 else None  # noqa: E731
            for source, iso3 in (("place", p), ("origin", single(b["iso_o"])), ("country", single(b["iso_c"])), ("hq", h)):
                if iso3:
                    b["iso3"] = iso3
                    how[source] += 1
                    break
            else:
                b["iso3"] = None
                how["none"] += 1
        counts: dict[str, int] = defaultdict(int)
        for b in brands:
            if b["iso3"]:
                counts[b["iso3"]] += 1
        write_json(OUT / "count" / f"{kind}.json", indicator_file(
            f"count/{kind}", "個", [YEAR], {c: [n] for c, n in sorted(counts.items())},
            aggregates={"WLD": [sum(counts.values())]}))
        rows = []
        for b in sorted(located, key=lambda b: -b["links"]):
            lon, lat = b["place"] or b["hq"]
            rows.append({"lon": round(lon, 3), "lat": round(lat, 3), "w": b["links"], "y": b["y"] or 0,
                         "iso3": b["iso3"], "en": b["en"], "zh": b["zh"]})
        write_json(OUT / "points" / f"{kind}.json", points_file(
            rows, ["lon", "lat", "w", "y", "iso3", "en", "zh"], {"lon": 0.001, "lat": 0.001, "w": 1, "y": 1},
            strings=("iso3",)))
        listing = [[b["links"], b["en"], b["zh"], b["y"], b["iso3"]]
                   for b in sorted(brands, key=lambda b: (-b["links"], b["en"])) if b["iso3"]]
        write_json(OUT / "list" / f"{kind}.json", {"fields": ["links", "en", "zh", "year", "iso3"], "rows": listing})
        top = sorted(counts.items(), key=lambda kv: -kv[1])[:8]
        tw = [b["zh"] or b["en"] for b in brands if b["iso3"] == "TWN"]
        print(f"  {kind}：{len(brands)} 個品牌，國家依 {dict(how)}；點 {len(rows)} 個；前幾名 {top}；台灣 {tw}")
        manifest[kind] = {"brands": len(brands), "points": len(rows)}
    write_manifest_part(OUT, "companies", "brands", {"source": "Wikidata (CC0)", **manifest})
