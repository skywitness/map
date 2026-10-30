"""飛航情報區與防空識別區（新主題，科技與交通類，2026-10-30）：全世界的飛航情報區（面），點一區看負責的管制單位；各國管的範圍與面積。

使用者決定（2026-10-30，製作手冊第九十九節）：飛航情報區做全球（VATSpy，CC BY-SA，合併成 FIR），防空識別區只做東亞、照各國公告；寫法中性
（用 ICAO 的名稱「台北飛航情報區」）。

**飛航情報區**：VATSpy 資料專案（vatsimnetwork/vatspy-data-project，CC BY-SA 4.0，模擬飛行社群 VATSIM 維護，不是官方）的
Boundaries.geojson（1,219 個範圍）與 VATSpy.dat 的 [FIRs]（代碼與名稱）。ICAO 本身的 FIR 檔要付費、禁止複製（不能用）；
FAA 的 Boundary_Airspace 只有 44 個 FIR（美國附近），不夠。
- **合併**：VATSpy 把一個 FIR 切成好幾個管制扇區（RPHI-C、RKRR-N、EGTT-W…，代碼是「FIR-扇區」），只取 FIR 本身那一個範圍
  （代碼沒有「-」的）；沒有本身範圍的（LGMD）把扇區聯集起來。不是四個字母的 ICAO 代碼的（ADR、BAIRES、GUY、NAT、TEH、UKR，
  VATSIM 自己的合併管制區）不收，那些地方另外有各 FIR 自己的範圍。
- **限制**（使用者 2026-10-30 決定照 VATSpy 畫並寫明）：VATSpy 依 VATSIM 的管制單位畫，有些國家是區域管制中心或扇區、
  不是 ICAO 的 FIR（澳洲 76 個扇區、中國 24 個區域管制中心、印度 21 個，日本、紐西蘭也是），照 VATSpy 的單位畫，說明寫明；
  國家的指標只用「管的空域面積」，不受切法影響。代碼 X 開頭的（XVCL 湄公，VATSIM 的合併管制區）不收。
- **防空識別區**：只做東亞，照各國公告分別畫、互相重疊照畫、不評論（座標與出處見 `sources/adiz.py`）。公告裡沿著海岸線的部分近似：
  - 日本：環（外側線扣掉內側線）。外側線 ⑽–⑾ 是與那國島（Natural Earth 1:10m 的島形）往外 14 海里、取直線西側的那一段；
    (24)–(25)、(26)–(27) 兩小段「北海道海岸線外 3 海里」用直線（只差幾公里）。內側線 ⑽–⑾ 是半徑 100 海里的圓弧（大圓距離）。
  - 中國：六點連線與「領海線」之間。領海線用 Natural Earth 1:10m 中國的海岸線（含島嶼）往外 12 海里近似，六點連成的多邊形
    扣掉這個範圍；第 6 點到第 1 點的直線本身在陸地上。中國的領海基線是直線基線，實際的領海線在部分海域更外面。
  - 韓國、台灣：照列出的頂點直線連起來。台灣的範圍也涵蓋福建的一部分，照公告畫。
- **跨 180° 經線**的範圍（奧克蘭海洋、斐濟、安克拉治…）VATSpy 切成兩半，西半球那一半的經度加 360° 後聯集，線才不會斷在 180°。
- **國家**：代碼的前兩個字母是 ICAO 的國籍字首（RC 台灣、RJ 日本、RK 韓國、K 美國…），用 OurAirports（公有領域）的機場代碼
  與所在國家統計每個字首最常見的國家（大型、中型機場）；美國、加拿大、澳洲、俄羅斯、中國這類一個字母的字首照一個字母。
- **面積**：用圓柱等積投影算（邊是經緯度的直線，跟大圓邊的誤差很小），km²；國家的面積是它所有範圍的聯集（VATSpy 的扇區有的互相重疊）。

**輸出**（public/data/topics/airspace/）：adiz.json（防空識別區的外框與面，分類 1 日本、2 韓國、3 中國、4 台灣）、firs.json（範圍的外框，封閉的環畫成半透明的面，分類 1 陸上、2 海洋；紀錄：代碼、名稱、
國家、面積）、fir-area.json（各國管的範圍面積合計，km²）。
"""
from __future__ import annotations

