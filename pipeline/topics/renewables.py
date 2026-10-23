"""太陽能與風能潛力主題：各國的太陽光電發電潛力與風功率密度，依地圖本身的國界自己用面積加權算。

- 太陽能（solar）：Global Solar Atlas 2 的 PVOUT（kWh/kWp/日，sources/gsa.py 的 1 角分網格），國界內有資料的格子
  依 cos(緯度) 加權平均。GSA 只涵蓋北緯 65° 以南（俄羅斯大多只到 60°），沒有冰島：有資料的國土不到 MIN_COVER 的
  （俄羅斯 48%、格陵蘭 10%、冰島 0）不輸出，不到 NOTE_COVER 的（加拿大、芬蘭、瑞典、挪威、美國含阿拉斯加、維德角）
  附註說明只算了多少。有資料的比例 = 國界在資料緯度範圍內的面積比例（多邊形依緯線裁切後算球面面積）× 範圍內國界裡
  有資料的格子比例。
- 風能（wind）：Global Wind Atlas 4.0 的 100 公尺平均風功率密度（W/m²，sources/gwa.py 的 0.02° 網格），國界內的平均。
  平均會被高山稜線上的極端值拉高（單格可達上萬 W/m²），也被大片平地拉低，所以另外：
- 風最強的 10% 土地（wind-top10）：國界內風功率密度最高、合計占 10% 面積的格子的平均；GWA 網站的國家摘要也用這個。
- 近岸海域（offshore）：離海岸 OFFSHORE_KM 公里內的海面（GWA 的資料範圍是各國的專屬經濟海域）的平均；
  每格海面歸給最近的陸地屬於的國家（近似專屬經濟海域的等距中線），內陸國沒有。

國家範圍跟海拔、氣溫主題一樣用 population_grid.country_shapes()（法國海外省、克里米亞、西撒哈拉等依聯合國劃分拆開）。
每個網格各自把國界畫成國家編號（格子中心在國界內才算）；國土太小、一格都沒有的國家，改用碰到國界的格子
（all_touched，會含一點鄰國或海面），附註說明。

分級門檻寫在 src/topics/renewables.ts，國家面量圖與網格共用（網格圖磚那一支 topics/renewables_grid_tiles.py 有同一組，
產生時檢查一致）。
這兩份資料都是長期平均，指標檔只有一個年份（YEAR），前端的主題設 timeless，不顯示時間軸。
"""
from __future__ import annotations

import math

import numpy as np
from affine import Affine
from rasterio.features import rasterize
from scipy import ndimage

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import gsa, gwa
from topics.population_grid import OVERRIDES, bbox, country_shapes

OUT = OUT_DIR / "topics" / "renewables"
YEAR = 2025  # 指標檔的年份（timeless，畫面上不顯示）
MIN_COVER = 0.5  # 國土有資料的比例低於這個不輸出
NOTE_COVER = 0.95  # 低於這個附註說明
MIN_CELLS = 3  # 格子中心在國界內的格子少於這個數，改用 all_touched
TOP_SHARE = 0.10  # 風最強的 10% 土地
OFFSHORE_KM = 50
EARTH_RADIUS_KM = 6371.0088
STRIP = 600  # 畫國界時每次畫幾列
SKIP = {"ATA"}  # 南極洲：兩份資料都沒有

