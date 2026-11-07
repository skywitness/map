"""光害：人工夜空有多亮（2026-11-07，製作手冊第二十五批 489，候選 1152；新主題，環境的「污染與廢棄物」；步驟 light-pollution，
輸出 topics/light-pollution/）。

- 夜空：Falchi 等人 2016《The New World Atlas of Artificial Night Sky Brightness》的補充資料（GFZ Data Services，
  doi:10.5880/GFZ.1.4.2016.001，CC BY-NC 4.0，只准非商業）。原始檔是天頂的人工亮度（mcd/m²）的 30 角秒網格
  （43,200 × 17,406，北緯 85.05° 到南緯 60°，沒有南極洲），用 2014 年的 VIIRS 與大氣散射模式算出來。
  dataservices.gfz.de 的 robots.txt 不准 Claude，原始 zip（684 MB，tif 3 GB）由使用者用瀏覽器下載，本機 session 在原始網格上
  照論文 Fig. 10 的 6 級分級（不重新取樣），存成 uint8 的 light-pollution-classes-30ss.tif（5.4 MB）放在 map-plan 的 data/gfz/，
  執行前複製到 .cache/gfz/。
  門檻（人工亮度，μcd/m²）：0 級 < 1.74（原始夜空，比自然夜空亮不到 1%）、1 級 < 14、2 級 < 87、3 級 < 688、
  4 級 < 3000（看不到銀河）、5 級 ≥ 3000（眼睛無法暗適應）。論文的統計也用這 6 級：14 以上算「光污染」，688 以上看不到銀河。
- 人口：JRC GHS-POP R2023A 的 2015 年 30 角秒網格（sources/ghsl.py，跟地圖集同一時期）。國家範圍跟夜間燈光一樣，
  在 GHS-POP 的網格上依地圖國界畫國家編號（population_grid.country_shapes()），有人口卻落在海岸線外的格子歸給最近的國家。
  GHS-POP 的每一格依中心點對到分級檔最近的那一格（兩個網格的格寬都是 1/120°，原點不同）。
- 面積：每格依緯度算（球面），只算國界內的格子（不補海岸，fill_gaps 會把海岸外的海也歸給國家，小島國的面積會被暗的海稀釋）、
  只算分級檔有涵蓋的部分（南緯 60° 以南、北緯 85.05° 以北沒有資料）。人口或國土有涵蓋的部分不到 MIN_COVER 的不輸出那一組
  指標（南極洲都沒有；1:50m 沒有形狀的吐瓦魯、托克勞只有人口的指標）。

指標（各國 GHS-POP 人口或國土面積裡，這幾級的比例，%）：
- milky-way-pop：看不到銀河的人口比例（4、5 級）
- polluted-pop：光污染下的人口比例（2 級以上，人工亮度 ≥ 14 μcd/m²）
- pristine-pop：住在原始夜空下的人口比例（0 級）
- milky-way-area：看不到銀河的國土比例
- pristine-area：原始夜空的國土比例
側欄用 classes.json：各國人口與國土在 6 級的比例。
"""
from __future__ import annotations

import time

import numpy as np

import common
import rasterio
from rasterio.windows import Window

from common import CACHE_DIR, OUT_DIR, indicator_file, now_iso, write_json
from sources import ghsl
from topics.population_grid import OVERRIDES, bbox, country_shapes

OUT = OUT_DIR / "topics" / "light-pollution"
CLASSES_TIF = CACHE_DIR / "gfz" / "light-pollution-classes-30ss.tif"
CLASSES_SHA256 = "3cf577ac7e3a5f81b7d3bd614b0a4de5bf4bcce35fb8153fa08a2ef5913487f4"
POP_EPOCH = 2015
YEAR = 2015  # 地圖集的時間（VIIRS 2014 年，人口用 2015 年那一期）
N_CLASSES = 6
NODATA = 255
MILKY_WAY = 4  # 這一級以上看不到銀河
POLLUTED = 2  # 這一級以上算光污染（人工亮度 ≥ 14 μcd/m²）
MIN_COVER = 0.5
G_ROWS = 256
STATS_VERSION = 2  # 統計的算法改了就加一
EARTH_RADIUS_KM = 6371.0088
LICENSE = "CC BY-NC 4.0"
ATTRIBUTION = (
    "Falchi, F. et al. (2016): Supplement to: The New World Atlas of Artificial Night Sky Brightness. V. 1.1. "
    "GFZ Data Services. doi:10.5880/GFZ.1.4.2016.001; Falchi, F. et al. (2016), Science Advances 2(6), e1600377, "
    "doi:10.1126/sciadv.1600377. Classified into six levels at the original 30″ resolution."
)


