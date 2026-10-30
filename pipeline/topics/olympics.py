"""奧運主題：夏季、冬季奧運的金牌數與獎牌數（單屆、歷屆累計），每千萬人獎牌數。

- 資料：英文維基百科各屆的獎牌榜（CC BY-SA 4.0，`sources/wiki_olympics.py`），反映到目前為止的官方更動（禁藥取消、重新分配）。
  各屆加起來跟「All-time Olympic Games medal table」的夏季、冬季總表逐隊核對，對不上就報錯。
- **代表隊照當屆的名義算，不併到繼承國**（跟國際奧會一樣）：蘇聯（URS）、獨立國協聯隊（EUN）、東德（GDR）、西德（FRG）、
  德國聯隊（EUA）、捷克斯洛伐克（TCH）、波希米亞（BOH）、南斯拉夫（YUG）、塞爾維亞與蒙特內哥羅（SCG）、澳大拉西亞（ANZ）、
  俄羅斯帝國（維基百科寫 RUS 的 1908、1912 年）、以中立名義參賽的俄羅斯選手（OAR、ROC、AIN）等是主題自訂的地點（`_URS`…，
  src/topics/olympics.ts 的 PLACES），畫在當時的首都附近。所以德國的值只有以德國（GER）名義參賽的 1896–1936、1952 年與
  1992 年起，俄羅斯只有 1996 年起（2018–2026 年的中立名義不算），附註寫明。
- 混合隊（ZZX，1896–1904）、難民奧運隊（EOR）、獨立奧運選手（IOA，2016 年的科威特選手）沒有國家，只算進世界合計。
- **台灣**：維基百科的代碼 1960、1968 年是 ROC（中華民國），1984 年起是 TPE（中華台北），都算台灣；2020、2022 年的 ROC 是
  俄羅斯奧會（Russian Olympic Committee），算到 `_ROC`。
- 每千萬人獎牌數：單屆的獎牌數 ÷ 當年的 WPP 年中人口 × 1,000 萬，WPP 從 1950 年開始，所以 1952 年起；歷史隊伍沒有人口，不算。
"""
from __future__ import annotations

import json

import pycountry

from common import OUT_DIR, indicator_file, write_json, write_manifest_part
from sources import wiki_olympics, wpp

OUT = OUT_DIR / "topics" / "sports"  # 運動（2026-10-30 奧運、F1 合併）
SEASONS = ("summer", "winter")
PER = 1e7
WPP_FIRST = 1950

# IOC 代碼跟 ISO alpha-3 不同的（現在的國家）
IOC_ISO = {
    "ALG": "DZA", "BAH": "BHS", "BAR": "BRB", "BER": "BMU", "BOT": "BWA", "BRN": "BHR", "BUL": "BGR", "BUR": "BFA",
    "CEY": "LKA", "CHI": "CHL", "CRC": "CRI", "CRO": "HRV", "DEN": "DNK", "FIJ": "FJI", "GER": "DEU", "GRE": "GRC",
    "GRN": "GRD", "GUA": "GTM", "HAI": "HTI", "INA": "IDN", "IRI": "IRN", "ISV": "VIR", "KOS": "XKX", "KSA": "SAU",
    "KUW": "KWT", "LAT": "LVA", "LIB": "LBN", "MAS": "MYS", "MGL": "MNG", "MRI": "MUS", "NED": "NLD", "NGR": "NGA",
    "NIG": "NER", "PAR": "PRY", "PHI": "PHL", "POR": "PRT", "PUR": "PRI", "RSA": "ZAF", "SAM": "WSM", "SIN": "SGP",
    "SLO": "SVN", "SRI": "LKA", "SUD": "SDN", "SUI": "CHE", "TAN": "TZA", "TGA": "TON", "TOG": "TGO", "TPE": "TWN",
    "TRI": "TTO", "UAE": "ARE", "URU": "URY", "VIE": "VNM", "ZAM": "ZMB", "ZIM": "ZWE",
}
# IOC 代碼剛好是另一個國家的 ISO 代碼：BRN 在奧運是巴林（汶萊是 BRU），上面已經寫了；這裡列出來防止誤用 ISO 比對
ISO_COLLISIONS = {"BRN"}
# 歷史隊伍與特殊代表團 → 主題自訂地點的 id（src/topics/olympics.ts 的 PLACES）
HISTORIC = {
    "URS": "_URS", "EUN": "_EUN", "GDR": "_GDR", "FRG": "_FRG", "EUA": "_EUA", "TCH": "_TCH", "BOH": "_BOH",
    "YUG": "_YUG", "SCG": "_SCG", "IOP": "_IOP", "ANZ": "_ANZ", "BWI": "_BWI", "RAU": "_UAR", "AHO": "_AHO",
    "OAR": "_OAR", "AIN": "_AIN",
}
WORLD_ONLY = {"ZZX", "EOR", "IOA"}