# 台灣海峽的離岸風場：經濟部能源署 2015 年公告的 36 處潛力場址大多在彰化、雲林、苗栗外海，這裡用彰化外海一塊當對照
CHANGHUA_BOX = (119.85, 23.75, 120.40, 24.25)  # (lon0, lat0, lon1, lat1)，只算海面
NORTH_SEA_BOX = (2.0, 53.5, 6.0, 55.5)  # 北海南部（英國、荷蘭、德國的離岸風場），只算海面
# 台灣各地的太陽光電潛力（附註用，數字由網格算）
TAIWAN_SOLAR_BOXES = {
    "taipei": (121.40, 24.95, 121.65, 25.15),  # 台北盆地
    "keelung": (121.60, 25.05, 121.80, 25.15),
    "south": (120.10, 22.60, 120.40, 23.20),  # 台南到高雄的平原
}
TAIWAN_WEST_LON = 120.7  # 風最強的 10% 土地裡，這條經線以西的算西部沿海平原
# Global Solar Atlas 網站上台灣的國家摘要（https://api.globalsolaratlas.info/country/TWN 的 PVOUT_mean，
# 2020 年版的資料與 GSA 自己的國界），跟這裡用新版資料、地圖國界算的對照
GSA_SITE_TWN = 3.44
# 經濟部能源署：2026 年 6 月 12 日完成第 500 座離岸風力機，累計 4.8 GW（2026-06-15 的新聞稿）
TWN_OFFSHORE_INSTALLED = "2026 年 6 月已裝設 500 座離岸風力機、累計 4.8 GW"
TWN_OFFSHORE_INSTALLED_EN = "500 offshore turbines totalling 4.8 GW had been installed by June 2026"


def build() -> None:
    shapes_by_unit = country_shapes()
    codes = sorted((shapes_by_unit.keys() | {t for _s, t, _a in OVERRIDES}) - SKIP)
    area = polygon_areas(shapes_by_unit)
    covers = {"solar": lat_cover(shapes_by_unit, *gsa.LAT_RANGE), "wind": lat_cover(shapes_by_unit, *gwa.LAT_RANGE)}

    solar = gsa.load()
    s = land_stats(solar.values, solar.transform, shapes_by_unit, codes, area, top=False)
    regions = {name: box_mean(solar.values, solar.transform, None, b) for name, b in TAIWAN_SOLAR_BOXES.items()}
    del solar, s["code_grid"]
    wind = gwa.load()
    w = land_stats(wind.values, wind.transform, shapes_by_unit, codes, area, top=True)
    off = offshore_stats(wind.values, wind.transform, w["code_grid"], len(codes))
    boxes = {
        name: box_mean(wind.values, wind.transform, w["code_grid"], b)
        for name, b in (("changhua", CHANGHUA_BOX), ("northsea", NORTH_SEA_BOX))
    }
    twn_west = top_west_share(wind.values, wind.transform, w["code_grid"], codes.index("TWN") + 1)
    del wind, w["code_grid"]

    notes = {k: {} for k in ("solar", "wind", "wind-top10", "offshore")}
    notes_en = {k: {} for k in notes}
    series = {k: {} for k in notes}
    for k, iso3 in enumerate(codes, start=1):
        for key, st, digits in (("solar", s, 2), ("wind", w, 0)):
            # 有資料的國土比例 = 在資料的緯度範圍內的比例 × 範圍內的格子有幾成有資料
            lat_part = covers[key].get(iso3, 1.0)
            value = st["mean"][k]
            cover = lat_part * st["valid_share"][k] if np.isfinite(value) else 0.0
            if st["touched"][k]:
                cover = lat_part
            if not np.isfinite(value) or cover < MIN_COVER:
                if area.get(iso3, 0) > 0:
                    note_cover(notes, notes_en, key, iso3, cover, lat_part < 0.995, missing=True)
                continue
            series[key][iso3] = round_value(value, digits)
            if cover < NOTE_COVER:
                note_cover(notes, notes_en, key, iso3, cover, lat_part < 0.995, missing=False)
            if st["touched"][k]:
                note_small(notes, notes_en, key, iso3)
            if key == "wind" and np.isfinite(st["top"][k]):
                series["wind-top10"][iso3] = round_value(st["top"][k], 0)
                if cover < NOTE_COVER:
                    note_cover(notes, notes_en, "wind-top10", iso3, cover, lat_part < 0.995, missing=False)
        if off["weight"][k] > 0:
            series["offshore"][iso3] = round_value(off["mean"][k], 0)

    world = {
        "solar": round_value(s["world"], 2),
        "wind": round_value(w["world"], 0),
        "wind-top10": round_value(w["world_top"], 0),
        "offshore": round_value(off["world"], 0),
    }
    taiwan_notes(series, world, boxes, regions, twn_west, notes, notes_en)

    units = {"solar": "kWh/kWp/day", "wind": "W/m²", "wind-top10": "W/m²", "offshore": "W/m²"}
    for key in notes:
        write_json(
            OUT / f"{key}.json",
            indicator_file(
                key,
                units[key],
                [YEAR],
                {iso3: [v] for iso3, v in sorted(series[key].items())},
                aggregates={"WLD": [world[key]]},
                notes=notes[key],
                notesEn=notes_en[key],
            ),
        )
    write_json(
        OUT / "manifest.json",
        {
            "topic": "renewables",
            "generatedAt": now_iso(),
            "source": f"Global Solar Atlas 2.0 PVOUT ({gsa.NAME}); Global Wind Atlas {gwa.VERSION} mean power density at "
            f"{gwa.HEIGHT_M} m (figshare file {gwa.FILE_ID}, 0.02° overview); country averages area-weighted on the map's own borders",
        },
    )
    report(codes, series, world, boxes)


