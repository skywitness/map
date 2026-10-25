"""夜間燈光主題：各國的平均亮度、燈光總量、人均燈光、有燈光的土地比例、住在沒有燈光地方的人口比例、
燈光總量比 2017 年的變化；側欄的燈光最多的地區（第一級行政區）。

- 燈光：EOG 的 Annual VNL V2 average_masked（sources/vnl.py），15 角秒，2013–2024 每年一期，單位 nW/cm²/sr。
- 人口：JRC GHS-POP R2023A 的 30 角秒網格（sources/ghsl.py，2015、2020、2025 三期，年份之間線性內插，
  2013–2014 用 2015 年那一期；2025 是推估），各國的人均用 UN WPP 2024 的年中人口。
- 國家範圍：跟人口的框選網格一樣，在 GHS-POP 的 30 角秒網格上依地圖國界（population_grid.country_shapes()）
  畫出國家編號，有人口卻落在 1:50m 海岸線外的格子歸給 20 km 內最近的國家（ghsl.fill_gaps）。
  每個 30 角秒的格子剛好對到 2 × 2 個 VNL 的格子（欄是整齊的；列差 0.2 格，依格子中心歸）。
  海上的燈光（漁船、離岸的油氣平台）不屬於任何國家，不算進各國。

指標：
- 平均亮度（mean）：國土內所有格子的面積加權平均（沒有燈光的算 0），nW/cm²/sr。國土有資料的部分不到 MIN_COVER
  的不輸出（格陵蘭、斯瓦巴），不到 NOTE_COVER 的附註（北緯 75° 以北沒有資料）。可以切到網格（night_lights_tiles.py）。
- 燈光總量（total）：Σ 亮度 × 面積。1 nW/cm²/sr 的亮度在 1 km² 上是 10 W/sr（向上的輻射強度，VIIRS DNB 的
  0.5–0.9 µm 波段），輸出單位 MW/sr。
- 人均燈光（per-capita）：燈光總量 ÷ WPP 人口，W/sr/人。
- 有燈光的土地比例（lit-share）：亮度 ≥ LIT（1 nW/cm²/sr；轉存檔只到整數，比 1 暗的都是 0，EOG 當成背景遮掉的也是 0）
  的格子面積 ÷ 國土面積（都只算有資料的部分）。
- 住在沒有燈光地方的人口比例（unlit-pop）：30 角秒（約 1 km）的人口格子裡 4 個 VNL 格子都沒有燈光的人口 ÷ 全國人口
  （都用 GHS-POP）。是電力普及的粗略指標：有電但燈光太暗、太分散的村莊，衛星也看不到。
- 比 2017 年的變化（change）：燈光總量比 BASE_YEAR 多或少幾 %。基準年燈光太少（< MIN_CHANGE_BASE）的國家不算，
  零點幾的燈光多一點點就是幾百 %。
- **2016 → 2017 年有斷層**（METHOD_BREAK）：轉存檔 2017 年起有燈光的格子突然多很多（世界有燈光的土地 5.1% → 6.8%、
  德國 31.7% → 43.6%，燈光總量 +11%），比較暗的格子（1–1.5 nW/cm²/sr）的比例也跳上去，是 EOG 背景遮罩或處理方式
  不同造成的（原因沒查到），2021 → 2022 年（V2.1 → V2.2）反而是連續的。所以各指標檔都標 methodBreak（側欄的折線圖
  在 2017 年畫虛線），變化的基準年用 2017 年，燈光最多的地區也比 2017 年。
- 燈光最多的地區（countries/<ISO3>.json）：Natural Earth 1:10m 的第一級行政區（公有領域：縣市、省、州，
  名稱用它的 name_zht、name_en）也畫在同一個 30 角秒網格上，每個地區的燈光總量取前 TOP_REGIONS 名，
  附占全國的比例與比 BASE_YEAR 的變化。地區歸給燈光大多落在的那個國家（地圖國界跟 Natural Earth 的
  行政區界線不完全重合），只算落在那國國界內的部分。
  原本想做「最亮的城市」（燈光格子歸給最近的城市點），但都會區被相鄰的城市點切成好幾塊（台北市排在第 8），
  不直覺，所以改用行政區。
"""
from __future__ import annotations

