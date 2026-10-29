"""長途步道（新主題，地理類，2026-10-29，製作手冊第五批 42）：OpenStreetMap 的國際級、國家級步道路線，台灣用觀光署的步道補。

使用者 2026-10-29 決定：
- 用 OSM 的國際級、國家級路線（route=hiking，network=iwn、nwn），資料檔用 ODbL；
- 台灣用林業保育署「自然步道基本資料」與觀光署「步道」的開放資料補；
- cloud 連不到 Overpass（cloud 對外的關口在 TLS 握手後切斷），請本機 session 執行 map-plan 的
  `scripts/osm_hiking_routes.py`（查 Overpass、接線、簡化），結果放在 map-plan 的 `data/osm/hiking-routes.json`。
  在 cloud 重跑時把它複製到 `pipeline/.cache/osm/hiking-routes.json`。

- trails.json：線圖層。每條最上層路線（重疊的 way 只算給一條，國際級優先）的線，種類 1 國際級、2 國家級；
  台灣的國家步道（觀光署「步道」的 TrailClass 0，WKT 線形）也算國家級，紀錄的 s＝2 表示來源是觀光署。
- length.json：各國的步道總長（km）。每條路線的線依每一段的中點分到國家（geoindex.countries_at），
  再依「簡化前的長度 ÷ 簡化後的長度」放大（簡化會截掉彎曲）。台灣是國家步道的長度（觀光署的 TrailLength）。
- routes.json：側欄用，每條路線 [編號, 名稱, 英文名, 中文名, 代號, 種類, 總長, [[國家, 這國的長度], …]]。
"""
from __future__ import annotations

import json
import math
import zipfile
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, lines_file, now_iso, points_file, write_json
from geoindex import countries_at

OUT = OUT_DIR / "topics" / "trails"
OSM_FILE = CACHE_DIR / "osm" / "hiking-routes.json"
TW_URL = "https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/Trail-json.zip"
YEAR = 2026
QUANTUM = 0.001
TOLERANCE = 0.01  # 世界全圖用的簡化（度）
TW_TOLERANCE = 0.0005
TYPES = {"iwn": 1, "nwn": 2}
LICENSE = "ODbL 1.0"


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


def osm_routes() -> list[dict]:
    if not OSM_FILE.exists():
        raise RuntimeError(
            f"沒有 {OSM_FILE}：cloud 連不到 Overpass，請本機執行 map-plan 的 scripts/osm_hiking_routes.py，"
            "再把 map-plan 的 data/osm/hiking-routes.json 複製到這裡"
        )
    data = json.loads(OSM_FILE.read_text(encoding="utf-8"))
    routes = []
    for r in data["routes"]:
        lines = [[(l[i], l[i + 1]) for i in range(0, len(l), 2)] for l in r.get("lines", [])]
        lines = [l for l in lines if len(l) >= 2]
        if not lines:
            continue
        routes.append({**r, "lines": lines, "t": TYPES[r["network"]], "s": 1})
    return routes


def taiwan_routes() -> list[dict]:
    """觀光署「步道」的國家步道（TrailClass 0）"""
    from shapely import wkt
    from shapely.geometry import LineString, MultiLineString

    with zipfile.ZipFile(download(TW_URL, "taiwan-trails", "Trail-json.zip")) as z:
        trails = json.loads(z.read("TrailList.json").decode("utf-8-sig"))["Trails"]
    out = []
    for t in trails:
        if str(t.get("TrailClass")) != "0" or not t.get("Geometry"):
            continue
        g = wkt.loads(t["Geometry"])
        parts = list(g.geoms) if isinstance(g, MultiLineString) else [g]
        lines = []
        for p in parts:
            s = LineString([(c[0], c[1]) for c in p.coords]).simplify(TW_TOLERANCE)
            if len(s.coords) >= 2:
                lines.append([(round(x, 5), round(y, 5)) for x, y in s.coords])
        km = float(t["TrailLength"]) / 1000 if t.get("TrailLength") not in (None, "", "None") else None
        out.append({"id": t["TrailID"], "name": t["TrailName"], "name_zh": t["TrailName"], "lines": lines, "t": 2, "s": 2,
                    "km": km, "km_own": km})
    return out


def _simplify(line, tol):
    from shapely.geometry import LineString

    if len(line) < 3:
        return line
    s = LineString(line).simplify(tol, preserve_topology=False)
    return list(s.coords)


