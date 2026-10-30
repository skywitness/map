"""物價與財政主題：通膨率、政府債務、財政收支、物價水準、稅收占 GDP。

- 通膨率、政府債務、財政收支用 IMF World Economic Outlook（含台灣與未來推估）；通膨率在 IMF 沒涵蓋的地區用世界銀行補。
- 物價水準 = GDP（美元）÷ GDP（購買力平價），以美國為 100；IMF 的兩個序列算出（含台灣），IMF 沒涵蓋的地區用世界銀行的同一組數字補。
  世界銀行原本的「物價水準比」（PA.NUS.PPPC.RF）已經移到封存資料庫，而且沒有台灣。
- 稅收用 OECD 全球稅收統計（含社會安全捐、各級政府）；OECD 沒涵蓋的國家用 IMF 世界稅收資料庫（WoRLD）補，
  台灣用財政部的賦稅負擔率（含社會安全捐，依 OECD 稅收分類）。OECD 有幾國前面的年份沒有社會安全捐
  （中國 2019 年起才有，那一年跳高約 5 個百分點），附註會寫。
- IMF 的台灣債務與收支就是財政部的數字（公共債務法、各級政府歲入歲出的口徑），範圍跟其他國家不同，附註會寫。
- 2026-10-29 擴充（製作手冊第五批 47，使用者決定放這個主題；build_food_share() 可以單獨跑）：食物與非酒精飲料占個人實際
  消費的比例，世界銀行國際比較計畫 ICP 2021（API 來源 90，品項 1101000，分類 AICZS；2017、2021 兩期，CC BY 4.0，有台灣）。
  USDA ERS 的每年資料底層是商業資料庫（Oxford Economics、Euromonitor），沒有用。
"""
from __future__ import annotations

import json
import statistics

from common import OUT_DIR, download, indicator_file, latest_year_span, now_iso, to_series, write_json, year_span
from sources import dgbas, imf, imf_revenue, mof, oecd_revenue, worldbank
from sources.countries import to_iso3
from topics import fiscal_structure

FIRST_YEAR = 1980
TAX_LATEST_WITHIN = 1
WB_NOTE = "IMF 未涵蓋，改用世界銀行資料（沒有推估值）"
WB_NOTE_EN = "Not covered by the IMF; World Bank data used instead (no projections)"


def _fill_from_world_bank(values: dict, notes: dict, notes_en: dict, wb_data: dict, years: list[int], digits: int) -> list[str]:
    """IMF 沒有的國家用世界銀行補，回傳補上的國家。"""
    filled = []
    for iso3, series in wb_data.items():
        if iso3 not in values and any(y in series for y in years):
            values[iso3] = to_series(series, years, digits)
            notes[iso3], notes_en[iso3] = WB_NOTE, WB_NOTE_EN
            filled.append(iso3)
    return sorted(filled)


def _quantiles(name: str, values: dict[str, list], years: list[int], year: int) -> None:
    """印出某一年的分布，挑分級門檻用。"""
    if year not in years:
        return
    vals = sorted(s[years.index(year)] for s in values.values() if s[years.index(year)] is not None)
    qs = statistics.quantiles(vals, n=20)
    print(
        f"  {name} {year} 年 {len(vals)} 國：最小 {vals[0]:g}、P10 {qs[1]:.1f}、P25 {qs[4]:.1f}、"
        f"中位數 {qs[9]:.1f}、P75 {qs[14]:.1f}、P90 {qs[17]:.1f}、最大 {vals[-1]:g}"
    )


# ── IMF WEO：通膨率、政府債務、財政收支 ─────────────────────────────

