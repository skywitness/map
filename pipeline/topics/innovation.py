"""研發與創新主題：研發經費占 GDP、研發經費總額（購買力平價）、每百萬人研究人員、專利申請（件數與每百萬人）。

- 研發經費與研究人員用世界銀行 WDI 轉載的 UNESCO 統計研究所（UIS）資料，專利用 WDI 轉載的 WIPO 資料，都是 CC BY 4.0。
  UIS 自己的資料庫是 CC BY-SA 4.0（衍生資料要用相同授權），WIPO 統計資料庫的使用條款不准轉載，所以都用世界銀行的版本。
- 台灣不在 UIS、WIPO 與世界銀行的資料裡：
  - 研發經費占 GDP：國科會「全國科技動態調查」的研發經費 ÷ 主計總處的名目 GDP。
  - 研究人員：國科會的研究人員全時約當數 ÷ 聯合國 WPP 年中人口（UIS 也是用 WPP 的人口）。
  - 專利：經濟部智慧財產局的本國人發明專利申請件數（不含新型、設計）。
- 研發經費總額 = 研發經費占 GDP × IMF WEO 的購買力平價 GDP（各國同一套換算，含台灣）。
- 研發調查很多國家隔一兩年才做一次，專利也有些國家漏報，所以指標檔加 latestWithin（研發 5 年、專利 3 年）。
- 世界值自己算（WDI 的世界值只平均當年有報的國家、用匯率換算的 GDP 加權，2020 年是 2.46%，UIS 公布的全球值是 1.93%）：
  - 研發經費占 GDP：有資料國家的研發經費加總 ÷ 這些國家的 GDP 加總（購買力平價），涵蓋世界 GDP 八成以上的年份才算。
  - 研究人員：有資料國家的研究人員加總 ÷ 這些國家的人口加總，涵蓋世界人口七成以上的年份才算。
  - 專利：WDI 的世界合計（WIPO 的全球總數，含歐洲專利局等區域專利局）加上台灣。
"""
from __future__ import annotations

from common import append_note, later_years_note, OUT_DIR, indicator_file, latest_year_span, now_iso, to_series, write_json
from sources import dgbas, imf, nstc, tipo, worldbank, wpp

Series = dict[str, dict[int, float]]

RD_WITHIN = 5  # 研發調查：很多國家隔一兩年才做一次
PATENT_WITHIN = 3  # 專利：每年都有，少數專利局某幾年漏報
GDP_COVERAGE = 0.8  # 有資料國家的 GDP（購買力平價）至少占世界多少，才算世界值
POPULATION_COVERAGE = 0.7  # 有資料國家的人口至少占世界多少，才算研究人員的世界值

NOTES = {
    "rd-spending": (
        "台灣不在 UNESCO／世界銀行資料庫中，改用國科會「全國科技動態調查」的研發經費除以主計總處的名目 GDP。"
        "GDP 用主計總處最新的修正值，跟國科會公布的比率可能略有差異",
        "Taiwan is not in the UNESCO/World Bank database; R&D spending from the National Science and Technology "
        "Council's national R&D survey divided by nominal GDP from DGBAS is used instead. GDP is DGBAS's latest "
        "revision, so the ratio can differ slightly from the one the council published",
    ),
    "rd-spending-total": (
        "台灣不在 UNESCO／世界銀行資料庫中，改用國科會「全國科技動態調查」的研發經費占 GDP（GDP 來自主計總處），"
        "再乘上 IMF 的購買力平價 GDP",
        "Taiwan is not in the UNESCO/World Bank database; R&D spending as a share of GDP from the National Science and "
        "Technology Council's national R&D survey (GDP from DGBAS) is multiplied by the IMF's GDP at purchasing power parity",
    ),
    "researchers": (
        "台灣不在 UNESCO／世界銀行資料庫中，改用國科會「全國科技動態調查」的研究人員全時約當數，除以聯合國年中人口",
        "Taiwan is not in the UNESCO/World Bank database; full-time-equivalent researchers from the National Science "
        "and Technology Council's national R&D survey divided by UN mid-year population are used instead",
    ),
    "patents-per-million": (
        "台灣不在 WIPO／世界銀行資料庫中，改用經濟部智慧財產局的本國人發明專利申請件數（依申請人國籍，"
        "WIPO 依居住地），除以聯合國年中人口；2007 年起",
        "Taiwan is not in the WIPO/World Bank database; invention patent applications by Taiwanese applicants from "
        "the Intellectual Property Office (by nationality, whereas WIPO uses residence) divided by UN mid-year "
        "population are used instead; from 2007",
    ),
    "patent-applications": (
        "台灣不在 WIPO／世界銀行資料庫中，改用經濟部智慧財產局的本國人發明專利申請件數（依申請人國籍，"
        "WIPO 依居住地；不含新型、設計專利）；2007 年起",
        "Taiwan is not in the WIPO/World Bank database; invention patent applications by Taiwanese applicants from "
        "the Intellectual Property Office (by nationality, whereas WIPO uses residence; excluding utility models and "
        "designs) are used instead; from 2007",
    ),
}


