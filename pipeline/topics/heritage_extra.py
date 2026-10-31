"""世界遺產的擴充：預備名單、世界地質公園、拉姆薩濕地（第十批順序 181，2026-10-31，製作手冊第一百二十九節）。

使用者 2026-10-30 決定：
- 預備名單：只畫還在預備名單、還沒登錄的（Wikidata P4171，有 P757 世界遺產編號或 P1435 = 世界遺產的不算）；台灣畫文化部遴選的
  18 處「臺灣世界遺產潛力點」，用另一個顏色。世界遺產中心的網站被 Cloudflare 擋、syndication 條款要書面授權，不用。
  潛力點的名單與座標取自中文維基「臺灣世界遺產潛力點」（revid 90795963，CC BY-SA 4.0：表格的名稱、類型、入選年份，
  分布圖的經緯度），文資局網站寫「All Rights Reserved」、名單由 WebService 載入（從 cloud 401），不用。
- 世界地質公園：UNESCO 的名單（UNESCO 條款禁止大量擷取）與 GGN（沒有授權）都不能用，用英文維基與 Wikidata 能補多少算多少，
  寫明涵蓋率：各國的處數照英文維基「UNESCO Global Geoparks」（revid 1380702708）依國家的總表（跨國的每國都算），
  點照各洲的表（亞洲、歐洲、北美、拉丁美洲、非洲，有 {{coord}}）再用 Wikidata（P31 或 P1435 = Q53444003）補沒有的；
  台灣不是 UNESCO 會員，國內的地質公園用 Wikidata（geopark Q1324355 的子類別、P17 = 台灣）另一個顏色附上。
- 拉姆薩濕地：Ramsar Sites Information Service 的 WFS 中心點 CSV（CC BY 4.0，使用者 2026-10-30 用瀏覽器讀到 RSIS 的
  licence-information；RSIS 有防機器人，本機 session 2026-10-31 下載，放在 map-plan 的 data/ramsar/，在 cloud 重跑時
  複製到 pipeline/.cache/ramsar/）。登錄日期不在 CSV 裡，只做目前的快照。台灣不是締約方，附國家公園署的國家重要濕地
  （data.gov.tw 25659；圖資在 TGOS，從 cloud 是 HTTP 403，請本機 session 下載中，到了再補）。

輸出（public/data/topics/world-heritage/）：tentative.json（各國預備名單件數）、tentative-points.json（點；cls 1 預備名單、
2 台灣的潛力點）、geoparks.json（各國世界地質公園數，依加入年份累計）、geopark-points.json（點，y 加入年份）、
tw-geoparks.json（台灣國內的地質公園）、ramsar.json（各國處數）、ramsar-area.json（各國面積，公頃）、ramsar-points.json。
"""
from __future__ import annotations

import csv
import math
import re
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, points_file, write_json, write_manifest_part
from sources import wikitable as W
from sources.countries import from_name
from sources.wikidata_profiles import _rows, _sparql

OUT = OUT_DIR / "topics" / "world-heritage"
YEAR = 2026
RAMSAR_CSV = CACHE_DIR / "ramsar" / "ramsar-sites-centroids.csv"

WIKI = {
    "twh": ("zh", "臺灣世界遺產潛力點", 90795963, "twh-potential"),
    "total": ("en", "UNESCO_Global_Geoparks", 1380702708, "geoparks"),
    "asia": ("en", "List_of_UNESCO_Global_Geoparks_in_Asia", 1355160153, "geoparks-asia"),
    "europe": ("en", "List_of_UNESCO_Global_Geoparks_in_Europe", 1382834289, "geoparks-europe"),
    "namerica": ("en", "List_of_UNESCO_Global_Geoparks_in_North_America", 1283462594, "geoparks-namerica"),
    "latam": ("en", "List_of_UNESCO_Global_Geoparks_in_Latin_America", 1366309847, "geoparks-latam"),
    "africa": ("en", "List_of_UNESCO_Global_Geoparks_in_Africa", 1353529500, "geoparks-africa"),
}


def _wiki(key: str) -> str:
    import urllib.parse

    lang, title, rev, name = WIKI[key]
    url = f"https://{lang}.wikipedia.org/w/index.php?title={urllib.parse.quote(title)}&action=raw&oldid={rev}"
    return download(url, "wikipedia", f"{name}-{rev}.txt").read_text(encoding="utf-8")


