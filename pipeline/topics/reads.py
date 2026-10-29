"""各國在讀什麼主題：Wikimedia 的差分隱私每日瀏覽量（country_project_page，CC0），每個國家每個月讀最多的維基百科條目。

**來源**：https://analytics.wikimedia.org/published/datasets/country_project_page/<日期>.tsv（2023-02-06 起每天一個，
約 18 MB、28 萬列，沒有表頭）：國家、國家代碼（ISO alpha-2）、project（例如 zh.wikipedia）、page_id、標題、
Wikidata QID、瀏覽次數。數字加了差分隱私的雜訊，低於門檻（多半是 90）的不公布。
授權：https://dumps.wikimedia.org/legal.html「All Analytics datasets are available under the Creative Commons Zero (CC0)」。

**彙整**（使用者決定：最近 24 個完整的月份、邊下載邊彙整、不留原檔）：一天一天串流讀，只留 *.wikipedia 的條目，
拿掉首頁（QID Q5296 與標題 Main_Page；這份資料本來就只有條目，沒有特殊頁），其他照原樣（使用者決定不過濾成人或
聳動的內容）。同一個月、同一國、同一個條目（project + page_id）的瀏覽次數相加；月底每國留前 TOP_KEEP 名，
存在 .cache/wikimedia/months/<月>.json（重跑不必再下載），也記下每國每個 project 的總瀏覽次數與缺的日子。

**名稱**：前 10 名的 QID 向 Wikidata 的 SPARQL 查詢服務（query.wikidata.org，一次 LABEL_BATCH 個，POST）查中文、英文名稱，
快取在 .cache/wikimedia/labels.json。wbgetentities 的 API 一次只能 50 個，而且這裡一直被限流（每批要等 Retry-After 十幾秒，
兩萬個要一個半小時），SPARQL 約 5 分鐘；限流時一樣照 Retry-After 等。中文依序取 zh-tw、zh-hant 的標籤、zhwiki 的條目名稱、zh 的標籤
（後兩者用 OpenCC s2tw 轉成繁體字），都沒有的中文維基百科條目把原文轉成繁體字；英文取 enwiki 的條目名稱或 en 的標籤。
地圖上的字用目前語言的名稱，沒有時用原文。

**輸出**（public/data/topics/reads/）：
- top.json：每國每個月第一名的點（國家最大的那塊陸地裡離邊界最遠的點，label_points()），地圖上寫條目名稱
  （z、e 是中文、英文名稱，跟原文一樣的寫 null）
- countries/<ISO3>.json：每個月的前 10 名（側欄用，點國家才下載）：articles 是這國出現過的條目 [原文標題, 語言, 中文名稱, 英文名稱]
  （名稱跟原文一樣的寫 null），months 是每個月的 [articles 的索引, 瀏覽次數]；同一個條目常常連續幾個月上榜，這樣小約 22%
- top-views.json：第一名的瀏覽次數（不上色，給 tooltip 與排名表）
- english.json：讀英文維基百科的比例（公布的瀏覽次數裡，en.wikipedia 占幾 %）
時間軸是月份：年份欄位存「2000 年 1 月起的第幾個月」（month_index），前端換成「2026 年 9 月」。

第一次約 35 分鐘（730 個檔、約 13 GB，加上約 5 分鐘查名稱）；之後只查還沒有的月份與名稱。
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, timedelta

import pycountry

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, now_iso, points_file, write_json

OUT = OUT_DIR / "topics" / "reads"
URL = "https://analytics.wikimedia.org/published/datasets/country_project_page/{day}.tsv"
SPARQL = "https://query.wikidata.org/sparql"
LABEL_BATCH = 400
CACHE = CACHE_DIR / "wikimedia"
MONTHS = 24
TOP_KEEP = 30
TOP = 10
MAIN_PAGE_QID = "Q5296"
MAIN_TITLES = {"Main_Page"}
# ISO alpha-2 → 地圖的代碼（pycountry 沒有的）
ALPHA2_FIX = {"XK": "XKX"}


def month_index(year: int, month: int) -> int:
    return (year - 2000) * 12 + (month - 1)


def months_to_build(today: date | None = None) -> list[tuple[int, int]]:
    """最近 MONTHS 個完整的月份（今天所在的月份不算）"""
    today = today or date.today()
    y, m = today.year, today.month
    out = []
    for _ in range(MONTHS):
        m -= 1
        if m == 0:
            y, m = y - 1, 12
        out.append((y, m))
    return sorted(out)


def alpha3(cc: str) -> str | None:
    if cc in ALPHA2_FIX:
        return ALPHA2_FIX[cc]
    c = pycountry.countries.get(alpha_2=cc)
    return c.alpha_3 if c else None


def fetch_day(day: date, acc: dict, totals: dict) -> bool:
    """串流讀一天的檔，加進這個月的累計；檔案不存在（資料缺的日子）回傳 False"""
    req = urllib.request.Request(URL.format(day=day.isoformat()), headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                for raw in resp:
                    parts = raw.decode("utf-8", "replace").rstrip("\n").split("\t")
                    if len(parts) < 7:
                        continue
                    _country, cc, project, page_id, title, qid, views = parts[:7]
                    if not project.endswith(".wikipedia"):
                        continue
                    qid = qid.strip('"')
                    if qid == MAIN_PAGE_QID or title in MAIN_TITLES:
                        continue
                    try:
                        v = int(views)
                    except ValueError:
                        continue
                    key = (cc, project, page_id)
                    e = acc.get(key)
                    if e is None:
                        acc[key] = [v, title, qid]
                    else:
                        e[0] += v
                        e[1], e[2] = title, qid or e[2]
                    totals[cc][project] += v
            return True
        except urllib.error.HTTPError as err:
            if err.code == 404:
                return False
            time.sleep(2 ** (attempt + 1))
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError(f"{day} 下載失敗")


def month_data(year: int, month: int) -> dict:
    path = CACHE / "months" / f"{year}-{month:02d}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    acc: dict = {}
    totals: dict = defaultdict(lambda: defaultdict(int))
    missing = []
    day = date(year, month, 1)
    t0 = time.time()
    while day.month == month:
        if not fetch_day(day, acc, totals):
            missing.append(day.isoformat())
        day += timedelta(days=1)
    by_country: dict[str, list] = defaultdict(list)
    for (cc, project, page_id), (v, title, qid) in acc.items():
        by_country[cc].append([title, project.split(".")[0], v, qid, page_id])
    top = {cc: sorted(rows, key=lambda r: -r[2])[:TOP_KEEP] for cc, rows in by_country.items()}
    data = {"top": top, "totals": {cc: dict(p) for cc, p in totals.items()}, "missing": missing}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"  {year}-{month:02d}：{len(acc):,} 個條目、{len(top)} 國，缺 {len(missing)} 天，{time.time() - t0:.0f} 秒")
    return data


def wikidata_labels(qids: set[str]) -> dict[str, list[str | None]]:
    """QID → [中文, 英文]；快取在 labels.json，只查還沒有的"""
    from opencc import OpenCC

    s2tw = OpenCC("s2tw")
    path = CACHE / "labels.json"
    cache: dict = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    todo = sorted(q for q in qids if q and q not in cache)
    print(f"  Wikidata 名稱：快取 {len(cache):,} 個，要查 {len(todo):,} 個")
    fields = ("zhtw", "zhhant", "zh", "en", "zhwiki", "enwiki")
    for i in range(0, len(todo), LABEL_BATCH):
        batch = todo[i : i + LABEL_BATCH]
        query = (
            "SELECT ?item ?zhtw ?zhhant ?zh ?en ?zhwiki ?enwiki WHERE { VALUES ?item { "
            + " ".join(f"wd:{q}" for q in batch)
            + ' } OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }'
            ' OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }'
            ' OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }'
            ' OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }'
            " OPTIONAL { ?a schema:about ?item; schema:isPartOf <https://zh.wikipedia.org/>; schema:name ?zhwiki }"
            " OPTIONAL { ?b schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?enwiki } }"
        )
        req = urllib.request.Request(
            SPARQL, data=urllib.parse.urlencode({"query": query}).encode(),
            headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"},
        )
        for attempt in range(8):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    rows = json.load(r)["results"]["bindings"]
                break
            except urllib.error.HTTPError as err:
                if err.code not in (429, 500, 502, 503, 504):
                    raise
                time.sleep(int(err.headers.get("Retry-After") or 10) + 1)
        else:
            raise RuntimeError("Wikidata 的 SPARQL 一直限流，稍後再跑")
        found: dict[str, dict[str, str]] = defaultdict(dict)
        for row in rows:
            q = row["item"]["value"].rsplit("/", 1)[-1]
            for k in fields:
                if k in row:
                    found[q].setdefault(k, row[k]["value"])
        for q in batch:
            f = found.get(q, {})
            zh = f.get("zhtw") or f.get("zhhant")
            if not zh and f.get("zhwiki"):
                zh = s2tw.convert(f["zhwiki"])
            if not zh and f.get("zh"):
                zh = s2tw.convert(f["zh"])
            cache[q] = [zh, f.get("enwiki") or f.get("en")]
        path.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        print(f"    {i + len(batch):,} / {len(todo):,}")
        time.sleep(1)
    return cache


def label_points() -> dict[str, tuple[float, float]]:
    """國家的標籤位置：最大的那塊陸地（1:50m，人口主題的 country_shapes()）裡離邊界最遠的點（shapely 的 polylabel）"""
    from shapely.geometry import Polygon
    from shapely.ops import polylabel

    from topics.population_grid import country_shapes

    out = {}
    for code, polygons in country_shapes().items():
        best = max((Polygon(p[0], p[1:]) for p in polygons), key=lambda g: g.area)
        if not best.is_valid:
            best = best.buffer(0)
        if best.geom_type != "Polygon":
            best = max(best.geoms, key=lambda g: g.area)
        pt = polylabel(best, tolerance=0.05)
        out[code] = (round(pt.x, 2), round(pt.y, 2))
    return out


def build() -> None:
    months = months_to_build()
    print(f"  月份：{months[0][0]}-{months[0][1]:02d} 到 {months[-1][0]}-{months[-1][1]:02d}")
    data = {(y, m): month_data(y, m) for y, m in months}

    # 每國每月的前 10 名（ISO3）
    per_country: dict[str, dict[int, list]] = defaultdict(dict)
    english: dict[str, dict[int, float]] = defaultdict(dict)
    qids: set[str] = set()
    for (y, m), d in data.items():
        mi = month_index(y, m)
        for cc, rows in d["top"].items():
            iso3 = alpha3(cc)
            if not iso3:
                continue
            per_country[iso3][mi] = rows[:TOP]
            qids |= {r[3] for r in rows[:TOP] if r[3]}
        for cc, totals in d["totals"].items():
            iso3 = alpha3(cc)
            total = sum(totals.values())
            if iso3 and total:
                english[iso3][mi] = round(totals.get("en.wikipedia", 0) / total * 100, 1)
    names = wikidata_labels(qids)
    from opencc import OpenCC

    s2tw = OpenCC("s2tw")

    def zh_en(r: list) -> list[str | None]:
        """[中文, 英文]：Wikidata 的名稱；中文維基百科的條目沒有中文名稱時，把原文轉成繁體字"""
        zh, en = names.get(r[3]) or [None, None]
        if not zh and r[1] == "zh":
            zh = s2tw.convert(r[0].replace("_", " "))
        return [zh, en]

    years = [month_index(y, m) for y, m in months]
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "countries").mkdir(exist_ok=True)
    points = []
    where = label_points()
    for iso3, by_month in sorted(per_country.items()):
        articles: list[list] = []
        index: dict[tuple[str, str], int] = {}
        rows_out = {}
        for mi, rows in sorted(by_month.items()):
            out = []
            for r in rows:
                title = r[0].replace("_", " ")
                if (title, r[1]) not in index:
                    index[(title, r[1])] = len(articles)
                    articles.append([title, r[1], *(None if n == title else n for n in zh_en(r))])
                out.append([index[(title, r[1])], r[2]])
            rows_out[str(mi)] = out
            first = rows[0]
            if iso3 in where:
                title = first[0].replace("_", " ")
                zh, en = (None if n == title else n for n in zh_en(first))
                lon, lat = where[iso3]
                points.append({
                    "lon": lon, "lat": lat, "m": mi, "c": iso3, "t": title, "l": first[1], "v": first[2], "z": zh, "e": en,
                })
        write_json(OUT / "countries" / f"{iso3}.json", {"articles": articles, "months": rows_out}, quiet=True)
    points.sort(key=lambda p: (p["m"], -p["v"]))
    write_json(OUT / "top.json", points_file(
        points, ["lon", "lat", "m", "c", "t", "l", "v", "z", "e"], {"lon": 0.01, "lat": 0.01, "m": 1, "v": 1}, ("m",), ("c", "l")))
    write_json(OUT / "top-views.json", indicator_file(
        "top-views", "次", years, {c: [by.get(mi, [[None, None, None]])[0][2] for mi in years] for c, by in per_country.items()}))
    write_json(OUT / "english.json", indicator_file(
        "english", "%", years, {c: [by.get(mi) for mi in years] for c, by in english.items()}))
    missing = sorted(d for (y, m), v in data.items() for d in v["missing"])
    write_json(OUT / "manifest.json", {
        "topic": "reads",
        "generatedAt": now_iso(),
        "source": "Wikimedia Foundation, differentially private daily pageviews per country (country_project_page), CC0",
        "months": [f"{y}-{m:02d}" for y, m in months],
        "missingDays": missing,
    })
    tw = per_country.get("TWN", {})
    for mi in years[-3:]:
        print(f"    TWN {mi}: {[(r[0], r[2]) for r in tw.get(mi, [])[:5]]}")
    print(f"  {len(per_country)} 國；缺的日子 {len(missing)} 天")


if __name__ == "__main__":
    build()
