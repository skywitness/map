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
- **防空識別區**：還沒做。cloud 讀不到各國公告的座標，使用者 2026-10-30 決定請本機 session 代為下載（日本防衛省訓令、
  中國 2013 年的聲明、韓國國防部的公告；台灣用民航局 eAIP 的 ENR 5.2），之後補上。
- **跨 180° 經線**的範圍（奧克蘭海洋、斐濟、安克拉治…）VATSpy 切成兩半，西半球那一半的經度加 360° 後聯集，線才不會斷在 180°。
- **國家**：代碼的前兩個字母是 ICAO 的國籍字首（RC 台灣、RJ 日本、RK 韓國、K 美國…），用 OurAirports（公有領域）的機場代碼
  與所在國家統計每個字首最常見的國家（大型、中型機場）；美國、加拿大、澳洲、俄羅斯、中國這類一個字母的字首照一個字母。
- **面積**：用圓柱等積投影算（邊是經緯度的直線，跟大圓邊的誤差很小），km²；國家的面積是它所有範圍的聯集（VATSpy 的扇區有的互相重疊）。

**輸出**（public/data/topics/airspace/）：firs.json（範圍的外框，封閉的環畫成半透明的面，分類 1 陸上、2 海洋；紀錄：代碼、名稱、
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

from common import OUT_DIR, download, indicator_file, lines_file, now_iso, write_json

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
    write_json(OUT / "manifest.json", {"topic": "airspace", "generatedAt": now_iso(), "firs": len(rows)})
    tw = [r for r in rows if r["iso3"] == "TWN"]
    print(f"  {len(rows)} 個範圍（沒有國家的 {[r['id'] for r in rows if not r['iso3']]}）")
    print(f"  範圍最多：{count.most_common(8)}；面積最大：{[(c, round(a / 1e6, 1)) for c, a in area.most_common(6)]}（百萬 km²）")
    print(f"  台灣：{[(r['id'], r['name'], round(r['area'])) for r in tw]}")


if __name__ == "__main__":
    build()
