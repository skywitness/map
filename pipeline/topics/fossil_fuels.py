"""石油、天然氣與煤主題：各國三種化石燃料的產量、消費量、人均消費量、自給率、蘊藏量與貿易流向，
地圖上疊 Global Energy Monitor 的天然氣管線、LNG 接收站、油管、油氣田與煤礦。

資料：
- EIA International Energy Statistics（sources/eia.py，公有領域）：產量、消費量、進出口、煤的蘊藏量、初級能源消費。
  石油的產量是原油（含凝結油，57-1），消費量是石油及其他液體（5-2），自給率的分子是原油＋天然氣液＋其他液體（55-1，
  不用 53-1：53-1 多了煉油增量，台灣 2024 年 25.4 千桶/日裡 24.6 是煉油增量）。
- CIA World Factbook（sources/factbook.py，公有領域）：原油、天然氣的探明蘊藏量，只有 2021 年估計。
- CEPII BACI HS92 版（sources/baci.py，Etalab 2.0）：原油 270900、LNG 271111、管道天然氣 271121、煤 2701 的雙邊貿易，
  用數量（公噸），先依各六位碼每年的單價中位數清理錯值（clean_quantities()）。
- Global Energy Monitor（CC BY 4.0，見 DESIGN.md 第 8 節第 12 點）：GGIT（天然氣管線與 LNG 接收站）、GOIT（油管）、
  GOGET（油氣田）、GCMT（煤礦），都是公開地圖用的 GeoJSON（直接下載、不必填表）。
- UN WPP 2024：人口（人均消費量）。
- 經濟部能源署（sources/moeaea_fuels.py，政府資料開放授權條款）：台灣的能源供給與原油、LNG、煤炭的進口來源，只做對照。

人均能源消費（build_energy，2026-10-29，使用者決定放這個主題、單位用 GJ）：EIA 的初級能源消費總量（44-2，千兆英熱單位）
÷ WPP 年中人口，跟其他人均指標同一個人口；EIA 自己的人均（47-33）用 EIA 的人口，2024 年多數國家相差 5% 以內
（賽普勒斯差 28%：WPP 含北部），冰島、千里達 2024 年的人均是 NA、總量有值。

已經不存在的國家：蘇聯、南斯拉夫、捷克斯洛伐克、塞爾維亞與蒙特內哥羅畫成主題自訂的地點（`_SUN` 等，前端
fossil-fuels.ts 的 PLACES），人口是今天的繼承國加總；東西德加總成德國（DEU 從 1991 年起）。
"""
from __future__ import annotations

import gzip
import json
import math
import re
import statistics
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, lines_file, now_iso, points_file, to_series, write_json, year_span
from sources import baci, eia, factbook, moeaea_fuels, wpp
from geoindex import countries_at
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "fossil-fuels"
TAIWAN = "TWN"
FUELS = ("oil", "gas", "coal")

# ── EIA ─────────────────────────────────────────
# (產量, 消費量, 自給率的分子, 換算成地圖單位的倍數)：石油千桶/日、天然氣十億立方公尺、煤百萬公噸（EIA 是千公噸）
EIA_SERIES = {
    "oil": ("57-1-TBPD", "5-2-TBPD", "55-1-TBPD", 1.0),
    "gas": ("26-1-BCM", "26-2-BCM", "26-1-BCM", 1.0),
    "coal": ("7-1-MT", "7-2-MT", "7-1-MT", 0.001),
}
TRADE_SERIES = {"gas": ("26-3-BCM", "26-4-BCM", 1.0), "coal": ("7-3-MT", "7-4-MT", 0.001)}
COAL_RESERVES = "7-6-MST"  # 百萬短噸
SHORT_TON = 0.90718474
MIX_SERIES = {"coal": "4411-2-QBTU", "gas": "4413-2-QBTU", "oil": "4415-2-QBTU", "nuclear": "4417-2-QBTU", "renewables": "4418-2-QBTU"}
MIX_TOTAL = "44-2-QBTU"
QBTU_EJ = 1.055056  # 1 千兆（10^15）英熱單位 = 1.055056 艾焦耳（10^18 J）
# 已經不存在的國家 → 主題自訂的地點；人口是今天的繼承國加總（WPP 依現在的國界回推）
PLACES = {
    "SUN": ("_SUN", ["RUS", "UKR", "BLR", "KAZ", "UZB", "GEO", "ARM", "AZE", "LTU", "LVA", "EST", "MDA", "KGZ", "TJK", "TKM"]),
    "YUG": ("_YUG", ["SRB", "MNE", "XKX", "HRV", "SVN", "BIH", "MKD"]),
    "CSK": ("_CSK", ["CZE", "SVK"]),
    "SCG": ("_SCG", ["SRB", "MNE", "XKX"]),
}
GERMANY_PARTS = ("DEUW", "DDR")  # 1990 年以前的西德、東德，加總成 DEU（EIA 的 DEU 從 1991 年起）

# ── BACI ────────────────────────────────────────
# 流向的商品（子項目）→ HS92 六位碼；'gas' 是 LNG（天然氣這個燃料的流向預設畫 LNG）
FLOW_CODES = {"oil": ("270900",), "gas": ("271111",), "pipeline": ("271121",), "coal": ("270111", "270112", "270119", "270120")}
FLOW_FIRST_YEAR = {"pipeline": 2000}  # 管道天然氣 1995–1999 年有 20–39% 的金額沒有數量，從 2000 年開始
PRICE_FACTOR = 3.0  # 單價比當年該六位碼的中位數高 3 倍以上、或低到三分之一以下，數量改用金額 ÷ 中位數單價估算
ESTIMATED_SHARE = 0.1  # 一組夥伴的數量有 10% 以上是估算的，流向檔標「估算」
TOP_N = 15
BACI_EXTRA = {"ZA1": "ZAF"}  # 1999 年以前的南部非洲關稅同盟（南非、波札那、賴索托、納米比亞、史瓦帝尼）算在南非