def _point(v: str | None) -> tuple[float, float] | None:
    m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", v or "")
    return (float(m.group(1)), float(m.group(2))) if m else None


def _zh(r: dict) -> str | None:
    """中文名稱：zh-tw、zh-hant，沒有時把 zh 用 OpenCC 轉成台灣用字（跟「節慶」主題一樣）"""
    from opencc import OpenCC

    for k in ("zhtw", "zhhant"):
        if k in r:
            return r[k]["value"]
    return OpenCC("s2tw").convert(r["zh"]["value"]) if "zh" in r else None


# ── 預備名單 ─────────────────────────────────────────────────────

TENTATIVE_QUERY = """
SELECT ?item (SAMPLE(?id0) AS ?id) (GROUP_CONCAT(DISTINCT ?iso; separator=",") AS ?isos) (SAMPLE(?coord0) AS ?coord)
       (SAMPLE(?en0) AS ?en) (SAMPLE(?zhtw0) AS ?zhtw) (SAMPLE(?zhhant0) AS ?zhhant) (SAMPLE(?zh0) AS ?zh)
       (SAMPLE(?wid0) AS ?wid) (SAMPLE(?whs0) AS ?whs) WHERE {
  ?item wdt:P4171 ?id0 .
  OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?item wdt:P625 ?coord0 }
  OPTIONAL { ?item wdt:P757 ?wid0 }
  OPTIONAL { ?item wdt:P1435 ?whs0 FILTER(?whs0 = wd:Q9259) }
  OPTIONAL { ?item rdfs:label ?en0 FILTER(lang(?en0) = "en") }
  OPTIONAL { ?item rdfs:label ?zhtw0 FILTER(lang(?zhtw0) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant0 FILTER(lang(?zhhant0) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh0 FILTER(lang(?zh0) = "zh") }
} GROUP BY ?item
"""

# 中文維基的入選標準：自 = 自然、文 = 文化，兩個都有是複合
TWH_TYPES = {"文": 1, "自": 2, "複": 3}


def taiwan_potential() -> list[dict]:
    """中文維基「臺灣世界遺產潛力點」：表的 18 處（名稱、類型、入選年份）＋分布圖的座標（一處可能有好幾個點）"""
    text = _wiki("twh")
    table = W.tables(text)[0]
    sites = []
    for row in W.rows(table):
        if len(row) < 5 or not re.search(r"\d{4}", row[4]):
            continue
        name = W.text(row[0]).strip()
        kinds = re.findall(r"\{\{fontcolor\|[^|]*\|[^|]*\|(自|文)\}\}", row[3])
        t = 3 if len(set(kinds)) == 2 else TWH_TYPES.get(kinds[0], 1) if kinds else 1
        year = int(re.search(r"\d{4}", row[4]).group(0))
        links = [l.split("|")[0] for l in re.findall(r"\[\[([^\]]+)\]\]", row[0])]
        sites.append({"name": name, "t": t, "y": year, "links": links})
    marks = re.findall(r"\{\{Location map~\|Taiwan\|lat=([-\d.]+)\|long=([-\d.]+)\|[^}]*?label=(?:\{\{nowrap begin\}\})?\[\[([^\]]+)", text)
    out = []
    for lat, lon, link in marks:
        target, _, shown = link.partition("|")
        site = next((s for s in sites if target in s["links"] or target in s["name"] or (shown and shown in s["name"])), None)
        if site is None:
            raise RuntimeError(f"潛力點的分布圖有表上沒有的點：{target}")
        out.append({"lon": float(lon), "lat": float(lat), "zh": site["name"], "cls": 2, "t": site["t"], "y": site["y"]})
    missing = [s["name"] for s in sites if not any(p["zh"] == s["name"] for p in out)]
    if len(sites) != 18 or missing:
        raise RuntimeError(f"潛力點應該是 18 處，表上 {len(sites)} 處；分布圖沒有座標的：{missing}")
    return out


