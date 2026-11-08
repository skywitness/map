"""同一座城市的兩家樂園（2026-11-08，製作手冊第二十八批 686，候選 1538；擴充「樂園」的品牌據點〔順序 632〕，
「迪士尼」與「環球影城」兩個主題各連過來；步驟 park-twin-cities，輸出 topics/theme-parks/）。

- 使用者 2026-11-08：做成 632 的共用指標，不要兩個品牌主題各做一張圖。標題寫「同一座城市的兩家樂園」，**不寫「vs.」「對決」，
  不做總分或排名**，人次（迪士尼高）與恢復率（環球高）兩個都放，顏色用網站的分類色、不用兩家的品牌色。
- 讀兩個品牌主題已經產生的檔（`disney/places.json`、`disney/park-visits.json`、`universal/places.json`、
  `universal/park-visits.json`），不重查。人次只算主題樂園（迪士尼的水上樂園不在維基的單園表裡，環球的也不算，口徑才一樣）。
- 四組：奧蘭多（華特迪士尼世界／環球奧蘭多）、洛杉磯（加州迪士尼樂園度假區／好萊塢環球影城）、日本（東京／大阪，不同城市、
  同一個市場）、中國（上海／北京）。
- 各國的類別：兩家都有、只有迪士尼、只有環球（營運中的樂園）；台灣兩家都沒有。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, load_points_json, points_file, read_points_file, write_json

OUT = OUT_DIR / "topics" / "theme-parks"
DIS = OUT_DIR / "topics" / "disney"
UNI = OUT_DIR / "topics" / "universal"
# (代碼, 迪士尼的度假區代碼〔disney.py 的 RESORTS 索引 + 1〕, 環球的所在地代碼〔universal.py 的 RESORTS 索引 + 1〕)
PAIRS = [("orlando", 1, 2), ("la", 2, 1), ("japan", 3, 3), ("china", 6, 5)]  # 前端 park-twin-cities.ts 的 PAIRS 同樣的順序


def _pts(path):
    return read_points_file(load_points_json(path))


def build() -> None:
    dp = [p for p in _pts(DIS / "places.json") if p["kind"] == 1 and p["status"] == 1]
    up = [p for p in _pts(UNI / "places.json") if p["kind"] == 1 and p["status"] == 1]
    dv = {p["qid"]: p for p in _pts(DIS / "park-visits.json")}
    uv = {p["qid"]: p for p in _pts(UNI / "park-visits.json")}
    rows = []
    for i, (key, dr, ur) in enumerate(PAIRS):
        ds = [p for p in dp if p["resort"] == dr]
        us = [p for p in up if p["resort"] == ur]
        def total(parks, visits, y):
            vals = [visits.get(p["qid"], {}).get(f"v{y}") for p in parks]
            return sum(v for v in vals if v) or None
        rows.append({
            "lon": float(ds[0]["lon"]), "lat": float(ds[0]["lat"]), "pair": i + 1,
            "dn": len(ds), "un": len(us),
            "dv19": total(ds, dv, 2019), "dv24": total(ds, dv, 2024), "uv19": total(us, uv, 2019), "uv24": total(us, uv, 2024),
            "dy": ",".join(str(p["y"]) for p in sorted(ds, key=lambda p: p["y"])),
            "uy": ",".join(str(p["y"]) for p in sorted(us, key=lambda p: p["y"])),
        })
    fields = ["lon", "lat", "pair", "dn", "un", "dv19", "dv24", "uv19", "uv24", "dy", "uy"]
    scale = {"lon": 0.0001, "lat": 0.0001, "pair": 1, "dn": 1, "un": 1, "dv19": 1, "dv24": 1, "uv19": 1, "uv24": 1}
    write_json(OUT / "twin-cities.json", points_file(rows, fields, scale))

    d_iso = {p["iso3"] for p in dp}
    u_iso = {p["iso3"] for p in up}
    values = {c: [1 if c in d_iso and c in u_iso else 2 if c in d_iso else 3] for c in sorted(d_iso | u_iso)}
    no_value = {"TWN": "迪士尼與環球在台灣都沒有樂園", "GBR": "環球的樂園在建（宣布的目標是 2031 年）", "ARE": "迪士尼的樂園已宣布，還沒有開幕年"}
    no_value_en = {"TWN": "Neither Disney nor Universal has a park in Taiwan",
                   "GBR": "A Universal park is under construction (target 2031)", "ARE": "A Disney park has been announced, with no opening year yet"}
    write_json(OUT / "twin-brands.json", indicator_file(
        "twin-brands", "", [2026], values, noValue=no_value, noValueEn=no_value_en,
        license="Wikidata（CC0）；開幕年依英文維基（CC BY-SA 4.0）"))
    print(f"  同一座城市的兩家樂園：{[(PAIRS[r['pair'] - 1][0], r['dn'], r['dv24'], r['un'], r['uv24'], r['dy'], r['uy']) for r in rows]}；"
          f"各國 {values}")
