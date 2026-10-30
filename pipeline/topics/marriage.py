"""婚姻與家庭主題：初婚年齡（男女）、有偶比例、30–34 歲未婚比例、粗結婚率、粗離婚率、非婚生子女比例、單人家戶比例，
以及同性伴侶的法律地位（類別圖）。

- 初婚年齡：歐洲用 Eurostat（demo_nind 的 MAGEMAR1／FAGEMAR1，依結婚登記），其他 OECD 國家用 OECD Family Database，
  其餘用聯合國 World Marriage Data 2019 的單身平均結婚年齡（SMAM，依普查或調查的未婚比例推算）。
  每個國家只用一個來源（最新一年最晚的那個），歷年折線才不會因為換來源而跳動。台灣用內政部戶政司的初婚者平均年齡。
- 有偶比例、30–34 歲未婚比例：World Marriage Data 2019 的各年齡組比例，用 WPP 2024 的年齡別人口加權成 15 歲以上、
  男女合計（年齡組要從 15 歲一路齊全到最後的開放組，只有 15–49 歲的 DHS 等調查不收）。台灣用戶政司的戶籍統計。
- 粗結婚率、粗離婚率（每千人）：歐洲用 Eurostat（demo_nind、demo_ndivind），OECD Family Database 補上用各國官方來源的
  非歐洲 OECD 國家，其餘用 UNdata（Demographic Yearbook）的結婚、離婚對數除以 WPP 2024 的年中人口。台灣用戶政司。
- 非婚生子女比例：Eurostat（demo_find 的 NMARPCT），歐洲以外的 OECD 國家用 OECD Family Database（SF2.4）。台灣用戶政司。
- 單人家戶比例：歐洲用 Eurostat 的勞動力調查（lfst_hhnhtych，一個成人、沒有小孩的家戶），更早的年份與其他國家用
  聯合國的家戶規模資料庫（2026）。台灣用主計總處家庭收支調查。
- 單親家戶、三代同堂、隔代家戶（祖孫）的比例：聯合國的家戶規模資料庫（2026），台灣用主計總處家庭收支調查的
  家庭組織型態（data.gov.tw 27963）。60 歲以上獨居的比例：聯合國的老人居住安排資料庫（2026），台灣沒有。
- 一夫多妻的法律地位：自行整理的表（`sources/polygamy.py`，依維基百科，CC BY-SA 4.0），只有 2026 年。
- 同性伴侶的法律地位：自行整理的表（`sources/same_sex_unions.py`，依維基百科，CC BY-SA 4.0），1989–2026 年每年年底的狀態。
- 側欄：台灣另外有 `taiwan.json`（結婚、離婚對數與其中的相同性別、初婚年齡），見 src/topics/panels/MarriagePanel.tsx。
"""
from __future__ import annotations

import json

from common import OUT_DIR, indicator_file, latest_year_span, now_iso, to_series, write_json
from sources import eurostat, fies, oecd_family, ris_marriage, polygamy, same_sex_unions, un_households, undata_dyb, undesa_wmd, wpp

Series = dict[str, dict[int, float]]
TAIWAN = "TWN"
FIRST_YEAR = 1970
LAST_POP_YEAR = 2025  # WPP 2024 的 2024、2025 年是推估，當分母夠用

WITHIN = {
    "age-women": 10, "age-men": 10, "married": 10, "never-married": 10,
    "marriage-rate": 5, "divorce-rate": 5, "births-outside": 5, "one-person": 10,
    # 家戶組成大多來自普查、DHS、MICS，各國隔 5–10 年才一次
    "single-parent": 15, "three-generation": 15, "skip-generation": 15, "older-alone": 15,
}
# OECD 的平均初婚年齡：墨西哥含再婚，不收（改用聯合國的 SMAM）；澳洲、紐西蘭、美國是中位數，照收但附註寫明
# （聯合國的 SMAM 美國只到 2010 年、紐西蘭只到 2013 年）
OECD_AGE_SKIP = {"MEX"}
OECD_AGE_MEDIAN = {"AUS", "NZL", "USA"}
# OECD 的粗率有幾國是各國官方來源，其他國家 OECD 也是轉載 Eurostat 或 Demographic Yearbook，就不另外用
OECD_RATE_NATIONAL = {"AUS", "CAN", "CHL", "COL", "CRI", "ISR", "JPN", "KOR", "MEX", "NZL", "USA"}
# 澳洲、紐西蘭的粗離婚率 2018 年起改成每千名 16 歲以上人口，不收（改用 UNdata 的對數除以總人口）。
# 美國的離婚對數只有有通報的州（UNdata 的附註「不含加州……」，那幾年不收），所以美國用 OECD（CDC 依通報州的人口算的離婚率）
OECD_DIVORCE_SKIP = {"AUS", "NZL"}
VISITOR_NOTE = (
    "結婚對數含大量來這裡結婚的非居民（觀光結婚），粗結婚率比居民的高很多",
    "Marriages include many non-residents who marry here (destination weddings), so the rate is much higher than that of residents",
)
# OECD 的以色列非婚生比例 2016 年以前只算猶太女性
ISRAEL_BIRTHS_FROM = 2017

