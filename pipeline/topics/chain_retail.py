"""便利商店與連鎖品牌：超市連鎖、藥妝店與連鎖藥局（2026-11-07，製作手冊第二十五批 466，合併候選 1112、1113；
步驟 chain-retail，輸出 topics/chain-stores/）。

- 資料：OpenStreetMap 經 QLever（sources/osm_qlever.py；ODbL，© OpenStreetMap contributors），2026 年 11 月的快照。
  兩支查詢（各一個 TSV 匯出，用 QLever 的 geof:centroid 算中心點，不必下載多邊形）：所有有 brand:wikidata 的
  shop=supermarket（23 萬個物件），與有 brand:wikidata 的 shop=chemist 或 amenity=pharmacy（10 萬個；各國用法不一，
  日本的松本清標成 pharmacy、台灣的屈臣氏標成 chemist，所以兩個一起撈再依品牌合併）。
- 只依 brand:wikidata 認品牌（Aldi、ALDI、Aldi Nord 這類文字值碎成好幾個，QID 才可靠）；同一個品牌 25 公尺內的點當成
  同一家（chain_stores.dedupe，CVS 常常同一家店標了 chemist 與 pharmacy 兩個點）；國家在本地用國界判斷。
- FEATURED 的品牌輸出跟原本的品牌同一種格式（stores/、density/、points/<品牌>.json），店數加進 countries/<國家>.json
  的 brands（側欄）。
- largest/<supermarket|drugstore|fuel|bank|mobile|car>.json：這一國 OSM 上店最多的品牌是本地（1）、外來（2）還是跨國加盟或
  不明（3）（第二十五批 467 加加油站、銀行分行、電信門市、汽車經銷）；品牌的國籍用 Wikidata 總部所在地（P159）的國家，沒有的用品牌的國家（P17），只有一個值才用；P159 在香港的
  Wikidata 會給中國，ORIGIN 手動改成香港，加上幾個 Wikidata 沒寫的（家樂福、Albert Heijn…）。最大的品牌 10 家以上的國家才畫，
  hints 寫前三名。
- OSM 不是官方店數，各國標得完不完整差很多（說明寫明）。資料檔是 OSM 的衍生資料庫，以 ODbL 提供。
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from typing import NamedTuple

from common import OUT_DIR, indicator_file, write_json
from geoindex import countries_at
from sources import osm_qlever, qlever_wikidata, wpp
from sources.countries import ISO3
from topics.chain_stores import MIN_POPULATION, dedupe, store_points

OUT = OUT_DIR / "topics" / "chain-stores"
YEAR = 2026
SNAPSHOT = "2026-11-07"
TOP_MIN = 10
WD = "<https://www.openstreetmap.org/wiki/Key:brand:wikidata>"
GEOF = "PREFIX geof: <http://www.opengis.net/def/function/geosparql/>\n"
QUERIES = {
    "supermarket": GEOF + f'SELECT ?x ?c ?bw WHERE {{ ?x osmkey:shop "supermarket" ; {WD} ?bw ; '
                          'geo:hasGeometry/geo:asWKT ?w . BIND(geof:centroid(?w) AS ?c) }',
    "drugstore": GEOF + f'SELECT ?x ?c ?bw ?k WHERE {{ {{ ?x osmkey:shop "chemist" . BIND("chemist" AS ?k) }} UNION '
                        f'{{ ?x osmkey:amenity "pharmacy" . BIND("pharmacy" AS ?k) }} ?x {WD} ?bw ; '
                        'geo:hasGeometry/geo:asWKT ?w . BIND(geof:centroid(?w) AS ?c) }',
    # 第二十五批 467：加油站、銀行分行、電信門市、汽車經銷（同一種查詢）
    **{kind: GEOF + f'SELECT ?x ?c ?bw WHERE {{ ?x osmkey:{key} "{value}" ; {WD} ?bw ; '
                    'geo:hasGeometry/geo:asWKT ?w . BIND(geof:centroid(?w) AS ?c) }'
       for kind, key, value in (("fuel", "amenity", "fuel"), ("bank", "amenity", "bank"),
                                ("mobile", "shop", "mobile_phone"), ("car", "shop", "car"))},
}

# (id, 種類, brand:wikidata, 中文, 英文)；id 跟前端 chain-stores.ts 的 BRANDS 一樣
FEATURED = [
    ("lidl", "supermarket", ("Q151954",), "Lidl", "Lidl"),
    ("aldi", "supermarket", ("Q41171672", "Q41171373"), "Aldi（南、北兩家）", "Aldi (Süd and Nord)"),
    ("pyaterochka", "supermarket", ("Q1768969",), "Pyaterochka（Пятёрочка）", "Pyaterochka"),
    ("walmart", "supermarket", ("Q483551",), "沃爾瑪", "Walmart"),
    ("carrefour", "supermarket", ("Q217599", "Q2689639", "Q3117359"), "家樂福", "Carrefour"),
    ("spar", "supermarket", ("Q610492",), "SPAR", "SPAR"),
    ("pxmart", "supermarket", ("Q7262792",), "全聯福利中心", "PX Mart"),
    ("simple-mart", "supermarket", ("Q15914017",), "美廉社", "Simple Mart"),
    ("watsons", "drugstore", ("Q7974785",), "屈臣氏", "Watsons"),
    ("walgreens", "drugstore", ("Q1591889",), "Walgreens", "Walgreens"),
    ("cvs", "drugstore", ("Q2078880",), "CVS", "CVS Pharmacy"),
    ("rossmann", "drugstore", ("Q316004",), "Rossmann", "Rossmann"),
    ("dm", "drugstore", ("Q266572",), "dm", "dm-drogerie markt"),
    ("boots", "drugstore", ("Q6123139",), "Boots", "Boots"),
    ("matsukiyo", "drugstore", ("Q8014776",), "松本清", "Matsumoto Kiyoshi"),
    ("cosmed", "drugstore", ("Q11063876",), "康是美", "Cosmed"),
    ("poya", "drugstore", ("Q15927734",), "寶雅", "Poya"),
    # 第二十五批 467：加油站。Shell 有品牌與公司兩個 QID；ExxonMobil 的 Esso、Exxon、Mobil 三個招牌合在一起（母公司）
    ("shell", "fuel", ("Q110716465", "Q154950"), "殼牌（Shell）", "Shell"),
    ("bp", "fuel", ("Q152057",), "BP", "BP"),
    ("exxonmobil", "fuel", ("Q867662", "Q109675651", "Q109676002"), "埃克森美孚（Esso、Exxon、Mobil）", "ExxonMobil (Esso, Exxon, Mobil)"),
    ("totalenergies", "fuel", ("Q154037",), "道達爾（TotalEnergies）", "TotalEnergies"),
    ("cpc", "fuel", ("Q698024",), "台灣中油", "CPC Corporation, Taiwan"),
    ("formosa", "fuel", ("Q1437742",), "台塑石化", "Formosa Petrochemical"),
]
# 品牌的國籍：Wikidata 沒寫、或寫的是中國但總部在香港的（2026-11-07 逐一確認）
ORIGIN = {
    "Q7974785": "HKG",  # 屈臣氏：屈臣氏集團，總部香港
    "Q706247": "HKG",  # 惠康：牛奶公司（Dairy Farm），香港
    "Q13646560": "HKG",  # 萬寧：牛奶公司，香港
    "Q41171672": "DEU",  # Aldi Süd：Mülheim an der Ruhr（Wikidata 的 P159 有兩個）
    "Q217599": "FRA",  # 家樂福
    "Q377705": "ESP",  # Mercadona：瓦倫西亞
    "Q1653985": "NLD",  # Albert Heijn
    "Q18379067": "KEN",  # Naivas
    "Q6818610": "PHL",  # Mercury Drug
    "Q1958759": "DEU",  # Müller：烏爾姆
    # 第二十五批 467
    "Q110716465": "GBR",  # Shell（品牌）：Shell plc，總部倫敦
    "Q111604705": "GRC", "Q111604689": "GRC",  # EKO（賽普勒斯、蒙特內哥羅）：希臘 HELLENiQ ENERGY 的品牌
    "Q2882627": "MAR",  # Bank of Africa：卡薩布蘭加
    "Q806197": "AGO",  # Banco de Fomento Angola
    "Q2084143": "NLD",  # ASN Bank
    "Q4943790": "USA",  # Boost Mobile
    "Q1770208": "MEX",  # Claro：América Móvil，墨西哥
    "Q407009": "HKG",  # 3：長江和記（CK Hutchison），香港
    "Q62393564": "NLD",  # Optie1
}
# Wikidata 標籤怪的（Circle K 在 QLever 的快照只有中文標籤「OK便利店」，那是香港的名字）
NAMES = {"Q3268010": ("Circle K", "Circle K")}
# 跨國加盟（各國由獨立公司經營，不分本國外國）
FRANCHISE = {"Q610492", "Q62562792"}  # SPAR、BENU


class Shop(NamedTuple):
    osm_id: str
    lon: float
    lat: float


def _load(kind: str) -> dict[str, list[Shop]]:
    """{QID: [店]}"""
    path = osm_qlever.export(QUERIES[kind], f"retail-{kind}")
    out: dict[str, list[Shop]] = defaultdict(list)
    with open(path, encoding="utf-8") as f:
        next(f)
        for line in f:
            cols = line.rstrip("\n").split("\t")
            m = re.search(r"POINT\(([-\d.e]+) ([-\d.e]+)\)", cols[1])
            if not m:
                continue
            shop = Shop(cols[0].strip("<>").replace("https://www.openstreetmap.org/", ""), float(m.group(1)), float(m.group(2)))
            for q in cols[2].split("^^")[0].strip('"').split(";"):
                if re.fullmatch(r"Q\d+", q.strip()):
                    out[q.strip()].append(shop)
    return out


def _meta(qids: list[str]) -> dict[str, dict]:
    """{QID: {name, nameEn, origin}}：中文標籤（zh-tw、zh）、英文標籤、總部國家（P159→P17）或品牌國家（P17）"""
    vals = " ".join(f"wd:{q}" for q in sorted(qids))
    rows = qlever_wikidata.cached(f"retail-brands-{len(qids)}-{sorted(qids)[0]}", f"""SELECT ?item ?en ?zh ?zhtw ?hq ?p17 WHERE {{
  VALUES ?item {{ {vals} }}
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item wdt:P159/wdt:P17/wdt:P298 ?hq }}
  OPTIONAL {{ ?item wdt:P17/wdt:P298 ?p17 }}
}}""")
    raw: dict[str, dict] = defaultdict(lambda: {"en": None, "zh": None, "zhtw": None, "hq": set(), "p17": set()})
    for r in rows:
        m = raw[r["item"]["value"].rsplit("/", 1)[1]]
        for k in ("en", "zh", "zhtw"):
            if k in r:
                m[k] = r[k]["value"]
        for k in ("hq", "p17"):
            if k in r:
                m[k].add(r[k]["value"])
    out = {}
    for q in qids:
        m = raw[q]
        origin = ORIGIN.get(q) or (next(iter(m["hq"])) if len(m["hq"]) == 1 else next(iter(m["p17"])) if len(m["p17"]) == 1 else None)
        # 中文名只用在台灣、港澳、中國的品牌（Wikidata 其他品牌的中文標籤常常是直譯，例如 Family Pantry 寫成「家庭餐具室」）
        zh = (m["zhtw"] or m["zh"]) if origin in ("TWN", "HKG", "MAC", "CHN") else None
        name, name_en = NAMES.get(q, (zh or m["en"] or m["zhtw"] or m["zh"] or q, m["en"] or m["zhtw"] or m["zh"] or q))
        out[q] = {"name": name, "nameEn": name_en, "origin": None if q in FRANCHISE else origin}
    return out


def build() -> None:
    wpp_pop = wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"]
    population = {a: s[YEAR] * 1000 for a, s in wpp_pop.items() if YEAR in s and a in ISO3}
    world_pop = wpp_pop["WLD"][YEAR] * 1000
    rated = {a: p for a, p in population.items() if p >= MIN_POPULATION}
    counts_all: dict[str, dict[str, Counter]] = {}
    featured_counts: dict[str, Counter] = {}
    for kind in QUERIES:
        raw = _load(kind)
        kept = {q: dedupe([(s, False, False) for s in shops])[0] for q, shops in raw.items()}
        every = {s.osm_id: s for v in kept.values() for s in v}
        located = dict(zip(every, countries_at([s.lon for s in every.values()], [s.lat for s in every.values()])))
        counts = {q: Counter(located[s.osm_id] for s in v if located[s.osm_id]) for q, v in kept.items()}
        counts_all[kind] = counts
        print(f"  {kind}：{sum(len(v) for v in raw.values())} 個物件、{len(raw)} 個品牌 → 合併重複後 "
              f"{sum(len(v) for v in kept.values())} 家")
        for bid, k, qids, zh, en in FEATURED:
            if k != kind:
                continue
            shops = dedupe([(s, False, False) for q in qids for s in kept.get(q, [])])[0]
            c = Counter(located[s.osm_id] for s in shops if located[s.osm_id])
            featured_counts[bid] = c
            world = sum(c.values())
            extra = {"snapshot": SNAPSHOT}
            write_json(OUT / "stores" / f"{bid}.json", indicator_file(
                "stores", "家", [YEAR], {a: [c.get(a, 0)] for a in population}, aggregates={"WLD": [world]}, **extra), quiet=True)
            write_json(OUT / "density" / f"{bid}.json", indicator_file(
                "density", "家/百萬人", [YEAR], {a: [round(c.get(a, 0) / p * 1e6, 3)] for a, p in rated.items()},
                aggregates={"WLD": [round(world / world_pop * 1e6, 3)]}, **extra), quiet=True)
            write_json(OUT / "points" / f"{bid}.json", store_points(shops))
            dens = sorted(((round(c[a] / rated[a] * 1e6, 1), a) for a in c if a in rated), reverse=True)[:6]
            print(f"    {zh}：{world} 家、{len(c)} 國；最多 {c.most_common(6)}；每百萬人 {dens}")

    # 這一國最大的品牌是本國、外國還是跨國加盟
    for kind, counts in counts_all.items():
        tops: dict[str, list[tuple[int, str]]] = {}
        for iso3 in sorted({a for c in counts.values() for a in c}):
            ranked = sorted(((c[iso3], q) for q, c in counts.items() if c.get(iso3)), reverse=True)
            if ranked and ranked[0][0] >= TOP_MIN:
                tops[iso3] = ranked[:3]
        meta = _meta(sorted({q for r in tops.values() for _, q in r}))
        values, hints, hints_en, tally = {}, {}, {}, Counter()
        for iso3, ranked in tops.items():
            origin = meta[ranked[0][1]]["origin"]
            v = 3 if origin is None else 1 if origin == iso3 else 2
            values[iso3] = [v]
            tally[v] += 1
            hints[iso3] = "、".join(f"{meta[q]['name']} {n:,} 家" for n, q in ranked)
            hints_en[iso3] = ", ".join(f"{meta[q]['nameEn']} {n:,}" for n, q in ranked)
        write_json(OUT / "largest" / f"{kind}.json", indicator_file(
            "largest", "類別", [YEAR], values, hints=hints, hintsEn=hints_en, snapshot=SNAPSHOT), quiet=True)
        foreign = sorted((a, meta[r[0][1]]["name"], meta[r[0][1]]["origin"]) for a, r in tops.items() if values[a][0] == 2)
        print(f"  最大的{kind}：{len(values)} 國，本國 {tally[1]}、外國 {tally[2]}、跨國加盟或不明 {tally[3]}；外國：{foreign}")

    # 側欄：把店數加進 countries/<國家>.json 的 brands（chain-stores 步驟寫的）
    ids = {b for b, *_ in FEATURED}
    for iso3 in sorted({a for c in featured_counts.values() for a in c} | {p.stem for p in (OUT / "countries").glob("*.json")}):
        path = OUT / "countries" / f"{iso3}.json"
        detail = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
        mine = {b: featured_counts[b][iso3] for b in ids if featured_counts[b].get(iso3)}
        if detail is None:
            if not mine or iso3 not in population:
                continue
            detail = {"snapshot": SNAPSHOT, "population": round(population[iso3]), "brands": {}, "official": []}
        brands = {k: v for k, v in detail.get("brands", {}).items() if k not in ids}
        if brands == detail.get("brands", {}) and not mine:
            continue
        detail["brands"] = brands | mine
        write_json(path, detail, quiet=True)
