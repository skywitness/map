"""馬與賽馬場（新主題，2026-11-07，製作手冊第二十四批 427；步驟 horses，輸出 topics/horses/）。

- **馬匹頭數**：FAOSTAT QCL（農業主題下載的同一個檔，CC BY 4.0）的品項 1096 Horses、Element 5111 Stocks（頭），
  1961–2024。是農業普查的在養頭數，不分賽馬、役畜與馬奶馬肉用的馬，所以不是「馬術盛行度」。區域合計、「China」(351)
  與已解體的國家（蘇聯、南斯拉夫…）由 sources/faostat.py 排除，台灣是「China, Taiwan Province of」。
  **Flag X（外部機構提供）不用**：使用者 2026-11-05 對啤酒產量（385）決定 FAO 條款的第三方資料不畫，這裡同樣處理。
- **每千人幾匹馬**：頭數 ÷ 人口（人口主題的 WPP 2024）× 1,000。
- **賽馬場**：Wikidata（CC0）經 QLever，horse racing venue（Q11822917）與它的子類別（P31/P279*），含輕駕車賽場
  （harness racing venue Q53585538）與 hippodrome（Q184949，古代的競技場遺址與一些現代賽馬場都在這一類）。有座標的
  才畫點，國家依座標（沒有座標的依 P17）。有關閉日期（P576、P3999、P730）或使用狀態（P5817）是關閉、拆除、廢棄的
  算「已關閉」；古代的競技場遺址（ANCIENT，依名稱手列）也算。
  法國特別多是現實（France Galop、Le Trot 體系的地方賽馬場）加上法文維基收得齊的混合，各國個數反映 Wikidata 的收錄。
- **騎馬場**：OpenStreetMap 的 leisure=horse_riding（馬術中心、騎馬場；ODbL 1.0，© OpenStreetMap contributors）經 QLever，
  各國個數只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py 的共用名單），其他國家寫原因。
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, now_iso, points_file, to_series, write_json, write_points
from geoindex import countries_at
from sources import faostat, osm_coverage, osm_qlever
from sources.countries import to_iso3
from topics.profiles import _read_indicator
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "horses"
HORSES, STOCKS = 1096, 5111
YEAR = 2026  # 賽馬場與騎馬場的快照年份
ENDPOINT = "https://qlever.dev/api/wikidata"
VENUE, HARNESS = "Q11822917", "Q53585538"
FALLBACK_LANGS = ["fr", "de", "it", "es", "pt", "nl", "sv", "fi", "nb", "da", "pl", "cs", "hu", "ro", "tr", "ru", "ja", "ko"]
# 古代的競技場遺址（Wikidata 的 hippodrome Q184949 也含釜山、羅斯托夫這些營運中的現代賽馬場，不能整類當古代）：
# 名稱是古希臘羅馬或拜占庭城市的競技場——昔蘭尼、德爾斐、奧林匹亞、士麥那、貝魯特（Berytus）、君士坦丁堡（含
# 大皇宮的有頂競技場）、亞歷山卓（Lageion）、傑拉什（Gerasa）、馬格尼西亞、特拉佩蘇斯、安卡拉（Ankyra）、哈利卡那索斯
ANCIENT = {"Q104778279", "Q106484612", "Q19602775", "Q19613862", "Q28220436", "Q387548", "Q5179230", "Q55643136",
           "Q70772359", "Q78806201", "Q139424417", "Q139429560", "Q139436256"}
HAND_CLOSED = {"Q9202941"}  # 波蘭語標籤是「Dawny hipodrom w Krzeszowicach」（克舍舒維采從前的賽馬場），Wikidata 沒寫關閉日期
CLOSED_USE = {"Q11639308", "Q104664889", "Q63065035", "Q56556915"}  # 停用、永久關閉、廢棄、拆除或毀損
# 點的種類（src/topics/horses.ts 的 KINDS）
OPEN, HARNESS_KIND, CLOSED = 1, 2, 3
QUERY = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?item ?type ?coord ?iso ?open ?inc ?closed ?use ?sl ?en ?mul ?zhtw ?zhhant ?zh WHERE {
  ?item wdt:P31/wdt:P279* wd:Q11822917 ; wikibase:sitelinks ?sl .
  OPTIONAL { ?item wdt:P31 ?type }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?item wdt:P1619|wdt:P729 ?open }
  OPTIONAL { ?item wdt:P571 ?inc }
  OPTIONAL { ?item wdt:P576|wdt:P3999|wdt:P730 ?closed }
  OPTIONAL { ?item wdt:P5817 ?use }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}"""


