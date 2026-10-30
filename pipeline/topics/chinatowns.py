"""唐人街（新主題，社會類，製作手冊第六批 113）：世界各地唐人街的點。

- Wikidata（CC0）的唐人街（Q202509，含子類別）：97 處，87 處有座標。沒有國家（P17）的依座標判斷國家（荷蘭的三處）。
- Wikidata 收得少（歐洲、非洲、大洋洲幾乎沒有），依英文維基百科的分區條目（CC BY-SA 4.0）手工補：
  Chinatowns in Europe（revid 1381063693）、Chinatowns in Asia（1371913766）、Chinatowns in Africa、Chinatowns in Oceania、
  Chinatowns in Latin America and the Caribbean（2026-10-30 讀）。只收條目寫明「有唐人街」（或華人商店街、唐人街市場）的地方；
  寫「沒有正式的唐人街」「只是被叫做唐人街」、已經消失、只有計畫的都不收。補的點只用條目裡的地名，座標取那個地名的
  Wikidata 項目（CC0，SUPPLEMENT 寫 QID；沒有街區的項目就用城市的座標，`city: True`）。
- 美國、加拿大的條目列了上百處（多半是歷史上的），Wikidata 已經有 49 處，不另外補。
- 台灣沒有：Wikidata 0 處，維基的亞洲條目開頭寫明不含中國、港澳與台灣。
- 名稱：Wikidata 的繁體中文（zh-tw、zh-hant）或簡體轉繁體，沒有的話用英文；補的點自己寫。
- 形成年份只有 25 處有（P571），不做時間軸。
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, now_iso, points_file, write_json
from geoindex import countries_at

OUT = OUT_DIR / "topics" / "chinatowns"
SPARQL = "https://query.wikidata.org/sparql"
QUERY = """SELECT ?item ?itemLabel ?zh ?zht ?country ?iso ?coord ?inception ?city ?cityLabel ?enwiki WHERE {
  ?item wdt:P31/wdt:P279* wd:Q202509 .
  OPTIONAL { ?item wdt:P17 ?country . ?country wdt:P298 ?iso }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P571 ?inception }
  OPTIONAL { ?item wdt:P131 ?city }
  OPTIONAL { ?item rdfs:label ?zht FILTER(LANG(?zht)="zh-tw") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh)="zh-hant") }
  OPTIONAL { ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}"""
WIKIDATA, WIKIPEDIA = 1, 2  # 點的來源

# 依維基分區條目補的唐人街：(中文名, 英文名, 地名的 Wikidata QID, 經度, 緯度, 只有城市的座標)
SUPPLEMENT: list[tuple[str, str, str, float, float, bool]] = [
    # 歐洲（Chinatowns in Europe）
    ("里昂唐人街（吉約蒂耶爾）", "Lyon Chinatown (Guillotière)", "Q456", 4.835, 45.7675, True),
    ("土魯斯唐人街（貝爾福區）", "Toulouse Chinatown (Belfort)", "Q7880", 1.4433, 43.6044, True),
    ("巴黎美麗城", "Belleville, Paris", "Q815949", 2.3853, 48.8739, False),
    ("漢堡聖保利", "St. Pauli, Hamburg", "Q1556", 9.9639, 53.5569, False),
    ("塞薩羅尼基唐人街（伊索普街）", "Thessaloniki Chinatown (Aisopou Street)", "Q17151", 22.9356, 40.6403, True),
    ("都柏林帕內爾街", "Parnell Street, Dublin", "Q7139322", -6.2617, 53.3525, False),
    ("鹿特丹唐人街（西十字街）", "Rotterdam Chinatown (West-Kruiskade)", "Q34370", 4.48, 51.92, True),
    ("普拉托唐人街", "Prato Chinatown", "Q13377", 11.0966, 43.8808, True),
    ("沃爾卡科索夫斯卡", "Wólka Kosowska", "Q2037806", 20.8422, 52.0572, False),
    ("瓦爾齊埃拉唐人街", "Varziela Chinatown, Vila do Conde", "Q917313", -8.75, 41.35, True),
    ("里斯本馬丁莫尼斯", "Martim Moniz, Lisbon", "Q597", -9.139, 38.708, True),
    ("馬德里烏塞拉", "Usera, Madrid", "Q953368", -3.7069, 40.3813, False),
    ("格拉斯哥唐人街（考卡登斯）", "Glasgow Chinatown (Cowcaddens)", "Q5179620", -4.2596, 55.8682, False),
    # 亞洲（Chinatowns in Asia）
    ("金邊唐人街", "Phnom Penh Chinatown", "Q1850", 104.921, 11.5696, True),
    ("帝力唐人街", "Dili Chinatown", "Q9310", 125.5783, -8.5536, True),
    ("加爾各答唐人街（蒂雷塔市集）", "Kolkata Chinatown (Tiretta Bazaar)", "Q1348", 88.37, 22.5675, True),
    ("加爾各答塔壩", "Tangra, Kolkata", "Q7683137", 88.3833, 22.55, False),
    ("雅加達草埔", "Glodok, Jakarta", "Q430707", 106.813, -6.1453, False),
    ("棉蘭柯薩婉", "Kesawan, Medan", "Q12491371", 98.676, 3.593, False),
    ("永珍唐人街", "Vientiane Chinatown", "Q9326", 102.63, 17.98, True),
    ("曼德勒唐人街", "Mandalay Chinatown", "Q185518", 96.0836, 21.9747, True),
    ("納卯唐人街", "Davao Chinatown", "Q1473", 125.6094, 7.0662, True),
    ("普吉唐人街", "Phuket Chinatown", "Q844430", 98.3975, 7.8881, True),
    # 非洲（Chinatowns in Africa）
    ("奈洛比唐人街（基里馬尼）", "Nairobi Chinatown (Kilimani)", "Q6406937", 36.7867, -1.285, False),
    ("安塔那那利佛唐人街", "Antananarivo Chinatown", "Q3915", 47.525, -18.91, True),
    ("路易港唐人街", "Port Louis Chinatown", "Q3929", 57.4989, -20.1619, True),
    ("溫得和克唐人街", "Windhoek Chinatown", "Q3935", 17.0836, -22.57, True),
    ("拉哥斯唐人街（奧喬塔）", "Lagos China Town (Ojota)", "Q8673", 3.3936, 6.4561, True),
    ("約翰尼斯堡西里爾丁", "Cyrildene, Johannesburg", "Q5200939", 28.101, -26.173, False),
    ("格貝哈唐人街", "Gqeberha (Port Elizabeth) Chinatown", "Q125434", 25.6, -33.9581, True),
    # 大洋洲（Chinatowns in Oceania）
    ("黃金海岸唐人街", "Chinatown, Gold Coast", "Q16258122", 153.413, -27.9691, False),
    ("巴比提唐人街", "Papeete Chinatown", "Q130800", -149.5689, -17.5397, True),
    ("亞加納唐人街", "Hagåtña Chinatown", "Q30988", 144.75, 13.4833, True),
    ("艾沃唐人街", "Aiwo Chinatown", "Q240017", 166.9117, -0.53, True),
    ("努美阿唐人街", "Nouméa Chinatown", "Q9733", 166.45, -22.2667, True),
    ("拉包爾唐人街", "Rabaul Chinatown", "Q218768", 152.1681, -4.1981, True),
    ("莫士比港唐人街", "Port Moresby Chinatown", "Q36526", 147.1494, -9.4789, True),
    ("荷尼阿拉唐人街", "Honiara Chinatown", "Q40921", 159.95, -9.4333, True),
    ("維拉港唐人街", "Port Vila Chinatown", "Q37806", 168.3167, -17.7333, True),
    # 拉丁美洲（Chinatowns in Latin America and the Caribbean）
    ("聖保羅自由區", "Liberdade, São Paulo", "Q192146", -46.6319, -23.5666, False),
    ("聖地牙哥帕特羅納托區", "Barrio Patronato, Santiago", "Q4863743", -70.6444, -33.43, False),
    ("波哥大唐人街（聖維多利諾）", "Bogotá Chinatown (San Victorino)", "Q2841", -74.0818, 4.6097, True),
    ("聖多明哥唐人街", "Santo Domingo Chinatown", "Q34820", -69.9361, 18.4625, True),
    ("開雲唐人街", "Cayenne Chinatown", "Q44401", -52.335, 4.9386, True),
    ("京士頓唐人街", "Kingston Chinatown", "Q34692", -76.7931, 17.9714, True),
    ("巴拿馬市唐人街（聖費利佩）", "Panama City Barrio Chino (San Felipe)", "Q6118671", -79.5333, 8.95, False),
    ("西班牙港唐人街", "Port of Spain Chinatown", "Q39178", -61.5167, 10.6667, True),
    ("卡拉卡斯唐人街（埃爾博斯克）", "Caracas Barrio Chino (El Bosque)", "Q1533", -66.9144, 10.5061, True),
]
# Wikidata 已經有、補的點不要重複：補之前檢查 3 km 內有沒有 Wikidata 的點（同一個城市可以有好幾處，例如巴黎 13 區與美麗城）
NEAR_KM = 3


def fetch() -> list[dict]:
    path = CACHE_DIR / "wikidata" / "chinatowns-raw.json"
    if not path.exists():
        req = urllib.request.Request(SPARQL, data=urllib.parse.urlencode({"query": QUERY}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(10):
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    data = r.read()
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, ConnectionError, TimeoutError) as err:
                wait = 60 * (attempt + 1)  # 查詢服務限流時每分鐘一次
                print(f"    Wikidata：{err}，等 {wait} 秒", flush=True)
                time.sleep(wait)
        else:
            raise RuntimeError("Wikidata 的 SPARQL 一直失敗，稍後再跑")
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def _km(a: tuple[float, float], b: tuple[float, float]) -> float:
    import math

    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    d = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(math.radians(b[0] - a[0]) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(d))


def build() -> None:
    from opencc import OpenCC

    s2tw = OpenCC("s2tw")
    items: dict[str, dict] = {}
    for r in fetch():
        q = r["item"]["value"].rsplit("/", 1)[1]
        d = items.setdefault(q, {"q": q})
        for k in ("itemLabel", "zh", "zht", "iso", "coord", "cityLabel", "inception"):
            if k in r and k not in d:
                d[k] = r[k]["value"]
    rows = []
    for d in items.values():
        if not d.get("coord", "").startswith("Point("):
            continue
        lon, lat = (float(x) for x in d["coord"][6:-1].split())
        en = d["itemLabel"] if d["itemLabel"] != d["q"] else None
        if en == "Chinatown" and d.get("cityLabel"):
            en = f"Chinatown, {d['cityLabel']}"
        zh = d.get("zht") or d.get("zh")
        rows.append({"lon": round(lon, 4), "lat": round(lat, 4), "s": WIKIDATA, "c": 0, "en": en,
                     "zh": s2tw.convert(zh) if zh else None, "q": d["q"]})
    wikidata_points = [(r["lon"], r["lat"]) for r in rows]
    added, near = 0, []
    for zh, en, qid, lon, lat, city in SUPPLEMENT:
        close = [p for p in wikidata_points if _km(p, (lon, lat)) < NEAR_KM]
        if close:
            near.append(en)
            continue
        rows.append({"lon": lon, "lat": lat, "s": WIKIPEDIA, "c": 1 if city else 0, "en": en, "zh": zh, "q": qid})
        added += 1
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3
    rows.sort(key=lambda r: (r["iso3"] or "", r["en"] or ""))
    fields = ["lon", "lat", "s", "c", "iso3", "en", "zh"]
    scale = {"lon": 0.0001, "lat": 0.0001, "s": 1, "c": 1}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "points.json", points_file(rows, fields, scale, strings=("iso3",)))
    counts = Counter(r["iso3"] for r in rows if r["iso3"])
    write_json(OUT / "count.json", indicator_file(
        "count", "處", [2026], {c: [n] for c, n in sorted(counts.items())}, license="CC BY-SA 4.0",
    ))
    write_json(OUT / "manifest.json", {"topic": "chinatowns", "generatedAt": now_iso(),
                                       "sources": ["Wikidata (CC0)", "Wikipedia: Chinatowns in Europe/Asia/Africa/Oceania/Latin America (CC BY-SA 4.0)"]})
    print(f"  唐人街 {len(rows)} 處：Wikidata {len(rows) - added}、依維基補 {added}（{len(near)} 處 3 km 內已有：{near}）")
    print(f"  各國（前 12）：{counts.most_common(12)}；台灣 {counts.get('TWN', 0)}；沒有國家的 {[r['en'] for r in rows if not r['iso3']]}")


if __name__ == "__main__":
    build()
