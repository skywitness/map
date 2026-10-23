"""海拔主題：用 USGS GMTED2010（30 角秒，公有領域）算各國的地形統計。

- 平均海拔、高度分布（側欄的長條圖）、海拔 500／1,000／2,000 公尺以上的土地占比、平均坡度：
  用平均值網格（mn30）。每一格依緯度加權（cos 緯度），高緯度的格子比較小，才是真正的面積占比。
- 沿海低地：海拔低於 5 公尺、而且跟海相連的陸地（裏海窪地、蓋塔拉窪地這類內陸窪地不算）。
- 最高點、最低點：DEM 的最大值（mx30）、最小值（mi30）找位置，再拿 Wikidata（CC0）的各國最高點、
  最低點補上名稱與官方海拔（例如玉山主峰 3,952 m）；DEM 對不上的不採用。
- 台灣另外用內政部 100 公尺 DEM 交叉比對平均海拔與高度分布（附註寫在側欄）。

國家的範圍跟人口主題的框選網格一樣（population_grid.country_shapes）：用地圖本身的國界，
法國海外省、克里米亞、西撒哈拉等依聯合國的劃分拆開。要先跑 geo 步驟。

海拔是不隨年份變化的資料，指標檔只有一個年份（GMTED2010 的 2010），前端的主題設 timeless，不顯示時間軸。
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import rasterio
from rasterio.windows import Window
from scipy import ndimage

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import gmted, moi_dtm, wikidata
from sources.ghsl import country_codes
from topics.population_grid import OVERRIDES, bbox, country_shapes

OUT = OUT_DIR / "topics" / "elevation"
YEAR = 2010
# 側欄長條圖的高度分段（公尺）；500、1,000、2,000 以上的占比也由這裡加總
EDGES = [-math.inf, 0, 100, 200, 500, 1000, 1500, 2000, 3000, 4000, 5000, math.inf]
ABOVE = (500, 1000, 2000)
LECZ_M = 5
# 跟海相連的低地才算沿海低地：連通區塊裡至少要有這麼多格海（約 2 萬 km²，黑海這類只靠窄海峽相連的海也算）
SEA_MIN_CELLS = 20_000
ROWS = 240  # 每次讀 2° 寬的一條
MIN_CELLS = 20  # 陸地少於約 20 km² 的國家（梵蒂岡、摩納哥）在 1 km 網格上太粗，不輸出
EARTH_KM_PER_DEG = 111.19508
# 檢查 Wikidata 的點時，在點附近多大的範圍內找 DEM 的極值、國家（度）
HIGH_RADIUS_DEG = 0.05
LOW_RADIUS_DEG = 0.1
# 大湖（裏海）的座標在湖中央，離湖岸可能好幾百公里，改在這個範圍內找這個國家接近湖面高度的陸地
LAKE_RADIUS_DEG = 3.0


@dataclass
class Extreme:
    value: float
    lon: float
    lat: float
    zh: str | None = None
    en: str | None = None
    source: str = "dem"


def build() -> None:
    paths = gmted.grid_paths()
    shapes_by_unit = country_shapes()
    codes = sorted(shapes_by_unit.keys() | {target for _s, target, _a in OVERRIDES})
    index = {iso3: i + 1 for i, iso3 in enumerate(codes)}  # 0 是海、沒有國界的地方
    shapes = [
        ({"type": "Polygon", "coordinates": polygon}, index[iso3], bbox(polygon))
        for iso3, polygons in shapes_by_unit.items()
        for polygon in polygons
    ]
    overrides = [(index[s] if s else 0, index[t], area) for s, t, area in OVERRIDES]
    n = len(codes) + 1

    with rasterio.open(paths["mn30"]) as mn, rasterio.open(paths["mx30"]) as mx, rasterio.open(paths["mi30"]) as mi:
        lecz = coastal_lowland(mn, mx, mi)
        stats = aggregate(mn, mx, mi, lecz, shapes, overrides, n)
        del lecz
        extremes, high_notes = name_extremes(stats, codes, shapes, overrides, mn, mx, mi)

    write_output(stats, extremes, high_notes, codes)


# ── 沿海低地：低於 5 m、跟海相連 ─────────────────────────────


def water_mask(mn: np.ndarray, mx: np.ndarray, mi: np.ndarray) -> np.ndarray:
    """GMTED 的海是 0：三份都是 0 的格子當成海。格陵蘭沒有 mx、mi（也是 0），只看平均值。"""
    return (mn == 0) & (mx == 0) & (mi == 0)


def coastal_lowland(mn, mx, mi) -> np.ndarray:
    """北緯 84° 到南緯 56° 的布林網格：低於 LECZ_M、跟海相連的陸地格。

    「低於 5 m 或是海」的格子做 4 連通的區塊標記，含有足夠多海格的區塊就是海連著的低地。
    整個網格一次標記（約 7 億格，標記陣列約 3 GB），比逐區塊拼接簡單可靠。
    """
    height, width = mx.height, mx.width
    low = np.zeros((height, width), dtype=bool)
    sea = np.zeros((height, width), dtype=bool)
    for r0 in range(0, height, 1200):
        h = min(1200, height - r0)
        w = Window(0, r0, width, h)
        a, b, c = mn.read(1, window=w), mx.read(1, window=w), mi.read(1, window=w)
        sea[r0 : r0 + h] = water_mask(a, b, c)
        low[r0 : r0 + h] = a < LECZ_M
    labels, count = ndimage.label(low)
    sea_cells = np.zeros(count + 1, dtype=np.int64)
    for r0 in range(0, height, 1200):
        part = labels[r0 : r0 + 1200][sea[r0 : r0 + 1200]]
        sea_cells += np.bincount(part, minlength=count + 1)
    connected = sea_cells >= SEA_MIN_CELLS
    connected[0] = False
    out = np.zeros((height, width), dtype=bool)
    for r0 in range(0, height, 1200):
        out[r0 : r0 + 1200] = connected[labels[r0 : r0 + 1200]] & ~sea[r0 : r0 + 1200]
    print(f"  低地區塊 {count:,} 個，跟海相連的 {int(connected.sum())} 個")
    return out


# ── 逐條彙整各國統計 ──────────────────────────────────────


@dataclass
class Stats:
    cells: np.ndarray  # 陸地格數
    area: np.ndarray  # 加權面積（cos 緯度的總和）
    elev: np.ndarray  # 加權海拔總和
    hist: np.ndarray  # (國家, 分段) 加權面積
    lecz: np.ndarray
    slope: np.ndarray  # 加權坡度總和（度）
    slope_area: np.ndarray  # 有算坡度的加權面積（不含緊鄰海的格子）
    coast_cells: np.ndarray  # 緊鄰海的陸地格數
    high: np.ndarray  # 最高格的值
    high_at: np.ndarray  # 最高格的 (lon, lat)
    low: np.ndarray
    low_at: np.ndarray
    low_mean: np.ndarray  # 平均值網格的最低格：比最小值網格少雜訊（海岸、水面的假低點），用來檢查 Wikidata 的最低點


def aggregate(mn, mx, mi, lecz: np.ndarray, shapes, overrides, n: int) -> Stats:
    t = mn.transform
    width, height, extreme_rows = mn.width, mn.height, mx.height
    lon = t.c + (np.arange(width) + 0.5) * t.a
    dy_m = abs(t.e) * EARTH_KM_PER_DEG * 1000
    bins = len(EDGES) - 1
    s = Stats(
        cells=np.zeros(n, np.int64), area=np.zeros(n), elev=np.zeros(n), hist=np.zeros((n, bins)),
        lecz=np.zeros(n), slope=np.zeros(n), slope_area=np.zeros(n), coast_cells=np.zeros(n, np.int64),
        high=np.full(n, -np.inf), high_at=np.zeros((n, 2)), low=np.full(n, np.inf), low_at=np.zeros((n, 2)),
        low_mean=np.full(n, np.inf),
    )

    for r0 in range(0, height, ROWS):
        h = min(ROWS, height - r0)
        # 上下各多讀一列：坡度、「緊鄰海」要用到相鄰的格子
        top, bottom = max(0, r0 - 1), min(height, r0 + h + 1)
        z = mn.read(1, window=Window(0, top, width, bottom - top)).astype(np.int32)
        if top < extreme_rows:
            ext_bottom = min(bottom, extreme_rows)
            zx = mx.read(1, window=Window(0, top, width, ext_bottom - top)).astype(np.int32)
            zi = mi.read(1, window=Window(0, top, width, ext_bottom - top)).astype(np.int32)
            pad = bottom - ext_bottom
            if pad:  # 南緯 56° 以南沒有最大、最小值，用平均值代替
                zx = np.vstack([zx, z[-pad:]])
                zi = np.vstack([zi, z[-pad:]])
        else:
            zx, zi = z, z
        water = water_mask(z, zx, zi)
        # 格陵蘭等沒有最大、最小值的地方（兩份都是 0、平均值不是 0）用平均值
        missing = (zx == 0) & (zi == 0) & (z != 0)
        zx = np.where(missing, z, zx)
        zi = np.where(missing, z, zi)

        core = slice(r0 - top, r0 - top + h)
        code = country_codes(shapes, Window(0, r0, width, h), t).astype(np.int64)
        lat = t.f + (r0 + np.arange(h) + 0.5) * t.e
        for source, target, (lon0, lat0, lon1, lat1) in overrides:
            rr = (lat >= lat0) & (lat <= lat1)
            cc = (lon >= lon0) & (lon <= lon1)
            if rr.any() and cc.any():
                block = code[np.ix_(rr, cc)]
                block[block == source] = target
                code[np.ix_(rr, cc)] = block

        land = (code > 0) & ~water[core]
        weight = np.repeat(np.cos(np.radians(lat))[:, None], width, axis=1)

        # 坡度：中央差分，東西向依緯度換算成公尺，經度在 ±180° 接起來
        zf = z.astype(np.float32)
        dx_m = dy_m * np.cos(np.radians(t.f + (top + np.arange(bottom - top) + 0.5) * t.e))[:, None]
        gx = (np.roll(zf, -1, axis=1) - np.roll(zf, 1, axis=1)) / (2 * np.maximum(dx_m, 1.0))
        up = np.vstack([zf[:1], zf[:-1]])
        down = np.vstack([zf[1:], zf[-1:]])
        gy = (up - down) / (2 * dy_m)
        slope = np.degrees(np.arctan(np.hypot(gx, gy)))[core]
        near_water = (
            water[core]
            | np.roll(water, 1, axis=1)[core]
            | np.roll(water, -1, axis=1)[core]
            | np.vstack([water[:1], water[:-1]])[core]
            | np.vstack([water[1:], water[-1:]])[core]
        )

        c = code[land]
        w = weight[land]
        zl = z[core][land]
        s.cells += np.bincount(c, minlength=n)
        s.area += np.bincount(c, weights=w, minlength=n)
        s.elev += np.bincount(c, weights=w * zl, minlength=n)
        band = np.digitize(zl, EDGES[1:-1])
        s.hist += np.bincount(c * (len(EDGES) - 1) + band, weights=w, minlength=n * (len(EDGES) - 1)).reshape(n, -1)
        if r0 < lecz.shape[0]:
            lz = lecz[r0 : min(r0 + h, lecz.shape[0])]
            lz = np.vstack([lz, np.zeros((h - lz.shape[0], width), bool)]) if lz.shape[0] < h else lz
            s.lecz += np.bincount(c, weights=w * lz[land], minlength=n)
        valid = land & ~near_water
        s.slope += np.bincount(code[valid], weights=weight[valid] * slope[valid], minlength=n)
        s.slope_area += np.bincount(code[valid], weights=weight[valid], minlength=n)
        s.coast_cells += np.bincount(code[land & near_water], minlength=n)

        rows, cols = np.nonzero(land)
        update_extreme(s.high, s.high_at, c, zx[core][land].astype(float), rows, cols, r0, lon, t, +1)
        update_extreme(s.low, s.low_at, c, zi[core][land].astype(float), rows, cols, r0, lon, t, -1)
        np.minimum.at(s.low_mean, c, zl.astype(float))
        if r0 % 2400 == 0:
            print(f"  讀到第 {r0:,} 列（北緯 {lat[0]:.0f}°）")
    return s


def update_extreme(best, best_at, code, value, rows, cols, r0, lon, t, sign: int) -> None:
    """依國家更新最大值（sign=+1）或最小值（sign=−1）與它的位置。"""
    if code.size == 0:
        return
    v = value * sign
    window_best = np.full(best.shape, -np.inf)
    np.maximum.at(window_best, code, v)
    improved = window_best > best * sign
    if not improved.any():
        return
    hit = np.nonzero(v == window_best[code])[0]
    uniq, first = np.unique(code[hit], return_index=True)
    for k, i in zip(uniq, first):
        if improved[k]:
            j = hit[i]
            best[k] = window_best[k] * sign
            best_at[k] = (lon[cols[j]], t.f + (r0 + rows[j] + 0.5) * t.e)


# ── 最高點、最低點的名稱（Wikidata） ───────────────────────────


def local_window(ds, lon: float, lat: float, radius: float) -> tuple[Window, float, float]:
    """以 (lon, lat) 為中心、半徑 radius 度（東西向依緯度放大）的讀取範圍。"""
    t = ds.transform
    rx = radius / max(0.2, math.cos(math.radians(lat)))
    c0 = max(0, int((lon - rx - t.c) / t.a))
    c1 = min(ds.width, int((lon + rx - t.c) / t.a) + 1)
    r0 = max(0, int((lat + radius - t.f) / t.e))
    r1 = min(ds.height, int((lat - radius - t.f) / t.e) + 1)
    return Window(c0, r0, max(1, c1 - c0), max(1, r1 - r0)), c0, r0


def point_check(ds_mn, ds_ext, shapes, overrides, lon, lat, radius, code_id):
    """點附近（半徑 radius 度）這個國家有沒有陸地格，以及附近 DEM 的最大／最小值（不分國家，國界有誤差）。"""
    if ds_ext.height <= int((lat + radius - ds_ext.transform.f) / ds_ext.transform.e):  # 南緯 56° 以南
        ds_ext = ds_mn
    window, c0, r0 = local_window(ds_ext, lon, lat, radius)
    ext = ds_ext.read(1, window=window).astype(float)
    z = ds_mn.read(1, window=window).astype(float)
    code = country_codes(shapes, window, ds_ext.transform).astype(np.int64)
    t = ds_ext.transform
    lons = t.c + (c0 + np.arange(window.width) + 0.5) * t.a
    lats = t.f + (r0 + np.arange(window.height) + 0.5) * t.e
    for source, target, (lon0, lat0, lon1, lat1) in overrides:
        rr = (lats >= lat0) & (lats <= lat1)
        cc = (lons >= lon0) & (lons <= lon1)
        if rr.any() and cc.any():
            block = code[np.ix_(rr, cc)]
            block[block == source] = target
            code[np.ix_(rr, cc)] = block
    land = z != 0
    ext = np.where((ext == 0) & land, z, ext)  # 格陵蘭沒有最大、最小值
    mine = (code == code_id) & land
    return bool(mine.any()), ext, z, land, mine


def name_extremes(stats: Stats, codes: list[str], shapes, overrides, mn, mx, mi):
    """{ISO3: (最高點, 最低點)}。Wikidata 的點要在這個國家附近、而且 DEM 對得上才採用。"""
    points = wikidata.extremes()
    out: dict[str, tuple[Extreme, Extreme]] = {}
    notes: dict[str, tuple[str, str]] = {}
    report: list[str] = []
    for k, iso3 in enumerate(codes, start=1):
        if stats.cells[k] < MIN_CELLS:
            continue
        dem_high = Extreme(float(stats.high[k]), *stats.high_at[k])
        dem_low = Extreme(float(stats.low[k]), *stats.low_at[k])
        low_mean = float(stats.low_mean[k])
        coastal = stats.coast_cells[k] >= 3
        wd = points.get(iso3, {"high": [], "low": []})

        high = dem_high
        for p in sorted(wd["high"], key=lambda p: -(p.elevation or 0)):
            if p.elevation is None or p.lon is None:
                continue
            present, ext, _z, land, _mine = point_check(mn, mx, shapes, overrides, p.lon, p.lat, HIGH_RADIUS_DEG, k)
            local = float(ext[land].max()) if land.any() else -math.inf
            # 1 km 網格會把尖峰平均掉（庫克山 3,724 m 在 GMTED 只有 3,172 m），所以只要求附近的 DEM 有七成五
            # （南緯 56° 以南只有平均值網格，文森峰只剩七成，放寬到六成）。
            # 全國的 DEM 最高格不能比它高，否則 Wikidata 列的可能不是這個範圍內的最高點；
            # 除非全國最高格就在這座山（DEM 的尖峰雜訊，例如查亞峰 4,884 m 的 DEM 有 5,129 m）
            ratio = 0.6 if p.lat < -56 else 0.75
            highest_here = dem_high.value <= p.elevation + 150 or local >= dem_high.value - 50
            if present and local >= ratio * p.elevation and highest_here:
                high = Extreme(round(p.elevation), p.lon, p.lat, p.zh, p.en, "wikidata")
                break
            if present and local >= ratio * p.elevation:
                # DEM 的最高格比 Wikidata 列的最高點高：可能是簡化國界把鄰國的山頂劃進來（以色列的黑門山），
                # 也可能真的有更高的無名高地（科威特西南部），兩種都寫附註
                name = {"zh": p.zh or p.en, "en": p.en or p.zh}
                notes[iso3] = (
                    f"這裡是 DEM 網格在這個範圍（地圖的國界）內的最高格，靠近國界時可能是簡化國界的誤差；"
                    f"Wikidata 列的最高點是{name['zh']}（{p.elevation:,.0f} 公尺）。",
                    f"This is the highest DEM cell within the map's (simplified) borders and may be a border artefact "
                    f"if it lies near a frontier; Wikidata lists {name['en']} ({p.elevation:,.0f} m) as the highest point.",
                )
            report.append(f"{iso3} 最高點不採用 {p.en or p.zh}（{p.elevation:.0f} m；附近 DEM {local:.0f}、全國 DEM {dem_high.value:.0f}、在國內 {present}）")

        # 最低點：沒有海拔的 Wikidata 點（多半是「某某海」或沒填海拔的窪地）用附近的 DEM 判斷
        low = Extreme(0.0, dem_low.lon, dem_low.lat) if coastal else dem_low
        for p in sorted(wd["low"], key=lambda p: p.elevation if p.elevation is not None else 0):
            if p.lon is None:
                continue
            present, ext, z, land, _mine = point_check(mn, mi, shapes, overrides, p.lon, p.lat, LOW_RADIUS_DEG, k)
            local = float(ext[land].min()) if land.any() else math.inf
            at_sea = land.mean() < 0.5
            if p.elevation is not None:
                ok = (present or at_sea and coastal) and (local <= p.elevation + max(30.0, abs(p.elevation) * 0.3) or (p.elevation >= 0 and at_sea))
                # 湖岸、河岸：點本身在國界外，但全國的 DEM 最低格跟它差不多
                ok = ok or abs(low_mean - p.elevation) <= max(15.0, abs(p.elevation) * 0.15)
                if not ok and not present and -1000 < p.elevation < 0:  # 海溝（希臘的卡利普索海淵）不算
                    # 低於海平面的大湖（俄羅斯的裏海岸 −28 m）：附近幾度內有這個國家、接近湖面高度的陸地
                    _p, _e, zz, _l, mine = point_check(mn, mn, shapes, overrides, p.lon, p.lat, LAKE_RADIUS_DEG, k)
                    ok = bool((zz[mine] <= p.elevation + 10).any())
                value = p.elevation
            elif at_sea or (coastal and local >= -2):
                ok, value = coastal, 0.0  # 海、海峽：海平面
            else:
                # 沒填海拔的窪地、圩田：用附近平均值網格的最低格（最小值網格在水邊常有幾十公尺的假低點）
                ok, value = present, float(z[land].min())
            # 高於海平面的最低點不能比全國 DEM 的最低格高太多：河流的座標常常在上游（不丹的 Drangme Chhu
            # 座標處約 890 m，實際最低處約 100 m）
            ok = ok and (value <= 0 or value <= low_mean + max(50.0, value * 0.2))
            if ok:
                low = Extreme(round(value, 1) if abs(value) < 10 else round(value), p.lon, p.lat, p.zh, p.en, "wikidata")
                break
            report.append(f"{iso3} 最低點不採用 {p.en or p.zh}（{p.elevation} m；附近 DEM {local:.0f}、在國內 {present}）")
        out[iso3] = (high, low)
    for line in report:
        print(f"  {line}")
    return out, notes


# ── 輸出 ───────────────────────────────────────────────


def write_output(
    s: Stats, extremes: dict[str, tuple[Extreme, Extreme]], high_notes: dict[str, tuple[str, str]], codes: list[str]
) -> None:
    keep = {iso3: k for k, iso3 in enumerate(codes, start=1) if s.cells[k] >= MIN_CELLS}
    km2 = (EARTH_KM_PER_DEG / 120) ** 2

    def series(fn) -> dict[str, list[float | None]]:
        return {iso3: [fn(k)] for iso3, k in keep.items()}

    def share(part: np.ndarray, k: int, total: np.ndarray | None = None) -> float:
        return round(float(part[k] / (s.area if total is None else total)[k] * 100), 1)

    files = {
        "mean": ("公尺", series(lambda k: round(float(s.elev[k] / s.area[k])))),
        "highest": ("公尺", {iso3: [extremes[iso3][0].value] for iso3 in keep}),
        "lowest": ("公尺", {iso3: [extremes[iso3][1].value] for iso3 in keep}),
        "lowland": ("%", series(lambda k: share(s.lecz, k))),
        "slope": ("度", series(lambda k: round(float(s.slope[k] / s.slope_area[k]), 1) if s.slope_area[k] else None)),
    }
    for threshold in ABOVE:
        first = EDGES.index(threshold)
        files[f"above/{threshold}"] = ("%", series(lambda k, f=first: round(float(s.hist[k, f:].sum() / s.area[k] * 100), 1)))

    notes, notes_en = taiwan_notes(s, keep)
    for iso3, (zh, en) in high_notes.items():
        if iso3 in keep:
            notes.setdefault("highest", {})[iso3] = zh
            notes_en.setdefault("highest", {})[iso3] = en
    for name, (unit, values) in files.items():
        extra = {"notes": notes[name], "notesEn": notes_en[name]} if name in notes else {}
        write_json(OUT / f"{name}.json", indicator_file(name.replace("/", "-"), unit, [YEAR], values, **extra))

    profiles = {}
    for iso3, k in keep.items():
        high, low = extremes[iso3]
        profiles[iso3] = {
            "area": round(float(s.area[k] * km2)),
            "bands": [round(float(v / s.area[k] * 100), 2) for v in s.hist[k]],
            "high": point_json(high),
            "low": point_json(low),
        }
    write_json(OUT / "profiles.json", {"edges": [e if math.isfinite(e) else None for e in EDGES], "countries": profiles})
    write_json(OUT / "manifest.json", {
        "topic": "elevation",
        "generatedAt": now_iso(),
        "source": "USGS GMTED2010 30 arc-second (mean, max, min); Wikidata (CC0) highest/lowest points; "
        "Taiwan cross-check: MOI 100 m DEM",
    })
    print(f"  輸出 {len(keep)} 個國家/地區")
    # 檢查用：幾個熟悉的國家（平均海拔可以跟維基百科的各國平均海拔表比對）
    for iso3 in ("TWN", "NPL", "BTN", "CHN", "CHE", "JPN", "USA", "NLD", "BGD", "EGY", "KAZ", "RUS", "SYR", "JOR", "ITA", "NZL", "AUS", "IDN", "ATA", "ISR"):
        if iso3 in keep:
            k, (high, low) = keep[iso3], extremes[iso3]
            print(
                f"  {iso3} 平均 {s.elev[k] / s.area[k]:6.0f} m｜最高 {high.value:6.0f} {high.zh or high.en or '(DEM)'}"
                f"｜最低 {low.value:6.1f} {low.zh or low.en or '(DEM)'}｜1,000 m 以上 {s.hist[k, EDGES.index(1000):].sum() / s.area[k] * 100:4.1f}%"
                f"｜沿海低地 {s.lecz[k] / s.area[k] * 100:4.1f}%｜坡度 {s.slope[k] / max(s.slope_area[k], 1e-9):4.1f}°"
                f"｜面積 {s.area[k] * km2:,.0f} km²｜DEM 最低格 {s.low[k]:.0f}（平均值網格 {s.low_mean[k]:.0f}）"
            )


def point_json(p: Extreme) -> dict:
    out: dict = {"e": p.value, "lon": round(float(p.lon), 3), "lat": round(float(p.lat), 3)}
    if p.source == "wikidata":
        if p.zh:
            out["zh"] = p.zh
        if p.en:
            out["en"] = p.en
    return out


def taiwan_notes(s: Stats, keep: dict[str, int]) -> tuple[dict, dict]:
    """台灣：拿內政部 100 公尺 DEM 交叉比對平均海拔與 1,000 公尺以上的占比，寫成附註。"""
    k = keep.get("TWN")
    if k is None:
        return {}, {}
    moi = moi_dtm.taiwan_summary(EDGES)
    mean = s.elev[k] / s.area[k]
    above = {t: float(sum(moi.shares[EDGES.index(t):])) for t in ABOVE}
    print(
        f"  台灣：GMTED 平均 {mean:.0f} m、面積 {s.area[k] * (EARTH_KM_PER_DEG / 120) ** 2:,.0f} km²；"
        f"內政部 100 m DEM 平均 {moi.mean:.0f} m、面積 {moi.area_km2:,.0f} km²、最高格 {moi.max:.0f} m、"
        f"1,000 m 以上 {above[1000]:.1f}%"
    )
    zh_mean = f"內政部 100 公尺數值高程模型（民國 94–95 年航測，台灣本島與澎湖）算出的平均海拔是 {moi.mean:,.0f} 公尺，這裡用 GMTED2010 算的是 {mean:,.0f} 公尺。"
    en_mean = f"The Ministry of the Interior's 100 m DEM (2005–06 aerial survey, Taiwan island and Penghu) gives a mean elevation of {moi.mean:,.0f} m; GMTED2010 gives {mean:,.0f} m here."
    notes: dict[str, dict] = {"mean": {"TWN": zh_mean}}
    notes_en: dict[str, dict] = {"mean": {"TWN": en_mean}}
    for t in ABOVE:
        ours = s.hist[k, EDGES.index(t):].sum() / s.area[k] * 100
        notes[f"above/{t}"] = {"TWN": f"內政部 100 公尺數值高程模型算出的是 {above[t]:.1f}%（這裡用 GMTED2010 算的是 {ours:.1f}%）。"}
        notes_en[f"above/{t}"] = {"TWN": f"The Ministry of the Interior's 100 m DEM gives {above[t]:.1f}% (GMTED2010: {ours:.1f}%)."}
    notes["highest"] = {"TWN": f"玉山主峰的官方標高是 3,952 公尺（內政部國土測繪中心 2024 年 5 月實測 3,952.433 公尺）；內政部 100 公尺 DEM 的最高格是 {moi.max:,.0f} 公尺，GMTED2010 是 {s.high[k]:,.0f} 公尺（網格會把山頂平均掉）。"}
    notes_en["highest"] = {"TWN": f"Yushan's official height is 3,952 m (National Land Surveying and Mapping Center, May 2024 survey: 3,952.433 m); the highest cell is {moi.max:,.0f} m in the MOI 100 m DEM and {s.high[k]:,.0f} m in GMTED2010 (grids smooth out summits)."}
    return notes, notes_en