def _check_file() -> None:
    import hashlib

    if not CLASSES_TIF.exists():
        raise SystemExit(f"找不到 {CLASSES_TIF}：先把 map-plan 的 data/gfz/light-pollution-classes-30ss.tif 複製到 .cache/gfz/")
    digest = hashlib.sha256(CLASSES_TIF.read_bytes()).hexdigest()
    if digest != CLASSES_SHA256:
        raise SystemExit(f"{CLASSES_TIF.name} 的 SHA-256 不對（{digest}），檔案換過了就更新 CLASSES_SHA256")


def build() -> None:
    started = time.perf_counter()
    _check_file()
    # 統計約 2 分鐘，存一份在快取，只改輸出時不必重算；改了統計的程式要加 --refresh
    cache = CACHE_DIR / "gfz" / f"stats-{STATS_VERSION}.npz"
    if cache.exists() and not common.REFRESH:
        z = np.load(cache, allow_pickle=False)
        print(f"  用快取的統計（{cache.name}）")
        write_outputs([str(c) for c in z["codes"]], z["pop"], z["area"])
        return
    shapes_by_unit = country_shapes()
    codes = sorted(shapes_by_unit.keys() | {t for _s, t, _a in OVERRIDES})
    index = {iso3: i + 1 for i, iso3 in enumerate(codes)}
    shapes = [
        ({"type": "Polygon", "coordinates": polygon}, index[iso3], bbox(polygon))
        for iso3, polygons in shapes_by_unit.items()
        for polygon in polygons
    ]
    overrides = [ghsl.Override(index[s] if s else 0, index[t], *area) for s, t, area in OVERRIDES]
    n = len(codes) + 1
    pop = np.zeros((N_CLASSES + 1, n))  # 最後一列：沒有分級資料的人口
    area = np.zeros((N_CLASSES + 1, n))
    pop_path = ghsl.raster_path(POP_EPOCH)

    with rasterio.open(pop_path) as g, rasterio.open(CLASSES_TIF) as c:
        tg, tc = g.transform, c.transform
        width, height = g.width, g.height
        lon_g = tg.c + (np.arange(width) + 0.5) * tg.a
        lon_wrapped = (lon_g + 180) % 360 - 180
        col_c = np.floor((lon_wrapped - tc.c) / tc.a).astype(np.int64)
        col_ok = (col_c >= 0) & (col_c < c.width)
        col_c = np.clip(col_c, 0, c.width - 1)
        for g0 in range(0, height, G_ROWS):
            h = min(G_ROWS, height - g0)
            p = g.read(1, window=Window(0, g0, width, h))
            p[~np.isfinite(p) | (p < 0)] = 0
            top = max(0, g0 - ghsl.GAP_FILL_PIXELS)
            bottom = min(height, g0 + h + ghsl.GAP_FILL_PIXELS)
            cc = ghsl.country_codes(shapes, Window(0, top, width, bottom - top), tg)
            # 面積只算國界內的格子（ca）；人口另外補海岸（cc）：fill_gaps 會把海岸外約 20 km 內的海也歸給國家，
            # 小島國（馬爾他）的面積會被暗的海稀釋
            ca = cc[g0 - top : g0 - top + h].copy()
            pad = np.zeros((bottom - top, width))
            pad[g0 - top : g0 - top + h] = p
            ghsl.fill_gaps(cc, 0, pad)
            cc = cc[g0 - top : g0 - top + h]
            lat_g = tg.f + (g0 + np.arange(h) + 0.5) * tg.e
            for o in overrides:
                r = (lat_g >= o.lat0) & (lat_g <= o.lat1)
                k = (lon_g >= o.lon0) & (lon_g <= o.lon1)
                if r.any() and k.any():
                    for arr in (cc, ca) if o.source else (cc,):  # 不在國界內的矩形（吐瓦魯、托克勞）只用來歸人口
                        block = arr[np.ix_(r, k)]
                        block[block == o.source] = o.target
                        arr[np.ix_(r, k)] = block
            if not cc.any():
                continue
            # 這一段 GHS-POP 的列對到分級檔的哪幾列
            row_c = np.floor((lat_g - tc.f) / tc.e).astype(np.int64)
            row_ok = (row_c >= 0) & (row_c < c.height)
            cls = np.full((h, width), NODATA, dtype=np.uint8)
            if row_ok.any():
                r0, r1 = int(row_c[row_ok].min()), int(row_c[row_ok].max()) + 1
                src = c.read(1, window=Window(0, r0, c.width, r1 - r0))
                rows = np.nonzero(row_ok)[0]
                sub = src[row_c[rows] - r0][:, col_c]
                sub[:, ~col_ok] = NODATA
                cls[rows] = sub
            cls = np.where(cls < N_CLASSES, cls, N_CLASSES).astype(np.int64)  # NoData 歸到最後一類
            north = np.radians(tg.f + (g0 + np.arange(h)) * tg.e)
            cell_area = EARTH_RADIUS_KM**2 * np.radians(tg.a) * (np.sin(north) - np.sin(north + np.radians(tg.e)))
            size = (N_CLASSES + 1) * n
            key = cls.ravel() * n + cc.astype(np.int64).ravel()
            pop += np.bincount(key, weights=p.ravel(), minlength=size).reshape(N_CLASSES + 1, n)
            key = cls.ravel() * n + ca.astype(np.int64).ravel()
            area += np.bincount(key, weights=np.broadcast_to(cell_area[:, None], (h, width)).ravel(), minlength=size).reshape(
                N_CLASSES + 1, n
            )
    print(f"  統計完成，{time.perf_counter() - started:.0f} 秒")
    np.savez(cache, codes=np.array(codes), pop=pop, area=area)
    write_outputs(codes, pop, area)