def _weo(out, key: str, code: str, wb_code: str | None, projection_from: int, notes: dict, notes_en: dict) -> None:
    imf_data, imf_world = imf.fetch(code)
    combined = dict(imf_data)
    wb_data: dict = {}
    if wb_code:
        wb_data, _ = worldbank.fetch(wb_code, FIRST_YEAR)
        combined.update({k: v for k, v in wb_data.items() if k not in imf_data})
    years = year_span({k: {y: v for y, v in s.items() if y >= FIRST_YEAR} for k, s in combined.items()})
    values = {iso3: to_series(s, years, 2) for iso3, s in imf_data.items() if any(y in s for y in years)}
    filled = _fill_from_world_bank(values, notes, notes_en, wb_data, years, 2)
    write_json(
        out / f"{key}.json",
        indicator_file(
            key, "%", years, values,
            projectionFrom=projection_from,
            aggregates={"WLD": to_series(imf_world, years, 2)},
            notes=notes,
            notesEn=notes_en,
        ),
    )
    _quantiles(key, values, years, projection_from - 1)
    if filled:
        print(f"  {key}：{len(filled)} 個地區用世界銀行補：{', '.join(filled)}")


def _debt_notes(imf_twn: dict[int, float]) -> tuple[str, str]:
    """台灣債務的附註：IMF 用的是財政部的公共債務法口徑，另外列出中央政府與較寬的範圍。"""
    debt, overview, gdp = mof.government_debt(), mof.public_debt_overview(), dgbas.gdp_by_industry()
    year = max(y for y in debt if y in overview and y in gdp and y in imf_twn)
    mof_ratio = debt[year]["各級政府總計占當年度GDP之比率"]
    for y in sorted(set(debt) & set(imf_twn)):
        if y >= 2001 and abs(debt[y]["各級政府總計占當年度GDP之比率"] - imf_twn[y]) > 0.15:
            print(f"  注意：{y} 年台灣債務 IMF {imf_twn[y]}%，財政部 {debt[y]['各級政府總計占當年度GDP之比率']}%")
    central = debt[year]["中央政府"] / gdp[year]["GDP"] * 100
    broad = (overview[year]["普通基金債務餘額"] + overview[year]["非營業基金債務餘額"]) / gdp[year]["GDP"] * 100
    zh = (
        f"IMF 的台灣數字就是財政部公布的各級政府 1 年以上非自償性債務（公共債務法的口徑），{year} 年占 GDP {mof_ratio:.1f}%，"
        f"其中中央政府 {central:.1f}%。這個口徑不含未滿 1 年的借款、自償性債務與非營業特種基金的債務，"
        f"全部加上是 {broad:.1f}%；其他國家是一般政府的全部債務，範圍比較寬"
    )
    en = (
        f"The IMF figure for Taiwan is the Ministry of Finance's long-term (1 year or more) non-self-liquidating debt of all "
        f"levels of government, as defined by the Public Debt Act: {mof_ratio:.1f}% of GDP in {year} (central government: "
        f"{central:.1f}%). It excludes short-term borrowing, self-liquidating debt and the debt of non-business "
        f"special funds; including them gives {broad:.1f}%. Other countries report all general government debt, a wider scope"
    )
    return zh, en


def _balance_notes(imf_twn: dict[int, float]) -> tuple[str, str]:
    balance = mof.budget_balance()
    for y in sorted(set(balance) & set(imf_twn)):
        if y >= 2001 and abs(balance[y] - imf_twn[y]) > 0.15:
            print(f"  注意：{y} 年台灣收支 IMF {imf_twn[y]}%，財政部 {balance[y]}%")
    year = max(y for y in balance if y in imf_twn)
    signed = f"{balance[year]:+.1f}".replace("-", "−")  # 跟前端 formatSignedPercent 一樣用真正的減號
    zh = (
        f"IMF 的台灣數字就是財政部的各級政府歲入歲出餘絀（總決算加特別決算），{year} 年占 GDP {signed}%。"
        "這是預算收支的口徑，不含債務還本，也不含勞保、健保等社會保險基金與非營業特種基金，跟其他國家的一般政府淨借貸範圍不同"
    )
    en = (
        f"The IMF figure for Taiwan is the Ministry of Finance's surplus or deficit of revenue over expenditure of all levels "
        f"of government (final accounts including special budgets): {signed}% of GDP in {year}. This budget "
        "measure excludes debt repayment as well as social insurance funds (labour and health insurance) and non-business "
        "special funds, so its scope differs from other countries' general government net lending"
    )
    return zh, en


