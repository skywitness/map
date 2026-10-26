"""氣候主題：各國溫室氣體排放。

- 二氧化碳（化石燃料與水泥等工業）：Global Carbon Project（GCP），Our World in Data 整理的 co2-data（CC BY 4.0，含台灣），
  1850–2024 年。累積排放、消費端排放、每單位 GDP 排放、土地利用變化的 CO₂ 也是 GCP。
- 甲烷、氧化亞氮、含氟氣體：EDGAR 2026 年版（歐盟 JRC，CC BY 4.0），1970–2025 年（含氟氣體 1990–2024 年），
  見 sources/edgar.py。EDGAR 的二氧化碳是 CC BY-NC-ND 4.0（IEA-EDGAR CO₂），不用。
- 全部溫室氣體 = GCP 的二氧化碳 + EDGAR 的甲烷、氧化亞氮、含氟氣體，1990–2024 年（含氟氣體從 1990 年才有）。
  CO₂ 當量用 IPCC AR5 的 GWP-100（甲烷化石 30、生物 28，氧化亞氮 265），跟 EDGAR 一樣。不含土地利用變化（LULUCF）。
- 人均：二氧化碳沿用 OWID 的人均（GCP ÷ OWID 的人口），其他用 UN WPP 2024 的年中人口（2024、2025 年是推估）。
  EDGAR 併在一起計算的國家（南蘇丹併在蘇丹等，edgar.MEMBERS）用合計的人口，全部溫室氣體也把它們的 CO₂ 加起來。
- 側欄（countries/<ISO3>.json）：GCP 的二氧化碳依燃料、EDGAR 的其他氣體依部門、CEDS 的燃料燃燒 CO₂ 用途（只看比例），
  台灣另有環境部國家溫室氣體排放清冊（政府資料開放授權條款）的各氣體與碳匯。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import ceds, edgar, moenv, owid, wpp

FIRST_YEAR = 1850
GHG_FIRST_YEAR = 1990  # 含氟氣體 1990 年起
INVENTORY_YEAR = 2024  # 環境部清冊最新一年（2026 年版）

# 輸出檔名 -> (OWID 欄位, 單位, 換算倍數, 小數位數)；OWID 的總量單位是百萬公噸
# co2.json、co2-per-capita.json 也是「年排放量」「人均排放」選二氧化碳時的檔（{item}.json、{item}-per-capita.json）
OWID_INDICATORS = {
    "co2": ("co2", "公噸", 1e6, 0),
    "co2-per-capita": ("co2_per_capita", "公噸/人", 1, 2),
    "cumulative-co2": ("cumulative_co2", "公噸", 1e6, 0),
    "consumption-co2-per-capita": ("consumption_co2_per_capita", "公噸/人", 1, 2),
    "co2-per-gdp": ("co2_per_gdp", "公斤/國際元", 1, 3),
    "luc-co2-per-capita": ("land_use_change_co2_per_capita", "公噸/人", 1, 2),
}

# 側欄的二氧化碳來源（GCP，百萬公噸），由下而上的堆疊順序
CO2_SOURCES = {
    "coal": "coal_co2",
    "gas": "gas_co2",
    "oil": "oil_co2",
    "cement": "cement_co2",
    "flaring": "flaring_co2",
    "other": "other_industry_co2",
}
GASES = ["ghg", "co2", "ch4", "n2o", "fgas"]
EDGAR_GASES = ["ch4", "n2o", "fgas"]
GAS_ZH = {"ghg": "溫室氣體", "co2": "二氧化碳", "ch4": "甲烷", "n2o": "氧化亞氮", "fgas": "含氟氣體"}
GAS_EN = {"ghg": "greenhouse gases", "co2": "CO₂", "ch4": "methane", "n2o": "nitrous oxide", "fgas": "F-gases"}

# 環境部《2026 年中華民國國家溫室氣體排放清冊報告》執行摘要表 ES2.3（2024 年，千公噸 CO₂e，甲烷用 GWP 28）：
# 開放資料只有各氣體的合計，部門別只在報告裡，引用數字放在附註
# 掩埋（5.A）1998 年是 10,962（最高）
# 表 ES2.5（2024 年含氟氣體，千公噸 CO₂e）：電子業 2.E（HFCs 120、PFCs 876、SF₆ 359、NF₃ 695），臭氧層破壞物質的替代品 2.F
INVENTORY_FGAS_2024 = {"electronics": 120 + 876 + 359 + 695, "ods": 1687, "total": 3920}
INVENTORY_CH4_2024 = {"waste": 1431, "landfill": 538, "solidwaste": 538 + 26, "wastewater": 867, "agriculture": 2014, "energy": 878}

MERGED_ZH = {"SDN": "南蘇丹", "ISR": "巴勒斯坦", "SRB": "蒙特內哥羅與科索沃", "CHE": "列支敦斯登", "FRA": "摩納哥",
             "ESP": "安道爾", "ITA": "聖馬利諾與梵蒂岡"}
MERGED_EN = {"SDN": "South Sudan", "ISR": "Palestine", "SRB": "Montenegro and Kosovo", "CHE": "Liechtenstein",
             "FRA": "Monaco", "ESP": "Andorra", "ITA": "San Marino and Vatican City"}

Series = dict[int, float]


def zh_t(t: float) -> str:
    """公噸 → 「2.73 億公噸」「435 萬公噸」"""
    # 四捨五入（Python 的格式化是逢五取偶，4,345 千公噸會變成 434 萬）
    if abs(t) >= 1e8:
        return f"{t / 1e8:.2f} 億公噸"
    return f"{int(t / 1e4 + (0.5 if t >= 0 else -0.5)):,} 萬公噸"


def en_t(t: float) -> str:
    return f"{t / 1e6:,.1f} Mt"


def pct(a: float, b: float) -> str:
    """a 比 b 多（少）多少，帶正負號"""
    return f"{(a / b - 1) * 100:+.1f}%"


def more_zh(a: float, b: float) -> str:
    """「多 4.8%」「少 7.0%」「是 3.6 倍」"""
    r = a / b
    return f"是 {r:.1f} 倍" if r >= 2 else f"{'多' if r >= 1 else '少'} {abs(r - 1) * 100:.1f}%"


def more_en(a: float, b: float) -> str:
    r = a / b
    return f"{r:.1f} times as much" if r >= 2 else f"{abs(r - 1) * 100:.1f}% {'higher' if r >= 1 else 'lower'}"


def build() -> None:
    out = OUT_DIR / "topics" / "climate"
    rows = owid.co2_rows()

    # ── GCP（OWID）的指標與側欄的二氧化碳來源 ──
    gcp: dict[str, dict[str, Series]] = {key: defaultdict(dict) for key in OWID_INDICATORS}
    by_source: dict[str, dict[str, Series]] = defaultdict(lambda: defaultdict(dict))
    for iso3, year, row in rows:
        if year < FIRST_YEAR:
            continue
        for key, (col, _unit, scale, _digits) in OWID_INDICATORS.items():
            if row[col]:
                gcp[key][iso3][year] = float(row[col]) * scale
        if iso3 != "WLD" and row["co2"]:
            for source, col in CO2_SOURCES.items():
                if row[col]:
                    by_source[iso3][source][year] = float(row[col]) * 1e6

    # ── EDGAR 的甲烷、氧化亞氮、含氟氣體 ──
    em = edgar.emissions()
    totals: dict[str, dict[str, Series]] = {gas: em.totals(gas) for gas in EDGAR_GASES}
    world: dict[str, Series] = {gas: em.world[gas] for gas in EDGAR_GASES}
    # 含氟氣體 2025 年還沒有（EDGAR 的欄位是空的），EDGAR 沒有估計含氟氣體的國家在合計裡當成 0
    totals["co2"] = gcp["co2"]
    world["co2"] = totals["co2"].pop("WLD")

    # 全部溫室氣體：GCP 的 CO₂（併在一起計算的國家把成員的 CO₂ 加起來）+ EDGAR，1990 年起、兩邊都有的年份
    ghg: dict[str, Series] = {}
    for iso3 in set(totals["ch4"]) & set(totals["n2o"]):
        members = edgar.MEMBERS.get(iso3, [iso3])
        series: Series = {}
        for y in range(GHG_FIRST_YEAR, max(world["fgas"]) + 1):
            if y not in totals["co2"].get(iso3, {}) or y not in totals["ch4"][iso3] or y not in totals["n2o"][iso3]:
                continue
            co2 = sum(totals["co2"].get(m, {}).get(y, 0.0) for m in members)
            series[y] = co2 + totals["ch4"][iso3][y] + totals["n2o"][iso3][y] + totals["fgas"].get(iso3, {}).get(y, 0.0)
        if series:
            ghg[iso3] = series
    totals["ghg"] = ghg
    world["ghg"] = {
        y: world["co2"][y] + world["ch4"][y] + world["n2o"][y] + world["fgas"][y]
        for y in range(GHG_FIRST_YEAR, max(world["fgas"]) + 1)
        if y in world["co2"]
    }

    # 人口（人）：WPP 2024，到 2025 年；併在一起計算的國家用合計
    wpp_pop = wpp.demographic(["TPopulation1July"], last_year=2025)["TPopulation1July"]

    def population(iso3: str, year: int) -> float | None:
        members = edgar.MEMBERS.get(iso3, [iso3])
        values = [wpp_pop.get(m, {}).get(year) for m in members]
        if values[0] is None:
            return None
        return sum(v for v in values if v is not None) * 1000

    per_capita: dict[str, dict[str, Series]] = {"co2": gcp["co2-per-capita"]}
    world_pc: dict[str, Series] = {"co2": per_capita["co2"].pop("WLD")}
    for gas in ("ghg", "ch4", "n2o", "fgas"):
        per_capita[gas] = {}
        for iso3, series in totals[gas].items():
            pc = {y: v / p for y, v in series.items() if (p := population(iso3, y))}
            if pc:
                per_capita[gas][iso3] = pc
        world_pc[gas] = {y: v / (wpp_pop["WLD"][y] * 1000) for y, v in world[gas].items() if y in wpp_pop["WLD"]}

    # ── 環境部清冊（台灣的對照） ──
    inventory = moenv.ghg_inventory()
    notes, notes_en, hints, hints_en = taiwan_notes(inventory, totals, em, population)
    for host, members in edgar.MEMBERS.items():
        for gas in ("ghg", "ch4", "n2o", "fgas"):
            zh, en = MERGED_ZH[host], MERGED_EN[host]
            extra = f"；全部溫室氣體也加上{zh}的二氧化碳" if gas == "ghg" else ""
            extra_en = f"; the all-gas total also adds the CO₂ of {en}" if gas == "ghg" else ""
            notes[gas].setdefault(host, f"含{zh}：EDGAR 沒有把它們分開計算，人均用合計的人口{extra}。")
            notes_en[gas].setdefault(host, f"Includes {en}, which EDGAR does not report separately; per-person values use the combined population{extra_en}.")

    # ── 輸出指標檔 ──
    units = {"total": "公噸 CO₂e", "pc": "公噸 CO₂e/人"}
    for gas in GASES:
        for kind, data, wdata, name, digits in (
            ("total", totals[gas], world[gas], f"{gas}.json", 0),
            ("pc", per_capita[gas], world_pc[gas], f"{gas}-per-capita.json", 3),
        ):
            if gas == "co2":
                years = [y for y in year_span(data, 0.1) if y >= FIRST_YEAR]
                unit = "公噸" if kind == "total" else "公噸/人"
                digits = 0 if kind == "total" else 2
            else:
                years = year_span(data, 0.3)
                unit = units[kind]
            extra = {}
            if notes[gas]:
                extra = {"notes": notes[gas], "notesEn": notes_en[gas]}
            key = gas if kind == "total" else f"{gas}-pc"
            if key in hints:
                extra |= {"hints": {"TWN": hints[key]}, "hintsEn": {"TWN": hints_en[key]}}
            write_json(
                out / name,
                indicator_file(
                    name.removesuffix(".json"), unit, years,
                    {iso3: to_series(s, years, digits) for iso3, s in data.items()},
                    aggregates={"WLD": to_series(wdata, years, digits)},
                    **extra,
                ),
            )

    # 其他 GCP 指標（累積、消費端、每單位 GDP、土地利用變化）
    for key in ("cumulative-co2", "consumption-co2-per-capita", "co2-per-gdp", "luc-co2-per-capita"):
        _col, unit, _scale, digits = OWID_INDICATORS[key]
        data = gcp[key]
        w = data.pop("WLD", {})
        years = [y for y in year_span(data, 0.1) if y >= FIRST_YEAR]
        extra = luc_taiwan(inventory, population) if key == "luc-co2-per-capita" else {}
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso3: to_series(s, years, digits) for iso3, s in data.items()},
                aggregates={"WLD": to_series(w, years, digits)},
                **extra,
            ),
        )

    country_files(out, by_source, em, inventory)
    write_json(
        out / "manifest.json",
        {
            "topic": "climate",
            "generatedAt": now_iso(),
            "source": "Global Carbon Project (Our World in Data); EDGAR_2026_GHG (JRC); CEDS v_2025_03_18; UN WPP 2024; 環境部國家溫室氣體排放清冊",
            "gwp": "IPCC AR5 GWP-100（CH4 化石 30、生物 28；N2O 265；含氟氣體依 EDGAR）",
        },
    )


def taiwan_notes(inventory, totals, em: edgar.Emissions, population):
    """台灣跟環境部清冊（2026 年版，2024 年）的對照：附註（側欄）與 tooltip 的短註"""
    y = INVENTORY_YEAR
    inv = {k: v * 1000 for k, v in inventory[y].items()}  # 千公噸 → 公噸
    inv["fgas"] = inv["hfc"] + inv["pfc"] + inv["sf6"] + inv["nf3"]
    inv["ghg"] = inv["total"]
    ours = {gas: totals[gas]["TWN"][y] for gas in GASES}
    pop = population("TWN", y)
    ch4_sector = {k: v.get(y, 0.0) for k, v in em.by_sector["ch4"]["TWN"].items()}
    report = "環境部《2026 年中華民國國家溫室氣體排放清冊報告》"
    report_en = "Taiwan's Ministry of Environment, 2026 National Greenhouse Gas Inventory Report"
    print(f"  台灣 {y} 年對照（本站 vs 環境部清冊，公噸 CO₂e）：")
    for gas in GASES:
        print(f"    {gas:5} {ours[gas]:>14,.0f} {inv[gas]:>14,.0f}  {pct(ours[gas], inv[gas])}")

    notes: dict[str, dict[str, str]] = {g: {} for g in GASES}
    notes_en: dict[str, dict[str, str]] = {g: {} for g in GASES}
    notes["ghg"]["TWN"] = (
        f"{report}：{y} 年總排放 {zh_t(inv['total'])} CO₂ 當量（不含土地利用、土地利用變化及林業），"
        f"扣除森林等吸收的 {zh_t(-inv['lulucf'])}後，淨排放 {zh_t(inv['net'])}。"
        f"這裡是 {zh_t(ours['ghg'])}，{more_zh(ours['ghg'], inv['total'])}："
        f"二氧化碳兩邊差不多（Global Carbon Project {zh_t(ours['co2'])}，清冊 {zh_t(inv['co2'])}），"
        f"差在 EDGAR 估計的甲烷（{zh_t(ours['ch4'])}，清冊 {zh_t(inv['ch4'])}）與氧化亞氮（{zh_t(ours['n2o'])}，清冊 {zh_t(inv['n2o'])}）。"
        f"兩邊都用 IPCC AR5 的 GWP-100（化石來源的甲烷 EDGAR 用 30、清冊一律用 28）。"
    )
    notes_en["ghg"]["TWN"] = (
        f"{report_en}: total emissions in {y} were {en_t(inv['total'])} CO₂e excluding land use, land-use change and forestry "
        f"(LULUCF); after {en_t(-inv['lulucf'])} of removals by forests and other land, net emissions were {en_t(inv['net'])}. "
        f"The figure here is {en_t(ours['ghg'])}, {more_en(ours['ghg'], inv['total'])}: CO₂ is nearly the same "
        f"(Global Carbon Project {en_t(ours['co2'])}, inventory {en_t(inv['co2'])}); the gap is EDGAR's methane "
        f"({en_t(ours['ch4'])} vs {en_t(inv['ch4'])}) and nitrous oxide ({en_t(ours['n2o'])} vs {en_t(inv['n2o'])}). "
        f"Both use IPCC AR5 GWP-100 (EDGAR uses 30 for fossil methane, the inventory 28 throughout)."
    )
    notes["co2"]["TWN"] = (
        f"{report}：{y} 年二氧化碳排放 {zh_t(inv['co2'])}（不含森林等吸收的 {zh_t(-inv['lulucf'])}），"
        f"這裡用的 Global Carbon Project 是 {zh_t(ours['co2'])}，{more_zh(ours['co2'], inv['co2'])}。"
    )
    notes_en["co2"]["TWN"] = (
        f"{report_en}: CO₂ emissions in {y} were {en_t(inv['co2'])} (excluding {en_t(-inv['lulucf'])} of removals by forests "
        f"and other land); the Global Carbon Project figure used here is {en_t(ours['co2'])}, {more_en(ours['co2'], inv['co2'])}."
    )
    i = INVENTORY_CH4_2024
    f = INVENTORY_FGAS_2024
    notes["ch4"]["TWN"] = (
        f"{report}：{y} 年甲烷排放 {zh_t(inv['ch4'])} CO₂ 當量（GWP 28），EDGAR 估計 {zh_t(ours['ch4'])}，"
        f"是 {ours['ch4'] / inv['ch4']:.1f} 倍。主要差在廢水處理（EDGAR {zh_t(ch4_sector.get('wastewater', 0))}，"
        f"清冊 {zh_t(i['wastewater'] * 1000)}）與垃圾掩埋等固體廢棄物（EDGAR {zh_t(ch4_sector.get('solidwaste', 0))}，"
        f"清冊 {zh_t(i['solidwaste'] * 1000)}）：台灣的垃圾大多焚化，清冊的掩埋甲烷從 1998 年的 {zh_t(10962 * 1000)}降到 "
        f"{y} 年的 {zh_t(i['landfill'] * 1000)}。稻田與畜牧 EDGAR {zh_t(sum(ch4_sector.get(k, 0) for k in ('rice', 'enteric', 'manure', 'burning')))}，"
        f"清冊的農業部門 {zh_t(i['agriculture'] * 1000)}（報告的表 ES2.3）。"
    )
    notes_en["ch4"]["TWN"] = (
        f"{report_en}: methane emissions in {y} were {en_t(inv['ch4'])} CO₂e (GWP 28); EDGAR estimates {en_t(ours['ch4'])}, "
        f"{ours['ch4'] / inv['ch4']:.1f} times as much. Most of the gap is wastewater (EDGAR {en_t(ch4_sector.get('wastewater', 0))}, "
        f"inventory {en_t(i['wastewater'] * 1000)}) and landfills and other solid waste (EDGAR {en_t(ch4_sector.get('solidwaste', 0))}, "
        f"inventory {en_t(i['solidwaste'] * 1000)}): most of Taiwan's rubbish is incinerated, and landfill methane in the inventory "
        f"fell from {en_t(10962 * 1000)} in 1998 to {en_t(i['landfill'] * 1000)} in {y}. Rice and livestock: EDGAR "
        f"{en_t(sum(ch4_sector.get(k, 0) for k in ('rice', 'enteric', 'manure', 'burning')))}, inventory agriculture sector "
        f"{en_t(i['agriculture'] * 1000)} (report table ES2.3)."
    )
    notes["n2o"]["TWN"] = (
        f"{report}：{y} 年氧化亞氮排放 {zh_t(inv['n2o'])} CO₂ 當量，EDGAR 估計 {zh_t(ours['n2o'])}"
        f"，{more_zh(ours['n2o'], inv['n2o'])}（EDGAR 另外估計了氮沉降的間接排放，廢水的排放也比較多）。"
    )
    notes_en["n2o"]["TWN"] = (
        f"{report_en}: nitrous oxide emissions in {y} were {en_t(inv['n2o'])} CO₂e; EDGAR estimates {en_t(ours['n2o'])}, "
        f"{more_en(ours['n2o'], inv['n2o'])} (EDGAR also counts indirect emissions from nitrogen deposition, and more from wastewater)."
    )
    notes["fgas"]["TWN"] = (
        f"{report}：{y} 年含氟氣體排放 {zh_t(inv['fgas'])} CO₂ 當量（氫氟碳化物 {zh_t(inv['hfc'])}、全氟碳化物 {zh_t(inv['pfc'])}、"
        f"六氟化硫 {zh_t(inv['sf6'])}、三氟化氮 {zh_t(inv['nf3'])}；半導體、面板等電子業約占 {f['electronics'] / f['total']:.0%}，"
        f"冷媒等臭氧層破壞物質的替代品約占 {f['ods'] / f['total']:.0%}，報告的表 ES2.5），EDGAR 估計 {zh_t(ours['fgas'])}，"
        f"{more_zh(ours['fgas'], inv['fgas'])}。EDGAR 的台灣 1990–1994 年是 0。"
    )
    notes_en["fgas"]["TWN"] = (
        f"{report_en}: F-gas emissions in {y} were {en_t(inv['fgas'])} CO₂e (HFCs {en_t(inv['hfc'])}, PFCs {en_t(inv['pfc'])}, "
        f"SF₆ {en_t(inv['sf6'])}, NF₃ {en_t(inv['nf3'])}; semiconductor, display and other electronics make up about "
        f"{f['electronics'] / f['total']:.0%} and refrigerants and other substitutes for ozone-depleting substances about "
        f"{f['ods'] / f['total']:.0%}, report table ES2.5); EDGAR estimates {en_t(ours['fgas'])}, {more_en(ours['fgas'], inv['fgas'])}. "
        f"EDGAR has zero for Taiwan in 1990–1994."
    )
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    for gas in GASES:
        hints[gas] = f"環境部清冊 {y} 年：{zh_t(inv[gas])}，這裡{more_zh(ours[gas], inv[gas])}"
        hints_en[gas] = f"Taiwan's national inventory, {y}: {en_t(inv[gas])}; {more_en(ours[gas], inv[gas])} here"
        pc = inv[gas] / pop
        hints[f"{gas}-pc"] = f"環境部清冊 {y} 年換算：{pc:.2f} 公噸/人"
        hints_en[f"{gas}-pc"] = f"Taiwan's national inventory, {y}: {pc:.2f} t/person"
    hints["ghg"] = f"環境部清冊 {y} 年：{zh_t(inv['total'])}，扣除碳匯後 {zh_t(inv['net'])}"
    hints_en["ghg"] = f"Taiwan's national inventory, {y}: {en_t(inv['total'])}; {en_t(inv['net'])} net of removals"
    return notes, notes_en, hints, hints_en


def luc_taiwan(inventory, population) -> dict:
    """土地利用變化：GCP 沒有估計台灣，附註與 tooltip 寫環境部清冊的 LULUCF（算法不同，不放進地圖）"""
    y = INVENTORY_YEAR
    removals = -inventory[y]["lulucf"] * 1000
    pc = removals / population("TWN", y)
    zh = (
        f"Global Carbon Project 沒有估計台灣。環境部《2026 年中華民國國家溫室氣體排放清冊報告》{y} 年的土地利用、"
        f"土地利用變化及林業部門淨吸收 {zh_t(removals)} 二氧化碳（約每人 {pc:.2f} 公噸），主要是森林。"
        f"兩者算法不同：各國清冊把受管理的森林的吸收算進去，GCP 的模型主要算砍伐、開墾與之後的再生長，不能直接比。"
    )
    en = (
        f"Not estimated for Taiwan by the Global Carbon Project. In Taiwan's 2026 National Greenhouse Gas Inventory Report, "
        f"land use, land-use change and forestry removed a net {en_t(removals)} of CO₂ in {y} (about {pc:.2f} t per person), "
        f"mostly by forests. The methods differ: national inventories count uptake by managed forests, while the Global "
        f"Carbon Project's models mainly count clearing and the regrowth that follows, so the two are not comparable."
    )
    return {
        "notes": {"TWN": zh},
        "notesEn": {"TWN": en},
        "hints": {"TWN": f"環境部清冊 {y} 年：森林等淨吸收 {zh_t(removals)}（約每人 {pc:.2f} 公噸）"},
        "hintsEn": {"TWN": f"Taiwan's national inventory, {y}: net removal of {en_t(removals)} ({pc:.2f} t per person)"},
    }


def compact(series: Series, years: range) -> list[float | None]:
    """百萬公噸，4 位有效數字"""
    out: list[float | None] = []
    for y in years:
        v = series.get(y)
        if v is None:
            out.append(None)
        else:
            mt = float(f"{v / 1e6:.4g}")
            out.append(int(mt) if mt.is_integer() else mt)
    return out


def block(series: dict[str, Series], first: int | None = None, last: int | None = None) -> dict | None:
    """側欄的一組序列：{from, values}，各序列從 from 到最後一年；全部是 0（或不到 1 千公噸）的序列不放"""
    kept = {k: s for k, s in series.items() if s and max(abs(v) for v in s.values()) >= 1000}
    if not kept:
        return None
    start = first if first is not None else min(min(s) for s in kept.values())
    end = last if last is not None else max(max(s) for s in kept.values())
    years = range(start, end + 1)
    return {"from": start, "values": {k: compact(s, years) for k, s in kept.items()}}


def country_files(out, by_source, em: edgar.Emissions, inventory) -> None:
    """側欄：各國的排放來源（百萬公噸 CO₂e）"""
    uses = ceds.combustion_by_use()
    edgar_last = max(max(em.world[g]) for g in EDGAR_GASES)
    isos = set(by_source) | set(em.by_sector["ch4"])
    count = 0
    for iso3 in sorted(isos):
        data: dict = {}
        if iso3 in by_source:
            data["co2"] = block(by_source[iso3])
        flat = {
            f"{gas}:{key}": series
            for gas in EDGAR_GASES
            for key, series in em.by_sector[gas].get(iso3, {}).items()
        }
        if flat:
            data["edgar"] = block(flat, 1970, edgar_last)
        if iso3 in uses:
            data["uses"] = block(uses[iso3])
        if iso3 in edgar.MEMBERS:
            data["members"] = edgar.MEMBERS[iso3]
        if iso3 == "TWN":
            years = sorted(inventory)
            data["inventory"] = {
                "from": years[0],
                "values": {
                    key: [round(inventory[y][key] / 1000, 3) for y in years]
                    for key in ("co2", "ch4", "n2o", "hfc", "pfc", "sf6", "nf3", "total", "lulucf", "net")
                },
            }
        data = {k: v for k, v in data.items() if v}
        if "co2" in data or "edgar" in data:
            write_json(out / "countries" / f"{iso3}.json", data, quiet=True)
            count += 1
    print(f"  {count} 個國家的排放來源")
