"""中國的海外貸款主題：AidData 的 China's Global Loans and Grants Dataset 1.0（CLG-Global 1.0，sources/aiddata.py，ODC-By 1.0）。

2000–2023 年中國官方機構對 217 個低、中、高所得國家與地區的開發融資（贈款、貸款、債務重整…）的**承諾金額**，不是
實際撥款、也不是未償還的債務。只用 AidData 建議加總的項目（`Recommended_for_Aggregates` = Yes，30,133 筆：排除取消、
暫停、只有承諾意向的與傘狀協議，傘狀協議底下的項目已經各自列出），金額用 `Adjusted_Amount`（扣掉央行換匯與紓困貸款
的短期展期，30,133 筆合計 2.17 兆美元，跟 AidData 的說明一致）。

子項目（`Flow_Type_Simplified`）：全部、貸款（Loan）、贈款（Grant）；全部另外含債務重整（Debt Rescheduling）與
類型不明（Vague）。指標：
- 累計承諾金額、當年承諾金額：2023 年固定美元（`Adjusted_Amount_Constant_USD_2023`，OECD 的平減方法）。
- 累計承諾金額占 GDP：分子分母都用當期美元（`Adjusted_Amount_Nominal_USD` 的累計 ÷ 那一年的 GDP，
  人均收入主題的 gdp.json，IMF WEO＋世界銀行），固定美元除以當期 GDP 在早年會偏高。
- 每人累計承諾金額：2023 年固定美元 ÷ 那一年的人口（人口主題的 total.json，UN WPP 2024）。

涵蓋範圍：AidData 有系統地搜尋過的 217 個國家與地區（CountryList 工作表），其中 17 個沒有找到項目，值是 0；
範圍外的（中國本身、香港、澳門、台灣與少數小屬地）沒有值，前端用 coverage 與 noValue 說明。區域性的項目（加總的
321 筆）沒有受援國，只算進世界合計。

輸出（public/data/topics/china-lending/）：
- {all,loan,grant}-cumulative.json、-annual.json、-gdp.json、-per-capita.json
- countries/<ISO3>.json：側欄用的歷年類型、部門與金額最大的 10 個項目
- manifest.json
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import aiddata
from sources.countries import from_name, to_iso3
from topics.profiles import _read_indicator

OUT = OUT_DIR / "topics" / "china-lending"
YEARS = list(range(2000, 2024))
ITEMS = {"all": None, "loan": "Loan", "grant": "Grant"}
CONSTANT = "Adjusted_Amount_Constant_USD_2023"
NOMINAL = "Adjusted_Amount_Nominal_USD"
TOP_N = 10
TITLE_MAX = 200  # 側欄的項目名稱最多幾個字（最長的有 427 字）

# CountryList 的英文名稱 pycountry 對不到的
NAME_ALIASES = {
    "United States Virgin Islands": "VIR",
    "West Bank and Gaza Strip": "PSE",
}

# 側欄的類型代碼（countries/<ISO3>.json 的 flows、top 的第 6 欄）
FLOW_CODES = {"Loan": "loan", "Grant": "grant", "Debt Rescheduling": "debt", "Vague": "vague"}
STATUS_CODES = {"Completion": "done", "Implementation": "ongoing", "Pipeline: Commitment": "pipeline"}

# 個別國家的附註（每個指標檔都寫）
NOTES = {
    "MHL": (
        "大多是中國的銀行給在馬紹爾群島登記的航運公司買船（液化天然氣船等）的貸款與售後租回，馬紹爾群島是常見的"
        "權宜船籍國，錢不是給馬紹爾群島的政府或經濟，所以占 GDP 的比例特別高。",
        "Mostly loans and sale-leasebacks from Chinese banks to shipping companies registered in the Marshall Islands "
        "(a common flag of convenience) for buying vessels such as LNG carriers; the money does not go to the "
        "Marshallese government or economy, hence the very high share of GDP.",
    ),
    "BMU": (
        "大多是中國的銀行給在百慕達登記的航運、鑽油平台公司（Frontline、Seadrill 等）買船的貸款與售後租回，以及收購"
        "保險公司的融資，錢不是給百慕達的政府或經濟，所以每人金額與占 GDP 的比例特別高。",
        "Mostly loans and sale-leasebacks from Chinese banks to shipping and offshore-drilling companies registered in "
        "Bermuda (Frontline, Seadrill and others) for buying vessels, plus financing for insurance acquisitions; the "
        "money does not go to Bermuda’s government or economy, hence the very high per-person amount and share of GDP.",
    ),
    "MCO": (
        "幾乎都是中國工商銀行租賃給總部在摩納哥的郵輪公司（Silversea）造船的融資，所以每人金額特別高。",
        "Almost entirely ICBC Leasing finance for new ships for a cruise line headquartered in Monaco (Silversea), hence "
        "the very high per-person amount.",
    ),
}

Series = dict[int, float]


def covered() -> set[str]:
    out = set()
    for name, _ in aiddata.covered_countries():
        iso3 = NAME_ALIASES.get(name) or from_name(name)
        if not iso3:
            raise ValueError(f"CountryList 的 {name} 對不到 ISO 代碼")
        out.add(iso3)
    return out


def _clean(r: dict) -> dict:
    """xlsx 的年份、部門代碼與編號讀出來是浮點數（2023.0），轉成整數"""
    return r | {k: int(r[k]) for k in ("Commitment_Year", "Sector_Code", "AidData_Record_ID")}


def cumulative(series: Series) -> Series:
    out, acc = {}, 0.0
    for y in YEARS:
        acc += series.get(y, 0.0)
        out[y] = acc
    return out


def write_indicator(key: str, unit: str, by_country: dict[str, Series], digits: int, world: Series | None = None) -> None:
    def row(s: Series) -> list:
        return [None if s.get(y) is None else round(s[y], digits) if digits else round(s[y]) for y in YEARS]

    extra: dict = {"aggregates": {"WLD": row(world)}} if world else {}
    notes = {c: n for c, n in NOTES.items() if c in by_country}
    extra |= {"notes": {c: n[0] for c, n in notes.items()}, "notesEn": {c: n[1] for c, n in notes.items()}}
    write_json(OUT / f"{key}.json", indicator_file(key, unit, YEARS, {k: row(s) for k, s in sorted(by_country.items())}, **extra))


def build() -> None:
    countries = covered()
    rows = [_clean(r) for r in aiddata.records() if r["Recommended_for_Aggregates"] == "Yes"]
    for r in rows:
        iso3 = to_iso3(r["Country_of_Activity_ISO3"])
        if iso3 and iso3 not in countries:
            raise ValueError(f"{iso3} 有項目但不在 CountryList")

    gdp = _read_indicator(OUT_DIR / "topics" / "income" / "gdp.json")
    population = _read_indicator(OUT_DIR / "topics" / "population" / "total.json")

    def lookup(data: dict, iso3: str) -> Series:
        return {y: v for y, v in zip(data["years"], data["values"].get(iso3, [])) if v}

    for item, flow in ITEMS.items():
        constant: dict[str, Series] = {c: {} for c in countries}
        nominal: dict[str, Series] = {c: {} for c in countries}
        world: Series = defaultdict(float)
        for r in rows:
            if flow and r["Flow_Type_Simplified"] != flow:
                continue
            year = r["Commitment_Year"]
            world[year] += r[CONSTANT] or 0
            iso3 = to_iso3(r["Country_of_Activity_ISO3"])
            if not iso3:
                continue  # 區域性的項目
            constant[iso3][year] = constant[iso3].get(year, 0) + (r[CONSTANT] or 0)
            nominal[iso3][year] = nominal[iso3].get(year, 0) + (r[NOMINAL] or 0)

        annual = {c: {y: s.get(y, 0.0) for y in YEARS} for c, s in constant.items()}
        cum = {c: cumulative(s) for c, s in constant.items()}
        write_indicator(f"{item}-annual", "美元", annual, 0, world)
        write_indicator(f"{item}-cumulative", "美元", cum, 0, cumulative(world))

        share: dict[str, Series] = {}
        per_capita: dict[str, Series] = {}
        for c in countries:
            g, p, n = lookup(gdp, c), lookup(population, c), cumulative(nominal[c])
            share[c] = {y: n[y] / g[y] * 100 for y in YEARS if y in g}
            per_capita[c] = {y: cum[c][y] / p[y] for y in YEARS if y in p}
        write_indicator(f"{item}-gdp", "%", {c: s for c, s in share.items() if s}, 3)
        write_indicator(f"{item}-per-capita", "美元", {c: s for c, s in per_capita.items() if s}, 2)

    write_countries(rows)
    write_json(
        OUT / "manifest.json",
        {
            "topic": "china-lending",
            "generatedAt": now_iso(),
            "source": f"AidData, China's Global Loans and Grants Dataset, Version 1.0 (ODC-By 1.0), {aiddata.PAGE}",
            "records": len(rows),
            "covered": len(countries),
        },
    )


def write_countries(rows: list[dict]) -> None:
    """側欄：歷年各類型的承諾金額、各部門的承諾金額（歷年，側欄加到時間軸那一年）、金額最大的 10 個項目。"""
    by_country: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        iso3 = to_iso3(r["Country_of_Activity_ISO3"])
        if iso3:
            by_country[iso3].append(r)
    for iso3, items in by_country.items():
        flows: dict[str, list[float]] = defaultdict(lambda: [0.0] * len(YEARS))
        # 子項目 → 部門 → 歷年（全部、貸款、贈款各一份，側欄跟著子項目換）
        sectors: dict[str, dict[str, list[float]]] = {item: defaultdict(lambda: [0.0] * len(YEARS)) for item in ITEMS}
        top: dict[str, list[dict]] = {}
        for r in items:
            amount = r[CONSTANT] or 0
            if not amount:
                continue
            i = YEARS.index(r["Commitment_Year"])
            flows[FLOW_CODES[r["Flow_Type_Simplified"]]][i] += amount
            for item, flow in ITEMS.items():
                if not flow or r["Flow_Type_Simplified"] == flow:
                    sectors[item][str(r["Sector_Code"])][i] += amount
        for item, flow in ITEMS.items():
            matched = (r for r in items if r[CONSTANT] and (not flow or r["Flow_Type_Simplified"] == flow))
            top[item] = sorted(matched, key=lambda r: -r[CONSTANT])[:TOP_N]
        write_json(
            OUT / "countries" / f"{iso3}.json",
            {
                "years": YEARS,
                # 金額以百萬美元存，小數 2 位（1 萬美元）
                "flows": {k: _millions(s) for k, s in flows.items()},
                "sectors": {item: {k: _millions(s) for k, s in by.items()} for item, by in sectors.items() if by},
                # [名稱, 承諾年份, 百萬美元, 部門, 狀態, 類型, AidData 的編號]
                "top": {
                    item: [
                        [
                            _title(r["Title"]),
                            r["Commitment_Year"],
                            round(r[CONSTANT] / 1e6, 2),
                            str(r["Sector_Code"]),
                            STATUS_CODES[r["Status"]],
                            FLOW_CODES[r["Flow_Type_Simplified"]],
                            r["AidData_Record_ID"],
                        ]
                        for r in rows_
                    ]
                    for item, rows_ in top.items()
                    if rows_
                },
            },
            quiet=True,
        )
    print(f"  輸出 {len(by_country)} 個國家的側欄明細")


def _millions(series: list[float]) -> list[float]:
    """百萬美元、小數 2 位；整數不留 .0（檔案小一點）"""
    return [int(v) if v == int(v) else v for v in (round(x / 1e6, 2) for x in series)]


def _title(title: str) -> str:
    title = " ".join((title or "").split())
    return title if len(title) <= TITLE_MAX else title[: TITLE_MAX - 1].rstrip() + "…"
