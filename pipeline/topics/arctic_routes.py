"""北極航道能通航幾天（併進「冰河、海冰與海平面」主題，輸出到 topics/ice/，2026-10-30）。

**資料**：NOAA/NSIDC 海冰濃度氣候資料紀錄（CDR）G02202 第 6 版，北半球 25 km 每日（https://doi.org/10.7265/b18j-z797），
https://noaadata.apps.nsidc.org/NOAA/G02202_V6/north/aggregate/ 每年一個檔（約 70–100 MB，1979–2025 年共約 4 GB，
不必登入）。檔內的 license 屬性寫「No constraints on data access or use」，NSIDC 要求引用（DESIGN.md 第 8 節第 12 點）。

**航道線**：沒有開放的官方 GIS，自己沿主要航線畫示意線（ROUTES 的經緯度）：
- 北方海航道：喀拉海峽（新地島南端）→ 喀拉海 → 維利基茨基海峽 → 拉普捷夫海 → 桑尼科夫海峽 → 東西伯利亞海 → 德朗海峽 →
  楚科奇海 → 白令海峽（俄羅斯法律定的範圍是喀拉海峽到白令海峽）。
- 西北航道：南線（多數船走的、阿蒙森走過的）：蘭開斯特海峽 → 巴羅海峽 → 皮爾海峽 → 富蘭克林海峽 → 詹姆斯羅斯海峽 →
  雷伊海峽 → 辛普森海峽 → 毛德皇后灣 → 迪斯海峽 → 科羅內申灣 → 海豚與聯合海峽 → 阿蒙森灣 → 波弗特海 → 巴羅角。

**通航的天數**：航道線每 5 km 取一點，換成 25 km 格子（極地立體投影 EPSG:3411，rasterio 的 PROJ），去掉重複的；
整年都是陸地或沒有值的格子（海岸、比 25 km 窄的海峽）不算。一天裡航道上**每一格**的海冰濃度都低於 15% 才算「通航」
（海冰範圍的同一個門檻），一年加總。只看濃度：能不能通航還看冰的種類（多年冰）、破冰船與船級，說明寫明。
某一天航道上的格子全都沒有值（衛星缺資料）就不算那一天。

**輸出**（public/data/topics/ice/）：
- arctic-routes.json：兩條航道每年通航的天數（指標檔，鍵是 `_NSR`、`_NWP`，前端的 places）
- arctic-routes-lines.json：航道線（LinesData），records 有航道代碼、每年的天數（字串「天數,天數,…」，從 FIRST_YEAR 起）、
  第一次與最後一次通航的日期（最近一年）

第一次下載約 4 GB（每年一個檔），之後讀快取；讀一個檔只取航道上的格子，全部約 1 分鐘。
"""
from __future__ import annotations

import math
from datetime import date, timedelta

import numpy as np

from common import CACHE_DIR, OUT_DIR, download, indicator_file, lines_file, now_iso, write_json

OUT = OUT_DIR / "topics" / "ice"
BASE = "https://noaadata.apps.nsidc.org/NOAA/G02202_V6/north/aggregate"
FIRST_YEAR = 1979
LAST_YEAR = 2025
THRESHOLD = 0.15
STEP_KM = 5

# (代碼, 指標檔的鍵, 經緯度)：跨 180° 的經度展開成連續的（> 180）
ROUTES = [
    (1, "_NSR", [
        (58.0, 70.4), (61.0, 70.6), (65.0, 71.4), (70.0, 72.6), (75.0, 74.0), (80.0, 75.0), (86.0, 75.9), (92.0, 76.6),
        (97.0, 77.2), (101.0, 77.7), (104.5, 77.8), (108.0, 77.4), (113.0, 76.6), (118.0, 75.9), (124.0, 75.3),
        (130.0, 74.8), (136.0, 74.6), (139.5, 74.7), (142.0, 74.4), (146.0, 73.6), (151.0, 72.7), (156.0, 71.8),
        (161.0, 71.1), (166.0, 70.5), (171.0, 70.2), (176.0, 70.0), (180.0, 69.6), (184.0, 68.6), (187.0, 67.4),
        (189.0, 66.4), (190.3, 65.9),
    ]),
    (2, "_NWP", [
        (-74.5, 74.0), (-78.0, 74.2), (-82.0, 74.3), (-86.0, 74.4), (-89.5, 74.3), (-92.5, 74.2), (-95.5, 74.0),
        (-96.6, 73.4), (-96.5, 72.6), (-96.6, 71.9), (-96.6, 71.2), (-96.4, 70.4), (-96.0, 69.6), (-95.6, 68.9),
        (-96.5, 68.6), (-98.0, 68.5), (-100.5, 68.3), (-103.0, 68.3), (-105.5, 68.5), (-107.5, 68.8), (-109.5, 68.4),
        (-111.5, 68.3), (-113.5, 68.7), (-115.5, 69.2), (-117.5, 69.6), (-120.0, 70.2), (-122.5, 70.6), (-125.5, 70.9),
        (-128.5, 71.0), (-132.0, 70.9), (-136.0, 70.4), (-140.0, 70.4), (-144.0, 70.6), (-148.0, 71.0),
        (-152.0, 71.2), (-156.5, 71.6),
    ]),
]


