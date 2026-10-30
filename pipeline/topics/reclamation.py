"""填海造陸（新主題，地理類，2026-10-30，製作手冊第六批 77）：Sengupta et al. 2023（Earth's Future）人口百萬以上的
135 個沿海城市 2000–2020 年的填海面積（Zenodo records/7528236，CC BY 4.0）。

**來源**：reclamation_data_Final.xlsx（22,571 bytes）：區域、緯度、經度、城市、國家、2000–2020 年填海面積（公頃）、
相對誤差「(±3)」。沒有填海的城市寫「Negligible」、沒有座標；Kozhikode 寫「null」（沒有資料）。最後一列是合計 253,734 公頃。
另一個檔（填海地上的土地用途點）是從 OpenStreetMap 取的點（ODbL），使用者決定照候選清單只畫城市的比例圓，不用。

**修正**（使用者決定修正國家欄；其他是明顯的輸入錯誤）：
- 台中那一列城市欄是「Taichung . Taiwan」、國家欄是「China」→ 台中、台灣；新加坡的國家欄是空的 → 新加坡。
- 香港的國家欄是「China SAR」→ 香港（HKG，地圖上自己一個地區）；「SA」是南非；New York、Virginia Beach 的國家欄空白 → 美國。
- 經緯度寫反的（Kochi、Thiruvananthapuram、Port-au-Prince）：座標落在別的國家、對調後落在那個國家時對調；Maputo 的緯度多一個逗號。
- 沒有座標的（Negligible）用 Natural Earth 1:10m populated places（公有領域）的城市位置；中文名稱也用它的 NAME_ZHT。

**輸出**：cities.json（點：面積、誤差、是否可忽略、國家、名稱）、area.json（各國合計，公頃，比例圓）、
cities-count.json（各國有填海的城市數）、manifest.json。幾秒。
"""
from __future__ import annotations

import json
import re

import openpyxl

from common import OUT_DIR, download, indicator_file, now_iso, points_file, write_json
from geoindex import countries_at

OUT = OUT_DIR / "topics" / "reclamation"
URL = "https://zenodo.org/api/records/7528236/files/Sengupta%20et%20al%202023_reclamation_data_Final.xlsx/content"
PLACES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_populated_places.geojson"
YEAR = 2020
TOTAL = 253734  # 檔案最後一列的合計（公頃），核對用

