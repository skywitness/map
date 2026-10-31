"""景點地圖（新主題，地理類，2026-10-29）：世界的博物館、動物園與水族館、主題樂園與雲霄飛車，每一處一個點。

**資料**：sources/wikidata_attractions.py 查的 Wikidata 項目（CC0）。使用者決定（2026-10-29）：三類合成一個主題、用圖層切換；
只畫點，不做各國的數量（數量反映 Wikidata 的匯入程度，不是實際的多寡）；台灣的博物館用文化部「博物館」開放資料
（政府資料開放授權條款第 1 版）補；台灣缺的動物園、水族館手工補（TAIWAN_ZOOS）；已拆除、停業的不畫。

**取捨**：
- 一個項目屬於好幾類時：同時是動物園（水族館）與樂園的兩個圖層都畫（例如六福村）；也是博物館的不畫在博物館
  （例如海生館在 Wikidata 也是博物館，製作手冊的陷阱）。Wikidata 的水族館是動物園的子類別，有水族館類別的算水族館。
- 國家依座標判斷（geoindex.countries_at），不用 P17：P17 是台灣的項目有些在中國大陸（中華民國時期），P17 也可能沒寫。
- 縮小時只畫有名的：依維基百科的條目數（sitelinks）篩選，前端的 minValue。
- 名稱：英文介面用英文標籤，沒有的用多語言標籤（mul）或當地語言的名稱（sources 的 FALLBACK_LANGS），欄位照樣叫 en；
  中文介面用台灣用字的中文名稱，沒有的用 en。

**輸出**（public/data/topics/attractions/）：museums.json（重要的）與 museums-more.json（其餘的，見 MUSEUM_IMPORTANT_SL）、
zoos.json、parks.json（點）、attractions.json（空的指標檔，國家不上色）。
"""
from __future__ import annotations

import json
import math
import re

from common import CACHE_DIR, OUT_DIR, download, indicator_file, now_iso, points_file, write_json, write_layered_points
from geoindex import countries_at
from sources import wikidata_attractions as wd

OUT = OUT_DIR / "topics" / "attractions"
# museums.json 收的博物館：維基百科條目語言數這麼多以上（src/topics/attractions.ts 的 overlay() 在 7 級以下只畫這些），其餘的在 -more.json
MUSEUM_IMPORTANT_SL = 8

MOC_URL = "https://cloud.culture.tw/frontsite/trans/emapOpenDataAction.do?method=exportEmapJson&typeId=H"
# 博物館的類型代碼（前端 MUSEUM_TYPES 的順序）
MUSEUM_CODE = {"art": 1, "nature": 2, "history": 3}
OTHER = 4
# 文化部的類型 → 代碼
MOC_TYPE = {"藝術與工藝": 1, "自然與科學": 2, "歷史與人文": 3, "綜合與其他": 4}
# 動物園與水族館、樂園與雲霄飛車的代碼
ZOO, AQUARIUM = 1, 2
PARK, COASTER = 1, 2
# 文化部的博物館跟 Wikidata 的同一館：距離在這個範圍內（公里）且名稱相似（similar），或名稱完全相同
MATCH_KM = 0.5

# 台灣缺的動物園、水族館（手工補，使用者 2026-10-29 決定）：Wikidata 項目 → (補上的大類, 出處)。
# 六福村在 Wikidata 已經有動物園的類別，不必補
TAIWAN_ROLES = {
    "Q14610973": ("aquarium", "遠雄海洋公園官網 https://www.farglory-oceanpark.com.tw/ （海洋生物館、海獅館等；Wikidata 的說明是 marine mammal park）"),
}


def km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, math.radians(b[0] - a[0])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


# 博物館名稱裡太常見、不能拿來比對的字
GENERIC = set("博物館美術紀念園區文化中心國立市縣臺台灣之的")


def similar(a: str | None, b: str) -> bool:
    """兩個名稱一個包含另一個，或有兩個以上共同的、不常見的字"""
    if not a:
        return False
    a, b = a.replace("台", "臺"), b.replace("台", "臺")
    return a in b or b in a or len((set(a) & set(b)) - GENERIC) >= 2


def zh_name(d: dict, s2tw, s2twp) -> str | None:
    """台灣用字的中文名稱：zh-tw、zh-hant 的標籤（有些夾著簡體字，逐字轉繁體），沒有的用 zh 轉成台灣用語；
    去掉維基百科條目名稱式的消歧義括號（例如「高爾基公園 (莫斯科)」）"""
    if d.get("zhtw") or d.get("zhhant"):
        name = s2tw.convert(d.get("zhtw") or d.get("zhhant"))
    elif d.get("zh"):
        name = s2twp.convert(d["zh"])
    else:
        return None
    return re.sub(r"\s\([^)]*\)$", "", name)


def moc_museums() -> list[dict]:
    path = download(MOC_URL, "moc", "museums.json")
    out = []
    for m in json.loads(path.read_text(encoding="utf-8")):
        try:
            lon, lat = float(m["longitude"]), float(m["latitude"])
        except (TypeError, ValueError):
            continue
        out.append({"zh": m["name"].split(" /")[0].strip(), "en": (m.get("name_eng") or "").strip().title() or None,
                    "lon": lon, "lat": lat, "t": MOC_TYPE.get(m.get("type"), OTHER)})
    return out