def latest(series: dict[int, float], year: int, within: int) -> tuple[int, float] | None:
    """year 往前 within 年內最近一年的 (年, 值)，跟前端的 latestAt() 同一個規則。"""
    found = [y for y in series if year - within <= y <= year]
    return (max(found), series[max(found)]) if found else None


def weighted_world(ratio: Series, weight: Series, world_weight: dict[int, float], years: list[int],
                   within: int, coverage: float) -> dict[int, float]:
    """世界值 = Σ(比率 × 權重) ÷ Σ 權重，各國都用前端地圖上顯示的那一年（latestWithin）。
    有資料國家的權重（當年）不到世界的 coverage 倍時不算，避免早年只有少數國家時失真。"""
    out: dict[int, float] = {}
    for year in years:
        num = den = covered = 0.0
        for iso, series in ratio.items():
            found = latest(series, year, within)
            if not found or found[0] not in weight.get(iso, {}):
                continue
            w = weight[iso][found[0]]
            num += found[1] * w
            den += w
            covered += weight[iso].get(year, w)
        if den and year in world_weight and covered >= world_weight[year] * coverage:
            out[year] = num / den
    return out


def taiwan() -> dict[str, dict[int, float]]:
    gdp = {y: v["GDP"] for y, v in dgbas.gdp_by_industry().items() if "GDP" in v}  # 新臺幣百萬元
    patents = tipo.invention_applications()
    return {
        "rd-spending": {y: v / gdp[y] * 100 for y, v in nstc.gerd().items() if y in gdp},
        "researchers": nstc.researchers_fte(),  # 人，之後除以人口
        "patents": patents["resident"],
    }


