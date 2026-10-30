"""貿易依存度（貿易主題的擴充，2026-10-30，製作手冊第六批 97）：商品與服務的出口加進口占 GDP（%）。

- 世界銀行 WDI NE.TRD.GNFS.ZS（CC BY 4.0），1960 年起。
- 台灣（WDI 沒有）：主計總處國民所得統計的支出面 GDP（政府資料開放授權條款－第 1 版），
  （商品及服務輸出＋輸入）÷ GDP，當期價格，1951 年起（sources/dgbas_expenditure.py）。
- 世界合計：最新一年國家數不全（2025 年只有約 140 國，沒有美國，世界值跳到 68.5%），涵蓋國家不到高峰八成的年份不放。

輸出 topics/trade/trade-gdp.json。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, to_series, write_json, year_span
from sources import dgbas_expenditure, worldbank

CODE = "NE.TRD.GNFS.ZS"
WORLD_MIN_SHARE = 0.8

NOTES = {
    "TWN": (
        "台灣：主計總處國民所得統計（支出面，當期價格），商品及服務輸出加輸入除以 GDP，自行計算。",
        "Taiwan: computed from DGBAS national accounts (expenditure approach, current prices) as exports plus imports of goods and services divided by GDP.",
    ),
    "SDN": (
        "2021 年起只剩 2–4%（2019 年 26%、2020 年 10%），跟 2021 年匯率改革前後的本國貨幣換算有關，世界銀行的原始值明顯偏低，僅供參考。",
        "From 2021 the ratio drops to 2–4% (26% in 2019, 10% in 2020), apparently a currency-conversion artefact around the 2021 exchange-rate reform; the World Bank figure is clearly too low.",
    ),
    "HKG": (
        "香港、新加坡超過 300% 是轉口貿易：進口後再出口的貨物進出各算一次，不代表經濟「依賴」貿易的程度。",
        "Hong Kong and Singapore exceed 300% because of re-exports: goods imported and shipped on are counted on both sides.",
    ),
    "SGP": (
        "香港、新加坡超過 300% 是轉口貿易：進口後再出口的貨物進出各算一次，不代表經濟「依賴」貿易的程度。",
        "Hong Kong and Singapore exceed 300% because of re-exports: goods imported and shipped on are counted on both sides.",
    ),
}


def build() -> None:
    out = OUT_DIR / "topics" / "trade"
    countries, world = worldbank.fetch(CODE, 1960)
    taiwan = dgbas_expenditure.trade_share_of_gdp()
    countries["TWN"] = {y: v for y, v in taiwan.items() if y >= 1960}
    years = year_span(countries)

    counts = Counter(y for s in countries.values() for y in s)
    full = [y for y, n in counts.items() if n >= WORLD_MIN_SHARE * max(counts.values())]
    world = {y: v for y, v in world.items() if min(full) <= y <= max(full)}
    write_json(
        out / "trade-gdp.json",
        indicator_file(
            "trade-gdp", "%", years,
            {iso3: to_series(s, years, 1) for iso3, s in countries.items() if s},
            aggregates={"WLD": to_series(world, years, 1)},
            notes={k: zh for k, (zh, _) in NOTES.items()},
            notesEn={k: en for k, (_, en) in NOTES.items()},
        ),
    )
    last = max(full)
    ranked = sorted(((s[last], k) for k, s in countries.items() if last in s), reverse=True)
    print(f"  {years[0]}–{years[-1]}，世界合計到 {last} 年（{world.get(last, 0):.1f}%）；"
          f"{last} 年最高 {[(k, round(v)) for v, k in ranked[:5]]}，台灣 {taiwan.get(last, 0):.1f}%")