def by_country(routes: list[dict]) -> None:
    """每條路線在各國的長度（km）：每一段依中點分到國家，再依簡化前後的長度比放大"""
    mids, owners, lengths = [], [], []
    for i, r in enumerate(routes):
        for line in r["lines"]:
            for a, b in zip(line, line[1:]):
                mids.append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
                owners.append(i)
                lengths.append(_haversine(a, b))
    codes = countries_at([m[0] for m in mids], [m[1] for m in mids])
    per = [defaultdict(float) for _ in routes]
    for i, c, l in zip(owners, codes, lengths):
        if c:
            per[i][c] += l
    for r, d in zip(routes, per):
        drawn = sum(d.values())
        scale = (r["km_own"] / drawn) if r.get("km_own") and drawn else 1.0
        r["countries"] = sorted(((c, round(v * scale, 1)) for c, v in d.items() if v * scale >= 0.5), key=lambda x: -x[1])


def build() -> None:
    routes = osm_routes()
    tw = taiwan_routes()
    routes = sorted(routes, key=lambda r: (r["t"], -(r.get("km") or 0)))
    by_country(routes)
    by_country(tw)
    osm_in_taiwan = [r for r in routes if any(c == "TWN" for c, _ in r["countries"])]
    all_routes = routes + tw

    totals: dict[str, float] = defaultdict(float)
    counts: dict[str, int] = defaultdict(int)
    for r in all_routes:
        for c, km in r["countries"]:
            totals[c] += km
            counts[c] += 1
    print(f"  OSM 路線 {len(routes):,} 條（國際級 {sum(r['t'] == 1 for r in routes):,}），台灣國家步道 {len(tw)} 條；"
          f"OSM 在台灣的 {len(osm_in_taiwan)} 條")

    # 線：國家級先畫、國際級後畫（疊在上面）
    lines, types, records, groups = [], [], [], []
    order = sorted(range(len(all_routes)), key=lambda i: -all_routes[i]["t"])
    for gi, i in enumerate(order):
        r = all_routes[i]
        for line in r["lines"]:
            pts = _simplify(line, TOLERANCE if r["s"] == 1 else TW_TOLERANCE)
            if len(pts) < 2:
                continue
            lines.append(_unwrap(pts))
            types.append(r["t"])
            records.append({"r": gi})
        groups.append({"r": gi, "n": r.get("name") or r.get("ref") or "", "e": r.get("name_en"), "z": r.get("name_zh"),
                       "ref": r.get("ref"), "km": round(r["km"]) if r.get("km") else None, "t": r["t"], "s": r["s"],
                       "c": ",".join(c for c, _ in r["countries"][:6])})
    data = lines_file(
        lines, QUANTUM, types, records=records, record_fields=["r"], record_scale={"r": 1}, record_delta=["r"],
        groups=("r", points_file(groups, ["r", "n", "e", "z", "ref", "km", "t", "s", "c"], {"r": 1, "km": 1, "t": 1, "s": 1},
                                 ("r",), ("c",))),
    )
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "trails.json", data)
    values = {c: [round(v)] for c, v in sorted(totals.items()) if round(v) > 0}
    write_json(OUT / "length.json", indicator_file("length", "km", [YEAR], values, license=LICENSE,
                                                   notes={"TWN": TAIWAN_NOTE}, notesEn={"TWN": TAIWAN_NOTE_EN}))
    write_json(OUT / "routes.json", {
        "fields": ["r", "name", "en", "zh", "ref", "type", "km", "countries"],
        "rows": [[gi, r.get("name"), r.get("name_en"), r.get("name_zh"), r.get("ref"), r["t"],
                  round(r["km"], 1) if r.get("km") else None, r["countries"]] for gi, r in ((g, all_routes[i]) for g, i in enumerate(order))],
    })
    write_json(OUT / "manifest.json", {"topic": "trails", "generatedAt": now_iso(), "license": LICENSE,
                                       "sources": ["OpenStreetMap contributors (ODbL 1.0), via Overpass API", TW_URL]})
    top = sorted(((round(v), c) for c, v in totals.items()), reverse=True)[:12]
    print(f"  {len(lines):,} 條線；各國總長最多 {top}；台灣 {round(totals.get('TWN', 0))} km")


TAIWAN_NOTE = ("台灣在 OSM 沒有標成國際級、國家級的長途步道，用觀光署「步道」開放資料裡的國家步道（林業保育署管理的 24 條）補，"
               "長度是觀光署寫的長度；跟其他國家的長途步道不完全可比。")
TAIWAN_NOTE_EN = ("Taiwan has no international or national hiking routes in OSM, so its national trails (24 trails managed by the "
                  "Forestry and Nature Conservation Agency) from the Tourism Administration's open trail data are used, with their "
                  "published lengths; not fully comparable with other countries' long-distance trails.")


if __name__ == "__main__":
    build()