def _fetch() -> list[dict]:
    return _post(QUERY, CACHE_DIR / "wikidata" / "horse-racing-venues.json")


def _post(query: str, path) -> list[dict]:
    if not path.exists():
        req = urllib.request.Request(ENDPOINT, data=urllib.parse.urlencode({"query": query}).encode(),
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


def _fallback_names(qids: list[str]) -> dict[str, str]:
    """沒有英文、中文標籤的（多半是法國的地方賽馬場）：依 FALLBACK_LANGS 取第一個有的語言的標籤（QLever，不用
    query.wikidata.org：它的 robots.txt 禁止 /sparql）"""
    if not qids:
        return {}
    query = ("PREFIX wd: <http://www.wikidata.org/entity/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n"
             f"SELECT ?item ?l WHERE {{ VALUES ?item {{ {' '.join('wd:' + q for q in sorted(qids))} }} ?item rdfs:label ?l }}")
    rank = {lang: i for i, lang in enumerate(FALLBACK_LANGS)}
    best: dict[str, tuple[int, str]] = {}
    for r in _post(query, CACHE_DIR / "wikidata" / f"horse-racing-labels-{len(qids)}.json"):
        q, lang = r["item"]["value"].rsplit("/", 1)[1], r["l"].get("xml:lang", "")
        k = rank.get(lang, len(rank))
        if q not in best or k < best[q][0]:
            best[q] = (k, r["l"]["value"])
    return {q: v for q, (_, v) in best.items()}


def _year(v: str | None) -> int | None:
    m = re.match(r"(-?\d{4})-", v or "")
    return int(m.group(1)) if m else None


def _horses() -> None:
    kept: dict[str, dict[int, float]] = defaultdict(dict)
    external: dict[str, set[int]] = defaultdict(set)
    flags: Counter = Counter()
    for r in faostat.rows("QCL", {STOCKS}, {HORSES}):
        flags[r.flag] += 1
        if r.flag == "X":
            external[r.area].add(r.year)
            continue
        kept[r.area][r.year] = r.value
    world = kept.pop("WLD", {})
    external.pop("WLD", None)
    years = list(range(min(y for s in kept.values() for y in s), max(y for s in kept.values() for y in s) + 1))
    last = years[-1]
    no_value = {c: "FAO 的數字來自外部機構，授權待確認，沒有用" for c, ys in external.items() if c not in kept or last in ys}
    no_value_en = {c: "FAO’s figure comes from an external organisation; licence unconfirmed, so not used" for c in no_value}
    # 比利時、奧地利、瑞典、西班牙等國 2017 年以後 FAOSTAT 就沒有數字：最近幾年的地圖是灰色，寫出最後一年
    for c, s in kept.items():
        end = max(s)
        if end < last and c not in no_value:
            no_value[c] = f"FAOSTAT 的數字到 {end} 年為止（{s[end]:,.0f} 匹）"
            no_value_en[c] = f"FAOSTAT figures end in {end} ({s[end]:,.0f} horses)"
    extra = {"noValue": dict(sorted(no_value.items())), "noValueEn": dict(sorted(no_value_en.items())), "license": "CC BY 4.0"}
    write_json(OUT / "horses.json", indicator_file(
        "horses", "匹", years, {c: to_series(s, years, 0) for c, s in sorted(kept.items())}, **extra))

    population = _read_indicator(OUT_DIR / "topics" / "population" / "total.json")
    pop_years = population["years"]
    per_k: dict[str, dict[int, float]] = {}
    for c, s in kept.items():
        pop = population["values"].get(c)
        if not pop:
            continue
        per_k[c] = {y: round(v / pop[pop_years.index(y)] * 1000, 3)
                    for y, v in s.items() if y in pop_years and pop[pop_years.index(y)]}
    write_json(OUT / "horses-per-1000.json", indicator_file(
        "horses-per-1000", "匹／千人", years, {c: to_series(s, years, 3) for c, s in sorted(per_k.items()) if s}, **extra))

    in_last = sorted(((s[last], c) for c, s in kept.items() if last in s), reverse=True)
    pk = sorted(((s[last], c) for c, s in per_k.items() if last in s), reverse=True)
    print(f"  馬匹 {years[0]}–{last}：旗標 {dict(flags)}；{last} 年 {len(in_last)} 國；世界 {world.get(last)}；"
          f"X 拿掉 {sorted(c for c, ys in external.items() if last in ys)}；數字比 {last} 年早結束 {len(no_value)} 國 "
          f"{sorted((max(s), c) for c, s in kept.items() if max(s) < last)}")
    print(f"    最多 {[(c, round(v / 1e4, 1)) for v, c in in_last[:10]]} 萬匹；台灣 {kept.get('TWN', {}).get(last)}"
          f"（1961 年 {kept.get('TWN', {}).get(1961)}）")
    print(f"    每千人最多 {[(c, round(v, 1)) for v, c in pk[:12]]}；台灣 {per_k.get('TWN', {}).get(last)}；"
          f"美國 {per_k.get('USA', {}).get(last)}；墨西哥 {per_k.get('MEX', {}).get(last)}；巴西 {per_k.get('BRA', {}).get(last)}")
    for c in ("MNG", "KAZ", "USA", "DEU", "GBR", "IRL", "AUS", "NZL", "ISL", "TWN", "JPN", "CHN"):
        s = kept.get(c, {})
        peak = max(s.items(), key=lambda kv: kv[1]) if s else None
        print(f"    {c}：1961 {s.get(1961)}、1992 {s.get(1992)}、{last} {s.get(last)}；最多 {peak}；每千人 {per_k.get(c, {}).get(last)}")


def _venues() -> None:
    items: dict[str, dict] = {}
    for r in _fetch():
        q = r["item"]["value"].rsplit("/", 1)[1]
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        d = items.setdefault(q, {"q": q, "types": set(), "open": set(), "inc": set(), "closed": False, "sl": int(v("sl")),
                                 "iso": None})
        if v("type"):
            d["types"].add(v("type").rsplit("/", 1)[1])
        if "coord" not in d and (c := v("coord")) and c.upper().startswith("POINT("):
            lon, lat = c[6:-1].split()
            d["coord"] = (float(lon), float(lat))
        for k in ("open", "inc"):
            if (y := _year(v(k))) is not None:
                d[k].add(y)
        if v("closed") or (v("use") and v("use").rsplit("/", 1)[1] in CLOSED_USE):
            d["closed"] = True
        d["iso"] = d["iso"] or v("iso")
        for k in ("en", "mul", "zhtw", "zhhant", "zh"):
            if v(k) and not d.get(k):
                d[k] = v(k)

    names = _fallback_names([q for q, d in items.items() if "coord" in d and not (d.get("en") or d.get("mul"))])
    rows = []
    for d in items.values():
        if "coord" not in d:
            continue
        zh = wikidata_zh(d.get("zhtw") or d.get("zhhant"), d.get("zh"), place=True)
        en = d.get("en") or d.get("mul") or names.get(d["q"])
        if not (en or zh):
            continue
        opened = min(d["open"]) if d["open"] else (min(d["inc"]) if d["inc"] else None)
        if opened is not None and not 1600 <= opened <= YEAR:
            opened = None  # 古代的競技場（君士坦丁堡的大競技場是 203 年）年份不畫
        closed = d["closed"] or d["q"] in ANCIENT or d["q"] in HAND_CLOSED
        kind = CLOSED if closed else HARNESS_KIND if HARNESS in d["types"] else OPEN
        rows.append({"lon": round(d["coord"][0], 4), "lat": round(d["coord"][1], 4), "k": kind, "y": opened, "sl": d["sl"],
                     "n": en, "nz": zh if zh and zh != en else None, "id": d["q"]})
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3
    rows.sort(key=lambda r: (-r["sl"], r["id"]))
    data = points_file(rows, ["lon", "lat", "k", "y", "sl", "iso3", "n", "nz", "id"],
                       {"lon": 0.0001, "lat": 0.0001, "k": 1, "y": 1, "sl": 1}, strings=("iso3",))
    write_points(OUT / "racecourses.json", data, text=("n", "nz", "id"))

    # 各國個數：有座標的依座標，沒有座標的依 P17（關閉的不算）
    by_country: Counter = Counter()
    closed_n: Counter = Counter()
    for r in rows:
        if r["iso3"]:
            (closed_n if r["k"] == CLOSED else by_country)[r["iso3"]] += 1
    no_coord = [d for d in items.values() if "coord" not in d]
    for d in no_coord:
        c = to_iso3(d["iso"])
        if c:
            (closed_n if d["closed"] or d["q"] in ANCIENT or d["q"] in HAND_CLOSED else by_country)[c] += 1
    hints = {c: f"Wikidata 收錄的賽馬場 {by_country.get(c, 0)} 個" + (f"，另有已關閉的 {closed_n[c]} 個" if closed_n.get(c) else "")
             for c in set(by_country) | set(closed_n)}
    hints_en = {c: f"{by_country.get(c, 0)} racecourses in Wikidata" + (f", plus {closed_n[c]} closed" if closed_n.get(c) else "")
                for c in set(by_country) | set(closed_n)}
    write_json(OUT / "racecourses-count.json", indicator_file(
        "racecourses-count", "個", [YEAR], {c: [n] for c, n in sorted(by_country.items())},
        hints=dict(sorted(hints.items())), hintsEn=dict(sorted(hints_en.items())), license="CC0",
        noValue={"TWN": "台灣沒有合法的賽馬，Wikidata 也沒有台灣的賽馬場"},
        noValueEn={"TWN": "Horse racing is not legal in Taiwan, and Wikidata lists no racecourse there"}))
    print(f"  賽馬場：{len(items)} 個、有座標 {len([d for d in items.values() if 'coord' in d])}，畫 {len(rows)} 個"
          f"（營運 {sum(1 for r in rows if r['k'] == OPEN)}、輕駕車 {sum(1 for r in rows if r['k'] == HARNESS_KIND)}、"
          f"關閉 {sum(1 for r in rows if r['k'] == CLOSED)}），沒有國家 {sum(1 for r in rows if not r['iso3'])}")
    print(f"    各國（不含關閉）{sum(by_country.values())} 個、{len(by_country)} 國：{by_country.most_common(16)}；台灣 {by_country.get('TWN')}")
    print(f"    關閉 {closed_n.most_common(8)}；連結最多 {[(r['n'], r['sl']) for r in rows[:8]]}")


def _riding() -> None:
    counts = osm_qlever.counts("leisure", "horse_riding")
    cov = osm_coverage.coverage()
    covered = osm_coverage.well_covered()
    no_value, no_value_en = {}, {}
    for c in counts:
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
    shown = {c: [n] for c, n in sorted(counts.items()) if c in covered}
    write_json(OUT / "riding-centres.json", indicator_file(
        "riding-centres", "處", [YEAR], shown, noValue=no_value, noValueEn=no_value_en, license="ODbL 1.0",
        hints={c: f"OpenStreetMap 上有 {n:,} 處（leisure=horse_riding）" for c, n in counts.items()},
        hintsEn={c: f"{n:,} on OpenStreetMap (leisure=horse_riding)" for c, n in counts.items()}))
    top = Counter(counts).most_common(12)
    shown_top = sorted(((v[0], c) for c, v in shown.items()), reverse=True)[:12]
    print(f"  騎馬場：{sum(counts.values())} 處、{len(counts)} 國；最多 {top}；台灣 {counts.get('TWN')}")
    print(f"    上色 {len(shown)} 國：{shown_top}")


def build() -> None:
    _horses()
    _venues()
    _riding()
    write_json(OUT / "manifest.json", {"topic": "horses", "generatedAt": now_iso(),
                                       "sources": ["FAOSTAT QCL (CC BY 4.0)", "Wikidata (CC0) via QLever",
                                                   "OpenStreetMap (ODbL 1.0) via QLever"]})
