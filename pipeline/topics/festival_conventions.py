"""節慶：動漫展、同人誌販售會、漫畫展與電玩展（2026-11-07，製作手冊第二十四批 436 的候選 1032；步驟 festival-conventions，
輸出 topics/festivals/）。

- 資料：Wikidata（CC0，經 QLever：sources/qlever_wikidata.py）P31（含子類別）是動漫展（anime convention Q548126）、
  同人誌販售會（dōjinshi fair Q4390543）、漫畫展（comic book convention Q3070220）、電玩展（gaming convention Q3070242）、
  同好大會（fan convention Q1129398，含 furry、恐怖片、科幻這類）的。東京電玩展、台北國際電玩展、Gamescom 這些大型電玩展
  在 Wikidata 只標成「年度活動」「商展」，用條目編號補進來（EXTRA，種類照它的性質）。
- 位置：條目自己的座標（P625），沒有的用舉辦地點（P276）的座標，再沒有用所在行政區（P131）的座標；台灣的開拓動漫祭、
  Comic World Taiwan、台北國際電玩展、台北國際動漫節在 Wikidata 都沒有地點，放在台北市（Q1867 的座標，點上標「位置是城市」）。
- 創辦年（P571）做時間軸（依創辦年累計）；參觀人次（P1132）幾乎都沒有，有的寫在 tooltip。國家用 P17，沒有的依座標判斷。
- Wikidata 的這幾類嚴重偏美國與歐洲，只畫點；國家的值是「到那一年創辦了幾個」，給 tooltip 與排名表，不上色。
- 2026-11-07 補（手冊 436 的補強）：英文維基（CC BY-SA 4.0，只引用事實；讀 /wiki/<條目>，robots.txt 禁止 /w/）
  - 舉辦月份：「List of anime and manga conventions」revid 1381313355 的表（Month held 欄；最後一張是停辦的，不用），
    依條目連結對到 Wikidata（QLever 的 sitelink）。漫畫展、電玩展、綜合同好大會三份清單是條列、沒有月份。
  - 人次：每個活動的英文條目 infobox 的 Attendance（第一個數字與括號裡的年份；寫「per day」「daily」的不算），
    Wikidata 的 P1132 多半是單一屆，有 infobox 的用 infobox。條目第一次抓間隔 1 秒，快取在 .cache/wikipedia/con-*.html。
"""
from __future__ import annotations

import hashlib
import html
import re
import time
import urllib.parse
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, points_file, write_json
from geoindex import countries_at
from sources import qlever_wikidata
from sources.countries import to_iso3
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "festivals"
FIRST, LAST = 1960, 2026
# 種類（src/topics/festivals.ts 的 CON_KINDS）：同時屬於好幾類的，依這個順序取第一個
ANIME, DOUJIN, COMIC, GAME, FAN = 1, 2, 3, 4, 5
CLASSES = {"Q4390543": DOUJIN, "Q548126": ANIME, "Q3070220": COMIC, "Q3070242": GAME, "Q1129398": FAN}
PRIORITY = [DOUJIN, ANIME, COMIC, GAME, FAN]
# Wikidata 沒有歸在上面幾類的大型活動（條目編號 → 種類）
EXTRA = {
    "Q683877": GAME,     # 東京電玩展
    "Q10914112": GAME,   # 台北國際電玩展
    "Q265567": GAME,     # Gamescom
    "Q5099651": GAME,    # ChinaJoy
    "Q25943": GAME,      # G-Star
    "Q3365263": GAME,    # Paris Games Week
    "Q4957794": GAME,    # Brasil Game Show
    "Q21006833": GAME,   # EGX
    "Q2523961": ANIME,   # Jump Festa
    "Q2584209": ANIME,   # Anime Expo
    "Q4765143": ANIME,   # Anime Festival Asia
    "Q5174671": ANIME,   # Cosplay Mania
    "Q16926536": ANIME,  # 台北國際動漫節
    "Q7723696": COMIC,   # New York Comic Con
    "Q279385": COMIC,    # San Diego Comic-Con（Wikidata 標成同好大會）
    "Q1070962": COMIC,   # Lucca Comics & Games
    "Q588487": GAME,     # PAX
}
# 單一屆的條目（「Eurofurence 13」「Furry Weekend Atlanta 2004」）：名稱最後是屆數或年份的不畫，只留整個活動
EDITION = re.compile(r"(\s(19|20)\d{2}|\s\d{1,3}|\((19|20)\d{2}\))$")
# 沒有地點的台灣活動：放在台北市
TAIPEI = "Q1867"
HAND_PLACE = {"Q15901741": TAIPEI, "Q105446484": TAIPEI, "Q10914112": TAIPEI, "Q16926536": TAIPEI}
QUERY = """SELECT ?item ?top ?coord ?lcoord ?acoord ?iso ?inc ?att ?attDate ?sl ?en ?mul ?zhtw ?zhhant ?zh WHERE {
  { VALUES ?top { %s } ?item wdt:P31/wdt:P279* ?top . }
  UNION
  { VALUES ?item { %s } BIND(wd:Q0 AS ?top) }
  ?item wikibase:sitelinks ?sl .
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P276 ?loc . ?loc wdt:P625 ?lcoord }
  OPTIONAL { ?item wdt:P131 ?adm . ?adm wdt:P625 ?acoord }
  OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?item wdt:P571 ?inc }
  OPTIONAL { ?item p:P1132 ?st . ?st ps:P1132 ?att . OPTIONAL { ?st pq:P585 ?attDate } }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}""" % (" ".join(f"wd:{q}" for q in CLASSES), " ".join(f"wd:{q}" for q in EXTRA))