# ── 物價水準 ─────────────────────────────────────────────────────

def _price_level(out, projection_from: int) -> None:
    """GDP（美元）÷ GDP（購買力平價）× 100 = 購買力平價 ÷ 匯率 × 100，美國剛好是 100。"""
    usd, usd_world = imf.fetch("NGDPD")
    ppp, ppp_world = imf.fetch("PPPGDP")

    def ratio(a: dict[int, float], b: dict[int, float]) -> dict[int, float]:
        return {y: a[y] / b[y] * 100 for y in a if b.get(y)}

    imf_data = {iso3: ratio(s, ppp.get(iso3, {})) for iso3, s in usd.items()}
    world = ratio(usd_world, ppp_world)
    # 世界銀行：人均 GDP（美元）÷ 人均 GDP（購買力平價）是同一個比率，用來補 IMF 沒有的地區，也拿來驗證
    wb_usd, _ = worldbank.fetch("NY.GDP.PCAP.CD", FIRST_YEAR)
    wb_ppp, _ = worldbank.fetch("NY.GDP.PCAP.PP.CD", FIRST_YEAR)
    wb_data = {iso3: r for iso3, s in wb_usd.items() if (r := ratio(s, wb_ppp.get(iso3, {})))}

    check_year = projection_from - 3
    diffs = [
        imf_data[c][check_year] / wb_data[c][check_year] - 1
        for c in imf_data if check_year in imf_data[c] and check_year in wb_data.get(c, {})
    ]
    close = sum(abs(d) < 0.02 for d in diffs)
    print(
        f"  物價水準 {check_year} 年 IMF 與世界銀行比對 {len(diffs)} 國：差距中位數 {statistics.median(diffs):+.1%}，"
        f"{close} 國在 ±2% 以內（差很多的多是官方匯率與市場匯率差距大的國家）"
    )

    combined = {**{k: v for k, v in wb_data.items() if k not in imf_data}, **imf_data}
    years = year_span({k: {y: v for y, v in s.items() if y >= FIRST_YEAR} for k, s in combined.items()})
    values = {iso3: to_series(s, years, 1) for iso3, s in imf_data.items() if any(y in s for y in years)}
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    filled = _fill_from_world_bank(values, notes, notes_en, wb_data, years, 1)
    write_json(
        out / "price-level.json",
        indicator_file(
            "price-level", "美國 = 100", years, values,
            projectionFrom=projection_from,
            aggregates={"WLD": to_series(world, years, 1)},
            notes=notes,
            notesEn=notes_en,
        ),
    )
    _quantiles("price-level", values, years, projection_from - 1)
    print(f"  price-level：{len(filled)} 個地區用世界銀行補：{', '.join(filled)}")


# ── 稅收 ─────────────────────────────────────────────────────────

def _ssc_breaks(total: dict[str, dict[int, float]], ssc: dict[str, dict[int, float]]) -> dict[str, tuple[int, float]]:
    """OECD 有些國家前面的年份沒有社會安全捐（中國 2019 年起才有社會保險基金的資料），總額在那一年突然跳高。

    條件：社會安全捐從不到 GDP 的 0.3% 跳到 1% 以上、之後都在 0.5% 以上，而且總額也跟著跳了至少一半
    （越南 2010 年只是把社會安全捐從中央政府改列出來，總額沒變，不算）。回傳 {iso3: (起始年, 那年占 GDP %)}。
    """
    breaks = {}
    for iso3, series in total.items():
        s = ssc.get(iso3, {})
        years = sorted(series)
        for prev, year in zip(years, years[1:]):
            if (
                s.get(prev, 0) < 0.3
                and s.get(year, 0) >= 1
                and series[year] - series[prev] >= s[year] / 2
                and all(s.get(y, 0) >= 0.5 for y in years if y > year)
            ):
                breaks[iso3] = (year, s[year])
    return breaks


