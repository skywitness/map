"""物價與財政主題的擴充（2026-10-30，製作手冊第六批 95）：政府支出的用途、稅收的組成、公共債務兩百年。

輸出到 public/data/topics/fiscal/（跟物價與財政同一個資料夾；`fiscal` 步驟最後也會跑這裡）：
- spending/{用途}.json：一般政府支出依用途（COFOG）占總支出的比例，IMF GFS_COFOG（約 88 國）。
  教育、醫療兩項在 IMF 沒有、或世界銀行 WDI 的最新一年比較新的國家，改用 WDI（UNESCO 的教育支出占政府支出、
  WHO 的國內政府衛生支出占政府支出，CC BY 4.0），附註寫明。WDI 的國防占政府支出標 SIPRI 條款，不用。
  台灣用財政部「各級政府歲出淨額-按政事別分」（i0121，政府資料開放平臺 8470）對到最接近的 COFOG 類別：
  教育科學文化 → 教育（含科學、文化，比 COFOG 寬）、國防 → 國防、社會福利＋退休撫卹 → 社會保障（社會福利含健保的
  政府補助等醫療支出）、一般政務＋債務 → 一般公共服務、經濟發展 → 經濟事務；醫療沒有單獨的政事別，台灣沒有值。
  民國 89 年度以前是 7 月制的會計年度（89 年度一年半），算比例不受影響，年份標在會計年度結束的那一年。
- tax-mix/{類別}.json：稅收（含社會安全捐）的組成，OECD Global Revenue Statistics（PT_OTR_SECTOR，占稅收總額）；
  個人所得稅（1100）、公司所得稅（1200）、社會安全捐（2000）、財產稅（4000）、商品與勞務稅（5000）。
  台灣用財政部依 OECD 稅收分類編的「賦稅收入結構」（i0807，2002 年起，占稅收總額 %），跟「物價與財政」的賦稅負擔率
  （i0801）是同一套分類。
- debt-history.json：政府總債務占 GDP，IMF Historical Public Debt（1800–2015，不再更新），不接到現在的政府債務
  （使用者決定另立一個指標）。台灣 HPD 有 1997 年起；1987–1996 年用財政部的中央政府債務（i0232，1 年以上非自償性、
  內債加外債）補，範圍比各級政府窄，附註寫明 1997 年的跳升是範圍不同。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, latest_year_span, to_series, write_json
from sources import imf_gfs, mof, oecd_revenue, worldbank

OUT = OUT_DIR / "topics" / "fiscal"
SPENDING_WITHIN = 3  # 各國最新一年差很多（2024 年 44 國、2023 年 21 國），地圖用 3 年內最近一年的值
TAX_WITHIN = 1  # 跟「稅收占 GDP」一樣

# 用途：id → (COFOG 代碼, WDI 代碼, 台灣的政事別欄位)
SPENDING = {
    "social": ("GF10", None, ["社會福利支出", "退休撫卹支出"]),
    "health": ("GF07", "SH.XPD.GHED.GE.ZS", None),
    "education": ("GF09", "SE.XPD.TOTL.GB.ZS", ["教育科學文化支出"]),
    "defence": ("GF02", None, ["國防支出"]),
    "public": ("GF01", None, ["一般政務支出", "債務支出"]),
    "economic": ("GF04", None, ["經濟發展支出"]),
}
WDI_NAME = {"SH.XPD.GHED.GE.ZS": ("WHO", "WHO"), "SE.XPD.TOTL.GB.ZS": ("UNESCO", "UNESCO")}
TW_SPENDING_NOTE = {
    "social": ("台灣用財政部各級政府歲出淨額的社會福利加退休撫卹支出（政事別，最接近 COFOG 的社會保障；社會福利含健保的政府補助等醫療支出）",
               "Taiwan: Ministry of Finance net expenditure of all levels of government, social welfare plus retirement and "
               "pensions (by function; the closest match to COFOG social protection; social welfare includes government "
               "health insurance subsidies)"),
    "education": ("台灣用財政部各級政府歲出淨額的教育科學文化支出（含科學與文化，比 COFOG 的教育寬）",
                  "Taiwan: Ministry of Finance net expenditure of all levels of government on education, science and "
                  "culture (wider than COFOG education)"),
    "defence": ("台灣用財政部各級政府歲出淨額的國防支出", "Taiwan: Ministry of Finance net expenditure of all levels of government on defence"),
    "public": ("台灣用財政部各級政府歲出淨額的一般政務加債務支出（最接近 COFOG 的一般公共服務）",
               "Taiwan: Ministry of Finance net expenditure of all levels of government on general administration plus "
               "debt service (the closest match to COFOG general public services)"),
    "economic": ("台灣用財政部各級政府歲出淨額的經濟發展支出", "Taiwan: Ministry of Finance net expenditure of all levels of government on economic development"),
}
TW_HEALTH = ("台灣的政事別沒有單獨的醫療支出（在社會福利裡），沒有可以比的數字",
             "Taiwan's functional classification has no separate health category (it is part of social welfare)")

# 稅收類別：id → OECD 代碼（台灣 i0807 的欄名也以同一個代碼開頭：「1100  個人」）
TAX_MIX = {
    "personal": "T_1100",
    "corporate": "T_1200",
    "ssc": "T_2000",
    "property": "T_4000",
    "goods": "T_5000",
}
TW_TAX_NOTE = ("OECD 沒有台灣，改用財政部依 OECD 稅收分類編的賦稅收入結構（各級政府，含社會安全捐）",
               "Taiwan is not in the OECD data; Ministry of Finance tax revenue structure following the OECD "
               "classification (all levels of government, including social security contributions)")


def _taiwan_spending() -> dict[str, dict[int, float]]:
    data = mof.table("i0121", 51, 11)
    out: dict[str, dict[int, float]] = {k: {} for k in SPENDING}
    for year, row in data.items():
        total = row.get("總計")
        if not total:
            continue
        for key, (_cofog, _wdi, cols) in SPENDING.items():
            if cols:
                out[key][year] = sum(row.get(c, 0.0) for c in cols) / total * 100
    return out


def build_spending() -> None:
    imf = imf_gfs.cofog([c for c, _w, _t in SPENDING.values()])
    tw = _taiwan_spending()
    for key, (cofog, wdi, _cols) in SPENDING.items():
        series = dict(imf[cofog])
        notes: dict[str, str] = {}
        notes_en: dict[str, str] = {}
        if wdi:
            wb, _ = worldbank.fetch(wdi, 1990)
            org_zh, org_en = WDI_NAME[wdi]
            used = []
            for iso3, s in wb.items():
                if iso3 in series and max(series[iso3]) >= max(s):
                    continue
                series[iso3] = s
                old = f"（IMF 的資料只到 {max(imf[cofog][iso3])} 年）" if iso3 in imf[cofog] else ""
                old_en = f" (IMF data end in {max(imf[cofog][iso3])})" if iso3 in imf[cofog] else ""
                notes[iso3] = f"IMF 的政府支出依用途沒有這國{old}，改用世界銀行 WDI 的數字（{org_zh}），定義不完全相同"
                notes_en[iso3] = (f"Not in the IMF expenditure-by-function data{old_en}; World Bank WDI figure ({org_en}) used "
                                  "instead, with a slightly different definition")
                used.append(iso3)
            print(f"  spending/{key}：IMF {len(imf[cofog])} 國，WDI 補 {len(used)} 國")
        if tw.get(key):
            series["TWN"] = tw[key]
            notes["TWN"], notes_en["TWN"] = TW_SPENDING_NOTE[key]
        years = latest_year_span(series, SPENDING_WITHIN)
        values = {c: to_series(s, years, 1) for c, s in series.items() if any(y in s for y in years)}
        extra = {"noValue": {"TWN": TW_HEALTH[0]}, "noValueEn": {"TWN": TW_HEALTH[1]}} if key == "health" else {}
        write_json(OUT / "spending" / f"{key}.json", indicator_file(
            f"spending/{key}", "%", years, values, latestWithin=SPENDING_WITHIN, notes=notes, notesEn=notes_en, **extra))
        last = {c: next((v for v in reversed(s) if v is not None), None) for c, s in values.items()}
        pick = {c: last.get(c) for c in ("USA", "CHN", "DEU", "JPN", "KOR", "TWN")}
        print(f"  spending/{key}.json：{years[0]}–{years[-1]}，{len(values)} 國；{pick}")


def build_tax_mix() -> None:
    oecd = oecd_revenue.tax_structure(list(TAX_MIX.values()))
    tw = mof.table("i0807", 91)
    for key, code in TAX_MIX.items():
        series = dict(oecd.get(code, {}))
        digits = code.removeprefix("T_")
        tw_series = {y: v for y, row in tw.items() for col, v in row.items() if col.split()[0] == digits}
        if not tw_series:
            raise RuntimeError(f"財政部 i0807 沒有 {digits} 這一欄：{list(next(iter(tw.values())))}")
        series["TWN"] = tw_series
        years = latest_year_span(series, TAX_WITHIN)
        values = {c: to_series(s, years, 1) for c, s in series.items() if any(y in s for y in years)}
        write_json(OUT / "tax-mix" / f"{key}.json", indicator_file(
            f"tax-mix/{key}", "%", years, values, latestWithin=TAX_WITHIN,
            notes={"TWN": TW_TAX_NOTE[0]}, notesEn={"TWN": TW_TAX_NOTE[1]}))
        pick = {c: series.get(c, {}).get(2023) for c in ("USA", "CHN", "DNK", "JPN", "KOR", "TWN")}
        print(f"  tax-mix/{key}.json：{years[0]}–{years[-1]}，{len(values)} 國；2023 年 {pick}")


def build_debt_history() -> None:
    hpd = imf_gfs.historical_debt()
    central = mof.table("i0232", 76, 6)
    first_hpd = min(hpd.get("TWN", {2016: 0}))
    tw_early = {}
    for year, row in central.items():
        if year < first_hpd and row.get("債務未償餘額(內債)") and "占當年度GDP之比率" in row:
            # 表裡只有內債的比率：依內債加外債的金額放大（外債很少，差 0–2%）
            tw_early[year] = row["占當年度GDP之比率"] * row["債務未償餘額(內債+外債)"] / row["債務未償餘額(內債)"]
    series = dict(hpd)
    series["TWN"] = {**tw_early, **hpd.get("TWN", {})}
    years = list(range(min(y for s in series.values() for y in s), max(y for s in series.values() for y in s) + 1))
    values = {c: to_series(s, years, 1) for c, s in series.items()}
    first = min(tw_early) if tw_early else first_hpd
    notes = {"TWN": (f"{first}–{first_hpd - 1} 年用財政部的中央政府債務（1 年以上非自償性，內債加外債）補，{first_hpd} 年起是 IMF 的"
                     f"各級政府債務（財政部公共債務法的口徑），{first_hpd} 年的跳升是範圍不同")}
    notes_en = {"TWN": (f"{first}–{first_hpd - 1}: Ministry of Finance central government debt (1 year or more, "
                        f"non-self-liquidating, domestic plus foreign); from {first_hpd}: IMF figure for all levels of "
                        f"government (Public Debt Act scope), so the jump in {first_hpd} reflects the wider scope")}
    write_json(OUT / "debt-history.json", indicator_file(
        "debt-history", "%", years, values, notes=notes, notesEn=notes_en))
    counts = {y: sum(1 for s in series.values() if y in s) for y in (1800, 1850, 1900, 1946, 2000, 2015)}
    print(f"  debt-history.json：{years[0]}–{years[-1]}，{len(values)} 國；有值的國家 {counts}；"
          f"英國 1819 {series['GBR'].get(1819):.0f}%、台灣 {first} {series['TWN'][first]:.1f}%")


def build() -> None:
    build_spending()
    build_tax_mix()
    build_debt_history()
