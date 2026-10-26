"""Marine Regions（比利時法蘭德斯海洋研究所 VLIZ）的 Maritime Boundaries Geodatabase 第 12 版（2023）。

- 授權：CC BY 4.0。https://www.marineregions.org/disclaimer.php ：「Marine Regions’ products have been licensed under
  CC-BY since Maritime Boundaries version 11 (2019)」，連到 CC BY 4.0；同一頁的使用條款（只供科學、教育、研究用途，
  不能當法律、經濟或航行依據；VLIZ 對任何國家、領土的法律地位與界線不表示意見）明文寫「If any of the abovementioned
  provisions divert from or contradict the provisions of the CC-license in any way, the CC-license provisions prevail」。
  同一頁「請不要在別處提供我們的產品下載」是請求、不是授權條件；這裡只放大幅簡化過的界線與各國面積，不轉載原始檔
  （DESIGN.md 第 8 節第 12 點）。
- 引用：Flanders Marine Institute (2023). Maritime Boundaries Geodatabase: Maritime Boundaries and Exclusive Economic
  Zones (200NM), version 12. Available online at https://www.marineregions.org/. https://doi.org/10.14284/632
- 下載：網站的下載頁要填姓名、電子郵件等表單，這裡改用 VLIZ 公開的 WFS（geo.vliz.be 的 GeoServer，同一份第 12 版，
  不必登入）：
  - `MarineRegions:eez`：285 個多邊形的屬性（不含幾何）：200 浬專屬經濟海域 229 個、重疊主張（Overlapping claim）
    35 個、共同管理區（Joint regime）21 個；`area_km2` 是 Marine Regions 算好的面積（含內水與群島水域，
    跟 UNCLOS 的 EEZ 定義不同，Marine Regions 的說明頁有寫）。
  - `MarineRegions:eez_boundaries`：2,349 條界線（25 MB 的 GeoJSON，約 2 分鐘），`line_type` 是界線的性質
    （條約、判決、等距中線、200 浬外緣、共同管理區、未解決的爭議…），已經在 ±180° 經線切開。`mrgid_eez1`、`mrgid_eez2`
    是兩邊的多邊形；英國與法羅群島之間那條寫成 84350（多邊形是 8435，oceans.py 的 BOUNDARY_FIXES 改正），布威島的基線
    對到的 8399 沒有多邊形（第 12 版沒有布威島的專屬經濟海域，基線本來就不畫）。
  - `MarineRegions:eez_land`（陸地與專屬經濟海域的聯集，用 ESRI 的國界與第 12 版的 EEZ 合成）：只用它的
    `pol_type = Landlocked country` 判斷內陸國（41 個，含裏海沿岸的國家），面積不用（陸地面積用 FAOSTAT）。
"""
from __future__ import annotations

import json

from common import download

WFS = (
    "https://geo.vliz.be/geoserver/MarineRegions/wfs?service=WFS&version=1.0.0&request=GetFeature"
    "&outputFormat=application/json&typeName=MarineRegions:{layer}"
)
INFO_URL = "https://www.marineregions.org/eez.php"
DOI = "https://doi.org/10.14284/632"
CITATION = (
    "Flanders Marine Institute (2023). Maritime Boundaries Geodatabase: Maritime Boundaries and Exclusive Economic "
    "Zones (200NM), version 12. Available online at https://www.marineregions.org/. https://doi.org/10.14284/632"
)
VERSION_YEAR = 2023  # 第 12 版的發布年份，指標檔的年份

EEZ_FIELDS = (
    "mrgid,geoname,pol_type,territory1,iso_ter1,sovereign1,iso_sov1,territory2,iso_ter2,sovereign2,iso_sov2,"
    "territory3,iso_ter3,sovereign3,iso_sov3,area_km2,mrgid_eez"
)


def eez_polygons() -> list[dict]:
    """專屬經濟海域多邊形的屬性（不含幾何），每個一個 dict（欄位見 EEZ_FIELDS）"""
    path = download(WFS.format(layer="eez") + "&propertyName=" + EEZ_FIELDS, "marine-regions", "eez_v12_attributes.json")
    with open(path, encoding="utf-8") as f:
        features = json.load(f)["features"]
    if len(features) < 250:
        raise RuntimeError(f"Marine Regions 的 EEZ 只有 {len(features)} 個多邊形，下載可能不完整")
    return [f["properties"] for f in features]


def landlocked() -> set[str]:
    """沒有專屬經濟海域的內陸國（ISO alpha-3）"""
    path = download(WFS.format(layer="eez_land") + "&propertyName=union,iso_ter1,pol_type", "marine-regions", "eez_land_v12_types.json")
    with open(path, encoding="utf-8") as f:
        features = json.load(f)["features"]
    out = {f["properties"]["iso_ter1"] for f in features if f["properties"]["pol_type"] == "Landlocked country"}
    if len(out) < 35 or None in out:
        raise RuntimeError(f"Marine Regions 的內陸國不對：{sorted(map(str, out))}")
    return out


def boundaries() -> list[dict]:
    """界線（GeoJSON feature：properties 有 line_type、mrgid_eez1、mrgid_eez2、length_km…，幾何是 MultiLineString）"""
    path = download(WFS.format(layer="eez_boundaries"), "marine-regions", "eez_boundaries_v12.json")
    with open(path, encoding="utf-8") as f:
        features = json.load(f)["features"]
    if len(features) < 2000:
        raise RuntimeError(f"Marine Regions 的界線只有 {len(features)} 條，下載可能不完整")
    return features
