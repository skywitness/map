"""地震與火山主題：USGS 地震目錄、NOAA NCEI 重大地震的死亡人數、Smithsonian GVP 全新世火山、PB2002 板塊邊界。

地圖上的點：
- quakes.json：規模 6 以上（1900 年起，約 1.4 萬筆），依時間排序，年份差分編碼。
- quakes-m5.json：規模 5–6（1973 年起，約 8 萬筆），預設關閉，打開才下載。
- volcanoes.json：全新世火山（約 1,200 座）；plates.json：板塊邊界（依聚合、張裂、轉形分類）。

國家統計（`indicator_file()`）：
- 規模 6 以上的地震次數：逐年（count-year.json）、累積（count-cumulative.json）、每十年（count-decade.json）。
- 地震死亡人數（每十年，deaths-decade.json）：NOAA 的重大地震，所有規模。
- 全新世火山數（volcanoes-count.json，單一快照）。

**國家歸屬**（OffshoreIndex）：震央或火山在國界內就算那一國，在海上的算給 50 公里內最近的國家，
再遠的不算任何國家（深海、洋脊上的地震）。國界跟人口框選、海拔主題一樣用 `population_grid.country_shapes()`
（地圖本身的 1:50m 國界，法國海外省等依聯合國的劃分拆開）。例外：離岸超過 50 公里、但 NOAA 記錄有人死亡的地震，
改算在 NOAA 記錄的國家（例如 2011 年東北地方太平洋近海地震，震央離 1:50m 的海岸 70 多公里）。
火山在 50 公里內找不到國界的（1:50m 沒有形狀的小島）用 GVP 的國名，屬地見 TERRITORIES。

**死亡人數的對應**：NOAA 的事件跟 USGS 的地震依時間（5 分鐘內）與距離（300 公里內）配對，
只有日期、沒有時刻的舊事件改用同一天（前後 1 天）、150 公里內規模最接近的；時刻差 1 分鐘內、規模差 0.3 以內的
不管距離也算（NOAA 偶爾把經度的正負號寫反）。
"""
from __future__ import annotations

import gzip
import json
import math
from collections import defaultdict
from datetime import date

import numpy as np

from common import OUT_DIR, indicator_file, lines_file, now_iso, points_file, write_json
from sources import gvp, ncei, plates, usgs
from sources.countries import ISO3, from_name
from topics.population_grid import country_shapes

OUT = OUT_DIR / "topics" / "earthquakes"
START_YEAR = 1900
M5_START_YEAR = 1973  # USGS 的全球目錄（PDE）從 1973 年起規模 5 才大致完整
OFFSHORE_KM = 50
ISLAND_KM = 300  # 火山：1:50m 沒有形狀的小島，找這個距離內最近的國家
KM_PER_DEG = 111.195
JOIN_SECONDS = 300
JOIN_KM = 300
JOIN_KM_DATE_ONLY = 150

