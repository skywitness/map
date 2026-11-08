"""迪士尼（新主題，2026-11-08，製作手冊第二十八批 673，候選 1478、1484、1492；旅遊・樂園；步驟 disney，輸出 topics/disney/）。

- 據點：手工白名單 `pipeline/data/disney/places.csv`（README 寫了欄位與為什麼不用名稱比對），24 筆：6 個度假區、12 座營運中的
  主題樂園、2 座營運中的水上樂園、3 處已關閉、1 座已宣布（阿布達比）。
- Wikidata（經 QLever，CC0）：座標 P625、開幕 P571（只拿來對照 CSV 的開幕年）、面積 P2046 加單位。
  **面積的單位是混的而且有錯**（W1 第二節 1478 的陷阱 5）：有平方公尺、平方公里、英畝；東京迪士尼樂園 Q843997 寫
  510,000「平方公里」（實際是平方公尺）。這裡讀 `wikibase:quantityUnit` 換成平方公里，樂園大於 50、度假區大於 200 平方公里的
  當成把平方公尺寫成平方公里、除以一百萬，並在 note 寫明。
- 國家：依座標（geoindex）。香港的 P17 在 Wikidata 寫中華人民共和國，用座標才會歸香港。
- 人次：景點地圖的 `attractions/park-visitors.json`（英文維基「List of amusement park rankings」，數字原本來自 TEA／AECOM，
  使用者 2026-10-30 決定走維基轉引），依座標配對 1.5 公里內的樂園；12 座主題樂園都有。
- 指標：各國營運中的迪士尼主題樂園數，時間軸 1955–2026 依開幕年累計（候選 1492 的擴張時間軸）；沒有迪士尼樂園的國家
  noValue 寫最近的一座與距離（國家的標籤點，reads.label_points）。台灣另寫原因（OSM 全台 0 個迪士尼物件）。
"""
from __future__ import annotations

import csv
import math
from collections import Counter, defaultdict

import geoindex
from common import OUT_DIR, ROOT, indicator_file, load_points_json, points_file, read_points_file, write_json
from sources import qlever_wikidata as wd
from topics.park_ownership import DISNEY as OWNERSHIP

OUT = OUT_DIR / "topics" / "disney"
CSV = ROOT / "pipeline" / "data" / "disney" / "places.csv"
FIRST, LAST = 1955, 2026
KINDS = {"park": 1, "water": 2, "resort": 3, "other": 4}
STATUS = {"open": 1, "closed": 2, "planned": 3}
RESORTS = ["wdw", "dlr", "tdr", "dlp", "hkdr", "shdr", "adr"]  # 前端 disney.ts 的 RESORTS 同樣的順序（代碼是索引 + 1）
RESORT_ZH = {"wdw": "華特迪士尼世界", "dlr": "加州迪士尼樂園度假區", "tdr": "東京迪士尼度假區", "dlp": "巴黎迪士尼樂園度假區",
             "hkdr": "香港迪士尼樂園度假區", "shdr": "上海迪士尼度假區", "adr": "阿布達比"}
UNIT_KM2 = {"Q712226": 1.0, "Q25343": 1e-6, "Q81292": 0.00404686, "Q35852": 0.01}
FIELDS = ["lon", "lat", "qid", "en", "zh", "iso3", "kind", "resort", "status", "y", "yc", "area", "v2019", "v2024", "note", "own", "share", "ownnote"]
SCALE = {"lon": 0.0001, "lat": 0.0001, "kind": 1, "resort": 1, "status": 1, "y": 1, "yc": 1, "area": 0.001, "v2019": 1, "v2024": 1, "own": 1, "share": 1}


