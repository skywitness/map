"""馬拉松、超馬與鐵人賽事地圖（2026-11-04，製作手冊第二十一批 362）。

- Wikidata（CC0，Wikidata Query Service；2026-11-04 QLever 的 Wikidata 鏡像一直 429，WDQS 反而通）：P31 是全馬（Q40244）、半馬（Q215677）、超馬（Q26303）、
  鐵人三項賽（Q43767888）的條目，國家（P17）、座標（P625，沒有的用所在地 P276 的座標）、創辦（P571）、系列（P179）、名稱。
- **年度條目併回母賽事**：「2023 Taipei Marathon」這類某一屆的條目，有 P179 系列的併到系列；沒有的把開頭的年份去掉、
  名稱相同的當同一場。創辦年只用 P571（母賽事或各屆最早的）；某一屆的年份不當創辦年（臺北馬拉松在 Wikidata 只有 2021 年
  以後的四屆，不是 2021 年創辦的）。
- 指標：各國有幾場（2026 年的快照）與依創辦年累積的場數（只算有 P571 的），後者跟著時間軸讓點依創辦年出現。
- 使用者 2026-11-04 決定只做 Wikidata 有的：Wikidata 只收了維基條目寫過的賽事（中國一年五百多場馬拉松只有個位數），
  這張圖是「維基寫過哪些賽事」，不是哪裡辦比賽，說明寫明。沒有座標也查不到國家的不畫。
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, points_file, write_json
from geoindex import countries_at
from sources.countries import to_iso3
from sources.wikidata import zh_name

OUT = OUT_DIR / "topics" / "road-races"
ENDPOINT = "https://query.wikidata.org/sparql"
YEAR = 2026
TYPES = {"Q40244": 1, "Q215677": 2, "Q26303": 3, "Q43767888": 4}  # 全馬、半馬、超馬、鐵人三項
QUERY = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?e ?type ?iso ?coord ?locCoord ?inception ?series ?en ?zh WHERE {
  VALUES ?type { wd:Q40244 wd:Q215677 wd:Q26303 wd:Q43767888 }
  ?e wdt:P31 ?type .
  OPTIONAL { ?e wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?e wdt:P625 ?coord }
  OPTIONAL { ?e wdt:P276 ?loc . ?loc wdt:P625 ?locCoord }
  OPTIONAL { ?e wdt:P571 ?inception }
  OPTIONAL { ?e wdt:P179 ?series }
  OPTIONAL { ?e rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?e rdfs:label ?zh FILTER(LANG(?zh) IN ("zh-tw", "zh-hant", "zh-hk", "zh")) }
}"""
COORD = re.compile(r"\(\s*(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s*\)")


def _fetch() -> list[dict]:
    path = CACHE_DIR / "wikidata" / "road-races.json"
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
                print(f"    Wikidata：{err}，等 {60 * (attempt + 1)} 秒", flush=True)
                time.sleep(60 * (attempt + 1))
        else:
            raise RuntimeError("Wikidata 一直失敗，稍後再跑")
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def _year(v: str | None) -> int | None:
    m = re.match(r"-?(\d{4})", v or "")
    return int(m.group(1)) if m else None


def _base_name(name: str) -> str:
    return re.sub(r"^\s*(\d{4})\s+", "", name).strip()


