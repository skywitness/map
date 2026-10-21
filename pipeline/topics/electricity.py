"""發電量主題：Ember Yearly Electricity Data（CC BY 4.0，2000 年起，含台灣）。"""
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
    "carbon-intensity": (("Power sector emissions", "CO2 intensity", "CO2 intensity", "gCO2/kWh"), "gCO₂/kWh", 1, 0),
}

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
        write_json(
            out / f"{key}.json",
            indicator_file(key, unit, years, {a: scaled(s) for a, s in data.items()}, aggregates={"WLD": scaled(world)}),
        )

    # 側欄：各國每年各能源發電量（TWh）
    for area, fuels in mix.items():
        write_json(
            out / "countries" / f"{area}.json",
            {"years": years, "fuels": FUEL_ORDER, "values": {f: to_series(fuels.get(f, {}), years, 2) for f in FUEL_ORDER}},
            quiet=True,
        )
    print(f"  {len(mix)} 個國家的發電結構")
    write_json(out / "manifest.json", {"topic": "electricity", "generatedAt": now_iso(), "source": "Ember"})