COUNTRY = {
    "Kenya": "KEN", "Mozambique": "MOZ", "Somalia": "SOM", "Tanzania": "TZA", "Angola": "AGO", "Cameroon": "CMR",
    "Congo": "COG", "Algeria": "DZA", "Egypt": "EGY", "Libya": "LBY", "Morocco": "MAR", "Tunisia": "TUN", "SA": "ZAF",
    "Cote d'ivoire": "CIV", "Ghana": "GHA", "Guinea": "GIN", "Liberia": "LBR", "Mauritania": "MRT", "Nigeria": "NGA",
    "Senegal": "SEN", "Sierra Leone": "SLE", "Togo": "TGO", "China": "CHN", "China SAR": "HKG", "Taiwan": "TWN",
    "Japan": "JPN", "Republic of Korea": "KOR", "Bangladesh": "BGD", "India": "IND", "Pakistan": "PAK",
    "Indonesia": "IDN", "Philippines": "PHL", "Thailand": "THA", "Vietnam": "VNM", "Israel": "ISR", "Kuwait": "KWT",
    "Lebanon": "LBN", "Oman": "OMN", "Saudi Arabia": "SAU", "Turkey": "TUR", "UAE": "ARE", "Russain Federation": "RUS",
    "Denmark": "DNK", "Finland": "FIN", "Ireland": "IRL", "Greece": "GRC", "Italy": "ITA", "Portugal": "PRT",
    "Spain": "ESP", "Netherlands": "NLD", "Cuba": "CUB", "Dominican Rep.": "DOM", "Haiti": "HTI", "Puerto Rico": "PRI",
    "Panama": "PAN", "Argentina": "ARG", "Brazil": "BRA", "Colombia": "COL", "Peru": "PER", "Uruguay": "URY",
    "Venezuela": "VEN", "USA": "USA", "Canada": "CAN", "Australia": "AUS", "New Zealand": "NZL",
}
# 國家欄寫錯或空白的列（城市欄原文 → 城市名稱、ISO3）
FIX = {
    "Taichung . Taiwan": ("Taichung", "TWN"),
    "Singapore": ("Singapore", "SGP"),
    "HongKong": ("Hong Kong", "HKG"),
    "New York": ("New York", "USA"),
    "Virginia Beach": ("Virginia Beach", "USA"),
}
# 城市名稱 → Natural Earth 的寫法（拼字不同、合併的都會區取第一個城市）
NE_NAME = {
    "Daula": "Douala", "Morovia": "Monrovia", "Port Elizabeth": "Port Elizabeth", "Samarang": "Semarang",
    "Tel Aviv-Jafia": "Tel Aviv-Yafo", "Kuwait city": "Kuwait", "Ad-Dammam": "Ad Dammam", "Jiddah": "Jeddah",
    "St Petersburg": "St. Petersburg", "Panama city": "Panama City", "Los Angeles- Long Beach-Santa Ana": "Los Angeles",
    "Tampa- St. Petersburg": "Tampa", "Hong Kong": "Hong Kong", "Tangier": "Tangier", "Chittagong": "Chittagong",
    "Thiruvananthapuram": "Thiruvananthapuram", "Kochi": "Kochi", "Florianopolis": "Florianopolis", "João Pessoa": "Joao Pessoa",
    "Maceio": "Maceio", "Port-au-Prince": "Port-au-Prince", "Abu Dhabi": "Abu Dhabi", "Santo Domingo": "Santo Domingo",
}
# Natural Earth 沒有中文名稱、或譯名跟台灣慣用的不同（臺 → 台照網站其他地方）
ZH = {"Tokoname": "常滑", "Taipei": "台北", "Taichung": "台中", "Kaohsiung": "高雄", "Hong Kong": "香港", "Dongying": "東營",
      "Ad-Dammam": "達曼", "Zhongshan": "中山", "Kuwait city": "科威特城", "Chittagong": "吉大港", "Incheon": "仁川", "Busan": "釜山",
      "Dubai": "杜拜"}


def zh_name(name: str | None) -> str | None:
    """Natural Earth 的繁體名稱去掉「市」（上海市 → 上海），跟網站其他地方的城市名稱一樣"""
    if not name:
        return None
    return name[:-1] if name.endswith("市") and len(name) > 2 else name


def number(v) -> float | None:
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip().rstrip(",")
        try:
            return float(s)
        except ValueError:
            return None
    return None


def places() -> dict[tuple[str, str], dict]:
    path = download(PLACES_URL, "natural-earth", "ne_10m_populated_places.geojson")
    out: dict[tuple[str, str], dict] = {}
    for f in json.loads(path.read_text(encoding="utf-8"))["features"]:
        p = f["properties"]
        for name in {p["NAME"], p.get("NAMEASCII") or p["NAME"], p.get("NAME_EN") or p["NAME"]}:
            key = (name.lower(), p["ADM0_A3"])
            if key not in out or (p.get("POP_MAX") or 0) > (out[key].get("POP_MAX") or 0):
                out[key] = p
    return out


