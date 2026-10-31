"""各國宗教的擴充：最大的宗教建築、朝聖地與朝聖之路（第十批順序 184，2026-10-31，製作手冊第一百三十二節）。

使用者 2026-10-30 決定：放進「各國宗教」；最大的宗教建築各宗教分開排名，不跨宗教比大小；朝聖地的點先做，路線請本機
session 下載（OSM relation），台灣的大甲、白沙屯媽祖進香手工補；朝聖地同已排除的候選 316，這次決定做。左邊的清單依宗教分組。

資料：
- 最大的宗教建築：英文維基「List of largest church buildings」（revid 1382619422，依室內面積）、「List of largest mosques」
  （1373241539，依容納人數）、「List of largest Hindu temples」（1376887205，依面積，欄頭掛 citation needed），CC BY-SA 4.0，
  只引用面積、人數、年份這些事實；座標用 Wikidata（依條目對到項目，條目沒有座標的用城市的）。佛寺沒有對應的列表（404）。
- 朝聖地：Wikidata 朝聖地（Q15135589，含子類別）有座標的項目；宗教依 P140，沒有的依 P31（朝聖教堂、聖母朝聖地 → 基督宗教，
  靈場、佛寺 → 佛教…），都沒有的是「不明」。台灣 0 處，手工補媽祖進香的起點與進香的廟（TAIWAN_MAZU，座標是 Wikidata 的）。
- 朝聖之路：本機 session 2026-10-31 依 Wikidata 的朝聖路線（Q337912，有 OSM relation 的 60 條）經 Overpass 下載的線，
  map-plan 的 data/osm/pilgrimage-routes.json（ODbL 1.0），在 cloud 重跑時複製到 pipeline/.cache/osm/。

輸出（public/data/topics/religion/）：religious-buildings.json、pilgrimage-sites.json（點）、pilgrimage-routes.json（線）、
buildings.json、pilgrimage.json（空的指標檔，國家不上色）。
"""
from __future__ import annotations

import json
import re
from collections import Counter

from common import CACHE_DIR, OUT_DIR, download, indicator_file, lines_file, points_file, write_json, write_manifest_part
from sources import wikitable as W
from sources.wikidata_profiles import _rows, _sparql
from topics.attractions_extra import _country, _link, _number, _zh, with_redirects

OUT = OUT_DIR / "topics" / "religion"
OSM_FILE = CACHE_DIR / "osm" / "pilgrimage-routes.json"
YEAR = 2026

LISTS = {
    1: ("List_of_largest_church_buildings", 1382619422),
    2: ("List_of_largest_mosques", 1373241539),
    3: ("List_of_largest_Hindu_temples", 1376887205),
}


def _page(title: str, rev: int) -> str:
    import urllib.parse

    name = re.sub(r"[^a-z0-9]+", "-", title.lower())
    url = f"https://en.wikipedia.org/w/index.php?title={urllib.parse.quote(title)}&action=raw&oldid={rev}"
    return download(url, "wikipedia", f"rel-{name}-{rev}.txt").read_text(encoding="utf-8")


def _num(cell: str) -> float | None:
    m = re.search(r"\{\{(?:nts|ntsh|sort)\|([\d.,]+)", cell)
    if m:
        return float(m.group(1).replace(",", ""))
    return _number(W.strip_refs(cell))


