"""野火主題：各國每年的燒毀面積（平方公里）與燒毀面積占國土比例，加上側欄的土地類型與逐月資料。

- 來源是 GWIS（全球野火資訊系統，歐盟 JRC／Copernicus）依 NASA MODIS MCD64A1 燒毀面積產品（500 m 網格）
  彙整的各國逐月燒毀面積（`sources/gwis.py`），2002–2025 年，分 5 種土地覆蓋。
  - MCD64A1 量的是衛星看得到的「燒過的地表」，不分起火原因：野火之外也含農地燒除、草原與疏林草原的計畫性燒除。
    非洲、澳洲北部的熱帶草原每年乾季大面積燃燒，所以面積最大的是安哥拉、剛果民主共和國、澳洲這類國家。
  - 一個網格約 21.5 公頃（463 m × 463 m），幾公頃的小火、樹冠下的地表火、被雲遮住的火常常偵測不到。
  - 年份是曆年（1–12 月），南半球跨年的火季（澳洲 2019–2020 年的黑色夏季）會分在兩年。
- 土地覆蓋只放在側欄，不做「森林燒毀面積」的地圖：GWIS 的「森林」看起來只有 MODIS 土地覆蓋（IGBP）樹冠覆蓋
  60% 以上的林地，比較稀疏的林地（木本疏林草原，樹冠 30–60%）歸在「疏林草原」。加拿大 2023 年創紀錄的林火
  （13.3 萬平方公里）有 77% 是疏林草原、只有 17% 是森林，俄羅斯也是一半以上，單看森林會嚴重低估北方林的大火。
- 國界是 GWIS 用的 GADM，代碼大多跟地圖相同：科索沃（XKO → XKX）、北賽普勒斯（XNC → 地圖的 _CYN）改代碼；
  裏海（XCA）、英屬基地（XAD）不收。法國只有本土（海外省分開列）、挪威不含斯瓦巴群島（SJM 分開列），
  跟其他主題依 WPP 拆開的方式相同；索馬利亞含索馬利蘭（地圖上分開畫的索馬利蘭是灰色，附註說明）。
- 占國土比例的分母是 GADM 國界的總面積（GWIS 網站 API 的 area_km2，含湖泊等內陸水域），跟分子同一套國界，
  也有台灣（世界銀行的土地面積沒有台灣）。湖泊多的國家（加拿大、芬蘭）比用陸地面積算的低約一成。
  API 沒有北賽普勒斯（XNC 不在 GWIS 的國家清單裡，CSV 卻有），它的分母改用地圖本身國界的球面面積。
- 台灣：衛星偵測到的燒毀面積很小（每年 0–15 平方公里，很多年是 0），附註對照農業部林業及自然保育署的
  森林火災統計（林業保育統計年報表 21「森林災害－按原因分」的火災），說明兩者為什麼不同。
"""
from __future__ import annotations

import math

from build_geo import load_countries
from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import gwis

# GWIS（GADM）的代碼 → 地圖與其他主題用的代碼
CODES = {"XKO": "XKX", "XNC": "_CYN"}
# GWIS 的 API 沒有國土面積的，改用地圖國界的面積
MAP_AREA = {"_CYN"}
EARTH_RADIUS_KM = 6371.0088
# 不是國家的區域：裏海、賽普勒斯島上的英屬基地（地圖沒有形狀）
SKIP = {"XCA", "XAD"}

HA_PER_KM2 = 100
FIRST_YEAR = gwis.YEAR_FROM

# ── 台灣的官方數字（照原始文件抄進來，出新版時要手動更新） ──────────────────
# 農業部林業及自然保育署《林業保育統計年報》表 21「森林災害－按原因分」的「火災」：(發生次數, 被害面積公頃)
# - 2016–2025 年：115 年版（https://www.forest.gov.tw/0010721 ，ODS 檔 file/204194）
# - 2007–2015 年：106 年版（https://www.forest.gov.tw/0002447 ，ODS 檔 file/67659）；2015、2016 年跟 114、115 年版相同
# - 2009 年以前是「臺灣地區」，2010 年起是「臺閩地區」（含金門、連江）。2006 年以前的年報只有 PDF 與舊版 xls，
#   PDF 轉出來的欄位對不齊（106 年版的 2006 年也只有 2 次，跟當年新聞稿的 28 次對不上），所以不收。
# - ODS 的中文欄名是亂碼（檔案本身存成 U+FFFD），用英文欄名「Fire」與欄位順序辨認；被害面積的單位是公頃。
FANCA_FIRES: dict[int, tuple[int, float]] = {
    2007: (35, 73.8910),
    2008: (24, 47.0613),
    2009: (52, 133.2710),
    2010: (33, 39.8466),
    2011: (11, 2.5464),
    2012: (7, 6.8200),
    2013: (12, 8.4014),
    2014: (28, 20.6245),
    2015: (54, 59.7243),
    2016: (19, 21.9762),
    2017: (55, 22.1824),
    2018: (49, 32.5474),
    2019: (45, 23.8625),
    2020: (54, 30.6706),
    2021: (93, 94.6143),
    2022: (21, 30.4420),
    2023: (51, 103.7867),
    2024: (36, 26.9456),
    2025: (19, 0.9629),
}
FANCA_SOURCE = (
    "農業部林業及自然保育署《林業保育統計年報》森林災害（火災）",
    "Forestry and Nature Conservation Agency (Taiwan), annual forestry statistics: forest damage by fire",
)