import csv
import json
import math
import re
from collections import Counter, defaultdict

from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.ops import unary_union

from common import CACHE_DIR, OUT_DIR, download, indicator_file, lines_file, now_iso, write_json
from sources import adiz

OUT = OUT_DIR / "topics" / "airspace"
BASE = "https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/master/"
AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"
YEAR = 2026
R = 6371.0088
# 一個字母的國籍字首（其他都是兩個字母）
ONE_LETTER = {"K": "USA", "C": "CAN", "Y": "AUS", "U": "RUS", "Z": "CHN"}
# 一個字母字首底下另外的國家（兩個字母優先）
TWO_LETTER_FIX = {"ZK": "PRK", "ZM": "MNG", "UA": "KAZ", "UB": "AZE", "UC": "KGZ", "UD": "ARM", "UG": "GEO", "UK": "UKR",
                  "UM": "BLR", "UT": "UZB"}


def _prefix_countries() -> dict[str, str]:
    import pycountry

    counts: dict[str, Counter] = defaultdict(Counter)
    with open(download(AIRPORTS_URL, "ourairports", "airports.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            code = r["icao_code"] or r["ident"]
            if r["type"] in ("large_airport", "medium_airport") and re.fullmatch(r"[A-Z]{4}", code):
                counts[code[:2]][r["iso_country"]] += 1
    out = {}
    for prefix, c in counts.items():
        a2 = c.most_common(1)[0][0]
        country = pycountry.countries.get(alpha_2=a2)
        out[prefix] = "XKX" if a2 == "XK" else (country.alpha_3 if country else None)
    return out


def _country(code: str, prefixes: dict[str, str]) -> str | None:
    if code[:2] in TWO_LETTER_FIX:
        return TWO_LETTER_FIX[code[:2]]
    if code[0] in ONE_LETTER:
        return ONE_LETTER[code[0]]
    return prefixes.get(code[:2])


def _area_km2(geom) -> float:
    """圓柱等積投影（x = R·λ、y = R·sin φ）的面積"""
    def ring_area(coords) -> float:
        pts = [(math.radians(x) * R, math.sin(math.radians(y)) * R) for x, y in coords]
        return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:]))) / 2

    polys = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    return sum(ring_area(p.exterior.coords) - sum(ring_area(i.coords) for i in p.interiors) for p in polys)


def _join_antimeridian(geom):
    """切在 ±180° 的兩半：西半球那一半加 360° 後聯集"""
    if not isinstance(geom, MultiPolygon):
        return geom
    xs = [x for p in geom.geoms for x, _ in p.exterior.coords]
    if min(xs) > -179.9 or max(xs) < 179.9:
        return geom
    parts = []
    for p in geom.geoms:
        if p.centroid.x < 0:
            p = Polygon([(x + 360, y) for x, y in p.exterior.coords], [[(x + 360, y) for x, y in i.coords] for i in p.interiors])
        parts.append(p)
    return unary_union(parts).buffer(0)


NM = 1.852  # 公里


def _to_km(lat0: float):
    """以 lat0 為準的局部等距投影（經緯度 ↔ 公里），算海岸線往外幾海里用"""
    k = math.cos(math.radians(lat0))
    fwd = lambda x, y, z=None: (x * 111.32 * k, y * 110.57)  # noqa: E731
    back = lambda x, y, z=None: (x / (111.32 * k), y / 110.57)  # noqa: E731
    return fwd, back


def _offset(geom, nm: float, lat0: float):
    from shapely.ops import transform

    fwd, back = _to_km(lat0)
    return transform(back, transform(fwd, geom).buffer(nm * NM, 64))


def _land(iso3: str):
    with open(CACHE_DIR / "natural-earth" / "ne_10m_admin_0_countries-4.1.0.geojson", encoding="utf-8") as f:
        for feat in json.load(f)["features"]:
            if feat["properties"].get("ADM0_A3") == iso3:
                return shape(feat["geometry"]).buffer(0)
    raise KeyError(iso3)


def _destination(lat: float, lon: float, bearing: float, nm: float) -> tuple[float, float]:
    p1, l1, b, d = math.radians(lat), math.radians(lon), math.radians(bearing), nm * NM / R
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(p1), math.cos(d) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), math.degrees(l2)