def tentative() -> None:
    from geoindex import countries_at

    rows = _rows(_sparql(TENTATIVE_QUERY, "tentative-list-2026-10-31.json"))
    pending = [r for r in rows if "wid" not in r and "whs" not in r]
    counts: Counter = Counter()
    points = []
    no_country = [r for r in pending if not r.get("isos", {}).get("value")]
    coords = {id(r): _point(r.get("coord", {}).get("value")) for r in pending}
    guess = countries_at([coords[id(r)][0] for r in no_country if coords[id(r)]], [coords[id(r)][1] for r in no_country if coords[id(r)]])
    guessed = dict(zip([id(r) for r in no_country if coords[id(r)]], guess))
    for r in pending:
        isos = [c for c in r.get("isos", {}).get("value", "").split(",") if c] or ([guessed[id(r)]] if guessed.get(id(r)) else [])
        for c in isos:
            counts[c] += 1
        pt = coords[id(r)]
        if pt:
            points.append({"lon": pt[0], "lat": pt[1], "name": r.get("en", {}).get("value") or r["item"]["value"].rsplit("/", 1)[1],
                           "zh": _zh(r), "iso3": isos[0] if isos else None, "more": ",".join(isos[1:]) or None, "cls": 1})
    tw = taiwan_potential()
    points += tw
    write_json(OUT / "tentative.json", indicator_file(
        "tentative", "件", [YEAR], {c: [n] for c, n in sorted(counts.items())},
        noValue={"TWN": "台灣不能提名世界遺產；文化部自己遴選了 18 處「臺灣世界遺產潛力點」（地圖上另一個顏色的點）"},
        noValueEn={"TWN": "Taiwan cannot nominate sites; the Ministry of Culture has selected 18 “potential World Heritage sites” of its own (dots in another colour)"},
    ))
    write_json(OUT / "tentative-points.json", points_file(
        points, ["lon", "lat", "name", "zh", "iso3", "more", "cls", "t", "y"],
        {"lon": 0.001, "lat": 0.001, "cls": 1, "t": 1, "y": 1}, (), ("iso3",),
    ))
    print(f"  預備名單：Wikidata {len(rows)} 項，還沒登錄的 {len(pending)} 項（{len(points) - len(tw)} 個有座標），"
          f"{len(counts)} 國；最多 {counts.most_common(6)}；台灣潛力點 {len(tw)} 個點")


# ── 世界地質公園 ─────────────────────────────────────────────────

GEOPARK_QUERY = """
SELECT ?item (SAMPLE(?coord0) AS ?coord) (GROUP_CONCAT(DISTINCT ?iso; separator=",") AS ?isos) (SAMPLE(?en0) AS ?en)
       (SAMPLE(?zhtw0) AS ?zhtw) (SAMPLE(?zhhant0) AS ?zhhant) (SAMPLE(?zh0) AS ?zh) (MIN(?start0) AS ?start) (MAX(?ugg0) AS ?ugg) WHERE {
  { ?item wdt:P31 wd:Q53444003 . BIND(1 AS ?ugg0) } UNION { ?item p:P1435 ?st . ?st ps:P1435 wd:Q53444003 . BIND(1 AS ?ugg0) OPTIONAL { ?st pq:P580 ?start0 } }
  UNION { ?item wdt:P31/wdt:P279* wd:Q1324355 ; wdt:P17 wd:Q865 . BIND(0 AS ?ugg0) }
  OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?item wdt:P625 ?coord0 }
  OPTIONAL { ?item rdfs:label ?en0 FILTER(lang(?en0) = "en") }
  OPTIONAL { ?item rdfs:label ?zhtw0 FILTER(lang(?zhtw0) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant0 FILTER(lang(?zhhant0) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh0 FILTER(lang(?zh0) = "zh") }
} GROUP BY ?item
"""
# 英文維基總表的國家名稱 → ISO3（sources.countries 對不到的）
GEOPARK_COUNTRIES = {"Korea": "KOR", "South Korea": "KOR", "Iran": "IRN", "Vietnam": "VNM", "Czech Republic": "CZE", "Czechia": "CZE",
                     "Tanzania": "TZA", "Turkey": "TUR", "Türkiye": "TUR", "United Kingdom": "GBR", "UK": "GBR", "Russia": "RUS"}


def _norm(name: str) -> str:
    name = re.sub(r"\(.*?\)", "", name.lower())
    name = re.sub(r"unesco|global|geopark|geoparque|géoparc|geoparco|national|the\b", " ", name)
    return re.sub(r"[^a-z0-9]+", "", name)


def _iso(name: str) -> str | None:
    name = name.strip()
    return GEOPARK_COUNTRIES.get(name) or from_name(name)