TAIWAN_NOTE = (
    "衛星偵測到的台灣燒毀面積很小：{first}–{last} 年有 {zero} 年是 0，最多是 {max_year} 年的 {max_ha:,.0f} 公頃"
    "（{max_km2:.1f} 平方公里），平均每年 {mean_ha:,.0f} 公頃，其中 {crop:.0f}% 是農地、{forest:.0f}% 是森林。"
    "對照農業部林業及自然保育署的森林火災統計"
    "（{f0}–{f1} 年），每年 {n_min}–{n_max} 次、被害面積 {a_min:,.2f}–{a_max:,.2f} 公頃（平均每年 {n_mean:.0f} 次、"
    "{a_mean:,.0f} 公頃；{f1} 年 {n_last} 次、{a_last:,.2f} 公頃）。兩者量的不是同一件事：MCD64A1 的網格約 21.5 公頃，"
    "林保署統計的森林火災平均每次只有約 {per_fire:.1f} 公頃，衛星多半看不到；反過來，衛星算的是所有燒過的地表，"
    "台灣多半是林地以外的農地燒除，林保署只計林地上的森林火災，所以有些年份衛星的面積反而大很多"
    "（例如 {big_year} 年衛星 {big_sat:,.0f} 公頃、林保署 {big_off:,.0f} 公頃），也有很多年衛星是 0、林保署有幾十公頃",
    "Satellite-detected burned area in Taiwan is tiny: {zero} of the years {first}–{last} show zero, the largest "
    "is {max_ha:,.0f} ha ({max_km2:.1f} km²) in {max_year}, and the average is {mean_ha:,.0f} ha a year, "
    "{crop:.0f}% of it cropland and {forest:.0f}% forest. The "
    "Forestry and Nature Conservation Agency recorded {n_min}–{n_max} forest fires a year in {f0}–{f1}, burning "
    "{a_min:,.2f}–{a_max:,.2f} ha (on average {n_mean:.0f} fires and {a_mean:,.0f} ha a year; {n_last} fires and "
    "{a_last:,.2f} ha in {f1}). They measure different things: an MCD64A1 grid cell is about 21.5 ha, while the "
    "agency's forest fires average only about {per_fire:.1f} ha each, mostly too small for the satellite. On the other "
    "hand, the satellite counts all burned ground, in Taiwan mostly crop burning outside forest land, while the agency "
    "counts only fires on forest land, so in some years the satellite figure is far larger (in {big_year}, "
    "{big_sat:,.0f} ha from the satellite against {big_off:,.0f} ha from the agency), and in many others the "
    "satellite shows zero while the agency records tens of hectares",
)
BOUNDARY_NOTES = {
    "CYP": (
        "GWIS 依 GADM 的國界，賽普勒斯只有政府控制的地區，北賽普勒斯分開列",
        "GWIS uses GADM boundaries, in which Cyprus covers the government-controlled area only; Northern Cyprus is listed separately",
    ),
    "_CYN": (
        "GWIS 有北賽普勒斯的燒毀面積，但沒有它的國土面積，占國土比例改用地圖本身國界的面積（{area:,.0f} 平方公里）計算",
        "GWIS gives burned area for Northern Cyprus but not its area, so the share uses the area of the map's own "
        "boundary ({area:,.0f} km²)",
    ),
    "SOM": (
        "GWIS 依 GADM 的國界，索馬利亞含索馬利蘭（地圖上分開畫的索馬利蘭是灰色）",
        "GWIS uses GADM boundaries, in which Somalia includes Somaliland (shown separately and grey on the map)",
    ),
    "FRA": (
        "只有法國本土；法屬圭亞那、瓜地洛普、馬丁尼克、留尼旺、馬約特分開列在排名表",
        "Metropolitan France only; French Guiana, Guadeloupe, Martinique, Réunion and Mayotte are listed separately",
    ),
    "NOR": (
        "不含斯瓦巴群島與揚馬延島（分開列在排名表）",
        "Excludes Svalbard and Jan Mayen (listed separately)",
    ),
}