# ── GEM ─────────────────────────────────────────
GEM_FILES = {
    "ggit": ("https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/Current_maps/ggit-lng/ggit-lng_map_2026-10.geojson",
             "ggit-lng_map_2026-10.geojson"),
    "goit": ("https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/interim_maps/goit_map_2026-06.1.geojson",
             "goit_map_2026-06.1.geojson"),
    "goget": ("https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/interim_maps/goget_map_2026-03.geojson",
              "goget_map_2026-03.geojson"),
    "gcmt": ("https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/Current_maps/gcmt-smp/gcmt-smp_map_2026-08.geojson",
             "gcmt-smp_map_2026-08.geojson"),
}
SIMPLIFY = 0.01  # 度（約 1 公里），跟鐵路一樣
JOIN_QUANTUM = 0.001  # 管線的段端點量化到 0.001° 再比對是否相接
# 管線、接收站的狀態代碼（前端 fossil-fuels.ts 的 STATUS）
LINE_STATUS = {"operating": 1, "construction": 2, "proposed": 3}
# 油氣田：生產中、開發中與已發現；封存、除役、廢棄、找不到、取消、探勘、地下儲氣不畫
FIELD_STATUS = {"operating": 1, "in-development": 2, "discovered": 3}
# 煤礦：三個圖層（運轉中、規劃中、已關閉或封存）
MINE_STATUS = {"operating": 1, "proposed": 2, "shelved": 2, "closed": 3, "mothballed": 4}
# GEM 的國名 → 地圖代碼（from_name 對不到的）
GEM_COUNTRY: dict[str, str | None] = {
    "Türkiye": "TUR", "Turkey": "TUR", "Kosovo": "XKX", "DR Congo": "COD", "Republic of the Congo": "COG",
    "Côte d'Ivoire": "CIV", "Cote d'Ivoire": "CIV", "Taiwan": "TWN", "Russia": "RUS", "Iran": "IRN", "Syria": "SYR",
    "Venezuela": "VEN", "Bolivia": "BOL", "Tanzania": "TZA", "Vietnam": "VNM", "Laos": "LAO", "South Korea": "KOR",
    "North Korea": "PRK", "Moldova": "MDA", "Brunei": "BRN", "Palestine": "PSE", "Czechia": "CZE",
    "Czech Republic": "CZE", "Eswatini": "SWZ", "Macedonia": "MKD", "North Macedonia": "MKD",
    "Northern Cyprus": "_CYN", "Western Sahara": "ESH", "Micronesia": "FSM", "The Gambia": "GMB", "Gambia": "GMB",
    "Bahamas": "BHS", "The Bahamas": "BHS", "Cape Verde": "CPV", "East Timor": "TLS", "Timor-Leste": "TLS",
    "Falkland Islands": "FLK", "Sint Maarten": "SXM", "Curaçao": "CUW", "Netherlands Antilles": "CUW",
    "Kazkahstan": "KAZ",  # GEM 的拼字錯誤
    # 「Timor-Leste」在 all-countries 裡被寫成「Timor, Leste」；帝汶海的聯合石油開發區（澳洲與東帝汶共管）不算任何一國
    "Timor": "TLS", "Leste": None, "Joint Petroleum Development Area": None,
}


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pops = population()
    eia_data = eia_files(pops)
    build_energy(pops)
    trade = trade_files()
    gem = gem_files()
    taiwan = taiwan_comparison(eia_data, trade)
    details(eia_data, trade, gem, taiwan)
    write_json(
        OUT / "manifest.json",
        {
            "topic": "fossil-fuels",
            "generatedAt": now_iso(),
            "sources": [
                f"U.S. Energy Information Administration, International Energy Statistics ({eia.RELEASE_TEXT}), {eia.URL} (public domain).",
                f"CIA World Factbook, 2021 estimates, via {factbook.REPO} at {factbook.COMMIT[:7]} (public domain).",
                "CEPII BACI, HS92 version V202601, HS 270900, 271111, 271121, 2701 (Etalab 2.0).",
                "Global Energy Monitor: Global Gas Infrastructure Tracker (pipelines November 2025, LNG terminals October 2026), "
                "Global Oil Infrastructure Tracker (June 2026), Global Oil and Gas Extraction Tracker (March 2026), "
                "Global Coal Mine Tracker (August 2026) (CC BY 4.0).",
                "UN World Population Prospects 2024 (CC BY 3.0 IGO).",
                "經濟部能源署 能源供給年資料、原油／液化天然氣／煤炭進口來源年資料（政府資料開放授權條款第 1 版）。",
            ],
            "license": "Public domain (EIA, CIA World Factbook); Etalab 2.0 (BACI); CC BY 4.0 (GEM); CC BY 3.0 IGO (UN WPP)",
        },
    )


def build_energy(pops: dict[str, dict[int, float]] | None = None) -> None:
    """初級能源消費總量（艾焦耳）與人均（GJ/人），1980 年起。"""
    pops = pops or population()
    raw = eia.annual([MIX_TOTAL])[MIX_TOTAL]
    total, _ = map_regions(raw, known_countries())
    total = {c: {y: v * QBTU_EJ for y, v in s.items() if y >= 1980} for c, s in total.items()}
    world = {y: v * QBTU_EJ for y, v in raw["WORL"].items() if y >= 1980}
    years = year_span(total)
    write_json(OUT / "energy-consumption.json", indicator_file(
        "energy-consumption", "艾焦耳", years,
        {c: [sig(v) for v in to_series(s, years)] for c, s in sorted(total.items()) if any(s.get(y) for y in years)},
        aggregates={"WLD": [sig(v) for v in to_series(world, years)]},
    ))
    per: dict[str, list] = {}
    for c, s in total.items():
        p = pops.get(c, {})
        row = [sig(s[y] * 1e9 / p[y], 3) if y in s and p.get(y) else None for y in years]
        if any(v for v in row):
            per[c] = row
    world_pop = pops["WLD"]
    write_json(OUT / "energy-per-capita.json", indicator_file(
        "energy-per-capita", "GJ/人", years, dict(sorted(per.items())),
        aggregates={"WLD": [sig(world[y] * 1e9 / world_pop[y], 3) if y in world and world_pop.get(y) else None for y in years]},
    ))
    last = years[-1]
    top = sorted(((r[-1], c) for c, r in per.items() if r[-1] is not None), reverse=True)
    print(f"  初級能源消費 {years[0]}–{last}，{len(per)} 國；世界 {world[last]:.0f} EJ、每人 {world[last] * 1e9 / world_pop[last]:.1f} GJ；"
          f"人均最高 {top[:6]}；台灣 {per.get(TAIWAN, [None])[-1]} GJ")


# ── 人口與國家 ───────────────────────────────────


def known_countries() -> set[str]:
    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        return set(json.load(f))


def population() -> dict[str, dict[int, float]]:
    """{iso3 或地點: {年: 人}}，1980–2024 年；蘇聯等地點是繼承國加總"""
    pop = wpp.demographic(["TPopulation1July"], last_year=2024)["TPopulation1July"]
    out = {iso: {y: v * 1000 for y, v in s.items() if y >= 1980} for iso, s in pop.items()}
    for _, (place, parts) in PLACES.items():
        out[place] = {y: sum(out[p][y] for p in parts if p in out and y in out[p]) for y in range(1980, 2025)}
    return out


def map_regions(series: dict[str, dict[int, float]], known: set[str]) -> dict[str, dict[int, float]]:
    """EIA 的地區代碼 → 地圖代碼：國家照用（不在地圖上的丟掉並印出），蘇聯等換成地點，東西德加總成德國。"""
    out: dict[str, dict[int, float]] = {}
    dropped = []
    for code, s in series.items():
        if code in known:
            out[code] = dict(s)
        elif code in PLACES:
            out[PLACES[code][0]] = dict(s)
        elif code in GERMANY_PARTS:
            continue
        elif any(v for v in s.values()):
            dropped.append(code)
    germany = out.setdefault("DEU", {})
    for part in GERMANY_PARTS:
        for y, v in series.get(part, {}).items():
            if y < 1991:
                germany[y] = germany.get(y, 0.0) + v
    return out, dropped  # type: ignore[return-value]


# ── EIA 的指標 ───────────────────────────────────


def sig(v: float | None, digits: int = 4) -> float | None:
    """四捨五入到 digits 位有效數字（檔案小一點，畫面上最多顯示 4 位）"""
    if v is None:
        return None
    if v == 0:
        return 0
    return round(v, max(0, digits - 1 - math.floor(math.log10(abs(v)))))