def buildings() -> list[dict]:
    rows = []
    for r, (title, rev) in LISTS.items():
        table = W.tables(_page(title, rev))[0]
        for row in W.rows(table):
            name_title = _link(row[0]) if row else None
            if not name_title or len(row) < 5:
                continue
            if r == 1:  # 名稱、室內、室外、體積、容量、年份、城市、國家、教派
                if len(row) < 9:
                    continue
                rec = {"a": _num(row[1]), "cap": _num(row[4]), "y": re.search(r"\b(\d{3,4})\b", W.strip_refs(row[5])), "city": row[6],
                       "country": row[7], "den": W.text(row[8]).strip()}
            elif r == 2:  # 名稱、圖、面積、容量、城市、國家、年份、宗派
                rec = {"a": _num(row[2]), "cap": _num(row[3]), "y": re.search(r"\b(\d{3,4})\b", W.strip_refs(row[6])) if len(row) > 6 else None,
                       "city": row[4], "country": row[5], "den": W.text(row[7]).strip() if len(row) > 7 else None}
            else:  # 名稱、圖、面積、地點、國家
                rec = {"a": _num(row[2]), "cap": None, "y": None, "city": row[3], "country": row[4], "den": None}
            rec.update({"r": r, "title": name_title, "en": W.text(row[0]).strip(), "iso3": _country(rec["country"]),
                        "city_title": _link(rec["city"]), "y": int(rec["y"].group(1)) if rec["y"] else None})
            rows.append(rec)
    items = with_redirects([x["title"] for x in rows] + [x["city_title"] for x in rows if x["city_title"]])
    key = lambda t: t and t[0].upper() + t[1:]  # noqa: E731
    out, by_city = [], []
    for x in rows:
        it = items.get(key(x["title"])) or {}
        lon, lat = it.get("lon"), it.get("lat")
        if lon is None and items.get(key(x["city_title"])):
            c = items[key(x["city_title"])]
            lon, lat = c["lon"], c["lat"]
            by_city.append(x["en"])
        if lon is None:
            continue
        out.append({"lon": lon, "lat": lat, "en": x["en"], "zh": it.get("zh"), "iso3": x["iso3"], "r": x["r"], "a": x["a"], "cap": x["cap"],
                    "y": x["y"], "den": x["den"]})
    # 各宗教自己的排名：教堂依室內面積、清真寺依容納人數、印度教寺廟依面積
    for r, field in ((1, "a"), (2, "cap"), (3, "a")):
        ranked = sorted((o for o in out if o["r"] == r and o[field]), key=lambda o: -o[field])
        for i, o in enumerate(ranked, 1):
            o["rank"] = i
    print(f"  宗教建築：教堂 {sum(1 for o in out if o['r'] == 1)}、清真寺 {sum(1 for o in out if o['r'] == 2)}、印度教寺廟 "
          f"{sum(1 for o in out if o['r'] == 3)}（共 {len(rows)} 列，用城市座標的 {len(by_city)}，對不到的 {len(rows) - len(out)}）；"
          f"各第一名 {[(o['en'], o['a'], o['cap']) for o in out if o.get('rank') == 1]}；台灣 {[o['en'] for o in out if o['iso3'] == 'TWN']}")
    return out


# ── 朝聖地 ────────────────────────────────────────────────────────

