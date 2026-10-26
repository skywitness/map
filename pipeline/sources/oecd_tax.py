"""OECD 的法定稅率（CC BY 4.0，2024 年 7 月起 OECD 資料與出版品的預設授權）：

- 營利事業所得稅（公司稅）：Corporate Tax Statistics 的法定稅率（SDMX `DSD_TAX_CIT@DF_CIT`），
  146 個轄區、2000–2026 年，含中央與地方合計的稅率（`CIT_C`）。沒有台灣、俄羅斯。
- 個人所得稅最高稅率與起徵點：OECD Tax Database 的表 I.7（SDMX `DSD_TAX_PIT@DF_PIT_TOP_EARN_THRESH`），
  OECD 38 個會員國、2000–2025 年。稅率含地方稅與附加稅（各級政府合計，`TS_PIT`），
  起徵點是「平均薪資的幾倍」（`TS_PIT_TH`、`FCTR_WG_A_SAL_A`）：以薪資總額計，已經加回各國標準的免稅額與扣除額。
- 勞動稅負（tax wedge）：Taxing Wages 的比較指標（SDMX `DSD_TAX_WAGES_COMP@DF_TW_COMP`），
  單身、沒有小孩、領平均薪資的受僱者，所得稅加勞雇雙方的社會安全捐占雇主總人事成本的比例，OECD 38 國、2000–2025 年。
- 加值型營業稅（VAT／GST）標準稅率：OECD《Consumption Tax Trends 2024》附錄表 2.A.1（2024 年 11 月出版，
  CC BY 4.0），OECD 會員國每年 1 月 1 日的標準稅率（2005、2008、2011、2014、2017、2020–2024 年）。
  OECD 沒有 VAT 的 SDMX 資料流，書的 PDF 程式讀不了（pdfreader 不支援這份 PDF 的格式），所以把表抄在 `VAT_CTT_2024`。
  - 抄的數字跟 OECD Tax Database 2024 年 6 月版的 VAT 表（vat-gst-rates-ctt-trends.xlsx，2024 年 7 月以前的版本，
    不是 CC BY 4.0，沒有用）重疊的年份逐一比過：只有盧森堡、土耳其 2023 年不同，因為那個檔的 2023 年是 9 月 1 日的稅率。
  - 2025、2026 年 1 月 1 日的稅率 = 2024 年的稅率加上 OECD《Tax Policy Reforms 2025》《Tax Policy Reforms 2026》
    （都是 CC BY 4.0）寫的標準稅率調整（`VAT_CHANGES`）；兩本涵蓋全部 OECD 會員國，表 3.10 只列了這幾國調整標準稅率。

OECD 的 SDMX API 不必金鑰，`format=csvfile` 是 CSV。
"""
from __future__ import annotations

import csv

from common import download

API = "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,{flow},/all?startPeriod=2000&format=csvfile"

# 2025 年的 OECD 會員國（38 國）；平均用這 38 國，跟 OECD 公布的平均一致
OECD_MEMBERS = (
    "AUS AUT BEL CAN CHL COL CRI CZE DNK EST FIN FRA DEU GRC HUN ISL IRL ISR ITA JPN KOR LVA LTU LUX MEX "
    "NLD NZL NOR POL PRT SVK SVN ESP SWE CHE TUR GBR USA"
).split()

Series = dict[str, dict[int, float]]


def _rows(flow: str, filename: str) -> list[dict[str, str]]:
    path = download(API.format(flow=flow), "oecd-tax", filename)
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if r.get("OBS_VALUE")]
    if not rows:
        raise RuntimeError(f"OECD {flow} 沒有資料，API 格式可能變了")
    return rows