# ── 國界面積、國家編號 ─────────────────────────────────────


def ring_area_km2(ring: list[tuple[float, float]]) -> float:
    """球面上（以正弦緯度積分）一個 ring 的面積，順逆時針都取絕對值"""
    total = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        total += math.radians(x1 - x0) * (math.sin(math.radians(y0)) + math.sin(math.radians(y1))) / 2
    return abs(total) * EARTH_RADIUS_KM**2


def clip_ring(ring: list[tuple[float, float]], south: float, north: float) -> list[tuple[float, float]]:
    """ring 只留 south ≤ 緯度 ≤ north 的部分（Sutherland–Hodgman，對兩條緯線各切一次）"""
    for limit, keep in ((north, lambda y: y <= north), (south, lambda y: y >= south)):
        out: list[tuple[float, float]] = []
        for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
            if keep(y0):
                out.append((x0, y0))
            if keep(y0) != keep(y1):
                out.append((x0 + (x1 - x0) * (limit - y0) / (y1 - y0), limit))
        ring = out
        if not ring:
            return []
    return ring + ring[:1]


def polygon_areas(shapes_by_unit: dict[str, list[list]], south: float = -90, north: float = 90) -> dict[str, float]:
    """各國國界在南北兩條緯線之間的面積（km²）。跨換日線的多邊形 country_shapes() 另外補了一份平移 360° 的，
    兩份各算一半。"""
    out: dict[str, float] = {}
    for iso3, polygons in shapes_by_unit.items():
        total = 0.0
        for polygon in polygons:
            rings = [clip_ring(r, south, north) for r in polygon]
            a = (ring_area_km2(rings[0]) if rings[0] else 0) - sum(ring_area_km2(r) for r in rings[1:] if r)
            box = bbox(polygon)
            total += a / 2 if box[0] < -180 or box[2] > 180 else a
        out[iso3] = total
    return out


def lat_cover(shapes_by_unit, south: float, north: float) -> dict[str, float]:
    """各國國土有幾成在資料的緯度範圍內（沒有國界形狀的是 1）"""
    full = polygon_areas(shapes_by_unit)
    part = polygon_areas(shapes_by_unit, south, north)
    return {iso3: part[iso3] / full[iso3] if full[iso3] > 0 else 1.0 for iso3 in full}