def eia_files(pops: dict[str, dict[int, float]]) -> dict:
    known = known_countries()
    wanted = sorted({s for t in EIA_SERIES.values() for s in t[:3]} | {s for t in TRADE_SERIES.values() for s in t[:2]}
                    | {COAL_RESERVES, MIX_TOTAL, *MIX_SERIES.values()})
    raw = eia.annual(wanted)
    data: dict[str, dict[str, dict[int, float]]] = {}
    world: dict[str, dict[int, float]] = {}
    all_dropped: set[str] = set()
    for key, series in raw.items():
        data[key], dropped = map_regions(series, known)  # type: ignore[misc]
        all_dropped |= set(dropped)
        world[key] = series.get("WORL", {})
    print(f"  EIA：沒有畫在地圖上的地區代碼（區域合計與小屬地）：{' '.join(sorted(all_dropped))}")

    out: dict[str, dict] = {"production": {}, "consumption": {}, "supply": {}, "years": {}, "trade": {}, "mix": {}}
    for fuel, (prod_key, cons_key, supply_key, factor) in EIA_SERIES.items():
        prod = {c: {y: v * factor for y, v in s.items() if y >= 1980} for c, s in data[prod_key].items()}
        cons = {c: {y: v * factor for y, v in s.items() if y >= 1980} for c, s in data[cons_key].items()}
        supply = {c: {y: v * factor for y, v in s.items() if y >= 1980} for c, s in data[supply_key].items()}
        out["production"][fuel], out["consumption"][fuel], out["supply"][fuel] = prod, cons, supply
        prod_years = year_span(prod)
        cons_years = year_span(cons)
        notes_zh, notes_en = eia_notes(fuel, prod, cons)
        write_json(OUT / "production" / f"{fuel}.json", indicator_file(
            f"production/{fuel}", UNIT_ZH[fuel], prod_years,
            {c: [sig(v) for v in to_series(s, prod_years)] for c, s in sorted(prod.items()) if any(s.get(y) for y in prod_years)},
            aggregates={"WLD": [sig(v * factor) if v is not None else None for v in to_series(world[prod_key], prod_years)]},
            notes=notes_zh, notesEn=notes_en,
        ))
        write_json(OUT / "consumption" / f"{fuel}.json", indicator_file(
            f"consumption/{fuel}", UNIT_ZH[fuel], cons_years,
            {c: [sig(v) for v in to_series(s, cons_years)] for c, s in sorted(cons.items()) if any(s.get(y) for y in cons_years)},
            aggregates={"WLD": [sig(v * factor) if v is not None else None for v in to_series(world[cons_key], cons_years)]},
            notes=notes_zh, notesEn=notes_en,
        ))
        # 人均消費量：石油桶/人/年、天然氣立方公尺/人、煤公斤/人
        per_factor = {"oil": 1000 * 365, "gas": 1e9, "coal": 1e9}[fuel]  # 煤：百萬公噸 → 公斤
        per_years = [y for y in cons_years if y <= 2024]
        per = {}
        for c, s in cons.items():
            p = pops.get(c, {})
            row = [sig(s[y] * per_factor / p[y], 3) if y in s and p.get(y) else None for y in per_years]
            if any(v for v in row):
                per[c] = row
        world_pop = pops["WLD"]
        write_json(OUT / "per-capita" / f"{fuel}.json", indicator_file(
            f"per-capita/{fuel}", PER_UNIT_ZH[fuel], per_years, dict(sorted(per.items())),
            aggregates={"WLD": [sig(world[cons_key][y] * factor * per_factor / world_pop[y], 3)
                                if y in world[cons_key] and world_pop.get(y) else None for y in per_years]},
            notes=notes_zh, notesEn=notes_en,
        ))
        # 自給率：產量 ÷ 消費量（%）；消費量是 0 的不算
        ss_years = [y for y in cons_years if y in set(prod_years)]
        ss = {}
        for c in set(supply) & set(cons):
            row = [sig(supply[c][y] / cons[c][y] * 100, 3) if cons[c].get(y) and y in supply[c] else None for y in ss_years]
            if any(v is not None for v in row):
                ss[c] = row
        write_json(OUT / "self-sufficiency" / f"{fuel}.json", indicator_file(
            f"self-sufficiency/{fuel}", "%", ss_years, dict(sorted(ss.items())), notes=notes_zh, notesEn=notes_en,
        ))
        out["years"][fuel] = {"production": prod_years, "consumption": cons_years}
        print(f"  {fuel}：產量 {prod_years[0]}–{prod_years[-1]}（{len(prod)} 國），消費量 {cons_years[0]}–{cons_years[-1]}；"
              f"台灣 {cons_years[-1]} 年消費 {cons.get(TAIWAN, {}).get(cons_years[-1])}、自給率 "
              f"{ss.get(TAIWAN, [None])[-1]}%")

    # 進出口（天然氣、煤）：側欄的表，2026-10-30 起也做成指標 eia-import/、eia-export/（製作手冊第七批 144）
    for fuel, (imp_key, exp_key, factor) in TRADE_SERIES.items():
        out["trade"][fuel] = {
            "import": {c: {y: v * factor for y, v in s.items() if y >= 1980} for c, s in data[imp_key].items()},
            "export": {c: {y: v * factor for y, v in s.items() if y >= 1980} for c, s in data[exp_key].items()},
        }
        notes_zh, notes_en = eia_notes(fuel, out["production"][fuel], out["consumption"][fuel])
        for direction, key in (("import", imp_key), ("export", exp_key)):
            series = out["trade"][fuel][direction]
            span = year_span(series)
            write_json(OUT / f"eia-{direction}" / f"{fuel}.json", indicator_file(
                f"eia-{direction}/{fuel}", UNIT_ZH[fuel], span,
                {c: [sig(v) for v in to_series(s, span)] for c, s in sorted(series.items()) if any(s.get(y) for y in span)},
                aggregates={"WLD": [sig(v * factor) if v is not None else None for v in to_series(world[key], span)]},
                notes=notes_zh, notesEn=notes_en,
            ))
            last = {c: s.get(span[-1], 0) for c, s in series.items()}
            top = sorted(last, key=lambda c: -last[c])[:5]
            print(f"  EIA {fuel} {direction}：{span[0]}–{span[-1]}，{span[-1]} 年最多 "
                  + "、".join(f"{c} {last[c]:,.1f}" for c in top) + f"；台灣 {last.get(TAIWAN)}")
    # 初級能源結構
    out["mix"] = {k: data[s] for k, s in MIX_SERIES.items()}
    out["mix"]["total"] = data[MIX_TOTAL]

    reserves_files(data[COAL_RESERVES], world[COAL_RESERVES])
    return out


UNIT_ZH = {"oil": "千桶/日", "gas": "十億立方公尺", "coal": "百萬公噸"}
PER_UNIT_ZH = {"oil": "桶/人", "gas": "立方公尺/人", "coal": "公斤/人"}