def read_places() -> list[dict]:
    with open(CSV, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        if r["kind"] not in KINDS or r["status"] not in STATUS or r["resort"] not in RESORTS:
            raise ValueError(f"places.csv 的 {r['qid']} 欄位不對：{r}")
        if r["status"] != "planned" and not r["opened"]:
            raise ValueError(f"{r['qid']} 不是已宣布，卻沒有開幕年")
        if not r["source"].startswith("https://"):
            raise ValueError(f"{r['qid']} 沒有出處")
    return rows


def wikidata(qids: list[str]) -> dict[str, dict]:
    values = " ".join(f"wd:{q}" for q in qids)
    # bindings() 只有在查詢不是 PREFIX 開頭時才補上預設的 PREFIX，所以多一個 psv: 時要自己接在預設的後面
    rows = wd.cached("disney-places", wd.PREFIXES + """PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
SELECT ?item ?label ?coord ?inception ?area ?unit WHERE {
  VALUES ?item { %s }
  OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "en") }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P571 ?inception }
  OPTIONAL { ?item p:P2046/psv:P2046 ?av . ?av wikibase:quantityAmount ?area ; wikibase:quantityUnit ?unit }
}""" % values)
    out: dict[str, dict] = defaultdict(dict)
    for r in rows:
        q = r["item"]["value"].rsplit("/", 1)[1]
        o = out[q]
        if "label" in r:
            o.setdefault("en", r["label"]["value"])
        if "coord" in r and "lon" not in o:
            # QLever 回 "POINT(lon lat)"（大寫），Wikidata Query Service 回 "Point(lon lat)"
            lon, lat = r["coord"]["value"].split("(", 1)[1].rstrip(")").split()
            o["lon"], o["lat"] = float(lon), float(lat)
        if "inception" in r:
            o.setdefault("inception", int(r["inception"]["value"][:4]))
        if "area" in r and "area" not in o:
            o["area"] = (float(r["area"]["value"]), r["unit"]["value"].rsplit("/", 1)[1])
    return out


def _km(a: tuple[float, float], b: tuple[float, float]) -> float:
    (lon1, lat1), (lon2, lat2) = a, b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(d))


def visitors() -> list[dict]:
    pts = read_points_file(load_points_json(OUT_DIR / "topics" / "attractions" / "park-visitors.json"))
    for p in pts:
        p["lon"], p["lat"] = float(p["lon"]), float(p["lat"])
    return pts