SITE_QUERY = """
SELECT ?item (SAMPLE(?coord0) AS ?coord) (GROUP_CONCAT(DISTINCT ?rel; separator=",") AS ?rels) (GROUP_CONCAT(DISTINCT ?cls; separator=",") AS ?classes)
       (GROUP_CONCAT(DISTINCT ?iso; separator=",") AS ?isos) (SAMPLE(?en0) AS ?en) (SAMPLE(?zhtw0) AS ?zhtw) (SAMPLE(?zhhant0) AS ?zhhant)
       (SAMPLE(?zh0) AS ?zh) (COUNT(DISTINCT ?sl) AS ?sitelinks) WHERE {
  ?item wdt:P31/wdt:P279* wd:Q15135589 .
  ?item wdt:P625 ?coord0 ; wdt:P31 ?cls .
  OPTIONAL { ?item wdt:P140 ?rel }
  OPTIONAL { ?item wdt:P17/wdt:P298 ?iso }
  OPTIONAL { ?sl schema:about ?item ; schema:isPartOf/wikibase:wikiGroup "wikipedia" }
  OPTIONAL { ?item rdfs:label ?en0 FILTER(lang(?en0) = "en") }
  OPTIONAL { ?item rdfs:label ?zhtw0 FILTER(lang(?zhtw0) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant0 FILTER(lang(?zhhant0) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh0 FILTER(lang(?zh0) = "zh") }
} GROUP BY ?item
"""
# 宗教代碼：1 基督宗教、2 佛教、3 伊斯蘭教、4 印度教、5 其他、0 不明（前端 FAITHS）
REL_P140 = {
    "Q1841": 1, "Q597526": 1, "Q5043": 1, "Q9592": 1, "Q194253": 1, "Q35032": 1, "Q23540": 1, "Q3333484": 1, "Q1062789": 1,
    "Q748": 2, "Q132265": 2, "Q3077357": 2, "Q420739": 2, "Q550182": 2, "Q3077351": 2, "Q10437874": 2, "Q10437754": 2, "Q11583514": 2,
    "Q432": 3, "Q483654": 3, "Q9585": 3, "Q9601": 3,
    "Q9089": 4, "Q1062711": 4,
    "Q9232": 5, "Q9316": 5, "Q9268": 5, "Q812767": 5, "Q178169": 5,
}
REL_P31 = {
    **{q: 1 for q in ("Q10631691", "Q16970", "Q840482", "Q120560", "Q200614", "Q108325", "Q1088552", "Q55876909", "Q317557", "Q43291118",
                      "Q1129743", "Q836412", "Q25392016", "Q56242215", "Q334383", "Q56750657", "Q11331347", "Q580499", "Q29168169",
                      "Q163687", "Q21850178", "Q29553", "Q2977", "Q44613", "Q1128397", "Q513550")},
    **{q: 2 for q in ("Q10565932", "Q5393308", "Q10901138", "Q1207757", "Q160742")},
    **{q: 3 for q in ("Q32815", "Q1185209", "Q19346")},
    **{q: 4 for q in ("Q842402",)},
    **{q: 5 for q in ("Q845945", "Q34627", "Q1128959", "Q697295")},
}
TAIWAN_MAZU = [
    ("Q10936936", "大甲鎮瀾宮", "Dajia Jenn Lann Temple", "大甲媽祖遶境進香的起點（文化部登錄的重要民俗）", "Start of the Dajia Mazu pilgrimage (a nationally registered folk custom)"),
    ("Q11083241", "新港奉天宮", "Fongtien Temple, Singang", "大甲媽祖遶境進香的折返點", "Turning point of the Dajia Mazu pilgrimage"),
    ("Q15913457", "白沙屯拱天宮", "Baishatun Gong Tian Temple", "白沙屯媽祖進香的起點（文化部登錄的重要民俗；路線每年由媽祖決定）",
     "Start of the Baishatun Mazu pilgrimage (a nationally registered folk custom; the route is chosen anew each year)"),
    ("Q707970", "北港朝天宮", "Chaotian Temple, Beigang", "白沙屯媽祖進香的目的地", "Destination of the Baishatun Mazu pilgrimage"),
]
MAZU_QUERY = """SELECT ?item ?coord WHERE { VALUES ?item { %s } ?item wdt:P625 ?coord }"""


def _point(v: str) -> tuple[float, float] | None:
    m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", v or "")
    return (float(m.group(1)), float(m.group(2))) if m else None


def pilgrimage_sites() -> list[dict]:
    from geoindex import countries_at

    rows = _rows(_sparql(SITE_QUERY, "pilgrimage-sites-v2-2026-10-31.json"))
    out = []
    for r in rows:
        pt = _point(r["coord"]["value"])
        if not pt:
            continue
        rels = [x.rsplit("/", 1)[1] for x in r.get("rels", {}).get("value", "").split(",") if x]
        classes = [x.rsplit("/", 1)[1] for x in r["classes"]["value"].split(",") if x]
        f = next((REL_P140[x] for x in rels if x in REL_P140), None) or next((REL_P31[x] for x in classes if x in REL_P31), 0)
        isos = [c for c in r.get("isos", {}).get("value", "").split(",") if c]
        out.append({"lon": pt[0], "lat": pt[1], "en": r.get("en", {}).get("value") or r["item"]["value"].rsplit("/", 1)[1],
                    "zh": _zh(r), "iso3": isos[0] if len(isos) == 1 else None, "f": f, "sl": int(r["sitelinks"]["value"])})
    missing = [o for o in out if not o["iso3"]]
    for o, c in zip(missing, countries_at([o["lon"] for o in missing], [o["lat"] for o in missing])):
        o["iso3"] = c
    coords = {r["item"]["value"].rsplit("/", 1)[1]: _point(r["coord"]["value"])
              for r in _rows(_sparql(MAZU_QUERY % " ".join(f"wd:{q}" for q, *_ in TAIWAN_MAZU), "mazu-coords-2026-10-31.json"))}
    for qid, zh, en, note, note_en in TAIWAN_MAZU:
        lon, lat = coords[qid]
        out.append({"lon": lon, "lat": lat, "en": en, "zh": zh, "iso3": "TWN", "f": 6, "sl": 0, "note": note, "noteEn": note_en})
    c = Counter(o["f"] for o in out)
    print(f"  朝聖地：{len(out)} 處（Wikidata {len(rows)}＋台灣 {len(TAIWAN_MAZU)}）；依宗教 {sorted(c.items())}；"
          f"國家最多 {Counter(o['iso3'] for o in out).most_common(6)}")
    return out


