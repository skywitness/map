"""內陸水域占國土的比例（2026-11-07，製作手冊第二十七批 548，候選 1235；擴充「河流與流域」；步驟 inland-water，
輸出到 topics/rivers/inland-water.json）。

資料：FAOSTAT 土地利用（RL，CC BY 4.0），element 5110 Area（千公頃）的 item 6680 Inland waters 與 6601 Land area。
比例 = 內陸水域 ÷（陸地＋內陸水域）：FAO 的 Country area 在加拿大、荷蘭這類國家還含沿海的內水（加拿大 156 萬千公頃，
陸地加內陸水域只有 99 萬），所以分母不用它。

只放最新一年：各國的內陸水域大多幾十年同一個數，會變的多半是改了報法（美國 2008 年從 4.88% 跳到 6.96%），
畫成時間軸會讓人以為湖變多了。71 個地區（沙烏地、利比亞這類沙漠國，也有安哥拉、中非、格陵蘭）FAOSTAT 沒有
內陸水域這一項，不當成 0、留白。
"""
from __future__ import annotations

from collections import defaultdict

from common import indicator_file, write_json
from sources import faostat
from topics.rivers import OUT

LAND, WATER = 6601, 6680
AREA = 5110


def _km2(v: float) -> str:
    return f"{v:,.0f}"


def build() -> None:
    by: dict[str, dict[int, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for r in faostat.rows("RL", {AREA}, {LAND, WATER}):
        by[r.area][r.item][r.year] = r.value
    year = max(y for d in by.values() for y in d.get(WATER, {}))
    values: dict[str, list[float | None]] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    world = None
    for code, items in sorted(by.items()):
        water, land = items.get(WATER, {}).get(year), items.get(LAND, {}).get(year)
        if water is None or land is None or water + land <= 0:
            continue
        share = round(100 * water / (water + land), 2)
        km2 = water * 10  # 千公頃 → km²
        if code == "WLD":
            world = share
            continue
        values[code] = [share]
        hints[code] = f"內陸水域 {_km2(km2)} km²"
        hints_en[code] = f"{_km2(km2)} km² of inland water"
    write_json(OUT / "inland-water.json", indicator_file(
        "inland-water", "%", [year], values, hints=hints, hintsEn=hints_en,
        aggregates={"WLD": [world]}, license="CC BY 4.0"))
    print(f"  {year} 年：{len(values)} 國或地區有值，世界 {world}%")
    top = sorted(values.items(), key=lambda kv: -kv[1][0])[:16]
    print("  " + "、".join(f"{c} {v[0]}%" for c, v in top))
    for c in ("TWN", "CHN", "JPN", "USA", "CAN", "FIN", "NLD", "IND", "IRN"):
        print(f"  {c} {values.get(c)} {hints.get(c)}")
