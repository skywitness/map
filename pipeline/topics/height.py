"""平均身高主題：NCD-RisC 的成人身高（依出生年）與 19 歲的身高（依量測年），台灣跟國健署的實測對照。

- 男女平均身高（men、women）：NCD-RisC eLife 2016 的各國估計，1896–1996 年出生的人在 18 歲時的平均身高
  （1996 年出生 = 2014 年 18 歲），200 個國家與地區。是用各國的調查（含同一批人在不同年齡的量測）建模估計的，
  不是那一年量到的人。
- 比 1896 年出生的高多少（men-change、women-change）：那一年出生的減 1896 年出生的（各國先四捨五入到 0.1 公分再相減，
  畫面上的數字才對得起來）。
- 男女差距（gap）：男性減女性。
- 19 歲的身高（men-19、women-19）：NCD-RisC Lancet 2020 的 19 歲青少年，1985–2019 年每年（量測年）。
  是較新的另一次估計（用了更多 2010 年代的調查），跟成人身高同一批人（例如 1996 年出生的人 2015 年 19 歲）的數字
  可能差好幾公分（2015 年 19 歲減 1996 年出生的成人，中位數約 +1 公分，最多 −4.8 到 +6.6 公分），兩者不能直接相減，
  指標說明與側欄都有寫。
- 側欄的 95% 不確定區間放在 countries/<ISO3>.json（點國家才載入）。
- 世界值：成人身高的檔沒有全球平均，用 WPP 2024 那一年出生的人在 18 歲那年（1932 年以前出生的用 1950 年）15–19 歲的
  男女人口加權平均 200 國；19 歲的用 NCD-RisC 自己的全球估計。
- 台灣：NCD-RisC 本身就有台灣。附註與 taiwan.json 對照國健署國民營養健康狀況變遷調查的實測（sources/nahsit.py）。

授權：論文是 CC BY 4.0，網站的下載檔沒有另外寫授權（sources/ncdrisc.py、DESIGN.md 第 8 節第 71 點）。
"""
from __future__ import annotations

from common import OUT_DIR, compact_indicator, indicator_file, now_iso, write_json
from sources import nahsit, ncdrisc, wpp

OUT = OUT_DIR / "topics" / "height"

COHORTS = list(range(1896, 1997))
BASE = COHORTS[0]
AGE = 19
SEX_ZH = {"men": "男性", "women": "女性"}
SEX_EN = {"men": "men", "women": "women"}
WPP_SEX = {"men": "male", "women": "female"}


def r1(v: float) -> float:
    return round(v + 0.0, 1)


def weights(countries: set[str], pop) -> dict[str, dict[str, dict[int, float]]]:
    """{'men'/'women': {iso3: {出生年: 18 歲那年 15–19 歲的人口}}}；1932 年以前出生的用 1950 年（WPP 最早的一年）。"""
    out: dict[str, dict[str, dict[int, float]]] = {"men": {}, "women": {}}
    missing = sorted(countries - set(pop))
    if missing:
        raise RuntimeError(f"WPP 沒有這些 NCD-RisC 的國家：{missing}")
    for sex in out:
        for iso3 in countries:
            out[sex][iso3] = {c: pop[iso3][max(c + 18, 1950)][WPP_SEX[sex]][15] for c in COHORTS}
    return out


def check_weighting(teen, teen_world, pop, years: list[int]) -> None:
    """同樣用 WPP 15–19 歲人口加權 NCD-RisC 2020 各國 19 歲的身高，跟 NCD-RisC 自己的全球值比：
    2026-10 是 1985–2019 年每年差 0.1 公分以內（例如 2019 年男性 170.79 對 170.84），差超過 0.3 公分就報錯。"""
    worst = 0.0
    for sex in teen:
        for y in years:
            w = {i: pop[i][y][WPP_SEX[sex]][15] for i in teen[sex]}
            mean = sum(teen[sex][i][y][0] * w[i] for i in w) / sum(w.values())
            worst = max(worst, abs(mean - teen_world[sex][y][0]))
    if worst > 0.3:
        raise RuntimeError(f"WPP 加權的 19 歲平均跟 NCD-RisC 的全球值差 {worst:.2f} 公分，世界平均的算法要再檢查")
    print(f"  世界平均的加權：19 歲的 WPP 加權平均跟 NCD-RisC 的全球值最多差 {worst:.2f} 公分")


