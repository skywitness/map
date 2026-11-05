"""旅行實用：單位的偏好（2026-11-05，製作手冊第二十二批 391）。

Unicode CLDR 49 的 `common/supplemental/units.xml` 的 unitPreferenceData（Unicode License v3）：各地區在各種場合
格式化數字時偏好的單位（量體重、報身高、路程、氣溫、風速、氣壓、油耗、室內面積）。只列例外的地區，沒列到的用
001（世界通用：公斤、公分、公里、攝氏、km/h、百帕、L/100km、平方公尺），所以每張圖都是一大片通用值加少數例外。
這是 ICU 格式化時該選哪個單位的偏好，不是各國的法定單位。
- 同一場合有好幾個單位時（由大到小，例如英國量體重 stone-and-pound、pound-and-ounce）取第一個當代表；
  路程的英里再看短距離用英尺（美國）還是碼（英國）；瑞典的路程是北歐里（10 公里）加公里。
- `topics/travel.py` 的 build() 也會呼叫 `write()`；單獨更新時跑 `travel-units`，讀現有的 details.json 補上
  `fmt.units`（不必重抓 travel 的其他來源；travel 的插頭還在用維基百科的 API，robots.txt 不允許，要先改成固定版本的網頁）。
"""
from __future__ import annotations

import json

from common import OUT_DIR, indicator_file, write_json
from sources import cldr

OUT = OUT_DIR / "topics" / "travel"
YEAR = 2026
CLDR_REGION = {"_SOL": "SO", "_IOT": "CX"}  # 跟 travel.py 一樣
# 指標 → (category, usage, 第一個單位 → 類別；src/topics/travel.ts 的 UNIT_* 類別)
UNIT_PREFS = {
    "unit-weight": ("mass", "person", {"kilogram": 1, "pound": 2, "stone-and-pound": 3, "pound-and-ounce": 4}),
    "unit-height": ("length", "person-height", {"centimeter": 1, "foot-and-inch": 2, "meter-and-centimeter": 3}),
    "unit-road": ("length", "road", {"kilometer": 1, "mile": 2, "mile-scandinavian": 4}),
    "unit-temperature": ("temperature", "weather", {"celsius": 1, "fahrenheit": 2}),
    "unit-wind": ("speed", "wind", {"kilometer-per-hour": 1, "meter-per-second": 2, "mile-per-hour": 3}),
    "unit-pressure": ("pressure", "baromtrc", {"hectopascal": 1, "millibar": 2, "millimeter-ofhg": 3, "inch-ofhg": 4}),
    "unit-fuel": ("consumption", "vehicle-fuel", {
        "liter-per-100-kilometer": 1, "liter-per-kilometer": 2, "mile-per-gallon": 3, "mile-per-gallon-imperial": 4,
    }),
    "unit-floor": ("area", "floor", {"square-meter": 1, "square-foot": 2}),
}
TAIWAN_NOTE = (
    "CLDR 對台灣用世界通用的單位；日常買賣與房屋還常用台斤（600 公克）、台兩（37.5 公克）與坪（約 3.3058 平方公尺）。",
    "CLDR gives Taiwan the worldwide default units; everyday trade and property still often use the catty (600 g), "
    "tael (37.5 g) and ping (about 3.3058 m²).",
)


def unit_class(key: str, units: list[str]) -> int:
    value = UNIT_PREFS[key][2][units[0]]
    if key == "unit-road" and units[0] == "mile" and "yard" in units:
        return 3  # 英國：短距離用碼
    return value


def write(map_ids: set[str], countries: dict, details: dict[str, dict]) -> None:
    prefs = {key: cldr.unit_preferences(cat, usage) for key, (cat, usage, _) in UNIT_PREFS.items()}
    values: dict[str, dict[str, list[int]]] = {key: {} for key in UNIT_PREFS}
    for iso3 in sorted(map_ids | {"TUV", "TKL", "GIB"}):
        region = CLDR_REGION.get(iso3) or countries.get(iso3, {}).get("iso2")
        if not region or iso3 == "_CYN":
            continue
        units = [unit_class(key, table.get(region) or table["001"]) for key, table in prefs.items()]
        for key, value in zip(UNIT_PREFS, units):
            values[key][iso3] = [value]
        details.setdefault(iso3, {}).setdefault("fmt", {})["units"] = units
    for key, vals in values.items():
        extra = {"notes": {"TWN": TAIWAN_NOTE[0]}, "notesEn": {"TWN": TAIWAN_NOTE[1]}} if key in ("unit-weight", "unit-floor") else {}
        write_json(OUT / f"{key}.json", indicator_file(key, "", [YEAR], vals, **extra), quiet=True)
        counts: dict[int, list[str]] = {}
        for iso3, (v,) in vals.items():
            counts.setdefault(v, []).append(iso3)
        print(f"  {key}：{len(vals)} 國；" + "；".join(
            f"{v}: {len(c)}" + (f" {c}" if len(c) < 25 else "") for v, c in sorted(counts.items())))
    if any(values[key]["TWN"] != [1] for key in UNIT_PREFS):
        raise RuntimeError("台灣應該全部是世界通用的單位（CLDR 001）")


def build() -> None:
    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        countries = json.load(f)
    with open(OUT_DIR / "geo" / "countries-50m.json", encoding="utf-8") as f:
        map_ids = {g["id"] for g in json.load(f)["objects"]["countries"]["geometries"]}
    path = OUT / "details.json"
    with open(path, encoding="utf-8") as f:
        details = json.load(f)
    write(map_ids, countries, details)
    write_json(path, details)