def code_grid(transform: Affine, shape: tuple[int, int], shapes_by_unit, codes: list[str], all_touched: bool = False,
              only: set[str] | None = None) -> np.ndarray:
    """國界畫成跟資料網格對齊的國家編號（codes 的索引 + 1，0 是不在任何國界內）"""
    index = {iso3: i + 1 for i, iso3 in enumerate(codes)}
    rows, cols = shape
    out = np.zeros(shape, np.uint16)
    shapes = [
        ({"type": "Polygon", "coordinates": polygon}, index[iso3], bbox(polygon))
        for iso3, polygons in shapes_by_unit.items()
        if iso3 in index and (only is None or iso3 in only)
        for polygon in polygons
    ]
    lon = transform.c + (np.arange(cols) + 0.5) * transform.a
    for r0 in range(0, rows, STRIP):
        h = min(STRIP, rows - r0)
        top = transform.f + r0 * transform.e
        bottom = top + h * transform.e
        nearby = [(g, c) for g, c, (_x0, y0, _x1, y1) in shapes if y1 >= bottom and y0 <= top]
        if not nearby:
            continue
        t = Affine(transform.a, 0, transform.c, 0, transform.e, top)
        block = rasterize(nearby, out_shape=(h, cols), transform=t, fill=0, dtype="uint16", all_touched=all_touched)
        lat = top + (np.arange(h) + 0.5) * transform.e
        for source, target, (lon0, lat0, lon1, lat1) in OVERRIDES:
            # 來源是「不在任何國界內」的（吐瓦魯、托克勞）會把整塊海面算成陸地，這裡不套用：風能網格的海面也有值
            if source is None or target not in index or source not in index:
                continue
            rr = (lat >= lat0) & (lat <= lat1)
            cc = (lon >= lon0) & (lon <= lon1)
            if rr.any() and cc.any():
                sub = block[np.ix_(rr, cc)]
                sub[sub == index[source]] = index[target]
                block[np.ix_(rr, cc)] = sub
        out[r0 : r0 + h] = block
    return out


def cell_area_km2(transform: Affine, rows: int) -> np.ndarray:
    """每一列一格的球面面積（km²）"""
    north = np.radians(transform.f + np.arange(rows) * transform.e)
    south = north + np.radians(transform.e)
    return EARTH_RADIUS_KM**2 * np.radians(transform.a) * (np.sin(north) - np.sin(south))


# ── 陸地的統計 ───────────────────────────────────────────


def land_stats(values: np.ndarray, transform: Affine, shapes_by_unit, codes: list[str], area: dict[str, float], top: bool) -> dict:
    """各國的平均（面積加權）、資料涵蓋率；top=True 時再算風最強的 TOP_SHARE 面積的平均"""
    n = len(codes) + 1
    rows, cols = values.shape
    grid = code_grid(transform, values.shape, shapes_by_unit, codes)
    cell_area = cell_area_km2(transform, rows)
    valid = np.isfinite(values)

    weight = np.zeros(n)  # 有資料的格子面積
    in_grid = np.zeros(n)  # 國界內所有格子的面積（含沒有資料的）
    total = np.zeros(n)
    cells = np.zeros(n, np.int64)
    border_cells = np.zeros(n, np.int64)
    for r0 in range(0, rows, STRIP):
        g = grid[r0 : r0 + STRIP]
        a = np.broadcast_to(cell_area[r0 : r0 + STRIP, None], g.shape)
        ok = valid[r0 : r0 + STRIP] & (g > 0)
        weight += np.bincount(g[ok], weights=a[ok], minlength=n)
        in_grid += np.bincount(g.ravel(), weights=a.ravel(), minlength=n)
        total += np.bincount(g[ok], weights=a[ok] * values[r0 : r0 + STRIP][ok], minlength=n)
        cells += np.bincount(g[ok], minlength=n)
        border_cells += np.bincount(g.ravel(), minlength=n)

    # 國土太小、一格都沒畫到的國家：改用碰到國界的格子
    small = {iso3 for k, iso3 in enumerate(codes, start=1) if border_cells[k] < MIN_CELLS and area.get(iso3, 0) > 0}
    touched = np.zeros(n, bool)
    if small:
        extra = code_grid(transform, values.shape, shapes_by_unit, codes, all_touched=True, only=small)
        r, c = np.nonzero(extra)
        k = extra[r, c].astype(np.int64)
        ok = valid[r, c]
        a = cell_area[r]
        for kk in np.unique(k[ok]):
            sel = ok & (k == kk)
            weight[kk] = in_grid[kk] = a[sel].sum()
            total[kk] = (a[sel] * values[r[sel], c[sel]]).sum()
            cells[kk] = sel.sum()
            touched[kk] = True

    with np.errstate(invalid="ignore", divide="ignore"):
        mean = total / weight
        # 網格範圍內、國界內的格子有幾成有資料（GSA 在俄羅斯北緯 60° 以北大多沒有、維德角有幾個島沒有）
        valid_share = np.where(in_grid > 0, weight / in_grid, 0.0)
    world_ok = weight[1:].sum()
    out = {
        "mean": mean,
        "valid_share": valid_share,
        "cells": cells,
        "touched": touched,
        "world": float(total[1:].sum() / world_ok),
        "code_grid": grid,
    }
    if top:
        out["top"], out["world_top"] = top_share(values, valid, grid, cell_area, n)
    return out


