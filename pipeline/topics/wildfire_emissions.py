"""野火的排放量，以及 1996 年起的燒毀面積（2026-11-07，製作手冊第二十五批 499，候選 1166；擴充「野火」）。

FAOSTAT「Emissions from Fires」（GI，檔名是 Emissions_Land_Use_Fires_…，CC BY 4.0；原始資料是 NASA MODIS MCD64A1 燒毀面積
與 GFED 的係數），只用 Source＝FAO TIER 1（3050；另一套 UNFCCC 是各國申報）：
- Forest fires（6992）的 Emissions (CO2)（kt → 公噸）與 Burned Area（公頃）；Savanna fires（6795）的 Burned Area。
- 1990–1995 年全部是同一個回推的常數（全球森林火災每年 2,956 萬公頃），不收，從 1996 年開始。
- 草原火災的 CO₂ 依 IPCC 口徑當年再吸收、多半不報（只有 209 筆），不畫。
- 台灣（China, Taiwan Province of）的森林火災 2019–2024 全是 0：MODIS 500 公尺的燒毀面積看不到台灣這種小面積的火，
  用 hints 寫明，不是沒有森林火災（林保署的森林火災對照在野火主題原本的台灣附註）。
輸出 public/data/topics/wildfires/：fire-co2.json（公噸）、fao-burned/{forest,savanna}.json（公頃）。
"""

from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import faostat

OUT = OUT_DIR / "topics" / "wildfires"
FIRST = 1996
FAO_TIER1 = "3050"
TW_HINT = ("台灣的值是 0：MODIS 500 公尺的燒毀面積看不到台灣這種小面積的火，不是沒有森林火災",
           "Taiwan shows 0 because MODIS’s 500 m burned-area product cannot see fires as small as Taiwan’s; it does not mean there are no forest fires")


def build() -> None:
    reader = faostat._csv("GI")
    col = {k: i for i, k in enumerate(next(reader))}
    cache: dict[str, str | None] = {}
    wanted = {("6992", "7273"): "co2", ("6992", "7246"): "forest", ("6795", "7246"): "savanna"}
    data: dict[str, dict[str, dict[int, float]]] = {v: defaultdict(dict) for v in wanted.values()}
    for r in reader:
        key = wanted.get((r[col["Item Code"]], r[col["Element Code"]]))
        if not key or r[col["Source Code"]] != FAO_TIER1 or not r[col["Value"]]:
            continue
        year = int(r[col["Year"]])
        if year < FIRST:
            continue
        area = faostat._area(r[col["Area Code"]], r[col["Area Code (M49)"]].lstrip("'"), cache)
        if area:
            data[key][area][year] = float(r[col["Value"]])
    last = max(y for s in data["co2"].values() for y in s)
    years = list(range(FIRST, last + 1))
    lic = "CC BY 4.0"
    hints = {"hints": {"TWN": TW_HINT[0]}, "hintsEn": {"TWN": TW_HINT[1]}}

    co2 = dict(data["co2"])
    world = co2.pop("WLD", {})
    write_json(OUT / "fire-co2.json", indicator_file(
        "fire-co2", "公噸", years, {k: [round(s[y] * 1000) if y in s else None for y in years] for k, s in co2.items()},
        aggregates={"WLD": [round(world[y] * 1000) if y in world else None for y in years]}, license=lic, **hints))
    for item in ("forest", "savanna"):
        series = dict(data[item])
        w = series.pop("WLD", {})
        write_json(OUT / "fao-burned" / f"{item}.json", indicator_file(
            "fao-burned", "公頃", years, {k: [round(s[y]) if y in s else None for y in years] for k, s in series.items()},
            aggregates={"WLD": [round(w[y]) if y in w else None for y in years]}, license=lic, **hints))
    print(f"  FAOSTAT 火災 {years[0]}–{last}：森林火災 CO₂ {len(co2)} 國，全球 {world.get(last, 0) / 1000:,.0f} 百萬公噸")
