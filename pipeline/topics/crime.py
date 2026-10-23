"""治安與司法主題：故意殺人率（全部、女性與男性被害人）、法治分數。

- 故意殺人率（每十萬人）：World Bank WDI 轉載的 UNODC 國際殺人統計（VC.IHR.PSRC.P5，女性、男性是
  VC.IHR.PSRC.FE.P5、.MA.P5，分母是同性別的人口），CC BY 4.0，1990 年起。
  UNODC 自己的資料入口（data.unodc.org）也有，還多了被害人數與最新一年，但它的使用條款是聯合國網站的一般條款
  （只限個人、非商業使用，不得轉載或改作），所以用世界銀行以 CC BY 4.0 轉載的版本，跟觀光、水資源主題的做法一樣。
- 法治分數（0–100）：世界銀行 Worldwide Governance Indicators 的 Rule of Law（sources/wgi.py，CC BY 4.0，含台灣），
  綜合 30 多個調查與評估對警察、法院、契約與財產權、犯罪與暴力風險的看法，1996 年起。
- 各國不是每年都有殺人統計：故意殺人率的指標檔加 latestWithin，顯示 5 年內最近一年的值並標出資料年份。

**監禁人口率沒有放**：唯一涵蓋各國的開放來源是 UNODC 資料入口的「監獄與受刑人」，2025 年改版後條款不准轉載
（原本 dataunodc.un.org 的資料條款允許註明出處後轉載，舊網址現在都轉到新網站）；World Prison Brief（ICPR）
網站只寫「© World Prison Brief」，沒有授權轉載。台灣法務部的監禁人口率只寫在主題說明裡。

台灣不在 UNODC、世界銀行 WDI 的殺人統計中：
- 故意殺人率：衛福部死因統計（ICD-10 詳細分類）的他殺死亡人數（X85–Y09、Y87.1 加害的後遺症）÷ WPP 年中人口，
  2008 年起，女性、男性分開算（分母是 WPP 的女性、男性人口）。UNODC 算的是「故意殺人的被害人（死亡）」，
  衛福部的他殺死亡是同一個概念（WHO 的公共衛生來源也這樣算）。
  警政署的「故意殺人」發生數與被害人都含未遂，查詢網沒有分既遂、未遂，所以只寫在附註裡對照（sources/npa.py）。
- 法治分數：WGI 本身有台灣。
"""
from __future__ import annotations

import io
import re
import zipfile

import openpyxl

from common import OUT_DIR, download, indicator_file, latest_year_span, now_iso, to_series, write_json
from sources import mohw_deaths, npa, wgi, worldbank, wpp

WITHIN = 5  # latestWithin：顯示 5 年內最近一年的值
LAST_YEAR = 2025  # WPP 人口取到這一年（2024 年起是推估）
OUT = OUT_DIR / "topics" / "crime"

# 他殺：ICD-10 X85–Y09（加害）、Y87.1（加害的後遺症）
ASSAULT = re.compile(r"X(8[5-9]|9\d)\w?|Y0\d\w?|Y871")

# 指標 → (WDI 代碼, 衛福部死因統計的性別代碼（None 是男女合計）, WPP 的人口欄位)
HOMICIDE = {
    "homicide": ("VC.IHR.PSRC.P5", None, "TPopulation1July"),
    "homicide-female": ("VC.IHR.PSRC.FE.P5", "2", "TPopulationFemale1July"),
    "homicide-male": ("VC.IHR.PSRC.MA.P5", "1", "TPopulationMale1July"),
}
SEX_ZH = {None: "", "1": "男性", "2": "女性"}
SEX_EN = {None: "", "1": "male ", "2": "female "}


def _taiwan_homicide_deaths() -> dict[str | None, dict[int, float]]:
    """衛福部死因統計的他殺死亡人數 {性別代碼（None 是合計）: {西元年: 人}}，2008 年起"""
    path = download(mohw_deaths.URL, "mohw", "deaths-icd10.zip")
    with zipfile.ZipFile(path) as z:
        name = next(n for n in z.namelist() if n.endswith(".xlsx"))
        wb = openpyxl.load_workbook(io.BytesIO(z.read(name)), read_only=True, data_only=True)
    rows = wb[mohw_deaths.SHEET].iter_rows(values_only=True)
    header = next(rows)
    if header[:4] != ("year", "sex", "ICD", "sum_age_groups"):
        raise RuntimeError(f"死因統計的欄位變了：{header}")
    out: dict[str | None, dict[int, float]] = {None: {}, "1": {}, "2": {}}
    for row in rows:
        if not ASSAULT.fullmatch(str(row[2]).strip()):
            continue
        year, sex, n = int(row[0]), str(row[1]).strip(), float(row[3] or 0)
        if sex not in ("1", "2"):
            raise RuntimeError(f"死因統計的性別代碼變了：{row[:3]}")
        for key in (None, sex):
            out[key][year] = out[key].get(year, 0) + n
    if not out[None]:
        raise RuntimeError("死因統計找不到他殺死亡")
    return out


