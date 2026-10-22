"""氣候主題：各國 CO₂ 排放（Our World in Data 整理的 Global Carbon Project 資料，CC BY 4.0，含台灣）。

只算化石燃料與工業（水泥、燃除等）的排放，不含土地利用變化。
消費端排放是把進出口商品隱含的排放算給消費國，1990 年起。
每單位 GDP 的排放用 Maddison Project 的 GDP，目前只到 2022 年。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import owid

FIRST_YEAR = 1850

# 輸出檔名 -> (OWID 欄位, 單位, 換算倍數, 小數位數)；OWID 的總量單位是百萬公噸
INDICATORS = {
    "co2": ("co2", "公噸", 1e6, 0),
    "co2-per-capita": ("co2_per_capita", "公噸/人", 1, 2),
    "cumulative-co2": ("cumulative_co2", "公噸", 1e6, 0),
    "consumption-co2-per-capita": ("consumption_co2_per_capita", "公噸/人", 1, 2),
    "co2-per-gdp": ("co2_per_gdp", "公斤/國際元", 1, 3),
}

# 側欄的排放來源（百萬公噸），由下而上的堆疊順序
SOURCES = {
    "coal": "coal_co2",
    "gas": "gas_co2",
    "oil": "oil_co2",
    "cement": "cement_co2",
    "flaring": "flaring_co2",
    "other": "other_industry_co2",
}


def build() -> None:
    series: dict[str, dict[str, dict[int, float]]] = {key: defaultdict(dict) for key in INDICATORS}
    by_source: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for iso3, year, row in owid.co2_rows():
        if year < FIRST_YEAR:
            continue
        for key, (col, _unit, scale, _digits) in INDICATORS.items():
            if row[col]:
                series[key][iso3][year] = float(row[col]) * scale
        if iso3 != "WLD" and row["co2"]:
            for source, col in SOURCES.items():
                if row[col]:
                    by_source[iso3][source][year] = float(row[col])

    out = OUT_DIR / "topics" / "climate"
    for key, (_col, unit, _scale, digits) in INDICATORS.items():
        data = series[key]
        world = data.pop("WLD", {})
        years = [y for y in year_span(data, 0.1) if y >= FIRST_YEAR]
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso3: to_series(s, years, digits) for iso3, s in data.items()},
                aggregates={"WLD": to_series(world, years, digits)},
            ),
        )

    # 側欄：各國每年各排放來源（百萬公噸），從有資料的第一年開始
    for iso3, sources in by_source.items():
        first = min(y for s in sources.values() for y in s)
        last = max(y for s in sources.values() for y in s)
        years = list(range(first, last + 1))
        write_json(
            out / "countries" / f"{iso3}.json",
            {"years": years, "sources": list(SOURCES), "values": {k: to_series(sources.get(k, {}), years, 3) for k in SOURCES}},
            quiet=True,
        )
    print(f"  {len(by_source)} 個國家的排放來源")
    write_json(
        out / "manifest.json",
        {"topic": "climate", "generatedAt": now_iso(), "source": "Our World in Data, CO₂ and Greenhouse Gas Emissions (Global Carbon Project)"},
    )
