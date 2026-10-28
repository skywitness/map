"""北磁極的漂移與磁偏角主題：NOAA NCEI 的磁極位置（1590–2025 年每年一點）與 World Magnetic Model 2025 的磁偏角。

- 磁極的軌跡（north.json、south.json，common.points_file()）：NCEI 的 NP.xy、SP.xy（經度 0–360°E 換成 −180–180）。
  是模型算的磁傾角 90° 的點（1590–1890 年 gufm1、之後 IGRF，NCEI 的頁面寫「IGRF Pole Locations (1590–2025)」），
  不是觀測；檔案 2020-04-23 更新，2020 年以後是當時模型的預測。
- 磁偏角（WMM2025，2025.0）：0.5° 網格自己算（sources/wmm.py，先用官方測試值驗證），
  - 等偏角線（isogonic.json，common.lines_file()）：contourpy 畫的等值線，±30° 以內每 5°、到 ±60° 每 10°，加 ±90°、±120°；
    WMM 的 blackout zone（水平分量 H < 2,000 nT，磁極附近指南針不可靠）裡不畫；磁偏角 ±180° 的跳躍處附近（|D| > 135°）也不畫。
  - 不可靠區（blackout.json）：H < 2,000 nT 的範圍畫成面（線圖層的 fill）。
  - 各國首都的磁偏角（declination.json，指標）：首都用晝夜與季節主題的 capitals.json（國家小檔案的 Wikidata 首都）。
  - 前端滑到任一點時在瀏覽器算那裡的磁偏角（src/lib/wmm.ts），係數另外輸出成 wmm.json。
- 首都離北磁極（distance.json，指標）：每一年首都到北磁極的大圓距離（km）。
- WMM2025 只適用 2025–2030 年；歷史的磁偏角要用 IGRF-14（授權待確認），第一版不做（使用者 2026-10-28 決定）。

授權：NCEI 的磁極位置與 WMM2025 都是美國政府資料（公有領域，WMM 由 NOAA NCEI 與英國 BGS 共同製作，
頁面寫「may be used freely by the public」），引用寫在主題的資料來源。
"""
from __future__ import annotations

import json
import math

import contourpy
import numpy as np
from shapely.geometry import LineString, Polygon
from shapely.geometry.polygon import orient

from common import OUT_DIR, download, indicator_file, lines_file, now_iso, points_file, write_json
from sources import wmm

OUT = OUT_DIR / "topics" / "magnetic"
POLES = {"north": "https://www.ngdc.noaa.gov/geomag/data/poles/NP.xy", "south": "https://www.ngdc.noaa.gov/geomag/data/poles/SP.xy"}
YEAR = 2025  # 磁偏角的年份（WMM2025 的 2025.0）
BLACKOUT_NT = 2000  # WMM 的 blackout zone：水平分量小於 2,000 nT
STEP = 0.5  # 網格（度）
LEVELS = sorted({*range(-30, 31, 5), *range(-60, 61, 10), -90, 90, -120, 120})
JUMP = 135  # |D| 超過這個值的格子不畫等偏角線（±180° 的跳躍處）
EARTH_KM = 6371.0


def line_code(d: float) -> int:
    """等偏角線的分類（前端 magnetic.ts 的 ISOGONIC_CLASSES）：1 西 20° 以上、2 西 20° 以內、3 零偏角、4 東 20° 以內、5 東 20° 以上"""
    if d == 0:
        return 3
    if d < 0:
        return 1 if d <= -20 else 2
    return 5 if d >= 20 else 4


def read_poles(which: str) -> list[tuple[float, float, int]]:
    path = download(POLES[which], "ncei-poles", f"{which}.xy")
    out = []
    for line in path.read_text(encoding="ascii").splitlines():
        if not line.strip():
            continue
        lon, lat, year = (float(x) for x in line.split())
        lon = lon - 360 if lon > 180 else lon
        out.append((round(lon, 3), round(lat, 3), int(round(year))))
    years = [y for *_, y in out]
    if years != list(range(1590, 2026)):
        raise RuntimeError(f"NCEI 的 {which} 磁極不是 1590–2025 年每年一筆：{years[0]}–{years[-1]}，{len(years)} 筆")
    return out


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_KM * math.asin(math.sqrt(a))


def simplify(coords: np.ndarray, tolerance: float) -> list[tuple[float, float]]:
    line = LineString(coords).simplify(tolerance, preserve_topology=False)
    return [(round(x, 3), round(y, 3)) for x, y in line.coords]


