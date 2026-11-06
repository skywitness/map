"""節慶（新主題，社會類，2026-10-29，製作手冊第五批 61）：Wikidata 的節慶點依月份篩選，台灣用文化資產局的民俗補。

使用者 2026-10-29 決定：主題改名「節慶」（「大型」排不出來）；Wikidata 的點加月份篩選；台灣用文化資產局的民俗補。

- Wikidata（CC0）：直接標成節慶（Q132241）或它的直接子類別（電影節、音樂節、藝術節、嘉年華、美食節…）、有座標的。
  月份用「每年發生的日子」（P837，例如「2 月 14 日」或「3 月」），英文標籤裡有月份名稱的取那個月；
  沒有的放「月份不詳」的圖層（不隨時間軸變，預設關閉）。種類依類別分成幾類上色（KINDS）。
- 台灣：文化部文化資產局「文資局民俗」（data.gov.tw 114143，政府資料開放授權條款第 1 版）的 272 項民俗，
  只收「儀式、祭典、節慶」類。地點只有縣市與鄉鎮市區，用 Wikidata 的鄉鎮市區座標（第一個地址）；
  只有縣市的用縣市裡各鄉鎮市區座標的平均。有舉辦月份（holdStartMonth）的依月份出現，農曆的月份加一個月當成大約的
  國曆月份（農曆正月約在國曆 2 月）。
- 時間軸是月份（1–12），只篩選有月份的點；Wikidata 很少寫舉辦的日子（約 1,760 個裡 40 個），月份不詳的圖層預設也畫。
  國家不上色，值是節慶總數（Wikidata 加文資局，含月份不詳的），給 tooltip 與排名表。
- 2026-10-31（第十二批 190，左邊「這個月的節慶」清單）：有月份的點多寫日期與地點：
  d 是有固定日子的那一天（排序用；文資局農曆的用農曆的日，跟月份一樣當成大約的國曆），dz、de 是中英文的日期
  （Wikidata 的「每年發生的日子」照原文翻，例如「7 月第三個星期六」；文資局的寫「農曆 7 月 15 日」），
  pz、pe 是中英文的城市（Wikidata 的所在行政區 P131；文資局的縣市與鄉鎮市區，英文只寫縣市）。
- 2026-11-04（製作手冊第二十一批 373）：加音樂節與萬人場館。
  音樂節（Q868557）不是節慶的直接子類別，原本查不到（種類 2 沒有用）；另查 P31 是音樂節或它的子類別（搖滾音樂節、
  爵士音樂節…，P279*）的，種類 2。同時是節慶的也算音樂節。
  萬人場館（arenas.json，預設關閉的點圖層）：P31 是 arena（Q641226）或它的子類別、容納人數（P1083）1 萬以上、有座標的；
  很多是體育館，說明寫明。台灣的台北小巨蛋（Q710183）、臺北大巨蛋（Q858333）在 Wikidata 不屬於 arena 類別，
  用條目編號補（TAIWAN_VENUES，容納人數照 Wikidata），點上標「補充」。
"""
from __future__ import annotations

import json
import re
import time
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, now_iso, points_file, write_json
from geoindex import countries_at
from sources import wikidata_attractions
from sources.countries import from_alpha2
from sources.wikidata_attractions import _sparql
from topics.house_prices import CITY_EN
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "festivals"
BOCH_URL = "https://data.boch.gov.tw/opendata/v2/assetsCase/5.1.json"
FESTIVAL = "Q132241"
MUSIC_FESTIVAL = "Q868557"
MUSIC = 2
ARENA = "Q641226"
ARENA_MIN = 10000
TAIWAN_VENUES = ("Q710183", "Q858333")  # 台北小巨蛋、臺北大巨蛋：Wikidata 沒有歸在 arena 類別
# Wikidata 的中文標籤是整個園區（臺北文化體育園區），用場館本身的名稱
ZH_NAMES = {"Q858333": "臺北大巨蛋"}
MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
          "november", "december"]
