"""住在山上的人（2026-11-07，製作手冊第二十七批 547，候選 1233；擴充「海拔」；步驟 mountain-people，輸出 topics/elevation/）。

- 山區：GMBA Mountain Inventory v2 的 291 個主要山系（standard_300，CC BY 4.0；海拔主題的山脈圖層同一份，topics/mountains.py），
  合起來就是 GMBA 依地形起伏定義的全部山區。「山區」各家定義不同（UNEP-WCMC 的 Kapos 分級、FAO 的山區人口都不一樣），
  這裡照 GMBA。
- 人口：JRC GHS-POP R2023A 2020 年、30 角秒（CC BY 4.0；sources/ghsl.py）。國界與海岸的補法跟人口網格一樣
  （population_grid.country_shapes、ghsl.country_codes、fill_gaps：有人口卻落在國界外的海岸像素歸給最近的國家）。
- 海拔：USGS GMTED2010 的 30 角秒平均值（mn30，公有領域；sources/gmted.py）。人口加權平均海拔＝Σ(人口×海拔)÷Σ人口，
  每一個人口像素取中心落在哪一格 GMTED。海洋的格子在 GMTED 是 0。

輸出：mountain-pop.json（山區人口）、mountain-pop-share.json（占全國人口 %）、pop-elevation.json（人口加權平均海拔，公尺）、
mountain-range-pop.json（側欄：每國人口最多的山系 [山系編號, 人口]）。全國約 3 分鐘。
"""
from __future__ import annotations

import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.windows import Window
from rasterio.windows import transform as window_transform

from common import CACHE_DIR, indicator_file, write_json
from sources import ghsl
from sources.ghsl import GAP_FILL_PIXELS, ROWS_PER_WINDOW, country_codes, fill_gaps
from topics import mountains
from topics.population_grid import OVERRIDES, bbox, country_shapes

OUT = mountains.OUT
EPOCH = 2020
TOP = 6
GMTED_MN30 = CACHE_DIR / "gmted" / "mn30_grd"  # sources/gmted.py 的 grid_paths() 會下載三份；這裡只要平均值


def _dem_path():
    if (GMTED_MN30 / "hdr.adf").exists():
        return GMTED_MN30
    from sources import gmted

    return gmted.grid_paths()["mn30"]


