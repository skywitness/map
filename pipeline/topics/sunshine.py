"""氣溫與降雨主題的「日照時數」：CRU CL v2.0 的日照百分比（sunp）換算成一年的日照小時，算各國面積加權平均。

- CRU CL v2.0（New et al. 2002）：1961–1990 年的 30 年平均氣候值，10′（1/6°）的陸地網格，不含南極洲。
  `grid_10min_sunp.dat.gz` 每列一個格子：格子中心的緯度、經度，加上 12 個月的日照百分比
  （sunshine percent of maximum possible：實際日照占可照時數的百分比）。
- 換算：每個月的日照時數 = 百分比 × 那個月中旬（第 15 天）的天文可照時數（太陽中心在地平線上，不含大氣折射）× 那個月的天數，
  一年是 12 個月加總。用這個算法，臺北的格子是 1,704 小時、倫敦 1,469 小時（跟製作手冊查證的一樣）。
- 測站少的地方是內插的；只有 1961–1990 一個時期，指標只有一個「年份」（存成 1990，時間軸寫「1961–1990 年平均」）。
- 國家範圍跟氣溫與降雨一樣用 population_grid.country_shapes()：國界畫成 1/30° 的細網格，
  權重 = 格子裡這國的細格數 × cos(緯度)。沒碰到格子的小島國用 100 km 內最近的格子，再遠的從缺。
- 台灣：附註另列中央氣象署測站 2016–2024 年的日照時數（sources/cwa_monthly.py）。
- 授權：CRU 資料頁把 CRU-CL v2.0 列在同一頁，License 一節「These datasets are made available under the
  Open Database License」，跟 CRU TS 一樣（ODbL，各國平均同樣以 ODbL 提供）。
"""
from __future__ import annotations

import gzip

import numpy as np
from affine import Affine
from rasterio.features import rasterize

from common import CACHE_DIR, OUT_DIR, download, indicator_file, write_json
from sources import cwa_monthly
from topics.population_grid import OVERRIDES, country_shapes
from topics.temperature import fmt, haversine_km

URL = "https://crudata.uea.ac.uk/cru/data/hrg/tmc/grid_10min_sunp.dat.gz"
SOURCE = "cru_cl"
OUT = OUT_DIR / "topics" / "temperature"
YEAR = 1990  # 1961–1990 年平均存成這一年
CELL = 1 / 6
ROWS, COLS = 1080, 2160
FINE = 5  # 每個 10′ 格子切成 5 × 5 的細格（2′，赤道約 3.7 km）
NEAREST_KM = 100
SKIP = {"ATA"}
DAYS = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])
MID = np.cumsum(DAYS) - DAYS + 15  # 每個月第 15 天是一年的第幾天
CWA_STATIONS = ["基隆", "臺北", "新竹", "臺中", "嘉義", "臺南", "高雄", "恆春", "臺東", "花蓮", "宜蘭", "澎湖"]
CWA_EN = {
    "基隆": "Keelung", "臺北": "Taipei", "新竹": "Hsinchu", "臺中": "Taichung", "嘉義": "Chiayi", "臺南": "Tainan",
    "高雄": "Kaohsiung", "恆春": "Hengchun", "臺東": "Taitung", "花蓮": "Hualien", "宜蘭": "Yilan", "澎湖": "Penghu",
}
RECENT = (2016, 2024)


def daylength(lat: np.ndarray) -> np.ndarray:
    """(12, 格子)：每個月中旬的天文可照時數（小時）。赤緯用 Cooper (1969) 的近似"""
    decl = np.radians(23.44) * np.sin(2 * np.pi * (284 + MID) / 365)
    x = -np.tan(np.radians(lat))[None, :] * np.tan(decl)[:, None]
    return 24 / np.pi * np.arccos(np.clip(x, -1, 1))


def load() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """格子中心的緯度、經度與一年的日照時數"""
    cached = CACHE_DIR / SOURCE / "sunp.npz"
    if cached.exists():
        with np.load(cached) as z:
            return z["lat"], z["lon"], z["hours"]
    path = download(URL, SOURCE, "grid_10min_sunp.dat.gz")
    with gzip.open(path, "rt") as f:
        table = np.loadtxt(f, dtype=np.float64)
    if table.shape[1] != 14:
        raise ValueError(f"{path.name} 每列應該有 14 個數字（緯度、經度、12 個月），實際 {table.shape[1]}")
    lat, lon, pct = table[:, 0], table[:, 1], table[:, 2:]
    if pct.min() < 0 or pct.max() > 100:
        raise ValueError(f"日照百分比超出 0–100：{pct.min()}–{pct.max()}")
    hours = (pct.T / 100 * daylength(lat) * DAYS[:, None]).sum(axis=0)
    np.savez(cached, lat=lat, lon=lon, hours=hours)
    print(f"  {len(lat):,} 格")
    return lat, lon, hours