MONTHS_EN = [m.capitalize() for m in MONTHS]
ORDINAL_ZH = {"first": "第一個", "second": "第二個", "third": "第三個", "fourth": "第四個", "last": "最後一個"}
WEEKDAY_ZH = {"monday": "星期一", "tuesday": "星期二", "wednesday": "星期三", "thursday": "星期四", "friday": "星期五",
              "saturday": "星期六", "sunday": "星期日"}
COUNTY_EN = {**CITY_EN, "金門縣": "Kinmen County", "連江縣": "Lienchiang County", "台北市": "Taipei", "台中市": "Taichung",
             "台南市": "Tainan", "台東縣": "Taitung County"}
# 有月份的 Wikidata 節慶的所在行政區（P131）：清單的「城市」
PLACE_QUERY = """SELECT ?item ?en ?zhtw ?zhhant ?zh WHERE {{
  VALUES ?item {{ {items} }}
  ?item wdt:P131 ?p .
  OPTIONAL {{ ?p rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?p rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?p rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?p rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
}}"""
# 種類（前端 KINDS 的代碼）：1 傳統、宗教與民俗節慶、3 電影節、4 藝術節、5 嘉年華、6 美食與飲酒節、7 其他。
# 依類別的英文標籤裡的字分（節慶本身算 1）；音樂節不是節慶的直接子類別，查不到，2 沒有用
KIND_WORDS = [
    (3, ("film", "cinema", "movie")),
    (5, ("carnival",)),
    (6, ("food", "beer", "wine", "gastronom", "culinary", "cheese", "harvest")),
    (4, ("art", "literat", "theatre", "theater", "dance", "book", "poetry", "comic", "photograph", "biennale", "music")),
    (1, ("religious", "folk", "traditional", "pilgrimage", "cultural", "holiday", "celebration", "fair", "japanese",
         "patronal", "summer", "spring", "winter", "fire", "flower", "tulip", "palio", "feria")),
]
OTHER = 7


def kind_of(cls: str, label: str | None) -> int:
    if cls == FESTIVAL:
        return 1
    text = (label or "").lower()
    return next((k for k, words in KIND_WORDS if any(w in text for w in words)), OTHER)
# 直接標成節慶的與子類別的分兩次查（合在一起常逾時）
WHERE_DIRECT = "?item wdt:P31 wd:{festival} . BIND(wd:{festival} AS ?cls)"
WHERE_SUB = "?cls wdt:P279 wd:{festival} . ?item wdt:P31 ?cls ."
WHERE_MUSIC = "?cls wdt:P279* wd:{music} . ?item wdt:P31 ?cls ."
ARENA_QUERY = """SELECT ?item ?cap ?coord ?en ?mul ?zhtw ?zhhant ?zh ?cc WHERE {{
  {where}
  ?item wdt:P625 ?coord .
  OPTIONAL {{ ?item wdt:P17 ?c . ?c wdt:P297 ?cc }}
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
}}"""
QUERY = """SELECT ?item ?cls ?clsLabel ?coord ?whenLabel ?sl ?en ?mul ?zhtw ?zhhant ?zh ?cc WHERE {{
  {where}
  ?item wdt:P625 ?coord ; wikibase:sitelinks ?sl .
  OPTIONAL {{ ?cls rdfs:label ?clsLabel FILTER(LANG(?clsLabel) = "en") }}
  OPTIONAL {{ ?item wdt:P837 ?when . ?when rdfs:label ?whenLabel FILTER(LANG(?whenLabel) = "en") }}
  OPTIONAL {{ ?item wdt:P17 ?c . ?c wdt:P297 ?cc }}
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
}}"""
# 台灣的鄉鎮市區：名稱、座標、所屬的縣市（文資局的地址只有縣市與鄉鎮市區）
TOWN_QUERY = """SELECT ?item ?label ?coord ?county WHERE {
  ?item wdt:P17 wd:Q865 ; wdt:P625 ?coord ; wdt:P131 ?c .
  ?item rdfs:label ?label . FILTER(LANG(?label) = "zh-tw")
  FILTER(STRENDS(?label, "區") || STRENDS(?label, "鄉") || STRENDS(?label, "鎮") || STRENDS(?label, "市"))
  ?c rdfs:label ?county . FILTER(LANG(?county) = "zh-tw")
  FILTER(STRENDS(?county, "縣") || STRENDS(?county, "市"))
}"""