def top_share(values, valid, grid, cell_area, n: int) -> tuple[np.ndarray, float]:
    """各國（與全世界）風最強、合計占 TOP_SHARE 面積的格子的平均"""
    rr, cc = np.nonzero(valid & (grid > 0))
    code = grid[rr, cc].astype(np.int32)
    v = values[rr, cc].astype(np.float64)
    a = cell_area[rr]
    del rr, cc

    def mean_of_top(order: np.ndarray, group: np.ndarray) -> np.ndarray:
        """依 order 排好（同一組內由大到小）後，每組取累積面積到 TOP_SHARE 的格子的平均"""
        g, val, w = group[order], v[order], a[order]
        cum = np.cumsum(w)
        start = np.r_[0, np.nonzero(g[1:] != g[:-1])[0] + 1]
        base = np.repeat(cum[start] - w[start], np.diff(np.r_[start, len(g)]))
        tot = np.bincount(g, weights=w, minlength=n)
        before = cum - w - base  # 這一格之前（同一組內）累積的面積
        take = np.clip(TOP_SHARE * tot[g] - before, 0, w)  # 跨過門檻的那一格只算一部分
        with np.errstate(invalid="ignore", divide="ignore"):
            return np.bincount(g, weights=take * val, minlength=n) / np.bincount(g, weights=take, minlength=n)

    by_country = mean_of_top(np.lexsort((-v, code)), code)
    world = mean_of_top(np.argsort(-v, kind="stable"), np.zeros(len(v), np.int32))[0]
    return by_country, float(world)


# ── 近岸海域 ───────────────────────────────────────────


