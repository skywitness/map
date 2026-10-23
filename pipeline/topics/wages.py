"""薪資與工時主題：受僱者平均月薪（美元、國際元）、法定每月最低工資（美元、國際元）、
就業者平均每週工時、就業者平均每年工時。

- 月薪、最低工資、每週工時用國際勞工組織 ILOSTAT（各國申報的調查與行政資料，沒有模型推估）。
  年份零散，指標檔加 latestWithin：前端顯示每個國家幾年內最近一年的值，並標出資料年份。
- 每年工時用 Penn World Table 11.0（本身有台灣，到 2023 年）。
- ILOSTAT 沒有台灣（不是 ILO 會員）：月薪用主計總處薪資及生產力統計、每週工時用人力資源調查、
  最低工資用勞動部公告的金額。美元用中央銀行的年平均匯率換算；國際元用民間消費的購買力平價，
  跟 ILOSTAT 用的世界銀行 PA.NUS.PRVT.PP 同一個概念（見 taiwan_ppp()）。
"""
from __future__ import annotations

from datetime import date

from common import OUT_DIR, indicator_file, latest_year_span, now_iso, to_series, write_json, year_span
from sources import cbc_fx, dgbas_wages, ilostat, imf, mol, pwt

Series = dict[str, dict[int, float]]

EARNINGS = "EAR_EMTA_SEX_CUR_NB_A"  # 受僱者平均月薪，依性別與貨幣（本國貨幣、美元、國際元）
MINIMUM_WAGE = "EAR_INEE_CUR_NB_A"  # 法定每月最低工資，依貨幣
WEEKLY_HOURS = "HOW_TEMP_SEX_NB_A"  # 就業者平均每週實際工時（世界值 X01 是 ILO 的模型估計）

# 每個國家顯示幾年內最近一年的值（latestWithin）。金額會隨物價與匯率變，只往前找 3 年；工時變化慢，找 5 年
WITHIN = {"earnings": 3, "minimum-wage": 3, "weekly-hours": 5}

# 世界銀行（ILOSTAT）的民間消費 PPP 以 2021 年 ICP 為基準，之後各年用兩國的消費者物價漲幅推算
PPP_BENCHMARK = 2021

# ── ILOSTAT 已知的錯誤（2026 年 10 月下載的版本；ILOSTAT 修正後可以拿掉） ──
# 柬埔寨的最低工資本來就用美元訂（成衣、製鞋業，2023 年 200 美元），ILOSTAT 當成瑞爾再換算，美元值只剩 0.05。
# 本國貨幣欄的數字直接當美元，國際元乘回 ILOSTAT 用的匯率
USD_DENOMINATED = {MINIMUM_WAGE: {"KHM"}}
# 美元、國際元都不收的值：(國家, 年份)
DROP = {
    # 厄瓜多、烏拉圭 2024 年是月薪除以 12（39.2 美元、1,855.7 披索；2023 年是 450 美元、22,268 披索）
    MINIMUM_WAGE: {("ECU", 2024), ("URY", 2024)},
    # 馬爾他 2000–2008 年只有 2–10 美元，是時薪；埃及 2008、2009 年只有 13、43 美元（前後年 130–200 美元）
    EARNINGS: {("MLT", y) for y in range(2000, 2009)} | {("EGY", 2008), ("EGY", 2009)},
}
# 只有美元不收：黎巴嫩 2020–2022 年仍用 1 美元 = 1,507.5 鎊的官方匯率換算（市場匯率已跌到幾萬鎊），
# 2022 年的最低工資會變成 1,725 美元，比日本還高。國際元用的是購買力平價，不受影響
DROP_USD = {MINIMUM_WAGE: {("LBN", 2020), ("LBN", 2021), ("LBN", 2022)}}
# 同一筆資料的國際元 ÷ 美元（= 匯率 ÷ 購買力平價），清掉下面這些之後 98% 在 0.68–4.7 之間、全部在 0.37–8.2；
# 超出 0.25–10 倍的是國際元換算錯了
# （匈牙利 1995、2002，塞爾維亞 2002–2012，捷克 1996，薩爾瓦多 1998–2000 只有個位數或幾千國際元），不收國際元
PPP_TO_USD = (0.25, 10)