PLACE_QUERY = "SELECT ?item ?coord WHERE { VALUES ?item { wd:%s } ?item wdt:P625 ?coord }"
ANIME_LIST = "https://en.wikipedia.org/wiki/List_of_anime_and_manga_conventions?oldid=1381313355"
ENWIKI_QUERY = """SELECT ?item ?article WHERE { VALUES ?item { %s }
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }"""
TITLE_QUERY = """SELECT ?item ?article WHERE { VALUES ?article { %s } ?article schema:about ?item }"""
MONTHS = {m: i + 1 for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august",
                                          "september", "october", "november", "december"])}


def _text(s: str) -> str:
    s = re.sub(r"<sup.*?</sup>", "", s, flags=re.S)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def _title(href: str) -> str | None:
    """Parsoid HTML 的連結（./Title 或 https://en.wikipedia.org/wiki/Title）→ 條目名稱"""
    m = re.match(r"(?:\./|https://en\.wikipedia\.org/wiki/|/wiki/)([^#?]+)", href)
    return urllib.parse.unquote(m.group(1)).replace("_", " ") if m else None


def _article_url(title: str) -> str:
    return "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"), safe="")


def _months() -> dict[str, int]:
    """動漫展清單：條目名稱 → 月份（「July/August」取第一個）"""
    page = download(ANIME_LIST, "wikipedia", "conventions-anime.html").read_text(encoding="utf-8")
    out: dict[str, int] = {}
    for table in re.findall(r'<table class="wikitable.*?</table>', page, re.S):
        rows = re.findall(r"<tr.*?</tr>", table, re.S)
        head = [_text(h) for h in re.findall(r"<th[^>]*>(.*?)</th>", rows[0], re.S)]
        if "Month held" not in head:
            continue  # 停辦的表
        col = head.index("Month held")
        for tr in rows[1:]:
            cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)
            if len(cells) <= col:
                continue
            link = re.search(r'<a[^>]*href="([^"]+)"', cells[0])
            title = _title(link.group(1)) if link and "class=\"new\"" not in cells[0] else None
            m = re.search(r"[A-Za-z]+", _text(cells[col]))
            if title and m and m.group(0).lower() in MONTHS:
                out[title] = MONTHS[m.group(0).lower()]
    return out


