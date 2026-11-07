"""菸酒的擴充：歐盟葡萄酒法定產區（PDO）的範圍（2026-11-07，製作手冊第二十四批 429 合併的候選 1047；步驟 wine-pdo，
輸出 topics/tobacco-alcohol/）。

- 資料：Oliveira Aguiar 等〈A geospatial inventory of regulatory information for wine protected designations of origin in
  Europe〉，Scientific Data 9, 394 (2022)，doi:10.1038/s41597-022-01513-0；figshare collection 5877659 的 EU_PDO.gpkg
  （1,177 個 PDO 的範圍，EPSG:3035）與 PDO_EU_id.csv（依 PDO 彙整的規格：國家、名稱、酒的類別、每公頃最高產量…）。
  兩個檔的授權都是 CC0（figshare API 的 license 欄位，2026-11-07 讀過；ndownloader.figshare.com、api.figshare.com 的
  robots.txt 都是 404），照慣例引論文。論文寫的是 2021 年底的歐盟登記簿；2024 年新制（Regulation (EU) 2024/1143）
  以後登記的不在裡面。
- 只有歐盟（加脫歐前登記的英國 3 個）：美國的 AVA、澳洲、智利、南非沒有，說明寫明是「歐盟的登記制度」。
- 範圍是用鄉鎮界拼的（規格書寫「某某鄉鎮全境」），不是葡萄園的界線；大產區裡有小產區，同一塊地可能同時屬於好幾個 PDO。
- 投影：EPSG:3035（ETRS89 / LAEA Europe）→ 經緯度，依 EPSG Guidance Note 7-2 的橢球公式自己算（EPSG 的範例
  50°N 5°E → E 3962799.45、N 2999718.85 驗過），不另外裝 pyproj。先在投影座標簡化 1 公里，再換成經緯度。
- `Registration` 有 357 個是 1973-09-18（歐盟建制前就有的產區一律寫這一天），不是產區成立的年份，所以不做時間軸。
"""
from __future__ import annotations

import csv
import math
import sqlite3
from collections import Counter

from common import CACHE_DIR, OUT_DIR, download, indicator_file, lines_file, points_file, write_json, write_manifest_part
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "tobacco-alcohol"
YEAR = 2021
GPKG = "https://ndownloader.figshare.com/files/35955185"
CSV = "https://ndownloader.figshare.com/files/35191360"
SIMPLIFY_M = 1000
MIN_AREA = (3 * SIMPLIFY_M) ** 2  # 比 3 公里見方小的塊與洞不畫
QUANTUM = 0.002

# EPSG:3035 的參數（GRS80 橢球）
_A, _F = 6378137.0, 1 / 298.257222101
_E2 = 2 * _F - _F * _F
_E = math.sqrt(_E2)
_LAT0, _LON0 = math.radians(52), math.radians(10)
_FE, _FN = 4321000.0, 3210000.0


def _q(phi: float) -> float:
    s = math.sin(phi)
    return (1 - _E2) * (s / (1 - _E2 * s * s) - (1 / (2 * _E)) * math.log((1 - _E * s) / (1 + _E * s)))


_QP = _q(math.pi / 2)
_RQ = _A * math.sqrt(_QP / 2)
_B0 = math.asin(_q(_LAT0) / _QP)
_D = _A * (math.cos(_LAT0) / math.sqrt(1 - _E2 * math.sin(_LAT0) ** 2)) / (_RQ * math.cos(_B0))


def laea_inverse(e: float, n: float) -> tuple[float, float]:
    """EPSG:3035 的 (E, N) → (經度, 緯度)"""
    x, y = e - _FE, n - _FN
    rho = math.hypot(x / _D, _D * y)
    if rho == 0:
        return math.degrees(_LON0), math.degrees(_LAT0)
    c = 2 * math.asin(rho / (2 * _RQ))
    beta = math.asin(math.cos(c) * math.sin(_B0) + (_D * y * math.sin(c) * math.cos(_B0)) / rho)
    lam = _LON0 + math.atan2(x * math.sin(c), _D * rho * math.cos(_B0) * math.cos(c) - _D * _D * y * math.sin(_B0) * math.sin(c))
    phi = (beta + (_E2 / 3 + 31 * _E2 ** 2 / 180 + 517 * _E2 ** 3 / 5040) * math.sin(2 * beta)
           + (23 * _E2 ** 2 / 360 + 251 * _E2 ** 3 / 3780) * math.sin(4 * beta) + (761 * _E2 ** 3 / 45360) * math.sin(6 * beta))
    return math.degrees(lam), math.degrees(phi)


def _geometry(blob: bytes):
    """GeoPackage 的幾何：8 位元組標頭加上依旗標而定的外框，後面是 WKB"""
    from shapely import wkb

    env = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(blob[3] >> 1) & 7]
    return wkb.loads(bytes(blob[8 + env:]))