def weighted(values: dict[str, dict[int, float]], w: dict[str, dict[int, float]], years: list[int]) -> list[float]:
    out = []
    for y in years:
        total = sum(w[i][y] for i in values)
        out.append(r1(sum(values[i][y] * w[i][y] for i in values) / total))
    return out


def mean_over(series: dict[int, float], first: int, last: int) -> tuple[float, int, int] | None:
    """first–last 年出生的平均與實際用到的年份（只算資料涵蓋的年份）；涵蓋不到一半時不算（回傳 None）"""
    ys = [y for y in range(first, last + 1) if y in series]
    if len(ys) * 2 < last - first + 1:
        return None
    return r1(sum(series[y] for y in ys) / len(ys)), ys[0], ys[-1]


def build() -> None:
    adult, names = ncdrisc.adult_height()
    teen, teen_world = ncdrisc.adolescent_height(AGE, names)
    countries = set(adult["men"])
    if set(adult["women"]) != countries or any(set(teen[s]) != countries for s in teen):
        raise RuntimeError("NCD-RisC 成人與 19 歲的國家不一致")
    for sex in adult:
        for iso3, s in adult[sex].items():
            if sorted(s) != COHORTS:
                raise RuntimeError(f"NCD-RisC 的 {iso3} {sex} 出生年不是 1896–1996")
    teen_years = sorted({y for s in teen["men"].values() for y in s})
    print(f"  NCD-RisC：成人 {len(countries)} 國（{COHORTS[0]}–{COHORTS[-1]} 年出生）、19 歲 {teen_years[0]}–{teen_years[-1]} 年")

    # 畫面上顯示到 0.1 公分：先四捨五入，變化與差距用四捨五入後的值算，數字才對得起來
    height = {sex: {i: {c: r1(e[0]) for c, e in s.items()} for i, s in adult[sex].items()} for sex in adult}
    pop = wpp.population_by_age_sex(1950, max(COHORTS[-1] + 18, teen_years[-1]))
    check_weighting(teen, teen_world, pop, teen_years)
    w = weights(countries, pop)
    world = {sex: weighted(height[sex], w[sex], COHORTS) for sex in height}
    change = {sex: {i: {c: r1(s[c] - s[BASE]) for c in COHORTS} for i, s in height[sex].items()} for sex in height}
    world_change = {sex: weighted(change[sex], w[sex], COHORTS) for sex in height}
    gap = {i: {c: r1(height["men"][i][c] - height["women"][i][c]) for c in COHORTS} for i in countries}
    teen_height = {sex: {i: {y: r1(e[0]) for y, e in s.items()} for i, s in teen[sex].items()} for sex in teen}

    by_age = ncdrisc.heights_by_age("Taiwan")
    tw_notes = taiwan_notes(height, by_age)
    for sex in ("men", "women"):
        write_json(
            OUT / f"{sex}.json",
            indicator_file(
                sex, "公分", COHORTS, {i: [s[c] for c in COHORTS] for i, s in sorted(height[sex].items())},
                aggregates={"WLD": world[sex]},
                notes={"TWN": tw_notes[sex][0]}, notesEn={"TWN": tw_notes[sex][1]},
            ),
        )
        write_json(
            OUT / f"{sex}-change.json",
            indicator_file(
                f"{sex}-change", "公分", COHORTS, {i: [s[c] for c in COHORTS] for i, s in sorted(change[sex].items())},
                aggregates={"WLD": world_change[sex]},
            ),
        )
        write_json(
            OUT / f"{sex}-{AGE}.json",
            indicator_file(
                f"{sex}-{AGE}", "公分", teen_years,
                {i: [s.get(y) for y in teen_years] for i, s in sorted(teen_height[sex].items())},
                aggregates={"WLD": [r1(teen_world[sex][y][0]) for y in teen_years]},
                notes={"TWN": tw_notes[f"{sex}-{AGE}"][0]}, notesEn={"TWN": tw_notes[f"{sex}-{AGE}"][1]},
            ),
        )
        last = COHORTS[-1]
        tall = sorted(height[sex], key=lambda i: -height[sex][i][last])[:3]
        print(
            f"  {sex}：{last} 年出生世界 {world[sex][-1]}、台灣 {height[sex]['TWN'][last]}（{BASE} 年 {height[sex]['TWN'][BASE]}，"
            f"比 {BASE} 年 {change[sex]['TWN'][last]:+}）；最高 {[(i, height[sex][i][last]) for i in tall]}；"
            f"{AGE} 歲 {teen_years[-1]} 年世界 {r1(teen_world[sex][teen_years[-1]][0])}、台灣 {teen_height[sex]['TWN'][teen_years[-1]]}"
        )
    write_json(
        OUT / "gap.json",
        indicator_file(
            "gap", "公分", COHORTS, {i: [gap[i][c] for c in COHORTS] for i in sorted(countries)},
            aggregates={"WLD": [r1(m - f) for m, f in zip(world["men"], world["women"])]},
        ),
    )
    print(f"  男女差距：{COHORTS[-1]} 年出生世界 {r1(world['men'][-1] - world['women'][-1])}、台灣 {gap['TWN'][COHORTS[-1]]}")

    # ── 側欄的 95% 不確定區間（每個國家一個檔，點國家才載入；格式同指標檔的差分編碼，兩種年份各自對齊）──
    for iso3 in sorted(countries):
        values: dict[str, list[float | None]] = {}
        for sex in ("men", "women"):
            values[f"{sex}-lo"] = [r1(adult[sex][iso3][c][1]) for c in COHORTS]
            values[f"{sex}-hi"] = [r1(adult[sex][iso3][c][2]) for c in COHORTS]
            values[f"{sex}-{AGE}-lo"] = [r1(teen[sex][iso3][y][1]) for y in teen_years]
            values[f"{sex}-{AGE}-hi"] = [r1(teen[sex][iso3][y][2]) for y in teen_years]
        data = compact_indicator({"cohorts": [COHORTS[0], COHORTS[-1]], "years": [teen_years[0], teen_years[-1]], "values": values})
        write_json(OUT / "countries" / f"{iso3}.json", data, quiet=True)
    print(f"  countries/：{len(countries)} 個國家的不確定區間")

    write_json(OUT / "taiwan.json", taiwan_file(height, by_age))
    write_json(
        OUT / "manifest.json",
        {
            "topic": "height",
            "generatedAt": now_iso(),
            "sources": [
                "NCD-RisC, A century of trends in adult human height (eLife 2016) — NCD_RisC_eLife_2016_height_age18_countries.csv",
                "NCD-RisC, Height and BMI trajectories of school-aged children and adolescents (Lancet 2020) — country and global CSV",
                "UN World Population Prospects 2024（世界平均的權重）",
                "國民健康署國民營養健康狀況變遷調查 2013–2016、2017–2020 年成果報告（台灣的對照）",
            ],
        },
    )


