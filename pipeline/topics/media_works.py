"""遊戲與動漫的三個新主題（2026-11-08，製作手冊第二十七批 654、655、656）：Wikidata（CC0）經 QLever（sources/qlever_wikidata.py）。

- 654「動畫是哪裡做的」（步驟 anime，輸出 topics/anime/）：動畫工作室（Q1107679 含子類別；點用 P625 或總部 P159 的座標，
  有 P576 解散日期的另一色）、動畫電影（Q202866 含子類別）依原產國 P495 與年份（P577 最早的一個）累計、電視動畫
  （Q63952888）依原產國、聲優與配音員（P106 是 Q2405480 voice actor 或 Q622807 声優，**兩個都要**，只用前者日本只有 81 人）
  依國籍 P27 與每百萬人、奧斯卡最佳動畫長片（P166 = Q106800）依原產國或國籍。
- 655「漫畫是哪裡來的」（步驟 comics，輸出 topics/comics/）：漫畫作品（Q1004 含子類別）依原產國（六成沒有年份，不做時間軸）、網路漫畫（webtoon Q7978994、manhwa Q562214、manhua Q754669、webcomic Q213369，含子類別）依原產國、四個漫畫獎（艾斯納
  Q842614、手塚治虫文化賞 Q1336528、講談社漫畫賞 Q39174、小學館漫畫賞 Q836736）的得主依國籍或原產國。
- 656「電視劇的產地」（步驟 tv-series，輸出 topics/tv-series/）：電視劇（P31 直接是 Q5398426）依原產國與首播年份
  （P580 或 P577 最早的）累計。
原產國是已經不存在的國家時算到現在的繼承國（蘇聯→俄羅斯、捷克斯洛伐克→捷克、南斯拉夫→塞爾維亞、東德與西德→德國），
說明寫明；國際合製有好幾個原產國的，每國各算一次（總和會大於作品數）。
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import qlever_wikidata, wpp
from zh_names import wikidata_zh

YEAR = 2026
FORMER = {"Q15180": "RUS", "Q33946": "CZE", "Q36704": "SRB", "Q16957": "DEU", "Q713750": "DEU", "Q83286": "SRB"}
MIN_POP = 1000  # 千人


# Wikidata 給已經不存在的國家 ISO 3166-3 的舊代碼（蘇聯 SUN、捷克斯洛伐克 CSK…），也換成繼承國
ISO_FORMER = {"SUN": "RUS", "CSK": "CZE", "YUG": "SRB", "SCG": "SRB", "DDR": "DEU", "BUR": "MMR", "ZAR": "COD", "YMD": "YEM",
              "TMP": "TLS", "ANT": "CUW"}


def _iso(r: dict) -> str | None:
    if "iso" in r:
        v = r["iso"]["value"]
        return ISO_FORMER.get(v, v)
    q = r.get("c", {}).get("value", "").rsplit("/", 1)[-1]
    return FORMER.get(q)


def _by_country(name: str, where: str, key: str = "P495") -> Counter:
    """WHERE 子句裡用 ?w 的作品（或人）依國家數：{ISO3: 件數}（同一件作品在同一國只算一次）"""
    rows = qlever_wikidata.cached(name, f"""SELECT ?c ?iso (COUNT(DISTINCT ?w) AS ?n) WHERE {{
  {where}
  ?w wdt:{key} ?c .
  OPTIONAL {{ ?c wdt:P298 ?iso }}
}} GROUP BY ?c ?iso""")
    out: Counter = Counter()
    for r in rows:
        iso = _iso(r)
        if iso:
            out[iso] += int(r["n"]["value"])
    return out


def _by_country_year(name: str, where: str, date_props: tuple[str, ...]) -> dict[str, Counter]:
    """{ISO3: Counter({年: 件數})}，年份是 date_props 裡最早的一個；沒有年份的放在 0"""
    dates = " UNION ".join(f"{{ ?w wdt:{p} ?d }}" for p in date_props)
    rows = qlever_wikidata.cached(name, f"""SELECT ?c ?iso ?y (COUNT(DISTINCT ?w) AS ?n) WHERE {{
  {{ SELECT ?w (MIN(YEAR(?d)) AS ?y0) WHERE {{ {where} OPTIONAL {{ {dates} }} }} GROUP BY ?w }}
  BIND(COALESCE(?y0, 0) AS ?y)
  ?w wdt:P495 ?c .
  OPTIONAL {{ ?c wdt:P298 ?iso }}
}} GROUP BY ?c ?iso ?y""")
    out: dict[str, Counter] = defaultdict(Counter)
    for r in rows:
        iso = _iso(r)
        if not iso:
            continue
        y = int(float(r["y"]["value"]))
        out[iso][y if 1800 <= y <= YEAR else 0] += int(r["n"]["value"])
    return out


def _write_cumulative(path, name: str, unit: str, data: dict[str, Counter], first: int) -> tuple[list[int], dict]:
    """依年份累計。沒有年份的作品不算進時間軸（堆在最後一年會讓最後一年跳一大段），改在 hints 寫「另有幾部沒有年份」"""
    years = list(range(first, YEAR + 1))
    values, hints, hints_en = {}, {}, {}
    for iso, by in sorted(data.items()):
        before = sum(n for y, n in by.items() if 0 < y < first)
        run, series = before, []
        for y in years:
            run += by.get(y, 0)
            series.append(run)
        if by.get(0):
            hints[iso] = f"另有 {by[0]:,} {unit}在 Wikidata 上沒有年份，沒算進來"
            hints_en[iso] = f"Plus {by[0]:,} with no year in Wikidata, not counted"
        if any(series):
            values[iso] = [v or None for v in series]
    write_json(path, indicator_file(name, unit, years, values, hints=hints, hintsEn=hints_en, license="CC0"))
    return years, values


def _write_count(path, name: str, unit: str, counts: Counter, **extra) -> None:
    write_json(path, indicator_file(name, unit, [YEAR], {c: [v] for c, v in sorted(counts.items())}, license="CC0", **extra))


def _per_million(path, name: str, counts: Counter) -> dict:
    pop = {c: s[2024] for c, s in wpp.demographic(["TPopulation1July"], last_year=2024)["TPopulation1July"].items() if s.get(2024)}
    per = {c: [round(v / (pop[c] * 1000) * 1e6, 2)] for c, v in sorted(counts.items()) if pop.get(c, 0) >= MIN_POP}
    nv = {c: "人口不到 100 萬，不畫" for c in counts if c in pop and pop[c] < MIN_POP}
    write_json(path, indicator_file(name, "人/百萬人", [YEAR], per, license="CC0", noValue=nv,
                                    noValueEn={c: "Population under 1 million, not shown" for c in nv}))
    return per


def _top(c: Counter, n: int = 16) -> str:
    return "、".join(f"{k} {v:,}" for k, v in c.most_common(n)) + f"；台灣 {c.get('TWN')}；共 {sum(c.values()):,}、{len(c)} 國"


def _studios(out) -> None:
    rows = qlever_wikidata.cached("anime-studios", """
