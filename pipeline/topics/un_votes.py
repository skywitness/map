"""聯合國投票主題：Erik Voeten 的聯合國大會投票資料（Harvard Dataverse 第 39 版，CC0 1.0）。

指標（都只看決議案的最後表決，含沒有通過的；年份是投票的日曆年，不是大會的屆次）：
- 與美國、與中國、與其他 16 國的投票一致度（agree/<ISO3>.json，0–100%）：作者算好的兩兩國家一致度
  （Lijphart 一致指數：兩國都參加的表決裡，投票相同算 1、一方棄權另一方贊成或反對算 0.5、一贊成一反對算 0，
  缺席的不算），1946–2024。
- 理想點（ideal-point.json）：Bailey, Strezhnev & Voeten (2017) 的一維立場估計，1946–2025；
  另外輸出 90% 可信區間（intervals/）與參加的表決次數（votes.json），給側欄用。

國家代碼：資料集用 Correlates of War（COW）的數字代碼，理想點檔另外附 ISO alpha-3（iso3c 欄），
歷史上的國家照 iso3c 對到今天的國界（跟民主主題的 V-Dem 一樣的接續方式）：
- 俄羅斯 1946–1991 年是蘇聯（COW 365 本來就連在一起），烏克蘭、白俄羅斯在蘇聯時期就有自己的席位。
- 捷克斯洛伐克（CSK）→ 捷克，南斯拉夫（YUG）、南斯拉夫聯盟共和國／塞爾維亞與蒙特內哥羅（SCG）→ 塞爾維亞，
  北葉門（YAR）→ 葉門，西德（COW 260）→ 德國。
- 不收（地圖上沒有形狀）：東德（COW 265）、南葉門（COW 680）、尚吉巴（COW 511，只有 1963 年）。相關國家的附註有寫。
- 台灣：COW 713 是 1946–1971 年聯合國中國席位上的中華民國，iso3c 也是 TWN，照原樣放在台灣；
  中國（COW 710）是 1971 年 11 月起的中華人民共和國。1971 年兩個都有值（中華民國到 10 月 25 日、中華人民共和國之後）。
- 1964 年整年沒有記名表決（第 19 屆大會因會費爭議避免表決），年份仍保留、整年都是 null，
  側欄折線在那一年斷開，不會把前後連起來。

世界值：每年有值的國家的簡單平均（每國一樣重）。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import unvotes
from sources.countries import ISO3

# 比較對象：前兩個是自己的指標（與美國、與中國），其他是「與各國的投票一致度」的子項目（跟 src/topics/un-votes.ts 一致）
REFERENCES: dict[str, tuple[str, str]] = {
    "USA": ("美國", "the United States"),
    "CHN": ("中國", "China"),
    "RUS": ("俄羅斯", "Russia"),
    "GBR": ("英國", "the United Kingdom"),
    "FRA": ("法國", "France"),
    "DEU": ("德國", "Germany"),
    "UKR": ("烏克蘭", "Ukraine"),
    "JPN": ("日本", "Japan"),
    "KOR": ("南韓", "South Korea"),
    "IND": ("印度", "India"),
    "IDN": ("印尼", "Indonesia"),
    "AUS": ("澳洲", "Australia"),
    "TUR": ("土耳其", "Türkiye"),
    "IRN": ("伊朗", "Iran"),
    "ISR": ("以色列", "Israel"),
    "EGY": ("埃及", "Egypt"),
    "ZAF": ("南非", "South Africa"),
    "BRA": ("巴西", "Brazil"),
}

# 理想點檔的 iso3c → 地圖的代碼（歷史上的國家接到今天的國家）
RENAME = {"CSK": "CZE", "YUG": "SRB", "SCG": "SRB", "YAR": "YEM"}
# 地圖上沒有形狀、不收的 COW 代碼
DROPPED_COW = {265: "東德", 680: "南葉門", 511: "尚吉巴"}

# 各國附註（中文, 英文）。{tw_votes}、{cn_votes} 是 1971 年中華民國、中華人民共和國參加的表決次數，由資料填入
NOTES: dict[str, tuple[str, str]] = {
    "TWN": (
        "1946–1971 年聯合國的中國席位由中華民國代表，資料集記為台灣（COW 代碼 713），這裡放在台灣。"
        "1971 年 10 月 25 日聯大第 2758 號決議改由中華人民共和國代表中國，中華民國在表決前宣布退出聯合國；"
        "1971 年只有到 10 月 25 日為止的 {tw_votes} 次表決，1972 年起沒有投票紀錄。",
        "From 1946 to 1971 China's seat in the UN was held by the Republic of China; the dataset records these votes "
        "as Taiwan (COW code 713), and they are shown here. On 25 October 1971 General Assembly Resolution 2758 "
        "gave the seat to the People's Republic of China, and the Republic of China announced its withdrawal from "
        "the UN before the vote. 1971 has only {tw_votes} votes, up to 25 October; there are no votes from 1972.",
    ),
    "CHN": (
        "1971 年 10 月 25 日聯大第 2758 號決議後由中華人民共和國代表中國，11 月 15 日起出席，"
        "1971 年的值只有之後的 {cn_votes} 次表決。1946–1971 年中國席位上的投票（中華民國）放在台灣。",
        "The People's Republic of China has represented China since General Assembly Resolution 2758 of "
        "25 October 1971 and took part from 15 November, so 1971 covers only the {cn_votes} votes after that. "
        "Votes cast in China's seat in 1946–1971 (by the Republic of China) are shown under Taiwan.",
    ),
    "RUS": (
        "1946–1991 年是蘇聯（資料集的 COW 代碼 365 從蘇聯接續到俄羅斯）。",
        "1946–1991 is the Soviet Union (the dataset's COW code 365 continues from the USSR to Russia).",
    ),
    "UKR": (
        "1946–1991 年是烏克蘭蘇維埃社會主義共和國：跟白俄羅斯一樣，在蘇聯時期就是聯合國的創始會員國，有自己的席位與投票。",
        "1946–1991 is the Ukrainian SSR, which, like Byelorussia, was a founding UN member with its own seat and vote "
        "while part of the Soviet Union.",
    ),
    "BLR": (
        "1946–1991 年是白俄羅斯蘇維埃社會主義共和國：跟烏克蘭一樣，在蘇聯時期就是聯合國的創始會員國，有自己的席位與投票。",
        "1946–1991 is the Byelorussian SSR, which, like Ukraine, was a founding UN member with its own seat and vote "
        "while part of the Soviet Union.",
    ),
    "DEU": (
        "1973–1989 年是西德（兩德 1973 年 9 月同時加入聯合國）；東德另外投票，地圖上沒有它的形狀，所以沒有放。",
        "1973–1989 is West Germany (both German states joined the UN in September 1973); East Germany voted "
        "separately and has no shape on today's map, so it is not shown.",
    ),
    "CZE": ("1946–1992 年是捷克斯洛伐克。", "1946–1992 is Czechoslovakia."),
    "SVK": (
        "1993 年起才有投票紀錄，之前是捷克斯洛伐克的一部分（放在捷克）。",
        "Votes only from 1993; before that Slovakia was part of Czechoslovakia (shown under Czechia).",
    ),
    "SRB": (
        "1946–1991 年是南斯拉夫社會主義聯邦共和國，1992–2005 年是南斯拉夫聯盟共和國（2003 年改名塞爾維亞與蒙特內哥羅；"
        "1992 年 9 月到 2000 年 10 月沒有參加大會），2006 年起是塞爾維亞。",
        "1946–1991 is socialist Yugoslavia, 1992–2005 the Federal Republic of Yugoslavia (renamed Serbia and Montenegro "
        "in 2003; it did not take part in the General Assembly from September 1992 to October 2000), and Serbia from 2006.",
    ),
    "YEM": (
        "1947–1989 年是北葉門（葉門阿拉伯共和國）；南葉門（1967–1990 年的會員國）地圖上沒有它的形狀，所以沒有放。",
        "1947–1989 is North Yemen (Yemen Arab Republic); South Yemen (a member in 1967–1990) has no shape on "
        "today's map, so it is not shown.",
    ),
    "TZA": (
        "1961–1963 年是坦干依喀；尚吉巴 1963 年 12 月加入聯合國、1964 年 4 月跟坦干依喀合併，1963 年尚吉巴的投票沒有放。",
        "1961–1963 is Tanganyika; Zanzibar joined the UN in December 1963 and merged with Tanganyika in April 1964, "
        "and its 1963 votes are not shown.",
    ),
    "EGY": (
        "1958–1961 年是埃及與敘利亞合組的阿拉伯聯合共和國，投票記在埃及。",
        "1958–1961 is the United Arab Republic of Egypt and Syria, whose votes are recorded under Egypt.",
    ),
    "SYR": (
        "1958–1961 年跟埃及合組阿拉伯聯合共和國，這段期間的投票記在埃及；1961 年 9 月退出後恢復自己的席位。",
        "In 1958–1961 Syria formed the United Arab Republic with Egypt, and its votes are recorded under Egypt; "
        "Syria resumed its own seat after leaving in September 1961.",
    ),
    "ZAF": (
        "1974 年 11 月起大會不讓南非代表團參加（種族隔離政策），1994 年 6 月恢復，所以 1975–1993 年沒有投票紀錄。",
        "From November 1974 the General Assembly barred South Africa's delegation from taking part (over apartheid) "
        "until June 1994, so there are no votes in 1975–1993.",
    ),
    "IDN": (
        "1965 年 1 月宣布退出聯合國，1966 年 9 月回來，所以 1965 年沒有投票紀錄。",
        "Indonesia announced its withdrawal from the UN in January 1965 and returned in September 1966, "
        "so there are no votes in 1965.",
    ),
    "CHE": ("2002 年 9 月才加入聯合國，之前是觀察員。", "Switzerland joined the UN only in September 2002 and was an observer before."),
}


def _country_map(ideal_rows: list[dict]) -> dict[int, str]:
    """COW 代碼 → 地圖的代碼。用理想點檔的 iso3c，再把歷史上的國家接到今天的國家；一個 COW 代碼只能對到一個地方"""
    out: dict[int, str] = {}
    for r in ideal_rows:
        if r["ccode"] in DROPPED_COW:
            continue
        iso3 = RENAME.get(r["iso3c"], r["iso3c"])
        if iso3 not in ISO3:
            raise RuntimeError(f"理想點檔有對不到地圖的國家：COW {r['ccode']} {r['iso3c']} {r['name']}（要加進 RENAME 或 DROPPED_COW）")
        if out.setdefault(r["ccode"], iso3) != iso3:
            raise RuntimeError(f"COW {r['ccode']} 同時對到 {out[r['ccode']]} 與 {iso3}")
    return out


def _years(series: dict[str, dict[int, float]]) -> list[int]:
    """第一個到最後一個有資料的年份，中間沒有資料的年份（1964）也保留"""
    observed = {y for s in series.values() for y in s}
    return list(range(min(observed), max(observed) + 1))


def _world(values: dict[str, list[float | None]], years: list[int], digits: int) -> list[float | None]:
    """世界值：每年有值的國家的簡單平均"""
    out: list[float | None] = []
    for i in range(len(years)):
        present = [s[i] for s in values.values() if s[i] is not None]
        out.append(round(sum(present) / len(present), digits) if present else None)
    return out


def build() -> None:
    out = OUT_DIR / "topics" / "un-votes"
    ideal_rows = unvotes.ideal_points()
    cow = _country_map(ideal_rows)
    iso_cows: dict[str, set[int]] = defaultdict(set)
    for code, iso3 in cow.items():
        iso_cows[iso3].add(code)

    # ── 理想點、可信區間、表決次數 ──
    ideal: dict[str, dict[int, float]] = defaultdict(dict)
    low: dict[str, dict[int, float]] = defaultdict(dict)
    high: dict[str, dict[int, float]] = defaultdict(dict)
    votes: dict[str, dict[int, int]] = defaultdict(dict)
    for r in ideal_rows:
        if r["ccode"] in DROPPED_COW:
            continue
        iso3, year = cow[r["ccode"]], r["year"]
        if year in ideal[iso3]:
            raise RuntimeError(f"{iso3} {year} 年有兩筆理想點（COW {sorted(iso_cows[iso3])}）")
        ideal[iso3][year] = round(r["ideal"], 2)
        low[iso3][year] = round(r["q5"], 2)
        high[iso3][year] = round(r["q95"], 2)
        votes[iso3][year] = r["votes"]

    fill = {"tw_votes": votes["TWN"][1971], "cn_votes": votes["CHN"][1971]}
    notes = {k: zh.format(**fill) for k, (zh, _en) in NOTES.items()}
    notes_en = {k: en.format(**fill) for k, (_zh, en) in NOTES.items()}

    years = _years(ideal)
    values = {c: to_series(s, years) for c, s in sorted(ideal.items())}
    write_json(out / "ideal-point.json", indicator_file(
        "ideal-point", "", years, values,
        aggregates={"WLD": _world(values, years, 2)}, notes=notes, notesEn=notes_en,
    ))
    for name, series in (("low", low), ("high", high)):
        write_json(out / "intervals" / f"ideal-point-{name}.json", indicator_file(
            f"ideal-point-{name}", "", years, {c: to_series(s, years) for c, s in sorted(series.items())},
        ))
    write_json(out / "votes.json", indicator_file(
        "votes", "次", years, {c: to_series(s, years) for c, s in sorted(votes.items())},
    ))
    counts: dict[str, int] = {"ideal-point": len(values)}
    spans: dict[str, list[int]] = {"ideal-point": [years[0], years[-1]]}

    # ── 一致度：只留比較對象那一邊的列 ──
    cols = unvotes.agreement()
    ref_cows = {code: iso3 for iso3 in REFERENCES for code in iso_cows[iso3]}
    agree: dict[str, dict[str, dict[int, float]]] = {r: defaultdict(dict) for r in REFERENCES}
    unknown: set[int] = set()
    for c1, c2, year, value in zip(cols["ccode1"], cols["ccode2"], cols["year"], cols["agree"]):
        ref = ref_cows.get(c1)
        if ref is None or value is None or c2 in DROPPED_COW:
            continue
        partner = cow.get(c2)
        if partner is None:
            unknown.add(c2)
            continue
        if year in agree[ref][partner]:
            raise RuntimeError(f"{ref}–{partner} {year} 年有兩筆一致度")
        agree[ref][partner][year] = round(value * 100, 1)
    if unknown:
        raise RuntimeError(f"一致度檔有理想點檔沒有的 COW 代碼：{sorted(unknown)}（要加進 DROPPED_COW 或對照表）")

    for ref, (zh_name, en_name) in REFERENCES.items():
        series = agree[ref]
        ref_years = _years(series)
        ref_values = {c: to_series(s, ref_years) for c, s in sorted(series.items())}
        # 比較對象自己沒有值：附註說明，接在原本的附註後面
        own = (f"這張圖是各國跟{zh_name}的投票一致度，{zh_name}本身沒有值。",
               f"This map shows each country's voting agreement with {en_name}, so {en_name} itself has no value.")
        ref_notes = {**notes, ref: "".join(filter(None, [notes.get(ref), own[0]]))}
        ref_notes_en = {**notes_en, ref: " ".join(filter(None, [notes_en.get(ref), own[1]]))}
        write_json(out / "agree" / f"{ref}.json", indicator_file(
            f"agree-{ref}", "%", ref_years, ref_values,
            aggregates={"WLD": _world(ref_values, ref_years, 1)}, notes=ref_notes, notesEn=ref_notes_en,
        ))
        counts[f"agree/{ref}"] = len(ref_values)
        spans[f"agree/{ref}"] = [ref_years[0], ref_years[-1]]

    # 驗證用的數字：美中一致度、台灣（中華民國）與美國的一致度
    usa_chn = agree["USA"]["CHN"]
    print("  美國與中國的一致度：" + "、".join(f"{y} 年 {usa_chn[y]:.1f}%" for y in (1971, 1972, 1980, 1990, 2000, 2010, 2020, 2024)))
    usa_twn = agree["USA"]["TWN"]
    print("  美國與台灣（中華民國）的一致度：" + "、".join(f"{y} 年 {usa_twn[y]:.1f}%" for y in (1946, 1950, 1960, 1965, 1970, 1971)))
    print(f"  1971 年參加的表決：中華民國 {fill['tw_votes']} 次、中華人民共和國 {fill['cn_votes']} 次")
    last = spans["agree/USA"][1]
    print(f"  {last} 年跟美國有一致度的國家 {sum(1 for s in agree['USA'].values() if last in s)} 個；"
          f"{years[-1]} 年有理想點的國家 {sum(1 for s in ideal.values() if years[-1] in s)} 個")

    write_json(out / "manifest.json", {
        "topic": "un-votes",
        "generatedAt": now_iso(),
        "source": (f"Erik Voeten, United Nations General Assembly Ideal Points, Harvard Dataverse V{unvotes.VERSION} "
                   f"({unvotes.RELEASED}, {unvotes.DOI}); files "
                   + ", ".join(f"{name} (id {fid})" for fid, name, _md5 in unvotes.FILES.values())),
        "license": "CC0 1.0",
        "years": spans,
        "countries": counts,
    })
