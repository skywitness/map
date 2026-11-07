"""南極：觀光船去了哪裡（2026-11-07，製作手冊第二十四批 435；步驟 antarctic-tourism，輸出 topics/antarctica/）。

- 資料：南極條約秘書處（ATS）電子資訊交換系統（EIES）的「Most Visited Sites」報表（船載觀光，Annual），
  eies.ats.aq 的 JSON（每頁 20 筆，依季分頁；eies.ats.aq 沒有 robots.txt）。各締約國通報的每個場址一季的造訪趟數
  （NumberOfVisits）與人次（NumberOfVisitors，同一個人在不同場址各算一次）。人次從 2012/13 季才有填，之前只有趟數。
  ATS 的著作權聲明（www.ats.aq/e/copyright.html）：「ATS copyrighted material maybe used as long as the source is
  indicated」，同頁標 CC BY 4.0。www.ats.aq 的 robots.txt 對一般程式是 Disallow: /，所以這裡不讀 www.ats.aq
  （場址指引的 PDF 也不讀）。
- 場址沒有座標：用 Wikidata（CC0，經 QLever，南緯 60 度以南、有座標的地名的英文、西班牙文、法文標籤與別名）比對名稱，
  另比對 EIES 給的別名（ChildrenNames，西班牙文或法文的地名）；「X/Y」「X (Y)」拆開各試一次，西班牙文的「Isla X」「Punta X」
  也試英文的寫法。還對不到的再查美國地質調查所的 GNIS Antarctica（公有領域，2026-11-07 補；見 _gnis()）。對不到的不畫，列在清單。
- 場址以 GuidelineId 識別（各季同一個），名稱用最近一季的寫法。海峽、水道（Strait、Channel、Passage、Sound）多半是
  船上巡遊、不上岸，標出來（w）。
- 季：2007 是 2007/08 季（南半球的夏天）。
"""
from __future__ import annotations

import csv
import io
import json
import math
import re
import unicodedata
import zipfile
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, points_file, write_json, write_manifest_part

OUT = OUT_DIR / "topics" / "antarctica"
EIES = CACHE_DIR / "eies"
NAMES = CACHE_DIR / "wikidata" / "antarctic-names.json"
URL = ("https://eies.ats.aq/SharedSummarizedReports/GetShipBasedByMostVisitedSitesRptList"
       "?period=2&yearFrom={y}&yearTo={y1}&related=0&offset={o}")