def ha_series(by_year: dict[int, float], years: list[int], scale: float = 1.0, digits: int = 2) -> list[float | None]:
    return [None if y not in by_year else round(by_year[y] * scale, digits) for y in years]


def map_area_km2(iso3: str) -> float:
    """地圖國界（Natural Earth 1:50m）的球面面積，扣掉內環"""
    def ring_area(ring: list[tuple[float, float]]) -> float:
        total = 0.0
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
            total += math.radians(x2 - x1) * (2 + math.sin(math.radians(y1)) + math.sin(math.radians(y2)))
        return abs(total) * EARTH_RADIUS_KM**2 / 2

    polygons = load_countries()[iso3]["coordinates"]
    return sum(ring_area(p[0]) - sum(ring_area(h) for h in p[1:]) for p in polygons)


def taiwan_note(yearly_ha: dict[int, float], landcover: dict[int, list[float]], years: list[int]) -> tuple[str, str]:
    sat = {y: yearly_ha.get(y, 0.0) for y in years}
    lc_total = [sum(landcover.get(y, [0.0] * len(gwis.LANDCOVER))[i] for y in years) for i in range(len(gwis.LANDCOVER))]
    max_year = max(sat, key=lambda y: sat[y])
    fires = FANCA_FIRES
    f_years = sorted(fires)
    counts = [fires[y][0] for y in f_years]
    areas = [fires[y][1] for y in f_years]
    # 衛星比林保署大最多的一年（說明衛星也算林地以外的火）
    big_year = max((y for y in f_years if y in sat), key=lambda y: sat[y] - fires[y][1])
    last = years[-1]
    fields = dict(
        first=years[0], last=last, zero=sum(1 for v in sat.values() if v == 0),
        max_year=max_year, max_ha=sat[max_year], max_km2=sat[max_year] / HA_PER_KM2,
        mean_ha=sum(sat.values()) / len(sat),
        crop=lc_total[gwis.LANDCOVER.index("croplands")] / sum(lc_total) * 100,
        forest=lc_total[gwis.LANDCOVER.index("forest")] / sum(lc_total) * 100,
        f0=f_years[0], f1=f_years[-1], n_min=min(counts), n_max=max(counts), a_min=min(areas), a_max=max(areas),
        n_mean=sum(counts) / len(counts), a_mean=sum(areas) / len(areas),
        per_fire=sum(areas) / sum(counts),
        n_last=fires[f_years[-1]][0], a_last=fires[f_years[-1]][1],
        big_year=big_year, big_sat=sat[big_year], big_off=fires[big_year][1],
    )
    return TAIWAN_NOTE[0].format(**fields), TAIWAN_NOTE[1].format(**fields)


