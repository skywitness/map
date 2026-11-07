"""景點地圖的擴充：水上樂園的人次、台灣觀光遊憩據點的人次、OSM 的水上樂園（2026-11-07，製作手冊第二十四批 432；
步驟 attractions-visitors，輸出 topics/attractions/）。

- **水上樂園的人次**：英文維基「List of amusement park rankings」revid 1377863670 的 Water parks 一節（世界前 20、北美前 20、
  拉美 10、亞太 20、歐非中東 10，原始出處 TEA／AECOM 的 Theme Index，2009–2024，**2021、2022 年沒有發水上樂園排名**），
  CC BY-SA 4.0，只引用事實。讀 /wiki/<條目>?oldid= 的 HTML（robots.txt 禁止 /w/，不用 action=raw）；座標用 Wikidata（CC0，
  經 QLever，依英文維基條目的 sitelink 對到項目）。
- **台灣觀光遊憩據點**：交通部觀光署「歷年國內主要觀光遊憩據點遊客人數月別統計」（data.gov.tw 8116，政府資料開放授權條款
  第 1 版），2012–2024 年每月。2023 年起名稱寫在「細分」、「觀光遊憩區」是「-」；2012–2022 年「細分」是子區、沒有子區時
  是「-」，名稱用「觀光遊憩區」。**2024 年的類型欄錯置**（239 個據點跟往年不同、各類型的處數卻一模一樣），類型用每個據點
  2024 年以前最後一年的類型；2024 年改名的跟 2023 年的舊名配對（互相包含或相似度 0.6 以上），2024 年才列入的類型不詳。
  座標：先用觀光署「景點 - 觀光資訊資料庫」（data.gov.tw 7777，Attraction-json.zip，政府資料開放授權條款第 1 版）同縣市
  名稱完全相同的，再用 Wikidata 台灣的項目（經 QLever）名稱完全相同的，最後用觀光資訊資料庫同縣市名稱包含的（「安平」→
  「安平古堡」）。都找不到的不畫，數量印出來、寫在 DESIGN.md。
- **OSM 的水上樂園**：leisure=water_park 的各國個數（經 QLever，ODbL），只替覆蓋良好的國家上色，每十萬人。
"""
from __future__ import annotations

import csv
import html
import json
import re
import zipfile
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, points_file, write_json, write_manifest_part, write_points
from sources import osm_coverage, osm_qlever
from sources.countries import from_name
from topics.profiles import _read_indicator
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "attractions"
YEAR = 2026
PARKS = "https://en.wikipedia.org/wiki/List_of_amusement_park_rankings?oldid=1377863670"
TW_CSV = "https://media.taiwan.net.tw/od/01_PRD/%E6%AD%B7%E5%B9%B4%E5%9C%8B%E5%85%A7%E4%B8%BB%E8%A6%81%E8%A7%80%E5%85%89%E9%81%8A%E6%86%A9%E6%93%9A%E9%BB%9E%E9%81%8A%E5%AE%A2%E4%BA%BA%E6%95%B8%E6%9C%88%E5%88%A5%E7%B5%B1%E8%A8%88.csv"
TW_ATTRACTIONS = "https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/Attraction-json.zip"
QLEVER = "https://qlever.dev/api/wikidata"
WATER_YEARS = list(range(2009, 2025))
TW_YEARS = list(range(2012, 2025))
# 台灣據點的類型（src/topics/attractions-visitors.ts 的 SITE_TYPES）
TYPES = {"國家公園": 1, "國家級風景特定區": 2, "直轄市及縣(市)級風景特定區": 3, "森林遊樂區": 4, "博物館": 5, "宗教場所": 6,
         "觀光地區": 7, "休閒農業區及休閒農場": 8, "其他": 9}
