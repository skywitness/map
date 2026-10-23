"""股市規模主題：上市公司市值占 GDP、上市公司市值（美元）、上市公司家數（國內公司）。

- 各國用世界銀行 WDI 轉載的世界交易所聯合會（WFE）資料（CM.MKT.*，WDI 的序列中繼資料標 CC BY 4.0；
  WFE 自己的資料庫條款不准轉載，所以只用世界銀行的版本）。年底值，美元用年底匯率換算。
  一國有多個交易所時，世界銀行的國家值是各交易所的合計。
- 台灣不在世界銀行資料庫中，改用金管會證期局的上市（證交所）＋上櫃（櫃買中心）年底家數與市值（`sources/sfb.py`），
  美元用中央銀行的年底匯率，占 GDP 用主計總處的名目 GDP。1998 年起（證期局開放資料的起點）。
  - 市值含第一上市（櫃）的外國企業（KY 公司），不含臺灣存託憑證（TDR）與興櫃；
    WFE 的定義含「只在這個交易所上市的外國公司」，世界銀行世界合計裡的台灣市值也跟這個一致（差 0.5% 以內）。
  - 家數只算本國公司，不含 KY 公司：WFE 申報的台灣家數（= 世界銀行的世界合計減去各國加總）
    2020–2025 年都跟證期局附註的本國上市＋本國上櫃家數完全相同。證期局 2020 年以前沒有公布本國與外國的拆分，
    2010–2019 年的外國企業家數用「證期局的總家數 − 世界合計裡的台灣」推算；第一家 KY 公司 2010 年才掛牌。
- 世界值是地圖上有資料國家（含台灣）的合計；占 GDP 是市值加總 ÷ GDP 加總（GDP 由各國的市值 ÷ 占比反推）。
  泛歐交易所（Euronext）、那斯達克北歐這類跨國交易所 WFE 只公布集團合計，世界銀行沒有分到各國，所以世界值偏低。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import cbc_fx, dgbas, sfb, worldbank

Series = dict[str, dict[int, float]]

CODES = {"cap-gdp": "CM.MKT.LCAP.GD.ZS", "cap": "CM.MKT.LCAP.CD", "companies": "CM.MKT.LDOM.NO"}
UNITS = {"cap-gdp": "%", "cap": "美元", "companies": "家"}
DIGITS = {"cap-gdp": 1, "cap": 0, "companies": 0}
FIRST_FOREIGN_LISTING = 2010  # 第一家第一上市（櫃）的外國企業掛牌的年份，之前全是本國公司

# 世界銀行（WFE）的錯誤（2026 年 10 月的版本），不收：{指標: {國家: 年份}}，附註寫在 NOTES
VALUE = ("cap-gdp", "cap")
DROP: dict[str, dict[str, set[int]]] = {
    # 孟買證交所與印度國家證交所加總，同一批公司算兩次（市值、家數都是前後年的 2–3 倍）
    "cap-gdp": {"IND": {2018, 2025}, "IRN": set(range(2018, 2024)), "BWA": {2022}},
    "cap": {"IND": {2018, 2025}, "IRN": set(range(2018, 2024)), "BWA": {2022}},
    "companies": {"IND": {2018, 2025}, "AZE": {2019}},
}

INDIA = (
    "世界銀行 2018、2025 年的數字是孟買證交所與印度國家證交所的加總，同一批公司算了兩次（市值是前後年的兩倍），不收",
    "The World Bank's 2018 and 2025 figures add the Bombay Stock Exchange and the National Stock Exchange of India together, "
    "counting the same companies twice (market value doubles from the years either side), so they are left out",
)
NOTES: dict[str, dict[str, tuple[str, str]]] = {
    "cap-gdp": {"IND": INDIA},
    "cap": {"IND": INDIA},
    "companies": {
        "IND": (
            INDIA[0] + "。2017 年以前是孟買證交所的家數（約 5,000 家），2019 年起是國家證交所（約 2,000–2,700 家），不能直接比",
            INDIA[1] + ". Up to 2017 the count is for the Bombay Stock Exchange (about 5,000 companies) and from 2019 for the "
            "National Stock Exchange (about 2,000–2,700), so the two periods are not comparable",
        ),
        "CHN": (
            "2019 年起含全國中小企業股份轉讓系統（新三板）的掛牌公司（2019 年 12,730 家裡有 8,953 家），"
            "之前只有上海、深圳證交所",
            "From 2019 the count includes companies quoted on the National Equities Exchange and Quotations (NEEQ, the "
            "'New Third Board'; 8,953 of the 12,730 in 2019); before that only the Shanghai and Shenzhen exchanges",
        ),
        "JPN": (
            "2013 年東京與大阪證交所合併成日本交易所集團，之後含 JASDAQ 的公司，家數從 2,294 家跳到 3,408 家",
            "The Tokyo and Osaka exchanges merged into Japan Exchange Group in 2013; from then the count includes JASDAQ "
            "companies, jumping from 2,294 to 3,408",
        ),
        "ESP": (
            "約 1999–2021 年的家數含數千家在交易所掛牌的可變資本投資公司（SICAV）；2022 年稅制改變後大多下市，"
            "家數從 2021 年的 2,558 家掉到 2024 年的 277 家",
            "From about 1999 to 2021 the count includes thousands of listed investment companies (SICAVs); most delisted "
            "after a 2022 tax change, so the count fell from 2,558 in 2021 to 277 in 2024",
        ),
        "AZE": (
            "世界銀行 2019 年是 951 家（前後年是 13–36 家），應是資料錯誤，不收",
            "The World Bank's 2019 figure of 951 companies (13–36 in the years either side) looks like an error and is left out",
        ),
    },
}
# 跨國的交易所集團：WFE 只公布集團合計，世界銀行沒有分到各國，所以這些國家近年沒有資料（三個指標都加附註）。
# 不用主題的 noValue：它會取代側欄的歷年折線圖，這些國家之前的年份還是有資料。
EURONEXT = ("泛歐交易所（Euronext）", "Euronext")
NORDIC = ("那斯達克北歐與波羅的海（Nasdaq Nordic and Baltic）", "Nasdaq Nordic and Baltic")
GROUP_EXCHANGES = {
    **{iso: EURONEXT for iso in ("FRA", "NLD", "BEL", "PRT", "IRL", "NOR")},
    **{iso: NORDIC for iso in ("SWE", "DNK", "FIN", "ISL", "EST", "LVA", "LTU")},
    "ITA": ("義大利證交所所屬的跨國交易所集團（2021 年以前是倫敦證交所集團，之後是泛歐交易所）",
            "the multinational group that owns Borsa Italiana (the London Stock Exchange Group until 2021, Euronext since)"),
}
for iso, (group, group_en) in GROUP_EXCHANGES.items():
    for key in CODES:
        NOTES.setdefault(key, {})[iso] = (
            f"{group}這類跨國的交易所集團，世界交易所聯合會（WFE）只公布整個集團的合計，世界銀行沒有分到各國，"
            "所以近年沒有資料",
            f"For multinational exchange groups such as {group_en}, the World Federation of Exchanges (WFE) publishes only "
            "group totals, which the World Bank does not split by country, so there is no data for recent years",
        )
for key in CODES:
    NOTES[key]["GBR"] = (
        "世界銀行沒有英國 2015–2020 年的資料（倫敦證交所集團當時也包括義大利證交所，世界交易所聯合會（WFE）"
        "公布的是集團合計）；2023 年起 WFE 沒有公布倫敦證交所的資料",
        "The World Bank has no UK data for 2015–2020 (the London Stock Exchange Group then also owned Borsa Italiana, and "
        "the World Federation of Exchanges (WFE) published group totals); the WFE has published no London Stock Exchange "
        "data since 2023",
    )
for key in VALUE:
    NOTES[key]["IRN"] = (
        "2018–2023 年世界銀行的美元市值依官方匯率換算，比市場匯率高好幾倍（2023 年變成 2 兆美元、占 GDP 450%，"
        "2024 年改用接近市場的匯率後是 1,720 億美元、36%），不收",
        "From 2018 to 2023 the World Bank's US dollar market value uses the official exchange rate, several times stronger "
        "than the market rate (giving US$2 trillion and 450% of GDP in 2023, against US$172 billion and 36% in 2024 at a "
        "near-market rate), so those years are left out",
    )
    NOTES[key]["BWA"] = (
        "世界銀行 2022 年的市值是前後年的 10 倍（310 億美元、占 GDP 153%），應是資料錯誤，不收",
        "The World Bank's 2022 market value is ten times the years either side (US$31 billion, 153% of GDP), which looks "
        "like an error, so it is left out",
    )


def fmt(v: float) -> str:
    return f"{v:,.0f}"


def taiwan(wb_world_count: dict[int, float], wb_count: Series) -> tuple[Series, dict[str, tuple[str, str]]]:
    """台灣三個指標的序列與附註。家數的外國企業：2020 年起用證期局附註，2010–2019 年用世界合計裡的台灣推算。"""
    data, foreign = sfb.year_end()
    rate = cbc_fx.ntd_per_usd_year_end()
    gdp = {y: v["GDP"] * 1e6 for y, v in dgbas.gdp_by_industry().items() if "GDP" in v}  # 新臺幣百萬元 → 元
    cap_ntd = {y: d["twse_cap"] + d["tpex_cap"] for y, d in data.items()}
    total = {y: d["twse_n"] + d["tpex_n"] for y, d in data.items()}

    # 世界銀行世界合計裡的台灣家數（WFE 申報的本國公司）
    implied = {
        y: w - sum(s.get(y, 0) for s in wb_count.values()) for y, w in wb_world_count.items() if y in total
    }
    domestic: dict[int, float] = {}
    for y, n in total.items():
        if y < FIRST_FOREIGN_LISTING:
            domestic[y] = n
        elif y in foreign:
            domestic[y] = n - sum(foreign[y])
            if y in implied and implied[y] != domestic[y]:
                print(f"  注意：{y} 年證期局的本國公司 {domestic[y]:.0f} 家，世界合計裡的台灣是 {implied[y]:.0f} 家")
        elif y in implied and 0 <= n - implied[y] <= 0.15 * n:
            domestic[y] = implied[y]
        else:
            print(f"  警告：{y} 年沒有台灣的外國企業家數（世界合計推算出 {n - implied.get(y, n):.0f} 家），不收")
    derived = {y: total[y] - domestic[y] for y in domestic if FIRST_FOREIGN_LISTING <= y and y not in foreign}
    print(f"  台灣的外國企業家數，用世界合計推算的年份：{derived}")

    last = max(y for y in cap_ntd if y in gdp)
    twse_only = data[last]["twse_cap"] / gdp[last] * 100
    split = foreign[max(foreign)]
    series = {
        "cap-gdp": {y: v / gdp[y] * 100 for y, v in cap_ntd.items() if y in gdp},
        "cap": {y: v / rate[y] for y, v in cap_ntd.items() if y in rate},
        "companies": domestic,
    }
    src = "台灣不在世界銀行資料庫中，改用金管會證期局的上市（證交所）加上櫃（櫃買中心）"
    src_en = ("Taiwan is not in the World Bank database; figures for the Taiwan Stock Exchange plus the Taipei Exchange (TPEx) "
              "from the Financial Supervisory Commission's Securities and Futures Bureau are used instead")
    scope = "含第一上市櫃的外國企業（KY 公司），不含臺灣存託憑證與興櫃"
    scope_en = ("including primary-listed foreign companies (KY companies) and excluding Taiwan depositary receipts and the "
                "emerging stock board")
    notes = {
        "cap-gdp": (
            f"{src}的年底市值，除以主計總處的名目 GDP；{scope}；1998 年起。只算上市是 {twse_only:.1f}%"
            f"（{last} 年，金管會國際比較表的口徑）",
            f"{src_en}: year-end market value divided by nominal GDP from DGBAS, {scope_en}; from 1998. The Taiwan Stock "
            f"Exchange alone is {twse_only:.1f}% ({last}), the basis of the commission's own international comparison",
        ),
        "cap": (
            f"{src}的年底市值，用中央銀行公布的年底匯率換算美元；{scope}；1998 年起",
            f"{src_en}: year-end market value converted at the central bank's year-end exchange rate, {scope_en}; from 1998",
        ),
        "companies": (
            f"{src}的本國公司家數，跟世界交易所聯合會的口徑相同，不含第一上市櫃的外國企業（KY 公司，{max(foreign)} 年底"
            f"上市 {split[0]} 家、上櫃 {split[1]} 家）、臺灣存託憑證與興櫃；1998 年起。證期局 2020 年起才公布外國企業的家數，"
            "2010–2019 年用世界銀行世界合計裡的台灣家數推算",
            f"{src_en}: domestic companies only, as reported to the World Federation of Exchanges, excluding primary-listed "
            f"foreign companies (KY companies; {split[0]} on the Taiwan Stock Exchange and {split[1]} on TPEx at the end of "
            f"{max(foreign)}), Taiwan depositary receipts and the emerging stock board; from 1998. The bureau has published the "
            "number of foreign companies only since 2020, so 2010–2019 are derived from Taiwan's count inside the World Bank's "
            "world total",
        ),
    }
    print(
        f"  台灣 {last} 年底：上市 {data[last]['twse_n']:.0f} 家、市值 {data[last]['twse_cap'] / 1e12:.2f} 兆元；"
        f"上櫃 {data[last]['tpex_n']:.0f} 家、市值 {data[last]['tpex_cap'] / 1e12:.2f} 兆元；"
        f"合計 {series['cap'][last] / 1e12:.3f} 兆美元（{rate[last]} 元／美元）、占 GDP {series['cap-gdp'][last]:.1f}%、"
        f"本國公司 {domestic.get(last, 0):.0f} 家"
    )
    return series, notes


def build() -> None:
    out = OUT_DIR / "topics" / "stock-market"
    raw: dict[str, Series] = {}
    wb_world: dict[str, dict[int, float]] = {}
    for key, code in CODES.items():
        raw[key], wb_world[key] = worldbank.fetch(code, 1975)

    tw, tw_notes = taiwan(wb_world["companies"], raw["companies"])
    series: dict[str, Series] = {}
    for key, by_country in raw.items():
        drop = DROP.get(key, {})
        series[key] = {
            iso: {y: v for y, v in s.items() if y not in drop.get(iso, set())} for iso, s in by_country.items()
        }
        last = max(y for s in series[key].values() for y in s)
        series[key]["TWN"] = {y: v for y, v in tw[key].items() if y <= last}

    # 世界值：地圖上有資料國家的合計；占 GDP = 市值加總 ÷ GDP 加總（GDP 由市值 ÷ 占比反推）
    cap, pct = series["cap"], series["cap-gdp"]
    both = {iso: {y: (cap[iso][y], pct[iso][y]) for y in cap[iso] if y in pct.get(iso, {}) and pct[iso][y] > 0} for iso in cap}
    world: dict[str, dict[int, float]] = {
        "cap": {y: sum(s.get(y, 0) for s in cap.values()) for y in {y for s in cap.values() for y in s}},
        "companies": {y: sum(s.get(y, 0) for s in series["companies"].values())
                      for y in {y for s in series["companies"].values() for y in s}},
    }
    world["cap-gdp"] = {}
    for y in {y for s in both.values() for y in s}:
        pairs = [s[y] for s in both.values() if y in s]
        world["cap-gdp"][y] = sum(c for c, _ in pairs) / sum(c / p * 100 for c, p in pairs) * 100

    for key, by_country in series.items():
        years = year_span(by_country)
        digits = DIGITS[key]
        values = {iso: to_series(s, years, digits) for iso, s in by_country.items()}
        values = {iso: v for iso, v in values.items() if any(x is not None for x in v)}
        notes = {iso: zh for iso, (zh, _) in NOTES.get(key, {}).items()}
        notes_en = {iso: en for iso, (_, en) in NOTES.get(key, {}).items()}
        notes["TWN"], notes_en["TWN"] = tw_notes[key]
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, UNITS[key], years, values,
                aggregates={"WLD": to_series(world[key], years, digits)},
                notes=notes,
                notesEn=notes_en,
            ),
        )
        counts = [sum(1 for s in by_country.values() if y in s) for y in years]
        print(f"  {key}：{years[0]}–{years[-1]}，每年 {min(counts)}–{max(counts)} 國（{years[-1]} 年 {counts[-1]} 國）")
        latest = sorted(((s[years[-1]], iso) for iso, s in by_country.items() if years[-1] in s), reverse=True)[:8]
        print("    " + "、".join(f"{iso} {fmt(v) if key != 'cap' else f'{v / 1e12:.2f}T'}" for v, iso in latest))

    write_json(
        out / "manifest.json",
        {
            "topic": "stock-market",
            "generatedAt": now_iso(),
            "source": "World Bank WDI (World Federation of Exchanges); 金管會證券期貨局; 中央銀行; 行政院主計總處",
        },
    )