def _attendance(title: str) -> tuple[int, int | None] | None:
    """條目 infobox 的 Attendance：（人次, 年份）"""
    path = CACHE_DIR / "wikipedia" / f"con-{hashlib.sha1(title.encode()).hexdigest()[:12]}.html"
    if not path.exists():
        time.sleep(1)
    page = download(_article_url(title), "wikipedia", path.name).read_text(encoding="utf-8")
    box = re.search(r'<table class="infobox.*?</table>', page, re.S)
    if not box:
        return None
    m = re.search(r'<th[^>]*>\s*Attendance\s*</th>\s*<td[^>]*>(.*?)</td>', box.group(0), re.S)
    if not m:
        return None
    text = _text(m.group(1))
    if re.search(r"per day|daily|a day|/day", text, re.I):
        return None
    num = re.search(r"(\d{1,3}(?:,\d{3})+|\d{4,})", text)
    if not num:
        return None
    # 年份：數字後面的「(2018)」「in 2022」「in December 2021」；「on average」的（安古蘭）不寫年份
    year = None if re.search(r"average", text, re.I) else re.search(r"\b((?:19|20)\d{2})\b", text[num.end():num.end() + 25])
    return int(num.group(1).replace(",", "")), int(year.group(1)) if year else None


def _point(v: str | None) -> tuple[float, float] | None:
    if not v or not v.startswith("Point(") and not v.startswith("POINT("):
        return None
    lon, lat = v[6:-1].split()
    return float(lon), float(lat)