def build() -> None:
    recs = mountains.read()
    names = [r["Name_EN"] or r["MapName"] for r in recs]
    ranges = [(r["geom"], i + 1) for i, r in enumerate(recs)]
    nr = len(recs) + 1
    shapes_by_unit = country_shapes()
    codes = sorted(shapes_by_unit.keys() | {target for _s, target, _a in OVERRIDES})
    index = {iso3: i + 1 for i, iso3 in enumerate(codes)}
    shapes = [({"type": "Polygon", "coordinates": polygon}, index[iso3], bbox(polygon))
              for iso3, polygons in shapes_by_unit.items() for polygon in polygons]
    overrides = [(index[s] if s else 0, index[t_], a) for s, t_, a in OVERRIDES]
    n = len(codes) + 1
    total = np.zeros(n)
    by_range = np.zeros(n * nr)
    elev_sum = np.zeros(n)
    elev_pop = np.zeros(n)

    with rasterio.open(ghsl.raster_path(EPOCH)) as src, rasterio.open(_dem_path()) as dem:
        t, width = src.transform, src.width
        lon = t.c + (np.arange(width) + 0.5) * t.a
        lon = (lon + 180) % 360 - 180
        dt = dem.transform
        dem_col = np.clip(np.floor((lon - dt.c) / dt.a).astype(np.int64), 0, dem.width - 1)
        for row_off in range(0, src.height, ROWS_PER_WINDOW):
            h = min(ROWS_PER_WINDOW, src.height - row_off)
            pop = src.read(1, window=Window(0, row_off, width, h))
            pop[~np.isfinite(pop) | (pop < 0)] = 0
            if not pop.any():
                continue
            top = max(0, row_off - GAP_FILL_PIXELS)
            bottom = min(src.height, row_off + h + GAP_FILL_PIXELS)
            code = country_codes(shapes, Window(0, top, width, bottom - top), t)
            fill_gaps(code, row_off - top, pop)
            code = code[row_off - top: row_off - top + h].astype(np.int64)
            lat = t.f + (row_off + np.arange(h) + 0.5) * t.e
            for source, target, (lon0, lat0, lon1, lat1) in overrides:
                rr = (lat >= lat0) & (lat <= lat1)
                cc = (lon >= lon0) & (lon <= lon1)
                if rr.any() and cc.any():
                    block = code[np.ix_(rr, cc)]
                    block[block == source] = target
                    code[np.ix_(rr, cc)] = block
            # 山系
            window = Window(0, row_off, width, h)
            lat_top, lat_bottom = t.f + row_off * t.e, t.f + (row_off + h) * t.e
            near = [(g, v) for g, v in ranges if g.bounds[3] >= lat_bottom and g.bounds[1] <= lat_top]
            rng = (rasterize(near, out_shape=(h, width), transform=window_transform(window, t), fill=0, dtype="uint16")
                   if near else np.zeros((h, width), np.uint16)).astype(np.int64)
            # 海拔：每一列對到 GMTED 的哪一列（北緯 84° 以北沒有，那裡也沒有人）
            dem_row = np.floor((lat - dt.f) / dt.e).astype(np.int64)
            ok_rows = (dem_row >= 0) & (dem_row < dem.height)
            elev = np.full((h, width), np.nan)
            if ok_rows.any():
                r0, r1 = int(dem_row[ok_rows].min()), int(dem_row[ok_rows].max())
                block = dem.read(1, window=Window(0, r0, dem.width, r1 - r0 + 1)).astype(np.float64)
                block[block == dem.nodata] = np.nan
                elev[ok_rows] = block[dem_row[ok_rows] - r0][:, dem_col]

            m = pop > 0
            c, p = code[m], pop[m]
            total += np.bincount(c, weights=p, minlength=n)
            by_range += np.bincount(c * nr + rng[m], weights=p, minlength=n * nr)
            e = elev[m]
            ok = np.isfinite(e)
            elev_sum += np.bincount(c[ok], weights=p[ok] * e[ok], minlength=n)
            elev_pop += np.bincount(c[ok], weights=p[ok], minlength=n)

    by_range = by_range.reshape(n, nr)
    mountain = by_range[:, 1:].sum(axis=1)
    pop_v, share_v, elev_v, panel = {}, {}, {}, {}
    for iso3, k in index.items():
        if iso3.startswith("_") or total[k] < 1000:
            continue
        pop_v[iso3] = [int(round(mountain[k]))]
        share_v[iso3] = [round(float(mountain[k] / total[k] * 100), 1)]
        if elev_pop[k] > 0:
            elev_v[iso3] = [int(round(elev_sum[k] / elev_pop[k]))]
        top = [(int(i), float(by_range[k, i + 1])) for i in np.argsort(-by_range[k, 1:])[:TOP] if by_range[k, i + 1] >= 500]
        if top:
            panel[iso3] = [[i, int(round(p))] for i, p in top]
    world_total, world_mountain = float(total[1:].sum()), float(mountain[1:].sum())
    world_elev = float(elev_sum[1:].sum() / elev_pop[1:].sum())
    write_json(OUT / "mountain-pop.json", indicator_file("mountain-pop", "人", [EPOCH], pop_v, aggregates={"WLD": [round(world_mountain)]},
                                                          license="CC BY 4.0"))
    write_json(OUT / "mountain-pop-share.json", indicator_file(
        "mountain-pop-share", "%", [EPOCH], share_v, aggregates={"WLD": [round(world_mountain / world_total * 100, 1)]}, license="CC BY 4.0"))
    write_json(OUT / "pop-elevation.json", indicator_file("pop-elevation", "m", [EPOCH], elev_v, aggregates={"WLD": [round(world_elev)]},
                                                           license="CC BY 4.0"))
    write_json(OUT / "mountain-range-pop.json", {"countries": panel})

    print(f"  全世界：人口 {world_total / 1e9:.3f} 億×10、山區 {world_mountain / 1e9:.3f} 十億（{world_mountain / world_total:.1%}），"
          f"人口加權平均海拔 {world_elev:.0f} 公尺")
    for label, d in (("山區人口", pop_v), ("占比", share_v), ("平均海拔", elev_v)):
        best = sorted(((v[0], c) for c, v in d.items() if total[index[c]] >= 1e5), reverse=True)[:14]
        print(f"  {label}：" + "、".join(f"{c} {v:,}" for v, c in best))
    low = sorted((v[0], c) for c, v in elev_v.items() if total[index[c]] >= 1e6)[:8]
    print("  平均海拔最低：" + "、".join(f"{c} {v}" for v, c in low))
    for c in ("TWN", "CHN", "JPN", "NPL", "BOL", "ETH", "CHE", "NLD", "BGD", "USA", "IND", "RWA", "LSO", "AFG", "ECU", "COL", "PER", "MEX"):
        top = "、".join(f"{names[i]} {p:,}" for i, p in panel.get(c, [])[:3])
        print(f"  {c}：山區 {pop_v.get(c)} 人（{share_v.get(c)}%）、平均海拔 {elev_v.get(c)}；{top}")
