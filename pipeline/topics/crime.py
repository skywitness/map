"""治安與司法主題：故意殺人率（全部、女性與男性被害人）、法治分數、監禁人口率。

- 故意殺人率（每十萬人）：World Bank WDI 轉載的 UNODC 國際殺人統計（VC.IHR.PSRC.P5，女性、男性是
  VC.IHR.PSRC.FE.P5、.MA.P5，分母是同性別的人口），CC BY 4.0，1990 年起。
  UNODC 自己的資料入口（data.unodc.org）也有，還多了被害人數與最新一年，但它的使用條款是聯合國網站的一般條款
  （只限個人、非商業使用，不得轉載或改作），所以用世界銀行以 CC BY 4.0 轉載的版本，跟觀光、水資源主題的做法一樣。
- 法治分數（0–100）：世界銀行 Worldwide Governance Indicators 的 Rule of Law（sources/wgi.py，CC BY 4.0，含台灣），
  綜合 30 多個調查與評估對警察、法院、契約與財產權、犯罪與暴力風險的看法，1996 年起。
- 各國不是每年都有殺人統計：故意殺人率的指標檔加 latestWithin，顯示 5 年內最近一年的值並標出資料年份。

**監禁人口率（每十萬人）只收有開放授權資料的國家**：涵蓋各國的 UNODC 資料入口（2025 年改版後條款不准轉載）
與 World Prison Brief（只寫「© World Prison Brief」）都不能用，所以改用各國、各區域自己的開放資料（使用者 2026-10-25 的決定）：
- 歐洲：Eurostat 監獄統計（CC BY 4.0）的「實際收容人數」（crim_pris_cap，2008 年起；1993–2007 年是舊的 crim_pris_pop）。
- 台灣：法務部法務統計年報表 4-1 的矯正機關總收容人數（sources/moj.py，政府資料開放授權條款）。
- 美國：BJS 的在監人數（監獄＋地方看守所，sources/bjs.py，公有領域）。
- 加拿大：加拿大統計局的省與聯邦監獄平均每日在監人數（sources/statcan.py，Statistics Canada Open Licence）。
- 澳洲：ABS《Prisoners in Australia》6 月 30 日的在監人數（sources/abs_prisoners.py，CC BY 4.0）。
- 日本：法務省犯罪白書的刑事施設年末收容人員（sources/moj_jp.py，公共データ利用規約 1.0）。
人數一律 ÷ WPP 的年中人口（跟其他主題同一個分母）；只有賽普勒斯用 Eurostat 公布的比率（WPP 的人口含北賽普勒斯）。
各國的定義差異寫在附註（notes）。沒有開放資料的國家在前端寫原因（src/topics/crime.ts 的 PRISON_COVERAGE，
這裡會檢查兩邊的國家清單一致）。

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

from common import OUT_DIR, ROOT, download, indicator_file, latest_year_span, now_iso, to_series, write_json
from sources import abs_prisoners, bjs, eurostat, moj, moj_jp, mohw_deaths, npa, statcan, wgi, worldbank, wpp

WITHIN = 5  # latestWithin：顯示 5 年內最近一年的值
LAST_YEAR = 2025  # WPP 人口取到這一年（2024 年起是推估）
OUT = OUT_DIR / "topics" / "crime"

# ── 監禁人口率 ──
PRISON_WITHIN = 3  # 每年都有的資料，偶爾缺一兩年：顯示 3 年內最近一年的值
FRONTEND = ROOT / "src" / "topics" / "crime.ts"  # PRISON_COVERAGE 要跟這裡算出來的國家一致
# 法國的監獄人數含海外省，WPP 的法國不含，分母加上這五個海外省
FRANCE_OVERSEAS = ("GLP", "MTQ", "REU", "GUF", "MYT")
UK_PARTS = ("UKC-L", "UKM", "UKN")  # 英格蘭與威爾斯、蘇格蘭、北愛爾蘭
# 法務部公布的監禁人口率（÷ 年底戶籍人口；行政院人權指標「每十萬人中收容於矯正機關之人數」），寫在台灣的附註對照
MOJ_RATE = (2025, 271.7)
# Eurostat 中繼資料（crim_sims）列出的例外：一般是 12 月 31 日
EUROSTAT_DAY = {
    "DNK": ("9 月 1 日", "1 September"),
    "DEU": ("11 月 30 日或 3 月 31 日", "30 November or 31 March"),
    "SVN": ("1 月 31 日", "31 January"),
    "SWE": ("10 月 1 日", "1 October"),
    "NOR": ("1 月 1 日", "1 January"),
    "CHE": ("隔年 1 月 31 日", "31 January of the following year"),
}

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


def _eurostat_prisoners() -> dict[str, dict[int, float]]:
    """Eurostat 的在監人數 {iso3: {年: 人}}：1993–2007 年 crim_pris_pop，2008 年起 crim_pris_cap 的實際收容人數；
    英國是三個司法轄區加起來（三個都有的年份才算）"""
    old = eurostat.series("crim_pris_pop", extra_geos=UK_PARTS, freq="A", unit="NR")
    new = eurostat.series("crim_pris_cap", extra_geos=UK_PARTS, freq="A", indic_cr="PRIS_ACT_CAP", unit="NR")
    merged: dict[str, dict[int, float]] = {}
    for geo in set(old) | set(new):
        s = {y: v for y, v in old.get(geo, {}).items() if y < 2008}
        s.update(new.get(geo, {}))
        merged[geo] = s
    parts = [merged.pop(p) for p in UK_PARTS]
    merged["GBR"] = {y: sum(p[y] for p in parts) for y in parts[0] if all(y in p for p in parts)}
    return merged


def _prison_notes(iso3: str, source: str, persons: dict[int, float], extra: dict | None = None) -> tuple[str, str]:
    """各國的附註：來源、定義（在哪裡、哪一天、含不含審前羈押與少年）與最近一年的人數"""
    y = max(persons)
    n = persons[y]
    if source == "eurostat":
        day_zh, day_en = EUROSTAT_DAY.get(iso3, ("12 月 31 日", "31 December"))
        zh = (
            f"Eurostat 監獄統計：{day_zh}在監獄、矯正機構裡的人（含審前羈押，不含移民拘留），"
            "2008 年起是 crim_pris_cap 的實際收容人數，2007 年以前是舊的 crim_pris_pop，兩者不完全可比；"
            f"÷ 聯合國 WPP 年中人口。{y} 年 {n:,.0f} 人"
        )
        en = (
            f"Eurostat prison statistics: persons held in prisons and correctional institutions on {day_en} "
            "(including pre-trial detainees, excluding immigration detention); actual number of persons held "
            f"(crim_pris_cap) from 2008, the older crim_pris_pop series before that, not fully comparable; ÷ UN WPP "
            f"mid-year population. {n:,.0f} persons in {y}"
        )
        if iso3 == "GBR":
            zh += f"。英國是英格蘭與威爾斯、蘇格蘭、北愛爾蘭三個司法轄區加起來，Eurostat 只到 {y} 年"
            en += f". The UK is the sum of England and Wales, Scotland and Northern Ireland; Eurostat stops in {y}"
        if iso3 == "FRA":
            zh += "。法國的人數含海外省，分母也加上瓜地洛普、馬丁尼克、留尼旺、法屬圭亞那、馬約特的人口（WPP 分開算）"
            en += ". France includes its overseas departments, so the denominator adds Guadeloupe, Martinique, Réunion, French Guiana and Mayotte (separate in WPP)"
        if iso3 == "CYP":
            zh = zh.replace("÷ 聯合國 WPP 年中人口", "用 Eurostat 公布的每十萬人比率（政府控制地區的人口；WPP 的人口含北賽普勒斯），2008 年起")
            en = en.replace("÷ UN WPP mid-year population", "using Eurostat's own rate per 100,000 (population of the government-controlled area; WPP includes northern Cyprus), from 2008")
        return zh, en
    if source == "moj":
        p = extra[y]
        zh = (
            f"法務部法務統計年報的矯正機關年底總收容人數 ÷ 聯合國 WPP 年中人口，{min(persons)} 年起。{y} 年底 {n:,.0f} 人："
            f"監獄收容人 {p['prison']:,.0f}、看守所被告及被管收人 {p['detainees']:,.0f}、受感化教育學生 {p['reform_school']:,.0f}、"
            f"收容少年 {p['juvenile_detention']:,.0f}、受觀察勒戒人與受戒治人 {p['drug_observation'] + p['drug_treatment']:,.0f}。"
            f"法務部公布的監禁人口率用年底戶籍人口當分母，{MOJ_RATE[0]} 年底是 {MOJ_RATE[1]}"
        )
        en = (
            f"Total persons held in correctional institutions at year end (Ministry of Justice statistical yearbook) ÷ UN WPP "
            f"mid-year population, from {min(persons)}. {n:,.0f} at the end of {y}: {p['prison']:,.0f} in prisons, {p['detainees']:,.0f} "
            f"defendants held in detention centres, {p['reform_school']:,.0f} in juvenile reform schools, "
            f"{p['juvenile_detention']:,.0f} in juvenile detention houses and {p['drug_observation'] + p['drug_treatment']:,.0f} "
            "in compulsory drug observation or treatment. The ministry's own rate uses the year-end registered population: "
            f"{MOJ_RATE[1]} at the end of {MOJ_RATE[0]}"
        )
        return zh, en
    if source == "bjs":
        return (
            f"美國司法統計局（BJS）的在監人數：州立與聯邦監獄（12 月 31 日）加上地方看守所（6 月最後一個平日，多半是候審的被告），"
            f"扣掉重複計算；不含少年矯正機構與移民拘留。÷ 聯合國 WPP 年中人口。{y} 年 {n:,.0f} 人",
            f"Bureau of Justice Statistics incarcerated population: state and federal prisons (31 December) plus local jails "
            f"(last weekday of June, mostly people awaiting trial), net of double counting; excludes juvenile facilities and "
            f"immigration detention. ÷ UN WPP mid-year population. {n:,.0f} persons in {y}",
        )
    if source == "statcan":
        return (
            f"加拿大統計局：省與地方監獄（含羈押候審）加上聯邦監獄的平均每日在監人數，會計年度（{y} 年 4 月到隔年 3 月）；"
            f"只算成年人，有轄區沒有報的年度不收。÷ 聯合國 WPP 年中人口。{y}/{y + 1} 年度平均 {n:,.0f} 人",
            f"Statistics Canada: average daily adult custody in provincial/territorial (including remand) and federal "
            f"institutions over the fiscal year (April {y} to March {y + 1}); adults only, years with a jurisdiction missing "
            f"are left out. ÷ UN WPP mid-year population. Average of {n:,.0f} in {y}/{y + 1}",
        )
    if source == "abs":
        return (
            f"澳洲統計局（ABS）《Prisoners in Australia》：6 月 30 日成人監獄裡的人（含未判決的羈押），不含少年拘留機構；"
            f"÷ 聯合國 WPP 年中人口（ABS 公布的是每十萬名成年人，比這裡高）。{y} 年 {n:,.0f} 人",
            f"Australian Bureau of Statistics, Prisoners in Australia: persons in adult custody on 30 June (including "
            f"unsentenced), excluding youth detention; ÷ UN WPP mid-year population (the ABS rate is per 100,000 adults, so it is higher). "
            f"{n:,.0f} persons in {y}",
        )
    if source == "moj-jp":
        return (
            f"日本法務省《犯罪白書》（矯正統計）：12 月 31 日刑事施設（刑務所、拘置所）的收容人員，含未決的被告人與被疑者，"
            f"不含少年院與入管的收容設施；÷ 聯合國 WPP 年中人口。{y} 年底 {n:,.0f} 人",
            f"Ministry of Justice of Japan, White Paper on Crime (correctional statistics): persons held in penal institutions "
            f"(prisons and detention houses) on 31 December, including unconvicted defendants and suspects, excluding juvenile "
            f"training schools and immigration detention; ÷ UN WPP mid-year population. {n:,.0f} persons at the end of {y}",
        )
    raise ValueError(source)


def _check_frontend_coverage(covered: set[str]) -> None:
    """前端用 PRISON_COVERAGE 決定哪些國家寫「沒有開放授權的資料」，要跟資料一致"""
    m = re.search(r"const PRISON_COVERAGE = '([A-Z ]+)'", FRONTEND.read_text(encoding="utf-8"))
    listed = set(m.group(1).split()) if m else set()
    if listed != covered:
        raise RuntimeError(
            f"{FRONTEND.name} 的 PRISON_COVERAGE 要改成 '{' '.join(sorted(covered))}'"
            f"（多了 {sorted(listed - covered)}，少了 {sorted(covered - listed)}）"
        )


def _prison(population: dict[str, dict[int, float]]) -> dict[str, list[str]]:
    """監禁人口率：各來源的在監人數 ÷ WPP 年中人口（千人）× 10 萬"""
    sources: dict[str, tuple[str, dict[int, float]]] = {
        iso3: ("eurostat", s) for iso3, s in _eurostat_prisoners().items() if s
    }
    tw = moj.corrections()
    sources["TWN"] = ("moj", {y: p["total"] for y, p in tw.items()})
    sources["USA"] = ("bjs", bjs.incarcerated())
    sources["CAN"] = ("statcan", statcan.custody())
    sources["AUS"] = ("abs", abs_prisoners.prisoners())
    sources["JPN"] = ("moj-jp", moj_jp.year_end_inmates())

    cyprus = eurostat.series("crim_pris_cap", freq="A", indic_cr="PRIS_ACT_CAP", unit="P_HTHAB").get("CYP", {})
    series: dict[str, dict[int, float]] = {}
    notes, notes_en = {}, {}
    for iso3, (source, persons) in sources.items():
        if iso3 == "CYP":
            rates = dict(cyprus)
            persons = {y: v for y, v in persons.items() if y in rates}
        else:
            pop = dict(population.get(iso3, {}))
            if iso3 == "FRA":
                for dom in FRANCE_OVERSEAS:
                    for y, v in population[dom].items():
                        pop[y] = pop.get(y, 0) + v
            if not pop:
                raise RuntimeError(f"WPP 沒有 {iso3} 的人口")
            rates = {y: n / (pop[y] * 1000) * 1e5 for y, n in persons.items() if y in pop}
        if not rates:
            continue
        series[iso3] = rates
        notes[iso3], notes_en[iso3] = _prison_notes(iso3, source, persons, tw if source == "moj" else None)

    years = latest_year_span(series, PRISON_WITHIN)
    values = {iso3: to_series(s, years, 1) for iso3, s in series.items() if any(y in s for y in years)}
    _check_frontend_coverage(set(values))
    write_json(
        OUT / "prison.json",
        indicator_file(
            "prison", "人/十萬人", years, values,
            latestWithin=PRISON_WITHIN, notes=notes, notesEn=notes_en,
        ),
    )
    by_source: dict[str, list[str]] = {}
    for iso3, (source, _) in sources.items():
        if iso3 in values:
            by_source.setdefault(source, []).append(iso3)
    print(f"  監禁人口率：{years[0]}–{years[-1]}，{len(values)} 國；" + "、".join(f"{k} {len(v)}" for k, v in by_source.items()))
    for iso3 in ("TWN", "USA", "JPN", "AUS", "CAN", "DEU", "GBR", "TUR"):
        s = series.get(iso3, {})
        if s:
            y = max(s)
            print(f"    {iso3} {y} 年 {s[y]:.1f}")
    return by_source


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

    prison = _prison(population["TPopulation1July"])

    write_json(
        OUT / "manifest.json",
        {
            "topic": "crime",
            "generatedAt": now_iso(),
            "sources": [
                "World Bank WDI VC.IHR.PSRC.P5 / .FE.P5 / .MA.P5 (UNODC International Homicide Statistics)",
                "World Bank, Worldwide Governance Indicators (GOV_WGI_RL.SC)",
                "衛生福利部死因統計、內政部警政署故意殺人概況、UN WPP 2024",
                "Eurostat crim_pris_cap (PRIS_ACT_CAP, NR; CYP: P_HTHAB) and crim_pris_pop (CC BY 4.0)",
                f"法務部法務統計年報表 4-1（{', '.join(f'{roc} 年版' for roc, _ in moj.EDITIONS)}，政府資料開放授權條款第 1 版）",
                "Bureau of Justice Statistics, Correctional Populations in the United States 2016, 2022, 2023 (public domain)",
                "Statistics Canada, Tables 35-10-0154-01 and 35-10-0155-01 (Statistics Canada Open Licence)",
                "Australian Bureau of Statistics, Prisoners in Australia 2025, Table 2 (CC BY 4.0)",
                f"法務省『令和7年版 犯罪白書』2-4-2-1図（{moj_jp.URL}，公共データ利用規約 第1.0版）",
            ],
            "prisonCoverage": {k: sorted(v) for k, v in prison.items()},
        },
    )
