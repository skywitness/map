"""南極研究站（新主題，地理類，2026-10-29）：Wikidata 收錄的南極研究站（Q749622 與子類別）的點，與各國經營、運作中的站數。

**資料**（使用者 2026-10-29 決定：Wikidata 為主，COMNAP 只拿來核對）：Wikidata（CC0）的座標、成立與關閉年份、經營者、
海拔、名稱。COMNAP Antarctic Facilities（2024 年 11 月版）只能用於教育與非商業用途，這裡只拿來核對涵蓋率（印出對到幾處、
Wikidata 少了哪些），前端的說明只引用它的總數，不轉載內容。

**經營國**：依序取經營者（P137；經營者本身是國家，或經營者的國家 P17；兩國合營的兩國都算）、項目的國家（P17，「南極洲」不算）、
英文說明裡的國名（例如「antarctic base in Argentina」「former British research station」）；都沒有的是「不詳」，不算進國家的站數。
蘇聯的站算俄羅斯（繼承國），說明寫明。
**狀態**（三類）：有關閉日期（P576、P3999），或英文說明寫 former、abandoned、historic 的是「已關閉」；其他的跟 COMNAP
2024 的名單核對：名單上每一處設施對到 MATCH_KM 公里內最近的一個 Wikidata 站，對到的是「運作中」，沒對到的是「不在 COMNAP
名單」（Wikidata 常沒標關閉，多半是已關閉的歷史站或臨時營地）。國家的站數只算運作中的。只用核對的結果（對不對得到），
不轉載 COMNAP 的名稱、人數這類內容。

**輸出**（public/data/topics/antarctic-stations/）：stations.json（點）、operating.json（各國運作中的站數）。
"""
from __future__ import annotations

import csv
import io
import json
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from common import CACHE_DIR, OUT_DIR, USER_AGENT, download, indicator_file, now_iso, points_file, write_json

OUT = OUT_DIR / "topics" / "antarctic-stations"
SPARQL = "https://query.wikidata.org/sparql"
COMNAP_URL = "https://www.comnap.aq/s/Facilities_Nov2024.csv"
YEAR = 2026
# 南緯 50 度以南（含南喬治亞、布韋島這類亞南極島嶼）；北極的站（例如英國在斯瓦巴的站）不收
MAX_LAT = -50
# Wikidata 的國家 → ISO3：蘇聯（Q15180）算俄羅斯
EXTRA_ISO = {"Q15180": "RUS"}
QUERY = """SELECT ?item ?coord ?inc ?end ?p17 ?p17iso ?op ?opiso ?opciso ?elev ?sl ?en ?mul ?zhtw ?zhhant ?zh ?desc WHERE {
  ?item wdt:P31/wdt:P279* wd:Q749622 .
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P571 ?inc }
  OPTIONAL { ?item wdt:P576|wdt:P3999 ?end }
  OPTIONAL { ?item wdt:P17 ?p17 . OPTIONAL { ?p17 wdt:P298 ?p17iso } }
  OPTIONAL { ?item wdt:P137 ?op . OPTIONAL { ?op wdt:P298 ?opiso } OPTIONAL { ?op wdt:P17 ?opc . ?opc wdt:P298 ?opciso } }
  OPTIONAL { ?item wdt:P2044 ?elev }
  ?item wikibase:sitelinks ?sl .
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
  OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc) = "en") }
}"""
# Wikidata 沒寫經營者、國家與說明的運作中站（手工補，依英文維基百科條目）
HAND_COUNTRY = {"Q3935486": "BRA"}  # 埃米利奧‧戈爾迪避難所：巴西南極計畫的避難所（Refuge Emílio Goeldi）
# 英文說明裡的國名 → ISO3（只在經營者與 P17 都沒有時用）
DESC_COUNTRY = [
    (r"argentin", "ARG"), (r"chile", "CHL"), (r"brazil", "BRA"), (r"british|united kingdom", "GBR"),
    (r"soviet|russia", "RUS"), (r"german", "DEU"), (r"french|france", "FRA"), (r"norw", "NOR"),
    (r"united states|american", "USA"), (r"south africa", "ZAF"), (r"belarus", "BLR"), (r"australia", "AUS"),
    (r"new zealand", "NZL"), (r"japan", "JPN"), (r"chinese|china", "CHN"), (r"india", "IND"), (r"korea", "KOR"),
    (r"polish|poland", "POL"), (r"ital", "ITA"), (r"spanish|spain", "ESP"), (r"uruguay", "URY"), (r"bulgaria", "BGR"),
    (r"ukrain", "UKR"), (r"czech", "CZE"), (r"peru", "PER"), (r"ecuador", "ECU"), (r"finn|finland", "FIN"),
    (r"swed", "SWE"), (r"dutch|netherlands", "NLD"), (r"belgi", "BEL"), (r"pakistan", "PAK"), (r"turk", "TUR"),
]
CLOSED_DESC = re.compile(r"\b(former|abandoned|historic|disused)\b|\(\d{4}\s*[-–]\s*\d{2,4}\)", re.I)
# COMNAP 的經營國名稱 → ISO3（只用來核對）
COMNAP_ISO = {
    "Argentina": "ARG", "Australia": "AUS", "Belarus": "BLR", "Belgium": "BEL", "Brazil": "BRA", "Bulgaria": "BGR",
    "Chile": "CHL", "China": "CHN", "Czechia": "CZE", "Czech Republic": "CZE", "Ecuador": "ECU", "Finland": "FIN",
    "France": "FRA", "Germany": "DEU", "India": "IND", "Italy": "ITA", "Japan": "JPN", "Korea, Republic of": "KOR",
    "Republic of Korea": "KOR", "Korea": "KOR", "Netherlands": "NLD", "New Zealand": "NZL", "Norway": "NOR", "Pakistan": "PAK",
    "Peru": "PER", "Poland": "POL", "Russia": "RUS", "Russian Federation": "RUS", "South Africa": "ZAF", "Spain": "ESP",
    "Sweden": "SWE", "Türkiye": "TUR", "Turkey": "TUR", "Ukraine": "UKR", "United Kingdom": "GBR", "United States": "USA",
    "USA": "USA", "UK": "GBR", "Uruguay": "URY",
}
MATCH_KM = 15