def _tax_revenue(out) -> list[str]:
    oecd = oecd_revenue.total_tax_revenue()
    world_data, sector = imf_revenue.taxes_and_social_contributions()
    taxes, social = world_data["taxes"], world_data["social"]

    # 跟 OECD 都有的國家比一比，確認 IMF 的稅收加社會安全捐跟 OECD 的定義接得上
    diffs = [
        taxes[c][y] + social[c][y] - oecd[c][y]
        for c in oecd if c in social for y in oecd[c] if y in taxes.get(c, {}) and y in social[c]
    ]
    print(
        f"  稅收：IMF WoRLD（稅收＋社會安全捐）與 OECD 比對 {len(diffs)} 筆：差距中位數 {statistics.median(diffs):+.2f} 個百分點，"
        f"{sum(abs(d) < 2 for d in diffs) / len(diffs):.0%} 在 ±2 以內"
    )

    series = dict(oecd)
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    breaks = _ssc_breaks(oecd, oecd_revenue.social_security_contributions())
    for iso3, (year, share) in breaks.items():
        notes[iso3] = (
            f"OECD 的數字 {year} 年起才含社會安全捐（{year} 年占 GDP {share:.1f}%），之前的年份少了這一塊，"
            f"所以 {year} 年的跳升不是稅收真的增加"
        )
        notes_en[iso3] = (
            f"The OECD figures include social security contributions only from {year} ({share:.1f}% of GDP that year); "
            f"earlier years leave them out, so the jump in {year} is not a real rise in revenue"
        )
    print("  稅收：OECD 前面年份沒有社會安全捐的國家：" + "、".join(f"{c} {y}（{s:.1f}%）" for c, (y, s) in sorted(breaks.items())))
    filled = []
    for iso3, tax in taxes.items():
        if iso3 in oecd:
            continue
        has_social = iso3 in social
        # 有社會安全捐資料的國家只收兩項都有的年份，才不會有些年份突然少一塊
        series[iso3] = {y: v + social[iso3][y] for y, v in tax.items() if y in social[iso3]} if has_social else dict(tax)
        central = sector.get(iso3) == imf_revenue.CENTRAL
        notes[iso3] = (
            "OECD 全球稅收統計未涵蓋，改用 IMF 世界稅收資料庫（WoRLD）的稅收"
            + ("加社會安全捐" if has_social else "")
            + ("，只有中央政府" if central else "")
            + ("" if has_social else "，不含社會安全捐（IMF 沒有這項資料）")
        )
        notes_en[iso3] = (
            "Not in the OECD Global Revenue Statistics; IMF World Revenue Longitudinal Data (WoRLD) used instead: "
            + ("taxes plus social security contributions" if has_social else "taxes only, as the IMF has no data on social security contributions")
            + (", central government only" if central else "")
        )
        filled.append(iso3)

    series["TWN"] = mof.tax_burden()
    without, ssc = mof.tax_burden(with_social_security=False), mof.social_security()
    year = max(y for y in series["TWN"] if y in without and y in ssc)
    pension = ssc[year]["勞工退休基金(新制)"] / ssc[year]["社會安全捐合計"] * ssc[year]["占GDP比率"]
    notes["TWN"] = (
        "OECD 全球稅收統計沒有台灣，改用財政部依 OECD 稅收分類編的賦稅負擔率（含社會安全捐，2000 年起）：各級政府的賦稅收入"
        f"加社會安全捐。社會安全捐含勞保、健保、公教保、軍保、農保、國保、就業保險與退休基金提撥，{year} 年占 GDP "
        f"{ssc[year]['占GDP比率']:.1f}%（其中勞工退休金新制的個人帳戶提繳 {pension:.1f}%）；不含社會安全捐的賦稅負擔率是 {without[year]:.1f}%"
    )
    notes_en["TWN"] = (
        "Taiwan is not in the OECD Global Revenue Statistics, so the Ministry of Finance's tax burden ratio including social "
        "security contributions (from 2000, following the OECD classification) is used instead: tax revenue of all levels "
        "of government plus social security contributions. Contributions cover labour, health, civil servant, military, "
        f"farmer, national pension and employment insurance plus pension fund contributions, {ssc[year]['占GDP比率']:.1f}% "
        f"of GDP in {year} (of which {pension:.1f}% is the new labour pension scheme's individual accounts); excluding "
        f"social security contributions the ratio is {without[year]:.1f}%"
    )

    # 日本、澳洲、南非等約 20 國最新一年還沒公布（OECD 會晚一年），用 latestWithin 顯示前一年的值並標出資料年份，
    # 否則預設的最新一年日本會是灰的
    years = latest_year_span(series, TAX_LATEST_WITHIN)
    values = {iso3: to_series(s, years, 2) for iso3, s in series.items() if any(y in s for y in years)}
    write_json(
        out / "tax-revenue.json",
        indicator_file(
            "tax-revenue", "%", years, values, latestWithin=TAX_LATEST_WITHIN, notes=notes, notesEn=notes_en,
        ),
    )
    _quantiles("tax-revenue", values, years, years[-1])
    _quantiles("tax-revenue", values, years, years[-2])
    print(f"  tax-revenue：OECD {len(oecd)} 國，{len(filled)} 國用 IMF WoRLD 補：{', '.join(sorted(filled))}")
    return sorted(filled)