def _pct(part: float, whole: float) -> float:
    return round(100 * float(part) / float(whole), 1)


def write_outputs(codes: list[str], pop: np.ndarray, area: np.ndarray) -> None:
    out: dict[str, dict[str, list[float | None]]] = {k: {} for k in ("milky-way-pop", "polluted-pop", "pristine-pop", "milky-way-area", "pristine-area")}
    classes: dict[str, dict[str, list[float]]] = {}
    skipped = []
    for i, iso3 in enumerate(codes, start=1):
        p_cls, a_cls = pop[:N_CLASSES, i], area[:N_CLASSES, i]
        p_all, a_all = pop[:, i].sum(), area[:, i].sum()
        a_cov, p_cov = a_cls.sum(), p_cls.sum()
        has_pop = p_all > 0 and p_cov / p_all >= MIN_COVER
        has_area = a_all > 0 and a_cov / a_all >= MIN_COVER
        if not has_pop and not has_area:
            skipped.append(iso3)
            continue
        entry: dict[str, list[float]] = {}
        if has_pop:
            out["milky-way-pop"][iso3] = [_pct(p_cls[MILKY_WAY:].sum(), p_cov)]
            out["polluted-pop"][iso3] = [_pct(p_cls[POLLUTED:].sum(), p_cov)]
            out["pristine-pop"][iso3] = [_pct(p_cls[0], p_cov)]
            entry["pop"] = [round(100 * float(v / p_cov), 2) for v in p_cls]
        if has_area:
            out["milky-way-area"][iso3] = [_pct(a_cls[MILKY_WAY:].sum(), a_cov)]
            out["pristine-area"][iso3] = [_pct(a_cls[0], a_cov)]
            entry["area"] = [round(100 * float(v / a_cov), 2) for v in a_cls]
        classes[iso3] = entry
    # 世界：所有有國家的格子（不含 0 號「不在任何國界內」）
    wp, wa = pop[:N_CLASSES, 1:].sum(axis=1), area[:N_CLASSES, 1:].sum(axis=1)
    world = {
        "milky-way-pop": _pct(wp[MILKY_WAY:].sum(), wp.sum()),
        "polluted-pop": _pct(wp[POLLUTED:].sum(), wp.sum()),
        "pristine-pop": _pct(wp[0], wp.sum()),
        "milky-way-area": _pct(wa[MILKY_WAY:].sum(), wa.sum()),
        "pristine-area": _pct(wa[0], wa.sum()),
    }
    for ind, values in out.items():
        write_json(
            OUT / f"{ind}.json",
            indicator_file(
                ind, "%", [YEAR], dict(sorted(values.items())), aggregates={"WLD": [world[ind]]}, license=LICENSE, attribution=ATTRIBUTION
            ),
        )
    write_json(OUT / "classes.json", {"year": YEAR, "classes": classes, "world": {
        "pop": [round(100 * float(v / wp.sum()), 2) for v in wp], "area": [round(100 * float(v / wa.sum()), 2) for v in wa]}})
    write_json(OUT / "manifest.json", {
        "topic": "light-pollution", "generatedAt": now_iso(),
        "source": "Falchi et al. 2016, The New World Atlas of Artificial Night Sky Brightness (GFZ Data Services, CC BY-NC 4.0); JRC GHS-POP R2023A",
    })
    print(f"  {len(classes)} 國；沒有輸出（涵蓋不到一半）：{skipped}")
    print(f"  世界：{world}")
    for ind, values in out.items():
        top = sorted(((v[0], k) for k, v in values.items()), reverse=True)
        print(f"  {ind}：最高 {top[:12]}")
        print(f"    最低 {top[-8:]}")
    for iso3 in ("TWN", "SGP", "KWT", "QAT", "MLT", "SMR", "ARE", "ISR", "EGY", "TCD", "CAF", "MDG", "BEL", "NLD", "PSE", "TTO", "USA", "JPN", "KOR", "CHN", "DEU", "AUS", "MNG", "NAM"):
        if iso3 in classes:
            print(f"  {iso3}：" + "、".join(f"{k} {v[iso3][0]}" for k, v in out.items() if iso3 in v))