def build() -> None:
    path = download(URL, "reclamation", "Sengupta-2023-reclamation_data_Final.xlsx")
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    ne = places()
    rows, total = [], None
    for region, lat, lon, city, country, area, err in list(ws.iter_rows(values_only=True))[1:]:
        if isinstance(city, str) and not city.strip() and isinstance(lat, str) and lat.startswith("Total"):
            total = area
            continue
        name = city.strip()
        if name in FIX:
            name, iso3 = FIX[name]
        else:
            iso3 = COUNTRY[(country or "").strip()]
        negligible = isinstance(area, str) and area.strip().lower() == "negligible"
        value = 0.0 if negligible else number(area)
        e = re.search(r"±\s*([\d.]+)", err or "")
        lat, lon = number(lat), number(lon)
        place = ne.get((NE_NAME.get(name, name).lower(), iso3))
        if lat is None or lon is None:
            if not place:
                raise ValueError(f"{name}（{iso3}）沒有座標，Natural Earth 也找不到")
            lat, lon = place["LATITUDE"], place["LONGITUDE"]
        rows.append({"name": name, "iso3": iso3, "lat": lat, "lon": lon, "a": value, "e": float(e.group(1)) if e else None,
                     "n": 1 if negligible else None, "zh": ZH.get(name) or zh_name((place or {}).get("NAME_ZHT"))})

    # 經緯度寫反的：落在別的國家、對調後落在這個國家時對調
    found = countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])
    swapped = countries_at([r["lat"] for r in rows], [r["lon"] for r in rows])
    for r, here, other in zip(rows, found, swapped):
        if here != r["iso3"] and other == r["iso3"]:
            print(f"    {r['name']}：經緯度對調（{r['lat']}, {r['lon']}）")
            r["lat"], r["lon"] = r["lon"], r["lat"]
        elif here != r["iso3"]:
            print(f"    {r['name']}（{r['iso3']}）的座標落在 {here}，照原本的座標")
    s = sum(r["a"] or 0 for r in rows)
    if abs(s - TOTAL) > 1 or total != TOTAL:
        raise ValueError(f"填海面積合計 {s:,.1f} 跟檔案的 {total} 不一致")

    rows.sort(key=lambda r: -(r["a"] or 0))
    fields = ["lon", "lat", "a", "e", "n", "iso3", "name", "zh"]
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "cities.json", points_file(rows, fields, {"lon": 0.0001, "lat": 0.0001, "a": 0.1, "e": 0.01, "n": 1},
                                               strings=("iso3",)))
    by_country: dict[str, float] = {}
    count: dict[str, int] = {}
    for r in rows:
        if r["a"] is None:
            continue
        by_country[r["iso3"]] = by_country.get(r["iso3"], 0) + r["a"]
        count[r["iso3"]] = count.get(r["iso3"], 0) + (1 if r["a"] > 0 else 0)
    write_json(OUT / "area.json", indicator_file("area", "公頃", [YEAR], {c: [round(v, 1)] for c, v in sorted(by_country.items())},
                                                aggregates={"WLD": [TOTAL]}))
    write_json(OUT / "cities-count.json", indicator_file("cities-count", "個", [YEAR], {c: [v] for c, v in sorted(count.items())}))
    write_json(OUT / "manifest.json", {
        "topic": "reclamation", "generatedAt": now_iso(),
        "source": "Sengupta, D., Choi, Y. R., Tian, B., et al. (2023), Mapping 21st Century global coastal land reclamation, Earth's Future 11(2), doi:10.1029/2022EF002927; data: Zenodo 7528236",
        "license": "CC BY 4.0",
    })
    with_area = [r for r in rows if r["a"]]
    print(f"  {len(rows)} 個城市（有填海 {len(with_area)}、可忽略 {sum(1 for r in rows if r['n'])}、沒有資料 "
          f"{sum(1 for r in rows if r['a'] is None)}），合計 {s:,.0f} 公頃")
    print("  前 10：" + "、".join(f"{r['zh'] or r['name']} {r['a']:,.0f}" for r in rows[:10]))
    print("  台灣：" + "、".join(f"{r['zh'] or r['name']} {r['a']:,.0f}" for r in rows if r["iso3"] == "TWN"))
    print(f"  各國前 8：{sorted(by_country.items(), key=lambda kv: -kv[1])[:8]}")
    print(f"  沒有中文名稱：{[r['name'] for r in rows if not r['zh']]}")


if __name__ == "__main__":
    build()
