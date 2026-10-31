"""發電量主題：Ember Yearly Electricity Data（CC BY 4.0，2000 年起，含台灣）。

2026-10-31（製作手冊第十批 162）擴充：
- 7 種能源各自的發電占比（燃氣、水力、風力、太陽能、生質能、燃油等其他化石、地熱等其他再生），同一個 Ember 檔；
- 2030 年再生能源發電占比目標（Ember「Global Renewable Power Sector Targets 2030」，CC BY 4.0）與距離目標還差多少；
  使用者決定不做裝置容量目標（Ember 彙總表的容量跟它引用的文件對不起來）。台灣不在 Ember 的目標檔，手補官方目標；
- 電力普及率與沒有電的人數（世界銀行 WDI EG.ELC.ACCS.ZS × SP.POP.TOTL，CC BY 4.0；WDI 沒有台灣，留白）。
"""
from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, now_iso, to_series, write_json
from sources.countries import to_iso3

URL = "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv"

# 輸出檔名 -> ((Category, Subcategory, Variable, Unit), 單位, 換算倍數, 小數位數)
INDICATORS = {
    "generation": (("Electricity generation", "Total", "Total Generation", "TWh"), "TWh", 1, 2),
    "demand-per-capita": (("Electricity demand", "Demand per capita", "Demand per capita", "MWh"), "kWh", 1000, 0),
    "renewables-share": (("Electricity generation", "Aggregate fuel", "Renewables", "%"), "%", 1, 1),
    "clean-share": (("Electricity generation", "Aggregate fuel", "Clean", "%"), "%", 1, 1),
    "coal-share": (("Electricity generation", "Fuel", "Coal", "%"), "%", 1, 1),
    "nuclear-share": (("Electricity generation", "Fuel", "Nuclear", "%"), "%", 1, 1),
    "gas-share": (("Electricity generation", "Fuel", "Gas", "%"), "%", 1, 1),
    "hydro-share": (("Electricity generation", "Fuel", "Hydro", "%"), "%", 1, 1),
    "wind-share": (("Electricity generation", "Fuel", "Wind", "%"), "%", 1, 1),
    "solar-share": (("Electricity generation", "Fuel", "Solar", "%"), "%", 1, 1),
    "bioenergy-share": (("Electricity generation", "Fuel", "Bioenergy", "%"), "%", 1, 1),
    "other-fossil-share": (("Electricity generation", "Fuel", "Other Fossil", "%"), "%", 1, 1),
    "other-renewables-share": (("Electricity generation", "Fuel", "Other Renewables", "%"), "%", 1, 1),
    "carbon-intensity": (("Power sector emissions", "CO2 intensity", "CO2 intensity", "gCO2/kWh"), "gCO₂/kWh", 1, 0),
}

FUEL_SHARES_LATEST = {"gas-share", "hydro-share", "wind-share", "solar-share", "bioenergy-share", "other-fossil-share",
                      "other-renewables-share"}

# 側欄的發電結構：Ember 有 9 種能源，生質能與其他再生能源合併成一類（圖表最多 8 色）
FUELS = {
    "Coal": "coal",
    "Gas": "gas",
    "Other Fossil": "other-fossil",
    "Nuclear": "nuclear",
    "Hydro": "hydro",
    "Wind": "wind",
    "Solar": "solar",
    "Bioenergy": "bio-other",
    "Other Renewables": "bio-other",
}
FUEL_ORDER = ["coal", "gas", "other-fossil", "nuclear", "hydro", "wind", "solar", "bio-other"]