def _cached(name: str, query: str) -> list[dict]:
    path = CACHE_DIR / "wikidata" / f"{name}.json"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(_sparql(query)), encoding="utf-8")
        time.sleep(61)  # 查詢服務限流時每分鐘只接受一次
    return json.loads(path.read_text(encoding="utf-8"))


def _point(v: str | None) -> tuple[float, float] | None:
    if not v or not v.startswith("Point("):
        return None
    lon, lat = v[6:-1].split()
    return float(lon), float(lat)


def _month(label: str | None) -> int | None:
    if not label:
        return None
    words = re.findall(r"[a-z]+", label.lower())
    found = [MONTHS.index(w) + 1 for w in words if w in MONTHS]
    return found[0] if found else None


def wikidata_date(labels: set[str], month: int) -> tuple[int | None, str, str]:
    """Wikidata「每年發生的日子」→（固定的日或 None、中文、英文）；對不到格式的只寫月份"""
    lows = sorted(x.strip().lower() for x in labels)
    for low in lows:
        if (m := re.fullmatch(r"([a-z]+) (\d{1,2})", low)) and m[1] in MONTHS and MONTHS.index(m[1]) + 1 == month:
            day = int(m[2])
            return day, f"{month} 月 {day} 日", f"{MONTHS_EN[month - 1]} {day}"
    for low in lows:
        if (m := re.fullmatch(r"(first|second|third|fourth|last) ([a-z]+day) in ([a-z]+)", low)) and m[2] in WEEKDAY_ZH:
            return None, f"{month} 月{ORDINAL_ZH[m[1]]}{WEEKDAY_ZH[m[2]]}", f"{m[1].capitalize()} {m[2].capitalize()} in {MONTHS_EN[month - 1]}"
        if (m := re.fullmatch(r"first ([a-z]+day) after the (\d+)(?:st|nd|rd|th) of ([a-z]+)", low)) and m[1] in WEEKDAY_ZH:
            return (None, f"{month} 月 {m[2]} 日後的第一個{WEEKDAY_ZH[m[1]]}",
                    f"First {m[1].capitalize()} after {MONTHS_EN[month - 1]} {m[2]}")
    return None, f"{month} 月", MONTHS_EN[month - 1]