import json
import math
import pickle
import shutil
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
import rasterio
from rasterio.windows import Window

import common
from common import CACHE_DIR, OUT_DIR, download, indicator_file, now_iso, write_json
from sources import ghsl, vnl, wpp
from topics.population_grid import OVERRIDES, bbox, country_shapes

OUT = OUT_DIR / "topics" / "night-lights"
YEARS = vnl.YEARS
METHOD_BREAK = 2017  # 這一年起跟之前不完全可比（見檔頭）
BASE_YEAR = METHOD_BREAK
MIN_CHANGE_BASE = 0.005  # MW/sr：基準年燈光少於這個的國家不算變化
LIT = 1.0  # 有燈光：≥ 1 nW/cm²/sr（轉存檔只到整數，比 1 暗的都是 0）
POP_EPOCHS = [2015, 2020, 2025]
MIN_COVER = 0.5
NOTE_COVER = 0.95
G_ROWS = 256  # 每次處理幾列 GHS-POP 的格子（= 512 列 VNL）
JOBS = 6
STATS_VERSION = 3  # strip_stats() 的算法改了就加一（快取的統計檔名跟著換）
W_SR_PER_UNIT = 10.0  # 1 nW/cm²/sr × 1 km² = 1e-9 W/cm²/sr × 1e10 cm² = 10 W/sr
EARTH_RADIUS_KM = 6371.0088
REGION_YEARS = (BASE_YEAR, YEARS[-1])
TOP_REGIONS = 8
TOP_CITIES = 8
ADMIN1_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces.geojson"
)
# Natural Earth 的 ADM0_A3 跟這裡的代碼不同的

# 台灣的附註用：台灣本島的西部平原與中央山脈（只算地圖上台灣的國界內）
TAIWAN_BOXES = {
    "west": (120.0, 22.4, 120.75, 25.3),  # 西部走廊（台北到屏東，約東經 120.75° 以西）
    "mountains": (120.85, 22.6, 121.35, 24.4),  # 中央山脈（含玉山、雪山以南的主稜）
}


@dataclass
class Setup:
    codes: list[str]
    shapes: list[tuple[dict, int, tuple[float, float, float, float]]]
    overrides: list[ghsl.Override]
    regions: list[dict]  # Natural Earth 第一級行政區（編號 = 索引 + 1）
    region_shapes: list[tuple[dict, int, tuple[float, float, float, float]]]


def setup() -> Setup:
    shapes_by_unit = country_shapes()
    codes = sorted(shapes_by_unit.keys() | {t for _s, t, _a in OVERRIDES})
    index = {iso3: i + 1 for i, iso3 in enumerate(codes)}
    shapes = [
        ({"type": "Polygon", "coordinates": polygon}, index[iso3], bbox(polygon))
        for iso3, polygons in shapes_by_unit.items()
        for polygon in polygons
    ]
    overrides = [ghsl.Override(index[s] if s else 0, index[t], *area) for s, t, area in OVERRIDES]
    regions, region_shapes = load_regions()
    return Setup(codes, shapes, overrides, regions, region_shapes)


def load_regions() -> tuple[list[dict], list[tuple[dict, int, tuple[float, float, float, float]]]]:
    """Natural Earth 1:10m 的第一級行政區：名稱與畫網格用的多邊形"""
    path = download(ADMIN1_URL, "natural-earth", "ne_10m_admin_1_states_provinces.geojson")
    data = json.loads(path.read_text(encoding="utf-8"))
    regions, shapes = [], []
    for i, f in enumerate(data["features"], start=1):
        p = f["properties"]
        regions.append({"zh": p.get("name_zht") or p.get("name_zh") or p["name"], "en": p.get("name_en") or p["name"]})
        geom = f["geometry"]
        polygons = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        for polygon in polygons:
            shapes.append(({"type": "Polygon", "coordinates": polygon}, i, bbox(polygon)))
    return regions, shapes


