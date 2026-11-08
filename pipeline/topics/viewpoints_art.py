"""景點地圖的擴充：觀景點、公共藝術（2026-11-08，製作手冊第二十七批 645，候選 1413、1414；步驟 viewpoints-art，
輸出 topics/attractions/；使用者 2026-11-07 決定留在景點地圖）。

- **觀景點、公共藝術（世界）**：OpenStreetMap `tourism=viewpoint`、`tourism=artwork` 經 QLever（ODbL 1.0）各國的處數；
  觀景點用每千平方公里（陸地面積：FAOSTAT，同第 438 點的獵人高台），公共藝術用每百萬人；都只替 OSM 覆蓋良好的國家上色。
  點太多（26 萬、37 萬），照手冊在 QLever 端依代表點分成 0.1° 的網格計數（topics/osm_density.py 的 grid）。
- **台灣的公共藝術**：文化部「查詢單一類別文化設施資料」mainType=8（data.gov.tw 10046，政府資料開放授權條款第 1 版）
  6,337 件，cloud.culture.tw 的 robots.txt 不准程式抓，**使用者 2026-11-08 用瀏覽器存檔**（skywitness/map-plan 的
  `data/moc/culture-facilities-main-08.json`，重跑前複製到 `.cache/moc/`，這裡核對 SHA-256）。只用有經緯度、在台灣範圍內的；
  **作者是個人姓名，不輸出**；照片不轉載。很多件共用一個點（同一棟館舍），前端畫時錯開。
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import osm_qlever
from topics.osm_density import area_density, density, grid, write_grid

OUT = OUT_DIR / "topics" / "attractions"
YEAR = 2026
ART = CACHE_DIR / "moc" / "culture-facilities-main-08.json"
ART_SHA = "a9cf072ba1757bf680162d7b96d966bfddbf77a20e1ddd4658a0dc17d7f82527"


def _viewpoints() -> None:
    n = osm_qlever.counts("tourism", "viewpoint")
    area_density(OUT, "viewpoints", n, "處/千平方公里", 1000, hints=("觀景點", "viewpoints"))
    write_grid(OUT, "viewpoints-grid", grid("tourism", ("viewpoint",), "觀景點"))


def _taiwan_art() -> None:
    if not ART.exists():
        raise RuntimeError(f"沒有 {ART}：請把 map-plan 的 data/moc/culture-facilities-main-08.json 複製到這裡")
    if hashlib.sha256(ART.read_bytes()).hexdigest() != ART_SHA:
        raise RuntimeError(f"{ART} 的 SHA-256 跟 map-plan 的 README 不一樣，先看過再改")
    rows, skipped = [], 0
    for r in json.loads(ART.read_text(encoding="utf-8")):
        try:
            lon, lat = float(r.get("longitude") or ""), float(r.get("latitude") or "")
        except ValueError:
            skipped += 1
            continue
        if not (118 <= lon <= 123 and 21 <= lat <= 27):
            skipped += 1
            continue
        y = int(r["buildingCreateWestYear"]) if re.fullmatch(r"\d{4}", str(r.get("buildingCreateWestYear") or "")) else None
        county = re.split(r"\s+", (r.get("cityName") or "").strip())[0].replace("台", "臺") or None
        rows.append({"lon": round(lon, 5), "lat": round(lat, 5), "y": y, "name": (r.get("name") or "").strip() or None,
                     "mat": (r.get("material") or "").strip()[:30] or None, "county": county})
    # 同一個點的作品排成小圈（一棟館舍上百件）
    at: dict[tuple[float, float], list[dict]] = defaultdict(list)
    for r in rows:
        at[(r["lon"], r["lat"])].append(r)
    import math
    for (lon, lat), group in at.items():
        if len(group) < 2:
            continue
        rad = min(0.0008 + 0.00004 * len(group), 0.006)
        for i, r in enumerate(group):
            a = 2 * math.pi * i / len(group)
            r["lon"] = round(lon + rad * math.cos(a) / math.cos(math.radians(lat)), 5)
            r["lat"] = round(lat + rad * math.sin(a), 5)
    rows.sort(key=lambda r: (r["y"] or 9999))
    write_points(OUT / "taiwan-public-art.json", points_file(rows, ["lon", "lat", "y", "name", "mat", "county"],
                                                             {"lon": 0.00001, "lat": 0.00001, "y": 1}, strings=("county",)), ("name", "mat"))
    years = [r["y"] for r in rows if r["y"]]
    write_json(OUT / "public-art-years.json", indicator_file("public-art-years", "件", list(range(min(years), YEAR + 1)), {},
                                                             license="政府資料開放授權條款第 1 版"))
    dec = Counter(y // 10 * 10 for y in years)
    print(f"  台灣的公共藝術（文化部）：畫出 {len(rows):,} 件、沒有座標或不在台灣 {skipped}；設置年 {min(years)}–{max(years)}："
          + "、".join(f"{d}s {c:,}" for d, c in sorted(dec.items())))
    print(f"    縣市：{Counter(r['county'] for r in rows).most_common(8)}")


def build() -> None:
    _taiwan_art()
    _viewpoints()
    density(OUT, "tourism", "artwork", "artworks-osm", "件/百萬人", 1e6, "公共藝術（OSM）")
    write_grid(OUT, "artworks-grid", grid("tourism", ("artwork",), "公共藝術"))