def build() -> None:
    out = OUT_DIR / "topics" / "wildfires"
    data = gwis.burned_area()

    years = list(range(FIRST_YEAR, gwis.YEAR_TO + 1))
    # 只收 12 個月都有的年份（GWIS 只發布完整的年份；萬一檔案裡有今年的部分月份也不收）
    partial = [y for y in years if len(data.months.get(y, ())) < 12]
    if partial:
        print(f"  不完整的年份（不收）：{partial}")
        years = [y for y in years if y not in partial]
    extra = sorted(set(data.months) - set(years) - set(partial))
    if extra:
        print(f"  檔案裡有 YEAR_TO 以外的年份 {extra}：GWIS 可能發布新的一年了，改 sources/gwis.py 的 YEAR_TO")

    gwis_names = {c["iso3"]: c["name"] for c in gwis.countries()}
    missing = sorted(set(gwis_names) - set(data.yearly) - SKIP)
    print(f"  GWIS 檔案沒有的國家/地區（沒有 GADM 第 1 級行政區，無資料）：{len(missing)} 個 {' '.join(missing)}")

    total: dict[str, dict[int, float]] = {}  # 公頃
    areas: dict[str, gwis.CountryArea] = {}
    for code, by_year in sorted(data.yearly.items()):
        if code in SKIP:
            continue
        iso3 = CODES.get(code, code)
        total[iso3] = {y: sum(lc) for y, lc in by_year.items() if y in years}
        area = gwis.country_area(code) if iso3 not in MAP_AREA else gwis.CountryArea(map_area_km2(iso3), [])
        if area:
            areas[iso3] = area
        else:
            print(f"  {code} 沒有國土面積，占國土比例從缺")

    share = {
        iso3: {y: v / HA_PER_KM2 / areas[iso3].km2 * 100 for y, v in s.items()}
        for iso3, s in total.items() if iso3 in areas
    }
    world_total = {y: sum(s.get(y, 0) for s in total.values()) for y in years}
    world_area = sum(a.km2 for a in areas.values())
    world_share = {y: world_total[y] / HA_PER_KM2 / world_area * 100 for y in years}

    tw_zh, tw_en = taiwan_note(total["TWN"], data.yearly["TWN"], years)
    fields = {"area": areas["_CYN"].km2}
    notes = {"TWN": tw_zh, **{k: v[0].format(**fields) for k, v in BOUNDARY_NOTES.items()}}
    notes_en = {"TWN": tw_en, **{k: v[1].format(**fields) for k, v in BOUNDARY_NOTES.items()}}

    def write(name: str, unit: str, series: dict[str, dict[int, float]], scale: float, digits: int,
              world: dict[int, float]) -> None:
        values = {iso3: ha_series(s, years, scale, digits) for iso3, s in sorted(series.items())}
        write_json(out / f"{name}.json", indicator_file(
            name, unit, years, values,
            aggregates={"WLD": ha_series(world, years, scale, digits)},
            notes=notes, notesEn=notes_en,
        ))

    write("burned-area", "平方公里", total, 1 / HA_PER_KM2, 2, world_total)
    write("burned-share", "%", share, 1, 6, world_share)

    # ── 側欄：每國一個檔，5 種土地覆蓋的逐年面積與逐月面積（公頃，整數） ──
    for code, by_year in sorted(data.yearly.items()):
        if code in SKIP:
            continue
        iso3 = CODES.get(code, code)
        months = data.monthly[code]
        profile: dict[str, object] = {
            "first": years[0],
            "landcover": {
                lc: [round(by_year.get(y, [0.0] * len(gwis.LANDCOVER))[i]) for y in years]
                for i, lc in enumerate(gwis.LANDCOVER)
            },
            "monthly": [round(v) for y in years for v in months.get(y, [0.0] * 12)],
        }
        if iso3 == "TWN":
            f_years = sorted(FANCA_FIRES)
            profile["official"] = {
                "years": f_years,
                "fires": [FANCA_FIRES[y][0] for y in f_years],
                "ha": [FANCA_FIRES[y][1] for y in f_years],
                # 衛星的燒毀面積（公頃）：用沒有四捨五入的合計，跟附註的數字一致（各類加總四捨五入後的值常差 1）
                "satellite": [round(total[iso3].get(y, 0)) if y in years else None for y in f_years],
            }
        write_json(out / "countries" / f"{iso3}.json", profile, quiet=True)
    print(f"  輸出 countries/*.json（{len(data.yearly) - len(SKIP & set(data.yearly))} 個國家）")

    write_json(out / "manifest.json", {
        "topic": "wildfires",
        "generatedAt": now_iso(),
        "source": "GWIS (JRC, Copernicus), MODIS MCD64A1 burned area; 農業部林業及自然保育署",
    })

    report(total, share, areas, years, world_total, world_share)


def report(total, share, areas, years, world_total, world_share) -> None:
    """檢查用：世界值、面積最大的國家、台灣與林保署對照"""
    last = years[-1]
    print(f"  世界燒毀面積：{years[0]} 年 {world_total[years[0]] / 100:,.0f} km²、{last} 年 {world_total[last] / 100:,.0f} km²"
          f"（占國土 {world_share[last]:.2f}%）")
    ranked = sorted(((s.get(last, 0), iso3) for iso3, s in total.items()), reverse=True)[:8]
    print(f"  {last} 年燒毀面積最大：" + "、".join(f"{iso3} {v / 100:,.0f}" for v, iso3 in ranked))
    ranked = sorted(((s.get(last, 0), iso3) for iso3, s in share.items()), reverse=True)[:8]
    print(f"  {last} 年占國土最高：" + "、".join(f"{iso3} {v:.1f}%" for v, iso3 in ranked))
    for iso3 in ("TWN", "JPN", "KOR", "CHN", "CAN", "AUS", "USA", "CYP", "_CYN", "SOM", "FRA", "NOR"):
        a = areas.get(iso3)
        print(f"  {iso3} 國土 {a.km2 if a else 0:,.0f} km²｜{last} 年 {total[iso3].get(last, 0) / 100:,.1f} km²、"
              f"{share.get(iso3, {}).get(last, 0):.4f}%")
    print("  台灣：年份｜衛星（公頃）｜林保署森林火災（次、公頃）")
    for y in years:
        off = FANCA_FIRES.get(y)
        print(f"    {y}｜{total['TWN'].get(y, 0):7,.1f}｜" + (f"{off[0]:3d} 次 {off[1]:8,.2f}" if off else "—"))