def eia_notes(fuel: str, prod: dict, cons: dict) -> tuple[dict, dict]:
    """產量、消費量等指標共用的附註：台灣（EIA 的估計與沿用）、新加坡與荷蘭（煉油與加油港）、蘇聯等地點"""
    zh: dict[str, str] = {}
    en: dict[str, str] = {}
    if fuel == "oil":
        zh[TAIWAN] = ("EIA 的台灣原油產量 2015 年起每年都是 0.196 千桶/日（沿用舊值）；能源署的自產原油 2024 年約 1.3 千公噸油當量"
                      "（約 0.03 千桶/日）。台灣的原油幾乎全部進口，消費量含煉油廠用的燃料與石化原料。")
        en[TAIWAN] = ("EIA shows Taiwan's crude oil output at 0.196 thousand b/d every year since 2015 (a carried-over value); the "
                      "Energy Administration reports about 1.3 thousand toe of domestic crude in 2024 (about 0.03 thousand b/d). "
                      "Taiwan imports nearly all its crude; consumption includes refinery fuel and petrochemical feedstock.")
        for c, name_zh, name_en in (("SGP", "新加坡", "Singapore"), ("NLD", "荷蘭", "the Netherlands")):
            zh[c] = (f"{name_zh}是煉油與船舶加油的樞紐，EIA 的石油消費量包含煉油廠自用、石化原料與賣給國際航線的燃料，"
                     "人均消費量因此很高。")
            en[c] = (f"{name_en} is a refining and bunkering hub; EIA's oil consumption includes refinery use, petrochemical "
                     "feedstock and fuel sold to international shipping, so consumption per person is very high.")
    elif fuel == "gas":
        zh[TAIWAN] = ("台灣的天然氣幾乎全部是進口的液化天然氣（LNG）。EIA 的台灣天然氣產量 2023、2024 年都是 0.0601 十億立方公尺"
                      "（沿用），進口量與消費量相同是 EIA 的估計；能源署的自產天然氣 2024 年約 55 千公噸油當量。")
        en[TAIWAN] = ("Taiwan's gas is almost all imported LNG. EIA shows Taiwan's gas output at 0.0601 billion cubic metres in "
                      "both 2023 and 2024 (carried over), and imports equal to consumption, which is an EIA estimate; the Energy "
                      "Administration reports about 55 thousand toe of domestic gas in 2024.")
    else:
        zh[TAIWAN] = ("台灣 2001 年起沒有產煤，煤全部進口；EIA 的台灣煤進口量與消費量相同是 EIA 的估計。"
                      "EIA 的台灣煤蘊藏量 2008–2023 年都是 1 百萬公噸。")
        en[TAIWAN] = ("Taiwan has mined no coal since 2001 and imports all it uses; EIA's equal figures for Taiwan's coal imports "
                      "and consumption are an EIA estimate. EIA lists Taiwan's coal reserves at 1 million tonnes for every year "
                      "from 2008 to 2023.")
    for _, (place, parts) in PLACES.items():
        if place in prod or place in cons:
            zh[place] = "已經不存在的國家，畫在當時的首都；人均消費量的人口是今天的繼承國在當年的人口加總（UN WPP 依現在的國界回推）。"
            en[place] = ("A country that no longer exists, drawn at its former capital; population for per-person figures is the "
                         "sum of today's successor states in that year (UN WPP back-casts to current borders).")
    zh["DEU"] = "1990 年以前是西德與東德的合計。"
    en["DEU"] = "Before 1991, West and East Germany combined."
    if fuel != "oil":
        return zh, en
    zh["RUS"] = "1991 年以前見蘇聯（地圖上畫在莫斯科的圓）。"
    en["RUS"] = "Before 1992, see the Soviet Union (the circle drawn at Moscow)."
    return zh, en


def reserves_files(coal: dict[str, dict[int, float]], coal_world: dict[int, float]) -> None:
    fb = factbook.reserves()
    fb_note_zh = "CIA World Factbook 的 2021 年估計（Factbook 2026 年停刊前的最後一版）。"
    fb_note_en = "CIA World Factbook estimate for 2021 (the last edition before the Factbook was discontinued in 2026)."
    for fuel, scale in (("oil", 1e9), ("gas", 1e12)):
        values = {c: [sig(v / scale)] for c, (v, y) in sorted(fb[fuel].items()) if c != "WLD"}
        years = {y for _, y in fb[fuel].values()}
        if years != {2021}:
            raise RuntimeError(f"Factbook 的 {fuel} 蘊藏量年份不是都 2021：{years}")
        write_json(OUT / "reserves" / f"{fuel}.json", indicator_file(
            f"reserves/{fuel}", {"oil": "十億桶", "gas": "兆立方公尺"}[fuel], [2021], values,
            aggregates={"WLD": [sig(fb[fuel]["WLD"][0] / scale)]},
            notes={TAIWAN: fb_note_zh}, notesEn={TAIWAN: fb_note_en},
        ))
        top = sorted(values, key=lambda c: -values[c][0])[:5]
        print(f"  Factbook {fuel}：{len(values)} 國，前 5 名 " + "、".join(f"{c} {values[c][0]}" for c in top))
    years = year_span(coal)
    write_json(OUT / "reserves" / "coal.json", indicator_file(
        "reserves/coal", "百萬公噸", years,
        {c: [sig(v * SHORT_TON) if v is not None else None for v in to_series(s, years)]
         for c, s in sorted(coal.items()) if any(s.get(y) for y in years)},
        aggregates={"WLD": [sig(v * SHORT_TON) if v is not None else None for v in to_series(coal_world, years)]},
    ))


# ── BACI：流向 ──────────────────────────────────


def baci_rows() -> dict[int, list]:
    """BACI HS92 燃料六位碼的每一筆流量，第一次讀完整個 zip（約 5 分鐘）後存在 .cache/baci/ 的小檔"""
    cache = CACHE_DIR / "baci" / f"fossil-fuels-{baci.VERSION}.json.gz"
    if cache.exists():
        with gzip.open(cache, "rt", encoding="utf-8") as f:
            return {int(y): rows for y, rows in json.load(f).items()}
    codes = tuple(sorted({c for cs in FLOW_CODES.values() for c in cs}))
    print("  讀取 BACI HS92（約 2.4 GB，燃料的六位碼，幾分鐘）…")
    out = {year: rows for year, rows in baci.yearly_hs6_rows(codes, hs="HS92", extra=BACI_EXTRA)}
    with gzip.open(cache, "wt", encoding="utf-8") as f:
        json.dump(out, f)
    return out


def kt(t: float) -> float:
    """公噸 → 千公噸，3 位有效數字（流向檔）"""
    v = float(f"{t / 1000:.3g}")
    return int(v) if v == int(v) else v


def weighted_median(prices: list[tuple[float, float]]) -> float:
    """依權重（金額）的中位數"""
    prices = sorted(prices)
    half = sum(w for _, w in prices) / 2
    acc = 0.0
    for p, w in prices:
        acc += w
        if acc >= half:
            return p
    return prices[-1][0]


def clean_quantities(rows: list) -> tuple[list, dict]:
    """依六位碼各自的單價清理數量：單價比依金額加權的中位數高 PRICE_FACTOR 倍以上或低到 1/PRICE_FACTOR 以下、
    或數量空白的，數量改成「金額 ÷ 中位數單價」。回傳 [(六位碼, 出口國, 進口國, 千美元, 公噸, 是否估算)] 與統計。"""
    medians = {}
    by_code: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for k, _, _, v, q in rows:
        if q and q > 0 and v > 0:
            by_code[k].append((v / q, v))
    for k, prices in by_code.items():
        medians[k] = weighted_median(prices)
    out = []
    stats = defaultdict(lambda: {"n": 0, "value": 0.0, "fixed": 0, "fixedValue": 0.0, "raw": 0.0, "clean": 0.0})
    for k, i, j, v, q in rows:
        med = medians.get(k)
        s = stats[k]
        s["n"] += 1
        s["value"] += v
        s["raw"] += q or 0
        estimated = False
        if med and v > 0 and (not q or q <= 0 or v / q > med * PRICE_FACTOR or v / q < med / PRICE_FACTOR):
            q = v / med
            estimated = True
            s["fixed"] += 1
            s["fixedValue"] += v
        s["clean"] += q or 0
        out.append((k, i, j, v, q or 0.0, estimated))
    return out, {"medians": medians, "stats": stats}


