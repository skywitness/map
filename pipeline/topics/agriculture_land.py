"""農業：各國收穫面積最大的作物、農地占國土的比例、牲畜密度（2026-11-07，製作手冊第二十五批 440，合併候選 1069、1070、1073；
步驟 agriculture-land，輸出 topics/agriculture/）。

- 資料：FAOSTAT（CC BY 4.0）的 QCL 收穫面積（element 5312）、RL 土地利用（5110 面積，千公頃）、EK 家畜型態（7213 每公頃
  農地的家畜單位、7211 各畜種占家畜單位的比例）。**Flag X（外部機構提供）不用**（FAO 條款寫第三方資料要原提供者同意才能再
  散布；使用者 2026-11-05 對啤酒產量的決定，DESIGN.md 第 8 節）。
- 最大的作物：剔除彙總項（Item Code ≥ 1700，例如 Cereals, primary）。某國某年 X 的作物面積比非 X 的最大作物還大時，那一年
  不畫（不知道最大的是哪一個；台灣 2024 年的稻米就是 X）。作物併成八組上色（GROUPS），滑過看實際的作物與前五名。
  多年生作物（椰子、油棕、橄欖）的收穫面積跟一年生作物口徑不同，說明寫明。
- 農地占國土：農地（6610）、耕地（6621）、永久草地（6655）÷ 陸地面積（6601），四個都不是 X 才算。
- 牲畜密度：農地不到 MIN_FARMLAND（2 萬公頃）的不比（新加坡、香港的農地分母極小）。
- 每公頃農地的農業產值（第二十五批 441，候選 1071）：RL 的 6610 × 7278（2014–2016 年固定價國際元／公頃，FAO 算的，旗標 E），
  農地不到 MIN_FARMLAND_VALUE（1 萬公頃）的不比。手冊合併的 1072（每位農業就業者的附加價值、農業就業占比）在 FAOSTAT 的
  OEA 全是 Flag X（ILO 提供），不用，等使用者決定要不要改用世界銀行 WDI。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import faostat
from topics.agriculture_names import ZH_NAMES

OUT = OUT_DIR / "topics" / "agriculture"
FIRST = 1961
CROP_LAST, LAND_LAST, LSU_LAST = 2024, 2024, 2023
MIN_FARMLAND = 20  # 千公頃
MIN_FARMLAND_VALUE = 10  # 千公頃（每公頃產值）

# 作物 → 上色的組（src/topics/agriculture.ts 的 TOP_CROP_GROUPS）；沒列的是 8「蔬菜、水果與其他」
WHEAT, MAIZE, RICE, CEREALS, PULSES_OIL, ROOTS_CANE, TREE, OTHER = range(1, 9)
GROUPS = {15: WHEAT, 56: MAIZE, 27: RICE}
GROUPS |= dict.fromkeys([44, 71, 75, 79, 83, 89, 92, 94, 97, 101, 103, 108], CEREALS)
GROUPS |= dict.fromkeys([176, 181, 187, 191, 195, 197, 201, 203, 205, 210, 211, 236, 242, 263, 265, 267, 270, 280,
                         289, 292, 296, 299, 305, 310, 311, 312, 333, 336, 339], PULSES_OIL)
GROUPS |= dict.fromkeys([116, 122, 125, 135, 136, 137, 149, 156, 157], ROOTS_CANE)
GROUPS |= dict.fromkeys([249, 254, 260, 577, 656, 661, 667, 687, 689, 698, 217, 221, 222, 223, 224, 225, 226, 836, 839], TREE)
# 英文名稱（FAOSTAT 的寫法太長的改短）
EN = {463: "Other vegetables", 603: "Other tropical fruits", 619: "Other fruits", 339: "Other oil seeds",
      211: "Other pulses", 149: "Other roots and tubers", 242: "Groundnuts", 125: "Cassava", 489: "Plantains",
      656: "Coffee", 254: "Oil palm fruit", 249: "Coconuts", 236: "Soybeans", 270: "Rapeseed", 687: "Pepper",
      15: "Wheat", 56: "Maize", 27: "Rice"}
LIVESTOCK = {866: ("牛", "cattle"), 946: ("水牛", "buffalo"), 976: ("綿羊", "sheep"), 1016: ("山羊", "goats"),
             1034: ("豬", "pigs"), 1057: ("雞", "chickens"), 1096: ("馬", "horses"), 1107: ("驢", "asses"),
             1110: ("騾", "mules"), 1126: ("駱駝", "camels")}


def _zh(item: int, name: str) -> str:
    return ZH_NAMES.get(item) or name


def _en(item: int, name: str) -> str:
    return EN.get(item) or name.split(",")[0]


def _wan(ha: float) -> str:
    """公頃 → 中文的萬公頃（1 萬以下寫公頃）"""
    return f"{ha / 1e4:,.1f} 萬公頃" if ha >= 1e4 else f"{ha:,.0f} 公頃"


def _top_crops() -> None:
    area: dict[tuple[str, int], dict[int, float]] = defaultdict(dict)
    xmax: dict[tuple[str, int], float] = defaultdict(float)
    names: dict[int, str] = {}
    for r in faostat.rows("QCL", {5312}):
        if r.item >= 1700 or r.area == "WLD":
            continue
        names[r.item] = r.item_name
        if r.flag == "X":
            xmax[(r.area, r.year)] = max(xmax[(r.area, r.year)], r.value)
        else:
            area[(r.area, r.year)][r.item] = r.value
    years = list(range(FIRST, CROP_LAST + 1))
    series: dict[str, dict[int, int]] = defaultdict(dict)
    unknown: dict[str, list[int]] = defaultdict(list)
    for (a, y), d in area.items():
        if y > CROP_LAST or not d:
            continue
        top = max(d, key=d.get)
        if xmax.get((a, y), 0) > d[top]:
            unknown[a].append(y)
            continue
        series[a][y] = GROUPS.get(top, OTHER)
    hints, hints_en = {}, {}
    for a in series:
        y = max(series[a])
        ranked = sorted(area[(a, y)].items(), key=lambda kv: -kv[1])[:5]
        hints[a] = f"{y} 年收穫面積：" + "、".join(f"{_zh(i, names[i])} {_wan(v)}" for i, v in ranked)
        hints_en[a] = f"Harvested area in {y}: " + ", ".join(f"{_en(i, names[i])} {v:,.0f} ha" for i, v in ranked)
        if CROP_LAST in unknown.get(a, []):
            hints[a] += f"（{CROP_LAST} 年有外部機構提供的數字比最大的作物還大，不畫）"
            hints_en[a] += f" ({CROP_LAST} not shown: a figure supplied by an outside organisation is larger than the top crop)"
    values = {a: to_series(s, years, 0) for a, s in sorted(series.items())}
    write_json(OUT / "top-crop.json", indicator_file("top-crop", "類別", years, values, hints=hints, hintsEn=hints_en,
                                                     license="CC BY 4.0"))
    from collections import Counter
    last = Counter(GROUPS.get(max(area[(a, CROP_LAST)], key=area[(a, CROP_LAST)].get), OTHER)
                   for a in series if CROP_LAST in series[a])
    crops = Counter(_zh(max(area[(a, CROP_LAST)], key=area[(a, CROP_LAST)].get), "") for a in series if CROP_LAST in series[a])
    print(f"  最大的作物：{len(series)} 國；{CROP_LAST} 年 {sum(last.values())} 國，組 {sorted(last.items())}；"
          f"{CROP_LAST} 年不畫 {sorted(a for a in unknown if CROP_LAST in unknown[a])}")
    print(f"    作物 {crops.most_common(30)}")
    print(f"    台灣：{hints.get('TWN')}；最近一年 {max(series.get('TWN', {0: 0}))}")


def _land() -> dict[str, dict[int, float]]:
    area: dict[tuple[str, int], dict[int, float]] = defaultdict(dict)
    xs: set[tuple[str, int]] = set()
    for r in faostat.rows("RL", {5110}, {6601, 6610, 6621, 6655}):
        if r.flag == "X":
            xs.add((r.area, r.year))
            continue
        area[(r.area, r.year)][r.item] = r.value
    years = list(range(FIRST, LAND_LAST + 1))
    farmland: dict[str, dict[int, float]] = defaultdict(dict)
    for item, key in ((6610, "agricultural"), (6621, "arable"), (6655, "pasture")):
        series: dict[str, dict[int, float]] = defaultdict(dict)
        for (a, y), d in area.items():
            if y > LAND_LAST or (a, y) in xs or not d.get(6601) or item not in d:
                continue
            series[a][y] = round(d[item] / d[6601] * 100, 1)
            if item == 6610:
                farmland[a][y] = d[item]
        values = {a: to_series(s, years, 1) for a, s in sorted(series.items())}
        write_json(OUT / "farmland-share" / f"{key}.json", indicator_file("farmland-share", "%", years, values, license="CC BY 4.0"))
        last = sorted(((s[LAND_LAST], a) for a, s in series.items() if LAND_LAST in s), reverse=True)
        print(f"  {key} {LAND_LAST}：{len(last)} 國；最高 {last[:6]}；台灣 {series.get('TWN', {}).get(LAND_LAST)}；"
              f"世界 {series.get('WLD', {}).get(LAND_LAST)}；日本 {series.get('JPN', {}).get(LAND_LAST)}")
    return farmland


def _livestock(farmland: dict[str, dict[int, float]]) -> None:
    density: dict[str, dict[int, float]] = defaultdict(dict)
    share: dict[str, dict[int, float]] = defaultdict(dict)
    for r in faostat.rows("EK", {7213, 7211}):
        if r.flag == "X":
            continue
        if r.element == 7213 and r.item == 1752:
            density[r.area][r.year] = r.value
        elif r.element == 7211 and r.item in LIVESTOCK and r.year == LSU_LAST:
            share[r.area][r.item] = r.value
    years = list(range(FIRST, LSU_LAST + 1))
    small = sorted(a for a in density if a != "WLD" and farmland.get(a) and farmland[a].get(max(farmland[a])) < MIN_FARMLAND)
    values = {a: to_series(s, years, 2) for a, s in sorted(density.items()) if a not in small}
    hints, hints_en = {}, {}
    for a, s in share.items():
        top = sorted(s.items(), key=lambda kv: -kv[1])[:3]
        hints[a] = f"{LSU_LAST} 年家畜單位：" + "、".join(f"{LIVESTOCK[i][0]} {v:.0f}%" for i, v in top if v >= 1)
        hints_en[a] = f"Livestock units in {LSU_LAST}: " + ", ".join(f"{LIVESTOCK[i][1]} {v:.0f}%" for i, v in top if v >= 1)
    no = {a: "農地不到 2 萬公頃，分母太小，不比" for a in small}
    no_en = {a: "Less than 20,000 ha of farmland: the denominator is too small to compare" for a in small}
    write_json(OUT / "livestock-density.json", indicator_file("livestock-density", "LSU/公頃", years, values, hints=hints,
                                                              hintsEn=hints_en, noValue=no, noValueEn=no_en, license="CC BY 4.0"))
    last = sorted(((v[-1], a) for a, v in values.items() if v[-1] is not None and a != "WLD"), reverse=True)
    print(f"  牲畜密度 {LSU_LAST}：{len(last)} 國，不比 {small}；最高 {last[:8]}；台灣 {values.get('TWN', [None])[-1]} "
          f"（第 {[a for _, a in last].index('TWN') + 1 if 'TWN' in [a for _, a in last] else '-'}）；世界 {values.get('WLD', [None])[-1]}")
    print(f"    {hints.get('TWN')}；紐西蘭 {hints.get('NZL')}；丹麥 {hints.get('DNK')}")


def _value_per_ha(farmland: dict[str, dict[int, float]]) -> None:
    series: dict[str, dict[int, float]] = defaultdict(dict)
    for r in faostat.rows("RL", {7278}, {6610}):
        if r.flag != "X" and r.year <= LAND_LAST:
            series[r.area][r.year] = r.value
    years = list(range(FIRST, LAND_LAST + 1))
    small = sorted(a for a in series if a != "WLD" and farmland.get(a) and farmland[a].get(max(farmland[a])) < MIN_FARMLAND_VALUE)
    values = {a: to_series(s, years, 0) for a, s in sorted(series.items()) if a not in small}
    no = {a: "農地不到 1 萬公頃，分母太小，不比" for a in small}
    no_en = {a: "Less than 10,000 ha of farmland: the denominator is too small to compare" for a in small}
    write_json(OUT / "value-per-ha.json", indicator_file("value-per-ha", "國際元/公頃", years, values, noValue=no, noValueEn=no_en,
                                                         license="CC BY 4.0"))
    last = sorted(((s[LAND_LAST], a) for a, s in series.items() if LAND_LAST in s and a not in small and a != "WLD"), reverse=True)
    rank = [a for _, a in last]
    print(f"  每公頃產值 {LAND_LAST}：{len(last)} 國，不比 {len(small)} 個 {small[:12]}；最高 {last[:8]}；"
          f"台灣 {series.get('TWN', {}).get(LAND_LAST)}（第 {rank.index('TWN') + 1 if 'TWN' in rank else '-'}）；世界 {series.get('WLD', {}).get(LAND_LAST)}；"
          f"最低 {last[-4:]}")


def build() -> None:
    _top_crops()
    farmland = _land()
    _livestock(farmland)
    _value_per_ha(farmland)