def build() -> None:
    out = OUT_DIR / "topics" / "innovation"
    tw = taiwan()
    population = {
        iso: {y: v * 1000 for y, v in s.items()}
        for iso, s in wpp.demographic(["TPopulation1July"], last_year=2030)["TPopulation1July"].items()
    }
    ppp_gdp, ppp_world = imf.fetch("PPPGDP")  # 十億國際元
    ppp_gdp = {iso: {y: v * 1e9 for y, v in s.items()} for iso, s in ppp_gdp.items()}
    ppp_world = {y: v * 1e9 for y, v in ppp_world.items()}

    def write(key: str, unit: str, years: list[int], series: Series, digits: int, world: dict[int, float],
              within: int, later: tuple[str, str] | None = None) -> None:
        values = {iso: to_series(s, years, digits) for iso, s in series.items()}
        notes, notes_en = {"TWN": NOTES[key][0]}, {"TWN": NOTES[key][1]}
        append_note(notes, notes_en, "TWN", later)  # 台灣比時間軸更新的年份（製作手冊第八批 159）
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso: s for iso, s in values.items() if any(v is not None for v in s)},
                latestWithin=within,
                aggregates={"WLD": to_series(world, years, digits)},
                notes=notes,
                notesEn=notes_en,
            ),
        )

    # ── 研發經費占 GDP、研發經費總額 ─────────────────────────
    rd, _ = worldbank.fetch("GB.XPD.RSDV.GD.ZS", 1960)
    last = max(y for s in rd.values() for y in s)  # 台灣可能比 WDI 多一年，不收
    rd["TWN"] = {y: v for y, v in tw["rd-spending"].items() if y <= last}
    years = latest_year_span(rd, RD_WITHIN)
    world = weighted_world(rd, ppp_gdp, ppp_world, years, RD_WITHIN, GDP_COVERAGE)
    write("rd-spending", "%", years, rd, 2, world, RD_WITHIN)

    total = {
        iso: {y: v / 100 * ppp_gdp[iso][y] for y, v in s.items() if y in ppp_gdp[iso]}
        for iso, s in rd.items() if iso in ppp_gdp
    }
    # 世界合計：有資料國家的加總（就是上面世界比率的分子），只算涵蓋率夠的年份
    world_total = {y: sum(found[1] for s in total.values() if (found := latest(s, y, RD_WITHIN))) for y in world}
    write("rd-spending-total", "國際元", years, total, 0, world_total, RD_WITHIN)
    print(f"  研發經費：{years[0]}–{years[-1]}，IMF 沒有購買力平價 GDP 的：{', '.join(sorted(set(rd) - set(ppp_gdp)))}")

    # ── 每百萬人研究人員 ────────────────────────────────────
    researchers, _ = worldbank.fetch("SP.POP.SCIE.RD.P6", 1960)
    last = max(y for s in researchers.values() for y in s)
    researchers["TWN"] = {
        y: v / population["TWN"][y] * 1e6 for y, v in tw["researchers"].items() if y <= last and y in population["TWN"]
    }
    years = latest_year_span(researchers, RD_WITHIN)
    world = weighted_world(researchers, population, population["WLD"], years, RD_WITHIN, POPULATION_COVERAGE)
    write("researchers", "人/百萬人", years, researchers, 0, world, RD_WITHIN)
    print(f"  研究人員：{years[0]}–{years[-1]}，世界值 {min(world)}–{max(world)} 年")

    # ── 專利申請（本國居民） ────────────────────────────────
    patents, patents_world = worldbank.fetch("IP.PAT.RESD", 1960)
    last = max(y for s in patents.values() for y in s)
    patents["TWN"] = {y: float(v) for y, v in tw["patents"].items() if y <= last}
    years = latest_year_span(patents, PATENT_WITHIN)
    # WIPO 的全球總數不含台灣（智慧局不是 WIPO 的會員），加回去
    world = {y: v + patents["TWN"].get(y, 0) for y, v in patents_world.items()}
    tw_patents = {y: float(v) for y, v in tw["patents"].items()}
    write("patent-applications", "件", years, patents, 0, world, PATENT_WITHIN, later_years_note(
        tw_patents, years, lambda v: f"{v:,.0f} 件", lambda v: f"{v:,.0f} applications"))

    per_million = {
        iso: {y: v / population[iso][y] * 1e6 for y, v in s.items() if y in population.get(iso, {})}
        for iso, s in patents.items()
    }
    world_per_million = {y: v / population["WLD"][y] * 1e6 for y, v in world.items() if y in population["WLD"]}
    tw_per_million = {y: v / population["TWN"][y] * 1e6 for y, v in tw_patents.items() if y in population["TWN"]}
    write("patents-per-million", "件/百萬人", years, per_million, 2, world_per_million, PATENT_WITHIN, later_years_note(
        tw_per_million, years, lambda v: f"每百萬人 {v:,.1f} 件", lambda v: f"{v:,.1f} per million people"))
    print(f"  專利：{years[0]}–{years[-1]}")

    write_json(
        out / "manifest.json",
        {
            "topic": "innovation",
            "generatedAt": now_iso(),
            "source": "World Bank WDI (UNESCO UIS, WIPO); 國科會; 經濟部智慧財產局; 行政院主計總處; IMF WEO; UN WPP 2024",
        },
    )
