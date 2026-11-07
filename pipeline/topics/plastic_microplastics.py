"""海裡量到的微塑膠（2026-11-07，製作手冊第二十五批 487，候選 1150；擴充「塑膠污染」）。

NOAA NCEI「Marine Microplastics」資料庫（產品頁 https://www.ncei.noaa.gov/products/microplastics 原文
「All data in the NCEI Marine Microplastics database is free to access and use.」，要引用 Nyadjro 等人 2018 的資料集與
2023 年 Scientific Data 的論文）。資料從 NCEI 地圖用的 ArcGIS 圖徵服務 Marine_Microplastics_WGS84 分頁讀（一頁最多 2,000 筆，
22,530 筆，不用金鑰），快取在 .cache/ncei-microplastics/。
- NOAA 警語：各研究的採樣、萃取、分析方法不同，濃度不一定能互相比較，所以只用 NOAA 做好的濃度分級
  （Very Low … Very High，0–4），原始數值只放在提示框。分級依介質不同：海水 pieces/m³、海底沉積物 pieces/kg（乾重）、
  沙灘 pieces/m³、Nurdle Patrol（公民科學，撿 10 分鐘的塑膠粒數）。
- Country 欄七成是空的（公海），不畫國家面量圖。
輸出 public/data/topics/plastic/microplastics-{water,sediment,beach,nurdle}.json（點：lon、lat、c 分級、y 年、v 數值、ref 文獻），
加上 microplastics-{item}.json 的空指標檔（檔名有 {item} 前端才會出現介質的選單）。
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone

import common
from common import OUT_DIR, indicator_file, points_file, write_json

OUT = OUT_DIR / "topics" / "plastic"
LAYER = "https://services2.arcgis.com/C8EMgrsFcRFL6LrL/arcgis/rest/services/Marine_Microplastics_WGS84/FeatureServer/0/query"
PAGE = 2000
FIELDS = ["Latitude__degree_", "Longitude_degree_", "Medium", "Microplastics_measurement", "Unit", "Concentration_class_text",
          "Short_Reference", "Date_m_d_yyyy", "Country"]
MEDIA = {"Ocean water": "water", "Ocean sediment": "sediment", "Beach": "beach", "Beach-Nurdle Patrol": "nurdle"}
CLASSES = {"Very Low": 0, "Low": 1, "Medium": 2, "High": 3, "Very High": 4}


def _page(offset: int) -> list[dict]:
    target = common.CACHE_DIR / "ncei-microplastics" / f"page-{offset}.json"
    if not target.exists() or common.REFRESH:
        query = urllib.parse.urlencode({"where": "1=1", "outFields": ",".join(FIELDS), "orderByFields": "OBJECTID",
                                        "resultOffset": offset, "resultRecordCount": PAGE, "returnGeometry": "false", "f": "json"})
        print(f"  下載 {LAYER}（offset {offset}）")
        request = urllib.request.Request(f"{LAYER}?{query}", headers={"User-Agent": common.USER_AGENT})
        with urllib.request.urlopen(request, timeout=120, context=common._ssl_context(LAYER)) as resp:
            data = json.load(resp)
        if "features" not in data:
            raise RuntimeError(f"NCEI 微塑膠圖徵服務回傳錯誤：{data}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps([f["attributes"] for f in data["features"]], ensure_ascii=False), encoding="utf-8")
    return json.loads(target.read_text(encoding="utf-8"))


def build() -> None:
    records: list[dict] = []
    offset = 0
    while True:
        page = _page(offset)
        records += page
        if len(page) < PAGE:
            break
        offset += PAGE
    rows: dict[str, list[dict]] = {m: [] for m in MEDIA.values()}
    skipped = Counter()
    for r in records:
        medium = MEDIA.get(r["Medium"])
        cls = CLASSES.get((r["Concentration_class_text"] or "").strip())
        lat, lon = r["Latitude__degree_"], r["Longitude_degree_"]
        if medium is None or cls is None or lat is None or lon is None:
            skipped[(r["Medium"], r["Concentration_class_text"])] += 1
            continue
        when = r["Date_m_d_yyyy"]
        year = datetime.fromtimestamp(when / 1000, tz=timezone.utc).year if when is not None else None
        rows[medium].append({"lon": lon, "lat": lat, "c": cls, "y": year, "v": r["Microplastics_measurement"],
                             "ref": (r["Short_Reference"] or "").strip()})
    for medium, items in rows.items():
        items.sort(key=lambda x: (x["lon"], x["lat"]))
        write_json(OUT / f"microplastics-{medium}.json",
                   points_file(items, ["lon", "lat", "c", "y", "v", "ref"], {"lon": 1e-4, "lat": 1e-4}, delta=("lon",), strings=("ref",)))
        write_json(OUT / "microplastics" / f"{medium}.json",
                   indicator_file("microplastics", "", [2023], {}, license="NOAA NCEI（free to access and use）"), quiet=True)
    years = [y for items in rows.values() for y in (x["y"] for x in items) if y]
    tw = sum(1 for r in records if (r["Country"] or "").strip() == "Taiwan")
    print(f"  NCEI 微塑膠 {len(records):,} 筆（{min(years)}–{max(years)}）："
          + "、".join(f"{k} {len(v):,}" for k, v in rows.items()) + f"；台灣 {tw}；不收 {sum(skipped.values())}（{dict(skipped)}）")