def _bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2, dl = math.radians(lat1), math.radians(lat2), math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return math.degrees(math.atan2(y, x)) % 360


def _arc(arc: dict, start: tuple[float, float], end: tuple[float, float]) -> list[tuple[float, float]]:
    """圓心、經過的點決定走哪一邊的圓弧；回傳 (經度, 緯度)，不含頭尾"""
    c = arc["center"]
    b0, b1, bt = (_bearing(*c, *pt) for pt in (start, end, arc["through"]))
    cw = (b1 - b0) % 360  # 順時針的角度
    through_cw = (bt - b0) % 360 < cw
    span = cw if through_cw else -((b0 - b1) % 360)
    n = max(8, int(abs(span) / 2))
    return [tuple(reversed(_destination(*c, b0 + span * i / n, arc["nm"]))) for i in range(1, n)]


def _adiz() -> list[tuple[int, str, object]]:
    lonlat = lambda pts: [(lon, lat) for lat, lon in pts]  # noqa: E731
    # 日本：外側線（與那國島那段另外聯集），內側線的 ⑽–⑾ 換成圓弧
    outer = Polygon(lonlat(adiz.JAPAN_OUTER)).buffer(0)
    a, b = adiz.JAPAN_YONAGUNI
    meridian = adiz.JAPAN_OUTER[a][1]
    japan = _land("JPN")
    yonaguni = next(p for p in japan.geoms if p.contains(Polygon([(122.95, 24.43), (123.05, 24.43), (123.05, 24.48), (122.95, 24.48)]).centroid))
    west = Polygon([(meridian - 3, 23), (meridian, 23), (meridian, 26), (meridian - 3, 26)])
    outer = unary_union([outer, _offset(yonaguni, 14, 24.45).intersection(west)])
    inner_pts = lonlat(adiz.JAPAN_INNER)
    arc = adiz.JAPAN_ARC
    inner_pts = inner_pts[:arc["from"] + 1] + _arc(arc, adiz.JAPAN_INNER[arc["from"]], adiz.JAPAN_INNER[arc["to"]]) + inner_pts[arc["to"]:]
    japan_zone = outer.difference(Polygon(inner_pts).buffer(0))
    # 中國：六點連線扣掉海岸線往外 12 海里
    china_zone = Polygon(lonlat(adiz.CHINA)).buffer(0).difference(_offset(_land("CHN"), 12, 30))
    korea = Polygon(lonlat(adiz.parse(adiz.KOREA_TEXT))).buffer(0)
    taiwan = Polygon(lonlat(adiz.parse(adiz.TAIWAN_TEXT))).buffer(0)
    return [(1, "JPN", japan_zone), (2, "KOR", korea), (3, "CHN", china_zone), (4, "TWN", taiwan)]


