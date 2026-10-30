"""觀光主題：國際旅客人次、觀光收入、觀光收入占出口（World Bank WDI 轉載的 UN Tourism 資料）。

WDI 的觀光資料只到 2020 年（metadata 寫 Referenceperiod 1995-2020，不會再更新）。UN Tourism 自己的資料庫
有更新的年份，但條款禁止轉載（只限個人使用），所以只用世界銀行以 CC BY 4.0 轉載的部分。
台灣用交通部觀光署的來臺旅客人次，以及中央銀行國際收支的旅行收入加客運收入（跟 WDI 的定義相同）。

另有旅行收入與旅行收入占出口（DESIGN.md 第 8 節第 211 點）：WDI 轉載的 IMF 國際收支，到最新一年。
旅行收入 = BX.GSR.TRVL.ZS（旅行占服務出口 %）× BX.GSR.NFSV.CD（服務出口），占出口再除以
BX.GSR.GNFS.CD（商品與服務出口）。IMF 的旅行不含國際客運，跟上面的觀光收入不能直接接起來比；
台灣用中央銀行國際收支的旅行收入（不加客運）。
"""
from __future__ import annotations

from common import append_note, later_years_note, OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import cbc, taiwan_tourism, worldbank, wpp

TRAVEL, PASSENGER = "服務-旅行-收入", "服務-運輸-客運-收入"
GOODS, SERVICES = "商品-收入", "服務-收入"

NOTES = {
    "arrivals": "台灣不在世界銀行資料庫中，改用交通部觀光署的來臺旅客人次（含華僑，不含持中華民國護照入境者）",
    "receipts": "台灣不在世界銀行資料庫中，改用中央銀行國際收支的旅行收入加客運收入",
    "receipts-exports": "台灣不在世界銀行資料庫中，改用中央銀行國際收支計算：旅行加客運收入 ÷ 商品與服務出口",
    "arrivals-per-capita": "台灣的旅客人次來自交通部觀光署，人口來自聯合國",
    "travel": "台灣不在世界銀行資料庫中，改用中央銀行國際收支的旅行收入",
    "travel-exports": "台灣不在世界銀行資料庫中，改用中央銀行國際收支計算：旅行收入 ÷ 商品與服務出口",
}
NOTES_EN = {
    "arrivals": (
        "Taiwan is not in the World Bank database; visitor arrivals from the Tourism Administration used instead "
        "(including overseas Chinese, excluding travellers entering on ROC passports)"
    ),
    "receipts": (
        "Taiwan is not in the World Bank database; travel plus passenger transport receipts from the central bank's "
        "balance of payments used instead"
    ),
    "receipts-exports": (
        "Taiwan is not in the World Bank database; calculated from the central bank's balance of payments: "
        "travel plus passenger transport receipts ÷ exports of goods and services"
    ),
    "arrivals-per-capita": "Taiwan's arrivals come from the Tourism Administration and its population from the UN",
    "travel": "Taiwan is not in the World Bank database; travel receipts from the central bank's balance of payments used instead",
    "travel-exports": (
        "Taiwan is not in the World Bank database; calculated from the central bank's balance of payments: "
        "travel receipts ÷ exports of goods and services"
    ),
}


def taiwan_series() -> dict[str, dict[int, float]]:
    bop = cbc.balance_of_payments([TRAVEL, PASSENGER, GOODS, SERVICES])
    receipts = {y: (v + bop[PASSENGER].get(y, 0)) * 1e6 for y, v in bop[TRAVEL].items()}
    exports = {y: (v + bop[SERVICES][y]) * 1e6 for y, v in bop[GOODS].items() if y in bop[SERVICES]}
    travel = {y: v * 1e6 for y, v in bop[TRAVEL].items()}
    return {
        "arrivals": dict(taiwan_tourism.visitor_arrivals()),
        "receipts": receipts,
        "receipts-exports": {y: v / exports[y] * 100 for y, v in receipts.items() if exports.get(y)},
        "travel": travel,
        "travel-exports": {y: v / exports[y] * 100 for y, v in travel.items() if exports.get(y)},
    }