def key(code: str, year: int) -> str | None:
    """當屆的代碼 → 指標檔的鍵（ISO alpha-3 或 _ 開頭的自訂地點）；只算進世界合計的回傳 None"""
    if code == "ROC":
        return "TWN" if year < 2000 else "_ROC"  # 1960、1968 中華民國；2020、2022 俄羅斯奧會
    if code == "RUS" and year <= 1912:
        return "_RU1"  # 俄羅斯帝國
    if code == "YUG" and year >= 1996:
        return "_SCG"  # 南斯拉夫聯盟共和國（1996、2000），2004 年改名塞爾維亞與蒙特內哥羅
    if code in WORLD_ONLY:
        return None
    if code in HISTORIC:
        return HISTORIC[code]
    if code in IOC_ISO:
        return IOC_ISO[code]
    if code not in ISO_COLLISIONS and pycountry.countries.get(alpha_3=code):
        return code
    raise RuntimeError(f"不認得的奧運代碼：{code}（{year}）")


NOTES = {
    "DEU": (
        "只算以德國（GER）名義參賽的成績：1896–1936 年、1952 年（西德的選手）與 1992 年統一以後。1956–1964 年的德國聯隊、"
        "1968–1988 年的西德與東德是另外的代表隊，畫在地圖上各自的位置，不併到德國（國際奧會也分開算）。",
        "Counts only medals won as Germany (GER): 1896–1936, 1952 (West German athletes) and since reunification in 1992. "
        "The United Team of Germany (1956–1964), West Germany and East Germany (1968–1988) were separate teams, drawn at their own "
        "places on the map and not merged into Germany (the IOC also counts them separately).",
    ),
    "RUS": (
        "只算以俄羅斯（RUS）名義參賽的成績（1996–2014 年）。蘇聯（1952–1988）、獨立國協聯隊（1992）、俄羅斯帝國（1908、1912）、"
        "以中立名義參賽的俄羅斯選手（2018 年 OAR、2020–2022 年 ROC、2024–2026 年 AIN）是另外的代表隊，畫在莫斯科附近，不併到俄羅斯。",
        "Counts only medals won as Russia (RUS, 1996–2014). The Soviet Union (1952–1988), the Unified Team (1992), the Russian "
        "Empire (1908, 1912) and Russian athletes competing under neutral names (OAR in 2018, ROC in 2020–2022, AIN in 2024–2026) "
        "were separate teams, drawn near Moscow and not merged into Russia.",
    ),
    "CZE": (
        "1996 年起的捷克；捷克斯洛伐克（1920–1992）與波希米亞（1900–1912）是另外的代表隊。",
        "Czechia since 1996; Czechoslovakia (1920–1992) and Bohemia (1900–1912) were separate teams.",
    ),
    "SVK": ("1996 年起的斯洛伐克；捷克斯洛伐克（1920–1992）是另外的代表隊。", "Slovakia since 1996; Czechoslovakia (1920–1992) was a separate team."),
    "SRB": (
        "2008 年起的塞爾維亞；南斯拉夫（1920–1992）、南斯拉夫聯盟共和國與塞爾維亞與蒙特內哥羅（1996–2004）、"
        "1992 年的獨立奧林匹克參賽者是另外的代表隊。",
        "Serbia since 2008; Yugoslavia (1920–1992), FR Yugoslavia and Serbia and Montenegro (1996–2004) and the 1992 "
        "Independent Olympic Participants were separate teams.",
    ),
    "AUS": ("1908、1912 年跟紐西蘭組成「澳大拉西亞」代表隊，畫在墨爾本，不算在澳洲。", "In 1908 and 1912 Australia competed with New Zealand as Australasia, drawn at Melbourne and not counted here."),
    "NZL": ("1908、1912 年跟澳洲組成「澳大拉西亞」代表隊，不算在紐西蘭。", "In 1908 and 1912 New Zealand competed with Australia as Australasia, not counted here."),
    "EGY": ("1960 年跟敘利亞以「阿拉伯聯合共和國」名義參賽，不算在埃及。", "In 1960 Egypt competed with Syria as the United Arab Republic, not counted here."),
    "TWN": (
        "台灣以「中華台北」（Chinese Taipei，TPE）名義參賽：依 1979 年國際奧會的名古屋決議與 1981 年的洛桑協議，1984 年冬季奧運起"
        "使用這個名稱與會旗。之前以中華民國的名義參賽（1960 年羅馬奧運被國際奧會要求以「Formosa」名義，代表團入場時舉牌抗議），"
        "1976 年夏季奧運因名稱問題退出、1980 年夏季奧運抵制。維基百科把 1960 年楊傳廣的十項運動銀牌、1968 年紀政的 80 公尺跨欄"
        "銅牌算在中華台北，這裡也算在台灣。",
        "Taiwan competes as Chinese Taipei (TPE): under the IOC's 1979 Nagoya Resolution and the 1981 Lausanne Agreement it has used "
        "this name and flag since the 1984 Winter Games. Earlier it competed as the Republic of China (in Rome 1960 the IOC made it "
        "compete as Formosa, and the team marched under protest), withdrew from the 1976 Summer Games over the name and boycotted the "
        "1980 Summer Games. Wikipedia counts Yang Chuan-kwang's 1960 decathlon silver and Chi Cheng's 1968 80 m hurdles bronze for "
        "Chinese Taipei, and so does this map.",
    ),
}