def km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(math.radians(b[0] - a[0]) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def fetch() -> list[dict]:
    path = CACHE_DIR / "wikidata" / "antarctic-stations.json"
    if not path.exists():
        req = urllib.request.Request(SPARQL, data=urllib.parse.urlencode({"query": QUERY}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(6):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(r.read())
                break
            except urllib.error.HTTPError as err:
                if err.code not in (429, 500, 502, 503, 504):
                    raise
                time.sleep(15 * (attempt + 1))
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def year(v: str) -> int | None:
    m = re.match(r"(-?\d{4})", v)
    return int(m.group(1)) if m else None


def stations() -> dict[str, dict]:
    from opencc import OpenCC

    s2tw, s2twp = OpenCC("s2tw"), OpenCC("s2twp")
    out: dict[str, dict] = {}
    for r in fetch():
        q = r["item"]["value"].rsplit("/", 1)[1]
        d = out.setdefault(q, {"q": q, "coord": None, "inc": set(), "end": set(), "op": set(), "p17": set(), "elev": None,
                               "sl": int(r["sl"]["value"])})
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        if v("coord") and v("coord").startswith("Point("):
            lon, lat = v("coord")[6:-1].split()
            d["coord"] = (float(lon), float(lat))
        if v("inc") and year(v("inc")):
            d["inc"].add(year(v("inc")))
        if v("end"):
            d["end"].add(year(v("end")) or 0)
        for key, iso_keys in (("op", ("opiso", "opciso")), ("p17", ("p17iso",))):
            src = v(key)
            if not src:
                continue
            qid = src.rsplit("/", 1)[1]
            iso = next((v(k) for k in iso_keys if v(k)), None) or EXTRA_ISO.get(qid)
            if iso:
                d[key].add(iso)
        if v("elev") and d["elev"] is None:
            d["elev"] = round(float(v("elev")))
        for k in ("en", "mul", "zhtw", "zhhant", "zh", "desc"):
            if v(k) and not d.get(k):
                d[k] = v(k)
    for d in out.values():
        if d.get("zhtw") or d.get("zhhant"):
            d["zhName"] = s2tw.convert(d.get("zhtw") or d.get("zhhant"))
        elif d.get("zh"):
            d["zhName"] = s2twp.convert(d["zh"])
        else:
            d["zhName"] = None
        d["enName"] = d.get("en") or d.get("mul")
    return out


def country(d: dict) -> tuple[list[str], str]:
    """經營國（兩國合營的有兩個，例如法國與義大利的康宏站）與判斷的依據"""
    if d["q"] in HAND_COUNTRY:
        return [HAND_COUNTRY[d["q"]]], "hand"
    if d["op"]:
        return sorted(d["op"]), "operator"
    if len(d["p17"]) == 1:
        return list(d["p17"]), "country"
    desc = (d.get("desc") or "").lower()
    for pattern, iso in DESC_COUNTRY:
        if re.search(pattern, desc):
            return [iso], "description"
    return [], "unknown"


def comnap() -> list[dict]:
    path = download(COMNAP_URL, "comnap", "Facilities_Nov2024.csv")
    rows = list(csv.DictReader(io.StringIO(path.read_bytes().decode("latin-1"))))
    out = []
    for r in rows:
        try:
            out.append({"name": r["English Name"], "iso3": COMNAP_ISO.get(r["Operator (primary)"].strip()),
                        "op": r["Operator (primary)"], "lon": float(r["Longitude (DD)"]), "lat": float(r["Latitude (DD)"]),
                        "status": r["Status"], "seasonality": r["Seasonality"], "type": r["Type"]})
        except ValueError:
            continue
    return out


def build() -> None:
    items = stations()
    rows, how = [], {}
    for d in items.values():
        if not d["coord"] or d["coord"][1] > MAX_LAT:
            continue
        isos, why = country(d)
        how[why] = how.get(why, 0) + 1
        closed = bool(d["end"]) or bool(CLOSED_DESC.search(d.get("desc") or ""))
        if not (d["enName"] or d["zhName"]):
            continue
        rows.append({
            "lon": round(d["coord"][0], 3), "lat": round(d["coord"][1], 3), "s": 2 if closed else 1,
            "y": min(d["inc"]) if d["inc"] else None, "e": max(d["end"]) if d["end"] and max(d["end"]) else None,
            "h": d["elev"], "sl": d["sl"], "iso3": isos[0] if isos else None,
            "iso3b": isos[1] if len(isos) > 1 else None, "en": d["enName"], "zh": d["zhName"] if d["zhName"] != d["enName"] else None,
            "q": d["q"],
        })
    # 跟 COMNAP 核對：名單上每一處設施對到最近的、沒有關閉的 Wikidata 站
    facilities = comnap()
    matched = 0
    for f in facilities:
        near = sorted((km((r["lon"], r["lat"]), (f["lon"], f["lat"])), i) for i, r in enumerate(rows) if r["s"] != 2)
        if near and near[0][0] <= MATCH_KM:
            rows[near[0][1]]["_comnap"] = True
            matched += 1
    for r in rows:
        if r["s"] == 1 and not r.pop("_comnap", False):
            r["s"] = 3
        r.pop("_comnap", None)
    rows.sort(key=lambda r: (r["s"], -r["sl"], r["q"]))

    # 各國運作中的站數
    counts: dict[str, int] = {}
    for r in rows:
        for iso in (r["iso3"], r["iso3b"]) if r["s"] == 1 else ():
            if iso:
                counts[iso] = counts.get(iso, 0) + 1
    values = {iso: [n] for iso, n in sorted(counts.items())}

    by = {k: sum(1 for r in rows if r["s"] == k) for k in (1, 2, 3)}
    print(f"  Wikidata：{len(rows)} 處（運作中 {by[1]}、已關閉 {by[2]}、不在 COMNAP 名單 {by[3]}），經營國的依據 {how}")
    print(f"  運作中、經營國不詳：{[r['en'] for r in rows if r['s'] == 1 and not r['iso3']]}")
    print(f"  各國運作中的站數（前 12）：{sorted(counts.items(), key=lambda x: -x[1])[:12]}，共 {len(counts)} 國")
    print(f"  COMNAP 2024：{len(facilities)} 處，{matched} 處對到 Wikidata 的站（{MATCH_KM} 公里內最近的）")
    comnap_counts: dict[str, int] = {}
    for f in facilities:
        if f["iso3"]:
            comnap_counts[f["iso3"]] = comnap_counts.get(f["iso3"], 0) + 1
    print(f"  COMNAP 各國的設施數（前 12）：{sorted(comnap_counts.items(), key=lambda x: -x[1])[:12]}")

    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "stations.json", points_file(rows, ["lon", "lat", "s", "y", "e", "h", "sl", "iso3", "iso3b", "en", "zh"],
                                                  {"lon": 0.001, "lat": 0.001, "s": 1, "y": 1, "e": 1, "h": 1, "sl": 1}))
    write_json(OUT / "operating.json", indicator_file("operating", "處", [YEAR], values))
    write_json(OUT / "manifest.json", {
        "topic": "antarctic-stations", "generatedAt": now_iso(), "sources": ["Wikidata (CC0)"],
        "check": {"comnap": COMNAP_URL, "facilities": len(facilities), "matched": matched},
    })


if __name__ == "__main__":
    build()
