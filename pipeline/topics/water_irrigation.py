"""灌溉造成的鹽化、地下水占取水量的比例、水資源使用效率（2026-11-07，製作手冊第二十五批 495，候選 1157、1161、1162；
擴充「各國水資源與森林」）。

FAO AQUASTAT 批次檔（`sources/aquastat.py`，CC BY 4.0）：
- `% of area equipped for irrigation salinized`（灌溉地鹽化的比例）：超過 100% 的（伊拉克 213.3%，鹽化面積與灌溉面積的調查年
  不同）當成無資料。`Area salinized by irrigation`（千公頃）畫比例圓。
- 地下水占淡水取水量＝`Fresh groundwater withdrawal` ÷ `Total freshwater withdrawal`。AQUASTAT 的取水量有已知的錯值
  （科威特 2004–2014 年、瓜地馬拉、蓋亞那，見 water_forest.py），比例超過 100% 的那一年不收。
- `SDG 6.4.1. Water Use Efficiency` 與農業（Irrigated Agriculture）、工業（Industrial）、服務業（Services）三個部門，美元/立方公尺
  （名目美元，沒有平減）。
台灣都不在 AQUASTAT。
輸出 public/data/topics/water-forest/：salinized.json（%）、salinized-area.json（公頃）、groundwater-share.json（%）、
water-efficiency/{item}.json（美元/立方公尺）。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import aquastat

OUT = OUT_DIR / "topics" / "water-forest"
SAL_PCT = "% of area equipped for irrigation salinized"
SAL_AREA = "Area salinized by irrigation"
GW = "Fresh groundwater withdrawal"
FRESH = "Total freshwater withdrawal"
EFF = {"all": "SDG 6.4.1. Water Use Efficiency", "agriculture": "SDG 6.4.1. Irrigated Agriculture Water Use Efficiency",
       "industry": "SDG 6.4.1. Industrial Water Use Efficiency", "services": "SDG 6.4.1. Services Water Use Efficiency"}
FIRST = 1961


def build() -> None:
    aq = aquastat.series({SAL_PCT, SAL_AREA, GW, FRESH, *EFF.values()})
    last = max(y for s in aq[FRESH][0].values() for y in s)
    years = list(range(FIRST, last + 1))
    lic = "CC BY 4.0"

    sal = aq[SAL_PCT][0]
    dropped = sorted(k for k, s in sal.items() if any(v > 100 for v in s.values()))
    write_json(OUT / "salinized.json", indicator_file("salinized", "%", years, {
        k: [round(s[y], 1) if y in s and s[y] <= 100 else None for y in years] for k, s in sal.items()}, license=lic))
    area, area_w = aq[SAL_AREA]
    write_json(OUT / "salinized-area.json", indicator_file("salinized-area", "公頃", years, {
        k: [round(s[y] * 1000) if y in s else None for y in years] for k, s in area.items()},
        aggregates={"WLD": [round(area_w[y] * 1000) if y in area_w else None for y in years]}, license=lic))

    gw, fresh = aq[GW][0], aq[FRESH][0]
    share = {}
    for k, s in gw.items():
        row = [round(s[y] / fresh[k][y] * 100, 1) if y in s and fresh.get(k, {}).get(y) and s[y] <= fresh[k][y] else None for y in years]
        if any(x is not None for x in row):
            share[k] = row
    write_json(OUT / "groundwater-share.json", indicator_file("groundwater-share", "%", years, share, license=lic))

    for item, var in EFF.items():
        countries, world = aq[var]
        write_json(OUT / "water-efficiency" / f"{item}.json", indicator_file(
            "water-efficiency", "美元/立方公尺", years, {k: [round(s[y], 2) if y in s else None for y in years] for k, s in countries.items()},
            aggregates={"WLD": [round(world[y], 2) if y in world else None for y in years]}, license=lic))
    print(f"  鹽化比例 {len(sal)} 國（超過 100% 的不收：{dropped}）、鹽化面積 {len(area)} 國、地下水占比 {len(share)} 國、"
          f"用水效率 {len(aq[EFF['all']][0])} 國，到 {last} 年")
