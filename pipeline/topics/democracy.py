"""民主與自由主題：V-Dem Country-Year 資料集 v16（CC BY-SA 4.0），1900 年到最新一年（2025）。

指標：
- 選舉民主指數（v2x_polyarchy）、自由民主指數（v2x_libdem）、言論自由與多元資訊指數（v2x_freexp_altinf），0–1
- 政體分類（Regimes of the World，v2x_regime）：0 封閉專制、1 選舉專制、2 選舉民主、3 自由民主，類別圖
另外輸出三項指數的 68% 可信區間（codelow、codehigh），給側欄的「三項指數對照」用。

國家代碼：V-Dem 的 country_text_id 大多就是 ISO alpha-3（科索沃也是 XKX），一個代碼對應一個政體的連續序列，
這裡照 V-Dem 自己的接續方式對到今天的國界，不另外依領土拼接：
- 德國 1949–1990 年是西德（V-Dem 把聯邦德國當成德國的延續），俄羅斯 1918–1990 年是蘇聯，
  塞爾維亞 1918–2005 年是南斯拉夫、塞爾維亞與蒙特內哥羅，捷克 1918–1992 年是捷克斯洛伐克，
  越南 1945–1975 年是北越，葉門 1918–1989 年是北葉門。
- 地圖上沒有形狀的政體不收：東德、南越、南葉門、尚吉巴（坦尚尼亞的半自治區）、加薩走廊、英國託管巴勒斯坦，
  以及 1900 年以前就消失的德意志、義大利各邦。相關國家的附註會寫。
- 巴勒斯坦（PSE）用 V-Dem 的「Palestine/West Bank」（約旦河西岸）；地圖的巴勒斯坦含加薩，加薩另外評分，附註寫出加薩的值。
- 索馬利蘭（SML）對到地圖自己的形狀 _SOL：1900–1959 年是英屬索馬利蘭，1991 年起是自行宣布獨立的索馬利蘭共和國；
  1960–1990 年併在索馬利亞裡，沒有另外評分（灰色）。
- 殖民地也有評分（例如日本統治下的台灣、英屬印度），獨立前的年份是殖民政府的分數。

世界值：每年地圖上有資料的國家的簡單平均（每國一樣重，不依人口加權）。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import vdem
from sources.countries import ISO3

FIRST_YEAR = 1900

# 指標 id → V-Dem 變數
INDICES = {
    "electoral-democracy": "v2x_polyarchy",
    "liberal-democracy": "v2x_libdem",
    "free-expression": "v2x_freexp_altinf",
    # 2026-10-30 加（製作手冊第七批 140）：參與式、審議式、平等民主，公民自由，政治貪腐（越高越貪腐）
    "participatory-democracy": "v2x_partipdem",
    "deliberative-democracy": "v2x_delibdem",
    "egalitarian-democracy": "v2x_egaldem",
    "civil-liberties": "v2x_civlib",
    "corruption": "v2x_corr",
}
REGIME = "v2x_regime"
REGIME_NAMES = {
    0: ("封閉專制", "closed autocracy"),
    1: ("選舉專制", "electoral autocracy"),
    2: ("選舉民主", "electoral democracy"),
    3: ("自由民主", "liberal democracy"),
}

# 2026-11-05（製作手冊第二十二批 376）：全國選舉的投票率與下議院的選舉制度。這幾欄 V-Dem 只在選舉那一年有值，
# 指標檔只放選舉年、用 latestWithin 往後補（不內插）；選舉之間最長的間隔大多 5 年以內（1946 年起 92%、6 年以內 95%）
ELECTION_WITHIN = 6
TURNOUT = {"registered": "v2eltrnout", "vap": "v2elvaptrn"}
ELECTORAL_SYSTEM = "v2elparlel"  # 0 多數制、1 比例代表、2 混合、3 其他
ELECTORAL_SYSTEM_NAMES = {
    0: ("多數制", "majoritarian"),
    1: ("比例代表制", "proportional representation"),
    2: ("混合制", "mixed"),
    3: ("其他", "other"),
}
# v2elloelsy 的 13 類（tooltip 寫實際的制度名稱：德國的聯立制、日本與台灣的並立制都算「混合」）
ELECTORAL_SYSTEM_DETAIL = {
    0: ("單一選區相對多數制", "first-past-the-post"),
    1: ("單一選區兩輪投票制", "two-round system"),
    2: ("選擇投票制（排序複選）", "alternative vote"),
    3: ("複數選區全額連記制", "block vote"),
    4: ("政黨全額連記制", "party block vote"),
    5: ("並立制（單一選區與比例代表分開計算）", "parallel (single-member districts and PR counted separately)"),
    6: ("聯立制（比例代表補償席次）", "mixed-member proportional"),
    7: ("名單比例代表制（小選區）", "list PR, small districts"),
    8: ("名單比例代表制（大選區）", "list PR, large districts"),
    9: ("單記可讓渡投票制", "single transferable vote"),
    10: ("單記非讓渡投票制", "single non-transferable vote"),
    11: ("限制連記制", "limited vote"),
    12: ("波達計數法", "Borda count"),
}
# 選舉類型（v2eltype_0–7），前端 DemocracyPanel 的 ELECTION_TYPES 用同樣的位元
ELECTION_TYPES = [
    ("國會", "legislative"),
    ("國會第二輪", "legislative runoff"),
    ("上議院", "upper chamber"),
    ("上議院第二輪", "upper chamber runoff"),
    ("制憲議會", "constituent assembly"),
    ("制憲議會第二輪", "constituent assembly runoff"),
    ("總統", "presidential"),
    ("總統第二輪", "presidential runoff"),
]

# V-Dem 代碼 → 地圖的代碼（其餘的 V-Dem 代碼就是 ISO alpha-3）
RENAME = {"SML": "_SOL"}
# 地圖上沒有形狀、不收的政體（1900 年以後還有資料的）
DROPPED = {
    "DDR": "東德",
    "VDR": "南越",
    "YMD": "南葉門",
    "ZZB": "尚吉巴",
    "PSG": "加薩走廊",
    "PSB": "英國託管巴勒斯坦",
}

# 各國附註（中文, 英文）：V-Dem 的接續方式跟今天的國界不同的地方
NOTES: dict[str, tuple[str, str]] = {
    "TWN": (
        "V-Dem 的台灣：1900–1944 年是日本統治下的台灣，1945–1948 年是設在大陸的中華民國政府，1949 年起是遷台的中華民國。",
        "V-Dem's Taiwan: Taiwan under Japanese rule in 1900–1944, the Republic of China government on the mainland in 1945–1948, "
        "and the Republic of China in Taiwan from 1949.",
    ),
    "CHN": (
        "1900–1910 年是清朝，1911–1948 年是中華民國（北洋政府、國民政府），1949 年起是中華人民共和國。",
        "Qing China in 1900–1910, the Republic of China (Beiyang and Nationalist governments) in 1911–1948, "
        "and the People's Republic of China from 1949.",
    ),
    "DEU": (
        "1949–1990 年是西德（V-Dem 把聯邦德國當成德國的延續）；東德另外評分，地圖上沒有它的形狀，所以沒有放。1945–1948 年盟軍占領，沒有評分。",
        "1949–1990 is West Germany (V-Dem treats the Federal Republic as the continuation of Germany); East Germany is scored "
        "separately and has no shape on today's map, so it is not shown. 1945–1948 (Allied occupation) is not scored.",
    ),
    "RUS": (
        "1918–1990 年是蘇聯（V-Dem 把蘇聯算在俄羅斯）；其他加盟共和國 1990 年起才有評分。",
        "1918–1990 is the Soviet Union (V-Dem scores the USSR as Russia); the other Soviet republics are scored only from 1990.",
    ),
    "SRB": (
        "1918–1991 年是南斯拉夫王國、南斯拉夫社會主義聯邦共和國，1992–2005 年是南斯拉夫聯盟共和國、塞爾維亞與蒙特內哥羅。",
        "1918–1991 is the Kingdom of Yugoslavia and socialist Yugoslavia; 1992–2005 the Federal Republic of Yugoslavia "
        "and Serbia and Montenegro.",
    ),
    "CZE": ("1918–1992 年是捷克斯洛伐克。", "1918–1992 is Czechoslovakia."),
    "VNM": (
        "1945–1975 年是北越（越南民主共和國）；南越（越南共和國）另外評分，地圖上沒有它的形狀，所以沒有放。",
        "1945–1975 is North Vietnam (Democratic Republic of Vietnam); South Vietnam (Republic of Vietnam) is scored "
        "separately and has no shape on today's map, so it is not shown.",
    ),
    "YEM": (
        "1918–1989 年是北葉門；南葉門（1990 年以前）另外評分，地圖上沒有它的形狀，所以沒有放。",
        "1918–1989 is North Yemen; South Yemen (before 1990) is scored separately and has no shape on today's map, so it is not shown.",
    ),
    "TZA": (
        "尚吉巴（1964 年起是坦尚尼亞的半自治區）另外評分，地圖上沒有它的形狀，所以沒有放。",
        "Zanzibar (a semi-autonomous region of Tanzania since 1964) is scored separately and has no shape on the map, so it is not shown.",
    ),
    "_SOL": (
        "1900–1959 年是英屬索馬利蘭，1991 年起是自行宣布獨立的索馬利蘭共和國；1960–1990 年屬於索馬利亞，沒有另外評分。",
        "British Somaliland in 1900–1959 and the self-declared Republic of Somaliland from 1991; "
        "part of Somalia in 1960–1990 and not scored separately.",
    ),
    "SOM": (
        "1900–1959 年是義屬索馬利蘭（1950 年起是聯合國託管地）；1991 年起不含自行宣布獨立的索馬利蘭（另外評分，地圖上是另一個形狀）。",
        "Italian Somaliland in 1900–1959 (a UN trust territory from 1950); from 1991 Somaliland, which declared independence, "
        "is scored separately (it has its own shape on the map).",
    ),
}


def _fmt(variable: str, value: float) -> tuple[str, str]:
    """附註裡的值：政體寫類別名稱，指數寫到小數兩位"""
    if variable == REGIME:
        return REGIME_NAMES[int(value)]
    return f" {value:.2f}", f"{value:.2f}"


def country_series(
    rows: list[dict[str, str]], variables: list[str], first_year: int = FIRST_YEAR,
) -> tuple[dict[str, dict[str, dict[int, float]]], dict[str, tuple[int, float]]]:
    """V-Dem 的列 → {變數: {地圖代碼: {年: 值}}}，照這個主題的接續方式（RENAME、DROPPED）對到地圖。
    第二個回傳值是加薩走廊每個變數最近一年的值（巴勒斯坦的附註用）。政府治理、性別平等主題的 V-Dem 指標也用它。"""
    series: dict[str, dict[str, dict[int, float]]] = {v: defaultdict(dict) for v in variables}
    gaza: dict[str, tuple[int, float]] = {}
    unknown: set[str] = set()
    for row in rows:
        year = int(row["year"])
        if year < first_year:
            continue
        code = row["country_text_id"]
        if code == "PSG":
            for v in variables:
                if row[v] != "" and year >= gaza.get(v, (0, 0))[0]:
                    gaza[v] = (year, float(row[v]))
        if code in DROPPED:
            continue
        iso3 = RENAME.get(code, code)
        if iso3 not in ISO3 and iso3 != "_SOL":
            unknown.add(f"{code} {row['country_name']}")
            continue
        for v in variables:
            if row[v] != "":
                series[v][iso3][year] = float(row[v])
    if unknown:
        # V-Dem 新版多了政體時要決定怎麼對到地圖（RENAME 或 DROPPED），不要默默丟掉
        raise RuntimeError(f"V-Dem 有對不到地圖的國家代碼：{', '.join(sorted(unknown))}")
    return series, gaza


def with_gaza(gaza: dict[str, tuple[int, float]], variable: str) -> tuple[dict[str, str], dict[str, str]]:
    """各國附註，加上巴勒斯坦的：地圖的形狀含加薩，資料是約旦河西岸，寫出加薩最近一年的值"""
    notes = {k: zh for k, (zh, _en) in NOTES.items()}
    notes_en = {k: en for k, (_zh, en) in NOTES.items()}
    if variable not in gaza:
        return notes, notes_en
    year, value = gaza[variable]
    zh, en = _fmt(variable, value)
    return (
        {**notes, "PSE": f"V-Dem 把約旦河西岸與加薩走廊分開評分，這裡用約旦河西岸的值；加薩走廊 {year} 年是{zh}。"},
        {**notes_en, "PSE": f"V-Dem scores the West Bank and the Gaza Strip separately; the West Bank is shown here. "
                            f"Gaza in {year}: {en}."},
    )


def index_files(
    out, key: str, variable: str, rows: list[dict[str, str]], years: list[int], *,
    intervals: bool = True, aggregate: str = "WLD",
) -> dict[str, list]:
    """一個 V-Dem 指數（0–1）的指標檔，加 68% 可信區間（intervals/<key>-low、-high.json）。
    aggregate 是 WLD（每年有資料的國家的簡單平均）或 MEDIAN（中位數，政府治理主題的側欄跟 WGI 一樣畫中位數）。
    政府治理（377）、性別平等（378）主題的 V-Dem 指標用它，國家的接續方式跟這個主題一樣。"""
    bounds = [f"{variable}_codelow", f"{variable}_codehigh"] if intervals else []
    series, gaza = country_series(rows, [variable, *bounds], years[0])
    values = {c: to_series(s, years) for c, s in sorted(series[variable].items())}
    agg = []
    for i in range(len(years)):
        present = sorted(s[i] for s in values.values() if s[i] is not None)
        if not present:
            agg.append(None)
        elif aggregate == "MEDIAN":
            mid = len(present) // 2
            agg.append(round(present[mid] if len(present) % 2 else (present[mid - 1] + present[mid]) / 2, 3))
        else:
            agg.append(round(sum(present) / len(present), 3))
    zh_notes, en_notes = with_gaza(gaza, variable)
    write_json(out / f"{key}.json", indicator_file(
        key, "0–1", years, values, aggregates={aggregate: agg}, notes=zh_notes, notesEn=en_notes,
    ))
    for bound, suffix in zip(bounds, ("low", "high")):
        write_json(out / "intervals" / f"{key}-{suffix}.json", indicator_file(
            f"{key}-{suffix}", "0–1", years, {c: to_series(s, years) for c, s in sorted(series[bound].items())},
        ))
    return values


def build() -> None:
    out = OUT_DIR / "topics" / "democracy"
    rows = vdem.rows()
    last_year = max(int(r["year"]) for r in rows)
    years = list(range(FIRST_YEAR, last_year + 1))

    variables = list(INDICES.values()) + [REGIME]
    bounds = [f"{v}_{b}" for v in INDICES.values() for b in ("codelow", "codehigh")]
    series, gaza = country_series(rows, variables + bounds)

    counts: dict[str, int] = {}
    for key, variable in INDICES.items():
        values = {c: to_series(s, years) for c, s in sorted(series[variable].items())}
        # 世界：每年有資料的國家的簡單平均
        world = {}
        for i, y in enumerate(years):
            present = [s[i] for s in values.values() if s[i] is not None]
            if present:
                world[y] = round(sum(present) / len(present), 3)
        zh_notes, en_notes = with_gaza(gaza, variable)
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, "0–1", years, values,
                aggregates={"WLD": to_series(world, years)},
                notes=zh_notes,
                notesEn=en_notes,
            ),
        )
        counts[key] = len(values)
        for bound, suffix in (("codelow", "low"), ("codehigh", "high")):
            write_json(
                out / "intervals" / f"{key}-{suffix}.json",
                indicator_file(
                    f"{key}-{suffix}", "0–1", years,
                    {c: to_series(s, years) for c, s in sorted(series[f"{variable}_{bound}"].items())},
                ),
            )

    regime = {c: to_series({y: int(v) for y, v in s.items()}, years) for c, s in sorted(series[REGIME].items())}
    zh_notes, en_notes = with_gaza(gaza, REGIME)
    write_json(out / "regime.json", indicator_file("regime", "", years, regime, notes=zh_notes, notesEn=en_notes))
    counts["regime"] = len(regime)

    counts.update(_elections(rows, out, years))

    latest = {c: s[-1] for c, s in regime.items() if s[-1] is not None}
    tally = {REGIME_NAMES[k][0]: sum(1 for v in latest.values() if v == k) for k in REGIME_NAMES}
    print(f"  {last_year} 年政體分類：" + "、".join(f"{k} {n} 國" for k, n in tally.items()))
    write_json(
        out / "manifest.json",
        {
            "topic": "democracy",
            "generatedAt": now_iso(),
            "source": f"V-Dem Country-Year Dataset {vdem.VERSION} ({vdem.DOI}), via github.com/vdeminstitute/vdemdata tag V16",
            "license": "CC BY-SA 4.0",
            "years": [years[0], years[-1]],
            "countries": counts,
        },
    )


def _elections(rows: list[dict[str, str]], out, years: list[int]) -> dict[str, int]:
    """投票率（登記選舉人、投票年齡人口）、下議院選舉制度，以及側欄的歷次選舉（elections.json）。

    - V-Dem 的國家—年資料一年只有一個值：同一年有兩場以上的全國選舉時取最大值；行政首長與國會同一天選、投票率不同時
      寫的是行政首長選舉的投票率（V-Dem 代碼簿）。
    - 沿用上一次選舉的值：V-Dem v16 有幾國最近一次選舉的投票率跟上一次一字不差（登記選舉人與投票年齡人口兩種都一樣，
      例如美國 2022、2024 年都是 2020 年的 70.75%、62.36%，突尼西亞 2024 年總統選舉是 2023 年地方議會選舉的 11.4%），
      看起來是還沒更新、沿用上一次的值，這兩種投票率都不採用（側欄與附註寫明）。
    """
    types = [f"v2eltype_{i}" for i in range(len(ELECTION_TYPES))]
    variables = list(TURNOUT.values()) + [ELECTORAL_SYSTEM, "v2elloelsy", "v2elcomvot"] + types
    series, _gaza = country_series(rows, variables)
    elections: dict[str, dict[int, list]] = defaultdict(dict)
    for iso3 in {c for v in variables for c in series[v]}:
        for year in sorted({y for v in [*TURNOUT.values(), ELECTORAL_SYSTEM] + types for y in series[v].get(iso3, {})}):
            mask = sum(1 << i for i, t in enumerate(types) if series[t].get(iso3, {}).get(year) == 1)
            turnout = [series[v].get(iso3, {}).get(year) for v in TURNOUT.values()]
            system = series["v2elloelsy"].get(iso3, {}).get(year)
            if not mask and turnout == [None, None]:
                continue
            elections[iso3][year] = [year, mask, *turnout, None if system is None else int(system)]

    # 跟上一次選舉一字不差的投票率（兩種都一樣）不採用
    repeated: dict[str, list[int]] = defaultdict(list)
    for iso3, by_year in elections.items():
        previous = None
        for year in sorted(by_year):
            e = by_year[year]
            if e[2] is None:
                continue
            # 兩種投票率都要有值而且都一樣才算（共產國家官方公布的 100%、99.9% 常常每次一樣，而且沒有投票年齡人口的值）
            if previous is not None and e[3] is not None and e[2:4] == previous[2:4]:
                repeated[iso3].append(year)
                e[2] = e[3] = None
            else:
                previous = e
    repeated_note = {
        iso3: (
            f"V-Dem v16 給 {'、'.join(map(str, ys))} 年的投票率跟上一次選舉一字不差（登記選舉人與投票年齡人口兩種都一樣），"
            "看起來是沿用上一次的值，這裡不採用。",
            f"V-Dem v16 gives exactly the same turnout for {', '.join(map(str, ys))} as for the previous election "
            "(both registered and voting-age), which looks like a carried-over value, so it is not used here.",
        )
        for iso3, ys in repeated.items()
    }
    print("  沿用上一次的投票率（不採用）：" + "、".join(f"{c} {ys}" for c, ys in sorted(repeated.items())))

    base_zh = {k: zh for k, (zh, _en) in NOTES.items()}
    base_en = {k: en for k, (_zh, en) in NOTES.items()}
    base_zh["PSE"] = "V-Dem 把約旦河西岸與加薩走廊分開評分，這裡用約旦河西岸的值。"
    base_en["PSE"] = "V-Dem scores the West Bank and the Gaza Strip separately; the West Bank is shown here."

    def type_text(mask: int, en: bool) -> str:
        names = [t[1 if en else 0] for i, t in enumerate(ELECTION_TYPES) if mask & (1 << i)]
        return (", ".join(names) + " election") if en else ("、".join(names) + "選舉")

    counts: dict[str, int] = {}
    for key, column in TURNOUT.items():
        index = 2 if key == "registered" else 3
        values: dict[str, list] = {}
        hints: dict[str, str] = {}
        hints_en: dict[str, str] = {}
        for iso3, by_year in sorted(elections.items()):
            own = {y: e[index] for y, e in by_year.items() if e[index] is not None and y >= years[0]}
            if not own:
                continue
            values[iso3] = to_series(own, years, 2)
            last = max(own)
            hints[iso3] = f"{last} 年{type_text(by_year[last][1], False)}" if by_year[last][1] else f"{last} 年"
            hints_en[iso3] = f"{last}: {type_text(by_year[last][1], True)}" if by_year[last][1] else str(last)
        notes_zh = {**base_zh, **{c: zh for c, (zh, _en) in repeated_note.items()}}
        notes_en = {**base_en, **{c: en for c, (_zh, en) in repeated_note.items()}}
        write_json(out / "turnout" / f"{key}.json", indicator_file(
            f"turnout-{key}", "%", years, values, latestWithin=ELECTION_WITHIN,
            hints=hints, hintsEn=hints_en, notes=notes_zh, notesEn=notes_en,
        ))
        counts[f"turnout-{key}"] = len(values)
        recent = {c: max(y for y, e in elections[c].items() if e[index] is not None) for c in values}
        print(f"  投票率（{key}）：{len(values)} 國，最近一次在 {years[-1] - 1} 年以後的 {sum(1 for y in recent.values() if y >= years[-1] - 1)} 國；"
              f"台灣 {[(y, e[index]) for y, e in sorted(elections['TWN'].items()) if e[index] is not None][-3:]}")

    system: dict[str, list] = {}
    sys_hints: dict[str, str] = {}
    sys_hints_en: dict[str, str] = {}
    for iso3, s in sorted(series[ELECTORAL_SYSTEM].items()):
        own = {y: int(v) for y, v in s.items() if y >= years[0]}
        if not own:
            continue
        system[iso3] = to_series(own, years)
        last = max(own)
        detail = series["v2elloelsy"].get(iso3, {}).get(last)
        if detail is not None:
            zh, en = ELECTORAL_SYSTEM_DETAIL[int(detail)]
            sys_hints[iso3] = f"{last} 年國會選舉：{zh}"
            sys_hints_en[iso3] = f"{last} legislative election: {en}"
    write_json(out / "electoral-system.json", indicator_file(
        "electoral-system", "", years, system, latestWithin=ELECTION_WITHIN,
        hints=sys_hints, hintsEn=sys_hints_en, notes=base_zh, notesEn=base_en,
    ))
    counts["electoral-system"] = len(system)
    latest = {c: s[max(s)] for c, s in series[ELECTORAL_SYSTEM].items() if max(s) >= years[-1] - ELECTION_WITHIN + 1}
    print(f"  選舉制度：{len(system)} 國；{years[-1]} 年 {ELECTION_WITHIN} 年內有選舉的 {len(latest)} 國："
          + "、".join(f"{ELECTORAL_SYSTEM_NAMES[k][0]} {sum(1 for v in latest.values() if v == k)}" for k in ELECTORAL_SYSTEM_NAMES))

    # 側欄：每國歷次全國選舉 [年, 類型的位元, 投票率, 占投票年齡人口, 13 類選舉制度]，1900 年起
    write_json(out / "elections.json", {
        "repeated": {c: ys for c, ys in sorted(repeated.items())},
        "countries": {c: [e for y, e in sorted(by_year.items()) if y >= years[0]] for c, by_year in sorted(elections.items())},
    })
    return counts