def build_travel(out, taiwan: dict[str, dict[int, float]]) -> None:
    """旅行收入（美元）與旅行收入占出口（%）：WDI 轉載的 IMF 國際收支，到最新一年"""
    share, share_world = worldbank.fetch("BX.GSR.TRVL.ZS", 1995)
    services, services_world = worldbank.fetch("BX.GSR.NFSV.CD", 1995)
    exports, exports_world = worldbank.fetch("BX.GSR.GNFS.CD", 1995)

    def travel_usd(sh: dict[int, float], sv: dict[int, float]) -> dict[int, float]:
        return {y: v / 100 * sv[y] for y, v in sh.items() if sv.get(y)}

    def of_exports(tr: dict[int, float], ex: dict[int, float]) -> dict[int, float]:
        return {y: v / ex[y] * 100 for y, v in tr.items() if ex.get(y)}

    travel = {iso3: travel_usd(s, services.get(iso3, {})) for iso3, s in share.items()}
    travel_world = travel_usd(share_world, services_world)
    ratio = {iso3: of_exports(s, exports.get(iso3, {})) for iso3, s in travel.items()}
    ratio_world = of_exports(travel_world, exports_world)
    travel["TWN"], ratio["TWN"] = taiwan["travel"], taiwan["travel-exports"]
    for key, series, world, unit, digits in [
        ("travel", travel, travel_world, "美元", 0),
        ("travel-exports", ratio, ratio_world, "%", 2),
    ]:
        series = {iso3: s for iso3, s in series.items() if s}
        years = year_span(series)
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso3: to_series(s, years, digits) for iso3, s in series.items()},
                aggregates={"WLD": to_series(world, years, digits)} if world else {},
                notes={"TWN": NOTES[key]},
                notesEn={"TWN": NOTES_EN[key]},
            ),
        )


def build() -> None:
    out = OUT_DIR / "topics" / "tourism"
    taiwan = taiwan_series()
    arrivals = None
    for key, (code, unit, digits) in {
        "arrivals": ("ST.INT.ARVL", "人次", 0),
        "receipts": ("ST.INT.RCPT.CD", "美元", 0),
        "receipts-exports": ("ST.INT.RCPT.XP.ZS", "%", 2),
    }.items():
        countries, world = worldbank.fetch(code, 1995)
        countries["TWN"] = taiwan[key]
        if key == "arrivals":
            arrivals = (countries, world)
        years = year_span(countries)
        notes, notes_en = {"TWN": NOTES[key]}, {"TWN": NOTES_EN[key]}
        if key == "arrivals":  # 觀光署比時間軸更新的年份寫在附註（製作手冊第八批 159）
            append_note(notes, notes_en, "TWN", later_years_note(
                taiwan[key], years, lambda v: f"{v / 1e4:,.0f} 萬人次", lambda v: f"{v / 1e6:,.2f} million arrivals"))
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso3: to_series(s, years, digits) for iso3, s in countries.items() if s},
                aggregates={"WLD": to_series(world, years, digits)},
                notes=notes,
                notesEn=notes_en,
            ),
        )

    # 旅客人次 ÷ 人口：觀光對小國的分量
    countries, world = arrivals
    population = wpp.demographic(["TPopulation1July"])["TPopulation1July"]  # 千人
    ratio = {
        iso3: {y: v / (population[iso3][y] * 1000) for y, v in s.items() if population.get(iso3, {}).get(y)}
        for iso3, s in countries.items()
    }
    world_ratio = {y: v / (population["WLD"][y] * 1000) for y, v in world.items() if y in population["WLD"]}
    years = year_span(ratio)
    notes, notes_en = {"TWN": NOTES["arrivals-per-capita"]}, {"TWN": NOTES_EN["arrivals-per-capita"]}
    append_note(notes, notes_en, "TWN", later_years_note(
        ratio.get("TWN", {}), years, lambda v: f"每人 {v:.3f} 人次", lambda v: f"{v:.3f} arrivals per person"))
    write_json(
        out / "arrivals-per-capita.json",
        indicator_file(
            "arrivals-per-capita", "人次/人", years, {iso3: to_series(s, years, 3) for iso3, s in ratio.items() if s},
            aggregates={"WLD": to_series(world_ratio, years, 3)},
            notes=notes,
            notesEn=notes_en,
        ),
    )
    build_travel(out, taiwan)
    write_json(
        out / "manifest.json",
        {"topic": "tourism", "generatedAt": now_iso(), "source": "World Bank WDI (UN Tourism; IMF BOP); 交通部觀光署; 中央銀行; UN WPP 2024"},
    )