def build() -> None:
    model = wmm.load()
    print(f"  WMM2025：官方測試值 {wmm.check(model)} 筆都對得上")

    # ── 磁極的軌跡 ──
    poles = {w: read_poles(w) for w in POLES}
    for w, rows in poles.items():
        write_json(OUT / f"{w}.json", points_file(
            [{"lon": lon, "lat": lat, "y": y} for lon, lat, y in rows], ["lon", "lat", "y"],
            {"lon": 0.001, "lat": 0.001, "y": 1}, delta=("y",),
        ))
    np_first, np_last = poles["north"][0], poles["north"][-1]
    print(f"  北磁極：{np_first[2]} 年 {np_first[1]}°N {np_first[0]}° → {np_last[2]} 年 {np_last[1]}°N {np_last[0]}°；"
          f"南磁極 {poles['south'][-1][2]} 年 {poles['south'][-1][1]}° {poles['south'][-1][0]}°")

    # ── 0.5° 網格的磁偏角與水平分量 ──
    lats = np.arange(-89.5, 89.5 + STEP / 2, STEP)
    lons = np.arange(-180, 180 + STEP / 2, STEP)
    f = wmm.field(model, lats, lons, 0.0, float(YEAR))
    D, H = f["D"], f["H"]
    print(f"  網格 {lats.size} × {lons.size}；水平分量 < {BLACKOUT_NT} nT 的格子 {int((H < BLACKOUT_NT).sum())} 個")

    # 等偏角線：不可靠區與 ±180° 跳躍處的格子當成沒有值
    masked = np.ma.masked_where((H < BLACKOUT_NT) | (np.abs(D) > JUMP), D)
    gen = contourpy.contour_generator(lons, lats, masked, line_type=contourpy.LineType.Separate)
    lines, types, records = [], [], []
    for level in LEVELS:
        for seg in gen.lines(level):
            if len(seg) < 4:
                continue
            pts = simplify(seg, 0.05)
            if len(pts) < 2 or LineString(pts).length < 2:  # 太短的碎片（不到約 2°）不畫
                continue
            lines.append(pts)
            types.append(line_code(level))
            records.append({"d": level})
    write_json(OUT / "isogonic.json", lines_file(
        lines, 0.01, types, records=records, record_fields=["d"], record_scale={"d": 1},
    ))
    print(f"  等偏角線：{len(lines)} 條，{sum(len(l) for l in lines)} 個頂點")

    # 不可靠區：H < 2,000 nT 的面（contourpy 的填色等值線，碰到網格邊緣時沿邊緣封起來）
    fill = contourpy.contour_generator(lons, lats, H, fill_type=contourpy.FillType.OuterOffset)
    polys, offsets = fill.filled(0, BLACKOUT_NT)
    rings, ring_records = [], []
    for points, offs in zip(polys, offsets):
        parts = [points[offs[i]:offs[i + 1]] for i in range(len(offs) - 1)]
        poly = orient(Polygon(parts[0], parts[1:]), 1.0).simplify(0.05)
        for k, ring in enumerate([poly.exterior, *poly.interiors]):
            rings.append([(round(x, 3), round(y, 3)) for x, y in ring.coords])
            ring_records.append({"f": 1, "hole": 1 if k else 0})
    write_json(OUT / "blackout.json", lines_file(
        rings, 0.01, [1] * len(rings), records=ring_records, record_fields=["f", "hole"],
    ))
    print(f"  不可靠區：{len(rings)} 個環")

    # ── 各國首都 ──
    with open(OUT_DIR / "topics" / "daylight" / "capitals.json", encoding="utf-8") as fh:
        cap = json.load(fh)
    fi = {k: i for i, k in enumerate(cap["fields"])}
    declination: dict[str, float] = {}
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    years = list(range(1590, YEAR + 1))
    distance: dict[str, list[float | None]] = {}
    for iso3, row in sorted(cap["capitals"].items()):
        lat, lon = row[fi["lat"]], row[fi["lon"]]
        p = wmm.field(model, np.array([lat]), np.array([lon]), 0.0, float(YEAR))
        d, h = float(p["D"][0, 0]), float(p["H"][0, 0])
        declination[iso3] = round(d, 1)
        hints[iso3] = f"以首都{row[fi['zh']]}計算"
        hints_en[iso3] = f"At the capital, {row[fi['en']]}"
        if h < 6000:
            notes[iso3] = f"首都的水平分量只有 {h:,.0f} nT，接近磁極，指南針容易受干擾（WMM 的警示區是 6,000 nT 以下）。"
            notes_en[iso3] = f"The horizontal field at the capital is only {h:,.0f} nT, close to the magnetic pole, so compasses are easily disturbed (WMM’s caution zone is below 6,000 nT)."
        distance[iso3] = [round(haversine(lat, lon, plat, plon)) for plon, plat, _ in poles["north"]]
    write_json(OUT / "declination.json", indicator_file(
        "declination", "°", [YEAR], {i: [v] for i, v in declination.items()},
        hints=hints, hintsEn=hints_en, notes=notes, notesEn=notes_en,
    ))
    write_json(OUT / "distance.json", indicator_file("distance", "km", years, distance, hints=hints, hintsEn=hints_en))
    tw = declination.get("TWN")
    if tw is None or not -5.5 < tw < -4.5:
        raise RuntimeError(f"台北的磁偏角 {tw}° 不在 −5.5 到 −4.5 之間，要檢查")
    print(f"  首都 {len(declination)} 個；台北 {tw}°（偏西），離北磁極 {distance['TWN'][0]} km（1590）→ {distance['TWN'][-1]} km（2025）")

    # ── 瀏覽器用的係數（src/lib/wmm.ts） ──
    coef = [[n, m, model.g[n, m], model.h[n, m], model.gdot[n, m], model.hdot[n, m]]
            for n in range(1, model.degree + 1) for m in range(n + 1)]
    write_json(OUT / "wmm.json", {"model": "WMM2025", "epoch": model.epoch, "coef": coef})
    write_json(OUT / "manifest.json", {
        "topic": "magnetic",
        "generatedAt": now_iso(),
        "source": f"NOAA NCEI geomagnetic pole positions ({POLES['north']}, {POLES['south']}); {wmm.CITATION}; Wikidata capitals (CC0)",
        "license": "US Government data / public domain; Wikidata: CC0",
    })
