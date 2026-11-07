"""糧食與農業系統的溫室氣體、碳排放的經濟損害（2026-11-07，製作手冊第二十五批 476，候選 1137、1145；擴充「溫室氣體排放」）。

- 農糧系統的排放：FAOSTAT「Emissions Totals」（GT，CC BY 4.0），元素 723113（CO₂eq，AR5，kt），只用 Source=FAO TIER 1
  （另一套 UNFCCC 是各國申報的，混用會重複計），1990–2024 年。品項：Agrifood systems（6518）＝農場內（Farm gate 6996）
  ＋毀林等土地利用變化（Land-use change 6516）＋農場前後（Pre- and post-production 6517：肥料與農藥製造、加工、包裝、
  運輸、零售、家戶、廢棄物）。agrifood/{all,farm,luc,prepost}.json，單位換成公噸。
- 占全國排放：分子分母都不含土地利用（LULUCF）：（IPCC Agriculture 1711 ＋ On-farm energy use 6994 ＋
  Pre- and post-production 6517）÷ All sectors without LULUCF 6829。農糧系統的總量含毀林（Land-use change）、
  排乾的泥炭地與火災，這些在國家清冊屬於 LULUCF，分母不含時會超過 100%（巴西 186%、白俄羅斯 96%）。
  仍超過 100% 的地區（格陵蘭、百慕達等屬地，FAOSTAT 的全國總排放不完整）那一年不收。
- 碳排放的經濟損害：世界銀行 WDI NY.ADJ.DCO2.GN.ZS（CC BY 4.0，來源是世界銀行自己的 Changing Wealth of Nations），
  1970–2021 年，latestWithin 2（敘利亞到 2020、土庫曼到 2019 年）；台灣沒有（WDI 不收台灣）。
"""

from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import faostat, worldbank

OUT = OUT_DIR / "topics" / "climate"
ITEMS = {"6518": "all", "6996": "farm", "6516": "luc", "6517": "prepost", "6829": "total", "1711": "ipcc-ag",
         "6994": "farm-energy"}
CO2EQ_AR5 = "723113"
FAO_TIER1 = "3050"
FIRST = 1990


def _gt() -> dict[str, dict[str, dict[int, float]]]:
    """{item: {iso3: {年: 公噸 CO₂eq}}}"""
    reader = faostat._csv("GT")
    col = {k: i for i, k in enumerate(next(reader))}
    out: dict[str, dict[str, dict[int, float]]] = {k: defaultdict(dict) for k in ITEMS.values()}
    cache: dict[str, str | None] = {}
    for r in reader:
        if r[col["Element Code"]] != CO2EQ_AR5 or r[col["Source Code"]] != FAO_TIER1:
            continue
        item = ITEMS.get(r[col["Item Code"]])
        if not item or not r[col["Value"]]:
            continue
        area = faostat._area(r[col["Area Code"]], r[col["Area Code (M49)"]].lstrip("'"), cache)
        if area:
            out[item][area][int(r[col["Year"]])] = float(r[col["Value"]]) * 1000
    return out


def build() -> None:
    gt = _gt()
    last = max(max(v) for v in gt["all"].values() if v)
    years = list(range(FIRST, last + 1))
    for item in ("all", "farm", "luc", "prepost"):
        data = dict(gt[item])  # 複製一份：gt 的 WLD 下面算全世界的占比還要用
        world = data.pop("WLD", {})
        values = {k: [round(v[y]) if y in v else None for y in years] for k, v in data.items() if v}
        write_json(OUT / "agrifood" / f"{item}.json", indicator_file(
            "agrifood-ghg", "公噸", years, values, aggregates={"WLD": [round(world[y]) if y in world else None for y in years]},
            license="CC BY 4.0"))

    share: dict[str, list[float | None]] = {}
    dropped = set()
    for k, s in gt["all"].items():
        if k == "WLD":
            continue
        row: list[float | None] = []
        for y in years:
            total = gt["total"].get(k, {}).get(y)
            if y not in s or not total:
                row.append(None)
                continue
            part = gt["ipcc-ag"].get(k, {}).get(y, 0) + gt["farm-energy"].get(k, {}).get(y, 0) + gt["prepost"].get(k, {}).get(y, 0)
            v = part / total * 100
            if v > 100:
                dropped.add(k)
                row.append(None)
            else:
                row.append(round(v, 1))
        if any(x is not None for x in row):
            share[k] = row
    w = {item: gt[item].get("WLD", {}) for item in ("ipcc-ag", "farm-energy", "prepost", "total")}
    world_share = [round((w["ipcc-ag"].get(y, 0) + w["farm-energy"].get(y, 0) + w["prepost"].get(y, 0)) / w["total"][y] * 100, 1)
                   if w["total"].get(y) else None for y in years]
    write_json(OUT / "agrifood-share.json", indicator_file("agrifood-share", "%", years, share,
                                                           aggregates={"WLD": world_share}, license="CC BY 4.0"))
    print(f"  農糧系統排放 {len(gt['all'])} 個地區、{years[0]}–{last}；占比超過 100% 不收：{sorted(dropped)}")

    damage, _ = worldbank.fetch("NY.ADJ.DCO2.GN.ZS", 1970, 2030)
    dyears = list(range(1970, max(max(v) for v in damage.values() if v) + 1))
    write_json(OUT / "co2-damage.json", indicator_file(
        "co2-damage", "%", dyears, {k: [round(v[y], 2) if y in v else None for y in dyears] for k, v in damage.items() if v},
        latestWithin=2, noValue={"TWN": "世界銀行的資料庫不收台灣"},
        noValueEn={"TWN": "The World Bank’s database does not cover Taiwan"}, license="CC BY 4.0"))
