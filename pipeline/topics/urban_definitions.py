"""城市的擴充：都市化率的兩種算法（製作手冊第十七批 269，2026-11-02）。

- urban-national.json：依各國自己的都市定義，都市人口占幾 %（聯合國 WUP 2025 的 File 15，sources/un_wup.national_urban()），
  1950–2050 年每年，2025 年起是推估。各國的定義差很多：日本是「市」的人口（5 萬人以上、六成住在市街地…），
  台灣是都市計畫區內的人口（聯合國用國發會的《都市及區域發展統計彙編》）。
- urban-gap.json：各國自己的定義減去統一定義的都市化率（城市主題原本的「都市化率」：城鄉程度的城市＋城鎮與半密集區，
  GHS-WUP，sources/ghsl_wup.py），百分點；兩邊都有的年份（1950–2050 年每 5 年）。負的是自己的定義算得比較少。
  比的是「城市＋城鎮」不是只有「城市」：兩邊都是在分都市與鄉村（聯合國 WUP 2025 也是這樣對照，2025 年世界依各國定義
  57.8%、城鄉程度的城市＋城鎮 80.4%）。
- 台灣：附註對照國發會「4-1 都市計畫區面積與人口數」（data.gov.tw 6489，政府資料開放授權條款第 1 版）最新一年的
  都市計畫區內人口比例。
"""
from __future__ import annotations

import csv
import io

from common import OUT_DIR, download, indicator_file, write_json
from sources import ghsl_wup, un_wup

OUT = OUT_DIR / "topics" / "cities"
NDC_URL = ("https://ws.ndc.gov.tw/Download.ashx?u=LzAwMS9hZG1pbmlzdHJhdG9yLzEwL3JlbGZpbGUvNTc4MS82Mzk2LzQ4ZDdjYmIwLWJiMDEt"
           "NGE1Ny05YmM0LTNlY2U4ZmNmNWZmMi5jc3Y%3d&n=NC0xIOmDveW4guioiOeVq%2bWNgOmdouepjeiIh%2bS6uuWPoy5jc3Y%3d&icon=.csv")
TAIWAN = 158  # LocID


def ndc_planned_share() -> tuple[int, float]:
    """國發會 data.gov.tw 6489：（年，臺閩地區都市計畫區內人口占總人口 %）"""
    text = download(NDC_URL, "ndc", "6489-urban-planning-population.csv").read_bytes().decode("utf-8-sig")
    for row in csv.DictReader(io.StringIO(text)):
        if row["地區"] == "臺閩地區":
            return int(row["年"]), float(row["都市計畫區內人口占總人口百分比"])
    raise RuntimeError("國發會 6489 找不到臺閩地區那一列，格式可能變了")


def build() -> None:
    national, world = un_wup.national_urban()
    years = sorted(world)
    values: dict[str, list[float | None]] = {}
    unknown = []
    for loc, series in sorted(national.items()):
        iso3 = ghsl_wup.to_iso3(loc)
        if not iso3:
            unknown.append(loc)
            continue
        values[iso3] = [round(series[y], 2) if y in series else None for y in years]
    if unknown:
        print(f"  WUP File 15 對不到網站國家的 LocID：{unknown}")

    # 統一定義（GHS-WUP，每 5 年）：城市＋城鎮與半密集區 ÷ 全部
    stats = ghsl_wup.country_stats()
    epochs = [y for y in ghsl_wup.EPOCHS if y in world]
    unified: dict[str, dict[int, float]] = {}
    w_parts = {y: [0.0, 0.0] for y in epochs}
    for loc, by_year in stats.pop.items():
        iso3 = ghsl_wup.to_iso3(loc)
        for y in epochs:
            uc, ucl, rur = by_year[y]
            total = uc + ucl + rur
            w_parts[y][0] += uc + ucl
            w_parts[y][1] += total
            if iso3 and total > 0:
                unified.setdefault(iso3, {})[y] = (uc + ucl) / total * 100
    gap: dict[str, list[float | None]] = {}
    for iso3, row in values.items():
        g = [round(row[years.index(y)] - unified[iso3][y], 1) if row[years.index(y)] is not None and y in unified.get(iso3, {})
             else None for y in epochs]
        if any(v is not None for v in g):
            gap[iso3] = g
    w_unified = {y: a / b * 100 for y, (a, b) in w_parts.items()}

    # 台灣的附註
    ndc_year, ndc_share = ndc_planned_share()
    tw = values["TWN"]
    tw_now = tw[years.index(ghsl_wup.PROJECTION_FROM)]
    tw_unified = unified["TWN"][ghsl_wup.PROJECTION_FROM]
    tw_cities = stats.pop[TAIWAN][ghsl_wup.PROJECTION_FROM]
    tw_city_share = tw_cities[0] / sum(tw_cities) * 100
    note = (f"台灣的都市人口依都市計畫區內的人口計算（聯合國用國發會《都市及區域發展統計彙編》）：國發會 {ndc_year} 年底"
            f"都市計畫區內人口占 {ndc_share:.1f}%（data.gov.tw 6489）。依城鄉程度的統一定義，{ghsl_wup.PROJECTION_FROM} 年住在城市"
            f" {tw_city_share:.1f}%、城市加城鎮 {tw_unified:.1f}%。")
    note_en = (f"Taiwan counts the population of urban planning districts as urban (the UN uses the National Development Council’s "
               f"Urban and Regional Development Statistics): {ndc_share:.1f}% at the end of {ndc_year} (data.gov.tw 6489). Under the "
               f"harmonised Degree of Urbanisation, {tw_city_share:.1f}% lived in cities and {tw_unified:.1f}% in cities and towns "
               f"in {ghsl_wup.PROJECTION_FROM}.")
    extra = {"projectionFrom": ghsl_wup.PROJECTION_FROM, "notes": {"TWN": note}, "notesEn": {"TWN": note_en}}
    write_json(OUT / "urban-national.json", indicator_file(
        "urban-national", "%", years, values, aggregates={"WLD": [round(world[y], 2) for y in years]}, **extra))
    write_json(OUT / "urban-gap.json", indicator_file(
        "urban-gap", "百分點", epochs, gap,
        aggregates={"WLD": [round(world[y] - w_unified[y], 1) for y in epochs]}, **extra))

    i = epochs.index(ghsl_wup.PROJECTION_FROM)
    print(f"  {len(values)} 國有各國定義的都市化率（{years[0]}–{years[-1]}），{len(gap)} 國有差距（{epochs[0]}–{epochs[-1]} 每 5 年）")
    y0 = ghsl_wup.PROJECTION_FROM
    print(f"  {y0} 年世界：各國定義 {world[y0]:.1f}%，統一定義（城市＋城鎮）{w_unified[y0]:.1f}%，差 {world[y0] - w_unified[y0]:+.1f}")
    ranked = sorted(((c, g[i]) for c, g in gap.items() if g[i] is not None), key=lambda kv: kv[1])
    print(f"    差最多（自己的定義少算）：{[(c, v) for c, v in ranked[:6]]}")
    print(f"    自己的定義算得比較多：{[(c, v) for c, v in ranked[-6:]]}")
    for c in ("TWN", "JPN", "KOR", "CHN", "USA", "IND", "EGY", "BEL", "DEU"):
        print(f"    {c}：各國定義 {values[c][years.index(y0)]}%，統一 {unified[c][y0]:.1f}%，差 {gap[c][i]:+.1f}")
    print(f"  台灣：WUP {tw_now}%，國發會 {ndc_year} 年 {ndc_share:.1f}%")
    print("  ", note)
