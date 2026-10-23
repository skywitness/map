"""GWIS（Global Wildfire Information System，歐盟 JRC／Copernicus）的各國燒毀面積統計。

- 來源是 GWIS Country Profile 的下載頁（https://gwis.jrc.ec.europa.eu/apps/country.profile/downloads）的
  「MODIS Global Monthly Burned Area」：NASA MODIS MCD64A1 燒毀面積產品（500 m 網格）依 GADM 第 0、1 級行政區
  彙整的逐月燒毀面積（公頃），分 5 種土地覆蓋。一個 zip（約 12 MB）裡只有一個 CSV（約 66 MB），不用登入。
  - 欄位：year, month, gid_0, country, gid_1, region, forest, savannas, shrublands_grasslands, croplands, other。
  - 只有 GADM 第 1 級行政區的列，沒有第 1 級的小島（福克蘭、馬爾地夫、吉里巴斯、梵蒂岡等 24 個）不在檔案裡；
    同一個網站的 API 對這些國家也是空的，所以是無資料，不是 0。
  - 檔名帶年份範圍（2026-08-25 產生的檔案到 2025 年）；下載頁的年份範圍改了（加上新的一年）時改 YEAR_TO。
    Our World in Data 提過舊檔（2002_2024）的 2024 年全是 0；這一版的 2024、2025 年跟 API 逐年相同（抽查台灣、中國）。
- 國土面積用同一個網站 Country Profile 的 API（`/api/v3/indicators`，網頁顯示國家概況用的），一國一次查詢，
  回傳 GADM 國界的總面積（area_km2，含湖泊等內陸水域）與 5 種土地覆蓋的面積（公頃）。分子、分母都是 GADM 國界，
  不必跟地圖的 Natural Earth 國界對齊。第一次約 230 次查詢、5 分鐘，之後用快取。
- 授權：GWIS 網站的 Data License（https://gwis.jrc.ec.europa.eu/about-gwis/data-license）寫明歐盟擁有的內容
  除非另外標示，採 CC BY 4.0（註明出處、說明修改）。MCD64A1 是 NASA LP DAAC 的資料，沒有使用、販售、
  再散布的限制（NASA EOSDIS 的資料使用與引用政策），引用 doi:10.5067/MODIS/MCD64A1.061。
"""
from __future__ import annotations

import csv
import io
import json
import time
import zipfile
from dataclasses import dataclass, field

from common import CACHE_DIR, download

YEAR_FROM, YEAR_TO = 2002, 2025
BULK_URL = (
    "https://gwis.jrc.ec.europa.eu/downloads/country.profile/"
    f"MCD64A1_burned_area_full_dataset_{YEAR_FROM}_{YEAR_TO}.zip"
)
API = "https://cprof.effis.emergency.copernicus.eu/api/v3"
SOURCE = "gwis"

# CSV 的土地覆蓋欄位（API 的 lc1–lc5 依序對應），也是前端側欄的順序
LANDCOVER = ("forest", "savannas", "shrublands_grasslands", "croplands", "other")


@dataclass
class BurnedArea:
    """GWIS 的燒毀面積（公頃），key 是 GWIS 的國家代碼（GADM 的 gid_0，大多是 ISO alpha-3）"""

    names: dict[str, str] = field(default_factory=dict)
    # {國家: {年: [5 種土地覆蓋的公頃]}}
    yearly: dict[str, dict[int, list[float]]] = field(default_factory=dict)
    # {國家: {年: [12 個月的公頃（5 種合計）]}}
    monthly: dict[str, dict[int, list[float]]] = field(default_factory=dict)
    # 每一年出現的月份（檢查最後一年是不是完整的）
    months: dict[int, set[int]] = field(default_factory=dict)


def burned_area() -> BurnedArea:
    path = download(BULK_URL, SOURCE, f"MCD64A1_burned_area_full_dataset_{YEAR_FROM}_{YEAR_TO}.zip")
    out = BurnedArea()
    with zipfile.ZipFile(path) as z:
        (name,) = z.namelist()
        with z.open(name) as raw:
            for row in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")):
                iso3, year, month = row["gid_0"], int(row["year"]), int(row["month"])
                values = [float(row[k] or 0) for k in LANDCOVER]
                out.names[iso3] = row["country"]
                lc = out.yearly.setdefault(iso3, {}).setdefault(year, [0.0] * len(LANDCOVER))
                for i, v in enumerate(values):
                    lc[i] += v
                months = out.monthly.setdefault(iso3, {}).setdefault(year, [0.0] * 12)
                months[month - 1] += sum(values)
                out.months.setdefault(year, set()).add(month)
    return out


def countries() -> list[dict]:
    """GWIS Country Profile 的國家清單：[{iso3, name, continent_code, …}]，251 個（含裏海 XCA 這類非國家）"""
    path = download(f"{API}/countries?env=PROD", SOURCE, "countries.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@dataclass
class CountryArea:
    km2: float
    # 5 種土地覆蓋的面積（公頃），順序同 LANDCOVER；不含建成區、水域、冰雪等不算在這 5 類的土地
    landcover: list[float]


def country_area(iso3: str) -> CountryArea | None:
    """GADM 國界的總面積與各土地覆蓋面積；API 沒有這個國家時回傳 None"""
    name = f"indicators/{iso3}.json"
    cached = (CACHE_DIR / SOURCE / name).exists()
    path = download(f"{API}/indicators?level=ADM0&value={iso3}&env=PROD", SOURCE, name)
    if not cached:
        time.sleep(0.2)  # 一國一次查詢，放慢一點
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if not data or not data.get("area_km2"):
        return None
    return CountryArea(km2=float(data["area_km2"]), landcover=[float(data.get(f"lc{i + 1}") or 0) for i in range(len(LANDCOVER))])