SELECT ?s ?iso ?coord ?hq ?inc ?end ?en ?zhtw ?zhhant ?zh ?ja WHERE {
  ?s wdt:P31/wdt:P279* wd:Q1107679 .
  OPTIONAL { ?s wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?s wdt:P625 ?coord }
  OPTIONAL { ?s wdt:P159 ?h . ?h wdt:P625 ?hq }
  OPTIONAL { ?s wdt:P571 ?inc }
  OPTIONAL { ?s wdt:P576 ?end }
  OPTIONAL { ?s rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?s rdfs:label ?ja FILTER(LANG(?ja) = "ja") }
  OPTIONAL { ?s rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?s rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?s rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}""")
    items: dict[str, dict] = {}
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("s").rsplit("/", 1)[1]
        d = items.setdefault(q, {"iso": set(), "coord": None, "hq": None, "inc": None, "end": None, "en": v("en") or v("ja"),
                                 "zh": wikidata_zh(v("zhtw") or v("zhhant"), v("zh"), terms=False)})
        if v("iso"):
            d["iso"].add(v("iso"))
        for k in ("coord", "hq"):
            if v(k) and not d[k]:
                d[k] = v(k)
        for k in ("inc", "end"):
            m = re.match(r"(\d{4})", v(k) or "")
            if m and (d[k] is None or int(m.group(1)) < d[k]):
                d[k] = int(m.group(1))
    counts: Counter = Counter()
    points = []
    for q, d in items.items():
        if not d["en"] and not d["zh"]:
            continue
        if not d["end"]:
            for iso in d["iso"]:
                counts[iso] += 1
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", d["coord"] or d["hq"] or "", re.I)
        if m and d["iso"]:
            points.append({"lon": round(float(m.group(1)), 4), "lat": round(float(m.group(2)), 4), "k": 2 if d["end"] else 1,
                           "iso3": sorted(d["iso"])[0], "y": d["inc"], "end": d["end"], "en": d["en"] or q, "zh": d["zh"]})
    points.sort(key=lambda p: (p["k"], p["iso3"], p["en"]))
    write_points(out / "studios.json", points_file(points, ["lon", "lat", "k", "iso3", "y", "end", "en", "zh"],
                                                   {"lon": 0.0001, "lat": 0.0001, "k": 1, "y": 1, "end": 1}, strings=("iso3",)), ("en", "zh"))
    _write_count(out / "studios-count.json", "studios-count", "家", counts)
    print(f"  動畫工作室：{len(items)} 家（解散 {sum(1 for d in items.values() if d['end'])}）；點 {len(points)}；還在的 {_top(counts)}")


def anime() -> None:
    out = OUT_DIR / "topics" / "anime"
    _studios(out)
    films = _by_country_year("anime-films-by-year", "?w wdt:P31/wdt:P279* wd:Q202866 .", ("P577",))
    years, values = _write_cumulative(out / "films.json", "films", "部", films, 1900)
    tot = Counter({c: sum(by.values()) for c, by in films.items()})
    print(f"  動畫電影：{_top(tot)}；沒有年份 {sum(by.get(0, 0) for by in films.values()):,}")
    tv = _by_country("anime-tv", "?w wdt:P31 wd:Q63952888 .")
    _write_count(out / "tv-anime.json", "tv-anime", "部", tv)
    print(f"  電視動畫：{_top(tv)}")
    va = _by_country("voice-actors", "{ ?w wdt:P106 wd:Q2405480 } UNION { ?w wdt:P106 wd:Q622807 }", key="P27")
    _write_count(out / "voice-actors.json", "voice-actors", "人", va)
    per = _per_million(out / "voice-actors-per.json", "voice-actors-per", va)
    print(f"  聲優與配音員：{_top(va)}")
    print("    每百萬人：" + "、".join(f"{c} {v[0]}" for c, v in sorted(per.items(), key=lambda kv: -kv[1][0])[:12]))
    oscar = _by_country("oscar-animated", "?w wdt:P166 wd:Q106800 ; wdt:P31/wdt:P279* wd:Q11424 .")
    _write_count(out / "oscar.json", "oscar", "部", oscar)
    print(f"  奧斯卡最佳動畫長片（得獎片的原產國）：{_top(oscar)}")


def comics() -> None:
    out = OUT_DIR / "topics" / "comics"
    # 六成作品在 Wikidata 上沒有年份（日本的漫畫尤其多），時間軸會誤導，只畫總數
    works = _by_country_year("comics-by-year", "?w wdt:P31/wdt:P279* wd:Q1004 .", ("P577", "P580"))
    tot = Counter({c: sum(by.values()) for c, by in works.items()})
    _write_count(out / "works.json", "works", "部", tot)
    print(f"  漫畫作品：{_top(tot, 20)}；沒有年份 {sum(by.get(0, 0) for by in works.values()):,}")
    web = _by_country("webtoons-sub", "VALUES ?k { wd:Q7978994 wd:Q562214 wd:Q754669 wd:Q213369 } ?w wdt:P31/wdt:P279* ?k .")
    _write_count(out / "webtoons.json", "webtoons", "部", web)
    print(f"  網路漫畫（webtoon、manhwa、manhua、webcomic）：{_top(web)}")
    awards = Counter()
    by_award: dict[str, Counter] = {}
    for q, name in (("Q842614", "eisner"), ("Q1336528", "tezuka"), ("Q39174", "kodansha"), ("Q836736", "shogakukan")):
        a = _by_country(f"comic-award-{name}-p27", f"?w wdt:P166 wd:{q} .", key="P27")
        b = _by_country(f"comic-award-{name}-p495", f"?w wdt:P166 wd:{q} .", key="P495")
        c = a + b
        by_award[name] = c
        awards += c
        print(f"    {name}：{c.most_common(10)}")
    hints = {iso: "、".join(f"{lbl} {by_award[k][iso]}" for k, lbl in (("eisner", "艾斯納獎"), ("tezuka", "手塚治虫文化賞"),
                                                                       ("kodansha", "講談社漫畫賞"), ("shogakukan", "小學館漫畫賞"))
                           if by_award[k].get(iso)) for iso in awards}
    hints_en = {iso: ", ".join(f"{lbl} {by_award[k][iso]}" for k, lbl in (("eisner", "Eisner"), ("tezuka", "Tezuka Osamu Cultural Prize"),
                                                                          ("kodansha", "Kodansha Manga Award"), ("shogakukan", "Shogakukan Manga Award"))
                              if by_award[k].get(iso)) for iso in awards}
    _write_count(out / "awards.json", "awards", "次", awards, hints=hints, hintsEn=hints_en)
    print(f"  四個漫畫獎（得主的國籍或原產國）：{_top(awards)}")


def tv_series() -> None:
    out = OUT_DIR / "topics" / "tv-series"
    series = _by_country_year("tv-series-by-year", "?w wdt:P31 wd:Q5398426 .", ("P580", "P577"))
    _write_cumulative(out / "series.json", "series", "部", series, 1930)
    tot = Counter({c: sum(by.values()) for c, by in series.items()})
    since2000 = Counter({c: sum(n for y, n in by.items() if y >= 2000) for c, by in series.items()})
    print(f"  電視劇：{_top(tot, 24)}；沒有年份 {sum(by.get(0, 0) for by in series.values()):,}")
    print(f"    2000 年以後首播：{since2000.most_common(12)}；台灣 {since2000.get('TWN')}")
    # 分母只算有首播年份的（沒有年份的不知道是不是 2000 年以後）
    dated = Counter({c: sum(n for y, n in by.items() if y) for c, by in series.items()})
    share = {c: [round(since2000[c] / dated[c] * 100, 1)] for c in dated if dated[c] >= 50}
    write_json(out / "since-2000.json", indicator_file("since-2000", "%", [YEAR], dict(sorted(share.items())), license="CC0"))
    print("    2000 年以後首播的比例（有年份的至少 50 部）：" + "、".join(f"{c} {v[0]}" for c, v in sorted(share.items(), key=lambda kv: -kv[1][0])[:12])
          + " … " + "、".join(f"{c} {share[c][0]}" for c in ("USA", "GBR", "JPN", "KOR", "TUR", "TWN", "CHN") if c in share))


def creators() -> None:
    """網路創作者（2026-11-08，製作手冊第二十七批 658，候選 1442；步驟 creators，輸出 topics/online-video/）：YouTuber（P106 Q17125263）、
    實況主（P106 Q152859，排除也是電競選手 Q4379701 的）、VTuber（P31 Q55155641 或 Q139378318）；國家用國籍 P27，VTuber 沒有國籍的
    用原產國 P495 或國家 P17。Wikidata 的收錄偏差很大（台灣與印度差不多），只能當「被寫進維基的創作者」。"""
    out = OUT_DIR / "topics" / "online-video"
    rows = qlever_wikidata.cached("creators", """SELECT ?c ?iso (COUNT(DISTINCT ?w) AS ?n) WHERE {
  { ?w wdt:P106 wd:Q17125263 } UNION { ?w wdt:P106 wd:Q152859 FILTER NOT EXISTS { ?w wdt:P106 wd:Q4379701 } }
  UNION { ?w wdt:P31 wd:Q55155641 } UNION { ?w wdt:P31 wd:Q139378318 }
  { ?w wdt:P27 ?c } UNION { ?w wdt:P495 ?c FILTER NOT EXISTS { ?w wdt:P27 [] } } UNION { ?w wdt:P17 ?c FILTER NOT EXISTS { ?w wdt:P27 [] } FILTER NOT EXISTS { ?w wdt:P495 [] } }
  OPTIONAL { ?c wdt:P298 ?iso }
} GROUP BY ?c ?iso""")
    counts: Counter = Counter()
    for r in rows:
        iso = _iso(r)
        if iso:
            counts[iso] += int(r["n"]["value"])
    _write_count(out / "creators.json", "creators", "人", counts)
    per = _per_million(out / "creators-per.json", "creators-per", counts)
    print(f"  網路創作者：{_top(counts, 20)}")
    print("    每百萬人：" + "、".join(f"{c} {v[0]}" for c, v in sorted(per.items(), key=lambda kv: -kv[1][0])[:12]) + " … "
          + "、".join(f"{c} {per[c][0]}" for c in ("TWN", "JPN", "KOR", "USA", "IND") if c in per))