SOURCE_NAMES = {
    "eurostat": ("Eurostat", "Eurostat"),
    "oecd": ("OECD Family Database", "OECD Family Database"),
}

TAIWAN_NOTES = {
    "age": (
        "內政部戶政司的初婚者平均年齡（按發生日期，依結婚登記），跟歐洲、OECD 國家的算法相同；"
        "聯合國的 SMAM 是依普查的未婚比例推算，數字相近但不完全相同",
        "Mean age of people marrying for the first time, from the Department of Household Registration (by date of "
        "occurrence, from marriage registrations), the same method as for European and OECD countries; the UN's SMAM "
        "is estimated from the share never married in censuses, which gives similar but not identical figures",
    ),
    "married": (
        "內政部戶政司的戶籍統計：15 歲以上人口中有配偶的比例（每年年底，2019 年起含相同性別的配偶），不含同居",
        "Household registration statistics from the Department of Household Registration: share of people aged 15 and "
        "over with a spouse (end of year; same-sex spouses included from 2019), excluding cohabitation",
    ),
    "never-married": (
        "內政部統計查詢網：30–34 歲戶籍人口中未婚的比例（每年年底，男女合計）",
        "Ministry of the Interior statistics: share of registered residents aged 30–34 who have never married (end of year, both sexes)",
    ),
    "marriage-rate": (
        "內政部戶政司的結婚登記對數與粗結婚率（按登記日期），2019 年 5 月 24 日起含相同性別的結婚",
        "Marriages registered and the crude marriage rate from the Department of Household Registration (by date of "
        "registration), including same-sex marriages from 24 May 2019",
    ),
    "divorce-rate": (
        "內政部戶政司的離婚／終止結婚登記對數與粗離婚率（按登記日期），2019 年起含相同性別",
        "Divorces registered and the crude divorce rate from the Department of Household Registration (by date of "
        "registration), including same-sex couples from 2019",
    ),
    "births-outside": (
        "內政部戶政司：出生登記時生母沒有婚姻關係的「非婚生」占出生數的比例（按登記日期，不含無依兒童）",
        "Department of Household Registration: births registered as born outside marriage, as a share of all births "
        "(by date of registration, excluding foundlings)",
    ),
    "household-types": (
        "主計總處家庭收支調查的家庭組織型態（{kind}）占全部家庭戶的比例，跟聯合國的定義不完全相同；"
        "2025 年的總戶數比 2024 年多約 50 萬戶，前後兩年可能不完全可比",
        "DGBAS Survey of Family Income and Expenditure: {kind_en} as a share of all households, a definition close to "
        "but not the same as the UN's; total households in 2025 are about 500,000 more than in 2024, so the two years "
        "may not be fully comparable",
    ),
    "one-person": (
        "主計總處家庭收支調查：家庭戶中只有 1 人的比例。戶籍登記的「單獨生活戶」包含很多只是把戶籍分開的人，比例高很多，不用",
        "DGBAS Survey of Family Income and Expenditure: share of households with one member. Household registration "
        "counts many more one-person households because people often register separately, so it is not used",
    ),
}


def pick_latest(*sources: tuple[str, Series]) -> tuple[Series, dict[str, str]]:
    """每個國家用一個來源：最新一年最晚的那個，同一年依參數的順序。回傳 (數列, {iso3: 來源})。"""
    out: Series = {}
    used: dict[str, str] = {}
    for iso3 in sorted({c for _, s in sources for c in s}):
        best = None
        for rank, (name, series) in enumerate(sources):
            if series.get(iso3):
                key = (max(series[iso3]), -rank)
                if best is None or key > best[0]:
                    best = (key, name)
        if best:
            out[iso3] = {y: v for y, v in dict(sources)[best[1]][iso3].items() if y >= FIRST_YEAR}
            used[iso3] = best[1]
    return out, used