def build() -> None:
    path = download(URL, "ember", "yearly_full_release_long_format.csv")
    wanted = {spec: key for key, (spec, *_rest) in INDICATORS.items()}
    series: dict[str, dict[str, dict[int, float]]] = {key: defaultdict(dict) for key in INDICATORS}
    mix: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))

    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["Area"] == "World":
                area = "WLD"
            elif row["Area type"] == "Country or economy" and (iso3 := to_iso3(row["ISO 3 code"])):
                area = iso3
            else:
                continue
            if not row["Value"]:
                continue
            year, value = int(row["Year"]), float(row["Value"])
            spec = (row["Category"], row["Subcategory"], row["Variable"], row["Unit"])
            if key := wanted.get(spec):
                series[key][area][year] = value
            if spec[0] == "Electricity generation" and spec[1] == "Fuel" and spec[3] == "TWh":
                mix[area][FUELS[spec[2]]][year] += value

    years = list(range(min(y for s in series["generation"].values() for y in s),
                       max(y for s in series["generation"].values() for y in s) + 1))
    out = OUT_DIR / "topics" / "electricity"
    for key, (_spec, unit, scale, digits) in INDICATORS.items():
        data = series[key]
        world = data.pop("WLD", {})
        scaled = lambda s: to_series({y: v * scale for y, v in s.items()}, years, digits)  # noqa: E731
        # 各能源的細項（第十批 162）：2025 年只有 91 國，其他國家用 2024 年（使用者決定）
        extra = {"latestWithin": 1} if key in FUEL_SHARES_LATEST else {}
        write_json(
            out / f"{key}.json",
            indicator_file(key, unit, years, {a: scaled(s) for a, s in data.items()}, aggregates={"WLD": scaled(world)}, **extra),
        )

    # 側欄：各國每年各能源發電量（TWh）
    for area, fuels in mix.items():
        write_json(
            out / "countries" / f"{area}.json",
            {"years": years, "fuels": FUEL_ORDER, "values": {f: to_series(fuels.get(f, {}), years, 2) for f in FUEL_ORDER}},
            quiet=True,
        )
    print(f"  {len(mix)} 個國家的發電結構")
    build_targets(out, series["renewables-share"])
    build_access(out)
    write_json(out / "manifest.json", {"topic": "electricity", "generatedAt": now_iso(), "source": "Ember"})


TARGETS_URL = "https://files.ember-energy.org/public-downloads/res_tracker/outputs/targets_download.xlsx"
TARGET_YEAR = 2030
# 再生能源的種類（Ember 目標檔的 FUEL_CATEGORY）；有 Wind 時不另外加陸域、離岸
RENEWABLE_FUELS = {"Hydro", "Wind", "Solar", "Bioenergy", "Other Renewables", "Onshore Wind", "Offshore Wind",
                   "Hydro, bio and other renewables", "Rest of renewables"}
# 不是政府目標的來源，tooltip 標出來
SOURCE_HINTS = {
    "Assumption": ("Ember 依現況推估（不是政府目標）", "Ember’s own estimate (not a government target)"),
    "Third-party studies": ("第三方研究的推估（不是政府目標）", "Third-party study (not a government target)"),
}
# 台灣不在 Ember 的目標檔：照官方文件手補（使用者 2026-10-30 決定）
TW_TARGET = 30
TW_NOTE = ("2030 年再生能源發電占比 30% 是行政院院長〈能源配比及電價政策〉專案報告（2024-10-29，立法院）的淨零轉型階段目標；"
           "原本的目標是 2025 年 20%（經濟部〈能源轉型路徑規劃〉，2017-06-13）。")
TW_NOTE_EN = ("The 2030 target of 30% renewable generation is the net-zero interim goal in the Premier’s report on the energy mix "
              "and electricity prices to the Legislative Yuan (29 Oct 2024); the earlier goal was 20% by 2025 (Ministry of "
              "Economic Affairs, Energy Transition Pathway Plan, 13 Jun 2017).")