def build() -> None:
    from opencc import OpenCC

    s2tw, s2twp = OpenCC("s2tw"), OpenCC("s2twp")
    items = wd.fetch()
    types = wd.museum_types()
    museums, zoos, parks = [], [], []
    dropped = {"closed": 0, "coord": 0, "not-museum": 0}
    for q, d in items.items():
        if d["closed"] or "Q123124127" in d["classes"]:
            dropped["closed"] += 1
            continue
        if not d["coord"]:
            dropped["coord"] += 1
            continue
        lon, lat = d["coord"]
        row = {"lon": lon, "lat": lat, "sl": d["sl"], "en": d.get("en"), "zh": zh_name(d, s2tw, s2twp), "q": q}
        roots = d["roots"] | ({TAIWAN_ROLES[q][0]} if q in TAIWAN_ROLES else set())
        if "zoo" in roots or "aquarium" in roots:
            zoos.append({**row, "t": AQUARIUM if "aquarium" in roots else ZOO})
        if "roller-coaster" in roots:
            parks.append({**row, "t": COASTER})
        elif "theme-park" in roots or "amusement-park" in roots:
            parks.append({**row, "t": PARK})
        if not roots - {"museum"}:
            museum_classes = d["classes"] - wd.NOT_MUSEUMS
            if not museum_classes:
                dropped["not-museum"] += 1
                continue
            found = [types[c] for c in museum_classes if c in types]
            code = min((MUSEUM_CODE[t] for t in found), default=OTHER)
            museums.append({**row, "t": code})

    # 沒有英文標籤的用多語言標籤（mul）或其他語言的名稱（英文介面顯示這個）；什麼名稱都沒有的不收
    names = wd.fallback_names(sorted({r["q"] for r in museums + zoos + parks if not r["en"]}))
    dropped["no-name"] = 0
    for rows in (museums, zoos, parks):
        for r in rows:
            r["en"] = r["en"] or names.get(r["q"])
        named = [r for r in rows if r["en"] or r["zh"]]
        dropped["no-name"] += len(rows) - len(named)
        rows[:] = named
        for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
            r["iso3"] = iso3

    # 台灣：文化部的博物館補上 Wikidata 沒有的；文化部的名錄也有動物園、海生館這類，對到動物園與水族館的不補
    tw = [r for r in museums + zoos + parks if r["iso3"] == "TWN"]
    added = matched = 0
    for m in moc_museums():
        same = next((w for w in tw if w["zh"] == m["zh"] or (
            km((w["lon"], w["lat"]), (m["lon"], m["lat"])) <= MATCH_KM and similar(w["zh"], m["zh"]))), None)
        if same:
            matched += 1
            if any(same is r for r in museums) and same["t"] == OTHER:
                same["t"] = m["t"]
            continue
        added += 1
        museums.append({"lon": m["lon"], "lat": m["lat"], "sl": 0, "en": m["en"], "zh": m["zh"], "q": None, "t": m["t"], "iso3": "TWN", "moc": 1})

    OUT.mkdir(parents=True, exist_ok=True)
    fields = ["lon", "lat", "t", "sl", "iso3", "en", "zh"]
    # 座標到 0.001°（約 100 m）；依經度排序、差分，gzip 壓得比較好（畫的順序由前端的 sortField 決定）
    scale = {"lon": 0.001, "lat": 0.001, "t": 1, "sl": 1}
    for name, rows in (("museums", museums), ("zoos", zoos), ("parks", parks)):
        for r in rows:
            r["lon"], r["lat"] = round(r["lon"], 3), round(r["lat"], 3)
            if r["zh"] == r["en"]:
                r["zh"] = None
        rows.sort(key=lambda r: (r["lon"], r["lat"], r["q"] or "", r["zh"] or ""))
        if name == "museums":
            # 6 萬多座博物館：維基百科條目語言數 MUSEUM_IMPORTANT_SL 以上的（約 6.5%）在 museums.json，縮放 7 級以下只畫它們
            # （src/topics/attractions.ts 的 overlay() 的 stops），其餘的在 museums-more.json，放大到 6.5 級才下載（2026-10-31）
            write_layered_points(OUT / "museums.json", rows, lambda r: (r.get("sl") or 0) >= MUSEUM_IMPORTANT_SL,
                                 fields + ["moc"], scale, delta=("lon",), strings=("iso3",))
        else:
            write_json(OUT / f"{name}.json", points_file(rows, fields, scale, delta=("lon",), strings=("iso3",)))
    write_json(OUT / "attractions.json", indicator_file("attractions", "", [2026], {}))
    write_json(OUT / "manifest.json", {
        "topic": "attractions", "generatedAt": now_iso(),
        "sources": ["Wikidata (CC0)", "文化部 博物館開放資料（政府資料開放授權條款第 1 版）", MOC_URL],
        "handAdded": {q: {"role": r, "source": src} for q, (r, src) in TAIWAN_ROLES.items()},
        "counts": {"museums": len(museums), "zoos": len(zoos), "parks": len(parks)},
    })
    print(f"  博物館 {len(museums):,}、動物園與水族館 {len(zoos):,}、樂園與雲霄飛車 {len(parks):,}；不收 {dropped}")
    print(f"  台灣：文化部 {matched} 館對到 Wikidata、補上 {added} 館；手工補動物園與水族館的類別 {len(TAIWAN_ROLES)} 處")


if __name__ == "__main__":
    build()