# 被修正過的國家的附註：{資料集: {國家: (哪些檔, 中文, 英文)}}
CORRECTION_NOTES = {
    MINIMUM_WAGE: {
        "KHM": (
            ("usd", "ppp"),
            "柬埔寨的最低工資是用美元訂的（成衣、製鞋業），ILOSTAT 誤當成瑞爾換算，這裡改回原本的美元金額",
            "Cambodia sets its minimum wage in US dollars (garment and footwear sector); ILOSTAT converts it as if it "
            "were in riels, so the original dollar amount is used here",
        ),
        "LBN": (
            ("usd",),
            "ILOSTAT 2020–2022 年用 1 美元 = 1,507.5 鎊的官方匯率換算，市場匯率早已大幅貶值，所以這幾年不列美元值",
            "ILOSTAT converts 2020–2022 at the official rate of 1,507.5 pounds per US dollar, long after the market rate "
            "collapsed, so US dollar values for those years are left out",
        ),
    },
}


def ilo_money(dataset: str) -> dict[str, Series]:
    """ILOSTAT 的金額（美元、國際元），修正上面列出的錯誤。"""
    usd = ilostat.fetch(dataset, "CUR_TYPE_USD")[0]
    ppp = ilostat.fetch(dataset, "CUR_TYPE_PPP")[0]
    lcu = ilostat.fetch(dataset, "CUR_TYPE_LCU")[0]
    for iso3 in USD_DENOMINATED.get(dataset, set()):
        for year, value in list(usd[iso3].items()):
            if year not in lcu.get(iso3, {}):
                continue
            rate = lcu[iso3][year] / value  # ILOSTAT 用的本國貨幣／美元
            usd[iso3][year] = lcu[iso3][year]
            if year in ppp.get(iso3, {}):
                ppp[iso3][year] *= rate
    for iso3, year in DROP.get(dataset, set()):
        usd.get(iso3, {}).pop(year, None)
        ppp.get(iso3, {}).pop(year, None)
    for iso3, year in DROP_USD.get(dataset, set()):
        usd.get(iso3, {}).pop(year, None)
    low, high = PPP_TO_USD
    for iso3, series in ppp.items():
        bad = [y for y, v in series.items() if y in usd.get(iso3, {}) and not low <= v / usd[iso3][y] <= high]
        for year in bad:
            del series[year]
    return {"usd": usd, "ppp": ppp}


def taiwan_ppp() -> dict[int, float]:
    """台灣民間消費的購買力平價（新臺幣／國際元）。

    ILOSTAT 換算國際元用世界銀行的民間消費 PPP（PA.NUS.PRVT.PP，2022 年以後是 2021 年的值乘上
    該國與美國消費者物價漲幅的比，用這個算法重推世界銀行自己的 2022–2024 年值，中位數誤差 0.1%）。
    台灣不在世界銀行的資料裡：
    - 2021 年以前用 PWT 11.0 的家庭消費價格水準 × 匯率 ÷ 美國的家庭消費價格水準（同一個概念；
      2017、2019、2021 年各國跟世界銀行的中位數差距 1.4–1.9%）。
    - 2022 年起照世界銀行的方法，用 IMF WEO 的消費者物價年增率（台灣 ÷ 美國）往後推。
    IMF 的 PPPEX 是整體 GDP 的購買力平價，台灣的值比民間消費的低 6–10%，用它會高估台灣的國際元月薪。
    """
    ppp = {y: v for y, v in pwt.consumption_ppp("TWN").items() if y <= PPP_BENCHMARK}
    inflation = imf.fetch("PCPIPCH")[0]
    year = PPP_BENCHMARK + 1
    while year in inflation["TWN"] and year in inflation["USA"] and year <= date.today().year:
        ppp[year] = ppp[year - 1] * (1 + inflation["TWN"][year] / 100) / (1 + inflation["USA"][year] / 100)
        year += 1
    return ppp


def convert(ntd: dict[int, float], rate: dict[int, float]) -> dict[int, float]:
    return {y: v / rate[y] for y, v in ntd.items() if y in rate}


def span(series: Series, within: int) -> list[int]:
    """latestWithin 的指標：開頭依 within 年內有資料的國家數（latest_year_span），結尾依當年實際有資料的國家數
    （year_span），否則最低工資會延伸到只有一兩國公布的 2026 年，地圖上幾乎都是兩年前的值。"""
    last = year_span(series)[-1]
    return [y for y in latest_year_span(series, within) if y <= last]