def km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(math.radians(b[0] - a[0]) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def densify(line: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """每段切成約 STEP_KM 一點（經緯度線性內插，段都很短）"""
    out = [line[0]]
    for a, b in zip(line, line[1:]):
        n = max(1, round(km(a, b) / STEP_KM))
        out += [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(1, n + 1)]
    return out


def route_cells(line: list[tuple[float, float]], x: np.ndarray, y: np.ndarray) -> list[tuple[int, int]]:
    """航道經過的格子 (列, 行)，依航道的順序、去掉重複"""
    from rasterio.warp import transform

    pts = densify(line)
    lons = [((lon + 180) % 360) - 180 for lon, _ in pts]
    xs, ys = transform("EPSG:4326", "EPSG:3411", lons, [lat for _, lat in pts])
    cells: list[tuple[int, int]] = []
    dx, dy = x[1] - x[0], y[1] - y[0]
    for px, py in zip(xs, ys):
        c = (int(round((py - y[0]) / dy)), int(round((px - x[0]) / dx)))
        if c not in cells:
            cells.append(c)
    return cells


def year_file(year: int):
    name = f"sic_psn25_{year}0101-{year}1231_v06r00.nc"
    return download(f"{BASE}/{name}", "g02202", name)


def build() -> None:
    import netCDF4

    with netCDF4.Dataset(year_file(FIRST_YEAR)) as d:
        x, y = d.variables["x"][:].data, d.variables["y"][:].data
    cells = {code: route_cells(line, x, y) for code, _, line in ROUTES}

    days: dict[int, dict[int, int]] = {code: {} for code, _, _ in ROUTES}
    spans: dict[int, dict[int, tuple[str, str] | None]] = {code: {} for code, _, _ in ROUTES}
    ocean: dict[int, list[tuple[int, int]]] = {}
    for year in range(FIRST_YEAR, LAST_YEAR + 1):
        with netCDF4.Dataset(year_file(year)) as d:
            var = d.variables["cdr_seaice_conc"]
            # 原始的 uint8：0–100 是濃度（%），之上是旗標（陸地、海岸、湖、極點的洞、沒有資料）
            var.set_auto_maskandscale(False)
            raw = var[:]
            t = d.variables["time"][:].data
            for code, cs in cells.items():
                sub = raw[:, [r for r, _ in cs], [c for _, c in cs]]
                valid = sub <= 100
                # 整年都沒有值的格子（陸地、海岸、比 25 km 窄的海峽）不算
                keep = valid.any(axis=0)
                if year == LAST_YEAR:
                    ocean[code] = [c for c, k in zip(cs, keep) if k]
                v = sub[:, keep] / 100
                has = valid[:, keep]
                # 這一天航道上有值的格子都低於門檻（至少要有一半的格子有值，衛星缺資料的日子不算）
                open_day = (np.where(has, v < THRESHOLD, True).all(axis=1)) & (has.sum(axis=1) >= keep.sum() / 2)
                days[code][year] = int(open_day.sum())
                idx = np.flatnonzero(open_day)
                to_date = lambda i: (date(1970, 1, 1) + timedelta(days=int(t[i]))).isoformat()  # noqa: E731
                spans[code][year] = (to_date(idx[0]), to_date(idx[-1])) if len(idx) else None
        print(f"  {year}：" + "、".join(f"{key} {days[code][year]} 天" for code, key, _ in ROUTES))

    years = list(range(FIRST_YEAR, LAST_YEAR + 1))
    values = {key: [days[code][y] for y in years] for code, key, _ in ROUTES}
    write_json(OUT / "arctic-routes.json", indicator_file("arctic-routes", "天", years, values))
    records = []
    for code, key, line in ROUTES:
        last = spans[code][LAST_YEAR]
        records.append({"r": code, "d": ",".join(str(days[code][y]) for y in years),
                         "f": last[0] if last else None, "l": last[1] if last else None})
        print(f"  {key}：{len(cells[code])} 格、海上的 {len(ocean[code])} 格；{LAST_YEAR} 年 {days[code][LAST_YEAR]} 天 {last}")
    write_json(OUT / "arctic-routes-lines.json", lines_file(
        [line for _, _, line in ROUTES], 0.01, [code for code, _, _ in ROUTES],
        records=records, record_fields=["r", "d", "f", "l"], record_scale={"r": 1}))
    write_json(OUT / "arctic-routes-manifest.json", {
        "generatedAt": now_iso(),
        "source": "NOAA/NSIDC Climate Data Record of Passive Microwave Sea Ice Concentration, Version 6 (G02202), "
                  "https://doi.org/10.7265/b18j-z797",
        "threshold": THRESHOLD, "firstYear": FIRST_YEAR, "lastYear": LAST_YEAR,
        "cells": {key: len(ocean[code]) for code, key, _ in ROUTES},
        "cache": str((CACHE_DIR / "g02202").relative_to(CACHE_DIR.parent.parent)),
    })