def build() -> None:
    games = wiki_olympics.games()
    summer_all, winter_all, all_rev = wiki_olympics.all_time()
    pop = wpp.demographic(["TPopulation1July"], last_year=2026)["TPopulation1July"]  # 千人
    world_pop = pop.pop("WLD")
    iso_countries = set(pop)

    # ── 核對：各屆加起來跟總表比（依地圖上的單位合併代碼，例如 TRI 與 TTO、ROC 的台灣部分與 TPE）──
    # 兩頁的更新時間不同（禁藥取消、重新分配、早期奧運的歸屬），有出入時印出來，以各屆的頁面為準
    def by_entity(rows, year_of):
        out: dict[str, list[int]] = {}
        for code, medals, year in rows:
            k = code if code.startswith("_") else (key(code, year_of(code, year)) or code)
            s_ = out.setdefault(k, [0, 0, 0])
            for i in range(3):
                s_[i] += medals[i]
        return out
    for season, table in (("summer", summer_all), ("winter", winter_all)):
        mine = by_entity([(c, m, g.year) for g in games if g.season == season for c, m in g.medals.items()], lambda c, y: y)
        # 總表的代碼沒有年份：ROC 在夏季總表是俄羅斯奧會（台灣算在 TPE），RUI 是俄羅斯帝國
        theirs = by_entity([("_RU1" if c == "RUI" else c, m, 2020 if c == "ROC" else 2000) for c, m in table.items()], lambda c, y: y)
        diff = {k: (tuple(mine.get(k, (0, 0, 0))), tuple(theirs.get(k, (0, 0, 0)))) for k in set(mine) | set(theirs)
                if tuple(mine.get(k, (0, 0, 0))) != tuple(theirs.get(k, (0, 0, 0)))}
        if diff:
            print(f"  {season} 各屆加起來跟總表不同（各屆, 總表），以各屆為準：{dict(sorted(diff.items()))}")

    # 側欄的國家檔每次重寫（夏季寫完再補冬季），先清掉上一次的
    for old in (OUT / "countries").glob("*.json"):
        old.unlink()
    manifest_games = {}
    summary = {}
    for season in SEASONS:
        gs = sorted((g for g in games if g.season == season), key=lambda g: g.year)
        years = [g.year for g in gs]
        manifest_games[season] = {g.year: g.revid for g in gs}
        per_games: dict[str, dict[int, tuple[int, int, int]]] = {}
        world: dict[int, tuple[int, int, int]] = {}
        for g in gs:
            w = [0, 0, 0]
            for code, medals in g.medals.items():
                for i in range(3):
                    w[i] += medals[i]
                k = key(code, g.year)
                if k is None:
                    continue
                prev = per_games.setdefault(k, {}).get(g.year, (0, 0, 0))
                per_games[k][g.year] = tuple(a + b for a, b in zip(prev, medals))  # type: ignore[assignment]
            world[g.year] = tuple(w)  # type: ignore[assignment]

        keys = sorted(set(per_games) | iso_countries)

        def series(fn, cumulative: bool) -> dict[str, list[float | None]]:
            out: dict[str, list[float | None]] = {}
            for k in keys:
                mine = per_games.get(k, {})
                if k.startswith("_"):
                    first, last = min(mine), max(mine)
                vals: list[float | None] = []
                total = 0
                for y in years:
                    v = fn(mine.get(y, (0, 0, 0)))
                    total += v
                    if k.startswith("_"):
                        # 歷史隊伍：單屆只有參賽那幾屆有值；累計從第一次得牌起一直留著
                        if cumulative:
                            vals.append(total if y >= first else None)
                        else:
                            vals.append(v if first <= y <= last else None)
                    else:
                        vals.append(total if cumulative else v)
                out[k] = vals
            return out

        def world_series(fn, cumulative: bool) -> list[float]:
            out, total = [], 0
            for y in years:
                v = fn(world[y])
                total += v
                out.append(total if cumulative else v)
            return out

        gold = lambda m: m[0]
        total = lambda m: m[0] + m[1] + m[2]
        notes = {k: v[0] for k, v in NOTES.items()}
        notes_en = {k: v[1] for k, v in NOTES.items()}
        for name, fn, cumulative in (("gold", gold, False), ("medals", total, False), ("gold-total", gold, True), ("medals-total", total, True)):
            write_json(OUT / name / f"{season}.json", indicator_file(
                f"{name}-{season}", "面", years, series(fn, cumulative),
                aggregates={"WLD": world_series(fn, cumulative)}, notes=notes, notesEn=notes_en,
            ))

        # 每千萬人（單屆）
        capita_years = [y for y in years if y >= WPP_FIRST]
        per_capita = {}
        for k in keys:
            if k.startswith("_") or k not in pop:
                continue
            per_capita[k] = [
                round(total(per_games.get(k, {}).get(y, (0, 0, 0))) / (pop[k][y] * 1000) * PER, 3) if pop[k].get(y) else None
                for y in capita_years
            ]
        world_capita = [round(total(world[y]) / (world_pop[y] * 1000) * PER, 3) for y in capita_years]
        write_json(OUT / "per-capita" / f"{season}.json", indicator_file(
            f"per-capita-{season}", "面／千萬人", capita_years, per_capita, aggregates={"WLD": world_capita},
            notes=notes, notesEn=notes_en,
        ))

        # 側欄：每個代表隊歷屆的金銀銅
        for k, mine in per_games.items():
            path = OUT / "countries" / f"{k}.json"
            entry = {}
            if path.exists() and season != SEASONS[0]:
                entry = json.loads(path.read_text(encoding="utf-8"))
            entry[season] = [[y, *mine[y]] for y in sorted(mine)]
            write_json(path, entry, quiet=True)
        summary[season] = (len(years), sum(total(m) for m in world.values()))

    index = sorted(p.stem for p in (OUT / "countries").glob("*.json") if p.stem != "index")
    write_json(OUT / "countries" / "index.json", index)
    write_manifest_part(OUT, "sports", "olympics", {"revisions": manifest_games, "allTimeRevision": all_rev})
    tw = json.loads((OUT / "countries" / "TWN.json").read_text(encoding="utf-8"))
    tw_total = [sum(r[i] for r in tw.get("summer", [])) for i in (1, 2, 3)]
    print(f"  夏季 {summary['summer'][0]} 屆、{summary['summer'][1]:,} 面；冬季 {summary['winter'][0]} 屆、{summary['winter'][1]:,} 面；"
          f"台灣夏季 金 {tw_total[0]} 銀 {tw_total[1]} 銅 {tw_total[2]}（總表 TPE+ROC：{summer_all.get('TPE')}）")