def write_indicator(key: str, unit: str, series: Series, years: list[int], digits: int, **extra: object) -> None:
    values = {iso3: to_series(s, years, digits) for iso3, s in series.items()}
    write_json(
        OUT_DIR / "topics" / "wages" / f"{key}.json",
        indicator_file(key, unit, years, {k: v for k, v in values.items() if any(x is not None for x in v)}, **extra),
    )


def correction_notes(dataset: str, currency: str) -> tuple[dict[str, str], dict[str, str]]:
    """(notes, notesEn)：這個檔裡被修正過的國家"""
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    for iso3, (files, zh, en) in CORRECTION_NOTES.get(dataset, {}).items():
        if currency in files:
            notes[iso3], notes_en[iso3] = zh, en
    return notes, notes_en


def fmt(value: float, digits: int = 0) -> str:
    return f"{value:,.{digits}f}"


def build() -> None:
    fx = cbc_fx.ntd_per_usd()
    ppp = taiwan_ppp()
    pppex = imf.fetch("PPPEX")[0]["TWN"]

    # ── 平均月薪 ───────────────────────────────────────────
    earnings_ntd = dgbas_wages.monthly_earnings()
    regular_ntd = dgbas_wages.monthly_regular_earnings()
    taiwan = {"usd": convert(earnings_ntd, fx), "ppp": convert(earnings_ntd, ppp)}
    money = ilo_money(EARNINGS)
    for currency, unit in (("usd", "美元/月"), ("ppp", "國際元/月")):
        countries = money[currency]
        countries["TWN"] = taiwan[currency]
        years = span(countries, WITHIN["earnings"])
        y = max(y for y in taiwan[currency] if y in years)
        if currency == "usd":
            how = f"以中央銀行的年平均匯率換算（{y} 年 1 美元 = {fx[y]:.2f} 新臺幣）"
            how_en = f"converted at the Central Bank's annual average exchange rate (NT${fx[y]:.2f} per US$ in {y})"
        else:
            how = (
                f"用民間消費的購買力平價換算，跟 ILOSTAT 用的世界銀行 PPP 同一個概念：{PPP_BENCHMARK} 年以前用 Penn World Table，"
                f"之後依台灣與美國的消費者物價漲幅往後推（{y} 年 1 國際元 = {ppp[y]:.2f} 新臺幣）。"
                f"IMF 的 GDP 購買力平價較低（{pppex[y]:.2f}），用它換算會是 {fmt(earnings_ntd[y] / pppex[y])} 國際元"
            )
            how_en = (
                "converted at the purchasing power parity for household consumption, the same concept as the World Bank PPP "
                f"that ILOSTAT uses: from the Penn World Table up to {PPP_BENCHMARK}, then carried forward with Taiwan's and "
                f"US consumer price inflation (NT${ppp[y]:.2f} per international dollar in {y}). The IMF's GDP-wide PPP is "
                f"lower ({pppex[y]:.2f}) and would give Int${fmt(earnings_ntd[y] / pppex[y])}"
            )
        write_indicator(
            f"monthly-earnings-{currency}", unit, countries, years, 1,
            latestWithin=WITHIN["earnings"],
            notes={"TWN": (
                "ILOSTAT 沒有台灣（不是國際勞工組織會員），改用主計總處薪資及生產力統計的工業及服務業受僱員工"
                "每人每月總薪資（全年平均，含加班費、年終與績效獎金等非經常性薪資；不含農林漁牧業與公共行政），"
                f"{how}。{y} 年總薪資 {fmt(earnings_ntd[y])} 元，其中經常性薪資 {fmt(regular_ntd[y])} 元"
            )},
            notesEn={"TWN": (
                "Taiwan is not in ILOSTAT (it is not an ILO member); average monthly total earnings of employees in industry "
                "and services from the DGBAS Earnings and Productivity Survey used instead (annual average, including "
                "overtime pay, year-end and performance bonuses; excluding agriculture and public administration), "
                f"{how_en}. Total earnings were NT${fmt(earnings_ntd[y])} in {y}, of which regular earnings NT${fmt(regular_ntd[y])}"
            )},
        )

    # ── 最低工資 ───────────────────────────────────────────
    minimum_ntd = mol.monthly()
    taiwan = {"usd": convert(minimum_ntd, fx), "ppp": convert(minimum_ntd, ppp)}
    money = ilo_money(MINIMUM_WAGE)
    for currency, unit in (("usd", "美元/月"), ("ppp", "國際元/月")):
        countries = money[currency]
        countries["TWN"] = taiwan[currency]
        notes, notes_en = correction_notes(MINIMUM_WAGE, currency)
        years = span(countries, WITHIN["minimum-wage"])
        y = max(y for y in taiwan[currency] if y in years)
        later = [year for year in sorted(minimum_ntd) if year > y]  # 其他國家還沒公布、時間軸截掉的年份
        write_indicator(
            f"minimum-wage-{currency}", unit, countries, years, 1,
            latestWithin=WITHIN["minimum-wage"],
            notes={**notes, "TWN": (
                "ILOSTAT 沒有台灣，改用勞動部公告的每月基本工資（2025 年起改稱最低工資），取每年 7 月 1 日適用的金額"
                f"（ILOSTAT 對年中調整的國家也是這樣取），{'用中央銀行的年平均匯率' if currency == 'usd' else '用民間消費的購買力平價（同平均月薪）'}換算。"
                + "、".join(f"{year} 年 {fmt(minimum_ntd[year])} 元" for year in [y, *later])
            )},
            notesEn={**notes_en, "TWN": (
                "Taiwan is not in ILOSTAT; the monthly basic wage announced by the Ministry of Labor (called the minimum wage "
                "from 2025) used instead, taking the amount in force on 1 July of each year (as ILOSTAT does for countries "
                "that change it mid-year), converted at "
                f"{'the Central Bank annual average exchange rate' if currency == 'usd' else 'the household consumption PPP (as for average earnings)'}. "
                + ", ".join(f"NT${fmt(minimum_ntd[year])} in {year}" for year in [y, *later])
            )},
        )

    # ── 每週工時 ───────────────────────────────────────────
    countries, world = ilostat.fetch(WEEKLY_HOURS)
    weekly = dgbas_wages.weekly_hours()
    countries["TWN"] = weekly
    years = span(countries, WITHIN["weekly-hours"])
    first = min(weekly)
    write_indicator(
        "weekly-hours", "小時/週", countries, years, 2,
        latestWithin=WITHIN["weekly-hours"],
        aggregates={"WLD": to_series(world, years, 2)},
        notes={"TWN": (
            "ILOSTAT 沒有台灣，改用主計總處人力資源調查的就業者平均每週主要工作時數（含自營作業者與雇主），"
            f"{first} 年起才有開放資料。這項調查每個月只問一週的工時，遇到連假、颱風或疫情會影響當年的平均，"
            f"所以各年起伏較大（例如 {'、'.join(f'{y} 年 {weekly[y]:.1f}' for y in sorted(weekly)[-3:])} 小時）"
        )},
        notesEn={"TWN": (
            "Taiwan is not in ILOSTAT; average weekly hours in the main job of all employed persons (including the "
            f"self-employed and employers) from the DGBAS Manpower Survey used instead, available as open data from {first}. "
            "The survey asks about one reference week a month, so holidays, typhoons or the pandemic can move the yearly "
            f"average ({', '.join(f'{weekly[y]:.1f} hours in {y}' for y in sorted(weekly)[-3:])})"
        )},
    )

    # ── 每年工時（PWT） ─────────────────────────────────────
    countries = pwt.variable("avh")
    years = year_span(countries)
    monthly_hours = dgbas_wages.monthly_hours()
    y = max(countries["TWN"])
    write_indicator(
        "annual-hours", "小時/年", countries, years, 1,
        notes={"TWN": (
            f"Penn World Table 本身有台灣（{y} 年 {fmt(countries['TWN'][y])} 小時，含自營作業者）。"
            f"對照：主計總處薪資及生產力統計的受僱員工每月工時 × 12 是 {fmt(monthly_hours[y] * 12)} 小時"
            "（勞動部國際比較用的算法，只算工業及服務業的受僱員工）"
        )},
        notesEn={"TWN": (
            f"The Penn World Table covers Taiwan itself ({fmt(countries['TWN'][y])} hours in {y}, including the self-employed). "
            "For comparison, monthly hours of employees in industry and services from the DGBAS Earnings and Productivity "
            f"Survey × 12 give {fmt(monthly_hours[y] * 12)} hours (the method the Ministry of Labor uses in its international comparisons)"
        )},
    )

    write_json(
        OUT_DIR / "topics" / "wages" / "manifest.json",
        {
            "topic": "wages",
            "generatedAt": now_iso(),
            "source": f"ILOSTAT; Penn World Table {pwt.VERSION}; 主計總處; 勞動部; 中央銀行; IMF WEO",
        },
    )
