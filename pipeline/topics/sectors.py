"""產業結構主題：農業／工業／服務業占 GDP 與占就業的比重。

各國用 World Bank WDI；WDI 沒有台灣，台灣用主計總處的各業 GDP 與就業人口自行計算，
口徑跟 WDI 一致：各業附加價值 ÷ GDP（市場價格），所以三者加總略小於 100%（差額是產品稅）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import dgbas, worldbank

FIRST_YEAR = 1960
TAIWAN_NOTE = "台灣不在世界銀行資料庫中，改用行政院主計總處資料計算"

# 輸出檔名 -> World Bank 代碼
INDICATORS = {
    "agriculture": "NV.AGR.TOTL.ZS",
    "industry": "NV.IND.TOTL.ZS",
    "manufacturing": "NV.IND.MANF.ZS",
    "services": "NV.SRV.TOTL.ZS",
    "employment-agriculture": "SL.AGR.EMPL.ZS",
    "employment-industry": "SL.IND.EMPL.ZS",
    "employment-services": "SL.SRV.EMPL.ZS",
}


def taiwan_series() -> dict[str, dict[int, float]]:
    out: dict[str, dict[int, float]] = {key: {} for key in INDICATORS}
    for year, v in dgbas.gdp_by_industry().items():
        gdp = v.get("GDP")
        if not gdp or "按三級產業分:工業" not in v:
            continue
        agriculture = v["A.農、林、漁、牧業"]
        industry = v["按三級產業分:工業"]
        out["agriculture"][year] = agriculture / gdp * 100
        out["industry"][year] = industry / gdp * 100
        out["manufacturing"][year] = v["C.製造業"] / gdp * 100
        # 「合計」是各業附加價值總和，不含進口稅與加值型營業稅（主計總處把這兩項算在服務業）
        if "合計" in v:
            out["services"][year] = (v["合計"] - agriculture - industry) / gdp * 100
    for year, e in dgbas.employment_by_sector().items():
        for sector in ("agriculture", "industry", "services"):
            out[f"employment-{sector}"][year] = e[sector] / e["total"] * 100
    return out


def build() -> None:
    out = OUT_DIR / "topics" / "sectors"
    taiwan = taiwan_series()
    years_seen: set[int] = set()
    series_by_key = {}
    for key, code in INDICATORS.items():
        countries, world = worldbank.fetch(code, FIRST_YEAR)
        countries["TWN"] = taiwan[key]
        series_by_key[key] = (countries, world)
        years_seen |= {y for s in countries.values() for y in s}

    years = list(range(FIRST_YEAR, max(years_seen) + 1))
    for key, (countries, world) in series_by_key.items():
        values = {iso3: to_series(s, years, 2) for iso3, s in countries.items() if s}
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, "%", years, values,
                aggregates={"WLD": to_series(world, years, 2)},
                notes={"TWN": TAIWAN_NOTE},
            ),
        )
    write_json(
        out / "manifest.json",
        {"topic": "sectors", "generatedAt": now_iso(), "source": "World Bank WDI; 行政院主計總處"},
    )