def trade_files() -> dict:
    rows_by_year = baci_rows()
    years_all = sorted(rows_by_year)
    totals: dict[str, dict[str, dict[str, dict[int, float]]]] = {
        item: {"export": defaultdict(dict), "import": defaultdict(dict)} for item in FLOW_CODES
    }
    pair_series: dict[str, dict[str, dict[str, dict[str, dict[int, float]]]]] = {
        item: {"export": defaultdict(lambda: defaultdict(dict)), "import": defaultdict(lambda: defaultdict(dict))}
        for item in FLOW_CODES
    }
    world: dict[str, dict[int, float]] = {item: {} for item in FLOW_CODES}
    values: dict[int, dict[str, dict[str, dict[str, float]]]] = {}
    report: list[str] = []
    code_item = {c: item for item, cs in FLOW_CODES.items() for c in cs}
    years_of: dict[str, list[int]] = {item: [y for y in years_all if y >= FLOW_FIRST_YEAR.get(item, 0)] for item in FLOW_CODES}
    for year in years_all:
        cleaned, info = clean_quantities(rows_by_year[year])
        for item, codes in FLOW_CODES.items():
            raw = sum(info["stats"][c]["raw"] for c in codes) / 1e6
            clean = sum(info["stats"][c]["clean"] for c in codes) / 1e6
            value = sum(info["stats"][c]["value"] for c in codes)
            fixed_value = sum(info["stats"][c]["fixedValue"] for c in codes)
            fixed = sum(info["stats"][c]["fixed"] for c in codes)
            report.append(f"{year} {item}: {raw:,.0f} → {clean:,.0f} 百萬公噸，改了 {fixed} 筆（占金額 "
                          f"{fixed_value / value * 100 if value else 0:.1f}%）")
        # 依商品、方向、國家、夥伴加總：[公噸, 估算的公噸]
        agg: dict[str, dict[str, dict[str, dict[str | None, list[float]]]]] = {
            item: {"export": defaultdict(lambda: defaultdict(lambda: [0.0, 0.0])),
                   "import": defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))} for item in FLOW_CODES
        }
        vals = {item: {"export": defaultdict(float), "import": defaultdict(float)} for item in FLOW_CODES}
        for k, i, j, v, q, est in cleaned:
            item = code_item[k]
            if i is not None:
                cell = agg[item]["export"][i][j]
                cell[0] += q
                cell[1] += q if est else 0
                vals[item]["export"][i] += v
            if j is not None:
                cell = agg[item]["import"][j][i]
                cell[0] += q
                cell[1] += q if est else 0
                vals[item]["import"][j] += v
        values[year] = vals  # type: ignore[assignment]
        for item in FLOW_CODES:
            if year not in years_of[item]:
                continue
            # 數值存千公噸、3 位有效數字（scale 1000 換回公噸），檔案小三成
            out: dict[str, object] = {"item": item, "year": year, "unit": "千公噸", "scale": 1000}
            for direction in ("export", "import"):
                entries = {}
                for country, partners in sorted(agg[item][direction].items()):
                    total = sum(p[0] for p in partners.values())
                    if total < 0.5:
                        continue
                    totals[item][direction][country][year] = total
                    ranked = sorted(
                        ((p, c) for p, c in partners.items() if p is not None and p != country and c[0] >= 0.5),
                        key=lambda kv: -kv[1][0],
                    )
                    for p, c in ranked:
                        pair_series[item][direction][country][p][year] = c[0]
                    entries[country] = [kt(total), [
                        [p, kt(c[0])] + ([1] if c[1] >= ESTIMATED_SHARE * c[0] else []) for p, c in ranked[:TOP_N]
                    ]]
                out[direction] = entries
            world[item][year] = sum(totals[item]["export"][c].get(year, 0) for c in totals[item]["export"])
            write_json(OUT / "flows" / item / f"{year}.json", out, quiet=True)
    print("  BACI 數量清理（原始 → 清理後）：\n    " + "\n    ".join(r for r in report if any(
        f" {y} " in f" {r.split()[0]} " for y in ("1995", "1999", "2005", "2016", "2019", "2020", "2023", "2024"))))
    worst = sorted(report, key=lambda r: -float(re.search(r"占金額 ([\d.]+)%", r).group(1)))[:6]
    print("  改得最多的：" + "；".join(worst))
    size = sum(p.stat().st_size for p in (OUT / "flows").rglob("*.json"))
    print(f"  流向檔共 {size / 1024:.0f} KB")

    notes_zh = {
        TAIWAN: "BACI 的台灣（「Other Asia, nes」）是貿易夥伴申報的數字，台灣不向聯合國申報，而且這個代碼不全是台灣"
                "（委內瑞拉 2011–2013 年記到這裡的原油，台灣當年其實很少買）；能源署的進口來源見側欄。",
        "IRN": "BACI 只有進口國的申報，2023、2024 年沒有國家申報從伊朗進口原油，伊朗的原油出口是 0；一般認為這些原油經由"
               "轉運改記成其他國家的出口（例如馬來西亞）。",
        "MYS": "馬來西亞的原油出口 2022 年起大增（2024 年對中國約 5,450 萬公噸），一般認為含轉運的伊朗原油。",
        "ZAF": "1999 年以前是南部非洲關稅同盟（南非、波札那、賴索托、納米比亞、史瓦帝尼）的合計。",
        "BEL": "比利時的管道天然氣出口大多是過境再出口。",
    }
    notes_en = {
        TAIWAN: "Taiwan in BACI (\"Other Asia, nes\") is based on its partners' reports, as Taiwan does not report to the UN, "
                "and the code is not only Taiwan (Venezuela booked crude to it in 2011–2013, when Taiwan bought little); "
                "Energy Administration import sources are in the side panel.",
        "IRN": "BACI relies on importers' reports here; no country reported crude imports from Iran in 2023 or 2024, so Iran's "
               "crude exports are zero. These cargoes are widely thought to be relabelled as other countries' exports "
               "(Malaysia, for example) after ship-to-ship transfers.",
        "MYS": "Malaysia's crude exports jump from 2022 (about 54.5 million tonnes to China in 2024), widely thought to include "
               "transshipped Iranian crude.",
        "ZAF": "Before 2000, the Southern African Customs Union (South Africa, Botswana, Lesotho, Namibia, Eswatini) combined.",
        "BEL": "Belgium's pipeline gas exports are mostly re-exports of gas in transit.",
    }
    for item in FLOW_CODES:
        ys = years_of[item]
        for direction in ("export", "import"):
            write_json(OUT / direction / f"{item}.json", indicator_file(
                f"{direction}/{item}", "公噸", ys,
                {c: [sig(v) for v in to_series(s, ys)] for c, s in sorted(totals[item][direction].items())},
                aggregates={"WLD": [sig(v) for v in to_series(world[item], ys)]},
                notes=notes_zh, notesEn=notes_en,
            ))
        top = sorted(totals[item]["export"], key=lambda c: -totals[item]["export"][c].get(ys[-1], 0))[:5]
        print(f"  {item} {ys[-1]} 年出口前 5 名：" + "、".join(
            f"{c} {totals[item]['export'][c][ys[-1]] / 1e6:,.1f}" for c in top) + " 百萬公噸")
    return {"years": years_of, "totals": totals, "pairs": pair_series, "values": values, "world": world}