def weighted_share(group: dict[str, dict[tuple[int, int], float]], pop: dict[str, dict[int, float]], ages: tuple[int, int] | None) -> float | None:
    """各年齡組的比例（%）用 WPP 的人口加權成男女合計。ages 是 None 時要 15 歲到開放組齊全；否則只算那一組（例如 30–34）。"""
    total = weighted = 0.0
    for sex in ("male", "female"):
        cells = group.get(sex)
        if not cells:
            return None
        if ages:
            if ages not in cells:
                return None
            n = sum(pop[sex].get(a, 0) for a in range(ages[0], ages[1] + 1, 5))
            total, weighted = total + n, weighted + n * cells[ages]
            continue
        start = 15
        for (lo, hi), v in sorted(cells.items()):
            if lo < 15:
                continue
            if lo != start or (hi != undesa_wmd.OPEN_END and (hi + 1 - lo) % 5):
                return None  # 年齡組不連續，或不是五歲組
            top = hi if hi != undesa_wmd.OPEN_END else 100
            n = sum(pop[sex].get(a, 0) for a in range(lo, top + 1, 5))
            total, weighted = total + n, weighted + n * v
            start = hi + 1
            if hi == undesa_wmd.OPEN_END:
                break
        else:
            return None  # 沒有開放組（例如只到 49 歲）
    return weighted / total if total else None


def wmd_shares(sheet: str, pop: dict, ages: tuple[int, int] | None, complement: bool) -> Series:
    out: Series = {}
    for (iso3, year), candidates in undesa_wmd.by_age(sheet).items():
        if iso3 not in pop or year not in pop[iso3]:
            continue
        for _rank, group in candidates:
            share = weighted_share(group, pop[iso3][year], ages)
            if share is not None:
                out.setdefault(iso3, {})[year] = 100 - share if complement else share
                break
    return out


def source_notes(used: dict[str, str], annotate: set[str], detail: dict[str, tuple[str, str]] | None = None) -> tuple[dict[str, str], dict[str, str]]:
    """用了 annotate 裡的來源的國家寫附註「資料來源：…」（主要來源與頁尾已經寫明的不寫）；detail 是各國接在後面的說明。"""
    notes, notes_en = {}, {}
    for iso3, name in sorted(used.items()):
        if name in annotate:
            zh, en = SOURCE_NAMES[name]
            more_zh, more_en = (detail or {}).get(iso3, ("", ""))
            notes[iso3] = f"資料來源：{zh}" + (f"（{more_zh}）" if more_zh else "")
            notes_en[iso3] = f"Source: {en}" + (f" ({more_en})" if more_en else "")
    return notes, notes_en