# NOAA 的國名（大寫英文）中 sources.countries.from_name 查不到或會查錯的
NOAA_COUNTRY = {
    "USA": "USA", "USA TERRITORY": None, "UK": "GBR", "RUSSIA": "RUS", "TAIWAN": "TWN", "CHINA": "CHN",
    "SOUTH KOREA": "KOR", "NORTH KOREA": "PRK", "IRAN": "IRN", "SYRIA": "SYR", "TURKEY": "TUR", "VIETNAM": "VNM",
    "MYANMAR (BURMA)": "MMR", "MYANMAR": "MMR", "BURMA": "MMR", "LAOS": "LAO", "BOLIVIA": "BOL", "VENEZUELA": "VEN",
    "TANZANIA": "TZA", "CONGO": "COG", "DEMOCRATIC REPUBLIC OF THE CONGO": "COD", "ZAIRE": "COD",
    "IVORY COAST": "CIV", "MACEDONIA": "MKD", "NORTH MACEDONIA": "MKD", "CZECH REPUBLIC": "CZE",
    "BOSNIA-HERZEGOVINA": "BIH", "SERBIA AND MONTENEGRO": "SRB", "YUGOSLAVIA": "SRB", "USSR": "RUS",
    "KYRGYZSTAN": "KGZ", "MOLDOVA": "MDA", "PALESTINE": "PSE", "WEST BANK": "PSE", "GAZA": "PSE",
    "ST. VINCENT": "VCT", "ST. KITTS & NEVIS": "KNA", "ST. LUCIA": "LCA", "MICRONESIA, FED. STATES OF": "FSM",
    "MICRONESIA": "FSM", "EAST TIMOR": "TLS", "TIMOR-LESTE": "TLS", "CAPE VERDE": "CPV", "KERMADEC ISLANDS": "NZL",
    "AZORES (PORTUGAL)": "PRT", "AZORES": "PRT", "MADEIRA ISLANDS": "PRT", "CANARY ISLANDS": "ESP", "CRETE": "GRC",
    "BALEARIC ISLANDS": "ESP", "SPAIN": "ESP", "MARTINIQUE (FRENCH TERRITORY)": "MTQ", "GUADELOUPE": "GLP",
    "REUNION": "REU", "NEW CALEDONIA": "NCL", "WALLIS AND FUTUNA (FRENCH TERRITORY)": "WLF", "FRENCH POLYNESIA": "PYF",
    "NORTHERN MARIANA ISLANDS": "MNP", "GUAM": "GUM", "AMERICAN SAMOA": "ASM", "SAMOA": "WSM", "PUERTO RICO": "PRI",
    "VIRGIN ISLANDS": "VIR", "HAITI": "HTI", "DOMINICAN REPUBLIC": "DOM", "SOLOMON ISLANDS": "SLB",
    "PAPUA NEW GUINEA": "PNG", "PHILIPPINES": "PHL", "INDONESIA": "IDN", "JAPAN": "JPN", "AFGHANISTAN": "AFG",
    "ANTARCTICA": "ATA", "SOUTH GEORGIA AND THE SOUTH SANDWICH ISLANDS": "SGS", "SVALBARD": "SJM",
    "JAN MAYEN": "SJM", "BERING SEA": None, "ATLANTIC OCEAN": None, "PACIFIC OCEAN": None, "INDIAN OCEAN": None,
    "MEDITERRANEAN SEA": None, "NORTH ATLANTIC OCEAN": None, "SOUTH ATLANTIC OCEAN": None,
    "SOLOMON SEA": None, "KERMADEC ISLANDS (NEW ZEALAND)": "NZL", "UK TERRITORY": None,
}

# GVP 的國名（混在兩國之間的寫成 Chile-Argentina，取第一個；海底火山是 Undersea Features）
GVP_COUNTRY = {"Undersea Features": None, "Japan - administered by Russia": "RUS", "Turkiye": "TUR"}

# GVP 把海外屬地的火山寫成本國（南三明治群島寫 United Kingdom、北馬里亞納寫 United States），
# 最近的國家是這些屬地時改用屬地；是別的國家時（東加北部的火山離薩摩亞比較近）照 GVP 的國名
TERRITORIES = {
    "USA": {"MNP", "GUM", "ASM", "PRI", "VIR", "UMI"},
    "FRA": {"PYF", "ATF", "MYT", "REU", "GLP", "MTQ", "NCL", "WLF", "GUF", "SPM", "BLM", "MAF"},
    "GBR": {"SGS", "PCN", "SHN", "MSR", "FLK", "BMU", "VGB", "CYM", "TCA", "AIA", "IOT"},
    "NZL": {"COK", "NIU", "TKL"},
    "AUS": {"HMD", "NFK", "CXR", "CCK"},
    "NOR": {"SJM", "BVT"},
    "NLD": {"BES", "CUW", "ABW", "SXM"},
    "DNK": {"GRL", "FRO"},
}
# 300 公里內找不到屬地形狀的遠洋小島（GVP 火山編號 → 屬地）
VOLCANO_TERRITORY = {
    234000: "ATF", 234001: "ATF", 234002: "ATF",  # 阿姆斯特丹島、聖保羅島（法屬南部領地）
    258010: "NCL", 258020: "NCL",  # 馬修島、杭特島：法國劃入新喀里多尼亞，萬那杜也主張主權
    333060: "PYF",  # 麥克唐納海山（法屬玻里尼西亞南方群島）
    376010: "SJM", 386020: "BVT",  # 揚馬延島、布威島（挪威）
    386010: "SHN", 386011: "SHN",  # 特里斯坦達庫尼亞、南丁格爾島（聖赫勒拿、阿森松與特里斯坦達庫尼亞）
}