def pilgrimage_routes() -> tuple[dict, list[dict]]:
    if not OSM_FILE.exists():
        raise RuntimeError(f"沒有 {OSM_FILE}：請把 map-plan 的 data/osm/pilgrimage-routes.json 複製到這裡")
    data = json.loads(OSM_FILE.read_text(encoding="utf-8"))
    lines, records, groups, listed = [], [], [], []
    # 是清單裡另一條路線一部分的（parents）不另外畫
    routes = [r for r in data["routes"] if not r.get("parents")]
    for gi, r in enumerate(sorted(routes, key=lambda r: -(r.get("km") or 0))):
        pts_all = []
        for flat in r.get("lines", []):
            pts = [(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]
            if len(pts) >= 2:
                lines.append(pts)
                records.append({"r": gi})
                pts_all += pts
        if not pts_all:
            continue
        wd = r.get("wikidata") or []
        name = r.get("name_en") or (wd[0].get("label") if wd and not re.fullmatch(r"Q\d+", wd[0].get("label", "")) else None) or r.get("name") or ""
        groups.append({"r": gi, "n": name, "o": r.get("name") if r.get("name") != name else None, "km": round(r.get("km") or 0)})
        xs, ys = [p[0] for p in pts_all], [p[1] for p in pts_all]
        listed.append({"lon": (min(xs) + max(xs)) / 2, "lat": (min(ys) + max(ys)) / 2, "bw": min(xs), "bs": min(ys), "be": max(xs), "bn": max(ys),
                       "n": name, "km": round(r.get("km") or 0)})
    from common import points_file as pf
    out = lines_file(lines, 0.002, records=records, record_fields=["r"], record_scale={"r": 1}, record_delta=["r"],
                     groups=("r", pf(groups, ["r", "n", "o", "km"], {"r": 1, "km": 1}, ("r",))))
    print(f"  朝聖之路：{len(groups)} 條、{len(lines)} 段線；最長 {[(g['n'], g['km']) for g in groups[:4]]}")
    return out, listed


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    b = buildings()
    write_json(OUT / "religious-buildings.json", points_file(
        b, ["lon", "lat", "en", "zh", "iso3", "r", "rank", "a", "cap", "y", "den"],
        {"lon": 0.001, "lat": 0.001, "r": 1, "rank": 1, "a": 1, "cap": 1, "y": 1}, (), ("iso3", "den")))
    write_json(OUT / "buildings.json", indicator_file("buildings", "", [YEAR], {}))
    sites = pilgrimage_sites()
    write_json(OUT / "pilgrimage-sites.json", points_file(
        sites, ["lon", "lat", "en", "zh", "iso3", "f", "sl", "note", "noteEn"], {"lon": 0.001, "lat": 0.001, "f": 1, "sl": 1}, (), ("iso3",)))
    routes, _listed = pilgrimage_routes()
    write_json(OUT / "pilgrimage-routes.json", routes)
    write_json(OUT / "pilgrimage.json", indicator_file("pilgrimage", "", [YEAR], {}))
    write_manifest_part(OUT, "religion", "religion-extra", {
        "license": "CC BY-SA 4.0 (English Wikipedia facts); CC0 (Wikidata); ODbL 1.0 (OpenStreetMap pilgrimage routes)",
        "sources": [f"https://en.wikipedia.org/w/index.php?title={t}&oldid={r}" for t, r in LISTS.values()]
                   + ["Wikidata Q15135589 (pilgrimage sites)", "OpenStreetMap contributors (ODbL 1.0), pilgrimage routes via Overpass API (2026-10-31)"],
    })