def cohort_mean(height: dict[str, dict[str, dict[int, float]]], sex: str, period: str, group: str) -> tuple[float, int, int] | None:
    first, last = nahsit.birth_years(period, group)
    return mean_over(height[sex]["TWN"], first, last)


def by_age_mean(by_age: dict[tuple[int, int], float], period: str, group: str) -> tuple[float, int, int] | None:
    """NCD-RisC 2020 在調查那幾年（到 2019 年）、同一個年齡組（5–19 歲以內）的平均：(平均, 頭, 尾年)"""
    first, last = nahsit.SURVEY_YEARS[period]
    low, high = (int(x) for x in group.split("-"))
    keys = [(y, a) for y in range(first, last + 1) for a in range(low, high + 1) if (y, a) in by_age]
    if not keys or high > AGE:
        return None
    years = sorted({y for y, _a in keys})
    return r1(sum(by_age[k] for k in keys) / len(keys)), years[0], years[-1]


def taiwan_notes(height, by_age) -> dict[str, tuple[str, str]]:
    """台灣的附註：國健署實測的平均身高跟 NCD-RisC 的定義不同（同一段時間量不同年齡的人 vs 同一年出生的人在 18 歲時）"""
    new, old = "2017-2020", "2013-2016"
    k = nahsit.KNOWN
    out: dict[str, tuple[str, str]] = {}
    for sex in ("men", "women"):
        _n, adult_new, se = k[new]["19-44"][sex]
        teen_new = k[new]["16-18"][sex][1]
        adult_old = k[old]["19-44"][sex][1]
        first, last = nahsit.birth_years(new, "19-44")
        cohort, c_first, c_last = cohort_mean(height, sex, new, "19-44")
        same, s_first, s_last = by_age_mean(by_age[sex], new, "16-18")
        out[sex] = (
            f"國健署國民營養健康狀況變遷調查實際量的{SEX_ZH[sex]}平均身高：2017–2020 年 19–44 歲 {adult_new} 公分"
            f"（標準誤 {se}），2013–2016 年 {adult_old} 公分。調查是同一段時間量不同年齡的人（19–44 歲約是 {first}–{last} 年出生），"
            f"這裡是 NCD-RisC 依各國調查建模估計的、同一年出生的人在 18 歲時的身高，定義不同；這裡 {c_first}–{c_last} 年出生的平均是 "
            f"{cohort} 公分",
            f"The Health Promotion Administration's Nutrition and Health Survey in Taiwan measured a mean height of {adult_new} cm "
            f"(standard error {se}) for {SEX_EN[sex]} aged 19–44 in 2017–2020 ({adult_old} cm in 2013–2016). The survey measures "
            f"people of different ages at the same time (those aged 19–44 were born around {first}–{last}), while these are NCD-RisC "
            f"model estimates of the height at 18 of people born in the same year, so the definitions differ; the average here for "
            f"those born {c_first}–{c_last} is {cohort} cm",
        )
        out[f"{sex}-{AGE}"] = (
            f"國健署國民營養健康狀況變遷調查 2017–2020 年實際量的 16–18 歲{SEX_ZH[sex]}平均 {teen_new} 公分、19–44 歲 {adult_new} 公分；"
            f"NCD-RisC 同一份估計 {s_first}–{s_last} 年 16–18 歲的平均是 {same} 公分",
            f"The Health Promotion Administration's Nutrition and Health Survey in Taiwan measured {teen_new} cm for {SEX_EN[sex]} "
            f"aged 16–18 and {adult_new} cm at 19–44 in 2017–2020; the same NCD-RisC estimates average {same} cm at ages 16–18 "
            f"in {s_first}–{s_last}",
        )
    return out


