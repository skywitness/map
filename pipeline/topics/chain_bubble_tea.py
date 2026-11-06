"""便利商店與連鎖品牌：手搖飲的連鎖品牌（2026-11-06，製作手冊第二十四批 415；步驟 chain-bubble-tea）。

- 資料：OpenStreetMap 經 QLever（sources/osm_qlever.py；ODbL，© OpenStreetMap contributors），2026 年 11 月的快照。
  原本的 9 個品牌走 Overpass（cloud 連不上），這裡改用 QLever：所有 cuisine=bubble_tea 的店，加上 BRANDS 的
  brand:wikidata 但沒標 cuisine 的店（貢茶有些只標成 amenity=cafe）。
- 品牌只依 brand:wikidata 認：OSM 上 12,803 家手搖飲裡有品牌的多半有標（沒標 brand:wikidata、只寫 brand 文字的不到
  一百家，而且多半是小品牌），名稱比對（「CoCo」也是很多別的店名）容易認錯，不用。
- 同一個品牌 25 公尺內的點當成同一家（chain_stores.dedupe）；國家在本地用國界判斷（geoindex.countries_at），
  人口與「人口不到 10 萬不算每百萬人」跟原本的品牌一樣。
- 品牌的國家是 Wikidata 的 P17（2026-11-06 用 QLever 查）：CoCo都可、貢茶、50嵐、清心福全、日出茶太是台灣，
  霸王茶姬是中國；喜茶在 Wikidata 沒有 P17，不寫。
- 沒有公司公布的店數可以比（原本 9 個品牌的 sources/chain_official.py），只有 OSM 上的店數；OSM 遠少於實際的店數
  （中國的手搖飲店 OSM 上標得很少），寫在說明。
- 輸出跟原本的品牌同一種格式（stores/、density/、points/<品牌>.json），並把店數加進 countries/<國家>.json 的 brands
  （側欄用）。chain-stores 步驟重跑時會蓋掉 countries/，所以它最後也呼叫這裡的 build()。
"""
from __future__ import annotations

import json
from collections import Counter
from typing import NamedTuple

from common import OUT_DIR, indicator_file, write_json
from geoindex import countries_at
from sources import osm_qlever, wpp
from sources.countries import ISO3
from topics.chain_stores import MIN_POPULATION, dedupe, store_points

OUT = OUT_DIR / "topics" / "chain-stores"
YEAR = 2026
SNAPSHOT = "2026-11-06"

# (品牌 id, brand:wikidata, 中文名, 英文名)；id 跟前端 chain-stores.ts 的 BUBBLE_TEA 一樣
BRANDS = [
    ("coco", "Q65084369", "CoCo都可", "CoCo Fresh Tea & Juice"),
    ("gong-cha", "Q5581670", "貢茶", "Gong Cha"),
    ("heytea", "Q60875376", "喜茶", "HEYTEA"),
    ("50-lan", "Q106926258", "50嵐", "50 Lan"),
    ("ching-shin", "Q10391229", "清心福全", "Ching Shin"),
    ("chagee", "Q125052867", "霸王茶姬", "Chagee"),
    ("chatime", "Q16829306", "日出茶太", "Chatime"),
]
WD = "<https://www.openstreetmap.org/wiki/Key:brand:wikidata>"


class Shop(NamedTuple):
    osm_id: str
    lon: float
    lat: float


