"""運動：球隊的主場與台灣的運動場館（2026-11-07，製作手冊第二十四批 426 的補強；步驟 sports-venues，輸出 topics/sports/）。

- 球隊的主場：Wikidata（CC0，經 QLever）P31 是運動俱樂部（Q847017）或它的子類別、有主場（P115）、主場有座標的。
  一個場館一個點（好幾隊共用的併在一起，列出維基百科條目最多的幾隊），點的大小是隊伍的維基語言數最多的那一隊。
  點多：維基語言數 10 以上的放主檔，其他放 -more 檔（放大到國家的大小才畫）。
- 台灣的運動場館：運動部「全國運動場館資訊」（data.gov.tw 22849，政府資料開放授權條款第 1 版，ws.sports.gov.tw 檔案直連），
  只畫對外開放（免費或付費）的；不輸出管理人的姓名與電話。分類併成幾組上色。
"""
from __future__ import annotations

import csv
import io
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, download, points_file, write_points
from sources import qlever_wikidata
from sources.countries import to_iso3
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "sports"
VENUES_URL = "https://ws.sports.gov.tw/FS01/FilePath/1/relfile/164/10269/5a511d68-e6b8-42ee-a449-acc395135268.csv"
MAIN_SL = 10
QUERY = """SELECT ?club ?venue ?coord ?sl ?iso ?sport ?en ?zhtw ?zhhant ?zh ?ven ?vzhtw ?vzhhant ?vzh WHERE {
  ?club wdt:P31/wdt:P279* wd:Q847017 ; wdt:P115 ?venue ; wikibase:sitelinks ?sl .
  ?venue wdt:P625 ?coord .
  FILTER NOT EXISTS { ?club wdt:P576 ?end }
  OPTIONAL { ?club wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?club wdt:P641 ?s . ?s rdfs:label ?sport FILTER(LANG(?sport) = "en") }
  OPTIONAL { ?club rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?club rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?club rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?club rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
  OPTIONAL { ?venue rdfs:label ?ven FILTER(LANG(?ven) = "en") }
  OPTIONAL { ?venue rdfs:label ?vzhtw FILTER(LANG(?vzhtw) = "zh-tw") }
  OPTIONAL { ?venue rdfs:label ?vzhhant FILTER(LANG(?vzhhant) = "zh-hant") }
  OPTIONAL { ?venue rdfs:label ?vzh FILTER(LANG(?vzh) = "zh") }
}"""
# 運動的英文標籤 → 種類（src/topics/sports-venues.ts 的 SPORTS）
SPORTS = {"association football": 1, "basketball": 2, "baseball": 3, "ice hockey": 4, "rugby union": 5, "rugby league": 5,
          "volleyball": 6, "handball": 7, "American football": 8, "cricket": 9}
OTHER = 10
# 台灣場館的分類 → 組（同一個檔的 TW_KINDS）
TW_GROUPS = [
    (1, ("籃球", "排球", "羽球", "桌球", "網球", "躲避球", "足球", "棒", "壘球", "手球", "撞球", "高爾夫", "槌球")),
    (2, ("田徑", "慢跑")),
    (3, ("游泳", "水上")),
    (4, ("健身", "重量訓練", "舞蹈", "韻律", "瑜珈", "武術", "柔道", "跆拳", "拳擊", "技擊")),
]
TW_OTHER = 5
# 運動部的「縣市」欄是行政區代碼
COUNTY = {"63000": "臺北市", "64000": "高雄市", "65000": "新北市", "66000": "臺中市", "67000": "臺南市", "68000": "桃園市",
          "10002": "宜蘭縣", "10004": "新竹縣", "10005": "苗栗縣", "10007": "彰化縣", "10008": "南投縣", "10009": "雲林縣",
          "10010": "嘉義縣", "10013": "屏東縣", "10014": "臺東縣", "10015": "花蓮縣", "10016": "澎湖縣", "10017": "基隆市",
          "10018": "新竹市", "10020": "嘉義市", "09007": "連江縣", "09020": "金門縣", "9007": "連江縣", "9020": "金門縣"}


def _point(v: str) -> tuple[float, float] | None:
    if not v.upper().startswith("POINT("):
        return None
    lon, lat = v[6:-1].split()
    return float(lon), float(lat)