def build() -> None:
    out = OUT_DIR / "topics" / "marriage"
    countries = sorted(json.loads((OUT_DIR / "countries.json").read_text(encoding="utf-8")))

    def write(key: str, unit: str, series: Series, digits: int, notes: tuple[dict, dict] = ({}, {}), **extra: object) -> list[int]:
        within = WITHIN[key]
        series = {c: s for c, s in series.items() if s}
        years = latest_year_span(series, within)
        values = {c: v for c, v in ((c, to_series(s, years, digits)) for c, s in series.items()) if any(x is not None for x in v)}
        write_json(out / f"{key}.json", indicator_file(
            key, unit, years, values, latestWithin=within, notes=notes[0], notesEn=notes[1], **extra,
        ))
        return years

    taiwan_md = ris_marriage.marriages_divorces()
    taiwan_age = ris_marriage.first_marriage_age()

    # ── 初婚年齡 ──────────────────────────────────────────────
    smam = undesa_wmd.smam()
    oecd_age = oecd_family.mean_age_first_marriage()
    for sex, key, code in (("female", "age-women", "FAGEMAR1"), ("male", "age-men", "MAGEMAR1")):
        europe = eurostat.series("demo_nind", freq="A", indic_de=code)
        oecd = {c: s for c, s in oecd_age[sex].items() if c not in OECD_AGE_SKIP}
        series, used = pick_latest(("eurostat", europe), ("oecd", oecd), ("wmd", smam[sex]))
        series[TAIWAN] = taiwan_age[sex]
        # 聯合國的 SMAM 是大多數國家的來源（頁尾寫明），依登記的才寫附註
        detail = {
            c: ("初婚年齡的中位數，不是平均數", "median age at first marriage, not the mean")
            if src == "oecd" and c in OECD_AGE_MEDIAN
            else ("依結婚登記的初婚者平均年齡", "mean age at first marriage from registrations")
            for c, src in used.items()
        }
        notes = source_notes(used, {"eurostat", "oecd"}, detail)
        notes[0][TAIWAN], notes[1][TAIWAN] = TAIWAN_NOTES["age"]
        write(key, "歲", series, 1, notes)

    # ── 有偶比例、30–34 歲未婚比例 ────────────────────────────
    pop = wpp.population_by_age_sex(1950)
    married = wmd_shares("CURRENTLY MARRIED", pop, None, complement=False)
    married[TAIWAN] = ris_marriage.married_share()
    write("married", "%", married, 1, ({TAIWAN: TAIWAN_NOTES["married"][0]}, {TAIWAN: TAIWAN_NOTES["married"][1]}))
    never = wmd_shares("EVER_MARRIED", pop, (30, 34), complement=True)
    never[TAIWAN] = ris_marriage.never_married_30_34()
    write("never-married", "%", never, 1, ({TAIWAN: TAIWAN_NOTES["never-married"][0]}, {TAIWAN: TAIWAN_NOTES["never-married"][1]}))

    # ── 粗結婚率、粗離婚率 ────────────────────────────────────
    total_pop = wpp.demographic(["TPopulation1July"], last_year=LAST_POP_YEAR)["TPopulation1July"]
    oecd_marriage, oecd_divorce = oecd_family.crude_rates()
    for kind, key, dataset, code in (
        ("marriages", "marriage-rate", "demo_nind", "GNUPRT"),
        ("divorces", "divorce-rate", "demo_ndivind", "GDIVRT"),
    ):
        europe = eurostat.series(dataset, freq="A", indic_de=code)
        oecd_all = oecd_marriage if kind == "marriages" else oecd_divorce
        oecd = {c: s for c, s in oecd_all.items() if c in OECD_RATE_NATIONAL and not (kind == "divorces" and c in OECD_DIVORCE_SKIP)}
        counts, visitors = undata_dyb.counts(kind)
        undata = {
            c: {y: n / total_pop[c][y] for y, n in s.items() if total_pop.get(c, {}).get(y)}  # 千人 → 每千人
            for c, s in counts.items() if c in total_pop
        }
        series, used = pick_latest(("eurostat", europe), ("oecd", oecd), ("undata", undata))
        series[TAIWAN] = {y: r["rate"] for y, r in taiwan_md[kind].items()}
        notes = source_notes(used, {"oecd"})  # Eurostat 與 UNdata 是大多數國家的來源，頁尾寫明
        for c in sorted(visitors):
            if used.get(c) == "undata" and kind == "marriages":
                notes[0][c], notes[1][c] = VISITOR_NOTE
        notes[0][TAIWAN], notes[1][TAIWAN] = TAIWAN_NOTES[key]
        write(key, "‰", series, 2, notes)

    # ── 非婚生子女比例 ────────────────────────────────────────
    europe = eurostat.series("demo_find", freq="A", indic_de="NMARPCT")
    oecd = oecd_family.births_outside_marriage()
    if "ISR" in oecd:
        oecd["ISR"] = {y: v for y, v in oecd["ISR"].items() if y >= ISRAEL_BIRTHS_FROM}
    births, used = pick_latest(("eurostat", europe), ("oecd", oecd))
    births[TAIWAN] = ris_marriage.births_outside_marriage()
    notes = source_notes(used, {"oecd"})
    notes[0][TAIWAN], notes[1][TAIWAN] = TAIWAN_NOTES["births-outside"]
    write("births-outside", "%", births, 1, notes)

    # ── 單人家戶比例 ──────────────────────────────────────────
    total_hh = eurostat.series("lfst_hhnhtych", freq="A", agechild="TOTAL", n_child="TOTAL", phhcomp="TOTAL", unit="THS_HH")
    single = eurostat.series("lfst_hhnhtych", freq="A", agechild="TOTAL", n_child="TOTAL", phhcomp="A1_NCH", unit="THS_HH")
    one = {c: {y: v / total_hh[c][y] * 100 for y, v in s.items() if total_hh.get(c, {}).get(y)} for c, s in single.items()}
    composition = un_households.composition_2026()
    un = composition["one-person"]
    notes_zh, notes_en = {}, {}
    for iso3, values in un.items():
        if not one.get(iso3):
            one[iso3] = values
            continue
        first = min(one[iso3])
        earlier = {y: v for y, v in values.items() if y < first}
        if earlier:
            one[iso3].update(earlier)
            notes_zh[iso3] = f"{first} 年起是 Eurostat 的勞動力調查，之前是聯合國的家戶規模資料庫"
            notes_en[iso3] = f"From {first}, the Eurostat Labour Force Survey; earlier years from the UN Database on Household Size and Composition"
    one[TAIWAN] = fies.one_person_share()
    notes_zh[TAIWAN], notes_en[TAIWAN] = TAIWAN_NOTES["one-person"]
    write("one-person", "%", one, 1, (notes_zh, notes_en))

    # ── 單親、三代同堂、隔代家戶；60 歲以上獨居 ──────────────
    taiwan_types = fies.household_types()
    for key, kind, kind_en, tw_key in (
        ("single-parent", "單親家庭：父或母與未婚子女", "single-parent households: a father or mother with unmarried children", "單親"),
        ("three-generation", "三代家庭：祖父母、父母與未婚子女", "three-generation households: grandparents, parents and unmarried children", "三代"),
        ("skip-generation", "祖孫家庭：祖父母與孫子女", "grandparent–grandchild households", "祖孫"),
    ):
        series = dict(composition[key])
        series[TAIWAN] = taiwan_types[tw_key]
        zh, en = TAIWAN_NOTES["household-types"]
        write(key, "%", series, 1, ({TAIWAN: zh.format(kind=kind)}, {TAIWAN: en.format(kind_en=kind_en)}))
    # 台灣只有 65 歲以上的數字，地圖照舊留白，寫在附註（第七批 135，DESIGN.md 第 217 點）
    write("older-alone", "%", un_households.older_alone_2026(), 1, (
        {TAIWAN: "台灣只有 65 歲以上的數字：主計總處 109 年人口及住宅普查 65 歲以上常住人口獨居 15.6%（570,990 人，"
                 "含住在安養中心、醫療院所等處所的人在分母）、衛福部 111 年老人狀況調查 65 歲以上獨居 9.1%，兩者定義不同"},
        {TAIWAN: "Taiwan only has figures for ages 65 and over: 15.6% living alone in the 2020 Population and Housing Census "
                 "(570,990 people; the denominator includes people in care homes, hospitals and other institutions) and "
                 "9.1% in the Ministry of Health and Welfare’s 2022 Survey of Senior Citizens, which define it differently"},
    ))

    # ── 同性伴侶的法律地位 ────────────────────────────────────
    status, status_notes = same_sex_unions.status(countries)
    years = list(range(same_sex_unions.FIRST_YEAR, same_sex_unions.LAST_YEAR + 1))
    write_json(out / "same-sex.json", indicator_file(
        "same-sex", "", years, {c: to_series(s, years, 0) for c, s in status.items()},
        notes={c: n[0] for c, n in status_notes.items()}, notesEn={c: n[1] for c, n in status_notes.items()},
    ))

    # ── 一夫多妻的法律地位（只有 2026 年）────────────────────
    poly, poly_notes = polygamy.status(countries)
    write_json(out / "polygamy.json", indicator_file(
        "polygamy", "", [polygamy.YEAR], {c: [v] for c, v in poly.items()},
        notes={c: n[0] for c, n in poly_notes.items()}, notesEn={c: n[1] for c, n in poly_notes.items()},
    ))

    # ── 台灣側欄 ──────────────────────────────────────────────
    write_json(out / "taiwan.json", {
        "marriages": {str(y): [r["total"], r.get("same_sex")] for y, r in sorted(taiwan_md["marriages"].items())},
        "divorces": {str(y): [r["total"], r.get("same_sex")] for y, r in sorted(taiwan_md["divorces"].items())},
        "ageMen": {str(y): round(v, 2) for y, v in sorted(taiwan_age["male"].items())},
        "ageWomen": {str(y): round(v, 2) for y, v in sorted(taiwan_age["female"].items())},
    })
    write_json(out / "manifest.json", {
        "topic": "marriage", "generatedAt": now_iso(),
        "source": "UN DESA World Marriage Data 2019; UNdata; Eurostat; OECD Family Database; UN DESA household databases 2026; "
                  "WPP 2024; 內政部戶政司; 主計總處; Wikipedia",
    })