def _features() -> dict[str, list[Shop]]:
    """{品牌 id: [店]}：cuisine=bubble_tea 的店與 BRANDS 的 brand:wikidata 的店，同一個 OSM 物件只算一次"""
    rows = osm_qlever.query(f"""SELECT ?x ?wkt ?bw WHERE {{
  ?x osmkey:cuisine "bubble_tea" ; geo:hasGeometry/geo:asWKT ?wkt .
  OPTIONAL {{ ?x {WD} ?bw }}
}}""", "bubble-tea-brands")
    values = " ".join(f'"{q}"' for _, q, _, _ in BRANDS)
    rows += osm_qlever.query(f"""SELECT ?x ?wkt ?bw WHERE {{
  VALUES ?bw {{ {values} }}
  ?x {WD} ?bw ; geo:hasGeometry/geo:asWKT ?wkt .
}}""", "bubble-tea-brand-qids")
    by_qid = {q: b for b, q, _, _ in BRANDS}
    seen: dict[str, tuple[str, Shop]] = {}
    for r in rows:
        brand = by_qid.get(r.get("bw", {}).get("value", "").strip())
        osm = r["x"]["value"].replace("https://www.openstreetmap.org/", "")
        if not brand or osm in seen:
            continue
        point = osm_qlever.centroid(r["wkt"]["value"])
        if point:
            seen[osm] = (brand, Shop(osm, point[0], point[1]))
    out: dict[str, list[Shop]] = {b: [] for b, *_ in BRANDS}
    for brand, shop in seen.values():
        out[brand].append(shop)
    return out


def build() -> None:
    raw = _features()
    stores: dict[str, list[Shop]] = {}
    for b, _, zh, _ in BRANDS:
        kept, dropped = dedupe([(s, False, False) for s in raw[b]])
        stores[b] = kept
        print(f"  {zh}：{len(raw[b])} 個物件 → 合併重複後 {len(kept)} 家（拿掉 {dropped}）")
    every = [s for b in stores.values() for s in b]
    located = dict(zip((s.osm_id for s in every), countries_at([s.lon for s in every], [s.lat for s in every])))

    wpp_pop = wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"]
    population = {a: s[YEAR] * 1000 for a, s in wpp_pop.items() if YEAR in s and a in ISO3}
    world_pop = wpp_pop["WLD"][YEAR] * 1000
    rated = {a: p for a, p in population.items() if p >= MIN_POPULATION}

    counts: dict[str, Counter] = {}
    for b, _, zh, _ in BRANDS:
        c = Counter(located[s.osm_id] for s in stores[b] if located[s.osm_id])
        counts[b] = c
        world = sum(c.values())
        extra = {"snapshot": SNAPSHOT}
        write_json(OUT / "stores" / f"{b}.json", indicator_file(
            "stores", "家", [YEAR], {a: [c.get(a, 0)] for a in population}, aggregates={"WLD": [world]}, **extra,
        ), quiet=True)
        write_json(OUT / "density" / f"{b}.json", indicator_file(
            "density", "家/百萬人", [YEAR], {a: [round(c.get(a, 0) / p * 1e6, 3)] for a, p in rated.items()},
            aggregates={"WLD": [round(world / world_pop * 1e6, 3)]}, **extra,
        ), quiet=True)
        write_json(OUT / "points" / f"{b}.json", store_points(stores[b]))
        dens = sorted(((round(c[a] / rated[a] * 1e6, 1), a) for a in c if a in rated), reverse=True)[:6]
        print(f"  {zh}：{world} 家、{len(c)} 國；最多 {c.most_common(6)}；每百萬人 {dens}")

    # 側欄：把店數加進 countries/<國家>.json 的 brands（chain-stores 步驟寫的）；沒有那一國的檔就新建
    ids = {b for b, *_ in BRANDS}
    for iso3 in sorted({a for c in counts.values() for a in c} | {p.stem for p in (OUT / "countries").glob("*.json")}):
        path = OUT / "countries" / f"{iso3}.json"
        detail = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
        mine = {b: counts[b][iso3] for b, *_ in BRANDS if counts[b].get(iso3)}
        if detail is None:
            if not mine or iso3 not in population:
                continue
            detail = {"snapshot": SNAPSHOT, "population": round(population[iso3]), "brands": {}, "official": []}
        brands = {k: v for k, v in detail.get("brands", {}).items() if k not in ids}
        if brands == detail.get("brands", {}) and not mine:
            continue
        detail["brands"] = brands | mine
        write_json(path, detail, quiet=True)