def build() -> None:
    rows = _fetch()
    items: dict[str, dict] = {}
    for r in rows:
        qid = r["e"]["value"].rsplit("/", 1)[-1]
        it = items.setdefault(qid, {"qid": qid, "types": set(), "iso": set(), "coord": None, "year": None, "series": None,
                                    "en": "", "zh": "", "zhl": {}})
        it["types"].add(TYPES[r["type"]["value"].rsplit("/", 1)[-1]])
        if "iso" in r and (iso3 := to_iso3(r["iso"]["value"])):
            it["iso"].add(iso3)
        for key in ("coord", "locCoord"):
            if key in r and not it["coord"] and (m := COORD.search(r[key]["value"])):
                it["coord"] = (float(m.group(1)), float(m.group(2)))
        y = _year(r.get("inception", {}).get("value"))
        if y and (not it["year"] or y < it["year"]):
            it["year"] = y
        if "series" in r:
            it["series"] = r["series"]["value"].rsplit("/", 1)[-1]
        it["en"] = it["en"] or r.get("en", {}).get("value", "")
        if "zh" in r:
            it["zhl"][r["zh"].get("xml:lang", "zh")] = r["zh"]["value"]
    for it in items.values():  # 中文名：zh-tw、zh-hant、zh-hk，最後才用 zh（轉成正體字）
        it["zh"] = zh_name(it["zhl"]) or ""
    # 年度條目併回母賽事：P179 系列或去掉開頭年份後的名稱
    groups: dict[str, list[dict]] = defaultdict(list)
    for it in items.values():
        key = it["series"] if it["series"] else f"name:{_base_name(it['en']) or it['qid']}"
        groups[key].append(it)
    events = []
    for key, its in groups.items():
        parent = items.get(key) if not key.startswith("name:") else None
        members = its + ([parent] if parent and parent not in its else [])
        coord = next((m["coord"] for m in members if m["coord"]), None)
        iso = next((sorted(m["iso"])[0] for m in members if m["iso"]), None)
        if not iso and coord:
            iso = countries_at([coord[0]], [coord[1]])[0]
        if not iso:
            continue
        years = [m["year"] for m in members if m["year"]]
        name_src = parent or min(its, key=lambda m: (bool(re.match(r"^\s*\d{4}\s", m["en"] or "")), len(m["en"] or "")))
        en = _base_name(name_src["en"]) or name_src["qid"]
        zh = re.sub(r"^\s*\d{4}\s*年?", "", name_src["zh"] or "").strip()
        kind = min(t for m in members for t in m["types"])
        events.append({"iso3": iso, "lon": coord[0] if coord else None, "lat": coord[1] if coord else None, "k": kind,
                       "y": min(years) if years else None, "en": en, "zh": zh, "q": name_src["qid"], "n": len(members)})
    count = Counter(e["iso3"] for e in events)
    write_json(OUT / "races.json", indicator_file(
        "races", "場", [YEAR], {c: [n] for c, n in sorted(count.items())},
        hints={c: "、".join(f"{v} 場{['', '全馬', '半馬', '超馬', '鐵人三項'][k]}" for k, v in sorted(Counter(e['k'] for e in events if e['iso3'] == c).items())) for c in count},
        hintsEn={c: ", ".join(f"{v} {['', 'marathons', 'half marathons', 'ultramarathons', 'triathlons'][k]}" for k, v in sorted(Counter(e['k'] for e in events if e['iso3'] == c).items())) for c in count}))
    founded = [e for e in events if e["y"]]
    fy = list(range(min(e["y"] for e in founded), YEAR + 1))
    by_country: dict[str, list[int]] = defaultdict(list)
    for e in founded:
        by_country[e["iso3"]].append(e["y"])
    write_json(OUT / "founded.json", indicator_file(
        "founded", "場", fy, {c: [sum(1 for y in ys if y <= year) or None for year in fy] for c, ys in sorted(by_country.items())}))
    pts = [e for e in events if e["lon"] is not None]
    listed = sorted(events, key=lambda e: (e["y"] or 9999, e["en"]))
    # 清單：沒有座標的也列（點了框住國家），座標用國家的範圍中心
    from topics.diplomacy_lists import country_boxes
    boxes = country_boxes()
    rows_out = []
    for e in listed:
        w, s, ea, n = boxes.get(e["iso3"], (0, 0, 0, 0))
        rows_out.append({**e, "lon": e["lon"] if e["lon"] is not None else round((w + ea) / 2, 2),
                         "lat": e["lat"] if e["lat"] is not None else round((s + n) / 2, 2), "pt": 1 if e["lon"] is not None else 0,
                         "bw": round(w, 2), "bs": round(s, 2), "be": round(ea, 2), "bn": round(n, 2)})
    write_json(OUT / "list.json", points_file(rows_out, ["lon", "lat", "pt", "k", "y", "iso3", "en", "zh", "q", "bw", "bs", "be", "bn"],
                                              {"lon": 0.001, "lat": 0.001, "pt": 1, "k": 1, "y": 1, "bw": 0.01, "bs": 0.01, "be": 0.01, "bn": 0.01},
                                              strings=("iso3",)))
    write_json(OUT / "points.json", points_file([r for r in rows_out if r["pt"]], ["lon", "lat", "k", "y", "iso3", "en", "zh"],
                                                {"lon": 0.001, "lat": 0.001, "k": 1, "y": 1}, strings=("iso3",)))
    write_json(OUT / "manifest.json", {"topic": "road-races", "source": "Wikidata (CC0)"})
    print(f"  賽事：Wikidata {len(items)} 筆，併成 {len(events)} 場、{len(count)} 國；有座標 {len(pts)}；有創辦年 {sum(1 for e in events if e['y'])}")
    print(f"  創辦年 {fy[0]}–{fy[-1]}；最早 {sorted((e['y'], e['en'], e['iso3']) for e in founded)[:8]}")
    print(f"  類別 {Counter(e['k'] for e in events)}；各國 {count.most_common(12)}；台灣 {[(e['en'], e['zh'], e['y'], e['n']) for e in events if e['iso3'] == 'TWN']}")