def _series(rows: list[dict[str, str]], **match: str) -> Series:
    out: Series = {}
    for r in rows:
        if all(r[k] == v for k, v in match.items()):
            out.setdefault(r["REF_AREA"], {})[int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    if not out:
        raise RuntimeError(f"OECD 的資料裡找不到 {match}")
    return out


def corporate_rates() -> Series:
    """法定的公司稅率（中央加地方，%），{ISO3: {年: 稅率}}。地方稅率各地不同的國家（美國、德國、日本…）是 OECD 估的代表值。"""
    rows = _rows("DSD_TAX_CIT@DF_CIT", "cit.csv")
    return _series(rows, MEASURE="CIT_C", TARGETING="ST", SECTOR="S13")


def corporate_central_rates() -> Series:
    """只有中央政府的公司稅率（%），側欄說明地方稅占多少用"""
    rows = _rows("DSD_TAX_CIT@DF_CIT", "cit.csv")
    return _series(rows, MEASURE="CIT", TARGETING="ST", SECTOR="S1311")


def top_income_tax() -> tuple[Series, Series]:
    """(個人所得稅最高稅率 %, 最高稅率的起徵點是平均薪資的幾倍)。

    OECD 的表裡有兩個不可能的值，當成缺值（`IMPLAUSIBLE`）：拉脫維亞 2025 年兩個都是 0（拉脫維亞是累進稅率，
    最高一級不可能是 0），法國 2013 年的稅率是 122.8%（法定稅率不會超過 100%；2012、2014 年都是 54.5% 左右）。
    """
    rows = _rows("DSD_TAX_PIT@DF_PIT_TOP_EARN_THRESH", "pit-top.csv")
    rate = _series(rows, MEASURE="TS_PIT", UNIT_MEASURE="PT_WG_EARN_G")
    threshold = _series(rows, MEASURE="TS_PIT_TH", UNIT_MEASURE="FCTR_WG_A_SAL_A")
    for iso3, s in rate.items():
        for year in [y for y, v in s.items() if v <= 0 or v > 100]:
            del s[year]
            threshold.get(iso3, {}).pop(year, None)
    return rate, threshold


def average_wage() -> Series:
    """OECD 各國的平均年薪（本國貨幣），側欄換算起徵點的金額用"""
    rows = _rows("DSD_TAX_PIT@DF_PIT_TOP_EARN_THRESH", "pit-top.csv")
    return _series(rows, MEASURE="WGE", UNIT_MEASURE="XDC")


def tax_wedge() -> Series:
    """單身、沒有小孩、領平均薪資者的勞動稅負（占總人事成本 %）；含 OECD 公布的平均（`OECD_REP`）"""
    rows = _rows("DSD_TAX_WAGES_COMP@DF_TW_COMP", "tax-wedge.csv")
    return _series(
        rows, MEASURE="AV_TW", UNIT_MEASURE="PT_COS_LB", HOUSEHOLD_TYPE="S_C0", INCOME_PRINCIPAL="AW100", INCOME_SPOUSE="_Z"
    )


# ── 加值型營業稅（VAT／GST）的標準稅率 ─────────────────────────────────────────
VAT_SOURCE = (
    "OECD (2024), Consumption Tax Trends 2024: VAT/GST and Excise, Core Design Features and Trends, "
    "https://doi.org/10.1787/dcd4dd36-en, Annex Table 2.A.1 (CC BY 4.0)"
)
VAT_YEARS = (2005, 2008, 2011, 2014, 2017, 2020, 2021, 2022, 2023, 2024)
# Annex Table 2.A.1：每年 1 月 1 日的標準稅率（%），跟 VAT_YEARS 一一對應；哥斯大黎加 2019 年才開始課 VAT（2020 年起）。
# 美國沒有全國性的 VAT，不在表上。
VAT_CTT_2024: dict[str, tuple[float | None, ...]] = {
    "AUS": (10, 10, 10, 10, 10, 10, 10, 10, 10, 10),
    "AUT": (20, 20, 20, 20, 20, 20, 20, 20, 20, 20),
    "BEL": (21, 21, 21, 21, 21, 21, 21, 21, 21, 21),
    "CAN": (7, 5, 5, 5, 5, 5, 5, 5, 5, 5),
    "CHL": (19, 19, 19, 19, 19, 19, 19, 19, 19, 19),
    "COL": (16, 16, 16, 16, 19, 19, 19, 19, 19, 19),
    "CRI": (None, None, None, None, None, 13, 13, 13, 13, 13),
    "CZE": (19, 19, 20, 21, 21, 21, 21, 21, 21, 21),
    "DNK": (25, 25, 25, 25, 25, 25, 25, 25, 25, 25),
    "EST": (18, 18, 20, 20, 20, 20, 20, 20, 20, 22),
    "FIN": (22, 22, 23, 24, 24, 24, 24, 24, 24, 24),
    "FRA": (19.6, 19.6, 19.6, 20, 20, 20, 20, 20, 20, 20),
    "DEU": (16, 19, 19, 19, 19, 19, 19, 19, 19, 19),
    "GRC": (18, 19, 23, 23, 24, 24, 24, 24, 24, 24),
    "HUN": (25, 20, 25, 27, 27, 27, 27, 27, 27, 27),
    "ISL": (24.5, 24.5, 25.5, 25.5, 24, 24, 24, 24, 24, 24),
    "IRL": (21, 21, 21, 23, 23, 23, 23, 23, 23, 23),
    "ISR": (17, 15.5, 16, 18, 17, 17, 17, 17, 17, 17),
    "ITA": (20, 20, 20, 22, 22, 22, 22, 22, 22, 22),
    "JPN": (5, 5, 5, 5, 8, 10, 10, 10, 10, 10),
    "KOR": (10, 10, 10, 10, 10, 10, 10, 10, 10, 10),
    "LVA": (18, 18, 22, 21, 21, 21, 21, 21, 21, 21),
    "LTU": (18, 18, 21, 21, 21, 21, 21, 21, 21, 21),
    "LUX": (15, 15, 15, 15, 17, 17, 17, 17, 16, 17),
    "MEX": (15, 15, 16, 16, 16, 16, 16, 16, 16, 16),
    "NLD": (19, 19, 19, 21, 21, 21, 21, 21, 21, 21),
    "NZL": (12.5, 12.5, 15, 15, 15, 15, 15, 15, 15, 15),
    "NOR": (25, 25, 25, 25, 25, 25, 25, 25, 25, 25),
    "POL": (22, 22, 23, 23, 23, 23, 23, 23, 23, 23),
    "PRT": (19, 21, 23, 23, 23, 23, 23, 23, 23, 23),
    "SVK": (19, 19, 20, 20, 20, 20, 20, 20, 20, 20),
    "SVN": (20, 20, 20, 22, 22, 22, 22, 22, 22, 22),
    "ESP": (16, 16, 18, 21, 21, 21, 21, 21, 21, 21),
    "SWE": (25, 25, 25, 25, 25, 25, 25, 25, 25, 25),
    "CHE": (7.6, 7.6, 8, 8, 8, 7.7, 7.7, 7.7, 7.7, 8.1),
    "TUR": (18, 18, 18, 18, 18, 18, 18, 18, 18, 20),
    "GBR": (17.5, 17.5, 20, 20, 20, 20, 20, 20, 20, 20),
}
# 年中暫時調降（表上括號裡的稅率），1 月 1 日的稅率不受影響，附註寫出來
VAT_TEMPORARY = {
    "DEU": ("2020 年 7–12 月暫時降為 16%", "temporarily cut to 16% from July to December 2020"),
    "IRL": ("2020 年 9 月到 2021 年 2 月暫時降為 21%", "temporarily cut to 21% from September 2020 to February 2021"),
    "LUX": ("2023 年全年降為 16%（因應通膨），2024 年 1 月回到 17%", "cut to 16% for all of 2023 to ease inflation, back to 17% in January 2024"),
    "TUR": ("2023 年 7 月從 18% 調高為 20%", "raised from 18% to 20% in July 2023"),
}
# OECD《Tax Policy Reforms 2025》第 3.4.3 節、《Tax Policy Reforms 2026》表 3.10 與第 3.4.2 節的標準稅率調整：
# (生效的那一年 1 月 1 日起適用的年份, 新稅率, 附註)
VAT_CHANGES: dict[str, list[tuple[int, float, tuple[str, str]]]] = {
    "FIN": [(2025, 25.5, ("2024 年 9 月從 24% 調高為 25.5%", "raised from 24% to 25.5% in September 2024"))],
    "ISR": [(2025, 18, ("2025 年 1 月從 17% 調高為 18%", "raised from 17% to 18% in January 2025"))],
    "SVK": [(2025, 23, ("2025 年 1 月從 20% 調高為 23%", "raised from 20% to 23% in January 2025"))],
    "EST": [(2026, 24, ("2026 年 1 月從 22% 調高為 24%（OECD《Tax Policy Reforms 2026》）",
                        "raised from 22% to 24% from January 2026 (OECD, Tax Policy Reforms 2026)"))],
}
VAT_LATEST_YEARS = (2025, 2026)


def vat_rates() -> tuple[Series, dict[str, str], dict[str, str]]:
    """({ISO3: {年: 標準稅率 %}}, 中文附註, 英文附註)；年份是 VAT_YEARS 加上 2025、2026"""
    rates: Series = {}
    for iso3, values in VAT_CTT_2024.items():
        if len(values) != len(VAT_YEARS):
            raise RuntimeError(f"VAT_CTT_2024 的 {iso3} 有 {len(values)} 個值，應該是 {len(VAT_YEARS)} 個")
        s = {y: float(v) for y, v in zip(VAT_YEARS, values) if v is not None}
        current = s[VAT_YEARS[-1]]
        for year in VAT_LATEST_YEARS:
            for start, rate, _ in VAT_CHANGES.get(iso3, []):
                if start == year:
                    current = rate
            s[year] = current
        rates[iso3] = s
    zh: dict[str, str] = {}
    en: dict[str, str] = {}
    for iso3 in VAT_CTT_2024:
        parts = [VAT_TEMPORARY[iso3]] if iso3 in VAT_TEMPORARY else []
        parts += [note for _, _, note in VAT_CHANGES.get(iso3, [])]
        if parts:
            zh[iso3] = "；".join(p[0] for p in parts)
            joined = "; ".join(p[1] for p in parts)
            en[iso3] = joined[0].upper() + joined[1:]
    zh["CRI"] = "2019 年才開始課加值型營業稅，2020 年起才有數字"
    en["CRI"] = "Introduced VAT in 2019, so figures start in 2020"
    return rates, zh, en
