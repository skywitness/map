"""旅行實用：服務區與休息區（2026-11-05，製作手冊第二十三批 406〔候選 992〕；步驟 travel-rest-areas，輸出 topics/travel/）。

- OpenStreetMap（ODbL 1.0）經 QLever（sources/osm_qlever.py）：`highway=services`（有加油站、餐廳、廁所的服務區）與
  `highway=rest_area`（只有停車位、廁所的路邊休息區）。面與線取所有頂點的平均當代表點。各國標法不同（德國帶加油站的是
  services、只有廁所的是 rest_area；美國的 welcome center 也標 rest_area），而且同一個服務區兩個方向常畫成兩個點，
  點的多寡也在量各國畫得多完整，所以只畫點、不排名。縮小時只畫服務區，休息區在 rest-areas-more.json，放大到 6 級才下載。
  資料檔是 OSM 的衍生資料庫，依 ODbL 提供。
- 台灣（左側欄）：交通部高速公路局「國道服務區簡介一覽表」（data.gov.tw 8161）與「國道服務區停車位設施數量（含座標）統計表」
  （46801），政府資料開放授權條款第 1 版。www.freeway.gov.tw 偶發連線重設，下載重試。停車位依「服務區名稱（方位）」對；
  46801 的座標欄有缺小數點的錯字，不用它的座標，只用格數。
"""
from __future__ import annotations

import csv
import re
import time
import urllib.error

from common import OUT_DIR, download, points_file, write_json, write_layered_points
from sources import osm_qlever

OUT = OUT_DIR / "topics" / "travel"
SERVICES_TW = "https://www.freeway.gov.tw/Download_File_Direct.ashx?id=85&FileConditionsID=1"
PARKING_TW = "https://www.freeway.gov.tw/Download_File_Direct.ashx?id=150&FileConditionsID=1"
KINDS = {"services": 1, "rest_area": 2}


def _get(url: str, name: str) -> str:
    for attempt in range(5):
        try:
            return download(url, "freeway", name).read_text(encoding="utf-8-sig")
        except (urllib.error.URLError, ConnectionError) as e:
            print(f"  高速公路局 {e}，{5 * (attempt + 1)} 秒後重試")
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"下載不到 {url}")


def _int(text: str) -> int:
    return sum(int(n) for n in re.findall(r"(\d+)\s*格", text))


def taiwan() -> list[dict]:
    _get(SERVICES_TW, "services-8161.csv")
    with open(download(SERVICES_TW, "freeway", "services-8161.csv"), encoding="utf-8-sig", newline="") as f:
        services = [r for r in csv.DictReader(f) if r.get("服務區名稱")]
    parking = {}
    _get(PARKING_TW, "parking-46801.csv")  # 先確定下載成功（含重試），再照 CSV 讀（欄位裡有換行）
    with open(download(PARKING_TW, "freeway", "parking-46801.csv"), encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    for r in rows[1:]:
        if not r or not r[0].strip():
            continue
        key = r[0].strip().replace("服務區", "")
        parking[key] = {"car": _int(r[1]), "big": _int(r[3]), "acc": _int(r[5])}
    out = []
    for s in services:
        name, direction = s["服務區名稱"].strip(), s["方位"].strip()
        p = parking.get(f"{name}({direction})") or parking.get(name) or {}
        out.append({
            "lon": float(s["經度"]), "lat": float(s["緯度"]), "n": name, "road": s["國道"].strip(), "pos": s["位置"].strip(),
            "dir": direction, "op": s["經營廠商"].strip(), "term": s["經營期限"].strip(), "theme": s["主題特色"].strip(),
            "car": p.get("car"), "big": p.get("big"), "acc": p.get("acc"), "iso3": "TWN",
        })
    return out


def build() -> None:
    rows, seen = [], set()
    for kind, code in KINDS.items():
        for r in osm_qlever.features("highway", kind, extra=("name",)):
            if r["osm"] in seen:
                continue
            seen.add(r["osm"])
            c = osm_qlever.centroid(r["wkt"])
            if c:
                rows.append({"lon": c[0], "lat": c[1], "k": code, "n": r["name"], "iso3": r["iso3"]})
    rows.sort(key=lambda p: (p["iso3"], p["lon"]))
    write_layered_points(OUT / "rest-areas.json", rows, lambda r: r["k"] == 1, ["lon", "lat", "k", "n", "iso3"],
                         {"lon": 0.0001, "lat": 0.0001, "k": 1}, strings=("iso3",))
    tw = taiwan()
    fields = ["lon", "lat", "n", "road", "pos", "dir", "op", "term", "theme", "car", "big", "acc", "iso3"]
    write_json(OUT / "service-areas-tw.json", points_file(tw, fields, {"lon": 0.00001, "lat": 0.00001, "car": 1, "big": 1, "acc": 1}))
    count = {k: {} for k in KINDS.values()}
    for r in rows:
        count[r["k"]][r["iso3"]] = count[r["k"]].get(r["iso3"], 0) + 1
    for k, name in ((1, "服務區"), (2, "休息區")):
        top = sorted(count[k].items(), key=lambda kv: -kv[1])
        print(f"  OSM {name} {sum(count[k].values()):,} 個、{len(count[k])} 國；{top[:12]}；台灣 {count[k].get('TWN')}")
    print(f"  高速公路局 {len(tw)} 列（{len({t['n'] for t in tw})} 處）；沒對到停車位的 {[t['n'] + t['dir'] for t in tw if t['car'] is None]}")
