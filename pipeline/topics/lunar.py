"""月食在哪裡看得到（併進日食與月食主題，DESIGN.md 第 8 節第 99 點）：1900–2100 年每一次月全食與月偏食，
地球上看得到的範圍，以及各國首都看不看得到。

**資料**：NASA 五千年月食目錄（Espenak & Meeus 2009，sources/nasa_eclipses.py 的 lunar_catalog()）：食甚的 TD、ΔT、
類型、偏食（本影，U1–U4）與全食（U2–U3）的持續時間、食甚時月亮在天頂的緯度與經度（整數度）。
**半影月食完全不收**（使用者 2026-10-28 決定：肉眼幾乎看不出來；地圖、側欄、指標都只有月全食與月偏食）。

**看得到的範圍**：月食時月亮進入地球的影子，看得到的地方同時看到同一個階段，所以只要月亮在地平線上就看得到。
- 一次月食之內，月亮天頂點的緯度（赤緯 δ）幾乎不變，經度依地球自轉減掉月亮的赤經運動往西移
  （SUB_RATE，每小時約 14.5°）。各階段的時刻從食甚往前後各推持續時間的一半（目錄沒有各接觸的時刻，月食大致對稱）。
- 某地在時刻 t 看得到 ⇔ 跟天頂點的角距小於 90°：sin φ sin δ + cos φ cos δ cos(λ − λ_c(t)) > 0。
  每條經線上看得到的部分是一段連到極點的緯度：δ > 0 時 φ > atan(−cos(λ − λ_c) / tan δ)（北邊），δ < 0 時相反。
  - 「整個全食都看得到」＝食既（U2）與生光（U3）兩個時刻都看得到：兩個半球的交集，每條經線取兩個界線裡較嚴的。
  - 「看得到一部分」＝初虧（U1）到復圓（U4）之間任一時刻看得到：每分鐘一個半球的聯集，取最寬的界線。
    月食期間地球在轉，這個範圍比半球大（最長的偏食 3 小時半，多出約 50° 的經度）。
- 大氣折射（月亮在地平線時抬高約 0.57°）與月亮的視差（壓低約 0.95°）都不修正，兩者大致抵銷（淨約 −0.4°）；
  加上目錄的天頂點只到整數度，界線的誤差約 1°（100 公里）。
- 每條環每 0.25° 經度一點，Douglas–Peucker 簡化到 SIMPLIFY_KM。

**國家**（以首都計算，跟晝夜與季節一樣：public/data/topics/daylight/capitals.json，要先跑 daylight）：
- 每次月食在首都看到的：3 整個全食（月偏食是整個偏食）都看得到、2 看得到一部分的全食、1 只看得到偏食的階段、0 看不到。
- 指標只算月全食：那一年的月全食（2 整個全食都看得到、1 看得到一部分、0 看不到）、1900 年到那一年看得到月全食的次數
  （至少看得到一部分的全食）、下一次看得到月全食還要幾年。
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone

import numpy as np

from common import OUT_DIR, indicator_file, lines_file, now_iso, write_json
from sources import nasa_eclipses as ne

from topics.eclipses import simplify

OUT = OUT_DIR / "topics" / "eclipses"
CAPITALS = OUT_DIR / "topics" / "daylight" / "capitals.json"
FIRST, LAST = 1900, 2100
YEARS = list(range(FIRST, LAST + 1))

# 天頂點的經度每小時往西移多少度：地球自轉（恆星時）15.0411°/h 減掉月亮的平均赤經運動 0.549°/h
SUB_RATE = 15.0411 - 0.549
STEP_MIN = 1  # 聯集每幾分鐘取一個半球
LON_STEP = 0.25
SIMPLIFY_KM = 10.0
QUANTUM = 0.02

# 月食的類型（lunar.json 的紀錄、lunar-panel.json；src/topics/eclipses.ts 的 LUNAR 要一致）
TOTAL, PARTIAL = 1, 2
# 地圖上的範圍（lunar.json 的 types）：月全食整個全食都看得到、月全食看得到一部分、月偏食看得到
ZONE_TOTAL_WHOLE, ZONE_TOTAL_PART, ZONE_PARTIAL = 1, 2, 3
# 首都看到的（lunar-panel.json）
SEE_WHOLE, SEE_SOME_TOTAL, SEE_PARTIAL_PHASE, SEE_NONE = 3, 2, 1, 0
# 那一年的月全食（lunar-year.json）
YEAR_NONE, YEAR_PART, YEAR_WHOLE = 0, 1, 2


def greatest_utc(row: ne.LunarRow) -> datetime:
    h, m, s = map(int, row.td.split(":"))
    td = datetime(row.year, row.month, row.day, h, m, s, tzinfo=timezone.utc)
    return td - timedelta(seconds=row.delta_t)


def sub_lon(row: ne.LunarRow, minutes: np.ndarray) -> np.ndarray:
    """食甚前後 minutes 分鐘時，月亮天頂點的經度（度，未換回 ±180）"""
    return row.lon - SUB_RATE * minutes / 60


def _dec(row: ne.LunarRow) -> float:
    # 目錄的緯度是整數度，0 時當成很小的北緯（界線是兩條經線，北或南只差在極點那一邊怎麼封閉）
    return row.lat if row.lat != 0 else 0.05


def boundary(dec: float, lon_c: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """每個天頂點經度（第 0 軸）對每條經線（第 1 軸）的界線緯度（度）"""
    d = math.radians(dec)
    dl = np.radians(lons[None, :] - lon_c[:, None])
    return np.degrees(np.arctan(-np.cos(dl) / math.tan(d)))


def visible(dec: float, lon_c, lat, lon) -> np.ndarray:
    """(lat, lon) 的點在天頂點 (dec, lon_c) 時看不看得到月亮；lon_c 可以是陣列（第 0 軸）"""
    d, p = math.radians(dec), np.radians(lat)
    dl = np.radians(np.asarray(lon)[None, ...] - np.atleast_1d(lon_c)[(...,) + (None,) * np.ndim(lon)])
    return np.sin(p) * math.sin(d) + np.cos(p) * math.cos(d) * np.cos(dl) > 0


def zone_ring(dec: float, lon_cs: np.ndarray, union: bool) -> tuple[list[tuple[float, float]], list[tuple[float, float]]]:
    """union：任一時刻看得到（聯集）；否則每個時刻都看得到（交集）。回傳 (封閉的環（經度 −180–180，沿 ±180° 經線與
    極點封閉），界線本身)。環畫成面，界線另外畫成線：環的外框會在 180° 經線上多畫一條直線"""
    lons = np.arange(-180, 180 + LON_STEP / 2, LON_STEP)
    b = boundary(dec, lon_cs, lons)
    north = dec > 0
    # 北邊那一型（δ > 0）看得到的是 φ > 界線：聯集取最小、交集取最大；南邊那一型相反
    lat = (b.min(axis=0) if union else b.max(axis=0)) if north else (b.max(axis=0) if union else b.min(axis=0))
    keep = simplify(lat, lons, SIMPLIFY_KM)
    pts = [(float(x), round(float(y), 3)) for x, y in zip(lons[keep], lat[keep])]
    pole = 90.0 if north else -90.0
    return pts + [(180.0, pole), (-180.0, pole), pts[0]], pts


def build() -> None:
    rows = [r for r in ne.lunar_catalog() if FIRST <= r.year <= LAST and r.kind in "TP"]
    print(f"  月全食 {sum(r.kind == 'T' for r in rows)} 次、月偏食 {sum(r.kind == 'P' for r in rows)} 次（{FIRST}–{LAST}，不收半影月食）")
    with open(CAPITALS, encoding="utf-8") as f:
        caps = json.load(f)
    fields = caps["fields"]
    capitals = {iso: dict(zip(fields, v)) for iso, v in caps["capitals"].items()}
    codes = sorted(capitals)
    clat = np.array([capitals[c]["lat"] for c in codes])
    clon = np.array([capitals[c]["lon"] for c in codes])

    lines, types, records, table = [], [], [], []
    seen: dict[str, list[list[int]]] = {c: [] for c in codes}

    def add(ring_curve, zone: int, rec: dict) -> None:
        # r = 0 是畫成面的環，r = 1 是界線（tooltip 與滑過的標示用）
        for r_, line in enumerate(ring_curve):
            lines.append(line)
            types.append(zone)
            records.append({**rec, "r": r_})
    for e, r in enumerate(rows):
        kind = TOTAL if r.kind == "T" else PARTIAL
        g = greatest_utc(r)
        # 紀錄（tooltip 用）：編號、年、UTC 日期、類型、全食與偏食的分鐘、食甚的 UTC 時分（hhmm）
        rec = {"e": e, "y": r.year, "d": int(g.strftime("%Y%m%d")), "k": kind, "T": r.tot_min or 0, "P": r.par_min or 0,
               "h": g.hour * 100 + g.minute}
        dec = _dec(r)
        half_par = (r.par_min or 0) / 2
        whole = np.arange(-half_par, half_par + STEP_MIN / 2, STEP_MIN)
        lon_all = sub_lon(r, whole)
        add(zone_ring(dec, lon_all, union=True), ZONE_TOTAL_PART if kind == TOTAL else ZONE_PARTIAL, rec)
        if kind == TOTAL:
            half_tot = (r.tot_min or 0) / 2
            lon_tot = sub_lon(r, np.array([-half_tot, half_tot]))
            add(zone_ring(dec, lon_tot, union=False), ZONE_TOTAL_WHOLE, rec)
            in_tot = np.arange(-half_tot, half_tot + STEP_MIN / 2, STEP_MIN)
            vis_tot = visible(dec, sub_lon(r, in_tot), clat, clon)
            ends = vis_tot[[0, -1]].all(axis=0)
            some = vis_tot.any(axis=0)
        else:
            ends = visible(dec, sub_lon(r, np.array([-half_par, half_par])), clat, clon).all(axis=0)
            some = np.zeros(len(codes), bool)
        anyv = visible(dec, lon_all, clat, clon).any(axis=0)
        for i, c in enumerate(codes):
            see = SEE_WHOLE if ends[i] else SEE_SOME_TOTAL if some[i] else SEE_PARTIAL_PHASE if anyv[i] else SEE_NONE
            if see:
                seen[c].append([e, see])
        table.append([
            r.ymd, kind, round(r.tot_min or 0, 1), round(r.par_min or 0, 1), round(r.um_mag, 4),
            # 食甚的 UTC（1970 年起的分鐘），側欄換成首都的當地時間
            int(g.timestamp() // 60), r.saros,
        ])

    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "lunar.json", lines_file(
        lines, QUANTUM, types,
        records=records, record_fields=["e", "y", "r", "d", "k", "T", "P", "h"],
        record_scale={"e": 1, "y": 1, "r": 1, "d": 1, "k": 1, "T": 0.1, "P": 0.1, "h": 1},
    ))

    # 指標：只算月全食
    year_code = {c: [YEAR_NONE] * len(YEARS) for c in codes}
    total_years: dict[str, list[int]] = {c: [] for c in codes}
    for c in codes:
        for e, see in seen[c]:
            ymd, kind = table[e][0], table[e][1]
            if kind != TOTAL or see < SEE_SOME_TOTAL:
                continue
            y = ymd // 10000
            code = YEAR_WHOLE if see == SEE_WHOLE else YEAR_PART
            year_code[c][y - FIRST] = max(year_code[c][y - FIRST], code)
            total_years[c].append(y)

    def cumulative(ys: list[int]) -> list[float]:
        out, n, k = [], 0, sorted(ys)
        for y in YEARS:
            while n < len(k) and k[n] <= y:
                n += 1
            out.append(n)
        return out

    def wait(ys: list[int]) -> list[float | None]:
        ks = sorted(set(ys))
        return [next((k - y for k in ks if k >= y), None) for y in YEARS]

    write_json(OUT / "lunar-year.json", indicator_file("lunar-year", "", YEARS, year_code))
    write_json(OUT / "lunar-count.json", indicator_file("lunar-count", "次", YEARS, {c: cumulative(total_years[c]) for c in codes}))
    write_json(OUT / "next-lunar.json", indicator_file("next-lunar", "年", YEARS, {c: wait(total_years[c]) for c in codes}))
    write_json(OUT / "lunar-panel.json", {
        "eclipses": table,
        "countries": {c: {"zone": capitals[c]["zone"], "seen": seen[c]} for c in codes},
    })
    _manifest()
    _checks(rows, table, seen, total_years)


def _manifest() -> None:
    """日食的 manifest 加上月食的來源與檔案（日食的 pipeline 重跑時會寫回原本的，那邊也寫了）"""
    path = OUT / "manifest.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"topic": "eclipses"}
    data["lunarSource"] = (
        "NASA Five Millennium Catalog of Lunar Eclipses (Espenak & Meeus, NASA TP-2009-214172, 214173), eclipse.gsfc.nasa.gov; "
        + ne.CREDIT_CANON
    )
    files = data.get("files", [])
    for f in ["lunar.json", "lunar-year.json", "lunar-count.json", "next-lunar.json", "lunar-panel.json"]:
        if f not in files:
            files.append(f)
    data["files"] = files
    data["generatedAt"] = now_iso()
    write_json(path, data)


def _checks(rows, table, seen, total_years) -> None:
    by_ymd = {t[0]: e for e, t in enumerate(table)}
    names = {SEE_WHOLE: "整個看得到", SEE_SOME_TOTAL: "看得到一部分的全食", SEE_PARTIAL_PHASE: "只看得到偏食", SEE_NONE: "看不到"}
    for ymd, iso in [(20260303, "TWN"), (20260303, "USA"), (20260303, "GBR"), (20250907, "TWN"), (20250314, "TWN"), (20221108, "TWN")]:
        e = by_ymd.get(ymd)
        if e is None:
            continue
        see = dict((x, s) for x, s in seen[iso]).get(e, SEE_NONE)
        print(f"  {ymd} {iso}：{names[see]}")
    for iso in ("TWN", "USA", "ARG", "NZL"):
        print(f"  {iso} 1900–2100 年看得到月全食（至少一部分）{len(total_years[iso])} 次")
