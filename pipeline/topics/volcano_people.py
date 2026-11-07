"""住在活火山旁邊的人（2026-11-07，製作手冊第二十七批 539，候選 1220；擴充「地震與火山」；步驟 volcano-people，
輸出到 topics/earthquakes/）。

- 火山：GVP 的全新世火山（sources/gvp.py），去掉海面下的（海拔 < 0 的 112 座）；海拔不明的照算。
- 人口：JRC GHS-POP R2023A 的 2020 年 30 角秒網格（sources/ghsl.py 的 EPOCH，CC BY 4.0）。國家範圍跟光害、夜間燈光一樣：
  在 GHS-POP 的網格上依地圖國界畫國家編號，有人口卻落在海岸線外的格子歸給最近的國家（ghsl.fill_gaps），加上 OVERRIDES。
- 做法：每一格的中心離最近的火山幾公里（局部的等距近似：經度差 × cos(緯度) × 111.195 公里，100 公里以內誤差很小），
  100 公里以內的才算；跨國的火山，圈到的人照所在的國家算（同一個人只算一次，不會因為離兩座火山都近就算兩次）。
- 半徑不等於危險範圍（火山碎屑流十幾公里、火山灰可以到幾百公里），這裡只回答「人離火山多遠」，不是災害模型。

輸出（各國，2020 年）：
- volcano-pop/{10,30,100}.json：住在全新世火山 10／30／100 公里內的人數
- volcano-pop-share/{10,30,100}.json：占全國人口的比例（%）
"""
from __future__ import annotations

import time

import numpy as np
import rasterio
from rasterio.windows import Window

import common
from common import CACHE_DIR, indicator_file, write_json
from sources import ghsl, gvp
from topics.earthquakes import OUT
from topics.population_grid import OVERRIDES, bbox, country_shapes

EPOCH = ghsl.EPOCH  # 2020
RADII = (10, 30, 100)
KM_PER_DEG = 111.195
G_ROWS = 256
STATS_VERSION = 1


