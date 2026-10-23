"""性別平等主題：女性勞動參與率、女性國會議員比例、性別薪資差距、性別不平等指數（GII）。

- 女性勞參率：ILO 模型估計（World Bank WDI 轉載，CC BY 4.0），15 歲以上。台灣用主計總處人力資源調查。
- 女性國會議員：IPU Parline（WDI 轉載），單一或下議院。台灣用中選會的歷屆立委當選人（第 7 屆起），
  2022–2023 年用性平處《性別圖像》的 42.9%（補選後）。
- 性別薪資差距：OECD（全職受僱者的中位數），約 45 國。ILO 的 EAR_GGAP 雖然有 124 國，但各國的來源、
  時薪或月薪混在一起，同一國前後年可以差好幾個百分點，阿富汗還有 −125%，所以沒用。
  台灣用主計總處受僱員工薪資調查的平均時薪（總薪資 ÷ 工時）自己算，跟勞動部公布的同一個方法。
- GII：UNDP 人類發展報告（CC BY 3.0 IGO）。台灣不在 UNDP 的報告裡，用性平處依同一公式計算的值。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, latest_year_span, now_iso, to_series, write_json, year_span
from sources import dgbas, oecd, undp, worldbank

TAIWAN = "TWN"
PAY_GAP_WITHIN = 4  # OECD 各國最新一年不同（2022–2025），地圖用 4 年內最近一年

# 立法院女性委員比例（%）：中選會歷屆立委選舉當選人（113 席），每屆從選舉那年的 2 月 1 日就職
LEGISLATORS = {
    2008: 34 / 113 * 100,  # 第 7 屆
    2012: 38 / 113 * 100,  # 第 8 屆
    2016: 43 / 113 * 100,  # 第 9 屆
    2020: 47 / 113 * 100,  # 第 10 屆
    2022: 42.9,  # 2022 年補選後，性平處《性別圖像》2025 年版
    2024: 47 / 113 * 100,  # 第 11 屆
}
# 性平處依 UNDP 公式計算的我國 GII（《性別圖像》各年版）
TAIWAN_GII = {2019: 0.045, 2021: 0.036, 2022: 0.041, 2023: 0.040}


def build() -> None:
    out = OUT_DIR / "topics" / "gender"

    lfp, lfp_world = worldbank.fetch("SL.TLF.CACT.FE.ZS", 1990)
    lfp[TAIWAN] = {y: v["female"] for y, v in dgbas.labour_force_participation_by_sex().items() if y >= 1990}

    parliament, parliament_world = worldbank.fetch("SG.GEN.PARL.ZS", 1990)
    last = max(y for s in parliament.values() for y in s)
    terms = sorted(LEGISLATORS)
    parliament[TAIWAN] = {
        y: LEGISLATORS[max(t for t in terms if t <= y)] for y in range(terms[0], last + 1)
    }

    gap, _ = oecd.series("OECD.ELS.SAE,DSD_EARNINGS@GENDER_WAGE_GAP,", AGGREGATION_OPERATION="MEDIAN")
    earnings, hours = dgbas.earnings_by_sex(), dgbas.hours_by_sex()
    gap[TAIWAN] = {
        y: (1 - (earnings[y]["female"] / hours[y]["female"]) / (earnings[y]["male"] / hours[y]["male"])) * 100
        for y in earnings if y in hours
    }

    gii, gii_world = undp.series("gii")
    gii[TAIWAN] = TAIWAN_GII

    tw_lfp_last = max(lfp[TAIWAN])
    indicators = {
        "female-lfp": ("%", lfp, lfp_world, 1, 0.3, (
            f"台灣不在 ILO 的模型估計裡，改用主計總處人力資源調查的 15 歲以上女性勞動力參與率（{tw_lfp_last} 年 {lfp[TAIWAN][tw_lfp_last]:.1f}%）。",
            f"Taiwan is not in the ILO modelled estimates; the female labour force participation rate (ages 15+) from "
            f"DGBAS's Manpower Survey is used instead ({lfp[TAIWAN][tw_lfp_last]:.1f}% in {tw_lfp_last}).",
        )),
        "parliament": ("%", parliament, parliament_world, 1, 0.3, (
            "台灣不在 IPU 的資料裡，改用中選會歷屆立法委員選舉的女性當選比例（第 7 屆起，113 席；不分區名單至少一半是女性）；"
            "2022–2023 年是補選後的 42.9%（性平處《性別圖像》）。",
            "Taiwan is not in the IPU data; the share of women elected to the Legislative Yuan in Central Election "
            "Commission results is used instead (from the 7th term, 113 seats; at least half of each party-list must "
            "be women); 42.9% for 2022–2023 after by-elections (Gender Equality Committee, Gender at a Glance).",
        )),
        "pay-gap": ("%", gap, {}, 1, 0.5, (  # OECD 平均不是世界，不放對照線
            "台灣不在 OECD 的資料裡，改用主計總處受僱員工薪資調查自己算的平均時薪差距（總薪資 ÷ 工時，男女相比），"
            "跟勞動部每年公布同酬日的方法相同。OECD 用的是全職受僱者的中位數，勞動部依中位數算的 2023 年是 12.3%，比平均時薪的差距小。",
            "Taiwan is not in the OECD data; the gap in mean hourly earnings (total earnings ÷ hours, women vs men) "
            "computed from DGBAS's earnings survey is used instead, the same method the Ministry of Labor uses for "
            "Equal Pay Day. The OECD uses median earnings of full-time employees; by the median the Ministry of Labor "
            "put Taiwan's 2023 gap at 12.3%, smaller than the hourly-mean gap.",
        )),
        "gii": ("", gii, gii_world, 3, 0.3, (
            "台灣不在 UNDP 的報告裡，用行政院性別平等處依同一公式計算的值（《性別圖像》）："
            "2023 年 0.040，在 173 國中排第 13 名。",
            "Taiwan is not in the UNDP report; values computed by the Executive Yuan's Gender Equality Committee with "
            "the same formula are used (Gender at a Glance): 0.040 in 2023, 13th of 173 countries.",
        )),
    }
    for key, (unit, series, world, digits, min_share, (note, note_en)) in indicators.items():
        extra: dict[str, object] = {"notes": {TAIWAN: note}, "notesEn": {TAIWAN: note_en}}
        if key == "pay-gap":
            years = latest_year_span(series, PAY_GAP_WITHIN, min_share)
            extra["latestWithin"] = PAY_GAP_WITHIN
        else:
            years = year_span(series, min_share)
        if world:
            extra["aggregates"] = {"WLD": to_series(world, years, digits)}
        write_json(out / f"{key}.json", indicator_file(
            key, unit, years, {c: to_series(s, years, digits) for c, s in series.items() if s}, **extra,
        ))
    write_json(out / "manifest.json", {
        "topic": "gender", "generatedAt": now_iso(),
        "source": "World Bank WDI (ILO, IPU); OECD; UNDP HDR; 主計總處; 中選會; 性平處",
    })
