"""航運與港口的擴充：渡輪航線（第十批順序 177，2026-10-31，製作手冊第一百二十五節）。

使用者 2026-10-30 決定：用 OpenStreetMap 的 route=ferry，只收定期客運（排除觀光船、河上的擺渡），資料檔用 ODbL；
台灣另有交通部航港局的「國內固定航班資訊」可以對照。cloud 連不上 Overpass，本機 session 2026-10-31 執行 map-plan 的
`scripts/osm_ferry_routes.py` 下載全世界的 route=ferry（relation 4,842、way 30,950，接線、簡化 0.003°），
放在 map-plan 的 `data/osm/ferry-routes.json`；航港局的時刻表（ODS）放在 `data/mpb/`。
在 cloud 重跑時把它們複製到 `pipeline/.cache/osm/`、`pipeline/.cache/mpb/`。

篩選（OSM 沒有「定期」與否的標籤，照標籤與位置判斷）：
1. relation 一條是一個航線；屬於 route=ferry relation 的 way 不另算（線已經在 relation 裡）。
2. 排除停駛或不開放的（disused、opening_hours=closed、access=no／private）、觀光的（tourism、ferry=tourist、
   service=tourism、名稱或營運者有 cruise、sightseeing、觀光、遊船…，TOURIST）、纜索與鏈條渡船
   （ferry:cable、ferry:type 寫 cable、chain：幾乎都是過河的擺渡），與 EXCLUDE 逐條看過的。
3. 沒有 relation 的 way：同名、端點相接（而且那一點只接這兩條）的接成一條（同一條航線被切成好幾段）。
4. 位置：沿線每 0.01° 取一點，用 1:10m 國界（geoindex，不含 ISLANDS 的框）判斷在陸地還是海上，再用 Natural Earth 1:10m
   的湖泊：海上的點占 SEA_MIN 以上是海上航線；不然湖泊裡的點占 LAKE_MIN 以上是湖上航線；其餘是河上的（過河的擺渡、
   河上的客船，排除）。1:10m 的海岸線粗，河口、港內的短航線可能判成海上（例如淡水河口的八里—漁人碼頭）。
5. 重複：兩端的港口（端點相距 PORT_SNAP 以內的算同一個港）相同的只留一條：去程與回程的 relation、同一條航線的
   relation 與 way、不同公司的同一組港口。留有名字的、relation、比較長的。

輸出（public/data/topics/shipping/，航運與港口主題的資料夾）：
- ferries.json：線圖層，種類 1 跨國、2 國內（海上）、3 湖上；紀錄的 r 對到 groups（名稱、營運者、航行時間、長度、國家…）。
- ferries-count.json：各國的渡輪航線數（一條航線兩端在不同國家時兩國都算）。
- ferries-list.json：左邊清單側欄用（點），台灣的航線（g=1，附航港局 7–8 月的班次）與有維基百科條目的航線（g=2），
  中心點與範圍（bw、bs、be、bn），點了移到那個範圍。
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, lines_file, points_file, write_json, write_manifest_part

OUT = OUT_DIR / "topics" / "shipping"
OSM_FILE = CACHE_DIR / "osm" / "ferry-routes.json"
MPB_FILE = CACHE_DIR / "mpb" / "domestic-ferry-timetable-20260701-20260831.ods"
MPB_SHEET = "7~8月"
LAKES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v4.1.0/geojson/ne_10m_lakes.geojson"
YEAR = 2026
QUANTUM = 0.002
STEP = 0.01  # 判斷海上、湖上時沿線取點的間隔（度）
SEA_MIN = 0.02
LAKE_MIN = 0.3
PORT_SNAP = 0.02  # 端點相距在這以內（度，約 2 公里）算同一個港口
LICENSE = "ODbL 1.0"
TYPES = {"international": 1, "domestic": 2, "lake": 3}

TOURIST = re.compile(
    r"cruise|sightseeing|excursion|boat tour|\btour\b|rundfahrt|ausflug|panorama|hop.?on|croisi|giro |escursion|crucero|paseo|"
    r"觀光|观光|遊船|游船|遊覽|游览|遊艇|游艇",
    re.I,
)
# 逐條看過、規則沒抓到的（台灣附近的：清單裡會看到）
EXCLUDE = {
    ("relation", 14878994): "冬山河—傳藝中心水上巴士：河上的觀光船（河口在 1:10m 的海岸線外，判成海上）",
    ("way", 739576629): "碧砂漁港—基隆嶼：登島觀光船",
    ("way", 739576630): "碧砂漁港—基隆嶼：登島觀光船",
    ("relation", 14021695): "高雄—太平島：海巡署的補給船，一般人不能搭",
    ("way", 768415237): "高雄—太平島：海巡署的補給船，一般人不能搭",
    ("relation", 14021696): "高雄—東沙：海巡署的補給船，一般人不能搭",
    ("way", 686020480): "高雄—東沙：海巡署的補給船，一般人不能搭",
    ("relation", 12858237): "福澳—亮島：軍事管制的島，沒有定期客運（OSM 標了 fixme）",
    ("way", 955293870): "福澳—亮島：軍事管制的島，沒有定期客運",
}


def _haversine(a, b) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(min(1.0, math.sqrt(h)))


def _unwrap(line):
    """經度展開成連續的（跨 180° 經線的線）"""
    out = [line[0]]
    for x, y in line[1:]:
        px = out[-1][0]
        while x - px > 180:
            x -= 360
        while px - x > 180:
            x += 360
        out.append((x, y))
    return out


def _excluded(t: dict) -> str | None:
    if t.get("disused") == "yes" or t.get("opening_hours") == "closed" or t.get("access") in ("no", "private") or t.get("state") == "proposed":
        return "closed"
    if "tourism" in t or t.get("ferry") == "tourist" or t.get("service") in ("tourism", "tourist") or t.get("passenger") == "tourism" \
            or t.get("boat") == "cruise_vessel":
        return "tourist"
    if any(TOURIST.search(t.get(k, "")) for k in ("name", "name:en", "description", "operator", "network")):
        return "tourist"
    if "ferry:cable" in t or t.get("ferry") == "cable" or re.search(r"cable|chain|pull", t.get("ferry:type", ""), re.I):
        return "cable"
    return None


def _pairs(flat: list[float]) -> list[tuple[float, float]]:
    return [(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]


def _chain_ways(ways: list[dict]) -> list[dict]:
    """沒有 relation 的 way：同名、端點相接、那一點只接這兩條的接成一條"""
    key = lambda p: (round(p[0], 4), round(p[1], 4))  # noqa: E731
    ends: dict[tuple, list[int]] = defaultdict(list)
    for i, w in enumerate(ways):
        for line in w["lines"]:
            ends[key(line[0])].append(i)
            ends[key(line[-1])].append(i)
    parent = list(range(len(ways)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for ids in ends.values():
        if len(ids) == 2 and ids[0] != ids[1]:
            a, b = ways[ids[0]], ways[ids[1]]
            if (a["tags"].get("name") or "") == (b["tags"].get("name") or ""):
                parent[find(ids[0])] = find(ids[1])
    groups: dict[int, list[dict]] = defaultdict(list)
    for i, w in enumerate(ways):
        groups[find(i)].append(w)
    out = []
    for members in groups.values():
        if len(members) == 1:
            out.append(members[0])
            continue
        # 標籤取最多的那一段；長度加總
        main = max(members, key=lambda w: (len(w["tags"]), w.get("km") or 0))
        out.append({**main, "lines": [l for w in members for l in w["lines"]], "km": sum(w.get("km") or 0 for w in members),
                    "merged": len(members)})
    return out


def _lakes():
    from shapely.geometry import shape
    from shapely.strtree import STRtree

    path = download(LAKES_URL, "natural-earth", "ne_10m_lakes-4.1.0.geojson")
    geoms = [shape(f["geometry"]) for f in json.loads(path.read_text(encoding="utf-8"))["features"]]
    return STRtree(geoms)


def _classify(routes: list[dict]) -> None:
    """每條航線海上、湖上的比例（r["sea"]、r["lake"]）"""
    import numpy as np
    from shapely import points as spoints

    from geoindex import _index

    xs, ys, owner = [], [], []
    for i, r in enumerate(routes):
        for line in r["lines"]:
            for a, b in zip(line, line[1:]):
                n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / STEP))
                for k in range(n):
                    xs.append(a[0] + (b[0] - a[0]) * k / n)
                    ys.append(a[1] + (b[1] - a[1]) * k / n)
                    owner.append(i)
            xs.append(line[-1][0])
            ys.append(line[-1][1])
            owner.append(i)
    x, y, owner = np.array(xs), np.array(ys), np.array(owner)
    land = np.asarray(_index().lookup(x, y, False)) >= 0
    lake = np.zeros(len(x), dtype=bool)
    hit = _lakes().query(spoints(x, y), predicate="within")
    lake[hit[0]] = True
    total = np.bincount(owner, minlength=len(routes))
    sea = np.bincount(owner, weights=~land, minlength=len(routes))
    inl = np.bincount(owner, weights=lake, minlength=len(routes))
    for i, r in enumerate(routes):
        r["sea"] = sea[i] / total[i]
        r["lake"] = inl[i] / total[i]


def _ends(r: dict) -> tuple[tuple[float, float], tuple[float, float]]:
    """航線兩端：所有線段端點裡相距最遠的兩點"""
    pts = [p for line in r["lines"] for p in (line[0], line[-1])]
    best, pair = -1.0, (pts[0], pts[-1])
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            d = (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2
            if d > best:
                best, pair = d, (pts[i], pts[j])
    return pair


def _dedupe(routes: list[dict]) -> list[dict]:
    """兩端的港口相同的只留一條"""
    for r in routes:
        r["ends"] = _ends(r)
    pts = [p for r in routes for p in r["ends"]]
    parent = list(range(len(pts)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    cells: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, (x, y) in enumerate(pts):
        cells[(math.floor(x / PORT_SNAP), math.floor(y / PORT_SNAP))].append(i)
    for (cx, cy), ids in cells.items():
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for j in cells.get((cx + dx, cy + dy), []):
                    for i in ids:
                        if i < j and (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2 <= PORT_SNAP ** 2:
                            parent[find(i)] = find(j)
    best: dict[frozenset, tuple] = {}
    members: dict[frozenset, list[dict]] = defaultdict(list)
    for k, r in enumerate(routes):
        key = frozenset((find(2 * k), find(2 * k + 1)))
        members[key].append(r)
        score = (bool(r["tags"].get("name")), r["kind"] == "relation", r.get("km") or 0)
        if key not in best or score > best[key][0]:
            best[key] = (score, r)
    out = []
    for key, (_, r) in best.items():
        r["members"] = members[key]
        out.append(r)
    return out


def _name_zh(t: dict) -> str | None:
    for k in ("name:zh-Hant", "name:zh-TW", "name:zh"):
        if t.get(k):
            return t[k]
    return None


# ── 航港局的國內固定航班 ───────────────────────────────────────────

# 航港局的港口 → OSM 航線名稱裡的寫法（正規表示式）
MPB_PORTS = {
    "東港": r"東港", "東港鹽埔漁港": r"鹽埔", "小琉球白沙港": r"白沙尾", "小琉球大福漁港": r"大福",
    "北竿白沙港": r"北竿", "南竿福澳港": r"南竿|福澳|馬祖", "馬祖福澳港": r"南竿|福澳|馬祖", "基隆港": r"基隆",
    "東引中柱港": r"東引", "大坵": r"大坵", "東莒猛沃港": r"東莒", "西莒青帆港": r"西莒",
    "台東富岡港": r"富岡|富崗|臺東-|台東-", "臺東成功漁港": r"成功", "綠島南寮港": r"綠島", "蘭嶼開元港": r"蘭嶼",
    "後壁湖遊艇港": r"後壁湖", "布袋港": r"布袋", "澎湖港馬公碼頭區": r"馬公", "馬公第三漁港": r"馬公",
    "澎湖七美漁港": r"七美", "望安港": r"望安", "澎湖將軍漁港": r"(?<!臺南)將軍", "臺南將軍漁港": r"臺南將軍",
    "東吉港": r"東吉", "澎湖東嶼坪漁港": r"東嶼坪", "潭門港": r"潭門", "吉貝漁港": r"吉貝", "赤崁漁港": r"赤崁",
    "高雄港": r"高雄", "安平港": r"安平",
}
# 同一個港的不同寫法（算港口對的時候併在一起）
MPB_SAME = {"馬祖福澳港": "南竿福澳港", "馬公第三漁港": "澎湖港馬公碼頭區"}


def mpb_pairs() -> Counter:
    """航港局 7–8 月的航班，依港口對（不分方向）計數"""
    from topics.aviation_extra import _ods_sheet

    if not MPB_FILE.exists():
        raise RuntimeError(f"沒有 {MPB_FILE}：請把 map-plan 的 data/mpb/ 的 ODS 複製到這裡")
    pairs: Counter = Counter()
    for row in _ods_sheet(MPB_FILE, MPB_SHEET)[1:]:
        if len(row) < 4 or not isinstance(row[1], str) or not isinstance(row[3], str):
            continue
        a, b = (MPB_SAME.get(p.strip(), p.strip()) for p in (row[1], row[3]))
        if a != b:
            pairs[tuple(sorted((a, b)))] += 1
    unknown = {p for pair in pairs for p in pair} - set(MPB_PORTS)
    if unknown:
        raise RuntimeError(f"航港局的港口沒有對照：{sorted(unknown)}")
    return pairs


def match_mpb(taiwan: list[dict], pairs: Counter) -> list[tuple[str, str, int]]:
    """航港局的港口對 → 名稱裡有兩端港口的 OSM 航線（取名稱裡港口最少的，最接近的那條），班次加到 r["mpb"]；回傳名稱對不到的"""
    def ports_in(r):
        name = " ".join(filter(None, (r["tags"].get("name"), _name_zh(r["tags"]))))
        return {p for p, pat in MPB_PORTS.items() if p not in MPB_SAME and re.search(pat, name)}

    # 重複而沒畫的航線（例如鹽埔—大福跟東港—大福的港口算同一個）也比對名稱，班次加到畫出來的那一條
    found = [(m, r, ports_in(m)) for r in taiwan for m in r["members"]]
    missing = []
    for (a, b), n in sorted(pairs.items(), key=lambda kv: -kv[1]):
        cands = [(m, r, ports) for m, r, ports in found if {a, b} <= ports]
        if not cands:
            missing.append((a, b, n))
            continue
        fewest = min(len(ports) for _, _, ports in cands)
        _, best, _ = max((c for c in cands if len(c[2]) == fewest), key=lambda c: c[0].get("km") or 0)
        best["mpb"] = best.get("mpb", 0) + n
    return missing


# ── 主程式 ─────────────────────────────────────────────────────────


def build() -> None:
    from geoindex import countries_at

    if not OSM_FILE.exists():
        raise RuntimeError(f"沒有 {OSM_FILE}：cloud 連不到 Overpass，請把 map-plan 的 data/osm/ferry-routes.json 複製到這裡")
    data = json.loads(OSM_FILE.read_text(encoding="utf-8"))
    stats: Counter = Counter()
    routes, loose = [], []
    for kind, items in (("relation", data["relations"]), ("way", data["ways"])):
        for it in items:
            if not it.get("lines"):
                continue
            if kind == "way" and it.get("relations"):
                continue
            why = _excluded(it["tags"]) or ("checked" if (kind, it["id"]) in EXCLUDE else None)
            if why:
                stats[why] += 1
                continue
            r = {"kind": kind, "id": it["id"], "tags": it["tags"], "km": it.get("km") or 0,
                 "lines": [l for l in (_pairs(f) for f in it["lines"]) if len(l) >= 2]}
            if r["lines"]:
                (routes if kind == "relation" else loose).append(r)
    chained = _chain_ways(loose)
    stats["chained"] = len(loose) - len(chained)
    routes += chained
    _classify(routes)
    for r in routes:
        r["type"] = "sea" if r["sea"] >= SEA_MIN else "lake" if r["lake"] >= LAKE_MIN else "river"
    stats.update(r["type"] for r in routes)
    routes = [r for r in routes if r["type"] != "river"]
    before = len(routes)
    routes = _dedupe(routes)
    stats["duplicates"] = before - len(routes)
    print(f"  排除：{dict(stats)}；留下 {len(routes):,} 條航線")

    # 國家：所有線段的端點（停靠的港口）
    ends = [(r, p) for r in routes for line in r["lines"] for p in (line[0], line[-1])]
    codes = countries_at([p[0] for _, p in ends], [p[1] for _, p in ends])
    owners: dict[int, list[str]] = defaultdict(list)
    for (r, _), c in zip(ends, codes):
        if c and c not in owners[id(r)]:
            owners[id(r)].append(c)
    for r in routes:
        r["countries"] = owners[id(r)]
        r["t"] = TYPES["lake"] if r["type"] == "lake" else TYPES["international"] if len(r["countries"]) > 1 else TYPES["domestic"]
    counts: Counter = Counter(c for r in routes for c in r["countries"])

    # 台灣：對照航港局
    taiwan = [r for r in routes if "TWN" in r["countries"]]
    pairs = mpb_pairs()
    missing = match_mpb(taiwan, pairs)
    total = sum(pairs.values())
    print(f"  台灣 {len(taiwan)} 條；航港局 {MPB_SHEET} {len(pairs)} 組港口、{total:,} 班，OSM 沒有的 {len(missing)} 組：{missing}")

    # 線：湖上先畫、跨國最後畫（疊在上面）
    order = sorted(range(len(routes)), key=lambda i: (-routes[i]["t"], -(routes[i]["km"] or 0)))
    lines, types, records, groups, boxes = [], [], [], [], {}
    for gi, i in enumerate(order):
        r = routes[i]
        t = r["tags"]
        for line in r["lines"]:
            pts = _unwrap(line)
            lines.append(pts)
            types.append(r["t"])
            records.append({"r": gi})
            xs, ys = [x for x, _ in pts], [y for _, y in pts]
            b = boxes.get(gi)
            boxes[gi] = (min(xs + ([b[0]] if b else [])), min(ys + ([b[1]] if b else [])),
                         max(xs + ([b[2]] if b else [])), max(ys + ([b[3]] if b else [])))
        car = t.get("motor_vehicle") in ("yes", "designated", "permissive") or t.get("motorcar") == "yes" or t.get("hgv") == "yes"
        r["group"] = {
            "r": gi, "n": t.get("name") or t.get("ref") or "", "e": t.get("name:en"), "z": _name_zh(t),
            "op": t.get("operator"), "du": t.get("duration"), "km": round(r["km"], 1) if r["km"] < 10 else round(r["km"]),
            "t": r["t"], "car": 1 if car else 0, "sn": 1 if t.get("seasonal") not in (None, "no") else 0,
            "c": ",".join(r["countries"][:6]), "m": r.get("mpb"),
        }
        r["gi"] = gi
        groups.append(r["group"])
    fields = ["r", "n", "e", "z", "op", "du", "km", "t", "car", "sn", "c", "m"]
    scale = {"r": 1, "km": 0.1, "t": 1, "car": 1, "sn": 1, "m": 1}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "ferries.json", lines_file(
        lines, QUANTUM, types, records=records, record_fields=["r"], record_scale={"r": 1}, record_delta=["r"],
        groups=("r", points_file(groups, fields, scale, ("r",), ("op", "c"))),
    ))

    notes = {"TWN": _taiwan_note(len(taiwan), pairs, missing, "zh")}
    notes_en = {"TWN": _taiwan_note(len(taiwan), pairs, missing, "en")}
    write_json(OUT / "ferries-count.json", indicator_file(
        "ferries", "routes", [YEAR], {c: [n] for c, n in sorted(counts.items())}, license=LICENSE,
        notes=notes, notesEn=notes_en,
    ))

    # 清單：台灣的航線（依長度），有維基百科條目的其他航線（依長度）
    listed = []
    wiki = [r for r in routes if "TWN" not in r["countries"]
            and any(k in r["tags"] for k in ("wikipedia", "wikidata", "name:wikipedia"))]
    for g, chosen in ((1, taiwan), (2, wiki)):
        for r in sorted(chosen, key=lambda r: -(r["km"] or 0)):
            w, s, e, n = boxes[r["gi"]]
            listed.append({"lon": (w + e) / 2, "lat": (s + n) / 2, "bw": w, "bs": s, "be": e, "bn": n, "g": g, **r["group"]})
    write_json(OUT / "ferries-list.json", points_file(
        listed, ["lon", "lat", "bw", "bs", "be", "bn", "g", *fields],
        {"lon": 0.01, "lat": 0.01, "bw": 0.01, "bs": 0.01, "be": 0.01, "bn": 0.01, "g": 1, **scale}, (), ("op", "c"),
    ))
    write_manifest_part(OUT, "shipping", "ferries", {
        "license": LICENSE,
        "sources": ["OpenStreetMap contributors (ODbL 1.0), route=ferry via Overpass API (2026-10-31)",
                    "交通部航港局「國內固定航班資訊(20260701-20260831)」（data.gov.tw 8236，政府資料開放授權條款第 1 版）"],
    })
    top = counts.most_common(12)
    print(f"  {len(lines):,} 條線、{sum(len(l) for l in lines):,} 個頂點；航線最多 {top}；台灣 {counts.get('TWN')}；"
          f"清單 台灣 {len(taiwan)}、維基 {len(wiki)}")


def _taiwan_note(n: int, pairs: Counter, missing: list, lang: str) -> str:
    total = sum(pairs.values())
    top = pairs.most_common(1)[0]
    if lang == "zh":
        miss = "、".join(f"{a}—{b}（{k} 班）" for a, b, k in missing[:6])
        return (f"OSM 在台灣（含金門、馬祖、澎湖與往返對岸、日本的）有 {n} 條渡輪航線。交通部航港局的國內固定航班："
                f"2026 年 7–8 月共 {total:,} 班、{len(pairs)} 組港口，最多的是{top[0][0]}—{top[0][1]} {top[1]:,} 班"
                + (f"；OSM 的航線名稱對不到的港口對有 {len(missing)} 組（可能沒畫，或併在別的航線裡），例如{miss}" if missing else "，OSM 都有") + "。")
    miss = "; ".join(f"{a}–{b} ({k} sailings)" for a, b, k in missing[:6])
    return (f"OSM has {n} ferry routes in Taiwan (including Kinmen, Matsu, Penghu and routes to mainland China and Japan). "
            f"The Maritime and Port Bureau’s domestic timetable lists {total:,} sailings between {len(pairs)} pairs of ports in July–August 2026"
            + (f"; {len(missing)} of the pairs cannot be matched by name to an OSM route (missing, or part of another route)." if missing else "; OSM has all of them."))