def _stats() -> tuple[list[str], np.ndarray, np.ndarray]:
    """回傳國家代碼、各國總人口、各國在每個半徑內的人口（len(RADII) × 國家數）"""
    cache = CACHE_DIR / "gvp" / f"volcano-people-{EPOCH}-v{STATS_VERSION}.npz"
    if cache.exists() and not common.REFRESH:
        z = np.load(cache, allow_pickle=False)
        print(f"  用快取的統計（{cache.name}）")
        return [str(c) for c in z["codes"]], z["total"], z["near"]
    started = time.perf_counter()
    volcanoes = [v for v in gvp.holocene_volcanoes() if v.elevation is None or v.elevation >= 0]
    vlon = np.array([v.lon for v in volcanoes])
    vlat = np.array([v.lat for v in volcanoes])
    print(f"  陸上的全新世火山 {len(volcanoes)} 座")
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
    total = np.zeros(n)
    near = np.zeros((len(RADII), n))
    max_km = max(RADII)
    with rasterio.open(ghsl.raster_path(EPOCH)) as g:
        t = g.transform
        width, height = g.width, g.height
        lon = t.c + (np.arange(width) + 0.5) * t.a
        for g0 in range(0, height, G_ROWS):
            h = min(G_ROWS, height - g0)
            lat = t.f + (g0 + np.arange(h) + 0.5) * t.e
            p = g.read(1, window=Window(0, g0, width, h))
            p[~np.isfinite(p) | (p < 0)] = 0
            if not p.any():
                continue
            top = max(0, g0 - ghsl.GAP_FILL_PIXELS)
            bottom = min(height, g0 + h + ghsl.GAP_FILL_PIXELS)
            cc = ghsl.country_codes(shapes, Window(0, top, width, bottom - top), t)
            pad = np.zeros((bottom - top, width))
            pad[g0 - top : g0 - top + h] = p
            ghsl.fill_gaps(cc, 0, pad)
            cc = cc[g0 - top : g0 - top + h]
            for o in overrides:
                r = (lat >= o.lat0) & (lat <= o.lat1)
                k = (lon >= o.lon0) & (lon <= o.lon1)
                if r.any() and k.any():
                    block = cc[np.ix_(r, k)]
                    block[block == o.source] = o.target
                    cc[np.ix_(r, k)] = block
            code = cc.astype(np.int64).ravel()
            total += np.bincount(code, weights=p.ravel(), minlength=n)
            # 這一條緯度帶裡，每一格離最近的火山幾公里（100 公里以外的是 inf）
            dist = np.full((h, width), np.inf, dtype=np.float32)
            lat_pad = max_km / KM_PER_DEG
            hits = np.flatnonzero((vlat >= lat.min() - lat_pad) & (vlat <= lat.max() + lat_pad))
            for i in hits:
                rows = np.flatnonzero(np.abs(lat - vlat[i]) * KM_PER_DEG <= max_km)
                if not len(rows):
                    continue
                coslat = max(np.cos(np.radians(abs(vlat[i]) + lat_pad)), 0.01)
                lon_pad = max_km / (KM_PER_DEG * coslat)
                dlon_all = (lon - vlon[i] + 180) % 360 - 180
                cols = np.flatnonzero(np.abs(dlon_all) <= lon_pad)
                if not len(cols):
                    continue
                dy = (lat[rows] - vlat[i])[:, None] * KM_PER_DEG
                dx = dlon_all[cols][None, :] * np.cos(np.radians(lat[rows]))[:, None] * KM_PER_DEG
                d = np.sqrt(dx * dx + dy * dy).astype(np.float32)
                sub = dist[np.ix_(rows, cols)]
                dist[np.ix_(rows, cols)] = np.minimum(sub, d)
            flat = dist.ravel()
            for j, radius in enumerate(RADII):
                m = flat <= radius
                if m.any():
                    near[j] += np.bincount(code[m], weights=p.ravel()[m], minlength=n)
    print(f"  統計完成，{time.perf_counter() - started:.0f} 秒")
    np.savez(cache, codes=np.array(codes), total=total, near=near)
    return codes, total, near


def build() -> None:
    codes, total, near = _stats()
    year = EPOCH
    world_total = float(total.sum())
    print(f"  GHS-POP {EPOCH} 全世界 {world_total / 1e9:.3f} 億×10（不在任何國家的 {total[0] / 1e6:.2f} 百萬）")
    for j, radius in enumerate(RADII):
        people: dict[str, list[float]] = {}
        share: dict[str, list[float]] = {}
        for i, c in enumerate(codes, start=1):
            if total[i] <= 0:
                continue
            people[c] = [round(float(near[j, i]))]
            share[c] = [round(100 * float(near[j, i]) / float(total[i]), 2)]
        world = float(near[j].sum())
        write_json(OUT / "volcano-pop" / f"{radius}.json", indicator_file(
            "volcano-pop", "people", [year], people, aggregates={"WLD": [round(world)]},
            attribution=ghsl.CITATION))
        write_json(OUT / "volcano-pop-share" / f"{radius}.json", indicator_file(
            "volcano-pop-share", "%", [year], share, aggregates={"WLD": [round(100 * world / world_total, 2)]},
            attribution=ghsl.CITATION))
        top = sorted(((v[0], k) for k, v in people.items()), reverse=True)[:12]
        top_share = sorted(((v[0], k) for k, v in share.items() if total[codes.index(k) + 1] >= 1e6), reverse=True)[:12]
        print(f"  {radius} 公里內：全世界 {world / 1e6:.1f} 百萬人（{100 * world / world_total:.2f}%）；人數 {[(k, round(v / 1e6, 2)) for v, k in top]}")
        print(f"    比例（百萬人以上的國家）{[(k, v) for v, k in top_share]}；台灣 {people.get('TWN')}、{share.get('TWN')}%；"
              f"日本 {share.get('JPN')}%、印尼 {share.get('IDN')}%、菲律賓 {share.get('PHL')}%")