def taiwan_file(height, by_age) -> dict:
    """側欄的台灣對照表：國健署各年齡組的實測 vs NCD-RisC。

    - 19 歲以上：這些人出生的那幾年在 eLife 2016 的平均（18 歲時的身高；資料只到 1996 年出生，涵蓋不到一半的年齡組不算）
    - 16–18 歲：Lancet 2020 在調查那幾年（到 2019 年）、同樣 16–18 歲的平均（同一個年齡、同一段時間，最可以直接比）
    """
    rows = []
    for period in ("2017-2020", "2013-2016"):
        for group, by_sex in nahsit.KNOWN[period].items():
            first, last = nahsit.birth_years(period, group)
            row: dict = {"period": period, "ages": group, "born": [first, last]}
            for sex in ("men", "women"):
                n, mean, se = by_sex[sex]
                cohort = cohort_mean(height, sex, period, group)
                same_age = by_age_mean(by_age[sex], period, group)
                row[sex] = {"n": n, "mean": mean, "se": se}
                if cohort:
                    row[sex]["cohort"] = {"mean": cohort[0], "born": [cohort[1], cohort[2]]}
                if same_age:
                    row[sex]["sameAge"] = {"mean": same_age[0], "years": [same_age[1], same_age[2]]}
            rows.append(row)
    for r in rows:
        ncd = {sex: r[sex].get("cohort", r[sex].get("sameAge", {})).get("mean") for sex in ("men", "women")}
        print(
            f"  台灣 {r['period']} {r['ages']} 歲（約 {r['born'][0]}–{r['born'][1]} 年出生）："
            f"男 {r['men']['mean']}／NCD-RisC {ncd['men']}，女 {r['women']['mean']}／NCD-RisC {ncd['women']}"
        )
    return {"source": nahsit.SOURCE, "rows": rows}