def offshore_stats(values: np.ndarray, transform: Affine, grid: np.ndarray, ncodes: int) -> dict:
    """離岸 OFFSHORE_KM 公里內的海面，各自歸給最近的陸地所屬的國家，算面積加權平均。

    逐條（1° 高）做距離轉換：南北的格距固定，東西的格距用這一條中央緯度的 cos 換算；經度在 ±180° 接起來。
    """
    n = ncodes + 1
    rows, cols = values.shape
    dy = abs(transform.e) * math.pi / 180 * EARTH_RADIUS_KM
    pad_r = math.ceil(OFFSHORE_KM / dy) + 1
    step = round(1 / abs(transform.e))
    cell_area = cell_area_km2(transform, rows)
    land = grid > 0
    weight = np.zeros(n)
    total = np.zeros(n)
    for r0 in range(0, rows, step):
        r1 = min(rows, r0 + step)
        lat = transform.f + (r0 + r1) / 2 * transform.e
        dx = dy * max(math.cos(math.radians(lat)), 0.05)
        pad_c = min(cols, math.ceil(OFFSHORE_KM / dx) + 1)
        a, b = max(0, r0 - pad_r), min(rows, r1 + pad_r)
        sub = land[a:b]
        if not sub.any():
            continue
        wrapped = np.concatenate([sub[:, -pad_c:], sub, sub[:, :pad_c]], axis=1)
        dist, (ir, ic) = ndimage.distance_transform_edt(~wrapped, sampling=(dy, dx), return_indices=True)
        core = slice(r0 - a, r1 - a)
        cs = slice(pad_c, pad_c + cols)
        d = dist[core, cs]
        sea = np.isfinite(values[r0:r1]) & ~land[r0:r1] & (d <= OFFSHORE_KM)
        if not sea.any():
            continue
        near_r = ir[core, cs][sea] + a
        near_c = (ic[core, cs][sea] - pad_c) % cols
        code = grid[near_r, near_c].astype(np.int64)
        w = np.broadcast_to(cell_area[r0:r1, None], sea.shape)[sea]
        weight += np.bincount(code, weights=w, minlength=n)
        total += np.bincount(code, weights=w * values[r0:r1][sea], minlength=n)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = total / weight
    return {"mean": mean, "weight": weight, "world": float(total[1:].sum() / weight[1:].sum())}


def box_mean(values: np.ndarray, transform: Affine, grid: np.ndarray | None, box: tuple[float, float, float, float]) -> float:
    """一個經緯度範圍內有資料的格子的面積加權平均；有 grid 時只算海面（不在任何國界內的格子）"""
    lon0, lat0, lon1, lat1 = box
    c0, c1 = int((lon0 - transform.c) / transform.a), int((lon1 - transform.c) / transform.a)
    r0, r1 = int((lat1 - transform.f) / transform.e), int((lat0 - transform.f) / transform.e)
    sub = values[r0:r1, c0:c1]
    w = np.broadcast_to(cell_area_km2(transform, values.shape[0])[r0:r1, None], sub.shape)
    ok = np.isfinite(sub)
    if grid is not None:
        ok &= grid[r0:r1, c0:c1] == 0
    return float((sub[ok] * w[ok]).sum() / w[ok].sum())


# ── 附註 ──────────────────────────────────────────────


def round_value(v: float, digits: int) -> float | int:
    return round(float(v), digits) if digits else int(round(float(v)))


def pct(v: float) -> str:
    return f"{v * 100:.0f}%"


# 資料範圍的特殊情況（附註用）：GSA 在俄羅斯只到北緯 60°（歐洲部分到 65°）
COVER_DETAIL = {
    ("solar", "RUS"): ("北緯 60° 以北大多沒有資料，歐洲部分到 65°", "most land north of 60°N has no data, 65°N in European Russia"),
}


def note_cover(notes, notes_en, key: str, iso3: str, cover: float, lat_limited: bool, missing: bool) -> None:
    """只有一部分國土有資料、或完全沒有資料的附註"""
    name = "Global Solar Atlas" if key == "solar" else "Global Wind Atlas"
    north = (gsa if key == "solar" else gwa).LAT_RANGE[1]
    if missing and cover < 0.005:
        # 在範圍內卻沒有資料：GSA 沒有冰島；兩份都沒有凱爾蓋朗群島、赫德島這類無人島
        notes[key][iso3] = f"{name} 沒有這裡的資料。"
        notes_en[key][iso3] = f"{name} has no data here."
        return
    zh_why, en_why = COVER_DETAIL.get((key, iso3), (f"北緯 {north:.0f}° 以北沒有資料", f"there is no data north of {north:.0f}°N") if lat_limited else ("部分地區沒有資料", "some areas have no data"))
    if missing:
        notes[key][iso3] = f"{name} 只有這裡 {pct(cover)} 的國土有資料（{zh_why}），不到一半，不列出平均。"
        notes_en[key][iso3] = f"{name} has data for only {pct(cover)} of this country's land ({en_why}), less than half, so no average is shown."
    else:
        extra = "；更北的地方日照更少" if key == "solar" and lat_limited else ""
        extra_en = "; further north there is even less sun" if key == "solar" and lat_limited else ""
        notes[key][iso3] = f"{name} 只有這裡 {pct(cover)} 的國土有資料（{zh_why}{extra}），平均只含這些地方。"
        notes_en[key][iso3] = f"{name} has data for only {pct(cover)} of this country's land ({en_why}{extra_en}); the average covers that part only."