def geopark_total() -> list[dict]:
    """英文維基依國家的總表：[{name, isos, y}]"""
    table = next(t for t in W.tables(_wiki("total")) if "Year included" in t)
    out = []
    for row in W.rows(table)[1:]:
        if len(row) < 4:
            continue
        countries = [c for c in re.split(r"\s*/\s*|\s*,\s*", W.text(row[0])) if c]
        isos = [_iso(c) for c in countries]
        if None in isos:
            raise RuntimeError(f"地質公園總表的國家對不到：{countries}")
        y = re.search(r"\b(19|20)\d\d\b", W.text(row[3]))
        out.append({"name": W.text(row[2]), "isos": isos, "y": int(y.group(0)) if y else None,
                    "links": [l.split("|")[0] for l in re.findall(r"\[\[([^\]]+)\]\]", row[2])]})
    return out


def geopark_tables() -> list[dict]:
    """各洲的表：有 {{coord}} 的列 [{name, lon, lat, y, iso3}]"""
    out = []
    for key in ("asia", "europe", "namerica", "latam", "africa"):
        text = W.strip_refs(_wiki(key)) if hasattr(W, "strip_refs") else _wiki(key)
        for table in W.tables(text):
            for raw in re.split(r"\n\|-", table)[1:]:
                m = re.search(r"\{\{[Cc]oord\|([-\d.]+)\|([-\d.]+)", raw)
                if not m:
                    continue
                link = re.search(r"\[\[([^\]]+)\]\]", raw)
                name = link.group(1).split("|")[-1] if link else ""
                flag = re.search(r"\{\{flag\|([^}|]+)", raw)
                year = re.findall(r"\n\|\s*(?:align=\"center\"\s*\|)?\s*((?:19|20)\d\d)\s*(?=\n|$)", raw)
                out.append({"name": name.strip("' "), "link": link.group(1).split("|")[0] if link else "",
                            "lat": float(m.group(1)), "lon": float(m.group(2)), "y": int(year[0]) if year else None,
                            "iso3": _iso(flag.group(1)) if flag else None, "src": key})
    return out


def geoparks() -> None:
    total = geopark_total()
    tables = geopark_tables()
    wd = _rows(_sparql(GEOPARK_QUERY, "geoparks-2026-10-31.json"))
    by_norm = {}
    for t in total:
        for k in [_norm(t["name"]), *(_norm(l) for l in t["links"])]:
            if k:
                by_norm.setdefault(k, t)

    def match(name: str, link: str = ""):
        for k in (_norm(name), _norm(link)):
            if k and k in by_norm:
                return by_norm[k]
        return None

    points = []
    for p in tables:
        t = match(p["name"], p["link"])
        y = p["y"] or (t and t["y"])
        iso3 = p["iso3"] or (t and t["isos"][0])
        points.append({"lon": p["lon"], "lat": p["lat"], "name": p["name"], "zh": None, "iso3": iso3, "y": y, "cls": 1})
        if t:
            t["drawn"] = True
    # Wikidata 補各洲的表沒有座標的（離已畫的點 20 公里以內的算同一處）
    def near(lon, lat):
        return any(abs(q["lon"] - lon) < 0.2 and abs(q["lat"] - lat) < 0.2 for q in points)
    taiwan = []
    for r in wd:
        pt = _point(r.get("coord", {}).get("value"))
        isos = [c for c in r.get("isos", {}).get("value", "").split(",") if c]
        name = r.get("en", {}).get("value") or ""
        if r["ugg"]["value"] == "0":
            if "TWN" in isos:
                taiwan.append({"lon": pt[0] if pt else None, "lat": pt[1] if pt else None, "zh": _zh(r), "name": name})
            continue
        if not pt or near(*pt):
            continue
        t = match(name)
        y = (t and t["y"]) or (int(r["start"]["value"][:4]) if "start" in r else None)
        points.append({"lon": pt[0], "lat": pt[1], "name": name, "zh": _zh(r), "iso3": isos[0] if isos else (t and t["isos"][0]),
                       "y": y, "cls": 1})
        if t:
            t["drawn"] = True
    undated = [p["name"] for p in points if not p["y"]]
    points = [p for p in points if p["y"]]
    years = list(range(min(t["y"] for t in total if t["y"]), YEAR + 1))
    values: dict[str, list] = defaultdict(lambda: [0] * len(years))
    for t in total:
        if not t["y"]:
            continue
        for c in t["isos"]:
            for i, y in enumerate(years):
                if y >= t["y"]:
                    values[c][i] += 1
    write_json(OUT / "geoparks.json", indicator_file(
        "geoparks", "處", years, {c: [v or None for v in s] for c, s in sorted(values.items())},
        noValue={"TWN": "台灣不是 UNESCO 會員國，沒有世界地質公園；國內的地質公園另一個顏色畫在地圖上"},
        noValueEn={"TWN": "Taiwan is not a UNESCO member and has no UNESCO Global Geoparks; its own geoparks are shown in another colour"},
    ))
    write_json(OUT / "geopark-points.json", points_file(
        points, ["lon", "lat", "name", "zh", "iso3", "y", "cls"], {"lon": 0.001, "lat": 0.001, "y": 1, "cls": 1}, ("y",), ("iso3",)))
    tw_drawn = [t for t in taiwan if t["lon"] is not None]
    write_json(OUT / "tw-geoparks.json", points_file(
        [{**t, "iso3": "TWN"} for t in tw_drawn], ["lon", "lat", "zh", "name", "iso3"], {"lon": 0.001, "lat": 0.001}, (), ("iso3",)))
    n_countries = len({c for t in total for c in t["isos"]})
    print(f"  地質公園：英文維基總表 {len(total)} 處、{n_countries} 國（{sum(1 for t in total if t['y'] == 2025)} 處 2025 年加入），"
          f"各洲的表有座標 {len(tables)} 處，Wikidata 補 {len(points) - len(tables) + len(undated)}；畫出 {len(points)} 個點"
          f"（沒有年份不畫：{undated}）；總表沒對到點的 {sum(1 for t in total if not t.get('drawn'))} 處；"
          f"台灣 {len(taiwan)} 處（{len(tw_drawn)} 處有座標）；最多 {sorted(((s[-1], c) for c, s in values.items()), reverse=True)[:5]}")
    return len(total), n_countries, len(points)