def build() -> None:
    places = read_places()
    meta = wikidata([p["qid"] for p in places])
    tea = visitors()
    rows = []
    for p in places:
        m = meta.get(p["qid"], {})
        if "lon" not in m:
            raise ValueError(f"{p['qid']} 在 Wikidata 沒有座標")
        note = p["note"]
        area = None
        if "area" in m:
            value, unit = m["area"]
            if unit not in UNIT_KM2:
                raise ValueError(f"{p['qid']} 的面積單位沒見過：{unit}")
            area = value * UNIT_KM2[unit]
            limit = 200 if p["kind"] == "resort" else 50
            if area > limit and unit == "Q712226":
                area = value * 1e-6
                note = "；".join(filter(None, [note, f"Wikidata 的面積寫 {value:,.0f} 平方公里，實際應是平方公尺，這裡換算"]))
        if m.get("inception") and p["opened"] and m["inception"] != int(p["opened"]):
            print(f"    {p['qid']}：Wikidata 的 P571 是 {m['inception']}，CSV 寫 {p['opened']}（照 CSV）")
        v2019 = v2024 = None
        if p["kind"] == "park" and p["status"] == "open":
            near = min(tea, key=lambda t: _km((t["lon"], t["lat"]), (m["lon"], m["lat"])))
            if _km((near["lon"], near["lat"]), (m["lon"], m["lat"])) > 1.5:
                raise ValueError(f"{p['qid']} {m.get('en')} 在人次檔裡找不到（最近的是 {near['en']}）")
            v2019, v2024 = near.get("v2019"), near.get("v2024")
        rows.append({
            "lon": m["lon"], "lat": m["lat"], "qid": p["qid"], "en": m.get("en", p["qid"]), "zh": p["name_zh"] or None,
            "kind": KINDS[p["kind"]], "resort": RESORTS.index(p["resort"]) + 1, "status": STATUS[p["status"]],
            "y": int(p["opened"]) if p["opened"] else None, "yc": int(p["closed"]) if p["closed"] else None,
            "area": round(area, 3) if area else None, "v2019": v2019, "v2024": v2024, "note": note or None,
            # 四種所有權關係（第二十八批 684，topics/park_ownership.py）
            "own": OWNERSHIP[p["resort"]][0], "share": OWNERSHIP[p["resort"]][1], "ownnote": OWNERSHIP[p["resort"]][2],
        })
    iso = geoindex.countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])
    for r, c in zip(rows, iso):
        r["iso3"] = c
    rows.sort(key=lambda r: (-(r["v2024"] or 0), r["y"] or 9999))
    OUT.mkdir(parents=True, exist_ok=True)
    # places.json 全部（清單用）；地圖上分三層：度假區（大的空心圈）、樂園與其他（跟時間軸，已關閉的在關閉那年消失）、
    # 已宣布（沒有開幕年，時間篩選會排除沒有年份的點，所以另一個檔、一直畫）
    write_json(OUT / "places.json", points_file(rows, FIELDS, SCALE))
    write_json(OUT / "resorts.json", points_file([r for r in rows if r["kind"] == KINDS["resort"]], FIELDS, SCALE))
    write_json(OUT / "sites.json", points_file(
        [r for r in rows if r["kind"] != KINDS["resort"] and r["status"] != STATUS["planned"]], FIELDS, SCALE))
    write_json(OUT / "planned.json", points_file([r for r in rows if r["status"] == STATUS["planned"]], FIELDS, SCALE))

    # 各國營運中的主題樂園數，依開幕年累計
    parks = [r for r in rows if r["kind"] == KINDS["park"] and r["status"] == STATUS["open"]]
    years = list(range(FIRST, LAST + 1))
    values = {}
    for c in sorted({r["iso3"] for r in parks}):
        mine = [r for r in parks if r["iso3"] == c]
        values[c] = [sum(1 for r in mine if r["y"] <= y) or None for y in years]
    hints, hints_en = {}, {}
    for c in values:
        by_resort = Counter(r["resort"] for r in parks if r["iso3"] == c)
        hints[c] = "、".join(f"{RESORT_ZH[RESORTS[k - 1]]} {n} 座" for k, n in by_resort.most_common())
        hints_en[c] = ", ".join(f"{n} at {RESORTS[k - 1].upper()}" for k, n in by_resort.most_common())

    # 沒有迪士尼樂園的國家：最近的一座（國家的標籤點到樂園）
    from topics.reads import label_points

    no_value, no_value_en = {}, {}
    for c, (lon, lat) in label_points().items():
        if c in values:
            continue
        near = min(parks, key=lambda r: _km((r["lon"], r["lat"]), (lon, lat)))
        km = round(_km((near["lon"], near["lat"]), (lon, lat)), -2)
        no_value[c] = f"沒有迪士尼的樂園；最近的是{near['zh'] or near['en']}（約 {km:,.0f} 公里）"
        no_value_en[c] = f"No Disney park; the nearest is {near['en']} (about {km:,.0f} km)"
    no_value["TWN"] = "台灣沒有迪士尼的樂園，OpenStreetMap 上也沒有任何迪士尼的據點；最近的是香港迪士尼樂園（2005 年開幕）與上海迪士尼樂園（2016 年）"
    no_value_en["TWN"] = "Taiwan has no Disney park, and OpenStreetMap has no Disney sites there; the nearest are Hong Kong Disneyland (2005) and Shanghai Disneyland (2016)"
    no_value["ARE"] = "阿布達比迪士尼樂園已宣布，還沒有開幕年"
    no_value_en["ARE"] = "Disneyland Abu Dhabi has been announced, with no opening year yet"
    write_json(OUT / "parks.json", indicator_file(
        "parks", "座", years, values, hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en,
        license="Wikidata（CC0）；開幕年依英文維基 Disney Experiences（CC BY-SA 4.0）"))

    print(f"  迪士尼：{len(rows)} 筆據點，營運中的主題樂園 {len(parks)} 座（{dict(Counter(r['iso3'] for r in parks))}）；"
          f"有面積 {sum(1 for r in rows if r['area'])}、有人次 {sum(1 for r in rows if r['v2024'])}")
    for r in rows:
        if r["area"]:
            print(f"    面積 {r['en']}：{r['area']} 平方公里{'（換算過）' if r['note'] and '換算' in r['note'] else ''}")