def build() -> None:
    with open(download(BASE + "Boundaries.geojson", "vatspy", "Boundaries.geojson"), encoding="utf-8") as f:
        features = json.load(f)["features"]
    dat = download(BASE + "VATSpy.dat", "vatspy", "VATSpy.dat").read_text(encoding="utf-8", errors="replace")
    fir_block = dat[dat.index("[FIRs]"):dat.index("[UIRs]")]
    names: dict[str, str] = {}
    for line in fir_block.splitlines():
        parts = line.split("|")
        if len(parts) >= 4 and not line.startswith(";"):
            names.setdefault(parts[0], parts[1].strip())

    own: dict[str, dict] = {}
    sectors: dict[str, list] = defaultdict(list)
    for f in features:
        fid = f["properties"]["id"]
        base = fid.split("-")[0]
        if not re.fullmatch(r"[A-Z]{4}", base) or base.startswith("X"):
            continue
        if fid == base:
            own[base] = f
        else:
            sectors[base].append(f)
    prefixes = _prefix_countries()
    rows = []
    for base in sorted(set(own) | set(sectors)):
        if base in own:
            geom, oceanic = shape(own[base]["geometry"]), own[base]["properties"].get("oceanic") == "1"
        else:
            geom = unary_union([shape(s["geometry"]) for s in sectors[base]])
            oceanic = any(s["properties"].get("oceanic") == "1" for s in sectors[base])
        geom = _join_antimeridian(geom.buffer(0))
        name = re.sub(r"\s+-\s+.*$", "", names.get(base, base))
        rows.append({"id": base, "name": name, "iso3": _country(base, prefixes), "oc": int(oceanic), "geom": geom,
                     "area": _area_km2(geom)})

    lines, records = [], []
    for r in rows:
        polys = r["geom"].geoms if isinstance(r["geom"], MultiPolygon) else [r["geom"]]
        for p in polys:
            for k, ring in enumerate([p.exterior, *p.interiors]):
                lines.append([(round(x, 3), round(y, 3)) for x, y in ring.coords])
                records.append({"id": r["id"], "name": r["name"], "iso3": r["iso3"], "oc": r["oc"],
                                "area": round(r["area"] / 1000) * 1000, "f": 1, "h": int(k > 0)})
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "firs.json", lines_file(
        lines, 0.01, types=[r["oc"] + 1 for r in records], records=records, record_fields=["id", "name", "iso3", "oc", "area", "f", "h"],
        record_scale={"oc": 1, "area": 1000, "f": 1, "h": 1}, record_strings=("id", "name", "iso3")))

    # 同一國的範圍可能重疊（VATSpy 的扇區），面積用聯集算
    count: Counter = Counter()
    geoms: dict[str, list] = defaultdict(list)
    for r in rows:
        if r["iso3"]:
            count[r["iso3"]] += 1
            geoms[r["iso3"]].append(r["geom"])
    area: Counter = Counter({c: _area_km2(unary_union(gs).buffer(0)) for c, gs in geoms.items()})
    summed = Counter()
    for r in rows:
        if r["iso3"]:
            summed[r["iso3"]] += r["area"]
    overlap = {c: round((summed[c] - area[c]) / 1e6, 1) for c in area if summed[c] - area[c] > 1e5}
    print(f"  範圍重疊（加總比聯集多，百萬 km²）：{overlap}")
    tw_area = round(area["TWN"] / 10000) * 10000
    notes = {"TWN": f"台北飛航情報區（RCAA）由交通部民用航空局負責，依 VATSpy 的範圍算約 {tw_area / 10000:.0f} 萬平方公里。"}
    notes_en = {"TWN": f"The Taipei FIR (RCAA) is run by Taiwan’s Civil Aeronautics Administration, about {tw_area:,} km² by VATSpy’s boundary."}
    write_json(OUT / "fir-area.json", indicator_file("fir-area", "km²", [YEAR], {c: [round(a)] for c, a in area.items()}, notes=notes, notesEn=notes_en))
    # ── 防空識別區 ──
    zones = _adiz()
    z_lines, z_records = [], []
    for code, iso3, geom in zones:
        polys = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
        for p in polys:
            if p.area < 1e-4:  # 扣掉海岸線後剩下的小碎片
                continue
            for k, ring in enumerate([p.exterior, *p.interiors]):
                z_lines.append([(round(x, 3), round(y, 3)) for x, y in ring.coords])
                z_records.append({"iso3": iso3, "c": code, "area": round(_area_km2(geom) / 1000) * 1000, "f": 1, "h": int(k > 0)})
    write_json(OUT / "adiz.json", lines_file(
        z_lines, 0.01, types=[r["c"] for r in z_records], records=z_records, record_fields=["iso3", "c", "area", "f", "h"],
        record_scale={"c": 1, "area": 1000, "f": 1, "h": 1}))
    write_json(OUT / "manifest.json", {"topic": "airspace", "generatedAt": now_iso(), "firs": len(rows)})
    print(f"  防空識別區：{[(iso3, round(_area_km2(g) / 1e3) * 1000) for _, iso3, g in zones]}（km²）")
    tw = [r for r in rows if r["iso3"] == "TWN"]
    print(f"  {len(rows)} 個範圍（沒有國家的 {[r['id'] for r in rows if not r['iso3']]}）")
    print(f"  範圍最多：{count.most_common(8)}；面積最大：{[(c, round(a / 1e6, 1)) for c, a in area.most_common(6)]}（百萬 km²）")
    print(f"  台灣：{[(r['id'], r['name'], round(r['area'])) for r in tw]}")


if __name__ == "__main__":
    build()