# ── 國家歸屬：國界內，或 50 公里內最近的國家 ──────────────────────────
class OffshoreIndex:
    """經緯度 → ISO alpha-3。國界內的直接算；在海上的找 max_km 內最近的國界線段，以 1° 網格分區查詢。"""

    CELL = 1.0

    def __init__(self, max_km: float = OFFSHORE_KM):
        self.max_km = max_km
        self.codes: list[str] = []
        self.polygons: list[tuple[int, tuple[float, float, float, float], list[np.ndarray]]] = []
        segments: list[np.ndarray] = []
        for code, polygons in country_shapes().items():
            if code not in ISO3:  # _SIA（錫亞琴冰川）這類爭議地區不算任何國家，落在裡面的點改找 50 公里內最近的國家
                continue
            index = len(self.codes)
            self.codes.append(code)
            for polygon in polygons:
                rings = [np.asarray(ring, dtype=float) for ring in polygon]
                outer = rings[0]
                box = (outer[:, 0].min(), outer[:, 1].min(), outer[:, 0].max(), outer[:, 1].max())
                self.polygons.append((index, box, rings))
                for ring in rings:
                    seg = np.column_stack([ring[:-1], ring[1:], np.full(len(ring) - 1, index)])
                    segments.append(seg)
        seg = np.concatenate(segments)
        # 換日線附近的點也要找得到另一側的國界：經度在 ±179° 以外的線段另外補一份平移 360° 的
        east = seg[(seg[:, 0] > 179) | (seg[:, 2] > 179)].copy()
        east[:, [0, 2]] -= 360
        west = seg[(seg[:, 0] < -179) | (seg[:, 2] < -179)].copy()
        west[:, [0, 2]] += 360
        self.segments = np.concatenate([seg, east, west])
        self._cells = self._index_segments()

    def _index_segments(self) -> dict[tuple[int, int], np.ndarray]:
        s = self.segments
        margin_lat = self.max_km / KM_PER_DEG
        lat_abs = np.minimum(np.maximum(np.abs(s[:, 1]), np.abs(s[:, 3])), 85)
        margin_lon = np.minimum(margin_lat / np.cos(np.radians(lat_abs)), 10)
        x0 = np.floor((np.minimum(s[:, 0], s[:, 2]) - margin_lon) / self.CELL).astype(int)
        x1 = np.floor((np.maximum(s[:, 0], s[:, 2]) + margin_lon) / self.CELL).astype(int)
        y0 = np.floor((np.minimum(s[:, 1], s[:, 3]) - margin_lat) / self.CELL).astype(int)
        y1 = np.floor((np.maximum(s[:, 1], s[:, 3]) + margin_lat) / self.CELL).astype(int)
        cells: dict[tuple[int, int], list[int]] = defaultdict(list)
        for i in range(len(s)):
            for cx in range(x0[i], x1[i] + 1):
                for cy in range(y0[i], y1[i] + 1):
                    cells[(cx, cy)].append(i)
        return {k: np.asarray(v) for k, v in cells.items()}

    @staticmethod
    def _inside(ring: np.ndarray, px: np.ndarray, py: np.ndarray) -> np.ndarray:
        """射線法，所有點一起算（ring 頭尾相同）"""
        out = np.zeros(len(px), dtype=bool)
        xi, yi, xj, yj = ring[:-1, 0], ring[:-1, 1], ring[1:, 0], ring[1:, 1]
        step = max(1, 2_000_000 // max(len(xi), 1))
        with np.errstate(divide="ignore", invalid="ignore"):
            for k in range(0, len(px), step):
                x, y = px[k : k + step, None], py[k : k + step, None]
                cross = ((yi > y) != (yj > y)) & (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
                out[k : k + step] = cross.sum(axis=1) % 2 == 1
        return out

    def assign(self, lon: list[float], lat: list[float]) -> list[str | None]:
        px, py = np.asarray(lon, dtype=float), np.asarray(lat, dtype=float)
        result = np.full(len(px), -1)
        for index, (x0, y0, x1, y1), rings in self.polygons:
            m = np.flatnonzero((result < 0) & (px >= x0) & (px <= x1) & (py >= y0) & (py <= y1))
            if not len(m):
                continue
            inside = self._inside(rings[0], px[m], py[m])
            for hole in rings[1:]:
                inside &= ~self._inside(hole, px[m], py[m])
            result[m[inside]] = index
        # 海上的點：同一個 1° 網格的點一起算到附近線段的距離（局部等距投影，經度乘 cos 緯度）
        todo = np.flatnonzero(result < 0)
        groups: dict[tuple[int, int], list[int]] = defaultdict(list)
        for i in todo:
            groups[(math.floor(px[i] / self.CELL), math.floor(py[i] / self.CELL))].append(i)
        s = self.segments
        for cell, idx in groups.items():
            cand = self._cells.get(cell)
            if cand is None:
                continue
            idx = np.asarray(idx)
            seg = s[cand]
            x, y = px[idx, None], py[idx, None]
            k = np.cos(np.radians(y))
            ax, ay = (seg[:, 0] - x) * k, seg[:, 1] - y
            bx, by = (seg[:, 2] - x) * k, seg[:, 3] - y
            dx, dy = bx - ax, by - ay
            length2 = dx * dx + dy * dy
            with np.errstate(divide="ignore", invalid="ignore"):
                t = np.clip(np.where(length2 > 0, -(ax * dx + ay * dy) / length2, 0), 0, 1)
            d2 = (ax + t * dx) ** 2 + (ay + t * dy) ** 2
            best = d2.argmin(axis=1)
            km = np.sqrt(d2[np.arange(len(idx)), best]) * KM_PER_DEG
            near = km <= self.max_km
            result[idx[near]] = seg[best[near], 4].astype(int)
        return [self.codes[r] if r >= 0 else None for r in result]

    def nearest(self, lon: float, lat: float, max_km: float) -> str | None:
        """max_km 內最近的國家（逐一比對所有國界線段，只給少數點用）"""
        s = self.segments
        k = math.cos(math.radians(lat))
        ax, ay = (s[:, 0] - lon) * k, s[:, 1] - lat
        dx, dy = (s[:, 2] - lon) * k - ax, s[:, 3] - lat - ay
        length2 = dx * dx + dy * dy
        with np.errstate(divide="ignore", invalid="ignore"):
            t = np.clip(np.where(length2 > 0, -(ax * dx + ay * dy) / length2, 0), 0, 1)
        d2 = (ax + t * dx) ** 2 + (ay + t * dy) ** 2
        best = int(d2.argmin())
        return self.codes[int(s[best, 4])] if math.sqrt(d2[best]) * KM_PER_DEG <= max_km else None


def noaa_iso3(name: str) -> str | None:
    if not name:
        return None
    if name in NOAA_COUNTRY:
        return NOAA_COUNTRY[name]
    return from_name(name.title())


# GVP 的構造環境（Tectonic_Setting，「Intraplate / Oceanic crust (< 15 km)」）→ 代碼（src/topics/earthquakes.ts 的 TECTONIC、CRUST）
TECTONIC = {"Subduction zone": 1, "Rift zone": 2, "Intraplate": 3}
CRUST = {"Continental crust": 1, "Intermediate crust": 2, "Oceanic crust": 3}


def tectonic(setting: str) -> dict[str, int]:
    """{"ts": 構造環境, "crust": 地殼}，不明是 0（熱點火山：板塊內部的火山另外上色，2026-10-30）"""
    zone, _, crust = (part.strip() for part in setting.partition("/"))
    if zone and zone not in TECTONIC:
        raise ValueError(f"GVP 的構造環境認不得：{setting}")
    crust = crust.split(" (")[0]
    return {"ts": TECTONIC.get(zone, 0), "crust": CRUST.get(crust, 0)}


def gvp_iso3(name: str) -> str | None:
    if name in GVP_COUNTRY:
        return GVP_COUNTRY[name]
    return from_name(name.split("-")[0])


def _km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(min(1.0, math.sqrt(h)))


def join_deaths(quakes: list[usgs.Quake], events: list[ncei.Event]) -> dict[str, ncei.Event]:
    """NOAA 事件 → USGS 地震（一對一）：先配時間與距離都對得上的，同一筆 USGS 地震只配給分數最好的 NOAA 事件。"""
    times = np.asarray([q.time for q in quakes])
    candidates: list[tuple[float, str, int]] = []  # (分數, USGS id, NOAA id)
    by_day: dict[tuple[int, int, int], list[usgs.Quake]] = defaultdict(list)
    for q in quakes:
        by_day[(q.year, q.month, q.day)].append(q)
    for e in events:
        if e.lon is None or e.lat is None:
            continue
        if e.time is not None:
            lo, hi = np.searchsorted(times, [e.time - JOIN_SECONDS, e.time + JOIN_SECONDS])
            for q in quakes[lo:hi]:
                d = _km(e.lon, e.lat, q.lon, q.lat)
                dt = abs(q.time - e.time)
                if d <= JOIN_KM and (e.mag is None or abs(e.mag - q.mag) <= 1.2):
                    candidates.append((dt / 60 + d / 100, q.id, e.id))
                elif dt <= 60 and e.mag is not None and abs(e.mag - q.mag) <= 0.3:
                    # NOAA 的座標偶爾正負號寫反（2026 年哥倫比亞地震記成東經 76°），時刻與規模都對得上就照樣配對
                    candidates.append((50 + dt / 60, q.id, e.id))
        elif e.month and e.day:
            day = date(e.year, e.month, e.day)
            for offset in (-1, 0, 1):
                dd = date.fromordinal(day.toordinal() + offset)
                for q in by_day.get((dd.year, dd.month, dd.day), []):
                    d = _km(e.lon, e.lat, q.lon, q.lat)
                    if d <= JOIN_KM_DATE_ONLY:
                        candidates.append((10 + abs(offset) * 5 + d / 100 + abs((e.mag or q.mag) - q.mag) * 3, q.id, e.id))
    candidates.sort()
    by_noaa = {e.id: e for e in events}
    used_quake: set[str] = set()
    used_event: set[int] = set()
    out: dict[str, ncei.Event] = {}
    for _score, qid, eid in candidates:
        if qid in used_quake or eid in used_event:
            continue
        used_quake.add(qid)
        used_event.add(eid)
        out[qid] = by_noaa[eid]
    return out


# ── 輸出 ──────────────────────────────────────────────────────────
def _size(data: object) -> str:
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return f"{len(raw) / 1024:.0f} KB，gzip 後 {len(gzip.compress(raw, 9)) / 1024:.0f} KB"


def _noaa_place(e: ncei.Event) -> str:
    """「TAIWAN:  NANTOU, TAICHUNG」→「Nantou, Taichung」（去掉國名，改成首字大寫）"""
    place = e.location.split(":", 1)[1] if ":" in e.location else e.location
    return " ".join(w.capitalize() if w.isupper() else w for w in place.split()).strip(" ,;")


def quake_rows(quakes: list[usgs.Quake], iso3: list[str | None], deaths: dict[str, int], with_place: bool) -> list[dict]:
    rows = []
    for q, country in zip(quakes, iso3):
        row = {
            "lon": q.lon, "lat": q.lat, "year": q.year, "md": q.month * 100 + q.day,
            "mag": q.mag, "depth": q.depth, "deaths": deaths.get(q.id), "iso3": country,
        }
        if with_place:
            row["place"] = q.place or None
        rows.append(row)
    return rows


def build() -> None:
    this_year = date.today().year
    years = list(range(START_YEAR, this_year + 1))
    decades = list(range(START_YEAR, this_year + 1, 10))
    index = OffshoreIndex()

    # ── 地震 ──
    m6 = usgs.events(6, None, START_YEAR, 25)
    m5 = [q for q in usgs.events(5, 6, M5_START_YEAR, 5) if q.mag < 6]
    print(f"  USGS：規模 6 以上 {len(m6)} 筆（{START_YEAR} 年起）、規模 5–6 {len(m5)} 筆（{M5_START_YEAR} 年起）")
    events = ncei.earthquakes(START_YEAR)
    allq = sorted(m6 + m5, key=lambda q: q.time)
    joined = join_deaths(allq, events)
    deaths = {qid: e.deaths for qid, e in joined.items() if e.deaths is not None}
    deadly = [e for e in events if e.deaths]
    matched_ids = {e.id for e in joined.values()}
    print(f"  NOAA：{len(events)} 筆重大地震，{len(deadly)} 筆有死亡人數；"
          f"{len(joined)} 筆對到 USGS（有死亡人數的 {sum(1 for e in deadly if e.id in matched_ids)} 筆）")
    missing = [e for e in deadly if e.id not in matched_ids and (e.mag or 0) >= 6.5 and e.deaths >= 100]
    for e in sorted(missing, key=lambda e: -e.deaths)[:10]:
        print(f"    沒對到 USGS 的：{e.year}-{e.month}-{e.day} M{e.mag} {e.location} {e.deaths} 人")

    def attribute(quakes: list[usgs.Quake]) -> list[str | None]:
        codes = index.assign([q.lon for q in quakes], [q.lat for q in quakes])
        out = []
        for q, code in zip(quakes, codes):
            e = joined.get(q.id)
            if code is None and e is not None and e.deaths:
                code = noaa_iso3(e.country)  # 離岸超過 50 公里，但 NOAA 記錄有人死亡
            out.append(code)
        return out

    m6_iso3 = attribute(m6)
    m5_iso3 = attribute(m5)
    points = points_file(
        quake_rows(m6, m6_iso3, deaths, with_place=True),
        ["lon", "lat", "year", "md", "mag", "depth", "deaths", "iso3", "place"],
        {"lon": 0.01, "lat": 0.01, "year": 1, "md": 1, "mag": 0.1, "depth": 1, "deaths": 1},
        delta=("year",))
    write_json(OUT / "quakes.json", points)
    print(f"    規模 6 以上：{_size(points)}")
    m5_rows = quake_rows(m5, m5_iso3, deaths, with_place=False)
    for row in m5_rows:
        row["mag"] = min(round(row["mag"], 1), 5.9)  # 5.95–5.99 不要四捨五入成 6.0
    points5 = points_file(
        m5_rows, ["lon", "lat", "year", "md", "mag", "depth", "deaths", "iso3"],
        {"lon": 0.01, "lat": 0.01, "year": 1, "md": 1, "mag": 0.1, "depth": 1, "deaths": 1},
        delta=("year",))
    write_json(OUT / "quakes-m5.json", points5)
    print(f"    規模 5–6：{_size(points5)}")

    # ── 國家統計：規模 6 以上的次數 ──
    codes = set(index.codes) | {c for c in m6_iso3 if c}
    per_year: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    world_year: dict[int, int] = defaultdict(int)
    for q, code in zip(m6, m6_iso3):
        world_year[q.year] += 1
        if code:
            per_year[code][q.year] += 1

    def series(counts: dict[int, int], ys: list[int], span: int = 1) -> list[float]:
        return [sum(counts.get(y + k, 0) for k in range(span)) for y in ys]

    def cumulative(counts: dict[int, int]) -> list[float]:
        total, out = 0, []
        for y in years:
            total += counts.get(y, 0)
            out.append(total)
        return out

    write_json(OUT / "count-year.json", indicator_file(
        "count-year", "次", years, {c: series(per_year[c], years) for c in sorted(codes)},
        aggregates={"WLD": series(world_year, years)}))
    write_json(OUT / "count-cumulative.json", indicator_file(
        "count-cumulative", "次", years, {c: cumulative(per_year[c]) for c in sorted(codes)},
        aggregates={"WLD": cumulative(world_year)}))
    write_json(OUT / "count-decade.json", indicator_file(
        "count-decade", "次", decades, {c: series(per_year[c], decades, 10) for c in sorted(codes)},
        aggregates={"WLD": series(world_year, decades, 10)}))

    # ── 國家統計：死亡人數（NOAA，所有規模） ──
    # 對到 USGS 的事件用地圖上那個點的國家（USGS 的位置比較準），其他的用 NOAA 的位置，再不行用 NOAA 的國名
    quake_country = {q.id: c for q, c in zip(m6 + m5, m6_iso3 + m5_iso3)}
    event_country: dict[int, str | None] = {e.id: quake_country.get(qid) for qid, e in joined.items()}
    unmatched = [e for e in deadly if e.id not in event_country and e.lon is not None and e.lat is not None]
    for e, code in zip(unmatched, index.assign([e.lon for e in unmatched], [e.lat for e in unmatched])):
        event_country[e.id] = code
    quake_by_id = {q.id: q for q in allq}
    quake_of_event = {e.id: quake_by_id[qid] for qid, e in joined.items()}
    death_decade: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    world_deaths: dict[int, int] = defaultdict(int)
    deadliest: dict[str, list] = defaultdict(list)
    lost = 0
    for e in deadly:
        code = event_country.get(e.id) or noaa_iso3(e.country)
        world_deaths[e.year] += e.deaths
        if not code:
            lost += e.deaths
            continue
        codes.add(code)
        death_decade[code][e.year] += e.deaths
        q = quake_of_event.get(e.id)
        # 對到 USGS 的用 USGS 的日期（UTC）與規模，跟地圖上的點一致
        mag = q.mag if q else e.mag
        deadliest[code].append([
            q.year if q else e.year, q.month * 100 + q.day if q else (e.month or 0) * 100 + (e.day or 0),
            round(mag, 1) if mag is not None else None, e.deaths,
            (q.place if q else None) or _noaa_place(e),
        ])
    if lost:
        print(f"  {lost} 人的死亡找不到國家（NOAA 的位置在海上、國名對不到 ISO 代碼）")
    note = taiwan_note(events)
    write_json(OUT / "deaths-decade.json", indicator_file(
        "deaths-decade", "人", decades, {c: series(death_decade[c], decades, 10) for c in sorted(codes)},
        aggregates={"WLD": series(world_deaths, decades, 10)},
        notes={"TWN": note["zh"]}, notesEn={"TWN": note["en"]}))
    # 側欄的「死亡最多的地震」：每個國家前 10 筆（md 是月 × 100 + 日，NOAA 沒有日期的是 0）
    write_json(OUT / "deadliest.json", {
        "fields": ["year", "md", "mag", "deaths", "place"],
        "countries": {c: sorted(rows, key=lambda r: -r[3])[:10] for c, rows in sorted(deadliest.items())},
    })

    # ── 火山 ──
    volcanoes = gvp.holocene_volcanoes()
    # 50 公里內沒有國界的：多半是 1:50m 沒有形狀的小島（伊豆、小笠原、南三明治群島），用 GVP 的國名；
    # 300 公里內最近的是那一國的屬地時改用屬地（南三明治群島算 SGS 而不是英國）。海底的 Undersea Features 不算任何國家
    def volcano_country(v: gvp.Volcano, code: str | None) -> str | None:
        if code:
            return code
        if v.number in VOLCANO_TERRITORY:
            return VOLCANO_TERRITORY[v.number]
        own = gvp_iso3(v.country)
        near = index.nearest(v.lon, v.lat, ISLAND_KM) if own else None
        return near if near in TERRITORIES.get(own or "", ()) else own

    v_iso3 = [volcano_country(v, c) for v, c in zip(volcanoes, index.assign([v.lon for v in volcanoes], [v.lat for v in volcanoes]))]
    vdata = points_file(
        [{
            "lon": v.lon, "lat": v.lat, "vn": v.number, "name": v.name, "type": v.type or None,
            "elev": v.elevation, "last": v.last_eruption, "iso3": c, **tectonic(v.tectonic),
        } for v, c in zip(volcanoes, v_iso3)],
        ["lon", "lat", "vn", "name", "type", "elev", "last", "iso3", "ts", "crust"],
        {"lon": 0.001, "lat": 0.001, "vn": 1, "elev": 1, "last": 1}, delta=("vn",))
    write_json(OUT / "volcanoes.json", vdata)
    print(f"  GVP：全新世火山 {len(volcanoes)} 座（{_size(vdata)}），{sum(1 for c in v_iso3 if not c)} 座不屬於任何國家")
    ts = defaultdict(int)
    for v in volcanoes:
        ts[tectonic(v.tectonic)["ts"]] += 1
    print(f"  構造環境（1 隱沒帶、2 裂谷、3 板塊內部、0 不明）：{dict(sorted(ts.items()))}")
    v_count: dict[str, int] = defaultdict(int)
    for c in v_iso3:
        if c:
            v_count[c] += 1
            codes.add(c)
    write_json(OUT / "volcanoes-count.json", indicator_file(
        "volcanoes-count", "座", [this_year], {c: [v_count.get(c, 0)] for c in sorted(codes)},
        aggregates={"WLD": [len(volcanoes)]}))

    # ── 板塊邊界 ──
    lines, types = plates.boundaries()
    pdata = lines_file(lines, 0.01, types)
    write_json(OUT / "plates.json", pdata)
    print(f"  板塊邊界 {len(pdata['lines'])} 條、{sum(len(l) // 2 for l in pdata['lines'])} 個頂點（{_size(pdata)}）")

    # ── 檢查：台灣 ──
    for q, code in zip(m6, m6_iso3):
        if (q.year, q.month, q.day) in TAIWAN_CHECKS and q.mag >= 7:
            print(f"  台灣檢查：{q.year}-{q.month:02d}-{q.day:02d} M{q.mag} 深度 {q.depth} km {q.place} → {code}，"
                  f"死亡 {deaths.get(q.id)}（官方 {TAIWAN_CHECKS[(q.year, q.month, q.day)]}）")

    write_json(OUT / "manifest.json", {
        "topic": "earthquakes",
        "generatedAt": now_iso(),
        "source": "USGS ComCat (FDSN event service); NOAA NCEI Global Significant Earthquake Database; "
                  "Smithsonian GVP Volcanoes of the World (Holocene); PB2002 plate boundaries (Bird 2003, fraxen/tectonicplates)",
    })


# 台灣的兩個大地震（UTC 日期）與官方的死亡人數，建置時印出來對照
TAIWAN_CHECKS = {(1999, 9, 20): 2415, (2024, 4, 2): 18}


def taiwan_note(events: list[ncei.Event]) -> dict[str, str]:
    """台灣側欄的附註：NOAA 的數字跟官方統計對照，另外標出 NOAA 1935 年 7 月那筆可疑的死亡人數。"""
    tw = {(e.year, e.month, e.day): e.deaths for e in events if e.country == "TAIWAN" and e.deaths}
    n = lambda key: f"{tw.get(key, 0):,}"  # noqa: E731
    return {
        "zh": f"死亡人數是 NOAA 的紀錄：1999 年集集地震 {n((1999, 9, 20))} 人（官方統計 2,415 人死亡、29 人失蹤），"
              f"2024 年花蓮地震 {n((2024, 4, 2))} 人（官方 18 人）。NOAA 把 1935 年 7 月 16 日（UTC）新竹州的地震記為 "
              f"{n((1935, 7, 16))} 人死亡；這是同年 4 月新竹－台中地震（3,276 人死亡）的餘震，台灣的史料只記載"
              "數十到數百人，NOAA 的數字可能有誤，這裡照原樣呈現。",
        "en": f"Deaths are NOAA records: {n((1999, 9, 20))} for the 1999 Chi-Chi earthquake (official figures: 2,415 dead "
              f"and 29 missing) and {n((2024, 4, 2))} for the 2024 Hualien earthquake (official: 18). NOAA lists "
              f"{n((1935, 7, 16))} deaths for the Hsinchu earthquake of 16 July 1935 (UTC), far more than the tens to "
              "hundreds recorded in Taiwanese sources for this aftershock of the April 1935 Hsinchu–Taichung earthquake "
              "(3,276 dead); it may be an error but is shown as published.",
    }