FIRST, LAST = 2007, 2025  # 2026/27 季還沒有資料（EIES 回 0 筆）
VISITORS_FROM = 2012  # 人次從 2012/13 季才有填
# EIES 的地區 → 顏色分組（src/topics/antarctic-tourism.ts 的 REGIONS）
REGION_GROUP = {
    "Antarctic Peninsula - NW Side": 1,
    "South Shetland Islands": 2,
    "Antarctic Peninsula - East Side": 3, "Larsen Ice Shelf": 3, "James Ross Island": 3,
    "Antarctic Peninsula - SW Side": 4, "Adelaide Island": 4, "Alexander Island": 4,
    "South Orkney Islands": 5,
    "Ross Sea Region": 6, "Ross Ice Shelf": 6, "Marie Byrd Land": 6,
}
OTHER = 7  # 東南極（各「地」）與其他
# EIES 的寫法 → Wikidata 的名稱（拼法不同、或是建物用所在的島）
ALIASES = {
    "Arctowski Station": "Henryk Arctowski Station",
    "Wordie House": "Winter Island",
    "Wordie House, Winter Island": "Winter Island",
    "Snow Hill Hut": "Cabaña refugio de la Isla Snow Hill",
    "Snow Hill Emperor Rookery": "Snow Hill Island",
    "Scontorp Cove": "Skontorp Cove",
    "Base Argentina San Martin": "San Martín Base",
    "Mawson’s Huts and Cape Denison": "Cape Denison",
    "Mawson's Huts and Cape Denison": "Cape Denison",
    # 2026-11-07 補（手冊 435 的補強；每個目標名稱都查過在 Wikidata 的南極地名裡、EIES 的地區也對得上）
    "Mendel Station (Czechia)": "Mendel Polar Station",
    "Base Bernardo O'Higgins del Ejército de Chile": "Base General Bernardo O'Higgins Riquelme",
    "Decepción Antarctic Base": "Base Antártica Decepción",
    "Sven Foyn, puerto": "Foyn Harbor",  # 西班牙文的 Puerto Foyn
    "Stancomb Wills Rookery": "Stancomb-Wills Glacier Tongue",  # 皇帝企鵝的繁殖地在冰舌
    "Snow Hill Island- Ice Edge Landing": "Snow Hill Island",  # 冰緣登陸，位置每年不同
    "Northeast beach of Ardley Island": "Ardley Island",
    "Cape Crozier Camp": "Cape Crozier",
}
# 不在南極條約區（南緯 60 度以南）或不是一個點的：南喬治亞、福克蘭群島、德雷克海峽、「南極大陸」、海
OUTSIDE = re.compile(r"south georgia|west point island|falkland|drake passage|antarctic continent|durville sea", re.I)
WATER = re.compile(r"\b(strait|channel|passage|sound)\b", re.I)
# Wikidata 對不到的，再查美國地質調查所的南極地名（GNIS Antarctica，公有領域；正式名稱與別名）。別名常常是別的地方的舊名，
# 所以只收在同一個 EIES 地區、已經對到的場址 NEAR_KM 公里以內的（例如 Stony Point 在 GNIS 是喬治王島 Lapidary Point 的
# 別名，EIES 寫在半島西北側，不收）。
GNIS_URL = "https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/Antarctica/Gazetteer_Antarctica_Text.zip"
NEAR_KM = 75


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.replace("´", "'").replace("’", "'").replace("`", "'"))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9' ]", " ", s)).strip()


def _variants(name: str) -> list[str]:
    name = re.sub(r"/?\b(Arg|Chile|UK|US)\./?", " ", name).strip(" /")
    out = [name]
    for part in re.split(r"[/(),]| - | – ", name):
        if part.strip():
            out.append(part.strip())
    # 倒裝的寫法：「Foster, Port」「Gullet, The」「Burd, Cape」「Gaspar, Bahía」
    m = re.match(r"^(.+?),\s*(\S+)$", name.strip())
    if m:
        out.append(f"{m.group(2)} {m.group(1)}")
    # 研究站：「Base Almirante Brown」「Arctowski Station」「Presidente Eduardo Frei Montalva」
    for v in list(out):
        core = re.sub(r"^(base|station|estación|estacion)\s+|\s+(station|base)$", "", v, flags=re.I).strip()
        out += [f"{core} Station", f"{core} Base", f"{core} Antarctic Base", f"Base {core}"]
        if re.search(r"\bHarbor\b", v):
            out.append(re.sub(r"\bHarbor\b", "Harbour", v))
        if re.search(r"\bHarbour\b", v):
            out.append(re.sub(r"\bHarbour\b", "Harbor", v))
        # 西班牙文的地名 → 英文（「Isla Guepratte」→ Guepratte Island）
        m = re.match(r"^(Isla|Islas|Punta|Cabo|Bahía|Bahia|Caleta|Puerto)\s+(.+)$", v, re.I)
        if m:
            kind = {"isla": "Island", "islas": "Islands", "punta": "Point", "cabo": "Cape", "bahía": "Bay", "bahia": "Bay",
                    "caleta": "Cove", "puerto": "Harbor"}[m.group(1).lower()]
            out.append(f"Cape {m.group(2)}" if kind == "Cape" else f"{m.group(2)} {kind}")
    return [v for v in dict.fromkeys(out) if len(v) > 2]


def _seasons() -> dict[int, list[dict]]:
    out: dict[int, list[dict]] = {}
    for y in range(FIRST, LAST + 1):
        rows, o = [], 0
        while True:
            path = EIES / f"annual-{y}-{o}.json"
            if not path.exists():
                raise RuntimeError(f"沒有 {path}：先抓 {URL.format(y=y, y1=y + 1, o=o)}（每頁 20 筆）")
            page = json.loads(path.read_text(encoding="utf-8"))
            rows += page
            if len(page) < 20:
                break
            o += 20
        out[y] = rows
    return out