def _int(v) -> int | None:
    try:
        return int(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def boch_date(case: dict) -> tuple[int | None, str | None, str | None]:
    """文資局的舉辦日期 →（開始的日、中文、英文）；農曆照農曆寫"""
    sm, sd, em, ed = (_int(case.get(k)) for k in ("holdStartMonth", "holdStartDay", "holdEndMonth", "holdEndDay"))
    if not sm:
        return None, None, None
    lunar = case.get("holdCalendarType") == "農曆"
    pre_zh = "農曆 " if lunar else ""
    if not sd:
        return None, f"{pre_zh}{sm} 月", (f"Lunar month {sm}" if lunar else MONTHS_EN[sm - 1])
    same = not em or not ed or (em, ed) == (sm, sd)
    if lunar:
        zh = f"農曆 {sm} 月 {sd} 日" + ("" if same else f"–{ed} 日" if em == sm else f"–{em} 月 {ed} 日")
        en = f"Lunar {sm}/{sd}" + ("" if same else f"–{sm}/{ed}" if em == sm else f"–{em}/{ed}")
    else:
        zh = f"{sm} 月 {sd} 日" + ("" if same else f"–{ed} 日" if em == sm else f"–{em} 月 {ed} 日")
        en = f"{MONTHS_EN[sm - 1]} {sd}" + ("" if same else f"–{ed}" if em == sm else f" – {MONTHS_EN[em - 1]} {ed}")
    return sd, zh, en


def boch_place(addrs: list[dict]) -> tuple[str | None, str | None]:
    """文資局的地址 →（中文、英文）：一個鄉鎮市區寫縣市加鄉鎮市區，同一縣市的幾個寫縣市，幾個縣市寫前兩個加「等」"""
    cities = list(dict.fromkeys(a["cityName"] for a in addrs if a.get("cityName")))
    if not cities:
        return None, None
    if len(cities) == 1:
        dists = list(dict.fromkeys(a["distName"] for a in addrs if a.get("distName")))
        zh = cities[0] + (dists[0] if len(dists) == 1 else "")
    else:
        zh = "、".join(cities[:2]) + ("等" if len(cities) > 2 else "")
    en = ", ".join(COUNTY_EN.get(c, "") for c in cities[:2] if COUNTY_EN.get(c)) or None
    return zh, en


def taiwan_towns() -> dict[tuple[str, str], tuple[float, float]]:
    """(縣市, 鄉鎮市區) → (經度, 緯度)；縣市名稱的「臺」「台」都收"""
    out: dict[tuple[str, str], tuple[float, float]] = {}
    for r in _cached("taiwan-towns", TOWN_QUERY):
        p = _point(r["coord"]["value"])
        if p:
            county, town = r["county"]["value"], r["label"]["value"]
            for c in {county, county.replace("台", "臺"), county.replace("臺", "台")}:
                out.setdefault((c, town), p)
    return out


def boch() -> list[dict]:
    with open(download(BOCH_URL, "boch", "folklore-5.1.json"), encoding="utf-8-sig") as f:
        return json.load(f)


def build() -> None:
    items: dict[str, dict] = {}
    rows_direct = _cached("festivals-direct", QUERY.format(where=WHERE_DIRECT.format(festival=FESTIVAL)))
    rows_sub = _cached("festivals-subclasses", QUERY.format(where=WHERE_SUB.format(festival=FESTIVAL)))
    rows_music = _cached("festivals-music", QUERY.format(where=WHERE_MUSIC.format(music=MUSIC_FESTIVAL)))
    music_rows = {id(r) for r in rows_music}
    for r in rows_direct + rows_sub + rows_music:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("item").rsplit("/", 1)[1]
        d = items.setdefault(q, {"q": q, "kinds": set(), "months": set(), "cc": set(), "sl": int(v("sl"))})
        d["kinds"].add(MUSIC if id(r) in music_rows else kind_of(v("cls").rsplit("/", 1)[1], v("clsLabel")))
        if "coord" not in d and (p := _point(v("coord"))):
            d["coord"] = p
        if (m := _month(v("whenLabel"))) is not None:
            d["months"].add(m)
            d.setdefault("whens", set()).add(v("whenLabel"))
        if v("cc"):
            d["cc"].add(v("cc"))
        for k in ("en", "mul", "zhtw", "zhhant", "zh"):
            if v(k) and not d.get(k):
                d[k] = v(k)
    names = wikidata_attractions.fallback_names(sorted(q for q, d in items.items() if not (d.get("en") or d.get("mul"))))

    rows = []
    for d in items.values():
        if "coord" not in d:
            continue
        en = d.get("en") or d.get("mul") or names.get(d["q"])
        # 繁中的標籤原樣用（再轉一次 OpenCC 會把「里」轉成「裡」，zh_names.py）；節慶的名稱不是地名，不修正音譯的字
        zh = wikidata_zh(d.get("zhtw") or d.get("zhhant"), d.get("zh"))
        if not (en or zh):
            continue
        # 音樂節優先（同時標成節慶的也算音樂節），其次依 KIND_WORDS 的順序
        kind = MUSIC if MUSIC in d["kinds"] else min(k for k in d["kinds"] if k != OTHER) if d["kinds"] - {OTHER} else OTHER
        month = min(d["months"]) if d["months"] else None
        day, dz, de = wikidata_date(d.get("whens", set()), month) if month else (None, None, None)
        rows.append({"lon": round(d["coord"][0], 3), "lat": round(d["coord"][1], 3), "k": kind,
                     "m": month, "sl": d["sl"], "en": en, "zh": zh if zh and zh != en else None, "src": 1,
                     "q": d["q"], "d": day, "dz": dz, "de": de})
    # 有月份的：所在行政區（清單的城市）
    dated_q = sorted(r["q"] for r in rows if r["m"])
    places: dict[str, tuple[str | None, str | None]] = {}
    import hashlib
    key = hashlib.sha1(" ".join(dated_q).encode()).hexdigest()[:10]
    for r in _cached(f"festivals-places-{key}", PLACE_QUERY.format(items=" ".join(f"wd:{q}" for q in dated_q))):
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("item").rsplit("/", 1)[1]
        zh = wikidata_zh(v("zhtw") or v("zhhant"), v("zh"), place=True)
        old = places.get(q)
        if not old or (not old[0] and zh):
            places[q] = (zh, v("en"))
    for r in rows:
        r["pz"], r["pe"] = places.get(r.pop("q"), (None, None))

    # ── 台灣：文資局的民俗（儀式、祭典、節慶） ──
    towns = taiwan_towns()
    # 地址只有縣市的用縣市裡各鄉鎮市區座標的平均
    by_county: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for (county, _town), p in towns.items():
        by_county[county].append(p)
    county_center = {c: (sum(p[0] for p in ps) / len(ps), sum(p[1] for p in ps) / len(ps)) for c, ps in by_county.items()}
    missing_town = []
    tw = 0
    for case in boch():
        if not any(t.get("name") == "儀式、祭典、節慶" for t in case.get("assetsTypes", [])):
            continue
        addrs = case.get("addresses", [])
        addr = next((a for a in addrs if a.get("distName")), None)
        coord = towns.get((addr["cityName"], addr["distName"])) if addr else None
        if not coord and addrs and addrs[0].get("cityName"):
            coord = county_center.get(addrs[0]["cityName"])
        if not coord:
            missing_town.append((case["caseName"], [(a.get("cityName"), a.get("distName")) for a in addrs[:2]]))
            continue
        month = case.get("holdStartMonth")
        try:
            month = int(month) if month else None
        except ValueError:
            month = None
        if month and case.get("holdCalendarType") == "農曆":
            month = month % 12 + 1  # 農曆的月份大約晚國曆一個月
        day, dz, de = boch_date(case)
        pz, pe = boch_place(addrs)
        rows.append({"lon": round(coord[0], 3), "lat": round(coord[1], 3), "k": 1, "m": month, "sl": 0,
                     "en": None, "zh": case["caseName"], "src": 2,
                     "imp": 1 if case.get("assetsClassifyName") == "重要民俗" else 0,
                     "d": day if month else None, "dz": dz if month else None, "de": de if month else None, "pz": pz, "pe": pe})
        tw += 1

    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3
    dated = [r for r in rows if r["m"]]
    undated = [r for r in rows if not r["m"]]
    dated.sort(key=lambda r: (r["m"], r["sl"]))
    undated.sort(key=lambda r: r["sl"])
    fields = ["lon", "lat", "k", "m", "sl", "src", "imp", "iso3", "en", "zh", "d", "dz", "de", "pz", "pe"]
    scale = {"lon": 0.001, "lat": 0.001, "k": 1, "m": 1, "sl": 1, "src": 1, "imp": 1, "d": 1}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "festivals.json", points_file(dated, fields, scale, strings=("iso3", "pz", "pe")))
    write_json(OUT / "festivals-undated.json", points_file(undated, fields, scale, strings=("iso3", "pz", "pe")))
    # 國家的值：這個國家的節慶總數（含月份不詳的；時間軸是月份，每個月都寫同一個數，tooltip 與排名表用）
    months = list(range(1, 13))
    totals: dict[str, int] = defaultdict(int)
    for r in rows:
        if r["iso3"]:
            totals[r["iso3"]] += 1
    write_json(OUT / "count.json", indicator_file("count", "個", months, {k: [n] * 12 for k, n in sorted(totals.items())}))
    _arenas()
    write_json(OUT / "manifest.json", {"topic": "festivals", "generatedAt": now_iso(),
                                       "sources": ["Wikidata (CC0)", f"文化部文化資產局 文資局民俗 {BOCH_URL}（政府資料開放授權條款第 1 版）"]})
    from collections import Counter
    print(f"  節慶 {len(rows)} 個（Wikidata {len(rows) - tw}、文資局 {tw}）；有月份 {len(dated)}、不詳 {len(undated)}")
    print(f"  種類：{Counter(r['k'] for r in rows)}；月份：{Counter(r['m'] for r in dated)}")
    print(f"  文資局對不到鄉鎮的 {len(missing_town)}：{missing_town[:8]}")


