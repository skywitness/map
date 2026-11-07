"""菸酒的擴充：蒸餾廠、酒莊、威士忌蒸餾廠與清酒酒藏（2026-11-07，製作手冊第二十四批 429；步驟 alcohol-makers，
輸出 topics/tobacco-alcohol/）。

- OpenStreetMap 的 craft=distillery、craft=winery（經 QLever，sources/osm_qlever.py；ODbL 1.0）：跟啤酒廠（370）同一種做法，
  點全部畫（面與線取中心），各國每百萬人只替 OSM 覆蓋良好的國家上色。工業大廠、農家自釀、蒸餾酒的博物館混在一起；
  墨西哥、中國、印度明顯是沒人畫，不能當「哪一國最會做酒」。台灣的酒莊有的標 distillery、有的標 winery，兩個都畫。
- Wikidata（CC0，經 QLever，不用 query.wikidata.org）：威士忌蒸餾廠（Q10373548）與清酒酒藏（Q29850536）含子類別，
  有座標的畫點、附成立年份（P571）；有解散、停用日期（P576）的算已關閉。各國的威士忌蒸餾廠個數不含已關閉，依座標。
  清酒酒藏 Wikidata 只收了一百多個（日本實際有一千多家），只畫點、不做各國比較。
- 台灣：財政部國庫署「已取得菸酒製造或進口業許可執照業者家數統計」（data.gov.tw 25098）與「各年度國產及進口蒸餾酒類
  數量表」（25071），政府資料開放授權條款第 1 版；gaze.nta.gov.tw 從 cloud 連線被重設，由本機 session 下載到 map-plan 的
  data/nta/（README 有 SHA-256），重跑前複製到 .cache/nta/。只寫在台灣的說明。
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, points_file, write_json, write_manifest_part, write_points
from geoindex import countries_at
from sources import osm_coverage, osm_qlever, wpp
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "tobacco-alcohol"
YEAR = 2026
MIN_POPULATION = 100  # 千人
ENDPOINT = "https://qlever.dev/api/wikidata"
WHISKY, SAKE = "Q10373548", "Q29850536"
NTA = {"D6-24.csv": "936dc70b04f84a31c43754f92d84a4b1b3010cfffa031c70d83674245c295c4c",
       "D6-17.csv": "826f37df50ee991ab8bbda9dd0e4f3df9a837534f26e13e5bdf58207acc61306"}
QUERY = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?item ?root ?coord ?inc ?closed ?sl ?en ?mul ?ja ?zhtw ?zhhant ?zh WHERE {
  VALUES ?root { wd:Q10373548 wd:Q29850536 }
  ?item wdt:P31/wdt:P279* ?root ; wikibase:sitelinks ?sl .
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P571 ?inc }
  OPTIONAL { ?item wdt:P576 ?closed }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?item rdfs:label ?ja FILTER(LANG(?ja) = "ja") }
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}"""