def _gazetteer() -> dict[str, list[tuple[float, float, str]]]:
    rows = json.loads(NAMES.read_text(encoding="utf-8"))["results"]["bindings"]
    out: dict[str, list[tuple[float, float, str]]] = defaultdict(list)
    for r in rows:
        m = re.match(r"POINT\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"]["value"])
        if not m:
            continue
        out[_norm(r["name"]["value"])].append((float(m.group(2)), float(m.group(1)), r["item"]["value"].rsplit("/", 1)[1]))
    return out


def _gnis() -> dict[str, list[tuple[float, float, str]]]:
    path = download(GNIS_URL, "usgs-gnis", "Gazetteer_Antarctica_Text.zip")
    with zipfile.ZipFile(path) as z:
        def read(name: str) -> list[dict]:
            return list(csv.DictReader(io.TextIOWrapper(z.open(f"Text/{name}"), encoding="utf-8-sig"), delimiter="|",
                                       quoting=csv.QUOTE_NONE))
        main = {r["feature_id"]: r for r in read("AntarcticaNames_Antarctica.txt")}
        alt = read("AntarcticaAllNames_Antarctica.txt")
    out: dict[str, list[tuple[float, float, str]]] = defaultdict(list)
    for fid, name in [(f, r["feature_name"]) for f, r in main.items()] + [(r["feature_id"], r["feature_name"]) for r in alt]:
        r = main.get(fid)
        if not r or not r["prim_lat_dec"] or not r["prim_long_dec"]:
            continue
        hit = (float(r["prim_lat_dec"]), float(r["prim_long_dec"]), f"GNIS {fid}")
        if hit not in out[_norm(name)]:
            out[_norm(name)].append(hit)
    return out