TYPE_ALIASES = {"直轄市及縣（市）級風景特定區": "直轄市及縣(市)級風景特定區", "縣(市)級風景特定區": "直轄市及縣(市)級風景特定區"}
# 名稱對不上的大據點：手工對到觀光資訊資料庫（db）或 Wikidata（wd）裡確實有的名稱（2026-11-07 逐一查過），取它的座標當代表點
SITE_ALIASES = {
    "老街溪沿岸步道": ("db", "中壢老街溪步道、新街溪步道"), "林口三井Outlet": ("wd", "MITSUI OUTLET PARK 林口"),
    "大溪老城區": ("db", "大溪老街"), "南紡購物中心": ("wd", "南紡夢時代購物中心"), "八卦山風景區(彰化地區)": ("db", "八卦山大佛風景區"),
    "麗寶樂園渡假村": ("db", "麗寶樂園渡假區"), "瑞豐商圈": ("wd", "瑞豐夜市"), "帝國糖廠及LaLaport觀光廊帶": ("db", "帝國製糖廠臺中營業所"),
    "藍晒圖文創圈區": ("db", "藍晒圖文創園區"), "大坑登山步道": ("db", "大坑1號登山步道"), "日月潭環潭區": ("wd", "日月潭"),
    "臺北市立動物園TaipeiZoo": ("wd", "臺北市立動物園"), "北門鹽業遊憩區": ("db", "北門潟湖"), "都蘭遊憩區及周邊地區": ("db", "都蘭"),
    "獅頭山風景區(苗栗地區)": ("db", "獅頭山勸化堂"), "卑南初鹿地區": ("db", "初鹿牧場"), "大溪月眉休閒農業區": ("db", "大溪月眉至龍潭三坑水岸觀光綠廊"),
    "勝利星村創意生活園區": ("db", "勝利星村V.I.PZone"), "大里外澳遊憩區": ("db", "外澳海灘"), "鹿野高臺及周邊地區": ("db", "鹿野高台"),
    "東大門國際觀光夜市": ("db", "東大門夜市"), "小琉球遊憩區": ("wd", "小琉球碧雲寺"), "鹽水老街": ("db", "鹽水橋南老街"),
    "鹽寮福隆遊憩區": ("db", "福隆海水浴場"), "舞鶴台地": ("db", "舞鶴觀光茶園"), "淡水紅毛城": ("wd", "紅毛城"),
}
# 水上樂園名稱跟 OSM 寫法不同的（2026-11-07 查過 OSM 上確實有這個名稱的 leisure=water_park）
WATER_ALIASES = {"Therme Bucharest": "Therme București", "Wet'n'Wild Gold Coast": "Wet 'n' Wild Gold Coast",
                 "Magic City Water Park": "Parque Aquatico e Pousada Magic City"}
COUNTRY_FIX = {"UAE": "ARE", "United Arab Emirates": "ARE", "US": "USA", "U.S.": "USA"}