# ── GEM ─────────────────────────────────────────


def gem_load(key: str) -> list[dict]:
    url, filename = GEM_FILES[key]
    path = download(url, "gem", filename)
    with open(path, encoding="utf-8") as f:
        return json.load(f)["features"]


_MOJIBAKE = re.compile("[ÃÂâ][\u0080-ÿ‐-›€™ŒœŠšŸŽžƒˆ˜]")


def fix_text(s: str, counter: list[int]) -> str:
    """UTF-8 被當成 cp1252 再存一次的亂碼（「TerÃ©ga」「Basraâ€“Aqaba」）改回來；修不了的保留原樣"""
    s = (s or "").strip()
    if not _MOJIBAKE.search(s):
        return s
    try:
        fixed = s.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s
    counter[0] += 1
    return fixed


def gem_iso(name: str, where: str) -> str | None:
    name = fix_text(name, [0])
    if name in GEM_COUNTRY:
        return GEM_COUNTRY[name]
    code = from_name(name)
    if not code:
        raise RuntimeError(f"GEM {where} 的國名「{name}」對不到 ISO 代碼，要加進 GEM_COUNTRY")
    return code


def gem_isos(text: str, where: str) -> list[str]:
    """「Netherlands; Germany」→ ['NLD', 'DEU']"""
    isos = (gem_iso(n, where) for n in re.split(r"[;,]\s*", text or "") if n.strip())
    return [iso for iso in isos if iso]


def _number(text: object) -> float | None:
    try:
        v = float(str(text).replace(",", ""))
    except ValueError:
        return None
    return v if math.isfinite(v) else None


def _year(text: object) -> int | None:
    m = re.match(r"\s*(\d{4})", str(text or ""))
    return int(m.group(1)) if m else None


def _simplify(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    """Douglas–Peucker（迭代版），同 transport.py"""
    n = len(points)
    if n < 3:
        return points
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    t2 = tolerance * tolerance
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        length2 = dx * dx + dy * dy
        best, best_i = -1.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            if length2 == 0:
                d2 = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2))
                d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d2 > best:
                best, best_i = d2, i
        if best > t2:
            keep[best_i] = True
            stack.extend([(a, best_i), (best_i, b)])
    return [p for p, k in zip(points, keep) if k]