def _km(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def _locate(names: list[str], gaz) -> tuple[float, float, str] | None:
    names = [ALIASES.get(n.strip(), n) for n in names]
    for name in names:
        for v in _variants(name):
            hits = gaz.get(_norm(v))
            if hits:
                # 同名的好幾處（例如兩個 Brown Bluff）：取第一個在南極半島一帶的，否則第一個
                hits = sorted(hits, key=lambda h: (not (-70 < h[0] < -60 and -70 < h[1] < -50), h[2]))
                return hits[0]
    return None


def build() -> None:
    seasons = _seasons()
    gaz = _gazetteer()
    sites: dict[str, dict] = {}
    for y, rows in seasons.items():
        for r in rows:
            key = r["GuidelineId"] or _norm(r["NumberSiteName"])
            s = sites.setdefault(key, {"names": [], "region": "", "guideline": False, "t": {}, "v": {}})
            name = r["NumberSiteName"].strip().replace("´", "'")
            if name not in s["names"]:
                s["names"].insert(0, name)  # 最近一季的寫法放前面
            alt = [a.strip() for a in (r.get("ChildrenNames") or "").split("/") if a.strip()]
            s.setdefault("alt", [])
            s["alt"] += [a for a in alt if a not in s["alt"]]
            region = re.sub(r"\s+", " ", r["Region"] or "").strip()
            if region:
                s["region"] = region
            s["guideline"] = s["guideline"] or r["ParentType"] == "G"
            s["t"][y] = s["t"].get(y, 0) + r["NumberOfVisits"]
            s["v"][y] = s["v"].get(y, 0) + r["NumberOfVisitors"]

    points, missing, outside, sites_by_name = [], [], [], {}
    for key, s in sites.items():
        if OUTSIDE.search(s["names"][0]):
            outside.append(s["names"][0])
            continue
        hit = _locate(s["names"] + s["alt"], gaz)
        row: dict[str, object] = {
            "name": s["names"][0], "r": s["region"], "g": REGION_GROUP.get(s["region"], OTHER),
            "w": 1 if WATER.search(s["names"][0]) else 0, "gl": 1 if s["guideline"] else 0,
        }
        for y in range(FIRST, LAST + 1):
            row[f"t{y}"] = s["t"].get(y) or None
            row[f"v{y}"] = (s["v"].get(y) or None) if y >= VISITORS_FROM else None
        sites_by_name[s["names"][0]] = s
        if hit:
            row["lat"], row["lon"], row["q"] = hit
            points.append(row)
        else:
            missing.append(row)

    # 第二輪：GNIS，只收同一地區已對到的場址附近的
    gnis, by_region, from_gnis = _gnis(), defaultdict(list), []
    for p in points:
        by_region[p["r"]].append((p["lat"], p["lon"]))
    for row in list(missing):
        s = sites_by_name[row["name"]]
        for name in [ALIASES.get(n.strip(), n) for n in s["names"] + s["alt"]]:
            cands = [h for v in _variants(name) for h in gnis.get(_norm(v), [])]
            near = [h for h in cands if by_region[row["r"]] and min(_km(h[:2], q) for q in by_region[row["r"]]) <= NEAR_KM]
            if near:
                row["lat"], row["lon"], row["q"] = near[0]
                points.append(row)
                missing.remove(row)
                from_gnis.append((row["name"], near[0][2]))
                break
    print(f"  GNIS 補到 {len(from_gnis)} 個：{from_gnis}")

    fields = ["lon", "lat", "name", "r", "g", "w", "gl", "q"] + [f"t{y}" for y in range(FIRST, LAST + 1)] + \
             [f"v{y}" for y in range(VISITORS_FROM, LAST + 1)]
    points.sort(key=lambda p: p["lon"])
    write_json(OUT / "tourism-sites.json", points_file(points, fields, {"lon": 0.001, "lat": 0.001}, delta=("lon",),
                                                       strings=("r",)))
    years = list(range(FIRST, LAST + 1))
    totals = {y: (sum(s["t"].get(y, 0) for s in sites.values()), sum(s["v"].get(y, 0) for s in sites.values()),
                  sum(1 for s in sites.values() if s["t"].get(y))) for y in years}
    nv = {"TWN": "台灣沒有觀光船登陸的場址"}
    nv_en = {"TWN": "Taiwan has no Antarctic visitor sites"}
    write_json(OUT / "tourism-visits.json", indicator_file("tourism-visits", "", years, {}, noValue=nv, noValueEn=nv_en,
                                                           license="CC BY 4.0"), quiet=True)
    write_json(OUT / "tourism-visitors.json", indicator_file("tourism-visitors", "", list(range(VISITORS_FROM, LAST + 1)), {},
                                                             noValue=nv, noValueEn=nv_en, license="CC BY 4.0"), quiet=True)
    write_manifest_part(OUT, "antarctica", "antarctic-tourism", {"sources": [
        "Antarctic Treaty Secretariat, EIES Most Visited Sites (https://eies.ats.aq/) (CC BY 4.0)",
        "Wikidata (CC0) via QLever", GNIS_URL + " (USGS, public domain)"]})

    print(f"  場址 {len(sites)}：對到座標 {len(points)}、對不到 {len(missing)}、條約區以外或不是一個點 {len(outside)}：{outside}")
    for y in years:
        print(f"    {y}/{(y + 1) % 100:02d}：{totals[y][2]} 個場址、{totals[y][0]:,} 趟、{totals[y][1]:,} 人次")
    for y in (LAST - 1, LAST):
        print(f"    {y}：畫在地圖上 {sum(1 for p in points if p[f't{y}'])} 個場址、人次 {sum(p[f'v{y}'] or 0 for p in points):,}")
    last = LAST
    top = sorted(sites.values(), key=lambda s: -s["v"].get(last, 0))[:12]
    for s in top:
        print(f"    {s['names'][0]}（{s['region']}）{s['t'].get(last)} 趟、{s['v'].get(last):,} 人次")
    lost = sorted(missing, key=lambda m: -(m.get(f"v{last}") or m.get(f"t{last}") or 0))
    print(f"  對不到座標（依 {last}/{(last + 1) % 100} 季）：{[(m['name'], m.get(f'v{last}')) for m in lost[:40]]}")