def pop_weights(year: int) -> dict[int, float]:
    """這一年的人口用 GHS-POP 哪幾期內插：{期: 權重}"""
    if year <= POP_EPOCHS[0]:
        return {POP_EPOCHS[0]: 1.0}
    if year >= POP_EPOCHS[-1]:
        return {POP_EPOCHS[-1]: 1.0}
    for a, b in zip(POP_EPOCHS, POP_EPOCHS[1:]):
        if a <= year <= b:
            w = (year - a) / (b - a)
            return {a: 1 - w, b: w}
    raise ValueError(year)


# ── 一段（G_ROWS 列 GHS-POP 格子）的統計 ─────────────────────────


@lru_cache(maxsize=1)
def cached_setup() -> Setup:
    """每個子行程自己讀一次國界與行政區（行政區的多邊形很大，不要每段都從主行程 pickle 過去）"""
    return setup()


def strip_stats(args: tuple[int, int, bool]) -> dict:
    g0, g1, refresh = args
    common.REFRESH = refresh
    st = cached_setup()
    n = len(st.codes) + 1
    ny = len(YEARS)
    pop_paths = {e: ghsl.raster_path(e) for e in POP_EPOCHS}
    vnl_paths = {y: vnl.raster_path(y) for y in YEARS}

    with rasterio.open(pop_paths[2020]) as src:
        tg = src.transform
        width = src.width
        height = src.height
    # GHS-POP 的格子跟 VNL 的列、欄怎麼對
    with rasterio.open(vnl_paths[YEARS[0]]) as v:
        tv = v.transform
        vh, vw = v.height, v.width
    lat_v = tv.f + (np.arange(vh) + 0.5) * tv.e
    g_of_r = np.floor((tg.f - lat_v) / -tg.e).astype(np.int64)
    rows_v = np.nonzero((g_of_r >= g0) & (g_of_r < g1))[0]
    lon_v = tv.c + (np.arange(vw) + 0.5) * tv.a
    g_col = np.floor((lon_v - tg.c) / tg.a).astype(np.int64)
    assert g_col[0] == 1 and np.all(g_col == np.arange(vw) // 2 + 1), "VNL 的欄跟 GHS-POP 對不齊"
    out: dict = {
        "land": np.zeros(n), "pop": np.zeros((len(POP_EPOCHS), n)),
        "covered": np.zeros((ny, n)), "light": np.zeros((ny, n)), "lit": np.zeros((ny, n)),
        "unlit_pop": np.zeros((ny, len(POP_EPOCHS), n)), "regions": {},
        "taiwan": {k: np.zeros((ny, 3)) for k in TAIWAN_BOXES},
    }
    if len(rows_v) == 0:
        return out
    # 這一段裡有 VNL 的 GHS 列
    ga, gb = int(g_of_r[rows_v[0]]), int(g_of_r[rows_v[-1]]) + 1
    h = gb - ga

    # 國家編號（上下多畫 GAP_FILL_PIXELS 列，補海岸的格子時才找得到區塊外的國家）
    top = max(0, ga - ghsl.GAP_FILL_PIXELS)
    bottom = min(height, gb + ghsl.GAP_FILL_PIXELS)
    pops = {}
    for e, path in pop_paths.items():
        with rasterio.open(path) as src:
            p = src.read(1, window=Window(0, ga, width, h))
        p[~np.isfinite(p) | (p < 0)] = 0
        pops[e] = p
    codes = ghsl.country_codes(st.shapes, Window(0, top, width, bottom - top), tg)
    pad = np.zeros((bottom - top, width))
    pad[ga - top : ga - top + h] = pops[2020]
    ghsl.fill_gaps(codes, 0, pad)  # 有人口卻在國界外的格子歸給最近的國家
    codes = codes[ga - top : ga - top + h]
    lat_g = tg.f + (ga + np.arange(h) + 0.5) * tg.e
    lon_g = tg.c + (np.arange(width) + 0.5) * tg.a
    for o in st.overrides:
        r = (lat_g >= o.lat0) & (lat_g <= o.lat1)
        c = (lon_g >= o.lon0) & (lon_g <= o.lon1)
        if r.any() and c.any():
            block = codes[np.ix_(r, c)]
            block[block == o.source] = o.target
            codes[np.ix_(r, c)] = block
    # 只留對得到 VNL 的欄（第 1 到 43200 欄；第 0、43201 欄是 ±180° 外多出來的一格）
    codes = codes[:, 1 : 1 + vw // 2].astype(np.int64)
    pops = {e: p[:, 1 : 1 + vw // 2] for e, p in pops.items()}
    flat = codes.ravel()

    # VNL 每一列一格的面積
    north = np.radians(tv.f + rows_v * tv.e)
    area_v = (EARTH_RADIUS_KM**2 * np.radians(tv.a) * (np.sin(north) - np.sin(north + np.radians(tv.e)))).astype(np.float32)
    starts = np.r_[0, np.nonzero(np.diff(g_of_r[rows_v]))[0] + 1]  # 同一個 GHS 列的 VNL 列從哪裡開始
    assert len(starts) == h

    def to_g(a: np.ndarray, op=np.add) -> np.ndarray:
        """VNL 的格子 (列, 欄) → GHS-POP 的格子：同一格的 2 列、2 欄合起來"""
        rows = op.reduceat(a, starts, axis=0)
        return op(rows[:, 0::2], rows[:, 1::2])

    cell_area = to_g(np.broadcast_to(area_v[:, None], (len(rows_v), vw)).astype(np.float64))
    out["land"] += np.bincount(flat, weights=cell_area.ravel(), minlength=n)
    for i, e in enumerate(POP_EPOCHS):
        out["pop"][i] += np.bincount(flat, weights=pops[e].ravel(), minlength=n)

    # 台灣本島的西部平原與中央山脈（附註用）
    twn = st.codes.index("TWN") + 1 if "TWN" in st.codes else -1
    lat_c = lat_g[:, None]
    lon_c = (tv.c + (np.arange(vw // 2) + 0.5) * 2 * tv.a)[None, :]
    boxes = {}
    for key, (x0, y0, x1, y1) in TAIWAN_BOXES.items():
        m = (codes == twn) & (lat_c >= y0) & (lat_c <= y1) & (lon_c >= x0) & (lon_c <= x1)
        if m.any():
            boxes[key] = m

    # 第一級行政區（跟國家一樣，格子中心在多邊形內才算）
    regions = ghsl.country_codes(st.region_shapes, Window(0, ga, width, h), tg)[:, 1 : 1 + vw // 2].astype(np.int64).ravel()

    with rasterio.Env(GDAL_CACHEMAX=256):
        for yi, year in enumerate(YEARS):
            with rasterio.open(vnl_paths[year]) as v:
                raw = v.read(1, window=Window(0, int(rows_v[0]), vw, len(rows_v)))
                light = vnl.radiance(raw, vnl.factor(v))
            valid = raw != vnl.NODATA
            lit = light >= LIT
            la = to_g(light * area_v[:, None]).astype(np.float64)
            lit_area = to_g(lit * area_v[:, None]).astype(np.float64)
            cov = to_g(valid * area_v[:, None]).astype(np.float64)
            any_lit = to_g(lit, np.logical_or)
            out["light"][yi] += np.bincount(flat, weights=la.ravel(), minlength=n)
            out["lit"][yi] += np.bincount(flat, weights=lit_area.ravel(), minlength=n)
            out["covered"][yi] += np.bincount(flat, weights=cov.ravel(), minlength=n)
            for i, e in enumerate(POP_EPOCHS):
                w = np.where(any_lit, 0.0, pops[e])
                out["unlit_pop"][yi, i] += np.bincount(flat, weights=w.ravel(), minlength=n)
            for key, m in boxes.items():
                out["taiwan"][key][yi] += [la[m].sum(), lit_area[m].sum(), cell_area[m].sum()]
            if year in REGION_YEARS:
                sel = (flat > 0) & (regions > 0) & (la.ravel() > 0)
                keys = regions[sel] * n + flat[sel]
                uniq, inv = np.unique(keys, return_inverse=True)
                out["regions"][year] = (uniq, np.bincount(inv, weights=la.ravel()[sel]))
    return out


def merge(parts: list[dict]) -> dict:
    total = {k: sum(p[k] for p in parts) for k in ("land", "pop", "covered", "light", "lit", "unlit_pop")}
    total["taiwan"] = {k: sum(p["taiwan"][k] for p in parts) for k in TAIWAN_BOXES}
    regions = {}
    for year in REGION_YEARS:
        keys = np.concatenate([p["regions"][year][0] for p in parts if year in p["regions"]])
        sums = np.concatenate([p["regions"][year][1] for p in parts if year in p["regions"]])
        uniq, inv = np.unique(keys, return_inverse=True)
        regions[year] = dict(zip(uniq.tolist(), np.bincount(inv, weights=sums).tolist()))
    total["regions"] = regions
    return total


# ── 主程式 ───────────────────────────────────────────────


def build() -> None:
    started = time.perf_counter()
    st = setup()
    # 先在主行程下載，子行程才不會同時下載同一個檔
    for y in YEARS:
        vnl.raster_path(y)
    for e in POP_EPOCHS:
        ghsl.raster_path(e)
    with rasterio.open(ghsl.raster_path(2020)) as src:
        height = src.height
    tasks = [(g, min(g + G_ROWS, height), common.REFRESH) for g in range(0, height, G_ROWS)]
    # 統計約 10 分鐘，算完存一份在快取，只改輸出（門檻、附註、城市清單）時不必重算；改了統計的程式要加 --refresh
    cache = CACHE_DIR / vnl.SOURCE / f"stats-{STATS_VERSION}.pkl"
    if cache.exists() and not common.REFRESH:
        s = pickle.loads(cache.read_bytes())
        print(f"  用快取的統計（{cache.name}）")
    else:
        with ProcessPoolExecutor(max_workers=JOBS) as pool:
            parts = list(pool.map(strip_stats, tasks))
        s = merge(parts)
        cache.write_bytes(pickle.dumps(s))
        print(f"  統計完成，{time.perf_counter() - started:.0f} 秒")
    write_outputs(st, s)


def round_sig(v: float, digits: int = 4) -> float:
    v = float(v)
    if v == 0 or not math.isfinite(v):
        return 0.0
    return round(v, max(0, digits - 1 - int(math.floor(math.log10(abs(v))))))


def clean(values: list) -> list[float | None]:
    """numpy 的數字換成 Python 的 float（indicator_file 的壓縮用 repr 判斷小數位數）"""
    return [None if v is None else float(v) for v in values]


def write_outputs(st: Setup, s: dict) -> None:
    n = len(st.codes) + 1
    ny = len(YEARS)
    population = wpp.demographic(["TPopulation1July"], last_year=YEARS[-1])["TPopulation1July"]  # 千人
    weights = [pop_weights(y) for y in YEARS]
    ep = {e: i for i, e in enumerate(POP_EPOCHS)}

    series: dict[str, dict[str, list[float | None]]] = {
        k: {} for k in ("mean", "total", "per-capita", "lit-share", "unlit-pop", "change")
    }
    notes: dict[str, dict[str, str]] = {k: {} for k in series}
    notes_en: dict[str, dict[str, str]] = {k: {} for k in series}
    for k, iso3 in enumerate(st.codes, start=1):
        land = s["land"][k]
        if land <= 0:
            continue
        cover = s["covered"][:, k] / land  # 每年一樣，取最少的一年
        if cover.min() < MIN_COVER:
            continue
        light = s["light"][:, k]  # nW/cm²/sr·km²
        covered = s["covered"][:, k]
        mean = light / covered
        total = light * W_SR_PER_UNIT / 1e6  # MW/sr
        series["mean"][iso3] = [round_sig(v) for v in mean]
        series["total"][iso3] = [round_sig(v) for v in total]
        series["lit-share"][iso3] = [round(100 * v, 2) for v in s["lit"][:, k] / covered]
        pop_ghs = [sum(w * s["pop"][ep[e], k] for e, w in weights[yi].items()) for yi in range(ny)]
        if min(pop_ghs) > 0:
            unlit = [
                100 * sum(w * s["unlit_pop"][yi, ep[e], k] for e, w in weights[yi].items()) / pop_ghs[yi] for yi in range(ny)
            ]
            series["unlit-pop"][iso3] = [round(v, 2) for v in unlit]
        wpp_pop = population.get(iso3, {})
        if all(y in wpp_pop for y in YEARS):
            series["per-capita"][iso3] = [round_sig(total[i] * 1e6 / (wpp_pop[y] * 1000)) for i, y in enumerate(YEARS)]
        base = YEARS.index(BASE_YEAR)
        if total[base] >= MIN_CHANGE_BASE:
            series["change"][iso3] = [round(100 * (v / light[base] - 1), 1) for v in light[base + 1 :]]
        if cover.min() < NOTE_COVER:
            pct = round(100 * (1 - cover.min()))
            for key in ("mean", "total", "per-capita", "lit-share", "unlit-pop", "change"):
                notes[key][iso3] = f"國土約 {pct}% 在北緯 75° 以北，沒有夜間燈光資料，只算其餘的部分。"
                notes_en[key][iso3] = f"About {pct}% of the land lies north of 75°N, where there are no night light data; only the rest is counted."

    # 世界：各國合計（海上的燈光不算）
    land_codes = [k for k, iso3 in enumerate(st.codes, start=1) if iso3 in series["mean"]]
    base = YEARS.index(BASE_YEAR)
    world_light = s["light"][:, land_codes].sum(axis=1)
    world_cov = s["covered"][:, land_codes].sum(axis=1)
    world_total = world_light * W_SR_PER_UNIT / 1e6
    world_pop = population["WLD"]
    pop_ghs_world = [
        sum(w * s["pop"][ep[e], land_codes].sum() for e, w in weights[yi].items()) for yi in range(ny)
    ]
    unlit_world = [
        100 * sum(w * s["unlit_pop"][yi, ep[e], land_codes].sum() for e, w in weights[yi].items()) / pop_ghs_world[yi]
        for yi in range(ny)
    ]
    world = {
        "mean": [round_sig(v) for v in world_light / world_cov],
        "total": [round_sig(v) for v in world_total],
        "per-capita": [round_sig(world_total[i] * 1e6 / (world_pop[y] * 1000)) for i, y in enumerate(YEARS)],
        "lit-share": [round(100 * v, 2) for v in s["lit"][:, land_codes].sum(axis=1) / world_cov],
        "unlit-pop": [round(v, 2) for v in unlit_world],
        "change": [round(100 * (v / world_light[base] - 1), 1) for v in world_light[base + 1 :]],
    }

    taiwan_notes(series, s, notes, notes_en)
    if "VUT" in series["change"]:
        notes["change"]["VUT"] = "安布里姆島（Ambrym）火山口的熔岩湖持續發光，衛星也當成燈光；2018 年 12 月噴發後熔岩湖消失，燈光才大減。"
        notes_en["change"]["VUT"] = "The lava lakes in Ambrym’s craters glowed steadily and counted as lights; they drained in the December 2018 eruption, hence the drop."


    units = {
        "mean": "nW/cm²/sr", "total": "MW/sr", "per-capita": "W/sr", "lit-share": "%", "unlit-pop": "%", "change": "%",
    }
    for key, values in series.items():
        write_json(
            OUT / f"{key}.json",
            indicator_file(
                key, units[key], YEARS[base + 1 :] if key == "change" else YEARS,
                {iso3: clean(v) for iso3, v in sorted(values.items())},
                aggregates={"WLD": clean(world[key])}, notes=notes[key], notesEn=notes_en[key],
                **({} if key == "change" else {"methodBreak": METHOD_BREAK}),
            ),
        )
    write_regions(st, s, series)
    write_json(
        OUT / "manifest.json",
        {
            "topic": "night-lights",
            "generatedAt": now_iso(),
            "source": f"EOG Annual VNL V2 average_masked {YEARS[0]}–{YEARS[-1]} (Zenodo doi:{vnl.DOI}); "
            "JRC GHS-POP R2023A 2015/2020/2025; UN WPP 2024; Natural Earth 1:10m admin-1 states and provinces 5.1.2",
            "notice": vnl.NOTICE,
            "citation": vnl.CITATION,
        },
    )
    report(series, world)


def taiwan_notes(series: dict, s: dict, notes: dict, notes_en: dict) -> None:
    if "TWN" not in series["lit-share"]:
        return
    last = len(YEARS) - 1
    west_l, west_lit, west_a = s["taiwan"]["west"][last]
    mtn_l, mtn_lit, mtn_a = s["taiwan"]["mountains"][last]
    y = YEARS[-1]
    zh = (
        f"{y} 年台灣本島的西部平原（東經 120.75° 以西）平均亮度 {west_l / west_a:.1f} nW/cm²/sr、"
        f"{100 * west_lit / west_a:.0f}% 的土地有燈光；中央山脈（東經 120.85°–121.35°、北緯 22.6°–24.4°）"
        f"平均 {mtn_l / mtn_a:.2f}、只有 {100 * mtn_lit / mtn_a:.0f}% 有燈光。台灣周圍海上的漁船燈光不算進台灣。"
    )
    en = (
        f"In {y}, Taiwan’s western plains (west of 120.75°E) averaged {west_l / west_a:.1f} nW/cm²/sr with "
        f"{100 * west_lit / west_a:.0f}% of the land lit; the Central Mountain Range (120.85°–121.35°E, 22.6°–24.4°N) "
        f"averaged {mtn_l / mtn_a:.2f} with only {100 * mtn_lit / mtn_a:.0f}% lit. Fishing boat lights in the seas around "
        "Taiwan are not counted towards Taiwan."
    )
    for key in ("mean", "lit-share"):
        notes[key]["TWN"] = zh
        notes_en[key]["TWN"] = en
    print(f"  台灣：{zh}")


def write_regions(st: Setup, s: dict, series: dict) -> None:
    """countries/<ISO3>.json：燈光最多的第一級行政區（REGION_YEARS 兩年的燈光總量，MW/sr）"""
    shutil.rmtree(OUT / "countries", ignore_errors=True)
    n = len(st.codes) + 1
    first, last = REGION_YEARS
    # (地區, 國家) → 燈光；地區歸給最後一年燈光最多的那個國家，只算那國國界內的部分
    by_region: dict[int, dict[int, list[float]]] = {}
    for year_i, year in enumerate(REGION_YEARS):
        for key, v in s["regions"][year].items():
            by_region.setdefault(key // n, {}).setdefault(key % n, [0.0, 0.0])[year_i] = v
    per_country: dict[int, list[tuple[int, float, float]]] = {}
    for region, codes in by_region.items():
        code, (v_first, v_last) = max(codes.items(), key=lambda kv: (kv[1][1], kv[1][0]))
        per_country.setdefault(code, []).append((region, v_first, v_last))
    to_mw = W_SR_PER_UNIT / 1e6
    written = 0
    for k, iso3 in enumerate(st.codes, start=1):
        if iso3 not in series["total"] or k not in per_country:
            continue
        country_last = s["light"][-1, k]
        rows = sorted(per_country[k], key=lambda r: -r[2])[:TOP_REGIONS]
        regions = [
            {
                **st.regions[region - 1],
                "light": round_sig(v_last * to_mw),
                "first": round_sig(v_first * to_mw),
                "share": round(float(100 * v_last / country_last), 1) if country_last > 0 else None,
            }
            for region, v_first, v_last in rows
            if v_last > 0
        ]
        # 只有一個地區的（小國、島嶼）列出來沒有意義
        if len(per_country[k]) < 2 or not regions:
            continue
        write_json(OUT / "countries" / f"{iso3}.json", {"years": [first, last], "regions": regions}, quiet=True)
        written += 1
    print(f"  輸出 {written} 國燈光最多的地區（countries/<ISO3>.json）")
    twn = st.codes.index("TWN") + 1
    if twn in per_country:
        top = sorted(per_country[twn], key=lambda r: -r[2])[:TOP_REGIONS]
        print("  台灣：" + "、".join(f"{st.regions[r - 1]['zh']} {v * to_mw:.3f}" for r, _f, v in top))


def report(series: dict, world: dict) -> None:
    for key in series:
        vals = sorted(((v[-1], iso3) for iso3, v in series[key].items() if v[-1] is not None), reverse=True)
        top = "、".join(f"{iso3} {v:g}" for v, iso3 in vals[:5])
        low = "、".join(f"{iso3} {v:g}" for v, iso3 in vals[-3:])
        twn = series[key].get("TWN")
        print(
            f"  {key}：{len(series[key])} 國；世界 {world[key][-1]:g}；台灣 {twn[-1] if twn else None}"
            f"（第一年 {twn[0] if twn else None}）；最高 {top}；最低 {low}"
        )