def _clubs() -> tuple[list[dict], Counter]:
    rows = qlever_wikidata.cached("sports-club-venues", QUERY)
    venues: dict[str, dict] = {}
    clubs: dict[str, dict] = {}
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        pt = _point(v("coord"))
        if not pt:
            continue
        vq, cq = v("venue").rsplit("/", 1)[1], v("club").rsplit("/", 1)[1]
        ven = venues.setdefault(vq, {"lon": pt[0], "lat": pt[1], "clubs": {}, "en": v("ven"),
                                     "zh": wikidata_zh(v("vzhtw") or v("vzhhant"), v("vzh"), place=True)})
        c = ven["clubs"].setdefault(cq, {"sl": int(v("sl")), "en": v("en"), "sports": set(), "iso": v("iso"),
                                         "zh": wikidata_zh(v("zhtw") or v("zhhant"), v("zh"), place=True)})
        if v("sport"):
            c["sports"].add(v("sport"))
        clubs[cq] = c
    out = []
    for vq, ven in venues.items():
        cl = sorted(ven["clubs"].values(), key=lambda c: -c["sl"])
        top = cl[0]
        kinds = [SPORTS.get(s, OTHER) for s in top["sports"]] or [OTHER]
        out.append({"lon": round(ven["lon"], 4), "lat": round(ven["lat"], 4), "sl": top["sl"], "n": len(cl), "k": min(kinds),
                    "iso3": to_iso3(top["iso"]) if top["iso"] else None, "en": ven["en"], "zh": ven["zh"],
                    "c": " / ".join(c["en"] or c["zh"] or "" for c in cl[:4]),
                    "cz": " / ".join(c["zh"] or c["en"] or "" for c in cl[:4])})
    return out, Counter(SPORTS.get(s, OTHER) for c in clubs.values() for s in (c["sports"] or {"?"}))


def _taiwan() -> list[dict]:
    raw = download(VENUES_URL, "sports", "venues-22849.csv").read_bytes().decode("utf-8-sig")
    out = []
    for r in csv.DictReader(io.StringIO(raw)):  # 有的欄位內有換行，不能用 splitlines()
        if r["開放情形"] not in ("免費對外開放使用", "付費對外開放使用"):
            continue
        try:
            lat, lon = float(r["緯度"]), float(r["經度"])
        except ValueError:
            continue
        if not (21.5 < lat < 26.5 and 118 < lon < 122.5):
            continue
        cat = r["場館分類"] or ""
        group = next((g for g, words in TW_GROUPS if any(w in cat for w in words)), TW_OTHER)
        year = (r.get("場館啟用年") or "").strip()
        out.append({"lon": round(lon, 5), "lat": round(lat, 5), "k": group, "paid": 1 if r["開放情形"].startswith("付費") else 0,
                    "y": int(year) if year.isdigit() and 1900 < int(year) < 2030 else None,
                    "n": r["場館名稱"].strip(), "cat": cat, "place": f"{COUNTY.get(r['縣市'].strip(), r['縣市'] if not r['縣市'].strip().isdigit() else '')}{r['行政區']}".strip()})
    return out


def build() -> None:
    venues, sports = _clubs()
    from geoindex import countries_at
    for r, iso3 in zip(venues, countries_at([r["lon"] for r in venues], [r["lat"] for r in venues])):
        r["iso3"] = r["iso3"] or iso3  # 隊伍沒有寫國家的，依場館的座標
    venues.sort(key=lambda r: -r["sl"])
    main = [r for r in venues if r["sl"] >= MAIN_SL]
    more = [r for r in venues if r["sl"] < MAIN_SL]
    fields = ["lon", "lat", "sl", "n", "k", "iso3", "en", "zh", "c", "cz"]
    scale = {"lon": 0.0001, "lat": 0.0001, "sl": 1, "n": 1, "k": 1}
    write_points(OUT / "club-venues.json", points_file(main, fields, scale, strings=("iso3",)), text=("en", "zh", "c", "cz"))
    write_points(OUT / "club-venues-more.json", points_file(more, fields, scale, strings=("iso3",)), text=("en", "zh", "c", "cz"))
    tw = _taiwan()
    write_points(OUT / "taiwan-venues.json", points_file(tw, ["lon", "lat", "k", "paid", "y", "n", "cat", "place"],
                                                         {"lon": 0.00001, "lat": 0.00001, "k": 1, "paid": 1, "y": 1},
                                                         strings=("cat", "place")), text=("n",))
    print(f"  球隊主場：{len(venues):,} 個場館（主檔 {len(main):,}、more {len(more):,}），{sum(r['n'] for r in venues):,} 隊；"
          f"運動 {sports.most_common(10)}")
    print(f"    國家：{Counter(r['iso3'] for r in venues).most_common(10)}；台灣 {[(r['zh'] or r['en'], r['cz']) for r in venues if r['iso3'] == 'TWN']}")
    print(f"    最有名：{[(r['en'], r['c'][:40], r['sl']) for r in venues[:8]]}")
    print(f"  台灣運動場館（對外開放）：{len(tw):,}；{Counter(r['k'] for r in tw)}；付費 {sum(r['paid'] for r in tw):,}")