def note_small(notes, notes_en, key: str, iso3: str) -> None:
    zh = "國土比網格的格子還小，改用碰到國界的格子，含一點鄰近的海面或鄰國。"
    en = "The country is smaller than the grid cells, so cells touching its border are used; they include some nearby sea or neighbouring land."
    notes[key][iso3] = (notes[key].get(iso3, "") + " " + zh).strip()
    notes_en[key][iso3] = (notes_en[key].get(iso3, "") + " " + en).strip()


def top_west_share(values: np.ndarray, transform: Affine, grid: np.ndarray, code: int) -> float:
    """這個國家風最強的 TOP_SHARE 土地裡，位在 TAIWAN_WEST_LON 以西的面積比例（台灣：西部沿海平原 vs 中央山脈）"""
    rr, cc = np.nonzero(grid == code)
    v = values[rr, cc]
    ok = np.isfinite(v)
    rr, cc, v = rr[ok], cc[ok], v[ok]
    a = cell_area_km2(transform, values.shape[0])[rr]
    order = np.argsort(-v)
    take = np.cumsum(a[order]) <= TOP_SHARE * a.sum()
    lon = transform.c + (cc[order][take] + 0.5) * transform.a
    return float(a[order][take][lon < TAIWAN_WEST_LON].sum() / a[order][take].sum())