def _wikidata() -> list[dict]:
    path = CACHE_DIR / "wikidata" / "whisky-sake.json"
    if not path.exists():
        req = urllib.request.Request(ENDPOINT, data=urllib.parse.urlencode({"query": QUERY}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(6):
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    data = r.read()
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, ConnectionError, TimeoutError) as err:
                wait = 60 * (attempt + 1)
                print(f"    QLever：{err}，等 {wait} 秒", flush=True)
                time.sleep(wait)
        else:
            raise RuntimeError("QLever 一直失敗，稍後再跑")
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def _nta(name: str) -> list[dict[str, str]]:
    path = CACHE_DIR / "nta" / name
    if not path.exists():
        raise RuntimeError(f"沒有 {path}：請把 map-plan 的 data/nta/{name} 複製到這裡")
    if hashlib.sha256(path.read_bytes()).hexdigest() != NTA[name]:
        raise RuntimeError(f"{path} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改 NTA")
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _taiwan() -> tuple[str, str]:
    """台灣的說明：有酒類製造執照的業者家數（最新一個月）與去年國產、進口的蒸餾酒"""
    rows = _nta("D6-24.csv")
    y, m = max((int(r["資料年"]), int(r["資料月"])) for r in rows)
    makers = sum(int(r["製造業酒類_家數"]) for r in rows if (int(r["資料年"]), int(r["資料月"])) == (y, m))
    spirits = _nta("D6-17.csv")
    full = max(int(r["資料年"]) for r in spirits if int(r["資料月"]) == 12)
    dom = sum(float(r["國產數量_公斤"]) for r in spirits if int(r["資料年"]) == full) / 1000
    imp = sum(float(r["進口數量_公斤"]) for r in spirits if int(r["資料年"]) == full) / 1000
    zh = (f"財政部國庫署：{y} 年 {m} 月有酒類製造執照的業者 {makers} 家；{full} 年國產蒸餾酒 {dom:,.0f} 公噸、"
          f"進口 {imp:,.0f} 公噸")
    en = (f"Taiwan’s National Treasury Administration: {makers} licensed alcohol makers in {y}-{m:02d}; in {full}, "
          f"{dom:,.0f} tonnes of spirits made domestically and {imp:,.0f} tonnes imported")
    return zh, en


def _per_million(n: Counter, pop: dict[str, float], what: str, what_en: str, extra_tw: tuple[str, str] | None):
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    values, hints, hints_en, no_value, no_value_en = {}, {}, {}, {}, {}
    for c in sorted(set(n) | covered):
        if c not in pop:
            continue
        hints[c] = f"OpenStreetMap 上有 {n.get(c, 0):,} 處{what}"
        hints_en[c] = f"{n.get(c, 0):,} {what_en} on OpenStreetMap"
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
        elif pop[c] < MIN_POPULATION:
            no_value[c] = "人口不到 10 萬，一兩家就差很多，不畫"
            no_value_en[c] = "Population under 100,000, too small for a stable rate, so not shown"
        else:
            values[c] = [round(n.get(c, 0) / pop[c] * 1000, 2)]
    if extra_tw:
        hints["TWN"] = f"{hints.get('TWN', '')}；{extra_tw[0]}"
        hints_en["TWN"] = f"{hints_en.get('TWN', '')}; {extra_tw[1]}"
    return values, {"hints": hints, "hintsEn": hints_en, "noValue": no_value, "noValueEn": no_value_en, "license": "ODbL 1.0"}


def build() -> None:
    # OSM 的蒸餾廠與酒莊
    rows, n_dist, n_wine = [], Counter(), Counter()
    for k, value, counter in ((1, "distillery", n_dist), (2, "winery", n_wine)):
        seen, drawn = set(), set()
        for r in osm_qlever.features("craft", value, extra=("name", "name:zh", "name:en")):
            if (r["osm"], r["iso3"]) in seen:
                continue
            seen.add((r["osm"], r["iso3"]))
            first = r["osm"] not in drawn  # 落在兩個重疊國界裡的，各國都算、點只畫一個
            drawn.add(r["osm"])
            counter[r["iso3"]] += 1
            c = osm_qlever.centroid(r["wkt"]) if first else None
            if c:
                rows.append({"lon": round(c[0], 4), "lat": round(c[1], 4), "k": k, "iso3": r["iso3"],
                             "n": r["name"] or None, "nz": r["name:zh"] or None, "ne": r["name:en"] or None})
    rows.sort(key=lambda p: (p["iso3"], p["k"], p["lon"]))
    data = points_file(rows, ["lon", "lat", "k", "iso3", "n", "nz", "ne"], {"lon": 0.0001, "lat": 0.0001, "k": 1}, strings=("iso3",))
    write_points(OUT / "distilleries-points.json", data, text=("n", "nz", "ne"))

    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items() if YEAR in s}
    tw = _taiwan()
    dist, extra = _per_million(n_dist, pop, "蒸餾廠", "distilleries", tw)
    write_json(OUT / "distilleries-per-million.json", indicator_file("distilleries-per-million", "處／百萬人", [YEAR], dist, **extra))
    wine, extra_w = _per_million(n_wine, pop, "酒莊", "wineries", None)
    write_json(OUT / "wineries-per-million.json", indicator_file("wineries-per-million", "處／百萬人", [YEAR], wine, **extra_w))

    # Wikidata 的威士忌蒸餾廠與清酒酒藏
    items: dict[str, dict] = {}
    for r in _wikidata():
        q = r["item"]["value"].rsplit("/", 1)[1]
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        d = items.setdefault(q, {"q": q, "roots": set(), "inc": set(), "closed": False, "sl": int(v("sl"))})
        d["roots"].add(v("root").rsplit("/", 1)[1])
        if "coord" not in d and (c := v("coord")) and c.upper().startswith("POINT("):
            lon, lat = c[6:-1].split()
            d["coord"] = (float(lon), float(lat))
        if (m := re.match(r"(\d{4})-", v("inc") or "")):
            d["inc"].add(int(m.group(1)))
        d["closed"] = d["closed"] or bool(v("closed"))
        for k in ("en", "mul", "ja", "zhtw", "zhhant", "zh"):
            if v(k) and not d.get(k):
                d[k] = v(k)
    wd = []
    for d in items.values():
        if "coord" not in d:
            continue
        zh = wikidata_zh(d.get("zhtw") or d.get("zhhant"), d.get("zh"))
        en = d.get("en") or d.get("mul") or d.get("ja")
        if not (en or zh):
            continue
        sake = SAKE in d["roots"] and WHISKY not in d["roots"]
        kind = 3 if d["closed"] else 2 if sake else 1
        wd.append({"lon": round(d["coord"][0], 4), "lat": round(d["coord"][1], 4), "k": kind,
                   "y": min(d["inc"]) if d["inc"] else None, "sl": d["sl"], "n": en, "nz": zh if zh != en else None, "id": d["q"]})
    for r, iso3 in zip(wd, countries_at([r["lon"] for r in wd], [r["lat"] for r in wd])):
        r["iso3"] = iso3
    wd.sort(key=lambda r: (-r["sl"], r["id"]))
    data = points_file(wd, ["lon", "lat", "k", "y", "sl", "iso3", "n", "nz", "id"],
                       {"lon": 0.0001, "lat": 0.0001, "k": 1, "y": 1, "sl": 1}, strings=("iso3",))
    write_points(OUT / "whisky-points.json", data, text=("n", "nz", "id"))
    whisky = Counter(r["iso3"] for r in wd if r["k"] == 1 and r["iso3"])
    closed = Counter(r["iso3"] for r in wd if r["k"] == 3 and r["iso3"])
    hints = {c: f"Wikidata 收錄的威士忌蒸餾廠 {whisky.get(c, 0)} 個" + (f"，另有已關閉的 {closed[c]} 個" if closed.get(c) else "")
             for c in set(whisky) | set(closed)}
    hints_en = {c: f"{whisky.get(c, 0)} whisky distilleries in Wikidata" + (f", plus {closed[c]} closed" if closed.get(c) else "")
                for c in set(whisky) | set(closed)}
    write_json(OUT / "whisky-distilleries.json", indicator_file(
        "whisky-distilleries", "個", [YEAR], {c: [v] for c, v in sorted(whisky.items())},
        hints=dict(sorted(hints.items())), hintsEn=dict(sorted(hints_en.items())), license="CC0"))
    write_manifest_part(OUT, "tobacco-alcohol", "alcohol-makers", {
        "sources": ["© OpenStreetMap contributors (ODbL 1.0), via QLever", "Wikidata (CC0), via QLever",
                    "財政部國庫署 data.gov.tw 25098、25071（政府資料開放授權條款第 1 版）"]})

    for name, n, values in (("蒸餾廠", n_dist, dist), ("酒莊", n_wine, wine)):
        top = sorted(((v[0], c) for c, v in values.items()), reverse=True)
        print(f"  OSM {name} {sum(n.values()):,} 處、{len(n)} 國；最多 {n.most_common(14)}；台灣 {n.get('TWN')}")
        print(f"    每百萬人（上色 {len(values)} 國）{top[:10]}；台灣 {values.get('TWN')}；美國 {values.get('USA')}；"
              f"英國 {values.get('GBR')}；日本 {values.get('JPN')}；法國 {values.get('FRA')}")
    print(f"  Wikidata：{len(items)} 個、畫 {len(wd)} 個（威士忌 {sum(1 for r in wd if r['k'] == 1)}、清酒 {sum(1 for r in wd if r['k'] == 2)}、"
          f"關閉 {sum(1 for r in wd if r['k'] == 3)}）；威士忌各國 {whisky.most_common(10)}；台灣 {whisky.get('TWN')}；"
          f"清酒 {Counter(r['iso3'] for r in wd if r['k'] == 2).most_common(4)}")
    print(f"    台灣 {[r['nz'] or r['n'] for r in wd if r['iso3'] == 'TWN']}；最早 {sorted((r['y'], r['n']) for r in wd if r['y'])[:5]}")
    print(f"  {tw[0]}")
