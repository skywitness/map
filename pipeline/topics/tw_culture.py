"""博物館與美術館的台灣層：古蹟、文化景觀、博物館、工藝之家（2026-11-08，製作手冊第二十七批 640，候選 1425；
步驟 tw-culture，輸出 topics/museums/）。

- 資料：文化部「查詢單一類別文化設施資料」（data.gov.tw 10046）與地方文化館（6244），政府資料開放授權條款第 1 版。
  cloud.culture.tw 的 robots.txt 不准程式抓，**使用者 2026-11-08 用瀏覽器存檔**，放在 skywitness/map-plan 的
  `data/moc/`（README 寫了每個檔的 SHA-256 與欄位）；重跑前把要用的檔複製到 `.cache/moc/`，這裡核對 SHA-256。
- 畫的類別：文化資產（mainType 1，幾乎都是古蹟，依國定／直轄市定／縣市定分色）、文化景觀（5）、博物館（17，文化部名錄）、
  工藝之家（2）。**工藝之家的名稱多半是工藝家本人的姓名，不輸出名稱**，只寫「工藝之家」與縣市。
  不畫：社區（4，不是景點）、特色圖書館（20，使用者決定圖書館不做）、文化行政據點（18，文化局）、公共藝術（8，順序 645）；
  地方文化館（3／typeId=C）260 館與展演空間（10）44 筆幾乎都沒有經緯度，只算各縣市的館數。
- 經緯度：對調的（經度落在 21–27、緯度落在 118–123）換回來；不在台灣範圍（經度 118–123、緯度 21–27）的不畫。
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter

from common import CACHE_DIR, OUT_DIR, points_file, write_json, write_points

OUT = OUT_DIR / "topics" / "museums"
SRC = CACHE_DIR / "moc"
FILES = {
    "culture-facilities-main-01.json": "7b66e9743dc66f7751330ccd816251f4b7fc9aa54897d3d1a2502b704ec001b5",
    "culture-facilities-main-02.json": "908645e0785f35be80cefd3e1248dbcbac59097259b982b19b07ec3aab040370",
    "culture-facilities-main-05.json": "8a225071aa4ea0657b949d581b65b96008331189b8f31a4b087a9e73e393f766",
    "culture-facilities-main-10.json": "37e7341d4cf3bbb8c02cb78ca3c6bda97c3e4a0c48d648dedf3c0f2c04dfedb7",
    "culture-facilities-main-17.json": "c4d1474b2b211f99d35685e3c022b270f93554368c2fd21b0f87644577fab2c8",
    "local-culture-museums.json": "2781c58d209d7c8e1d1f53189e33bf89bdfc8fad7d66683bb3b6b8bdd70fed46",
}
# 類別代碼（前端 TW_KINDS 的順序）
LEVEL = {"國定古蹟": 1, "直轄市定古蹟": 2, "縣(市)定古蹟": 3}


def load(name: str) -> list[dict]:
    path = SRC / name
    if not path.exists():
        raise RuntimeError(f"沒有 {path}：請把 map-plan 的 data/moc/{name} 複製到這裡")
    if hashlib.sha256(path.read_bytes()).hexdigest() != FILES[name]:
        raise RuntimeError(f"{path} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改")
    return json.loads(path.read_text(encoding="utf-8"))


def county(r: dict) -> str:
    c = re.split(r"\s+", (r.get("cityName") or "").strip())[0]
    if not c:
        m = re.match(r"\s*(\S{2}[縣市])", r.get("address") or "")
        c = m.group(1) if m else ""
    return c.replace("台", "臺")


def coord(r: dict) -> tuple[float, float] | None:
    try:
        lon, lat = float(r.get("longitude") or ""), float(r.get("latitude") or "")
    except ValueError:
        return None
    if 21 <= lon <= 27 and 118 <= lat <= 123:
        lon, lat = lat, lon
    if 118 <= lon <= 123 and 21 <= lat <= 27:
        return lon, lat
    return None


def build() -> None:
    rows, skipped = [], Counter()
    for name, kind_of in (("culture-facilities-main-01.json", lambda r: LEVEL.get((r.get("level") or "").strip(), 3)),
                          ("culture-facilities-main-05.json", lambda r: 4),
                          ("culture-facilities-main-17.json", lambda r: 5),
                          ("culture-facilities-main-02.json", lambda r: 6)):
        for r in load(name):
            c = coord(r)
            if not c:
                skipped[name] += 1
                continue
            k = kind_of(r)
            rows.append({"lon": round(c[0], 5), "lat": round(c[1], 5), "k": k,
                         # 工藝之家的名稱是工藝家本人的姓名：不輸出
                         "name": None if k == 6 else (r.get("name") or "").strip() or None,
                         "sub": (r.get("type") or "").strip() or None if k == 5 else None,
                         "county": county(r)})
    rows.sort(key=lambda r: (r["k"], r["lon"]))
    write_points(OUT / "taiwan-culture.json", points_file(rows, ["lon", "lat", "k", "name", "sub", "county"],
                                                          {"lon": 0.00001, "lat": 0.00001, "k": 1}, strings=("sub", "county")), ("name",))
    local = load("local-culture-museums.json")
    stage = load("culture-facilities-main-10.json")
    counties = Counter(county(r) for r in local)
    write_json(OUT / "taiwan-culture-counties.json", {
        "local": dict(sorted(counties.items(), key=lambda kv: -kv[1])),
        "total": {"local": len(local), "stage": len(stage)},
        "license": "政府資料開放授權條款第 1 版（文化部，data.gov.tw 10046、6244）",
    })
    by = Counter(r["k"] for r in rows)
    print(f"  台灣的文化設施：畫出 {len(rows):,} 處 {dict(sorted(by.items()))}；沒有座標或不在台灣的 {dict(skipped)}")
    print(f"    古蹟依縣市：{Counter(r['county'] for r in rows if r['k'] <= 3).most_common(6)}")
    print(f"    地方文化館 {len(local)} 館（沒有座標），依縣市：{counties.most_common(8)}；展演空間 {len(stage)} 筆（臺中市）")