# 酒的類別 → 位元（src/topics/wine-makers.ts 的 WINE_TYPES）；Liquer 是原檔的錯字
TYPE_BITS = {"Wine": 1, "Sparkling Wine": 2, "Quality Sparkling Wine": 4, "Quality Aromatic Sparkling Wine": 4,
             "Semi-Sparkling Wine": 8, "Aerated Semi-Sparkling Wine": 8, "Liqueur Wine": 16, "Liquer Wine": 16,
             "Wine From Raisined Grapes": 32, "Wine Of Overripe Grapes": 32, "Wine From Overripe Grapes": 32,
             "Partially Fermented Grape Must": 64, "Partially Fermented Grape Must Extracted From Raisined Grapes": 64}
# 每公頃最高產量明顯錯的不畫：Colli Romagna centrale 寫 6,635 公石、有一個寫 80,000 公斤（其他都在 222 公石、30,000 公斤以下）
MAX_HL, MAX_KG = 300, 40000


def _yield(v: str, limit: float) -> float | None:
    try:
        x = float(v)
    except ValueError:
        return None
    return x if x <= limit else None


def _types(v: str) -> int:
    bits = 0
    for t in v.split("/"):
        if t not in TYPE_BITS:
            raise RuntimeError(f"葡萄酒 PDO：認不得酒的類別 {t!r}，要加進 TYPE_BITS")
        bits |= TYPE_BITS[t]
    return bits


def build() -> None:
    from shapely.geometry import Polygon

    gpkg = download(GPKG, "wine-pdo", "EU_PDO.gpkg")
    with open(download(CSV, "wine-pdo", "PDO_EU_id.csv"), encoding="utf-8-sig", newline="") as f:
        meta = {r["PDOid"]: r for r in csv.DictReader(f)}

    lines, records, groups = [], [], []
    per_country: Counter = Counter()
    names: dict[str, list[str]] = {}
    con = sqlite3.connect(gpkg)
    rows = sorted(con.execute("SELECT PDOid, Shape FROM EU_PDO"), key=lambda r: r[0])
    for i, (pid, blob) in enumerate(rows):
        m = meta.get(pid)
        if not m:
            raise RuntimeError(f"葡萄酒 PDO：{pid} 在 PDO_EU_id.csv 裡找不到")
        iso3 = from_alpha2(m["Country"])
        if not iso3:
            raise RuntimeError(f"葡萄酒 PDO：認不得國家代碼 {m['Country']!r}")
        per_country[iso3] += 1
        names.setdefault(iso3, []).append(m["PDOnam"])
        g = _geometry(blob).simplify(SIMPLIFY_M, preserve_topology=True)
        parts = [p for p in (g.geoms if hasattr(g, "geoms") else [g]) if not p.is_empty and p.area >= MIN_AREA]
        if not parts:  # 很小的產區（一個鄉鎮）：簡化前的最大一塊照樣畫
            g0 = _geometry(blob)
            parts = [max(g0.geoms if hasattr(g0, "geoms") else [g0], key=lambda p: p.area).simplify(SIMPLIFY_M / 4)]
        hl, kg = _yield(m["Maximum_yield_hl"], MAX_HL), _yield(m["Maximum_yield_kg"], MAX_KG)
        groups.append({"r": i, "n": m["PDOnam"], "c": iso3, "t": _types(m["Category_of_wine_product"]), "hl": hl, "kg": kg, "f": 1})
        for p in parts:
            rings = [(p.exterior, 0)] + [(h, 1) for h in p.interiors if Polygon(h).area >= MIN_AREA]
            for ring, hole in rings:
                lines.append([laea_inverse(x, y) for x, y in ring.coords])
                records.append({"r": i, "k": hole})

    data = lines_file(
        lines, QUANTUM, records=records, record_fields=["r", "k"], record_scale={"r": 1, "k": 1}, record_delta=["r"],
        groups=("r", points_file(groups, ["r", "n", "c", "t", "hl", "kg", "f"], {"r": 1, "t": 1, "hl": 1, "kg": 1, "f": 1}, ("r",), ("c",))),
    )
    data["license"] = "CC0 1.0 (Oliveira Aguiar et al., Scientific Data 9, 394, 2022)"
    write_json(OUT / "wine-pdo-areas.json", data)
    hints = {c: f"歐盟登記的葡萄酒 PDO {n} 個" for c, n in per_country.items()}
    hints_en = {c: f"{n} wine PDOs registered in the EU" for c, n in per_country.items()}
    write_json(OUT / "wine-pdo.json", indicator_file(
        "wine-pdo", "個", [YEAR], {c: [n] for c, n in sorted(per_country.items())}, hints=hints, hintsEn=hints_en, license="CC0 1.0"))
    write_manifest_part(OUT, "tobacco-alcohol", "wine-pdo", {
        "sources": ["Oliveira Aguiar et al. (2022), Scientific Data 9, 394, figshare collection 5877659 (CC0 1.0)"]})
    print(f"  葡萄酒 PDO {len(rows)} 個、{len(per_country)} 國：{per_country.most_common()}；環 {len(lines)} 個、"
          f"頂點 {sum(len(x) for x in lines):,}")
    hls = sorted((g["hl"], g["n"]) for g in groups if g["hl"])
    print(f"    每公頃最高產量（公石）有 {len(hls)} 個：最低 {hls[:3]}；最高 {hls[-3:]}；"
          f"香檳 {[g for g in groups if g['n'] == 'Champagne']}")
