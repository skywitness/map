"""景點地圖：遊客中心與旅遊資訊站（2026-11-08，製作手冊第二十七批 672，候選 1475；步驟 visitor-centres，輸出 topics/attractions/）。

- OpenStreetMap（ODbL 1.0）經 QLever 的 `information=office`（有人服務的旅遊辦事處；不用 `tourism=information`：
  一百五十萬筆多半是解說牌），分國計數、每百萬人（只替 OSM 覆蓋良好的國家上色）與每一處的點（k=1）。
- 台灣另畫交通部觀光署「旅遊服務站點（借問站及旅遊服務中心）」（data.gov.tw 44055，政府資料開放授權條款第 1 版）797 處，
  名稱有「遊客中心」「服務中心」「服務站」「旅服」的算遊客中心（k=2），其餘多半是借問站（店家代為提供諮詢，k=3）；
  官方的分類代碼沒有說明，所以不用。跟 OSM 的不是同一個東西，不相加、分開上色。不輸出電話。
- 候選 1476（觀景台）就是順序 645 已經做的 `tourism=viewpoint`（景點地圖的觀景點），不重做。
"""
from __future__ import annotations

import json
import re
import zipfile

from common import OUT_DIR, download, points_file, write_points
from sources import osm_qlever
from topics.osm_density import density

OUT = OUT_DIR / "topics" / "attractions"
TW_URL = "https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/TourismServiceSite-json.zip"
CENTRE = re.compile(r"遊客中心|服務中心|服務站|旅服|遊客服務")


def build() -> None:
    n = density(OUT, "information", "office", "info-offices", "處/百萬人", 1e6, "遊客中心與旅遊辦事處")
    rows, seen = [], set()
    for r in osm_qlever.features("information", "office", ("name", "name:zh", "name:en")):
        if r["osm"] in seen or not r["iso3"]:
            continue
        c = osm_qlever.centroid(r["wkt"])
        if not c:
            continue
        seen.add(r["osm"])
        rows.append({"lon": round(c[0], 4), "lat": round(c[1], 4), "k": 1, "iso3": r["iso3"], "n": r["name"] or None,
                     "nz": r["name:zh"] or None, "ne": r["name:en"] or None, "t": None})
    path = download(TW_URL, "motc", "TourismServiceSite-json.zip")
    sites = json.loads(zipfile.ZipFile(path).read("TourismServiceSiteList.json").decode("utf-8-sig"))["TourismServiceSites"]
    tw = 0
    for s in sites:
        if s.get("ServiceStatus") != 1 or not s.get("PositionLat") or not s.get("PositionLon"):
            continue
        name = s["TourismServiceSiteName"].strip()
        addr = s.get("PostalAddress") or {}
        rows.append({"lon": round(s["PositionLon"], 5), "lat": round(s["PositionLat"], 5), "k": 2 if CENTRE.search(name) else 3, "iso3": "TWN",
                     "n": name, "nz": None, "ne": None, "t": f"{addr.get('City') or ''}{addr.get('Town') or ''}" or None})
        tw += 1
    rows.sort(key=lambda p: (p["k"], p["iso3"], p["lon"]))
    write_points(OUT / "info-offices-points.json", points_file(rows, ["lon", "lat", "k", "iso3", "n", "nz", "ne", "t"],
                                                               {"lon": 0.00001, "lat": 0.00001, "k": 1}, strings=("iso3",)), ("n", "nz", "ne", "t"))
    print(f"    點：OSM {len(seen):,}（台灣 {sum(1 for r in rows if r['k'] == 1 and r['iso3'] == 'TWN')}）；觀光署 {tw}（遊客中心 "
          f"{sum(1 for r in rows if r['k'] == 2)}、其他 {sum(1 for r in rows if r['k'] == 3)}）；OSM 計數台灣 {n.get('TWN')}")
