"""便利商店與連鎖品牌主題：OpenStreetMap 上 9 個連鎖品牌的店家與所有便利商店（ODbL，© OpenStreetMap contributors）。

- 品牌依 `brand:wikidata` 認（name-suggestion-index 的標法），沒有 `brand:wikidata` 的店只在「名稱或 brand 以品牌名稱開頭、
  而且是這個品牌的店型」時才算（例如 amenity=fast_food、名稱「麥當勞 …」），名稱比對只用不會認錯的寫法。
- 同一家店常常標了兩次（建築物外框一個、店的點一個；加油站一個、裡面的便利商店一個）：同一個品牌 25 公尺內的點當成同一家，
  便利商店品牌只標成加油站（amenity=fuel）的，150 公尺內沒有同品牌的便利商店才算一家。
- 國家在本地用國界判斷（geoindex.countries_at，Natural Earth 1:10m），不必對 Overpass 發上百次查詢。
- OSM 不是官方店數：各國標得完不完整差很多，跟公司公布的店數（sources/chain_official.py）比出涵蓋率，寫在附註、tooltip 與側欄。
- 這裡輸出的資料檔都是 OpenStreetMap 的衍生資料庫，以 ODbL 提供（DESIGN.md 第 8 節第 12 點）。
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from typing import NamedTuple

from common import OUT_DIR, indicator_file, now_iso, points_file, write_json
from geoindex import countries_at
from sources import wpp
from sources.chain_official import OFFICIAL
from sources.countries import ISO3

OUT = OUT_DIR / "topics" / "chain-stores"
SAME_STORE_M = 25  # 同一個品牌這個距離內的兩個點當成同一家店
FUEL_STORE_M = 150  # 只標成加油站的便利商店品牌：這個距離內有同品牌的便利商店就不另外算
POINT_QUANTUM = 0.0001  # 店家位置的量化單位（度），約 11 公尺
POOR_COVERAGE = 0.5  # 涵蓋率低於一半時，tooltip 與側欄另外提醒（前端 ChainStoresPanel 的 POOR）
TOP_CONVENIENCE_BRANDS = 8  # 側欄列出的便利商店品牌數
ALL_CONVENIENCE = "convenience"  # 子項目「所有便利商店」（前端 chain-stores.ts 的 ALL_CONVENIENCE）
# 人口不到 10 萬的地方不算每百萬人的店數：一兩家店就是每百萬人幾十家（聖馬丁 4 家 Subway 是 90 家），
# 梵蒂岡旁邊的一家肯德基落在 1:50m 的梵蒂岡國界裡就變成每百萬人近 2,000 家（geoindex 改用 1:10m 以後已經不在梵蒂岡）。
# 店數照常有。
# 前端 chain-stores.ts 的 SMALL_POPULATION 是同一份清單（給 noValue 寫原因），build() 會比對兩邊
MIN_POPULATION = 100_000
TS_FILE = OUT_DIR.parent.parent / "src" / "topics" / "chain-stores.ts"


class Brand(NamedTuple):
    id: str
    name: str
    zh: str
    #  brand:wikidata（含子品牌：Natural Lawson、Lawson Store 100、台灣全家…），已逐一用 Wikidata API 查過標籤
    qids: tuple[str, ...]
    #  算這個品牌的店型（OSM 的 shop=* 或 amenity=*）；IKEA 的餐廳、Costco 的加油站與美食區不算
    kinds: tuple[str, ...]
    #  沒有 brand:wikidata 時，name 或 brand 以這些寫法開頭才算（不分大小寫）；空字串是不用名稱比對
    names: str
    #  名稱符合這些寫法的不算（IKEA 的規劃訂購點、取貨點，不是門市）
    exclude: str = ""
    #  這個距離內的兩個點當成同一家店（公尺）。IKEA、Costco 的賣場有幾百公尺長，建築物外框的中心跟店的點常常差 100 公尺以上
    same_store_m: float = 25
    #  依名稱認出來的店只算在這些國家（品牌有開店的地方）；空的是不限。「Family Mart」「Costco Supermarket」在美國、
    #  非洲常常是同名的獨立小店，有 brand:wikidata 的照算
    name_countries: tuple[str, ...] = ()


CONVENIENCE_KIND = "shop=convenience"
FUEL_KIND = "amenity=fuel"

BRANDS: list[Brand] = [
    Brand("7-eleven", "7-Eleven", "7-Eleven", ("Q259340",), (CONVENIENCE_KIND,),
          r"7-?eleven|7 eleven|7-11|セブン-?イレブン|세븐일레븐|統一超商|统一超商|เซเว่น"),
    # 全家：Q11247682 是 FamilyMart 這個品牌，台灣全家（全家便利商店股份有限公司）是 Q10891564。日本有 5,769 家標的是
    # 公司的 QID（Q1191685，株式会社ファミリーマート），name-suggestion-index 沒有列，但確實是 FamilyMart 的店，一起算；
    # Q115868189 是 FamilyMart 的小型店「famima!!」
    Brand("familymart", "FamilyMart", "全家", ("Q11247682", "Q10891564", "Q1191685", "Q115868189"), (CONVENIENCE_KIND,),
          r"family ?mart|ファミリーマート|ファミマ|全家(?!福)",
          name_countries=("JPN", "TWN", "CHN", "THA", "IDN", "PHL", "VNM", "MYS", "KHM")),
    # Lawson 的子品牌：Natural Lawson、Lawson Store 100、Lawson+3F、Lawson+Poplar、Lawson+toks、泰國的 Lawson 108
    Brand("lawson", "Lawson", "Lawson",
          ("Q1557223", "Q11323850", "Q11350960", "Q24866804", "Q116957010", "Q115868119", "Q125869566"),
          (CONVENIENCE_KIND,), r"lawson|ローソン|罗森|羅森", name_countries=("JPN", "CHN", "THA", "IDN", "PHL")),
    # Q4043856 是 name-suggestion-index 給烏克蘭麥當勞的 QID
    Brand("mcdonalds", "McDonald's", "麥當勞", ("Q38076", "Q4043856"), ("amenity=fast_food", "amenity=restaurant"),
          r"mc ?donald|麥當勞|麦当劳|マクドナルド|맥도날드"),
    # Q71150001 是 Starbucks Reserve（星巴克臻選），也是星巴克的門市
    Brand("starbucks", "Starbucks", "星巴克", ("Q37158", "Q71150001"), ("amenity=cafe",),
          r"starbucks|星巴克|スターバックス|스타벅스"),
    Brand("kfc", "KFC", "肯德基", ("Q524757",), ("amenity=fast_food", "amenity=restaurant"),
          r"kfc|kentucky fried|肯德基|ケンタッキー|케이에프씨|pfk"),
    Brand("subway", "Subway", "Subway", ("Q244457",), ("amenity=fast_food", "amenity=restaurant"),
          r"subway|サブウェイ|赛百味|賽百味|써브웨이"),
    # IKEA 的門市：規劃訂購點、取貨點、快閃店、設計工作室不算（各國語言的寫法都列了，2026-10 的資料逐一看過）。
    # 只認 brand:wikidata：依名稱比對的 45 家多半是同名的家具行（智利的「Ikean」、伊拉克的「IKEA WOOD」、奈及利亞、利比亞）
    Brand("ikea", "IKEA", "IKEA", ("Q54078",), ("shop=furniture",), "",
          exclude=r"plan|studio|štúdio|pick.?up|abhol|order|retiro|recogida|recollida|odbi|punkt|point|click|collect"
                  r"|magazijn|kiadó|utlämning|entrega|retrait|pop.?up|design|disenya|取貨|規劃|规划",
          same_store_m=400),
    # 依名稱認的只算 Costco 有賣場的國家（Costco 2026 年 9 月營收新聞稿列的 14 國加波多黎各）
    Brand("costco", "Costco", "Costco", ("Q715583",), ("shop=wholesale", "shop=supermarket", "shop=department_store"),
          r"costco|好市多|コストコ|코스트코|开市客|開市客", same_store_m=400,
          name_countries=("USA", "PRI", "CAN", "MEX", "GBR", "KOR", "TWN", "JPN", "AUS", "ESP", "FRA", "ISL", "NZL", "SWE", "CHN")),
]
BRAND_BY_ID = {b.id: b for b in BRANDS}

# 品牌已經退出、OSM 上還留著舊標示的國家（2026-10 的資料：俄羅斯的麥當勞 41 個、肯德基 263 個標成 KFC 的點），這些點不算：
# 數值是 0，附註與 tooltip 寫出原因與沒算的點數。改名後的接手品牌（Rostic's、Вкусно — и точка）有些還帶著原本的
# brand:wikidata，不論在哪一國都不算（SUCCESSOR_NAMES）。
EXITED: dict[tuple[str, str], tuple[str, str]] = {
    ("mcdonalds", "RUS"): ("2022 年退出俄羅斯，餐廳改名「Вкусно — и точка」", "left Russia in 2022; its restaurants became Vkusno — i tochka"),
    ("starbucks", "RUS"): ("2022 年退出俄羅斯", "left Russia in 2022"),
    ("kfc", "RUS"): ("2023 年退出俄羅斯，餐廳改名 Rostic's", "left Russia in 2023; its restaurants became Rostic's"),
    ("ikea", "RUS"): ("2022 年退出俄羅斯", "left Russia in 2022"),
    ("ikea", "BLR"): ("2022 年退出白俄羅斯", "left Belarus in 2022"),
}
SUCCESSOR_NAMES = re.compile(r"rostic|ростикс|вкусно|subjoy|sabway", re.I)


def download() -> tuple[list, list, str]:
    """回傳 (品牌查詢的所有物件, 所有便利商店, OSM 資料時間戳)。便利商店的名稱比對用整包的便利商店，不另外查。"""
    from sources import osm

    features: list[osm.Feature] = []
    stamps: list[str] = []
    for b in BRANDS:
        got, stamp = osm.wikidata_features(b.id, list(b.qids))
        features += got
        stamps.append(stamp)
    for kind in sorted({k for b in BRANDS if b.names for k in b.kinds if k != CONVENIENCE_KIND}):
        key, value = kind.split("=")
        got, stamp = osm.name_features(key, value, "|".join(b.names for b in BRANDS if b.names and kind in b.kinds))
        features += got
        stamps.append(stamp)
    convenience, stamp = osm.convenience_features()
    stamps.append(stamp)
    return features, convenience, min((s for s in stamps if s), default="")


# ── 認品牌 ─────────────────────────────────────────────────────────
_NAME_RE = {b.id: re.compile(rf"^({b.names})", re.I) for b in BRANDS if b.names}
_EXCLUDE_RE = {b.id: re.compile(b.exclude, re.I) for b in BRANDS if b.exclude}
_QID_BRAND = {q: b.id for b in BRANDS for q in b.qids}


def _kinds(f) -> set[str]:
    return {f"shop={f.shop}", f"amenity={f.amenity}"}


def classify(f) -> tuple[str, bool, bool] | None:
    """(品牌 id, 是不是只標成加油站, 是不是依名稱認的)；不是這 9 個品牌的店回傳 None。"""
    qids = {q.strip() for q in f.wikidata.split(";") if q.strip()}
    kinds = _kinds(f)
    by_name = not qids
    if qids:
        ids = {_QID_BRAND[q] for q in qids if q in _QID_BRAND}
        if len(ids) != 1:
            return None  # 不是這 9 個品牌，或同時標了兩個品牌
        brand = BRAND_BY_ID[ids.pop()]
    else:
        candidates = [
            b for b in BRANDS if b.id in _NAME_RE and any(_NAME_RE[b.id].match(s.strip()) for s in (f.name, f.brand) if s)
        ]
        candidates = [b for b in candidates if kinds & set(b.kinds)]
        if len(candidates) != 1:
            return None
        brand = candidates[0]
    if brand.id in _EXCLUDE_RE and _EXCLUDE_RE[brand.id].search(f.name):
        return None
    if SUCCESSOR_NAMES.search(f.name) or SUCCESSOR_NAMES.search(f.brand):
        return None  # 改名後的接手品牌（俄羅斯的 Rostic's、Вкусно — и точка），只是還帶著原本的 brand:wikidata
    if kinds & set(brand.kinds):
        return brand.id, False, by_name
    if CONVENIENCE_KIND in brand.kinds and FUEL_KIND in kinds:
        return brand.id, True, by_name
    return None  # 品牌對、店型不對（IKEA 的餐廳、Costco 的加油站、7-Eleven 的停車場…）


def _meters(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    x = math.radians(lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(x, math.radians(lat2 - lat1)) * 6_371_000


def dedupe(stores: list[tuple[object, bool, bool]], same_store_m: float = SAME_STORE_M) -> tuple[list, int]:
    """同一個品牌的店（classify() 的 (物件, 只標成加油站, 依名稱認的)）：先放一般的店，same_store_m 公尺內的當成同一家；
    再放只標成加油站的，150 公尺內有店就不算。回傳 (留下的, 拿掉幾個)"""
    # 格子的邊長（度）至少是最大距離（緯度 60° 以內），查鄰近 3×3 格就涵蓋得到
    cell = max(same_store_m, FUEL_STORE_M) / 50_000
    grid: dict[tuple[int, int], list] = defaultdict(list)
    kept = []
    # 一般的店在前、有 brand:wikidata 的在前；同一種裡點（node）在前，建築物外框（way）在後，同一家店留點的位置
    order = sorted(stores, key=lambda s: (s[1], s[2], not s[0].osm_id.startswith("node/"), s[0].osm_id))
    for f, fuel, _by_name in order:
        cx, cy = int(math.floor(f.lon / cell)), int(math.floor(f.lat / cell))
        radius = FUEL_STORE_M if fuel else same_store_m
        near = any(
            _meters(f.lon, f.lat, g.lon, g.lat) < radius
            for dx in (-1, 0, 1)
            for dy in (-1, 0, 1)
            for g in grid[(cx + dx, cy + dy)]
        )
        if near:
            continue
        grid[(cx, cy)].append(f)
        kept.append(f)
    return kept, len(stores) - len(kept)


# ── 店家位置的資料檔 ────────────────────────────────────────────────
def _hilbert(x: int, y: int, order: int = 16) -> int:
    """Hilbert 曲線上的序號：依這個順序排，相鄰的店多半在附近，經緯度的差分很小，gzip 壓得好"""
    d = 0
    s = 1 << (order - 1)
    while s > 0:
        rx = 1 if x & s else 0
        ry = 1 if y & s else 0
        d += s * s * ((3 * rx) ^ ry)
        if ry == 0:
            if rx == 1:
                x, y = s - 1 - x, s - 1 - y
            x, y = y, x
        s >>= 1
    return d


def store_points(stores: list) -> dict:
    size = 1 << 16
    keyed = sorted(
        stores,
        key=lambda f: _hilbert(int((f.lon + 180) / 360 * (size - 1)), int((f.lat + 90) / 180 * (size - 1))),
    )
    rows = [{"lon": f.lon, "lat": f.lat} for f in keyed]
    return points_file(rows, ["lon", "lat"], {"lon": POINT_QUANTUM, "lat": POINT_QUANTUM}, delta=("lon", "lat"))


# ── 附註 ────────────────────────────────────────────────────────────
def _official_text(o, lang: str) -> str:
    n = f"{o.count:,}"
    if o.qualifier == "over":
        return f"{n} 家以上" if lang == "zh" else f"{n}+"
    if o.qualifier == "about":
        return f"約 {n} 家" if lang == "zh" else f"about {n}"
    return f"{n} 家" if lang == "zh" else n


def official_notes(brand_id: str, osm_counts: dict[str, int]) -> tuple[dict, dict, dict, dict, list[dict]]:
    """這個品牌有公司公布店數的國家：(notes, notesEn, hints, hintsEn, 對照表)。合計好幾國的（美國＋加拿大），每一國都寫。"""
    notes, notes_en, hints, hints_en, table = {}, {}, {}, {}, []
    for o in OFFICIAL:
        if o.brand != brand_id:
            continue
        osm = sum(osm_counts.get(c, 0) for c in o.iso3)
        cover = osm / o.count
        pct = f"{math.floor(cover * 100 + 0.5)}%"  # 四捨五入（跟前端的 toLocaleString 一樣，不用 Python 的銀行家捨入）
        joint_zh = f"（{'、'.join(o.iso3)} 合計）" if len(o.iso3) > 1 else ""
        joint_en = f" ({' + '.join(o.iso3)} combined)" if len(o.iso3) > 1 else ""
        scope_zh = f"，{o.scope}" if o.scope else ""
        scope_en = f", {o.scope_en}" if o.scope_en else ""
        for iso3 in o.iso3:
            notes[iso3] = (
                f"公司公布 {_official_text(o, 'zh')}{joint_zh}（{o.asof}{scope_zh}，{o.source}）；"
                f"OpenStreetMap 上標了 {osm:,} 家，涵蓋率 {pct}。"
            )
            notes_en[iso3] = (
                f"Company count: {_official_text(o, 'en')}{joint_en} ({o.asof}{scope_en}, {o.source_en}); "
                f"{osm:,} mapped on OpenStreetMap, coverage {pct}."
            )
            if cover < POOR_COVERAGE:
                hints[iso3] = f"OSM 只標了公司公布店數（{_official_text(o, 'zh')}）的 {pct}，明顯偏低"
                hints_en[iso3] = f"OSM maps only {pct} of the company’s {_official_text(o, 'en')} stores: a clear undercount"
            else:
                hints[iso3] = f"公司公布 {_official_text(o, 'zh')}{joint_zh}，OSM 涵蓋率 {pct}"
                hints_en[iso3] = f"Company count {_official_text(o, 'en')}{joint_en}; OSM coverage {pct}"
        table.append({
            "brand": o.brand, "iso3": list(o.iso3), "count": o.count, "asof": o.asof,
            "scope": o.scope, "scopeEn": o.scope_en, "source": o.source, "sourceEn": o.source_en, "url": o.url,
            "qualifier": o.qualifier, "osm": osm,
        })
    return notes, notes_en, hints, hints_en, table


# ── 組裝 ────────────────────────────────────────────────────────────
def build() -> None:
    features, convenience, stamp = download()
    snapshot = stamp[:10]
    year = int(snapshot[:4])

    # 品牌查詢與整包便利商店有重疊（同一個 OSM 物件），只算一次
    unique = {f.osm_id: f for f in [*features, *convenience]}
    by_brand: dict[str, list] = defaultdict(list)
    for f in unique.values():
        got = classify(f)
        if got:
            by_brand[got[0]].append((f, got[1], got[2]))

    # 國家：所有品牌的店與所有便利商店一次判斷
    conv = list({f.osm_id: f for f in convenience}.values())
    everything = list({f.osm_id: f for f in [*(s[0] for b in BRANDS for s in by_brand[b.id]), *conv]}.values())
    located = dict(zip((f.osm_id for f in everything), countries_at([f.lon for f in everything], [f.lat for f in everything])))
    print(f"  {len(everything)} 個點判斷國家，{sum(1 for v in located.values() if not v)} 個不在任何國家附近")

    stores: dict[str, list] = {}
    duplicates: set[str] = set()  # 合併重複時拿掉的（同一家店的第二個點），所有便利商店也不算
    for b in BRANDS:
        # 依名稱認的店只算品牌有開店的國家（name_countries）
        candidates = [
            s for s in by_brand[b.id] if not (s[2] and b.name_countries and located[s[0].osm_id] not in b.name_countries)
        ]
        kept, dropped = dedupe(candidates, b.same_store_m)
        stores[b.id] = kept
        duplicates.update(s[0].osm_id for s in candidates)
        duplicates.difference_update(f.osm_id for f in kept)
        fuel = sum(1 for s in candidates if s[1])
        by_name = sum(1 for s in candidates if s[2])
        outside = len(by_brand[b.id]) - len(candidates)
        print(
            f"  {b.name}：{len(candidates)} 個物件（{by_name} 個依名稱認的、{fuel} 個只標成加油站；"
            f"另有 {outside} 個依名稱認的不在開店的國家）→ 合併重複後 {len(kept)} 家（拿掉 {dropped}）"
        )

    # 人口：WPP 2024 的 2026 年（中推估），台灣也用 WPP（跟人口主題一樣）
    wpp_pop = wpp.demographic(["TPopulation1July"], last_year=year)["TPopulation1July"]
    population = {iso3: s[year] * 1000 for iso3, s in wpp_pop.items() if year in s and iso3 in ISO3}
    world_pop = wpp_pop["WLD"][year] * 1000
    small = sorted(a for a, p in population.items() if p < MIN_POPULATION)
    listed = re.search(r"SMALL_POPULATION = \[([^\]]*)\]", TS_FILE.read_text(encoding="utf-8"))
    if not listed or sorted(re.findall(r"'([A-Z]{3})'", listed.group(1))) != small:
        raise RuntimeError(f"chain-stores.ts 的 SMALL_POPULATION 要改成這 {len(small)} 個：{small}")
    rated = {a: p for a, p in population.items() if p >= MIN_POPULATION}  # 算每百萬人店數的國家

    counts: dict[str, Counter] = {}
    tables: dict[str, list[dict]] = {}
    stale: dict[str, Counter] = {}
    for b in BRANDS:
        # 已經退出的國家（EXITED）：OSM 上的舊標示不算，也不畫點
        stale[b.id] = Counter(located[f.osm_id] for f in stores[b.id] if (b.id, located[f.osm_id]) in EXITED)
        stores[b.id] = [f for f in stores[b.id] if (b.id, located[f.osm_id]) not in EXITED]
        c = Counter(located[f.osm_id] for f in stores[b.id] if located[f.osm_id])
        counts[b.id] = c
        notes, notes_en, hints, hints_en, tables[b.id] = official_notes(b.id, c)
        for (brand_id, iso3), (zh, en) in EXITED.items():
            if brand_id != b.id:
                continue
            n = stale[b.id][iso3]
            left_zh = f"OpenStreetMap 上還留著 {n:,} 個舊的標示，沒有算。" if n else ""
            left_en = f" {n:,} outdated {'entry remains' if n == 1 else 'entries remain'} on OpenStreetMap and {'is' if n == 1 else 'are'} not counted." if n else ""
            notes[iso3], notes_en[iso3] = f"{b.zh} {zh}。{left_zh}", f"{b.name} {en}.{left_en}"
            hints[iso3], hints_en[iso3] = f"{b.zh} {zh}", f"{b.name} {en}"
            print(f"  {b.name}：{iso3} {zh}，{n} 個舊標示沒有算")
        world = sum(c.values())
        extra = {"snapshot": stamp, "notes": notes, "notesEn": notes_en, "hints": hints, "hintsEn": hints_en}
        write_json(OUT / "stores" / f"{b.id}.json", indicator_file(
            "stores", "家", [year], {a: [c.get(a, 0)] for a in population}, aggregates={"WLD": [world]}, **extra,
        ), quiet=True)
        write_json(OUT / "density" / f"{b.id}.json", indicator_file(
            "density", "家/百萬人", [year], {a: [round(c.get(a, 0) / p * 1e6, 3)] for a, p in rated.items()},
            aggregates={"WLD": [round(world / world_pop * 1e6, 3)]}, **extra,
        ), quiet=True)
        write_json(OUT / "points" / f"{b.id}.json", store_points(stores[b.id]))

    # 「所有便利商店」是子項目之一（ALL_CONVENIENCE），跟品牌同樣的兩個指標，沒有店家位置的點（約 80 萬家，太大）。
    # 3 個便利商店品牌合併重複時拿掉的點不算（其他品牌與沒有品牌的小店沒有合併重複，兩個點的情形少很多）
    conv = [f for f in conv if f.osm_id not in duplicates]
    conv_counts = Counter(located[f.osm_id] for f in conv if located[f.osm_id])
    world = sum(conv_counts.values())
    write_json(OUT / "stores" / f"{ALL_CONVENIENCE}.json", indicator_file(
        "stores", "家", [year], {a: [conv_counts.get(a, 0)] for a in population},
        aggregates={"WLD": [world]}, snapshot=stamp,
    ))
    write_json(OUT / "density" / f"{ALL_CONVENIENCE}.json", indicator_file(
        "density", "家/百萬人", [year], {a: [round(conv_counts.get(a, 0) / p * 1e6, 2)] for a, p in rated.items()},
        aggregates={"WLD": [round(world / world_pop * 1e6, 2)]}, snapshot=stamp,
    ))

    # 側欄：各國的品牌店數、公司公布的店數、便利商店的品牌排行
    # 這個主題認出來的品牌寫成「#品牌 id」，前端換成目前語言的品牌名稱；其他照 OSM 的 brand 標籤
    ours = {f.osm_id: f"#{b.id}" for b in BRANDS for f in stores[b.id]}
    conv_brands: dict[str, Counter] = defaultdict(Counter)
    unbranded: Counter = Counter()
    for f in conv:
        iso3 = located[f.osm_id]
        if not iso3:
            continue
        label = ours.get(f.osm_id) or f.brand.strip()
        if label:
            conv_brands[iso3][label] += 1
        else:
            unbranded[iso3] += 1
    for iso3, p in population.items():
        brands = {b.id: counts[b.id][iso3] for b in BRANDS if counts[b.id].get(iso3)}
        official = [row for b in BRANDS for row in tables[b.id] if iso3 in row["iso3"]]
        exited = [
            {"brand": brand_id, "text": zh, "textEn": en, "stale": stale[brand_id][iso3]}
            for (brand_id, where), (zh, en) in EXITED.items()
            if where == iso3
        ]
        if not brands and not official and not exited and not conv_counts.get(iso3):
            continue
        detail = {"snapshot": snapshot, "population": round(p), "brands": brands, "official": official}
        if exited:
            detail["exited"] = exited
        if conv_counts.get(iso3):
            detail["convenience"] = {
                "count": conv_counts[iso3],
                "brands": conv_brands[iso3].most_common(TOP_CONVENIENCE_BRANDS),
                "unbranded": unbranded[iso3],
            }
        write_json(OUT / "countries" / f"{iso3}.json", detail, quiet=True)

    write_json(OUT / "manifest.json", {
        "topic": "chain-stores",
        "generatedAt": now_iso(),
        "source": "OpenStreetMap contributors (ODbL); UN WPP 2024; company store counts (see sources/chain_official.py)",
        "license": "ODbL 1.0 (derived database of OpenStreetMap)",
        "osmTimestamp": stamp,
    })
    print(f"  便利商店 {len(conv)} 家，{len(conv_counts)} 個國家")