def build() -> None:
    columns = sorted({col for _code, _sex, col in HOMICIDE.values()})
    population = wpp.demographic(columns, LAST_YEAR)
    deaths = _taiwan_homicide_deaths()
    police = npa.homicide()

    for key, (code, sex, col) in HOMICIDE.items():
        series, world = worldbank.fetch(code)
        tw_pop = {y: v * 1000 for y, v in population[col]["TWN"].items()}  # 千人 → 人
        tw = deaths[sex]
        series["TWN"] = {y: n / tw_pop[y] * 1e5 for y, n in tw.items() if y in tw_pop}
        last = max(series["TWN"])
        note_zh = (
            f"台灣不在 UNODC 與世界銀行的資料中，改用衛福部死因統計的{SEX_ZH[sex]}他殺死亡人數（ICD-10 X85–Y09）"
            f"÷ 聯合國 WPP 的{SEX_ZH[sex]}年中人口，2008 年起；{last} 年 {tw[last]:.0f} 人"
        )
        note_en = (
            f"Taiwan is not in the UNODC or World Bank data; {SEX_EN[sex]}deaths from assault (ICD-10 X85–Y09) in the "
            f"Ministry of Health and Welfare's cause-of-death statistics ÷ UN WPP {SEX_EN[sex]}mid-year population, "
            f"from 2008; {tw[last]:.0f} deaths in {last}"
        )
        if sex is None:
            # 警政署的故意殺人含未遂，附在全部被害人的指標
            y = max(yr for yr in police if yr in tw)
            p = police[y]
            note_zh += (
                f"。警政署統計的「故意殺人」含未遂，沒有分開：{y} 年發生 {p['cases']} 件、被害人 {p['victims']} 人"
                f"（同年他殺死亡 {tw[y]:.0f} 人）。2024 年 9 月起警政署部分刑案改成一位被害人算一件"
            )
            note_en += (
                f". The National Police Agency's intentional homicide figures include attempts and are not split: "
                f"{p['cases']} cases and {p['victims']} victims in {y} (against {tw[y]:.0f} deaths from assault). "
                "Since September 2024 the police count some offences once per victim"
            )
        years = latest_year_span(series, WITHIN)
        values = {iso3: to_series(s, years, 2) for iso3, s in series.items() if any(y in s for y in years)}
        write_json(
            OUT / f"{key}.json",
            indicator_file(
                key, "人/十萬人", years, values,
                latestWithin=WITHIN,
                aggregates={"WLD": to_series(world, years, 2)},
                notes={"TWN": note_zh}, notesEn={"TWN": note_en},
            ),
        )
        print(f"  {key}：{years[0]}–{years[-1]}，{len(values)} 國；台灣 {last} 年 {series['TWN'][last]:.2f}")

    # ── 法治分數 ──
    rule = wgi.fetch("GOV_WGI_RL.SC")
    years = sorted({y for s in rule.values() for y in s})
    values = {iso3: to_series(s, years, 1) for iso3, s in rule.items()}
    write_json(OUT / "rule-of-law.json", indicator_file("rule-of-law", "分", years, values))
    print(f"  法治分數：{years[0]}–{years[-1]}，{len(values)} 國；台灣 {years[-1]} 年 {rule['TWN'][years[-1]]:.1f}")

    write_json(
        OUT / "manifest.json",
        {
            "topic": "crime",
            "generatedAt": now_iso(),
            "sources": [
                "World Bank WDI VC.IHR.PSRC.P5 / .FE.P5 / .MA.P5 (UNODC International Homicide Statistics)",
                "World Bank, Worldwide Governance Indicators (GOV_WGI_RL.SC)",
                "衛生福利部死因統計、內政部警政署故意殺人概況、UN WPP 2024",
            ],
        },
    )