def target_shares() -> tuple[dict[str, float], dict[str, str], set[str]]:
    """各國 2030 年再生能源發電占比目標（%）：取 Ember 標記採用（INCLUDE_IN_TOOL）的最新文件，
    有「Renewables」那一列就用它，沒有就加總再生能源各類；1 以下的是小數（有的文件寫 0.95），換成 %。
    不用 share_target_wide 彙總表：它會把不同文件的數字加在一起（比利時 64.9＋Ember 推估 51 = 115.9、愛沙尼亞 100＋0.9）。
    回傳 (目標, 來源類型, 只有容量目標的國家)"""
    import openpyxl

    path = download(TARGETS_URL, "ember", "targets_download.xlsx")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    raw = list(wb["raw_data_long"].iter_rows(values_only=True))[1:]
    sources = {r[0]: r for r in list(wb["sources"].iter_rows(values_only=True))[1:]}
    # 只收 Ember 自己的占比目標表有列的國家（英國只有一份沒採用的 2023 年推估，Ember 只列容量目標）
    listed = {r[0] for r in list(wb["share_target_wide"].iter_rows(values_only=True))[1:]}
    shares: dict[str, dict[int, dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
    has_capacity: set[str] = set()
    for code, year, fuel, metric, value, sid, *_ in raw:
        if year != TARGET_YEAR or value is None:
            continue
        if metric == "share_of_generation_pct":
            shares[code][sid][fuel] = value
        elif metric == "capacity_total_gw" and fuel in RENEWABLE_FUELS:
            has_capacity.add(code)
    out: dict[str, float] = {}
    kinds: dict[str, str] = {}
    for code, by_source in shares.items():
        iso3 = to_iso3(code)
        if not iso3 or code not in listed:
            continue
        candidates = []
        for sid, fuels in by_source.items():
            if "Renewables" in fuels:
                total = fuels["Renewables"]
            else:
                keys = [f for f in fuels if f in RENEWABLE_FUELS]
                if "Wind" in keys:
                    keys = [f for f in keys if f not in ("Onshore Wind", "Offshore Wind")]
                if not keys:
                    continue
                total = sum(fuels[f] for f in keys)
                if all(fuels[f] <= 1 for f in fuels):
                    total *= 100
            if total <= 1:
                total *= 100
            src = sources[sid]
            candidates.append((bool(src[9]), str(src[5] or ""), total, src[4]))
        if not candidates:
            continue
        _, _, total, kind = max(candidates)
        out[iso3] = round(total, 1)
        kinds[iso3] = kind
    only_capacity = {to_iso3(c) for c in has_capacity} - set(out) - {None}
    return out, kinds, only_capacity


def build_targets(out, actual: dict[str, dict[int, float]]) -> None:
    targets, kinds, only_capacity = target_shares()
    targets["TWN"] = TW_TARGET
    hints, hints_en, gaps, gap_hints, gap_hints_en = {}, {}, {}, {}, {}
    for iso3, value in targets.items():
        if kinds.get(iso3) in SOURCE_HINTS:
            hints[iso3], hints_en[iso3] = SOURCE_HINTS[kinds[iso3]]
        latest = max((y for y in actual.get(iso3, {}) if y <= 2025), default=None)
        if latest is not None:
            now = actual[iso3][latest]
            gaps[iso3] = [round(value - now, 1)]
            gap_hints[iso3] = f"{TARGET_YEAR} 年目標 {value:g}%，{latest} 年 {now:.1f}%"
            gap_hints_en[iso3] = f"{TARGET_YEAR} target {value:g}%, {latest}: {now:.1f}%"
    notes = {iso3: "只有再生能源的裝置容量目標，沒有發電占比的目標" for iso3 in sorted(only_capacity)}
    notes_en = {iso3: "Has a renewable capacity target only, no generation-share target" for iso3 in sorted(only_capacity)}
    write_json(out / "renewables-target.json", indicator_file(
        "renewables-target", "%", [TARGET_YEAR], {k: [v] for k, v in sorted(targets.items())},
        hints=hints, hintsEn=hints_en, notes={**notes, "TWN": TW_NOTE}, notesEn={**notes_en, "TWN": TW_NOTE_EN}))
    write_json(out / "renewables-gap.json", indicator_file(
        "renewables-gap", "pp", [TARGET_YEAR], dict(sorted(gaps.items())),
        hints=gap_hints, hintsEn=gap_hints_en, notes={"TWN": TW_NOTE}, notesEn={"TWN": TW_NOTE_EN}))
    print(f"  2030 年再生能源占比目標 {len(targets)} 國（含台灣）、差距 {len(gaps)} 國；只有容量目標 {len(only_capacity)} 國；"
          f"Ember 推估或第三方 {sorted(k for k in hints)}")


def build_access(out) -> None:
    """電力普及率（%）與沒有電的人數（普及率 × 人口，世界銀行 WDI）"""
    from sources import worldbank

    access, access_world = worldbank.fetch("EG.ELC.ACCS.ZS", 1990, 2025)
    population, population_world = worldbank.fetch("SP.POP.TOTL", 1990, 2025)
    years = sorted({y for s in access.values() for y in s})
    without = {iso3: {y: (100 - v) / 100 * population[iso3][y] for y, v in s.items() if y in population.get(iso3, {})}
               for iso3, s in access.items()}
    world_without = {y: (100 - v) / 100 * population_world[y] for y, v in access_world.items() if y in population_world}
    note = "WDI（世界銀行）不含台灣，台灣也沒有同樣定義（家戶調查）的電力普及率"
    note_en = "The World Bank’s WDI does not cover Taiwan, and Taiwan has no access rate on the same (household survey) basis"
    write_json(out / "access.json", indicator_file(
        "access", "%", years, {k: to_series(v, years, 1) for k, v in access.items()},
        aggregates={"WLD": to_series(access_world, years, 1)}, notes={"TWN": note}, notesEn={"TWN": note_en}))
    write_json(out / "without-access.json", indicator_file(
        "without-access", "people", years, {k: to_series(v, years, -3) for k, v in without.items()},
        aggregates={"WLD": to_series(world_without, years, -3)}, notes={"TWN": note}, notesEn={"TWN": note_en}))
    last = max(y for y in access_world)
    print(f"  電力普及率 {len(access)} 國，{years[0]}–{years[-1]}；世界 {last} 年 {access_world[last]:.1f}%、"
          f"沒有電 {world_without[last] / 1e6:.0f} 百萬人")