def taiwan_notes(series, world, boxes, regions, west_share, notes, notes_en) -> None:
    """台灣的附註：數值本身、國內各地的差別，加上台灣海峽與北海的對照（數字都是這次由網格算出來的）"""

    def rank(key: str) -> tuple[int, int]:
        values = sorted(series[key].values(), reverse=True)
        return values.index(series[key]["TWN"]) + 1, len(values)

    s, w, t, o = (series[k].get("TWN") for k in ("solar", "wind", "wind-top10", "offshore"))
    if s is not None:
        r, n = rank("solar")
        tp, kl, so = regions["taipei"], regions["keelung"], regions["south"]
        notes["solar"]["TWN"] = (
            f"台灣平均每 1 kWp 每天約可發 {s:.2f} 度電（一年約 {s * 365:,.0f} 度），在 {n} 個國家中排第 {r}"
            f"（世界陸地平均 {world['solar']:.2f}）。北部冬季多雲：台北盆地約 {tp:.1f}、基隆約 {kl:.1f}；"
            f"台南到高雄的平原約 {so:.1f}；高山因為空氣稀薄、氣溫低也不低。"
            f"Global Solar Atlas 網站上的台灣摘要（舊版資料、它自己的國界）是 {GSA_SITE_TWN:.2f}。"
        )
        notes_en["solar"]["TWN"] = (
            f"In Taiwan, 1 kWp of PV yields about {s:.2f} kWh a day (about {s * 365:,.0f} kWh a year), ranking {r} of {n} "
            f"(world land average {world['solar']:.2f}). The north is cloudy in winter: about {tp:.1f} in the Taipei Basin and "
            f"{kl:.1f} in Keelung, against about {so:.1f} on the Tainan–Kaohsiung plain; the mountains also score well thanks to "
            f"thin, cool air. The Global Solar Atlas website's Taiwan summary (older data, its own borders) gives {GSA_SITE_TWN:.2f}."
        )
    if w is not None and t is not None:
        west = round(west_share * 100)
        notes["wind"]["TWN"] = (
            f"陸地平均 {w:,} W/m²；風最強的 10% 土地平均 {t:,} W/m²，約 {west}% 在西部沿海平原、其餘多在中央山脈稜線。"
            "台灣的風能主要在海上：見「近岸海域的風能」與網格（台灣海峽）。"
        )
        notes_en["wind"]["TWN"] = (
            f"Land average {w:,} W/m²; the windiest 10% of land averages {t:,} W/m², about {west}% of it on the western coastal "
            "plain and most of the rest on Central Mountain Range ridges. Taiwan's wind resource is mostly offshore: see "
            "nearshore wind and the grid (Taiwan Strait)."
        )
        notes["wind-top10"]["TWN"] = notes["wind"]["TWN"]
        notes_en["wind-top10"]["TWN"] = notes_en["wind"]["TWN"]
    if o is not None:
        r, n = rank("offshore")
        lon0, lat0, lon1, lat1 = CHANGHUA_BOX
        notes["offshore"]["TWN"] = (
            f"離岸 {OFFSHORE_KM} 公里內的海面平均 {o:,} W/m²，在 {n} 個臨海國家中排第 {r}"
            f"（含風比較弱、水很深的東部外海）。台灣海峽在東北季風與海峽的狹管效應下風很強："
            f"彰化外海（北緯 {lat0}°–{lat1}°、東經 {lon0}°–{lon1}° 的海面）平均 {boxes['changhua']:,.0f} W/m²，"
            f"比北海南部（英國、荷蘭、德國離岸風場所在，北緯 {NORTH_SEA_BOX[1]}°–{NORTH_SEA_BOX[3]}°、"
            f"東經 {NORTH_SEA_BOX[0]:.0f}°–{NORTH_SEA_BOX[2]:.0f}°）的 {boxes['northsea']:,.0f} W/m² 還高。"
            f"經濟部能源署 2015 年公告的 36 處離岸風電潛力場址多在彰化、雲林、苗栗外海；{TWN_OFFSHORE_INSTALLED}（能源署）。"
        )
        notes_en["offshore"]["TWN"] = (
            f"Sea within {OFFSHORE_KM} km of the coast averages {o:,} W/m², ranking {r} of {n} coastal countries (this includes "
            f"the deep, less windy waters off the east coast). The Taiwan Strait is very windy as the north-east monsoon is "
            f"funnelled through it: the sea off Changhua ({lat0}–{lat1}°N, {lon0}–{lon1}°E) averages {boxes['changhua']:,.0f} W/m², "
            f"more than the {boxes['northsea']:,.0f} W/m² of the southern North Sea, home to British, Dutch and German offshore "
            f"wind farms ({NORTH_SEA_BOX[1]}–{NORTH_SEA_BOX[3]}°N, {NORTH_SEA_BOX[0]:.0f}–{NORTH_SEA_BOX[2]:.0f}°E). Most of the "
            f"36 offshore wind zones announced by Taiwan's Energy Administration in 2015 lie off Changhua, Yunlin and Miaoli; "
            f"{TWN_OFFSHORE_INSTALLED_EN} (Energy Administration)."
        )


def report(codes, series, world, boxes) -> None:
    for key in series:
        values = series[key]
        top = sorted(values.items(), key=lambda kv: -kv[1])
        print(f"  {key}：{len(values)} 國，世界 {world[key]}；最高 {top[:5]}；最低 {top[-5:]}；台灣 {values.get('TWN')}")
        v = np.array(list(values.values()), float)
        print(f"    分位數（10/25/50/75/90%）：{np.percentile(v, [10, 25, 50, 75, 90]).round(2).tolist()}")
    print(f"  彰化外海 {boxes['changhua']:.0f} W/m²，北海南部 {boxes['northsea']:.0f} W/m²")