def build() -> None:
    release, projection_from = imf.weo_release()
    out = OUT_DIR / "topics" / "fiscal"

    _weo(out, "inflation", "PCPIPCH", "FP.CPI.TOTL.ZG", projection_from, {}, {})
    debt_zh, debt_en = _debt_notes(imf.fetch("GGXWDG_NGDP")[0].get("TWN", {}))
    _weo(out, "government-debt", "GGXWDG_NGDP", None, projection_from, {"TWN": debt_zh}, {"TWN": debt_en})
    balance_zh, balance_en = _balance_notes(imf.fetch("GGXCNL_NGDP")[0].get("TWN", {}))
    _weo(out, "fiscal-balance", "GGXCNL_NGDP", None, projection_from, {"TWN": balance_zh}, {"TWN": balance_en})
    _price_level(out, projection_from)
    tax_filled = _tax_revenue(out)
    build_food_share()
    fiscal_structure.build()

    write_json(
        out / "manifest.json",
        {
            "topic": "fiscal",
            "generatedAt": now_iso(),
            "source": (
                f"IMF World Economic Outlook ({release}); OECD Global Revenue Statistics; "
                "IMF World Revenue Longitudinal Data; World Bank WDI; 財政部財政統計資料庫"
            ),
            "projectionFrom": projection_from,
            "taxFilledFromImfWorld": tax_filled,
        },
    )
    print(f"  WEO {release}")


ICP_FOOD = ("https://api.worldbank.org/v2/sources/90/country/all/series/1101000/classification/AICZS/time/all"
            "?format=json&per_page=5000")


def build_food_share() -> None:
    """食物與非酒精飲料占個人實際消費的比例（%），ICP 2017、2021"""
    out = OUT_DIR / "topics" / "fiscal"
    with open(download(ICP_FOOD, "worldbank", "icp-food-share.json"), encoding="utf-8") as f:
        data = json.load(f)
    if data.get("pages", 1) > 1:
        raise RuntimeError("ICP 的食物支出超過一頁，需要分頁下載")
    series: dict[str, dict[int, float]] = {}
    for row in data["source"]["data"]:
        if row["value"] is None:
            continue
        var = {v["concept"]: v["id"] for v in row["variable"]}
        if iso3 := to_iso3(var["Country"]):
            series.setdefault(iso3, {})[int(var["Time"][2:])] = float(row["value"])
    years = sorted({y for v in series.values() for y in v})
    write_json(out / "food-share.json", indicator_file(
        "food-share", "%", years, {c: to_series(v, years, 1) for c, v in series.items()},
    ))
    last = years[-1]
    ranked = sorted((round(v[last], 1), c) for c, v in series.items() if last in v)
    print(f"  食物支出占消費 {years}：{len(ranked)} 國，最高 {ranked[-4:]}，最低 {ranked[:3]}，台灣 {series.get('TWN', {}).get(last)}")