def _qlever(query: str, name: str) -> list[dict]:
    import time
    import urllib.error
    import urllib.parse
    import urllib.request

    from common import USER_AGENT

    path = CACHE_DIR / "wikidata" / f"{name}.json"
    if not path.exists():
        req = urllib.request.Request(QLEVER, data=urllib.parse.urlencode({"query": query}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(6):
            try:
                with urllib.request.urlopen(req, timeout=600) as r:
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


def _cell(s: str) -> str:
    s = re.sub(r"<sup.*?</sup>", "", s, flags=re.S)
    s = re.sub(r'<span[^>]*display:none[^>]*>.*?</span>', "", s, flags=re.S)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def _number(s: str) -> int | None:
    m = re.findall(r"\d[\d,]*", s)
    return int(m[-1].replace(",", "")) if m and m[-1].replace(",", "").isdigit() and len(m[-1]) >= 5 else None


def water_parks() -> list[dict]:
    page = download(PARKS, "wikipedia", "parks-html-1377863670.html").read_text(encoding="utf-8")
    sec = page[page.find('id="Water_parks"'):page.find('id="Other_rankings"')]
    parks: dict[str, dict] = {}
    for table in re.findall(r"<table.*?</table>", sec, re.S):
        rows = re.findall(r"<tr.*?</tr>", table, re.S)
        head = [_cell(h) for h in re.findall(r"<th[^>]*>(.*?)</th>", rows[0], re.S)]
        years = [int(m.group(1)) if (m := re.match(r"(\d{4})", h)) else None for h in head]
        for tr in rows[1:]:
            cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)
            if len(cells) != len(head):
                continue
            # Parsoid 的連結是 https://en.wikipedia.org/wiki/<條目> 或 ./<條目>；紅色連結（class="new"，條目不存在）不算
            link = re.search(r'href="(?:https://en\.wikipedia\.org/wiki/|\./)([^"?#]+)"(?![^>]*class="new")', cells[1])
            name = _cell(cells[1])
            loc = _cell(cells[2])
            key = link.group(1) if link else name
            p = parks.setdefault(key, {"title": link.group(1) if link else None, "en": name, "loc": loc, "v": {}})
            for y, c in zip(years, cells):
                if y and (n := _number(_cell(c))):
                    p["v"].setdefault(y, n)
    titles = [p["title"] for p in parks.values() if p["title"]]
    values = " ".join(f"<https://en.wikipedia.org/wiki/{t}>" for t in titles)
    rows = _qlever("""PREFIX schema: <http://schema.org/> PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?a ?coord ?zhtw ?zhhant ?zh WHERE { VALUES ?a { %s } ?a schema:about ?item . ?item wdt:P625 ?coord .
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") } OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") } }""" % values, f"water-parks-{len(titles)}")
    found = {}
    # 沒有條目（紅色連結）或 sitelink 對不到的：用英文標籤找有座標的項目
    labels = sorted({p["en"] for p in parks.values()})
    label_rows = _qlever("""PREFIX wdt: <http://www.wikidata.org/prop/direct/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?en ?coord ?zhtw ?zhhant ?zh WHERE { VALUES ?en { %s } ?item rdfs:label ?en ; wdt:P625 ?coord .
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") } OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") } }""" % " ".join(json.dumps(x) + "@en" for x in labels), f"water-park-labels-{len(labels)}")
    by_label = {}
    for r in label_rows:
        m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", r["coord"]["value"], re.I)
        if m and r["en"]["value"] not in by_label:
            by_label[r["en"]["value"]] = (float(m.group(1)), float(m.group(2)), wikidata_zh((r.get("zhtw") or r.get("zhhant") or {}).get("value"), r.get("zh", {}).get("value")))
    for r in rows:
        t = r["a"]["value"].rsplit("/wiki/", 1)[1]
        m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", r["coord"]["value"], re.I)
        if m and t not in found:
            found[t] = (float(m.group(1)), float(m.group(2)), wikidata_zh((r.get("zhtw") or r.get("zhhant") or {}).get("value"), r.get("zh", {}).get("value")))
    # 再對不到的：同一國的 OSM leisure=water_park，名稱（不分大小寫）相同或互相包含
    osm: dict[str, list] = defaultdict(list)
    for r in osm_qlever.features("leisure", "water_park", ("name", "name:en")):
        c = osm_qlever.centroid(r["wkt"])
        for n in {r["name"], r["name:en"]} - {""}:
            if c:
                osm[r["iso3"]].append((n.lower(), c))

    def osm_hit(name: str, iso3: str):
        key = WATER_ALIASES.get(name, re.sub(r"\s+at .*$", "", name)).lower()
        exact = [c for n, c in osm.get(iso3, []) if n == key]
        part = [c for n, c in osm.get(iso3, []) if len(n) >= 6 and (key in n or n in key)]
        c = (exact or part or [None])[0]
        return (c[0], c[1], None) if c else None

    out, missing = [], []
    for p in parks.values():
        country = p["loc"].split(",")[-1].strip()
        iso3 = COUNTRY_FIX.get(country) or from_name(country)
        hit = found.get(p["title"] or "") or by_label.get(p["en"]) or (osm_hit(p["en"], iso3) if iso3 else None)
        if not hit or not iso3:
            missing.append((p["en"], p["loc"], bool(hit), iso3))
            continue
        rec = {"lon": round(hit[0], 4), "lat": round(hit[1], 4), "iso3": iso3, "en": p["en"], "zh": hit[2] if hit[2] != p["en"] else None, "src": 1}
        for y in WATER_YEARS:
            rec[f"v{y}"] = p["v"].get(y)
        out.append(rec)
    if missing:
        print(f"  水上樂園沒有座標或國家的：{missing}")
    return out


def _tw_rows() -> list[dict]:
    with open(download(TW_CSV, "taiwan-net", "visitors-by-site.csv"), encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _site_name(r: dict) -> str:
    sub = re.sub(r"\s+", "", r["細分"] or "")
    return sub if sub and sub != "-" else re.sub(r"\s+", "", r["觀光遊憩區"] or "")


def _locate_sites(names: dict[str, str]) -> dict[str, tuple[float, float, str]]:
    """據點名稱（與縣市）→ (經度, 緯度, 怎麼找到的)"""
    z = zipfile.ZipFile(download(TW_ATTRACTIONS, "taiwan-net", "attraction/Attraction-json.zip"))
    atts = json.loads(z.read("AttractionList.json").decode("utf-8-sig"))["Attractions"]
    by_name: dict[str, list] = defaultdict(list)
    for a in atts:
        if a.get("PositionLat") and a.get("PositionLon"):
            city = (a.get("PostalAddress") or {}).get("City", "").replace("台", "臺")
            for n in [a["AttractionName"]] + (a.get("AlternateNames") or []):
                by_name[re.sub(r"\s+", "", n)].append((float(a["PositionLon"]), float(a["PositionLat"]), city))
    wd: dict[str, list] = defaultdict(list)
    for r in _qlever("""PREFIX wd: <http://www.wikidata.org/entity/> PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX wikibase: <http://wikiba.se/ontology#>
SELECT ?label ?coord ?sl WHERE { ?item wdt:P17 wd:Q865 ; wdt:P625 ?coord ; rdfs:label ?label ; wikibase:sitelinks ?sl .
  FILTER(LANG(?label) = "zh" || LANG(?label) = "zh-tw" || LANG(?label) = "zh-hant") }""", "taiwan-items-coords"):
        m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", r["coord"]["value"], re.I)
        if m:
            wd[r["label"]["value"]].append((float(m.group(1)), float(m.group(2)), int(r["sl"]["value"])))

    def variants(n: str) -> list[str]:
        v = [n]
        for suf in ("及周邊地區", "周邊地區", "遊客中心園區", "遊客中心", "風景特定區", "風景區", "遊憩區", "地區", "園區"):
            v.append(re.sub(suf + "$", "", n))
        v.append(re.sub(r"[（(].*?[)）]?$", "", n))
        return [x for i, x in enumerate(v) if len(x) >= 2 and x not in v[:i]]

    out = {}
    keys = list(by_name)
    for n, city in names.items():
        city = city.replace("台", "臺")
        hit = None
        if n in SITE_ALIASES:
            src, target = SITE_ALIASES[n]
            pool = by_name.get(target) if src == "db" else wd.get(target)
            if not pool:
                raise RuntimeError(f"台灣據點：{n} 的別名 {target!r} 在{'觀光資訊資料庫' if src == 'db' else 'Wikidata'}裡找不到")
            c = max(pool, key=lambda t: t[2]) if src == "wd" else pool[0]
            out[n] = (c[0], c[1], f"手工對照（{target}）")
            continue
        for v in variants(n):  # 1. 觀光資訊資料庫，同縣市、名稱相同
            c = [a for a in by_name.get(v, []) if a[2] == city]
            if c:
                hit = (c[0][0], c[0][1], "觀光資訊資料庫"); break
        if not hit:
            for v in variants(n):  # 2. Wikidata 台灣的項目，名稱相同（多個同名的取維基條目最多的）
                if v in wd:
                    c = max(wd[v], key=lambda t: t[2]); hit = (c[0], c[1], "Wikidata"); break
        if not hit:
            for v in variants(n):  # 3. 觀光資訊資料庫，同縣市、名稱包含
                cands = [k for k in keys if (v in k or (len(k) >= 3 and k in v)) and any(a[2] == city for a in by_name[k])]
                if cands:
                    k = min(cands, key=len)
                    a = next(a for a in by_name[k] if a[2] == city)
                    hit = (a[0], a[1], f"觀光資訊資料庫（{k}）"); break
        if hit:
            out[n] = hit
    return out


def taiwan_sites() -> list[dict]:
    rows = _tw_rows()
    by_site: dict[str, dict] = {}
    for r in rows:
        y = int(r["年別"])
        n = _site_name(r)
        if not n:
            continue
        s = by_site.setdefault(n, {"name": n, "v": {}, "pk": {}, "types": {}, "city": None})
        months = []
        for m in range(1, 13):
            try:
                months.append(int(float(r[f"{m}月"] or 0)))
            except ValueError:
                months.append(0)
        total = sum(months)
        if total <= 0:
            continue  # 整年是 0 的是沒有報，不是沒有人
        s["v"][y] = s["v"].get(y, 0) + total
        s["pk"][y] = months.index(max(months)) + 1
        t = TYPE_ALIASES.get(r["類型"].strip(), r["類型"].strip())
        s["types"][y] = t
        s["city"] = r["縣市"].split("\n")[0].strip()
    # 2024 年改了名字的據點（「安平小鎮」→「安平」、「臺北市立動物園」→「臺北市立動物園TaipeiZoo」）：跟 2023 年有、2024 年沒有的
    # 名稱配對（名稱互相包含，或相似度 0.6 以上，一對一），把舊名的歷年人次與類型併進新名
    import difflib
    new_only = [n for n, s in by_site.items() if 2024 in s["v"] and not any(y < 2024 for y in s["types"])]
    old_only = [n for n, s in by_site.items() if 2023 in s["types"] and 2024 not in s["types"]]
    renames: dict[str, str] = {}
    for n in new_only:
        cands = [(1.0 if (o in n or n in o) else difflib.SequenceMatcher(None, n, o).ratio(), o) for o in old_only if o not in renames.values()]
        best = max(cands, default=(0, None))
        if best[0] >= 0.6:
            renames[n] = best[1]
    for n, o in renames.items():
        old_s = by_site.pop(o)
        for k in ("v", "pk", "types"):
            for y, v in old_s[k].items():
                by_site[n][k].setdefault(y, v)
    print(f"  台灣據點 2024 年改名、併進舊名的 {len(renames)} 處：{renames}")
    sites = {n: s for n, s in by_site.items() if 2024 in s["v"] or any(y in s["v"] for y in TW_YEARS)}
    loc = _locate_sites({n: s["city"] or "" for n, s in sites.items() if 2024 in s["v"]})
    out, unplaced, changed = [], [], 0
    for n, s in sites.items():
        if 2024 not in s["v"]:
            continue  # 只畫 2024 年還在統計裡的據點（早年的據點名稱常改，對不起來）
        before = [y for y in s["types"] if y < 2024]
        # 2024 年的類型欄錯置：用之前最後一年的類型；2024 年才列入的類型不詳（k = 0）
        t = s["types"][max(before)] if before else None
        if before and s["types"][2024] != t:
            changed += 1
        if n not in loc:
            unplaced.append((n, s["city"], s["v"][2024]))
            continue
        lon, lat, how = loc[n]
        rec = {"lon": round(lon, 4), "lat": round(lat, 4), "iso3": "TWN", "zh": n, "k": TYPES.get(t, 9) if t else 0, "city": s["city"], "how": how}
        for y in TW_YEARS:
            rec[f"v{y}"] = s["v"].get(y)
            rec[f"p{y}"] = s["pk"].get(y)
        out.append(rec)
    print(f"  台灣據點 2024 年 {sum(1 for s in sites.values() if 2024 in s['v'])} 處：找到位置 {len(out)}（"
          f"{Counter(r['how'].split('（')[0] for r in out)}），沒有位置 {len(unplaced)}；2024 年類型跟往年不同而改回的 {changed} 處")
    print(f"    沒有位置的（依 2024 年人次）：{sorted(unplaced, key=lambda x: -x[2])}")
    return out


def build() -> None:
    wp = water_parks()
    data = points_file(wp, ["lon", "lat", "iso3", "en", "zh", "src"] + [f"v{y}" for y in WATER_YEARS],
                       {"lon": 0.0001, "lat": 0.0001, "src": 1, **{f"v{y}": 1 for y in WATER_YEARS}}, strings=("iso3",))
    write_json(OUT / "water-park-visitors.json", data)
    tw = taiwan_sites()
    data = points_file(tw, ["lon", "lat", "iso3", "zh", "k", "city"] + [f"v{y}" for y in TW_YEARS] + [f"p{y}" for y in TW_YEARS],
                       {"lon": 0.0001, "lat": 0.0001, "k": 1, **{f"v{y}": 1 for y in TW_YEARS}, **{f"p{y}": 1 for y in TW_YEARS}},
                       strings=("iso3", "city"))
    write_points(OUT / "taiwan-sites.json", data, text=("zh",))
    write_json(OUT / "taiwan-sites-map.json", indicator_file("taiwan-sites", "", TW_YEARS, {}))

    counts = osm_qlever.counts("leisure", "water_park")
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    population = _read_indicator(OUT_DIR / "topics" / "population" / "total.json")
    py = max(y for y in population["years"] if y <= 2025)
    pop = {c: v[population["years"].index(py)] for c, v in population["values"].items()}
    nv, nv_en = {}, {}
    for c in counts:
        if c not in covered:
            nv[c], nv_en[c] = osm_coverage.reason(c, cov.get(c))
    per = {c: [round(n / pop[c] * 100_000, 3)] for c, n in sorted(counts.items()) if c in covered and pop.get(c)}
    write_json(OUT / "water-parks.json", indicator_file(
        "water-parks", "處／十萬人", [YEAR], per, noValue=nv, noValueEn=nv_en, license="ODbL 1.0",
        hints={c: f"OpenStreetMap 上有 {n:,} 處" for c, n in counts.items()},
        hintsEn={c: f"{n:,} on OpenStreetMap" for c, n in counts.items()}))
    write_manifest_part(OUT, "attractions", "attractions-visitors", {"sources": [
        PARKS + " (CC BY-SA 4.0)", "Wikidata (CC0) via QLever", "交通部觀光署 data.gov.tw 8116、7777（政府資料開放授權條款第 1 版）",
        "© OpenStreetMap contributors (ODbL 1.0), via QLever"]})

    top24 = sorted(((r.get("v2024") or 0, r["en"], r["iso3"]) for r in wp), reverse=True)[:12]
    print(f"  水上樂園 {len(wp)} 座；2024 年前幾名 {top24}")
    for name in ("Chimelong Water Park", "Aquaventure World", "Therme Erding"):
        r = next((r for r in wp if r["en"].startswith(name)), None)
        if r:
            print(f"    {name}：{[(y, r[f'v{y}']) for y in WATER_YEARS if r[f'v{y}']]}")
    t24 = sorted(((r["v2024"] or 0, r["zh"], r["city"]) for r in tw), reverse=True)[:12]
    print(f"  台灣 2024 年前幾名 {t24}")
    tot = {y: sum(r[f"v{y}"] or 0 for r in tw) for y in TW_YEARS}
    print(f"    畫出來的據點合計 {tot}")
    print(f"  OSM 水上樂園 {sum(counts.values()):,} 處、{len(counts)} 國；{Counter(counts).most_common(12)}；台灣 {counts.get('TWN')}")
    print(f"    每十萬人（{len(per)} 國）{sorted(((v[0], c) for c, v in per.items()), reverse=True)[:10]}；台灣 {per.get('TWN')}")
