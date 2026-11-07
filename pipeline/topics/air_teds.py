"""台灣的空氣污染物排放清冊：1 公里網格（2026-11-07，製作手冊第二十五批 483，候選 1153；擴充「空氣品質」）。

環境部「空氣污染排放量推估結果」（AQX_P_24，data.gov.tw 152689，政府資料開放授權條款第 1 版）：TEDS 13 的
1 km × 1 km 網格，推估基準年民國 112 年（2023），臺灣本島與綠島、蘭嶼、小琉球、龜山島（澎湖、金門、馬祖不在），點源、線源、面源、生物源加總；每格一列，
欄位 tm2_e、tm2_n（TWD97-TM2、121 度中央經線，**網格的左下角**）與 TSP、PM10、PM2.5、SOx、NOx、NMHC 等的排放量
（公噸／年）。開放資料平台文件上的 API 要帶 api_key，這裡跟 sources/moenv.py 一樣用平台網頁預覽資料用的
datastore.search（不用金鑰），一次 10,000 筆、分 4 頁，37,427 格。
TM2 換經緯度用 GRS80 的橫麥卡托反算（不另裝 pyproj），點放在網格中心（左下角各加 500 公尺）。
NMHC 含植物排放的生物源，山區會偏高。

輸出 public/data/topics/air-quality/teds.json（點圖層：pm25、pm10、sox、nox、nmhc，公噸／年；全為 0 的格子不收）。
"""

from __future__ import annotations

import json
import math
import urllib.request

import common
from common import OUT_DIR, indicator_file, points_file, write_json

OUT = OUT_DIR / "topics" / "air-quality"
SEARCH = "https://data.moenv.gov.tw/api/frontstage/datastore.search"
RESOURCE = "e570361a-4add-4c54-968f-0ce55e1cb8ea"
PAGE = 10000
FIELDS = {"pm25": "pm25_emi_value", "pm10": "pm10_emi_value", "sox": "sox_emi_value", "nox": "nox_emi_value",
          "nmhc": "nmhc_emi_value"}

# GRS80 與 TWD97-TM2（121°E）的參數
A, F = 6378137.0, 1 / 298.257222101
K0, LON0, FE = 0.9999, math.radians(121), 250000.0


def tm2_to_lonlat(x: float, y: float) -> tuple[float, float]:
    """TWD97-TM2 → WGS84（GRS80 ≈ WGS84）；Snyder 的橫麥卡托反算公式"""
    e2 = F * (2 - F)
    ep2 = e2 / (1 - e2)
    m = y / K0
    mu = m / (A * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * math.sin(8 * mu))
    c1 = ep2 * math.cos(phi1) ** 2
    t1 = math.tan(phi1) ** 2
    n1 = A / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    r1 = A * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    d = (x - FE) / (n1 * K0)
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (d ** 2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
                                               + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720)
    lon = LON0 + (d - (1 + 2 * t1 + c1) * d ** 3 / 6
                  + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120) / math.cos(phi1)
    return math.degrees(lon), math.degrees(lat)


def _page(offset: int) -> list[dict]:
    target = common.CACHE_DIR / "moenv" / "AQX_P_24" / f"page-{offset}.json"
    if not target.exists() or common.REFRESH:
        print(f"  下載 {SEARCH}（AQX_P_24 offset {offset}）")
        request = urllib.request.Request(
            SEARCH, data=json.dumps({"resource_id": RESOURCE, "limit": PAGE, "offset": offset}).encode(),
            headers={"Content-Type": "application/json", "User-Agent": common.USER_AGENT})
        with urllib.request.urlopen(request, timeout=300, context=common._ssl_context(SEARCH)) as resp:
            payload = json.load(resp)
        if not payload.get("success"):
            raise RuntimeError(f"環境部開放資料平台回傳錯誤：{payload}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(payload["payload"], ensure_ascii=False), encoding="utf-8")
    return json.loads(target.read_text(encoding="utf-8"))


def build() -> None:
    first = _page(0)
    total = first["total"]
    records = list(first["records"])
    for offset in range(PAGE, total, PAGE):
        records += _page(offset)["records"]
    if len(records) != total:
        raise RuntimeError(f"AQX_P_24 應有 {total} 筆，只讀到 {len(records)}")
    rows = []
    sums = {k: 0.0 for k in FIELDS}
    for r in records:
        values = {k: float(r[col] or 0) for k, col in FIELDS.items()}
        if not any(values.values()):
            continue
        lon, lat = tm2_to_lonlat(float(r["tm2_e"]) + 500, float(r["tm2_n"]) + 500)
        rows.append({"lon": lon, "lat": lat, **{k: round(v, 2) for k, v in values.items()}})
        for k, v in values.items():
            sums[k] += v
    rows.sort(key=lambda r: (r["lon"], r["lat"]))
    # 「台灣的排放網格」指標的檔：國家不上色（值是空的），檔名有 {item} 前端才會出現污染物的選單
    for k in FIELDS:
        write_json(OUT / f"teds-{k}.json", indicator_file("teds", "", [2023], {}, license="政府資料開放授權條款第 1 版"), quiet=True)
    write_json(OUT / "teds.json", points_file(rows, ["lon", "lat", *FIELDS], {"lon": 1e-4, "lat": 1e-4, **{k: 0.01 for k in FIELDS}},
                                              delta=("lon",)))
    print(f"  TEDS 網格 {len(records):,} 格，有排放的 {len(rows):,} 格；全台合計（公噸／年）"
          + "、".join(f"{k} {v:,.0f}" for k, v in sums.items()))