# ── 拉姆薩濕地 ───────────────────────────────────────────────────


def ramsar() -> None:
    if not RAMSAR_CSV.exists():
        raise RuntimeError(f"沒有 {RAMSAR_CSV}：請把 map-plan 的 data/ramsar/ramsar-sites-centroids.csv 複製到這裡")
    points, counts, area = [], Counter(), defaultdict(float)
    with open(RAMSAR_CSV, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            pt = re.match(r"POINT \(([-\d.eE]+) ([-\d.eE]+)\)", r["geom"])
            iso3 = r["iso3"].strip() or None
            a = float(r["area_off"]) if r["area_off"] else None
            if iso3:
                counts[iso3] += 1
                area[iso3] += a or 0
            points.append({"lon": float(pt.group(1)), "lat": float(pt.group(2)), "name": r["officialname"].strip(), "iso3": iso3,
                           "id": int(r["ramsarid"]), "ha": round(a) if a is not None else None})
    no_value = {"noValue": {"TWN": "台灣不是《拉姆薩公約》的締約方；國家公園署另外公告國家重要濕地"},
                "noValueEn": {"TWN": "Taiwan is not a party to the Ramsar Convention; it designates its own wetlands of national importance"}}
    write_json(OUT / "ramsar.json", indicator_file("ramsar", "處", [YEAR], {c: [n] for c, n in sorted(counts.items())}, **no_value))
    write_json(OUT / "ramsar-area.json", indicator_file("ramsar-area", "公頃", [YEAR], {c: [round(v)] for c, v in sorted(area.items())}, **no_value))
    write_json(OUT / "ramsar-points.json", points_file(
        points, ["lon", "lat", "name", "iso3", "id", "ha"], {"lon": 0.001, "lat": 0.001, "id": 1, "ha": 1}, (), ("iso3",)))
    print(f"  拉姆薩濕地：{len(points):,} 處、{len(counts)} 國、{sum(area.values()):,.0f} 公頃；處數最多 {counts.most_common(5)}；"
          f"面積最大 {sorted(((round(v), c) for c, v in area.items()), reverse=True)[:5]}")


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tentative()
    geoparks()
    ramsar()
    write_manifest_part(OUT, "world-heritage", "heritage-extra", {
        "license": "CC0 (Wikidata); CC BY-SA 4.0 (Wikipedia: Taiwan potential sites, UNESCO Global Geoparks); CC BY 4.0 (Ramsar RSIS)",
        "sources": ["Wikidata P4171, Q53444003, Q1324355", *(f"https://{l}.wikipedia.org/w/index.php?oldid={r}" for l, _, r, _ in WIKI.values()),
                    "Ramsar Sites Information Service, features_centroid_published (CC BY 4.0)"],
    })
