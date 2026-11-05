"""人口主題：UN World Population Prospects 2024（中推估）。

一個檔案就涵蓋 1950–2023 的估計值與 2024–2100 的推估值，並且有台灣。
"""
from __future__ import annotations

from collections.abc import Callable

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import wpp

WPP_URL = (
    "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/"
    "CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz"
)
FIRST_YEAR, LAST_YEAR = 1950, 2100
PROJECTION_FROM = 2024  # WPP 2024：2023 年以前是估計值，之後是推估值

# 輸出檔名 -> (WPP 欄位, 單位, 換算函式)
INDICATORS: dict[str, tuple[str, str, Callable[[float], float]]] = {
    "total": ("TPopulation1July", "人", lambda v: round(v * 1000)),  # 原始單位是千人
    "density": ("PopDensity", "人/km²", lambda v: round(v, 1)),
    "growth": ("PopGrowthRate", "%", lambda v: round(v, 2)),
    "median-age": ("MedianAgePop", "歲", lambda v: round(v, 1)),
    # 2026-11-04（主題盤點的擴1）：出生時的性別比（每百名女嬰的男嬰數）、自然增加率與淨遷移率（每千人）
    "sex-ratio-birth": ("SRB", "男嬰/百名女嬰", lambda v: round(v, 1)),
    "natural-change": ("NatChangeRT", "‰", lambda v: round(v, 2)),
    "net-migration": ("CNMR", "‰", lambda v: round(v, 2)),
}

COUNTRY = "4"  # LocTypeID：Country/Area
WORLD = "1"


def build() -> None:
    years = list(range(FIRST_YEAR, LAST_YEAR + 1))
    series: dict[str, dict[str, list]] = {k: {} for k in INDICATORS}
    world: dict[str, list] = {k: [None] * len(years) for k in INDICATORS}

    for row in wpp.rows("indicators"):
        loc_type = row["LocTypeID"]
        year = int(row["Time"])
        if loc_type not in (COUNTRY, WORLD) or not FIRST_YEAR <= year <= LAST_YEAR:
            continue
        iso3 = row["ISO3_code"]
        if loc_type == COUNTRY and not iso3:
            continue
        i = year - FIRST_YEAR
        for key, (col, _unit, convert) in INDICATORS.items():
            raw = row[col]
            value = convert(float(raw)) if raw else None
            if loc_type == WORLD:
                world[key][i] = value
            else:
                series[key].setdefault(iso3, [None] * len(years))[i] = value

    out = OUT_DIR / "topics" / "population"
    for key, (_col, unit, _convert) in INDICATORS.items():
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, series[key],
                projectionFrom=PROJECTION_FROM,
                aggregates={"WLD": world[key]},
            ),
        )
    write_json(
        out / "manifest.json",
        {
            "topic": "population",
            "generatedAt": now_iso(),
            "source": "UN World Population Prospects 2024, Medium variant",
            "sourceUrl": WPP_URL,
            "years": [FIRST_YEAR, LAST_YEAR],
            "projectionFrom": PROJECTION_FROM,
            "countries": sorted(series["total"]),
        },
    )
    print(f"  共 {len(series['total'])} 個國家/區域")