def build() -> None:
    rows = qlever_wikidata.cached("festival-conventions", QUERY)
    items: dict[str, dict] = {}
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("item").rsplit("/", 1)[1]
        d = items.setdefault(q, {"q": q, "kinds": set(), "sl": int(v("sl")), "att": {}})
        top = v("top").rsplit("/", 1)[1]
        d["kinds"].add(EXTRA.get(q) if top == "Q0" else CLASSES[top])
        for key, field in (("coord", "coord"), ("lcoord", "lcoord"), ("acoord", "acoord")):
            if field not in d and (p := _point(v(key))):
                d[field] = p
        if v("iso") and "iso" not in d:
            d["iso"] = v("iso")
        if v("inc"):
            y = int(v("inc")[:4].lstrip("+") or 0) if v("inc")[:4].lstrip("+-").isdigit() else None
            if y and (not d.get("y") or y < d["y"]):
                d["y"] = y
        if v("att"):
            year = int(v("attDate")[:4]) if v("attDate") and v("attDate")[:4].isdigit() else 0
            d["att"][year] = max(d["att"].get(year, 0), round(float(v("att"))))
        for k in ("en", "mul", "zhtw", "zhhant", "zh"):
            if v(k) and not d.get(k):
                d[k] = v(k)
    for q, kind in EXTRA.items():  # 也在上面幾類裡的（San Diego Comic-Con 是「同好大會」），種類照這裡
        if q in items:
            items[q]["kinds"].add(kind)
    place = {}
    for q in set(HAND_PLACE.values()):
        for r in qlever_wikidata.cached(f"place-{q}", PLACE_QUERY % q):
            place[q] = _point(r["coord"]["value"])
    names = qlever_wikidata.fallback_names(sorted(q for q, d in items.items() if not (d.get("en") or d.get("mul"))), "conventions")

    out, no_place, editions = [], [], 0
    for q, d in items.items():
        pt = d.get("coord") or d.get("lcoord") or d.get("acoord")
        hand = 0
        if not pt and q in HAND_PLACE:
            pt, hand = place[HAND_PLACE[q]], 1
        en = d.get("en") or d.get("mul") or names.get(q)
        zh = wikidata_zh(d.get("zhtw") or d.get("zhhant"), d.get("zh"), place=True)
        if en and EDITION.search(en.strip()):
            editions += 1
            continue
        if not pt:
            no_place.append((en or zh, d.get("iso")))
            continue
        kind = next(k for k in PRIORITY if k in d["kinds"])
        att_year = max(d["att"]) if d["att"] else None
        out.append({"lon": round(pt[0], 3), "lat": round(pt[1], 3), "k": kind, "y": d.get("y"), "sl": d["sl"],
                    "att": d["att"][att_year] if att_year is not None else None, "ay": att_year or None,
                    "iso3": to_iso3(d["iso"]) if d.get("iso") else None, "en": en, "zh": zh if zh and zh != en else None,
                    "x": hand, "q": q})
    for r, iso3 in zip(out, countries_at([r["lon"] for r in out], [r["lat"] for r in out])):
        r["iso3"] = r["iso3"] or iso3

    # 英文維基：舉辦月份（動漫展清單）與 infobox 的人次（as：1 = 英文維基 infobox、2 = Wikidata）
    articles = {}
    for row in qlever_wikidata.cached("festival-conventions-enwiki", ENWIKI_QUERY % " ".join(f"wd:{r['q']}" for r in out)):
        articles[row["item"]["value"].rsplit("/", 1)[1]] = urllib.parse.unquote(row["article"]["value"].rsplit("/wiki/", 1)[1]).replace("_", " ")
    months = _months()
    listed = qlever_wikidata.cached("festival-conventions-anime-list", TITLE_QUERY % " ".join(
        f"<{_article_url(t)}>" for t in sorted(months)))
    month_q = {row["item"]["value"].rsplit("/", 1)[1]: months[urllib.parse.unquote(row["article"]["value"].rsplit("/wiki/", 1)[1]).replace("_", " ")]
               for row in listed}
    for r in out:
        r["m"] = month_q.get(r["q"])
        r["as"] = 2 if r["att"] else None
        if r["q"] in articles and (a := _attendance(articles[r["q"]])):
            r["att"], r["ay"], r["as"] = a[0], a[1], 1
    out.sort(key=lambda r: r["sl"])
    fields = ["lon", "lat", "k", "y", "m", "sl", "att", "ay", "as", "x", "iso3", "en", "zh"]
    write_json(OUT / "conventions.json", points_file(out, fields, {"lon": 0.001, "lat": 0.001, "k": 1, "y": 1, "m": 1, "sl": 1,
                                                                  "att": 1, "ay": 1, "as": 1, "x": 1}, strings=("iso3",)))
    # 國家的值：到那一年創辦了幾個（創辦年不詳的算在每一年）
    years = list(range(FIRST, LAST + 1))
    by_country: dict[str, list[int | None]] = defaultdict(list)
    for r in out:
        if r["iso3"]:
            by_country[r["iso3"]].append(r["y"])
    values = {c: [sum(1 for y in ys if y is None or y <= yr) for yr in years] for c, ys in sorted(by_country.items())}
    write_json(OUT / "conventions-count.json", indicator_file("conventions", "個", years, values, license="CC0"))

    print(f"  動漫與電玩展：Wikidata {len(items)} 個、有位置 {len(out)}（自己的座標 {sum(1 for d in items.values() if 'coord' in d)}、"
          f"手放台北 {sum(r['x'] for r in out)}），沒有位置 {len(no_place)}、單一屆 {editions}")
    print(f"    種類：{Counter(r['k'] for r in out)}；國家：{Counter(r['iso3'] for r in out).most_common(12)}；台灣 "
          f"{[(r['zh'] or r['en'], r['k'], r['y']) for r in out if r['iso3'] == 'TWN']}")
    print(f"    有創辦年 {sum(1 for r in out if r['y'])}，最早 {sorted((r['y'], r['en']) for r in out if r['y'])[:6]}")
    print(f"    英文條目 {sum(1 for r in out if r['q'] in articles)}；動漫展清單的月份 {len(months)} 列、對到 {sum(1 for r in out if r['m'])}："
          f"{Counter(r['m'] for r in out if r['m'])}")
    print(f"    有人次 {sum(1 for r in out if r['att'])}（英文維基 {sum(1 for r in out if r['as'] == 1)}）："
          f"{sorted(((r['att'], r['en'], r['ay']) for r in out if r['att']), reverse=True)[:25]}")
    print(f"    最多語言：{[(r['zh'] or r['en'], r['sl'], r['k']) for r in sorted(out, key=lambda r: -r['sl'])[:15]]}")
