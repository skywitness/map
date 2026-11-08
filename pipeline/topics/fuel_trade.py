"""石油、天然氣與煤的擴充：燃料進口花掉多少外匯（2026-11-08，製作手冊第二十七批 629，候選 1370；步驟 fuel-trade，
輸出 topics/fossil-fuels/fuel-trade-share/）。

- World Bank WDI（CC BY 4.0，sources/worldbank.py）：TM.VAL.FUEL.ZS.UN（燃料進口占商品進口的 %）與 TX.VAL.FUEL.ZS.UN
  （燃料出口占商品出口的 %），1962 年起；燃料是 SITC 第 3 類（礦物燃料）。
- 台灣：WDI 沒有；用 Harvard 成長實驗室 Atlas of Economic Complexity 的 SITC Rev. 2 一位碼進出口（sources/atlas.py，
  Harvard Dataverse CC0，網站已經在用）的第 3 類 ÷ 十大類合計，口徑跟 WDI 一樣是 SITC 3。附註寫來源。
- 手冊的陷阱：分母是商品進口、不含服務；轉口國（新加坡、荷蘭）進出口都高。
"""
from __future__ import annotations

import csv

from common import OUT_DIR, indicator_file, write_json
from sources import atlas, worldbank

OUT = OUT_DIR / "topics" / "fossil-fuels" / "fuel-trade-share"
CODES = {"import": "TM.VAL.FUEL.ZS.UN", "export": "TX.VAL.FUEL.ZS.UN"}


def _taiwan() -> dict[str, dict[int, float]]:
    out: dict[str, dict[int, dict[str, float]]] = {"import": {}, "export": {}}
    with open(atlas._sitc_csv(atlas.SITC_SECTIONS), encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            code = r["product_sitc_code"]
            if r["country_iso3_code"] != "TWN" or len(code) != 1 or not code.isdigit():
                continue
            y = int(r["year"])
            for d in ("import", "export"):
                if r[f"{d}_value"]:
                    out[d].setdefault(y, {})[code] = float(r[f"{d}_value"])
    return {d: {y: v.get("3", 0) / sum(v.values()) * 100 for y, v in years.items() if sum(v.values()) > 0} for d, years in out.items()}


def build() -> None:
    tw = _taiwan()
    note = ("Harvard Atlas of Economic Complexity 的 SITC 第 3 類（礦物燃料）÷ 商品進出口合計（WDI 沒有台灣）",
            "Harvard Atlas of Economic Complexity, SITC section 3 (mineral fuels) over total merchandise trade (WDI excludes Taiwan)")
    for d, code in CODES.items():
        data, world = worldbank.fetch(code)
        data["TWN"] = tw[d]
        years = sorted({y for s in data.values() for y in s})
        write_json(OUT / f"{d}.json", indicator_file(
            f"fuel-trade-share/{d}", "%", years, {c: [round(s[y], 2) if y in s else None for y in years] for c, s in sorted(data.items())},
            aggregates={"WLD": [round(world[y], 2) if y in world else None for y in years]}, latestWithin=3,
            notes={"TWN": note[0]}, notesEn={"TWN": note[1]}, license="CC BY 4.0"))
        y = 2023
        r = sorted(((c, s[y]) for c, s in data.items() if y in s), key=lambda t: -t[1])
        print(f"  {d} {years[0]}–{years[-1]}，{y} 年 {len(r)} 個：" + "、".join(f"{c} {v:.1f}" for c, v in r[:12]) + " … " + "、".join(f"{c} {v:.1f}" for c, v in r[-6:]))
        print("    " + "、".join(f"{c} {data[c][y]:.1f}" for c in ("TWN", "JPN", "KOR", "CHN", "USA", "DEU", "IND", "SGP", "NLD", "SAU", "RUS", "NOR") if y in data.get(c, {}))
              + f"；世界 {world.get(y)}；台灣 1974 {tw[d].get(1974, 0):.1f}、1981 {tw[d].get(1981, 0):.1f}、2022 {tw[d].get(2022, 0):.1f}")