def build() -> None:
    lat, lon, hours = load()
    row = np.floor((90 - lat) / CELL).astype(np.int64)
    col = np.floor((lon + 180) / CELL).astype(np.int64) % COLS
    if ((90 - (row + 0.5) * CELL - lat) ** 2).max() > 1e-4:
        raise ValueError("格子中心不在 10′ 網格上")
    cell_index = np.full(ROWS * COLS, -1, np.int64)
    cell_index[row * COLS + col] = np.arange(len(lat))

    weights, how = country_weights(cell_index, lat, lon)
    codes = sorted(weights)
    values = {}
    for iso3 in codes:
        idx, w = weights[iso3]
        values[iso3] = float(np.round((hours[idx] * w).sum() / w.sum()))
    area = np.cos(np.radians(lat))
    world = float(np.round((hours * area).sum() / area.sum()))

    notes, notes_en = {}, {}
    for iso3 in codes:
        kind, amount = how[iso3]
        if kind == "nearest":
            notes[iso3] = f"CRU CL 的 10′ 網格在國土上沒有格子，改用約 {amount:.0f} km 外最近的格子"
            notes_en[iso3] = f"The CRU CL 10′ grid has no cell on this territory; the nearest cell, about {amount:.0f} km away, is used"
    taiwan_note(codes, values, lat, lon, hours, notes, notes_en)
    write_json(
        OUT / "sunshine.json",
        indicator_file(
            "sunshine", "hours", [YEAR], {iso3: [v] for iso3, v in values.items()},
            aggregates={"WLD": [world]}, notes=notes, notesEn=notes_en,
        ),
    )
    report(codes, values, world, lat, lon, hours)