def _arenas() -> None:
    """萬人場館：arena 類別、容納 1 萬人以上，加上台灣的補充"""
    main = _cached("festival-arenas", ARENA_QUERY.format(
        where=f"?item wdt:P31/wdt:P279* wd:{ARENA} ; wdt:P1083 ?cap . FILTER(?cap >= {ARENA_MIN})"))
    extra = _cached("festival-arenas-taiwan", ARENA_QUERY.format(
        where=f"VALUES ?item {{ {' '.join(f'wd:{q}' for q in TAIWAN_VENUES)} }} ?item wdt:P1083 ?cap ."))
    items: dict[str, dict] = {}
    for r in [{**r, "extra": {"value": "0"}} for r in main] + [{**r, "extra": {"value": "1"}} for r in extra]:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("item").rsplit("/", 1)[1]
        p = _point(v("coord"))
        if not p:
            continue
        d = items.setdefault(q, {"q": q, "cap": 0, "coord": p, "extra": int(v("extra"))})
        try:
            d["cap"] = max(d["cap"], int(float(v("cap"))))
        except (TypeError, ValueError):
            continue
        for k in ("en", "mul", "zhtw", "zhhant", "zh", "cc"):
            if v(k) and not d.get(k):
                d[k] = v(k)
    rows = []
    for d in items.values():
        if d["cap"] < ARENA_MIN or d["cap"] > 200000:  # 20 萬以上多半是填錯（例如賽車場的總人數）
            continue
        en = d.get("en") or d.get("mul")
        zh = wikidata_zh(d.get("zhtw") or d.get("zhhant"), d.get("zh"), place=True)
        if not (en or zh):
            continue
        zh = ZH_NAMES.get(d["q"], zh)
        rows.append({"lon": round(d["coord"][0], 4), "lat": round(d["coord"][1], 4), "cap": d["cap"], "x": d["extra"],
                     "iso3": from_alpha2(d.get("cc")) or "", "en": en, "zh": zh if zh and zh != en else None})
    missing = [r for r in rows if not r["iso3"]]
    for r, iso3 in zip(missing, countries_at([r["lon"] for r in missing], [r["lat"] for r in missing])):
        r["iso3"] = iso3 or ""
    rows.sort(key=lambda r: -r["cap"])
    write_json(OUT / "arenas.json", points_file(rows, ["lon", "lat", "cap", "x", "iso3", "en", "zh"],
                                                {"lon": 0.0001, "lat": 0.0001, "cap": 1, "x": 1}, strings=("iso3",)))
    from collections import Counter
    print(f"  萬人場館 {len(rows)} 個；{Counter(r['iso3'] for r in rows).most_common(10)}；"
          f"台灣 {[(r['zh'] or r['en'], r['cap'], r['x']) for r in rows if r['iso3'] == 'TWN']}")


if __name__ == "__main__":
    build()