def _unwrap(part: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out = [part[0]]
    for x, y in part[1:]:
        px = out[-1][0]
        out.append((x + 360 * round((px - x) / 360), y))
    return out


def stitch(parts: list[list[tuple[float, float]]]) -> list[list[tuple[float, float]]]:
    """端點相接的段接成長的線。GGIT 的管線被切成十幾萬段（Tennessee Gas Pipeline 一條就六萬多段兩點的小段），
    平行的複線共用頂點（一個節點接 4、6、8 段），也有重複的段，所以：
    1. 端點量化到 JOIN_QUANTUM 當成圖的節點，端點相同的段（不分方向）只留一段；
    2. 從還沒用過的段出發，往兩頭延伸：每到一個節點，接上還沒用過、轉角最小的那一段，直到沒有段可接。
    每一段剛好用一次，畫出來跟原本一樣，線的條數大約是奇數度節點的一半。"""
    key = lambda pt: (round(pt[0] / JOIN_QUANTUM), round(pt[1] / JOIN_QUANTUM))  # noqa: E731
    seen: set[tuple] = set()
    unique: list[list[tuple[float, float]]] = []
    for p in parts:
        if len(p) < 2:
            continue
        a, b = key(p[0]), key(p[-1])
        sig_ = (min(a, b), max(a, b), len(p) if len(p) > 2 else 0)
        if a != b and sig_ in seen:
            continue
        seen.add(sig_)
        unique.append(p)
    ends: dict[tuple[int, int], list[tuple[int, int]]] = defaultdict(list)  # 節點 → [(段, 0 頭 / 1 尾)]
    for i, p in enumerate(unique):
        ends[key(p[0])].append((i, 0))
        ends[key(p[-1])].append((i, 1))
    used = [False] * len(unique)

    def extend(line: list[tuple[float, float]]) -> None:
        while True:
            x0, y0 = line[-2]
            x1, y1 = line[-1]
            heading = math.atan2(y1 - y0, x1 - x0)
            best, best_turn = None, 9.0
            for j, e in ends[key(line[-1])]:
                if used[j]:
                    continue
                seg = unique[j] if e == 0 else unique[j][::-1]
                nx, ny = seg[1]
                turn = abs((math.atan2(ny - y1, nx - x1) - heading + math.pi) % (2 * math.pi) - math.pi)
                if turn < best_turn:
                    best, best_turn = (j, seg), turn
            if best is None:
                return
            used[best[0]] = True
            line.extend(best[1][1:])

    out = []
    for i, p in enumerate(unique):
        if used[i]:
            continue
        used[i] = True
        line = list(p)
        extend(line)
        line.reverse()
        extend(line)
        out.append(line)
    return out


def _lines_of(geometry: dict) -> list[list[tuple[float, float]]]:
    if not geometry:
        return []
    coords = geometry["coordinates"]
    if geometry["type"] == "LineString":
        coords = [coords]
    elif geometry["type"] != "MultiLineString":
        return []
    return [[(float(x), float(y)) for x, y, *_ in part] for part in coords if len(part) >= 2]


def pipeline_layer(features: list[dict], kind: str, mojibake: list[int]) -> tuple[dict, dict]:
    """天然氣管線（kind='gas'）或油管（kind='oil'）的線圖層；回傳資料檔與統計"""
    lines, types, records, groups = [], [], [], []
    stats = {"features": 0, "segments": 0, "joined": 0, "vertices": 0, "kept": 0}
    by_country: dict[str, int] = defaultdict(int)
    for f in features:
        p = f["properties"]
        status = LINE_STATUS.get(p["status"].strip().lower())
        if status is None:
            continue
        parts = _lines_of(f["geometry"])
        if not parts:
            continue
        stats["features"] += 1
        stats["segments"] += len(parts)
        stats["vertices"] += sum(len(x) for x in parts)
        joined = stitch(parts)
        stats["joined"] += len(joined)
        isos = gem_isos(p["all-countries"], p["name"])
        for iso in set(isos):
            by_country[iso] += 1
        if kind == "gas":
            code = status
        else:
            ngl = p["fuel"].strip() == "NGL"
            code = (3 if ngl else 1) + (0 if status == 1 else 1)
        group = stats["features"]
        groups.append({
            "g": group,
            "name": fix_text(p["name"], mojibake),
            "st": status,
            "start": _year(p["start-year"]),
            "cap": _number(p["capacity"]) if kind == "gas" else None,
            "c": " ".join(dict.fromkeys(isos)),
        })
        for line in joined:
            simple = _simplify(_unwrap(line), SIMPLIFY)
            if len(simple) == 2 and simple[0] == simple[-1]:
                continue
            stats["kept"] += len(simple)
            lines.append(simple)
            types.append(code)
            records.append({"g": group})
    # 一條管線被接成好幾條線（分岔、複線），名稱、狀態等每條管線只存一次（LinesData.groups），線只存組別 g
    data = lines_file(
        lines, quantum=0.01, types=types, records=records, record_fields=["g"], record_scale={"g": 1}, record_delta=("g",),
        groups=("g", points_file(groups, ["g", "name", "st", "start", "cap", "c"],
                                 {"g": 1, "st": 1, "start": 1, "cap": 0.01}, delta=("g",), strings=["c"])),
    )
    stats["countries"] = dict(by_country)  # type: ignore[assignment]
    return data, stats


def gem_files() -> dict:
    mojibake = [0]
    ggit = gem_load("ggit")
    gas_lines, gas_stats = pipeline_layer([f for f in ggit if f["properties"]["tracker-acro"] == "GGIT"], "gas", mojibake)
    write_json(OUT / "gas-pipelines.json", gas_lines)
    goit = gem_load("goit")
    oil_lines, oil_stats = pipeline_layer(goit, "oil", mojibake)
    write_json(OUT / "oil-pipelines.json", oil_lines)
    for label, s, f in (("天然氣管線", gas_stats, "gas-pipelines.json"), ("油管", oil_stats, "oil-pipelines.json")):
        print(f"  GEM {label}：{s['features']} 條、{s['segments']:,} 段、{s['vertices']:,} 個頂點 → 接成 {s['joined']:,} 條、"
              f"簡化後 {s['kept']:,} 個頂點，{(OUT / f).stat().st_size / 1024:.0f} KB")

    lng = lng_terminals([f for f in ggit if f["properties"]["tracker-acro"] == "LNG"], mojibake)
    fields = oil_gas_fields(gem_load("goget"), mojibake)
    mines = coal_mines(gem_load("gcmt"), mojibake)
    print(f"  GEM 名稱的亂碼修正了 {mojibake[0]} 筆")
    return {"lng": lng, "fields": fields, "mines": mines,
            "pipelines": {"gas": gas_stats["countries"], "oil": oil_stats["countries"]}}


def lng_terminals(features: list[dict], mojibake: list[int]) -> dict[str, list[dict]]:
    """LNG 接收站：同一個 project-id 的分期合成一個點；運轉中的容量畫在運轉中的圖層，興建中與規劃中的另一個圖層"""
    projects: dict[str, list[dict]] = defaultdict(list)
    for f in features:
        p = f["properties"]
        if p["status"].strip().lower() not in LINE_STATUS:
            continue
        projects[p["project-id"]].append(p)
    terminals = []
    for pid, phases in projects.items():
        first = phases[0]
        lon, lat = _number(first["Longitude"]), _number(first["Latitude"])
        if lon is None or lat is None:
            continue
        kind = 1 if first["facility-type"].strip() == "import" else 2
        rows = []
        for ph in sorted(phases, key=lambda x: (LINE_STATUS[x["status"].strip().lower()], _year(x["start-year"]) or 9999)):
            rows.append((fix_text(ph["unit-name"], mojibake), LINE_STATUS[ph["status"].strip().lower()],
                         _number(ph["capacity"]) or 0.0, _year(ph["start-year"])))
        operating = sum(r[2] for r in rows if r[1] == 1)
        planned = sum(r[2] for r in rows if r[1] != 1)
        start = min((r[3] for r in rows if r[1] == 1 and r[3]), default=None)
        terminals.append({
            "lon": lon, "lat": lat, "name": fix_text(first["name"], mojibake),
            "iso3": gem_iso(first["country-area1"], first["name"]) if first["country-area1"].strip() else countries_at([lon], [lat])[0],
            "kind": kind, "op": round(operating, 2), "plan": round(planned, 2), "start": start,
            # 各分期：名稱|狀態|容量|啟用年份，用 ; 分開（tooltip 列出來）
            "ph": ";".join(f"{n}|{s}|{c:g}|{y or ''}" for n, s, c, y in rows) if len(rows) > 1 else None,
        })
    fields = ["lon", "lat", "name", "iso3", "kind", "op", "plan", "start", "ph"]
    scale = {"lon": 0.01, "lat": 0.01, "kind": 1, "op": 0.01, "plan": 0.01, "start": 1}
    operating = sorted((t for t in terminals if t["op"] > 0), key=lambda t: -t["op"])
    planned = sorted((t for t in terminals if t["op"] == 0), key=lambda t: -t["plan"])
    write_json(OUT / "lng-operating.json", points_file(operating, fields, scale))
    write_json(OUT / "lng-planned.json", points_file(planned, fields, scale))
    print(f"  GEM LNG 接收站：{len(projects)} 個專案（{sum(len(v) for v in projects.values())} 個分期），運轉中 {len(operating)} 個、"
          f"只有興建中或規劃中的 {len(planned)} 個；台灣 {sum(1 for t in terminals if t['iso3'] == TAIWAN)} 個")
    by_country: dict[str, list[dict]] = defaultdict(list)
    for t in terminals:
        by_country[t["iso3"]].append(t)
    return by_country


def oil_gas_fields(features: list[dict], mojibake: list[int]) -> dict[str, list[dict]]:
    rows = []
    skipped = defaultdict(int)
    for f in features:
        p = f["properties"]
        status = FIELD_STATUS.get(p["status"].strip().lower())
        if status is None:
            skipped[p["status"]] += 1
            continue
        if p["location-accuracy"].strip() == "country-level only":
            skipped["country-level only"] += 1
            continue
        lon, lat = _number(p["Longitude"]), _number(p["Latitude"])
        if lon is None or lat is None:
            skipped["no location"] += 1
            continue
        prod = _number(p["capacity"])
        year = max((y for y in (_year(p["prod-year-oil"]), _year(p["prod-year-gas"])) if y), default=None)
        rows.append({
            "lon": lon, "lat": lat, "name": fix_text(p["name"], mojibake), "iso3": gem_iso(p["country-area1"], p["name"]),
            "st": status, "prod": round(prod, 2) if prod else None, "py": year if prod else None,
            "oil": _number(p["prod-oil"]), "gas": _number(p["prod-gas"]),
        })
    rows.sort(key=lambda r: -(r["prod"] or 0))
    fields = ["lon", "lat", "name", "iso3", "st", "prod", "py"]
    write_json(OUT / "fields.json", points_file(rows, fields, {"lon": 0.01, "lat": 0.01, "st": 1, "prod": 0.01, "py": 1}))
    print(f"  GEM 油氣田：畫 {len(rows)} 個（有產量的 {sum(1 for r in rows if r['prod'])} 個），不畫的 {dict(skipped)}")
    by_country: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        if r["prod"]:
            by_country[r["iso3"]].append(r)
    return by_country


def coal_mines(features: list[dict], mojibake: list[int]) -> dict[str, list[dict]]:
    layers: dict[int, list[dict]] = defaultdict(list)
    skipped = defaultdict(int)
    for f in features:
        p = f["properties"]
        if p["tracker-acro"] != "GCMT":
            skipped["礦區範圍（SMP）"] += 1
            continue
        status = MINE_STATUS.get(p["status"].strip().lower())
        if status is None:
            skipped[p["status"]] += 1
            continue
        lon, lat = _number(p["Longitude"]), _number(p["Latitude"])
        if lon is None or lat is None or p["location-accuracy"].strip() == "country-level only":
            skipped["no location"] += 1
            continue
        cap = _number(p["capacity"])
        prod = _number(p["prod-coal"])
        layers[status].append({
            "lon": lon, "lat": lat, "name": fix_text(p["name"], mojibake), "iso3": gem_iso(p["country-area1"], p["name"]),
            "st": status, "cap": round(cap, 2) if cap else None, "prod": round(prod, 2) if prod else None,
            "py": _year(p["prod-year-coal"]) if prod else None, "type": {"Surface": 1, "Underground": 2}.get(p["mine-type"].strip()),
            "start": _year(p["start-year"]),
        })
    fields = ["lon", "lat", "name", "iso3", "st", "cap", "prod", "py", "type", "start"]
    scale = {"lon": 0.01, "lat": 0.01, "st": 1, "cap": 0.01, "prod": 0.01, "py": 1, "type": 1, "start": 1}
    files = {1: "mines-operating.json", 2: "mines-proposed.json"}
    closed = layers.get(3, []) + layers.get(4, [])
    for status, filename in files.items():
        rows = sorted(layers[status], key=lambda r: -(r["cap"] or r["prod"] or 0))
        write_json(OUT / filename, points_file(rows, fields, scale))
    write_json(OUT / "mines-closed.json", points_file(sorted(closed, key=lambda r: -(r["cap"] or r["prod"] or 0)), fields, scale))
    print(f"  GEM 煤礦：運轉中 {len(layers[1])}、規劃中 {len(layers[2])}、關閉或封存 {len(closed)}；不畫的 {dict(skipped)}")
    by_country: dict[str, list[dict]] = defaultdict(list)
    for r in layers[1]:
        by_country[r["iso3"]].append(r)
    return by_country


# ── 台灣的對照 ───────────────────────────────────


def taiwan_comparison(eia_data: dict, trade: dict) -> dict:
    """能源署的進口來源跟 BACI 的台灣進口來源（占比）、能源署的自產與進口跟 EIA，給台灣的側欄與附註"""
    out: dict[str, object] = {}
    flows = {"oil": "oil", "lng": "gas", "coal": "coal"}
    for fuel, item in flows.items():
        official = moeaea_fuels.import_sources(fuel)
        years = sorted(y for y in official if y in trade["years"][item])
        partners = sorted({p for y in years for p in official[y] if p not in ("total", None)},
                          key=lambda p: -sum(official[y].get(p, 0) for y in years))
        baci_pairs = trade["pairs"][item]["import"].get(TAIWAN, {})
        baci_total = trade["totals"][item]["import"].get(TAIWAN, {})
        # 能源署沒有欄位、但 BACI 某一年占 1% 以上的夥伴也列出來（例如原油的墨西哥），能源署那一欄是 null（算在「其他」）
        extra = sorted((p for p, s in baci_pairs.items() if p not in partners and any(
            baci_total.get(y) and s.get(y, 0) >= 0.01 * baci_total[y] for y in years)),
            key=lambda p: -sum(baci_pairs[p].get(y, 0) for y in years))
        block = {"years": years, "unit": "千桶" if fuel == "oil" else "千公噸",
                 "total": [round(official[y]["total"]) for y in years],
                 "baciTotal": [round(baci_total.get(y, 0) / 1000) for y in years], "partners": []}
        for p in partners + extra:
            block["partners"].append([
                p,
                [round(official[y].get(p, 0) / official[y]["total"] * 1000) / 10 if official[y]["total"] and p in partners else None
                 for y in years],
                [round(baci_pairs.get(p, {}).get(y, 0) / baci_total[y] * 1000) / 10 if baci_total.get(y) else None for y in years],
            ])
        block["other"] = [round(official[y].get(None, 0) / official[y]["total"] * 1000) / 10 for y in years]
        out[fuel] = block
        last = years[-1]
        shares = ", ".join(f"{p} {o[-1]}%/{b[-1]}%" for p, o, b in block["partners"][:6])
        print(f"  台灣 {fuel} 進口來源 {last} 年（能源署/BACI）：{shares}")
    supply = moeaea_fuels.supply()
    years = sorted(supply)
    out["supply"] = {
        "years": years,
        "crude": [round(supply[y]["自產能源_原油"], 1) for y in years],
        "gas": [round(supply[y]["自產能源_(自產)天然氣"], 1) for y in years],
        "coal": [round(supply[y]["自產能源_煙煤-煉焦煤"] + supply[y]["自產能源_煙煤-燃料煤"], 1) for y in years],
        "mix": {k: [round(supply[y][f"能源總供給_{col}"]) for y in years]
                for k, col in (("coal", "煤及煤產品"), ("oil", "原油及石油產品"), ("gas", "天然氣"), ("nuclear", "核能"),
                               ("renewables", "再生能源_小計"))},
    }
    eia_oil = eia_data["production"]["oil"].get(TAIWAN, {})
    print("  台灣的自產原油：EIA（千桶/日）" + "、".join(f"{y} {eia_oil.get(y)}" for y in (2005, 2015, 2024)) +
          "；能源署（千公噸油當量）" + "、".join(f"{y} {supply[y]['自產能源_原油']:.1f}" for y in (2005, 2015, 2024)))
    return out


# ── 側欄的明細 ─────────────────────────────────────


def _series(s: dict[int, float], years: list[int], digits: int = 3) -> list[float | None] | None:
    row = [sig(s.get(y), digits) if s.get(y) is not None else None for y in years]
    return row if any(v for v in row) else None


def details(eia_data: dict, trade: dict, gem: dict, taiwan: dict) -> None:
    known = known_countries()
    mix_years = list(range(1980, 2025))
    (OUT / "countries").mkdir(parents=True, exist_ok=True)
    for old in (OUT / "countries").glob("*.json"):
        old.unlink()
    isos = set(known) | {p for p, _ in PLACES.values()}
    written = 0
    for iso in sorted(isos):
        out: dict[str, object] = {}
        mix = {k: _series(eia_data["mix"][k].get(iso, {}), mix_years) for k in MIX_SERIES}
        if any(mix.values()):
            out["mix"] = {"years": mix_years, **{k: v for k, v in mix.items() if v}}
        trade_rows = {}
        for fuel in TRADE_SERIES:
            for direction in ("import", "export"):
                row = _series(eia_data["trade"][fuel][direction].get(iso, {}), mix_years)
                if row:
                    trade_rows[f"{fuel}-{direction}"] = row
        if trade_rows:
            out["eiaTrade"] = {"years": mix_years, **trade_rows}
        lng = gem["lng"].get(iso)
        if lng:
            out["lng"] = [[t["name"], t["kind"], t["op"], t["plan"], t["start"]]
                          for t in sorted(lng, key=lambda t: -(t["op"] + t["plan"]))]
        fields = gem["fields"].get(iso)
        if fields:
            out["fields"] = [[r["name"], r["prod"], r["py"], r["st"]] for r in sorted(fields, key=lambda r: -r["prod"])[:10]]
            out["fieldCount"] = len(fields)
        mines = gem["mines"].get(iso)
        if mines:
            ranked = sorted(mines, key=lambda r: -(r["cap"] or r["prod"] or 0))
            out["mines"] = [[r["name"], r["cap"], r["prod"], r["py"]] for r in ranked[:10]]
            out["mineCount"] = len(mines)
        pipes = {k: v.get(iso) for k, v in gem["pipelines"].items() if v.get(iso)}
        if pipes:
            out["pipelines"] = pipes
        if iso == TAIWAN:
            out["taiwan"] = taiwan
        if out:
            write_json(OUT / "countries" / f"{iso}.json", out, quiet=True)
            written += 1
    size = sum(p.stat().st_size for p in (OUT / "countries").glob("*.json"))
    total = sum(p.stat().st_size for p in OUT.rglob("*.json"))
    count = sum(1 for _ in OUT.rglob("*.json"))
    print(f"  側欄明細 {written} 國，共 {size / 1024:.0f} KB；整個主題 {count} 個檔、{total / 1024 / 1024:.2f} MB")