def country_weights(cell_index, lat, lon) -> tuple[dict[str, tuple[np.ndarray, np.ndarray]], dict[str, tuple]]:
    """{ISO3: (格子的索引, 權重)}、{ISO3: ('area', 0) 或 ('nearest', 距離 km)}"""
    shapes_by_unit = country_shapes()
    codes = sorted(shapes_by_unit.keys() | {target for _s, target, _a in OVERRIDES})
    index = {iso3: i + 1 for i, iso3 in enumerate(codes)}
    n = len(codes) + 1
    step = CELL / FINE
    fine_rows, fine_cols = ROWS * FINE, COLS * FINE
    shapes = [({"type": "Polygon", "coordinates": p}, index[iso3]) for iso3, polys in shapes_by_unit.items() for p in polys]
    print(f"  畫國界（{fine_cols} × {fine_rows}）")
    fine = rasterize(shapes, out_shape=(fine_rows, fine_cols), transform=Affine(step, 0, -180, 0, -step, 90), fill=0, dtype="uint16")
    flat = 90 - (np.arange(fine_rows) + 0.5) * step
    flon = -180 + (np.arange(fine_cols) + 0.5) * step
    for source, target, (lon0, lat0, lon1, lat1) in OVERRIDES:
        rr = np.nonzero((flat >= lat0) & (flat <= lat1))[0]
        cc = np.nonzero((flon >= lon0) & (flon <= lon1))[0]
        if rr.size and cc.size:
            block = fine[np.ix_(rr, cc)]
            block[block == (index[source] if source else 0)] = index[target]
            fine[np.ix_(rr, cc)] = block
    rows, cols = np.nonzero(fine)
    code = fine[rows, cols].astype(np.int64)
    del fine
    cell = (rows // FINE) * COLS + cols // FINE
    key, counts = np.unique(cell * n + code, return_counts=True)
    cell_of, code_of = key // n, key % n
    data_of = cell_index[cell_of]

    weights, how = {}, {}
    for iso3, k in index.items():
        if iso3 in SKIP or iso3.startswith("_"):
            continue
        sel = (code_of == k) & (data_of >= 0)
        if sel.any():
            idx = data_of[sel]
            weights[iso3] = (idx, counts[sel] * np.cos(np.radians(lat[idx])))
            how[iso3] = ("area", 0)
            continue
        own = code == k
        if own.any():
            plat, plon = flat[rows[own]], flon[cols[own]]
        else:
            pts = [(x, y) for poly in shapes_by_unit.get(iso3, []) for ring in poly for x, y in ring]
            pts += [((a[0] + a[2]) / 2, (a[1] + a[3]) / 2) for _s, t, a in OVERRIDES if t == iso3]
            if not pts:
                continue
            plon, plat = np.array([p[0] for p in pts]), np.array([p[1] for p in pts])
        if plat.size > 500:
            pick = np.linspace(0, plat.size - 1, 500).astype(int)
            plat, plon = plat[pick], plon[pick]
        near = np.nonzero((np.abs(lat - plat.mean()) < 3) & (np.abs(((lon - plon.mean() + 180) % 360) - 180) < 4))[0]
        if not near.size:
            print(f"  {iso3}：附近沒有 CRU CL 的格子，從缺")
            continue
        best_d, best_j = np.inf, -1
        for a, b in zip(plat, plon):
            d = haversine_km(a, b, lat[near], lon[near])
            j = int(np.argmin(d))
            if d[j] < best_d:
                best_d, best_j = float(d[j]), int(near[j])
        if best_d <= NEAREST_KM:
            weights[iso3] = (np.array([best_j]), np.array([1.0]))
            how[iso3] = ("nearest", best_d)
        else:
            print(f"  {iso3}：{NEAREST_KM} km 內沒有 CRU CL 的格子（最近 {best_d:.0f} km），從缺")
    return weights, how


def cell_at(lat, lon, la, lo) -> int:
    return int(np.argmin((lat - la) ** 2 + (lon - lo) ** 2))


def taiwan_note(codes, values, lat, lon, hours, notes, notes_en) -> None:
    if "TWN" not in codes:
        return
    taipei = float(hours[cell_at(lat, lon, 25.08, 121.58)])
    kaohsiung = float(hours[cell_at(lat, lon, 22.58, 120.33)])
    stations = cwa_monthly.annual(cwa_monthly.monthly(), "sun")
    zh, en = [], []
    for name in CWA_STATIONS:
        by_year = stations.get(name, {})
        vals = [by_year[y] for y in range(RECENT[0], RECENT[1] + 1) if y in by_year]
        if len(vals) < 5:
            raise ValueError(f"氣象署 {name} 站 {RECENT[0]}–{RECENT[1]} 年的完整年份只有 {len(vals)} 年")
        zh.append(f"{name} {fmt(min(vals), 0)}–{fmt(max(vals), 0)}")
        en.append(f"{CWA_EN[name]} {fmt(min(vals), 0)}–{fmt(max(vals), 0)}")
    v = values["TWN"]
    notes["TWN"] = (
        f"CRU CL 的 1961–1990 年平均：全島 {fmt(v, 0)} 小時（臺北的格子 {fmt(taipei, 0)}、高雄的格子 {fmt(kaohsiung, 0)} 小時）。"
        f"中央氣象署測站 {RECENT[0]}–{RECENT[1]} 年每年的日照時數是 {'、'.join(zh)} 小時"
    )
    notes_en["TWN"] = (
        f"CRU CL 1961–1990 average: {fmt(v, 0)} hours island-wide ({fmt(taipei, 0)} for the Taipei cell, {fmt(kaohsiung, 0)} for "
        f"the Kaohsiung cell). The Central Weather Administration's stations recorded these yearly ranges over "
        f"{RECENT[0]}–{RECENT[1]}: {', '.join(en)} hours"
    )
    print("  " + notes["TWN"])


def report(codes, values, world, lat, lon, hours) -> None:
    print(f"  輸出 {len(codes)} 個國家/地區；世界（陸地，不含南極洲）{world:.0f} 小時")
    for name, (la, lo) in {"蘇丹埃及交界": (20.75, 32.58), "亞斯文": (24.08, 32.92), "尤馬": (32.75, -114.58), "倫敦": (51.5, -0.12),
                           "重慶": (29.58, 106.58), "托爾斯港": (62.0, -6.75), "臺北": (25.08, 121.58), "臺中": (24.15, 120.68),
                           "高雄": (22.58, 120.33)}.items():
        j = cell_at(lat, lon, la, lo)
        print(f"  格子 {name}（{lat[j]:.2f}, {lon[j]:.2f}）：{hours[j]:.0f}")
    for iso3 in ("TWN", "EGY", "GBR", "IRL", "ISL", "CHN", "JPN", "USA", "AUS", "SAU", "NOR", "FRO"):
        if iso3 in values:
            print(f"  {iso3}：{values[iso3]:.0f}")
    q = np.percentile(list(values.values()), [0, 5, 25, 50, 75, 95, 100])
    print("  分位數（0/5/25/50/75/95/100）：" + " / ".join(f"{v:.0f}" for v in q))
