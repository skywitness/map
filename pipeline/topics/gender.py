"""性別平等主題：女性勞動參與率、女性國會議員比例、性別薪資差距、性別不平等指數（GII）。

- 女性勞參率：ILO 模型估計（World Bank WDI 轉載，CC BY 4.0），15 歲以上。台灣用主計總處人力資源調查。
- 女性國會議員：IPU Parline（WDI 轉載），單一或下議院。台灣用中選會的歷屆立委當選人（第 7 屆起），
  2022–2023 年用性平處《性別圖像》的 42.9%（補選後）。
- 性別薪資差距：OECD（全職受僱者的中位數），約 45 國。ILO 的 EAR_GGAP 雖然有 124 國，但各國的來源、
  時薪或月薪混在一起，同一國前後年可以差好幾個百分點，阿富汗還有 −125%，所以沒用。
  台灣用主計總處受僱員工薪資調查的平均時薪（總薪資 ÷ 工時）自己算，跟勞動部公布的同一個方法。
- GII：UNDP 人類發展報告（CC BY 3.0 IGO）。台灣不在 UNDP 的報告裡，用性平處依同一公式計算的值。
- 2026-10-29 擴充（製作手冊第五批 39，使用者決定；build_science() 可以單獨跑）：
  - STEM 畢業生的女性比例：世界銀行轉載 UNESCO UIS 的 SE.TER.GRAD.FE.SI.ZS（CC BY 4.0）。台灣沒有可比的資料，留白（前端的 noValue）。
  - 女性研究人員比例（人數）：UNESCO UIS 公開 API 的 FRESP.THC（UIS 自己的資料庫是 CC BY-SA 4.0，這個資料檔也用 CC BY-SA 4.0）。
    台灣用國科會「全國各研發執行部門研發人力統計資料_人數」（data.gov.tw 7563，政府資料開放授權條款）的全國研究人員男女人數
    自己算，跟 UIS 一樣是人數（不是全時約當）。
"""
from __future__ import annotations

import csv
import io
import json

from common import OUT_DIR, download, indicator_file, latest_year_span, now_iso, to_series, write_json, year_span
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

STEM = "SE.TER.GRAD.FE.SI.ZS"
# 荷屬聖馬丁的 STEM 畢業生只有個位數，比例是 100%，不收
STEM_SKIP = {"SXM"}
UIS_RESEARCHERS = "https://api.uis.unesco.org/api/public/data/indicators?indicator=FRESP.THC&start=1990&end=2025"
NSTC_RD = "https://mas.nstc.gov.tw/OPENDATA/GetFile?format=csv&serialno=53&fileodr=0"
SCIENCE_WITHIN = 5  # 隔幾年才有資料的國家多，地圖用 5 年內最近一年


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
    build_science()
    write_json(out / "manifest.json", {
        "topic": "gender", "generatedAt": now_iso(),
        "source": "World Bank WDI (ILO, IPU); OECD; UNDP HDR; 主計總處; 中選會; 性平處",
    })


def _nstc_researchers() -> dict[int, float]:
    """國科會的全國研究人員：年 → 女性占的比例（%，人數）"""
    path = download(NSTC_RD, "nstc", "rd-personnel-headcount.csv")
    out: dict[int, float] = {}
    for r in csv.DictReader(io.StringIO(path.read_bytes().decode("utf-8-sig"))):
        if r["執行部門"] != "全國" or r["類別"] != "人數":
            continue
        total, women = (float(r[k].replace(",", "")) for k in ("全國研發人力-研究人員", "女性研究人員"))
        out[int(r["年"])] = women / total * 100
    return out


def build_science() -> None:
    """STEM 畢業生的女性比例、女性研究人員比例（不用重跑其他指標）"""
    out = OUT_DIR / "topics" / "gender"
    stem, _ = worldbank.fetch(STEM, 1998)
    for iso in STEM_SKIP:
        stem.pop(iso, None)
    years = latest_year_span(stem, SCIENCE_WITHIN)
    write_json(out / "stem-graduates.json", indicator_file(
        "stem-graduates", "%", years, {c: to_series(v, years, 1) for c, v in stem.items() if v}, latestWithin=SCIENCE_WITHIN,
    ))

    path = download(UIS_RESEARCHERS, "uis", "FRESP.THC-1990-2025.json")
    researchers: dict[str, dict[int, float]] = {}
    for r in json.loads(path.read_text(encoding="utf-8"))["records"]:
        if r["indicatorId"] == "FRESP.THC" and r["value"] is not None and len(r["geoUnit"]) == 3:
            researchers.setdefault(r["geoUnit"], {})[int(r["year"])] = float(r["value"])
    researchers[TAIWAN] = _nstc_researchers()
    tw_last = max(researchers[TAIWAN])
    years = latest_year_span(researchers, SCIENCE_WITHIN)
    write_json(out / "women-researchers.json", indicator_file(
        "women-researchers", "%", years, {c: to_series(v, years, 1) for c, v in researchers.items() if v},
        latestWithin=SCIENCE_WITHIN, license="CC BY-SA 4.0",
        notes={TAIWAN: f"台灣不在 UNESCO 的資料裡，改用國科會研發人力統計的全國研究人員人數自己算（{tw_last} 年 {researchers[TAIWAN][tw_last]:.1f}%）。"},
        notesEn={TAIWAN: f"Taiwan is not in the UNESCO data; the share is computed from the National Science and Technology Council's "
                         f"headcount of researchers ({researchers[TAIWAN][tw_last]:.1f}% in {tw_last})."},
    ))
    for name, series in (("STEM 畢業生", stem), ("研究人員", researchers)):
        latest = {c: v[max(v)] for c, v in series.items() if v and max(v) >= 2015}
        ranked = sorted((round(v, 1), c) for c, v in latest.items())
        print(f"  女性占{name}（2015 年後最新一年）：{len(latest)} 國，最低 {ranked[:3]}，最高 {ranked[-3:]}，"
              f"台灣 {round(latest.get(TAIWAN, 0), 1) or '無'}")

