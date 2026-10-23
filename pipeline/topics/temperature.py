"""氣溫與降雨主題：用 CRU TS 的 0.5° 月資料（sources/cru.py）自己算各國的面積加權平均。

- 年平均氣溫：12 個月的月均溫平均（°C）。
- 年降雨量：12 個月的降雨量加總（mm）。
- 暖化：某年 Y 的值 = Y−9 到 Y 這 10 年的年均溫平均 − 1951–1980 年的平均（°C）。
  基準期用 1951–1980 而不是 1901–1930：CRU TS 在離測站太遠的格子直接填氣候平均值（距平 0），
  20 世紀初非洲、南美內陸、北極的測站很少，早期的值會被拉向平均，拿來當基準會低估暖化。
  1951 年以後測站多很多。
- 側欄：每國一個檔（countries/<ISO3>.json），1991–2020 年的每月氣候平均值與每年的逐月值。

國家範圍跟海拔主題一樣用 population_grid.country_shapes()（法國海外省、克里米亞、西撒哈拉等依聯合國劃分拆開）。
國界先畫成 0.05° 的細網格，算出每個 0.5° 格子裡各國占幾成，權重 = 占比 × cos(緯度)（格子的面積），
只算 CRU 有資料的陸地格子。比一個格子還小的國家（新加坡）照樣有占比；完全沒碰到 CRU 陸地格子的小島國，
改用 NEAREST_KM 內最近的陸地格子，再遠的從缺。

世界值：全部陸地格子（CRU 本身就不含南極洲）的面積加權平均。
暖化網格圖磚（topics/temperature_grid_tiles.py）用同一份 CRU 資料、同一組門檻。
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

import numpy as np
from affine import Affine
from rasterio.features import rasterize

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import cru
from topics.population_grid import OVERRIDES, country_shapes
# 暖化的定義（基準期、幾年平均、分級門檻）放在網格圖磚那一支：部署時只跑那一支、快取鍵也只看那一支
from topics.temperature_grid_tiles import WINDOW, warming_series

OUT = OUT_DIR / "topics" / "temperature"
NORMAL = (1991, 2020)  # 側欄的氣候平均值（WMO 現行的標準氣候期）
FINE = 10  # 國界細網格：每個 0.5° 格子切成 10 × 10（0.05°，赤道約 5.5 km）
NEAREST_KM = 100  # 沒碰到 CRU 陸地格子的國家，用這個距離內最近的陸地格子
SMALL_CELLS = 0.5  # 國土不到半個格子的國家，附註說明數值含鄰近地區
EARTH_RADIUS_KM = 6371.0088
SKIP = {"ATA"}  # 南極洲：CRU TS 沒有資料


def build() -> None:
    tmp = cru.load("tmp")
    pre = cru.load("pre")
    if not np.array_equal(tmp.mask, pre.mask):
        raise ValueError("CRU 的氣溫與降雨陸地範圍不同")
    weights, how = country_weights(tmp.mask)
    codes = sorted(weights)
    w = np.stack([weights[c] for c in codes])  # (國家, 陸地格)
    w /= w.sum(axis=1, keepdims=True)
    area = np.cos(np.radians(tmp.lat)).astype(np.float32)
    world = area / area.sum()

    # 各國與世界的逐月值：(月, 國家)
    monthly_t = tmp.values @ w.T
    monthly_p = pre.values @ w.T
    world_t = tmp.values @ world
    world_p = pre.values @ world
    years = tmp.years
    annual_t = monthly_t.reshape(len(years), 12, -1).mean(axis=1)  # (年, 國家)
    annual_p = monthly_p.reshape(len(years), 12, -1).sum(axis=1)
    world_annual_t = world_t.reshape(len(years), 12).mean(axis=1)
    world_annual_p = world_p.reshape(len(years), 12).sum(axis=1)

    warm_years = years[WINDOW - 1 :]
    warming = warming_series(annual_t, years)
    world_warming = warming_series(world_annual_t[:, None], years)[:, 0]

    # 指標檔、附註與側欄的「全年」都用同一份四捨五入後的值，畫面上各處的數字才會一致
    # （不能拿四捨五入後的逐月值重算全年，會差 0.1 °C 或 1 mm）
    # float32 的 20.17 轉成 float 是 20.170000076…，先換成 float64 再四捨五入
    annual_t, annual_p = np.round(annual_t.astype(np.float64), 2), np.round(annual_p.astype(np.float64))
    warming = np.round(warming.astype(np.float64), 2)
    normal = slice(years.index(NORMAL[0]), years.index(NORMAL[1]) + 1)
    normal_t, normal_p = np.round(annual_t[normal].mean(axis=0), 2), np.round(annual_p[normal].mean(axis=0))

    notes, notes_en = country_notes(codes, how, annual_t, annual_p, warming, normal_t, normal_p, years, warm_years)
    files = {
        "temperature": ("°C", years, annual_t, world_annual_t, 2),
        "precipitation": ("mm", years, annual_p, world_annual_p, 0),
        "warming": ("°C", warm_years, warming, world_warming, 2),
    }
    for name, (unit, ys, values, world_values, digits) in files.items():
        series = {iso3: [round(float(v), digits) if digits else round(float(v)) for v in values[:, k]] for k, iso3 in enumerate(codes)}
        agg = [round(float(v), digits) if digits else round(float(v)) for v in world_values]
        write_json(
            OUT / f"{name}.json",
            indicator_file(
                name, unit, ys, series,
                aggregates={"WLD": agg},
                notes=notes[name], notesEn=notes_en[name],
            ),
        )

    write_monthly(codes, years, monthly_t, monthly_p, annual_t, annual_p, normal_t, normal_p)
    write_json(OUT / "manifest.json", {
        "topic": "temperature",
        "generatedAt": now_iso(),
        "source": f"CRU TS v{cru.VERSION} (Climatic Research Unit, University of East Anglia; NCAS), 0.5° monthly tmp & pre; "
        "country averages area-weighted on the map's own borders; Taiwan cross-check: 中央氣象署",
    })
    print(f"  輸出 {len(codes)} 個國家/地區（{sum(1 for h in how.values() if h[0] == 'nearest')} 個用最近的陸地格子）")
    report(codes, years, annual_t, annual_p, warming, warm_years, world_annual_t, world_annual_p, world_warming)


# ── 國家 → 陸地格子的權重 ───────────────────────────────────


def country_weights(mask: np.ndarray) -> tuple[dict[str, np.ndarray], dict[str, tuple]]:
    """{ISO3: 每個 CRU 陸地格子的權重}、{ISO3: ('area', 占幾格) 或 ('nearest', 距離 km)}"""
    shapes_by_unit = country_shapes()
    codes = sorted(shapes_by_unit.keys() | {target for _s, target, _a in OVERRIDES})
    index = {iso3: i + 1 for i, iso3 in enumerate(codes)}
    n = len(codes) + 1
    fine_rows, fine_cols = cru.ROWS * FINE, cru.COLS * FINE
    step = cru.CELL / FINE
    transform = Affine(step, 0, -180, 0, -step, 90)
    shapes = [
        ({"type": "Polygon", "coordinates": polygon}, index[iso3])
        for iso3, polygons in shapes_by_unit.items()
        for polygon in polygons
    ]
    print(f"  畫國界（{fine_cols} × {fine_rows}）")
    fine = rasterize(shapes, out_shape=(fine_rows, fine_cols), transform=transform, fill=0, dtype="uint16")
    lat = 90 - (np.arange(fine_rows) + 0.5) * step
    lon = -180 + (np.arange(fine_cols) + 0.5) * step
    for source, target, (lon0, lat0, lon1, lat1) in OVERRIDES:
        rr = np.nonzero((lat >= lat0) & (lat <= lat1))[0]
        cc = np.nonzero((lon >= lon0) & (lon <= lon1))[0]
        if rr.size and cc.size:
            block = fine[np.ix_(rr, cc)]
            block[block == (index[source] if source else 0)] = index[target]
            fine[np.ix_(rr, cc)] = block

    # 每個 0.5° 格子裡各國的細格數
    rows, cols = np.nonzero(fine)
    code = fine[rows, cols].astype(np.int64)
    cell = (rows // FINE) * cru.COLS + cols // FINE
    key, counts = np.unique(cell * n + code, return_counts=True)
    cell_of, code_of = key // n, key % n

    land_index = np.full(cru.ROWS * cru.COLS, -1, np.int64)
    land_index[np.flatnonzero(mask)] = np.arange(int(mask.sum()))
    land_rows, land_cols = np.nonzero(mask)
    land_lat = 90 - (land_rows + 0.5) * cru.CELL
    land_lon = -180 + (land_cols + 0.5) * cru.CELL
    cos_cell = np.cos(np.radians(90 - (cell_of // cru.COLS + 0.5) * cru.CELL))

    weights: dict[str, np.ndarray] = {}
    how: dict[str, tuple] = {}
    nland = int(mask.sum())
    for iso3, k in index.items():
        if iso3 in SKIP or iso3.startswith("_"):
            continue
        sel = code_of == k
        li = land_index[cell_of[sel]]
        on_land = li >= 0
        if on_land.any():
            vec = np.zeros(nland, np.float32)
            np.add.at(vec, li[on_land], counts[sel][on_land] / FINE**2 * cos_cell[sel][on_land])
            weights[iso3] = vec
            how[iso3] = ("area", float((counts[sel][on_land] / FINE**2).sum()))
            continue
        # 沒有碰到 CRU 的陸地格子：國土的細格（太小沒有細格的，用多邊形的頂點）到最近的陸地格子
        if sel.any():
            pr, pc = rows[code == k], cols[code == k]
            plat, plon = lat[pr], lon[pc]
        else:
            pts = [(x, y) for poly in shapes_by_unit.get(iso3, []) for ring in poly for x, y in ring]
            pts += [((a[0] + a[2]) / 2, (a[1] + a[3]) / 2) for _s, t, a in OVERRIDES if t == iso3]
            if not pts:
                continue
            plon, plat = np.array([p[0] for p in pts]), np.array([p[1] for p in pts])
        # 太小、沒有細格的國家（梵蒂岡、摩納哥），頂點所在的格子是陸地就直接用那幾格
        inside = land_index[
            np.clip(((90 - plat) // cru.CELL).astype(np.int64), 0, cru.ROWS - 1) * cru.COLS
            + np.clip(((plon + 180) // cru.CELL).astype(np.int64) % cru.COLS, 0, cru.COLS - 1)
        ]
        inside = np.unique(inside[inside >= 0])
        if inside.size:
            vec = np.zeros(nland, np.float32)
            vec[inside] = np.cos(np.radians(land_lat[inside]))
            weights[iso3] = vec
            how[iso3] = ("area", 0.0)
            continue
        if plat.size > 2000:
            pick = np.linspace(0, plat.size - 1, 2000).astype(int)
            plat, plon = plat[pick], plon[pick]
        best_d, best_j = np.inf, -1
        for a, b in zip(plat, plon):
            d = haversine_km(a, b, land_lat, land_lon)
            j = int(np.argmin(d))
            if d[j] < best_d:
                best_d, best_j = float(d[j]), j
        if best_d <= NEAREST_KM:
            vec = np.zeros(nland, np.float32)
            vec[best_j] = 1
            weights[iso3] = vec
            how[iso3] = ("nearest", best_d)
        else:
            print(f"  {iso3}：{NEAREST_KM} km 內沒有 CRU 的陸地格子（最近 {best_d:.0f} km），從缺")
    return weights, how


def haversine_km(lat0: float, lon0: float, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    p0, p = np.radians(lat0), np.radians(lat)
    dlon = np.radians(lon - lon0)
    a = np.sin((p - p0) / 2) ** 2 + np.cos(p0) * np.cos(p) * np.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


# ── 附註 ────────────────────────────────────────────────


def fmt(v: float, digits: int = 1) -> str:
    """附註裡的數字：跟前端的 fixed()（Intl.NumberFormat，最短十進位表示、四捨五入）同樣進位，跟畫面上的數字一致"""
    q = Decimal(repr(float(v))).quantize(Decimal(1).scaleb(-digits), ROUND_HALF_UP)
    return f"{q + 0:,}"  # + 0 把 −0 變成 0


def country_notes(codes, how, annual_t, annual_p, warming, normal_t, normal_p, years, warm_years) -> tuple[dict, dict]:
    """每個指標各自的附註：只寫跟那個指標有關的內容"""
    notes: dict[str, dict[str, str]] = {"temperature": {}, "precipitation": {}, "warming": {}}
    notes_en: dict[str, dict[str, str]] = {"temperature": {}, "precipitation": {}, "warming": {}}
    # 用了哪些格子：三個指標都一樣
    for iso3 in codes:
        kind, amount = how[iso3]
        if kind == "nearest":
            zh = f"CRU TS 的 0.5° 網格在國土上沒有陸地格子，改用約 {amount:.0f} km 外最近的陸地格子"
            en = f"The CRU TS 0.5° grid has no land cell on this territory; the nearest land cell, about {amount:.0f} km away, is used"
        elif amount < SMALL_CELLS:
            zh = "國土不到半個 0.5° 格子（約 55 km 見方），數值是涵蓋它的格子的平均，含鄰近地區"
            en = "The territory covers less than half a 0.5° cell (about 55 km across); the value is the average of the cells covering it, including neighbouring areas"
        else:
            continue
        for name in notes:
            notes[name][iso3] = zh
            notes_en[name][iso3] = en
    for name, by_country in special_notes(codes, warming, normal_t, normal_p, warm_years).items():
        for iso3, (zh, en) in by_country.items():
            # 小國的格子說明在前，特別的說明接在後面
            notes[name][iso3] = f"{notes[name][iso3]}；{zh}" if iso3 in notes[name] else zh
            notes_en[name][iso3] = f"{notes_en[name][iso3]}; {en}" if iso3 in notes_en[name] else en
    taiwan_notes(codes, annual_t, annual_p, warming, normal_t, normal_p, years, warm_years, notes, notes_en)
    return notes, notes_en


# World Bank 氣候知識平台（CCKP）的挪威（CRU TS 4.09，只算本土）：1991–2020 年平均氣溫、年雨量，2015–2024 年的暖化
CCKP_NOR = {"t": 2.24, "p": 1123, "w2024": 1.52}
# CRU TS 4.10 在紐芬蘭島、拉布拉多南部（北緯 47.5–52.5°、西經 54–62°）約 40 格，2018 年起每個月都比之前冷 4–6 °C，
# 周圍的格子（拉布拉多北部、新斯科細亞）沒有，不像真的氣候變化，比較像測站資料的問題（雨量沒有這個情形）。
# 原始資料照用，只寫附註。對加拿大的影響（把這些格子換成全國其他格子的距平算過）：2025 年的年均溫低約 0.03 °C、暖化少約 0.02 °C。
CAN_EFFECT = {"t": 0.03, "w": 0.02}


def special_notes(codes, warming, normal_t, normal_p, warm_years) -> dict[str, dict[str, tuple[str, str]]]:
    """國界跟常見的統計口徑不同（挪威含斯瓦巴）、或 CRU 本身有問題（紐芬蘭）的地方，每個指標各寫各的"""
    out: dict[str, dict[str, tuple[str, str]]] = {"temperature": {}, "precipitation": {}, "warming": {}}
    if "NOR" in codes:
        k = codes.index("NOR")
        t, p, w = float(normal_t[k]), float(normal_p[k]), float(warming[warm_years.index(2024), k])
        less = (1 - p / CCKP_NOR["p"]) * 100
        out["temperature"]["NOR"] = (
            f"地圖的挪威含斯瓦巴群島（北緯 77–81°），所以比只算本土冷：1991–2020 年平均 {fmt(t)} °C，"
            f"World Bank 氣候知識平台（CCKP，同樣用 CRU TS、只算本土）是 {fmt(CCKP_NOR['t'])} °C",
            f"Norway on this map includes Svalbard (77–81° N), so it is colder than the mainland alone: {fmt(t)} °C on average "
            f"over 1991–2020, against {fmt(CCKP_NOR['t'])} °C from the World Bank Climate Change Knowledge Portal (CCKP; also "
            f"CRU TS, mainland only)",
        )
        out["precipitation"]["NOR"] = (
            f"地圖的挪威含斯瓦巴群島（北緯 77–81°，很乾），所以比只算本土少：1991–2020 年平均 {fmt(p, 0)} mm，"
            f"World Bank 氣候知識平台（CCKP，同樣用 CRU TS、只算本土）是 {fmt(CCKP_NOR['p'], 0)} mm，少 {fmt(less, 0)}%",
            f"Norway on this map includes Svalbard (77–81° N), which is very dry, so it gets less than the mainland alone: "
            f"{fmt(p, 0)} mm on average over 1991–2020, {fmt(less, 0)}% below the {fmt(CCKP_NOR['p'], 0)} mm from the World Bank "
            f"Climate Change Knowledge Portal (CCKP; also CRU TS, mainland only)",
        )
        out["warming"]["NOR"] = (
            f"地圖的挪威含斯瓦巴群島（北緯 77–81°），那裡暖化得很快，所以比只算本土高：2024 年（2015–2024 年平均）"
            f"{fmt(w)} °C，World Bank 氣候知識平台（CCKP，同樣用 CRU TS、只算本土）是 {fmt(CCKP_NOR['w2024'])} °C",
            f"Norway on this map includes Svalbard (77–81° N), which is warming fast, so the figure is higher than for the "
            f"mainland alone: {fmt(w)} °C in 2024 (2015–2024 average), against {fmt(CCKP_NOR['w2024'])} °C from the World Bank "
            f"Climate Change Knowledge Portal (CCKP; also CRU TS, mainland only)",
        )
    if "CAN" in codes:
        problem_zh = "CRU TS 的紐芬蘭島與拉布拉多南部約 40 個格子 2018 年起突然冷了 4–6 °C，周圍的格子沒有，比較像測站資料的問題"
        problem_en = (
            "In CRU TS, about 40 cells on the island of Newfoundland and in southern Labrador suddenly turn 4–6 °C colder "
            "from 2018 while surrounding cells do not, which looks like a station-data problem"
        )
        out["temperature"]["CAN"] = (
            f"{problem_zh}；全國年均溫因此低了約 {fmt(CAN_EFFECT['t'], 2)} °C",
            f"{problem_en}; it lowers the national mean temperature by about {fmt(CAN_EFFECT['t'], 2)} °C",
        )
        out["warming"]["CAN"] = (
            f"{problem_zh}；0.5° 網格上那一帶會顯示成變冷，全國的暖化因此少了約 {fmt(CAN_EFFECT['w'], 2)} °C",
            f"{problem_en}; that area appears to have cooled on the 0.5° grid, and national warming is about "
            f"{fmt(CAN_EFFECT['w'], 2)} °C lower because of it",
        )
    return out


# 中央氣象署的數字（交叉比對用，寫進台灣的附註）：
# - 年度臺灣氣候分析（https://www.cwa.gov.tw/Data/climate/Watch/twn/twn-monitor_2025-0.pdf）以 11 個平地測站的平均代表臺灣，
#   2025 年均溫 24.2 °C、比 1991–2020 年氣候值高 0.3 °C（所以氣候值 23.9 °C），年雨量 2,500.5 mm、比氣候值多 339.4 mm
#   （氣候值 2,161.1 mm）；2024 年 24.6 °C、2,135.9 mm。
# - 年底記者會（中央社 2025-12-30）：2025 年全台平均氣溫 24.53 °C（統計到 12 月 28 日），比 1901–2000 年平均高 1.22 °C，
#   1897 年以來第 12 高。
# - 國家氣候變遷科學報告（國科會、NCDR，用氣象署 6 個百年測站）：1911–2020 年上升約 1.6 °C。
# - CRU 的雨量測站：cru_ts4.10.1901.2025.pre.stn（每格每月內插用到幾個測站，最多記 8）在台灣的格子 2013 年以前都是 8，
#   2014 年起只剩 3–4（氣溫一直是 8）。
CWA = {
    "plains_t": {2025: 24.2, 2024: 24.6},
    "plains_t_normal": 23.9,
    "plains_p": {2025: 2500.5, 2024: 2135.9},
    "plains_p_normal": 2161.1,
}


def taiwan_notes(codes, annual_t, annual_p, warming, normal_t, normal_p, years, warm_years, notes, notes_en) -> None:
    if "TWN" not in codes:
        return
    k = codes.index("TWN")
    last = years[-1]
    t = float(annual_t[years.index(last), k])
    p = float(annual_p[years.index(last), k])
    t_normal = float(normal_t[k])
    p_normal = float(normal_p[k])
    wv = float(warming[warm_years.index(last), k])
    t_2024 = float(annual_t[years.index(2024), k]) - t_normal
    p_share = p / p_normal * 100
    # 跟氣象署的口徑對齊：2025 年比 1901–2000 年平均高多少、1911–2020 年的線性趨勢
    century = float(annual_t[years.index(1901) : years.index(2000) + 1, k].mean())
    span = np.arange(1911, 2021)
    trend = float(np.polyfit(span, annual_t[years.index(1911) : years.index(2020) + 1, k], 1)[0]) * (span[-1] - span[0])
    cwa_t, cwa_p = CWA["plains_t"][2025], CWA["plains_p"][2025]
    cwa_share = cwa_p / CWA["plains_p_normal"] * 100
    print(
        f"  台灣：CRU {last} 年 {t:.2f} °C（1991–2020 年 {t_normal:.2f}）、{p:.0f} mm（{p_normal:.0f}，{fmt(p_share, 0)}%）、"
        f"暖化 {wv:+.2f} °C、比 1901–2000 年 {t - century:+.2f} °C、1911–2020 趨勢 {trend:+.2f} °C、2024 年距平 {t_2024:+.2f}；"
        f"氣象署 11 個平地站 {cwa_t} °C（{CWA['plains_t_normal']}）、{cwa_p} mm（{CWA['plains_p_normal']}，{fmt(cwa_share, 0)}%）"
    )
    notes["temperature"]["TWN"] = (
        f"CRU TS 的全島面積平均含中央山脈，比平地測站低約 4 °C：{last} 年 {fmt(t)} °C、1991–2020 年平均 {fmt(t_normal)} °C。"
        f"中央氣象署以 11 個平地測站代表臺灣，2025 年均溫 {cwa_t} °C（1991–2020 年氣候值 {CWA['plains_t_normal']} °C）；"
        f"年底記者會公布的全台平均（長期測站）是 24.53 °C。兩者的距平接近：2024 年 CRU 比常年高 {fmt(t_2024)} °C、"
        f"氣象署高 {CWA['plains_t'][2024] - CWA['plains_t_normal']:.1f} °C"
    )
    notes_en["temperature"]["TWN"] = (
        f"The CRU TS island-wide area average includes the Central Mountain Range, so it is about 4 °C lower than lowland "
        f"stations: {fmt(t)} °C in {last}, {fmt(t_normal)} °C on average over 1991–2020. The Central Weather Administration's "
        f"11 lowland stations averaged {cwa_t} °C in 2025 (1991–2020 normal {CWA['plains_t_normal']} °C); its year-end "
        f"all-Taiwan average from long-term stations was 24.53 °C. The anomalies agree more closely: in 2024 CRU was "
        f"{fmt(t_2024)} °C above normal and the administration's stations {CWA['plains_t'][2024] - CWA['plains_t_normal']:.1f} °C"
    )
    notes["precipitation"]["TWN"] = (
        f"CRU TS 的全島面積平均：{last} 年 {fmt(p, 0)} mm（1991–2020 年平均 {fmt(p_normal, 0)} mm 的 {fmt(p_share, 0)}%）。"
        f"中央氣象署 11 個平地測站平均 2025 年 {cwa_p:,} mm（氣候值 {CWA['plains_p_normal']:,.0f} mm 的 {fmt(cwa_share, 0)}%）、"
        f"2024 年 {CWA['plains_p'][2024]:,} mm。CRU 在台灣周圍 450 km 內用到的雨量測站 2014 年起從 8 站以上減到 3–4 站，"
        f"近年的逐年變化跟氣象署差距較大（2025 年一個偏少、一個偏多）"
    )
    notes_en["precipitation"]["TWN"] = (
        f"CRU TS island-wide area average: {fmt(p, 0)} mm in {last} ({fmt(p_share, 0)}% of the 1991–2020 average of {fmt(p_normal, 0)} mm). "
        f"The Central Weather Administration's 11 lowland stations averaged {cwa_p:,} mm in 2025 ({fmt(cwa_share, 0)}% of the "
        f"{CWA['plains_p_normal']:,.0f} mm normal) and {CWA['plains_p'][2024]:,} mm in 2024. Since 2014 CRU has used only 3–4 rain "
        f"gauges within 450 km of Taiwan (8 or more before), so recent year-to-year changes differ more from the administration's "
        f"(in 2025 one is below normal and the other above)"
    )
    notes["warming"]["TWN"] = (
        f"CRU TS：{last - WINDOW + 1}–{last} 年平均比 1951–1980 年高 {fmt(wv)} °C，1911–2020 年的線性趨勢約上升 {fmt(trend)} °C，"
        f"{last} 年比 1901–2000 年平均高 {fmt(t - century)} °C。國家氣候變遷科學報告以中央氣象署 6 個百年測站計算，"
        f"1911–2020 年上升約 1.6 °C；氣象署公布 2025 年全台平均比 1901–2000 年平均高 1.22 °C"
    )
    notes_en["warming"]["TWN"] = (
        f"CRU TS: the {last - WINDOW + 1}–{last} average was {fmt(wv)} °C above 1951–1980, the linear trend over 1911–2020 "
        f"amounts to about {fmt(trend)} °C, and {last} was {fmt(t - century)} °C above the 1901–2000 average. Taiwan's National "
        f"Climate Change Science Report, using the Central Weather Administration's six century-old stations, found a rise of "
        f"about 1.6 °C over 1911–2020; the administration reported 2025 as 1.22 °C above the 1901–2000 average"
    )


# ── 側欄：每國的逐月資料 ─────────────────────────────────────


def write_monthly(codes, years, monthly_t, monthly_p, annual_t, annual_p, normal_t, normal_p) -> None:
    """countries/<ISO3>.json：1991–2020 年的每月平均，加上每年的逐月值（攤平成一串，第 (年 − first) × 12 + 月 個）。

    全年的值（每年、1991–2020 年平均）另外存一份，跟指標檔、附註同一個值：
    側欄不能拿四捨五入後的逐月值重算，否則年雨量常差 1 mm、年均溫差 0.1 °C。
    """
    folder = OUT / "countries"
    if folder.exists():
        for old in folder.glob("*.json"):
            old.unlink()
    i0, i1 = (NORMAL[0] - years[0]) * 12, (NORMAL[1] - years[0] + 1) * 12
    total = 0
    for k, iso3 in enumerate(codes):
        t, p = monthly_t[:, k], monthly_p[:, k]
        month_t = t[i0:i1].reshape(-1, 12).mean(axis=0)
        month_p = p[i0:i1].reshape(-1, 12).mean(axis=0)
        data = {
            "normal": {
                "years": list(NORMAL),
                "tmp": [round(float(v), 1) for v in month_t],
                "pre": [round(float(v), 1) for v in month_p],
                "annual": {"tmp": float(normal_t[k]), "pre": int(normal_p[k])},
            },
            "first": years[0],
            "tmp": [round(float(v), 1) for v in t],
            # 降雨量：10 mm 以上取整數，以下留一位小數（沙漠國家的乾季只有零點幾 mm）
            "pre": [round(float(v)) if v >= 10 else round(float(v), 1) for v in p],
            # 每年的全年值，跟指標檔一樣（年均溫兩位小數、年雨量整數）
            "annual": {"tmp": [float(v) for v in annual_t[:, k]], "pre": [int(v) for v in annual_p[:, k]]},
        }
        write_json(folder / f"{iso3}.json", data, quiet=True)
        total += (folder / f"{iso3}.json").stat().st_size
    print(f"  輸出 {folder.relative_to(OUT_DIR.parent.parent)}：{len(codes)} 個檔，共 {total / 2**20:.1f} MB")


def report(codes, years, annual_t, annual_p, warming, warm_years, wt, wp, ww) -> None:
    """檢查用：最新一年、1991–2020 平均，以及門檻的分布"""
    last = years[-1]
    normal = slice(years.index(NORMAL[0]), years.index(NORMAL[1]) + 1)
    print(f"  世界（陸地）：{last} 年 {wt[-1]:.2f} °C、{wp[-1]:.0f} mm、暖化 {ww[-1]:+.2f} °C；1991–2020 年 {wt[normal].mean():.2f} °C、{wp[normal].mean():.0f} mm")
    for iso3 in ("TWN", "JPN", "IND", "BRA", "DEU", "EGY", "SGP", "RUS", "USA", "AUS", "CAN", "GRL", "MLI", "CHN", "GBR"):
        if iso3 in codes:
            k = codes.index(iso3)
            print(
                f"  {iso3} 1991–2020：{annual_t[normal, k].mean():6.2f} °C {annual_p[normal, k].mean():6.0f} mm｜"
                f"{last}：{annual_t[-1, k]:6.2f} °C {annual_p[-1, k]:6.0f} mm 暖化 {warming[-1, k]:+.2f}"
            )
    for name, arr in (("年均溫", annual_t[-1]), ("年雨量", annual_p[-1]), (f"暖化 {last}", warming[-1]), ("暖化 1950", warming[warm_years.index(1950)])):
        q = np.percentile(arr, [0, 5, 25, 50, 75, 95, 100])
        print(f"  {name} 分位數（0/5/25/50/75/95/100）：" + " / ".join(f"{v:.2f}" for v in q))
