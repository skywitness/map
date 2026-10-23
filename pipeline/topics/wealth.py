"""存款與財產主題：平均每人存款、存款占 GDP、每位成年人的平均與中位數淨財富、最富有 10%／1% 的財富占比、
家庭儲蓄率、國民儲蓄率。

- 存款：IMF Financial Access Survey 的存款餘額占 GDP（商業銀行＋信用合作社＋其他收受存款機構，見
  `sources/imf_fas.py`），乘上 IMF WEO 的人均 GDP（當年美元）得到平均每人存款。台灣用中央銀行的貨幣機構存款
  （企業及個人存款加郵政儲金，年底餘額）÷ 主計總處的名目 GDP。
- 財富：World Inequality Database（`sources/wid.py`），20 歲以上、夫妻平分的個人淨財富（房地產、金融資產
  減負債）。WID 的金額是基準年（2025）不變價格的本國貨幣，除以基準年的市場匯率或購買力平價，就是
  「2025 年價格」的美元或國際元。多數國家沒有財富分布的直接資料，是 WID 用模型推估的。
- 家庭儲蓄率：OECD 國民帳的家庭淨儲蓄率（約 35 國）；台灣只有家庭收支調查的儲蓄率，口徑不同（附註）。
- 國民儲蓄率：IMF WEO 的國民儲蓄毛額占 GDP（含台灣與推估值），DataMapper 沒有這個指標，改查 SDMX API。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import cbc_finance, dgbas, dgbas_wealth, imf, imf_fas, imf_weo_sdmx, oecd_saving, wid

OUT = OUT_DIR / "topics" / "wealth"
WID_FIRST_YEAR = 1995  # WID 全球財富估計（Bajard et al.）從 1995 年開始，之前的是用長期序列往回推的

# 主計總處的官方財富統計，只放在台灣的附註（口徑不同，沒有混進地圖）
NATIONAL_WEALTH = {  # 《國富統計》113 年底家庭部門淨值（土地按市價重評價），2026-04-29 發布
    "year": 2024,
    "household-net-worth": 183.7e12,
}
WEALTH_DISTRIBUTION = {  # 《家庭財富分配統計》110 年底（以家庭收支調查樣本結合資產負債資料推估），2024-05-03 發布
    "year": 2021,
    "mean-per-household": 1638e4,
    "median-per-household": 894e4,
    "top20-share": 62.68,
}


def _write(key: str, unit: str, years: list[int], countries: dict[str, dict[int, float]], digits: int, **extra) -> None:
    values = {iso3: to_series(s, years, digits) for iso3, s in countries.items() if any(y in s for y in years)}
    if "aggregates" in extra:
        extra["aggregates"] = {k: to_series(s, years, digits) for k, s in extra["aggregates"].items()}
    write_json(OUT / f"{key}.json", indicator_file(key, unit, years, values, **extra))
    latest = years[-1] if key != "gross-savings" else extra.get("projectionFrom", years[-1]) - 1
    print(f"  {key}：{years[0]}–{years[-1]}，{latest} 年 {sum(1 for s in countries.values() if latest in s)} 國")


# ── 存款 ──────────────────────────────────────────────────────────────


def build_deposits() -> dict[str, float]:
    ratio, used = imf_fas.deposits_to_gdp()
    private, total = cbc_finance.deposits()
    gdp = {year: row["GDP"] * 1e6 for year, row in dgbas.gdp_by_industry().items() if "GDP" in row}
    ratio["TWN"] = {y: private[y] / gdp[y] * 100 for y in private if y in gdp}
    per_capita_gdp, _ = imf.fetch("NGDPDPC")
    per_person = {
        iso3: {y: r / 100 * per_capita_gdp[iso3][y] for y, r in s.items() if y in per_capita_gdp.get(iso3, {})}
        for iso3, s in ratio.items()
    }
    years = year_span(ratio)

    notes = {
        iso3: "只有商業銀行的存款：IMF 沒有這個國家信用合作社、儲蓄銀行等其他機構的資料"
        for iso3, kinds in used.items()
        if kinds == "COMBANK"
    }
    notes_en = {
        iso3: "Commercial banks only: the IMF has no data on deposits at credit unions, savings banks and other deposit takers here"
        for iso3 in notes
    }
    y = max(yr for yr in private if yr in gdp)
    twn = (
        f"中央銀行金融統計：貨幣機構（銀行、信用合作社、農漁會信用部、中華郵政）的企業及個人存款加郵政儲金，"
        f"年底餘額，不含政府存款、外國人的新台幣存款與貨幣市場基金；{y} 年底 {private[y] / 1e12:.1f} 兆元，"
        f"占 GDP {ratio['TWN'][y]:.0f}%。含政府存款的貨幣機構存款合計是 {total[y] / 1e12:.1f} 兆元"
    )
    twn_en = (
        "Central Bank of the Republic of China (Taiwan): deposits of businesses and individuals plus postal savings "
        "at all monetary institutions (banks, credit cooperatives, farmers' and fishermen's credit departments and "
        "Chunghwa Post), at year end, excluding government deposits, non-residents' NT dollar deposits and money "
        f"market funds: NT${private[y] / 1e12:.1f} trillion at the end of {y}, {ratio['TWN'][y]:.0f}% of GDP. "
        f"Including government deposits the total is NT${total[y] / 1e12:.1f} trillion"
    )
    _write(
        "deposits-gdp", "%", years, ratio, 1,
        notes={**notes, "TWN": twn}, notesEn={**notes_en, "TWN": twn_en},
    )
    _write(
        "deposits-per-person", "美元", years, per_person, 0,
        notes={**notes, "TWN": twn + "；乘上 IMF 的人均 GDP（美元）換算"},
        notesEn={**notes_en, "TWN": twn_en + "; converted to US dollars with the IMF's GDP per capita"},
    )
    return {"TWN": per_person["TWN"].get(y), "TWN-ratio": ratio["TWN"][y]}


# ── 財富（WID） ────────────────────────────────────────────────────────


def build_wealth() -> int:
    data = wid.series(wid.ALL)
    index = data[("inyixxi999", "p0p100")]
    base = wid.base_year(index)
    fx, ppp, adults = data[("xlcusxi999", "p0p100")], data[("xlcuspi999", "p0p100")], data[("npopuli992", "p0p100")]
    mean, median = data[("ahwealj992", "p0p100")], data[("ahwealj992", "p50p51")]

    def countries(amount: dict[str, dict[int, float]], rate: dict[str, dict[int, float]]) -> dict[str, dict[int, float]]:
        """基準年價格的本國貨幣 ÷ 基準年的匯率（或購買力平價）"""
        return {
            iso3: {y: v / rate[iso3][base] for y, v in s.items() if y >= WID_FIRST_YEAR}
            for iso3, s in amount.items()
            if iso3 != "WLD" and rate.get(iso3, {}).get(base)
        }

    def world_mean(by_country: dict[str, dict[int, float]]) -> dict[int, float]:
        """各國平均 × 成年人數的加總 ÷ 成年人數（WID 世界檔 WO 只到前一年，而且基準年不同，所以自己加總）"""
        out = {}
        for y in {y for s in by_country.values() for y in s}:
            pairs = [(s[y], adults[c][y]) for c, s in by_country.items() if y in s and adults.get(c, {}).get(y)]
            out[y] = sum(v * n for v, n in pairs) / sum(n for _, n in pairs)
        return out

    # WO（世界，購買力平價）的基準年可能比各國早一年：換成各國的基準年，用美國的物價指數調整
    wo_base = next(y for y, v in index["WLD"].items() if abs(v - 1) < 1e-6)
    to_base = 1 / index["USA"][wo_base]

    mean_usd, mean_ppp = countries(mean, fx), countries(mean, ppp)
    median_usd, median_ppp = countries(median, fx), countries(median, ppp)
    world_ppp_mean = world_mean(mean_ppp)
    world_ppp_median = {y: v * to_base for y, v in median["WLD"].items() if y >= WID_FIRST_YEAR}
    years = year_span(mean_usd)
    print(
        f"  WID 基準年 {base}（世界檔 {wo_base}）；世界平均（購買力平價）{years[-2]} 年：自己加總 "
        f"{world_ppp_mean[years[-2]]:,.0f}，WID 世界檔 {mean['WLD'].get(years[-2], 0) * to_base:,.0f}"
    )

    # 台灣的附註：主計總處的官方統計（口徑不同，只列出來對照）
    nw = NATIONAL_WEALTH
    per_adult = nw["household-net-worth"] / adults["TWN"][nw["year"]]
    wid_nominal = mean["TWN"][nw["year"]] * index["TWN"][nw["year"]]
    mean_note = (
        f"主計總處《國富統計》：{nw['year'] - 1911} 年底家庭部門淨值 {nw['household-net-worth'] / 1e12:.1f} 兆元"
        f"（土地按市價），除以 20 歲以上人口約每人 {per_adult / 1e4:,.0f} 萬元；WID 同年是 {wid_nominal / 1e4:,.0f} 萬元"
        "（當年價格）"
    )
    mean_note_en = (
        f"DGBAS National Wealth Statistics: household-sector net worth of NT${nw['household-net-worth'] / 1e12:.1f} "
        f"trillion at the end of {nw['year']} (land at market value), about NT${per_adult / 1e6:.2f} million per person "
        f"aged 20 and over; WID's figure for the same year is NT${wid_nominal / 1e6:.2f} million (current prices)"
    )
    wd = WEALTH_DISTRIBUTION
    median_note = (
        f"主計總處《家庭財富分配統計》（{wd['year']} 年底，以家庭收支調查樣本推估）：每戶淨值中位數 "
        f"{wd['median-per-household'] / 1e4:,.0f} 萬元、平均 {wd['mean-per-household'] / 1e4:,.0f} 萬元，"
        "是每「戶」不是每位成年人，不能直接比。WID 沒有台灣的財富分布資料，中位數是推估的"
    )
    median_note_en = (
        f"DGBAS Household Wealth Distribution Statistics (end of {wd['year']}, estimated from the Family Income and "
        f"Expenditure Survey sample): median net worth NT${wd['median-per-household'] / 1e6:.2f} million and mean "
        f"NT${wd['mean-per-household'] / 1e6:.2f} million per household, not per adult, so not directly comparable. "
        "WID has no direct data on Taiwan's wealth distribution, so its median is modelled"
    )
    share_note = (
        f"主計總處《家庭財富分配統計》：{wd['year']} 年底財富最多的 20% 家庭擁有 {wd['top20-share']:.1f}%"
        "（以戶計算，跟 WID 以成年人計算的口徑不同）。WID 沒有台灣的財富分布資料，占比是推估的"
    )
    share_note_en = (
        f"DGBAS Household Wealth Distribution Statistics: the wealthiest 20% of households held {wd['top20-share']:.1f}% "
        f"of household wealth at the end of {wd['year']} (counted by household, unlike WID's adults). WID has no "
        "direct data on Taiwan's wealth distribution, so its shares are modelled"
    )

    _write("mean-wealth", "美元", years, mean_usd, 0,
           aggregates={"WLD": world_mean(mean_usd)}, notes={"TWN": mean_note}, notesEn={"TWN": mean_note_en})
    _write("mean-wealth-ppp", "國際元", years, mean_ppp, 0,
           aggregates={"WLD": world_ppp_mean}, notes={"TWN": mean_note}, notesEn={"TWN": mean_note_en})
    _write("median-wealth", "美元", years, median_usd, 0,
           notes={"TWN": median_note}, notesEn={"TWN": median_note_en})
    _write("median-wealth-ppp", "國際元", years, median_ppp, 0,
           aggregates={"WLD": world_ppp_median}, notes={"TWN": median_note}, notesEn={"TWN": median_note_en})
    for key, percentile in (("top10-wealth-share", "p90p100"), ("top1-wealth-share", "p99p100")):
        shares = data[("shwealj992", percentile)]
        by_country = {c: {y: v * 100 for y, v in s.items() if y >= WID_FIRST_YEAR} for c, s in shares.items() if c != "WLD"}
        world = {y: v * 100 for y, v in shares.get("WLD", {}).items() if y >= WID_FIRST_YEAR}
        _write(key, "%", years, by_country, 1,
               aggregates={"WLD": world}, notes={"TWN": share_note}, notesEn={"TWN": share_note_en})
    return base


# ── 儲蓄 ──────────────────────────────────────────────────────────────


def build_saving() -> None:
    household = oecd_saving.household_net_saving_rate()
    fies = dgbas_wealth.household_saving_rate()
    household["TWN"] = fies
    years = year_span(household, 0.5)  # 最新一年常常只有十幾國先公布
    y = max(fies)
    _write(
        "household-saving", "%", years, household, 1,
        notes={"TWN": (
            "主計總處家庭收支調查的儲蓄率：儲蓄 ÷ 可支配所得，儲蓄 = 可支配所得 − 消費支出。是抽樣調查，"
            "也沒有扣掉房屋等的折舊，跟其他國家的國民帳「淨」儲蓄率口徑不同，會偏高好幾個百分點；"
            f"{y} 年 {fies[y]:.1f}%。國民所得統計沒有家庭部門的儲蓄"
        )},
        notesEn={"TWN": (
            "DGBAS Family Income and Expenditure Survey saving rate: saving ÷ disposable income, where saving is "
            "disposable income minus consumption. It is a sample survey and does not deduct depreciation of homes and "
            "other assets, unlike the national-accounts net saving rates of other countries, so it runs several "
            f"points higher; {fies[y]:.1f}% in {y}. Taiwan's national accounts do not publish household-sector saving"
        )},
    )

    release, projection_from = imf.weo_release()
    gross, world = imf_weo_sdmx.fetch("NGSD_NGDP")
    years = year_span(gross)
    na = dgbas_wealth.national_accounts()
    y = max(yr for yr in na["gross-saving"] if yr in na["gdp"] and yr < projection_from)
    _write(
        "gross-savings", "%", years, gross, 1,
        projectionFrom=projection_from, aggregates={"WLD": world},
        notes={"TWN": (
            f"主計總處國民所得統計：{y} 年國民儲蓄毛額占 GDP {na['gross-saving'][y] / na['gdp'][y] * 100:.1f}%"
            f"（主計總處公布的「儲蓄率」是占國民所得毛額 GNI：{na['saving-rate-gni'][y]:.1f}%）"
        )},
        notesEn={"TWN": (
            f"DGBAS national accounts: gross national saving was {na['gross-saving'][y] / na['gdp'][y] * 100:.1f}% "
            f"of GDP in {y} (the saving rate DGBAS publishes is relative to GNI: {na['saving-rate-gni'][y]:.1f}%)"
        )},
    )
    print(f"  WEO {release}")


def build() -> None:
    deposits = build_deposits()
    base = build_wealth()
    build_saving()
    write_json(
        OUT / "manifest.json",
        {
            "topic": "wealth",
            "generatedAt": now_iso(),
            "source": "IMF FAS, IMF WEO, WID.world, OECD, 中央銀行, 主計總處",
            "widBaseYear": base,
            "taiwanDepositsPerPerson": deposits["TWN"],
        },
    )
