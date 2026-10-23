"""飲食主題：FAOSTAT 糧食平衡表（熱量、蛋白質、脂肪、各類食物的人均供給量）與營養不足盛行率。

- 糧食平衡表有兩套：舊方法（FBSH，1961–2013）與 2010 年起的新方法（FBS）。
  2009 年以前用舊版、2010 年起用新版，指標檔的 methodBreak 標出接縫，側欄的折線圖畫一條垂直虛線。
  兩版重疊的 2010 年，各國熱量差距的中位數只有 0.3%，但個別國家、個別食物可以差很多（DESIGN.md §8）。
- 新版的稻米是稻穀重量，乘 0.667 換成白米當量才接得上舊版（2010 年世界：新版換算後 54.9、舊版 54.0 公斤）。
  穀物合計也照樣把稻米換算。
- 台灣：FAOSTAT 本身就有（China, Taiwan Province of），跟其他國家同一套方法；
  另外在附註附上農業部《糧食供需年報》同一年的數字對照。
- 「China」(351) 是大陸＋港＋澳＋台的合計，faostat.rows() 已經排除，中國用「China, mainland」。
- 營養不足盛行率（糧食安全指標）是三年平均，標在中間那一年；FAO 對低於 2.5% 的只公布「<2.5」，記成 0。
"""
from __future__ import annotations

from collections import defaultdict
from typing import NamedTuple

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import faostat

KCAL, PROTEIN, FAT, KG = 664, 674, 684, 645  # 每人每日熱量、蛋白質、脂肪；每人每年供給量（公斤）
GRAND_TOTAL, ANIMAL = 2901, 2941
NEW_FROM = 2010  # 新方法（FBS）的第一年
RICE_NEW, RICE_OLD, CEREALS = 2807, 2805, 2905  # 新版「Rice and products」是稻穀重量，舊版是白米當量
MILLED = 0.667  # 稻穀 → 白米，跟農業主題算自給率用的一樣


class Food(NamedTuple):
    id: str
    item: int  # 糧食平衡表的品項代碼（新舊版相同，稻米例外）
    historic: int | None = None  # 舊版代碼不同時


# 地圖上可選的食物（人均供給量），與 src/topics/diet.ts 的 FOODS 對應
FOODS = [
    Food("meat", 2943),  # 肉類合計，不含內臟
    Food("beef", 2731),  # 牛肉（含水牛）
    Food("pork", 2733),
    Food("poultry", 2734),
    Food("fish", 2960),  # 魚類與海鮮
    Food("milk", 2948),  # 乳品（不含奶油），生乳當量
    Food("eggs", 2949),
    Food("cereals", CEREALS),  # 穀物（不含啤酒）
    Food("rice", RICE_NEW, RICE_OLD),
    Food("wheat", 2511),  # 小麥與製品，以小麥計
    Food("maize", 2514),
    Food("roots", 2907),  # 薯類（澱粉根莖）
    Food("pulses", 2911),  # 乾豆類（不含大豆）
    Food("vegetables", 2918),
    Food("fruit", 2919),  # 水果（不含葡萄酒）
    Food("sugar", 2909),  # 糖與甜味劑（含蜂蜜）
    Food("vegetable-oils", 2914),
    Food("alcohol", 2924),  # 酒類，以飲料重量計
]

# 側欄的熱量來源：糧食平衡表的大類合併成 8 類，堆疊由下而上（動物性在下面）。
# 「其他」= 總熱量 − 這 8 類：豆類、堅果、油料作物、酒類、咖啡茶等刺激品、香料與其他
GROUPS = [
    ("meat", (2943, 2945)),  # 肉類、內臟
    ("fish", (2960, 2961)),  # 魚類海鮮、其他水產（含藻類）
    ("dairy-eggs", (2948, 2949)),
    ("fats", (2914, 2946)),  # 植物油、動物油脂（含奶油）
    ("sugar", (2908, 2909)),  # 糖料作物、糖與甜味劑
    ("roots", (2907,)),
    ("cereals", (CEREALS,)),
    ("fruit-veg", (2918, 2919)),
]
GROUP_ITEMS = {GRAND_TOTAL} | {code for _, codes in GROUPS for code in codes}

# 農業部《112 年糧食供需年報》（2023 年）。開放資料平台上的糧食平衡表只到 2015 年，數字照年報抄錄：
# https://eng.moa.gov.tw/upload/files/eng_web_structure/2505782/BB_B01_112.pdf
MOA_YEAR = 2023
MOA_TOTAL = (
    "農業部《糧食供需年報》{year} 年：{value}",
    "Taiwan Ministry of Agriculture food balance sheet, {year}: {value}",
)
# 指標 -> (中文的值, 英文的值, 數值)；熱量含酒類（年報的總計不含酒類，另列「酒類（參考）」）
MOA = {
    "energy": ("每人每日 2,802 大卡（含酒類；不含酒類 2,738 大卡）", "2,802 kcal per person per day (including alcoholic beverages; 2,738 without)"),
    "protein": ("每人每日 89.8 公克", "89.8 g per person per day"),
    "fat": ("每人每日 116.8 公克", "116.8 g per person per day"),
    "animal-share": (
        "動物性食物（肉、蛋、水產、乳品、動物油脂）占熱量 26.2%（以含酒類的 2,802 大卡計）",
        "animal products (meat, eggs, seafood, dairy, animal fats) supply 26.2% of calories (of 2,802 kcal including alcohol)",
    ),
}
# 食物 -> (公斤, 中文補充, 英文補充)。口徑不同的地方寫在補充說明
MOA_SUPPLY = {
    "meat": (87.2, "", ""),
    "beef": (7.6, "", ""),
    "pork": (35.6, "", ""),
    "poultry": (42.8, "家禽肉", "poultry meat"),
    "fish": (31.7, "水產類", "fish and seafood"),
    "milk": (49.1, "乳品類，奶粉以 1:8 還原成鮮乳", "dairy, milk powder converted to fresh milk at 1:8"),
    "eggs": (22.0, "112 年起每顆蛋以 60 克折算", "eggs counted at 60 g each since 2023"),
    "cereals": (84.1, "小麥以麵粉重量計", "wheat counted as flour"),
    "rice": (42.1, "白米", "milled rice"),
    "wheat": (36.2, "麵粉重量", "flour weight"),
    "maize": (5.5, "", ""),
    "roots": (25.9, "薯類", "starchy roots"),
    "vegetables": (104.8, "", ""),
    "fruit": (115.7, "果品類", "fruit"),
    "sugar": (26.3, "糖及蜂蜜", "sugar and honey"),
    "vegetable-oils": (19.0, "植物油", "vegetable oils"),
    "alcohol": (31.0, "只有葡萄酒與啤酒（參考項目）", "wine and beer only (reference item)"),
}

KCAL_UNIT, GRAM_UNIT, KG_UNIT = (" 大卡", " kcal"), (" 公克", " g"), (" 公斤", " kg")

POU_ITEM = "210041"  # Prevalence of undernourishment (percent) (3-year average)
POU_BELOW = "<2.5"


def build() -> None:
    out = OUT_DIR / "topics" / "diet"

    print("  讀取糧食平衡表（新版 2010 年起、舊版 1961–2013）…")
    wanted = GROUP_ITEMS | {ANIMAL} | {f.item for f in FOODS} | {f.historic for f in FOODS if f.historic}
    # (element, item, area) -> {year: value}；舊版只取 2009 年以前，新版 2010 年起
    data: dict[tuple[int, int, str], dict[int, float]] = defaultdict(dict)
    covered: dict[str, set[str]] = {"FBSH": set(), "FBS": set()}
    for dataset in ("FBSH", "FBS"):
        for r in faostat.rows(dataset, {KCAL, PROTEIN, FAT, KG}, wanted):
            if (dataset == "FBS") != (r.year >= NEW_FROM):
                continue
            item = RICE_NEW if r.item == RICE_OLD else r.item
            value = r.value
            if dataset == "FBS" and r.element == KG and r.item == RICE_NEW:
                value *= MILLED
            data[(r.element, item, r.area)][r.year] = value
            covered[dataset].add(r.area)
    # 穀物合計裡的稻米也換成白米當量
    for (element, item, area), series in list(data.items()):
        if element == KG and item == CEREALS:
            rice = data.get((KG, RICE_NEW, area), {})
            for y in series:
                if y >= NEW_FROM and y in rice:
                    series[y] -= rice[y] / MILLED * (1 - MILLED)

    def by_area(element: int, item: int) -> dict[str, dict[int, float]]:
        return {area: s for (el, it, area), s in data.items() if el == element and it == item}

    energy = by_area(KCAL, GRAND_TOTAL)
    years = year_span({a: s for a, s in energy.items() if a != "WLD"})
    # 新版沒有的國家（日本、貝南、馬利、查德等）只有 2009 年以前
    old_only = sorted((covered["FBSH"] - covered["FBS"]) - {"WLD"})
    print(f"  {years[0]}–{years[-1]}；只有舊版的：{', '.join(old_only)}")

    def fbs_file(
        key: str, unit: str, series: dict[str, dict[int, float]], digits: int,
        moa: tuple[str, str] | None, fao_unit: tuple[str, str],
    ) -> dict:
        world = series.get("WLD", {})
        notes = {a: OLD_ONLY_NOTE[0] for a in old_only if a in series}
        notes_en = {a: OLD_ONLY_NOTE[1] for a in old_only if a in series}
        if moa and "TWN" in series:
            fao = series["TWN"].get(MOA_YEAR)
            fao_text = f"{fao:,.{digits}f}" if fao is not None else None
            notes["TWN"] = MOA_TOTAL[0].format(year=MOA_YEAR, value=moa[0]) + (
                f"；FAO 同年是 {fao_text}{fao_unit[0]}" if fao_text else ""
            )
            notes_en["TWN"] = MOA_TOTAL[1].format(year=MOA_YEAR, value=moa[1]) + (
                f"; FAO: {fao_text}{fao_unit[1]}" if fao_text else ""
            )
        return indicator_file(
            key, unit, years,
            {a: to_series(s, years, digits) for a, s in series.items() if a != "WLD"},
            aggregates={"WLD": to_series(world, years, digits)},
            methodBreak=NEW_FROM,
            notes=notes,
            notesEn=notes_en,
        )

    write_json(out / "energy.json", fbs_file("energy", "大卡/人/日", energy, 0, MOA["energy"], KCAL_UNIT))
    write_json(out / "protein.json", fbs_file("protein", "公克/人/日", by_area(PROTEIN, GRAND_TOTAL), 1, MOA["protein"], GRAM_UNIT))
    write_json(out / "fat.json", fbs_file("fat", "公克/人/日", by_area(FAT, GRAND_TOTAL), 1, MOA["fat"], GRAM_UNIT))

    animal = by_area(KCAL, ANIMAL)
    share = {
        area: {y: v / energy[area][y] * 100 for y, v in s.items() if energy.get(area, {}).get(y)}
        for area, s in animal.items()
    }
    write_json(out / "animal-share.json", fbs_file("animal-share", "%", share, 1, MOA["animal-share"], ("%", "%")))

    for food in FOODS:
        moa = MOA_SUPPLY.get(food.id)
        note = None
        if moa:
            kg, zh, en = moa
            note = (f"{kg} 公斤" + (f"（{zh}）" if zh else ""), f"{kg} kg" + (f" ({en})" if en else ""))
        write_json(
            out / "supply" / f"{food.id}.json",
            fbs_file(f"supply/{food.id}", "公斤/人/年", by_area(KG, food.item), 1, note, KG_UNIT),
        )

    # 側欄：各國每年各類食物提供的熱量
    countries = 0
    for area, total in energy.items():
        if area == "WLD":
            continue
        values: dict[str, list] = {}
        for group, codes in GROUPS:
            parts = [data.get((KCAL, code, area), {}) for code in codes]
            values[group] = [_sum(p.get(y) for p in parts) for y in years]
        values["other"] = [
            None if total.get(y) is None else max(0, round(total[y] - sum(values[g][i] or 0 for g, _ in GROUPS)))
            for i, y in enumerate(years)
        ]
        write_json(
            out / "countries" / f"{area}.json",
            {"years": years, "methodBreak": NEW_FROM, "groups": [g for g, _ in GROUPS] + ["other"], "values": values},
            quiet=True,
        )
        countries += 1
    print(f"  {countries} 個國家的熱量來源")

    print("  讀取營養不足盛行率…")
    pou: dict[str, dict[int, float]] = defaultdict(dict)
    below: set[str] = set()
    for r in faostat.suite_rows("FS", {POU_ITEM}):
        first, last = (int(y) for y in r.year.split("-"))
        middle = (first + last) // 2
        if r.value == POU_BELOW:
            pou[r.area][middle] = 0
            below.add(r.area)
        else:
            pou[r.area][middle] = float(r.value)
    pou_years = year_span({a: s for a, s in pou.items() if a != "WLD"})
    write_json(
        out / "undernourishment.json",
        indicator_file(
            "undernourishment", "%", pou_years,
            {a: to_series(s, pou_years, 1) for a, s in pou.items() if a != "WLD"},
            aggregates={"WLD": to_series(pou.get("WLD", {}), pou_years, 1)},
            notes={a: BELOW_NOTE[0] for a in sorted(below) if a != "WLD"},
            notesEn={a: BELOW_NOTE[1] for a in sorted(below) if a != "WLD"},
        ),
    )

    write_json(
        out / "manifest.json",
        {
            "topic": "diet",
            "generatedAt": now_iso(),
            "source": "FAOSTAT (FBS, FBSH, Suite of Food Security Indicators)",
            "methodBreak": NEW_FROM,
            "foods": [f.id for f in FOODS],
        },
    )


OLD_ONLY_NOTE = (
    f"FAOSTAT 新版糧食平衡表（{NEW_FROM} 年起）沒有這個國家，只有 {NEW_FROM - 1} 年以前的舊版",
    f"Not in FAOSTAT's new food balance sheets ({NEW_FROM} onward); only the old series up to {NEW_FROM - 1}",
)
BELOW_NOTE = (
    "標成「< 2.5%」的年份，FAO 只公布低於 2.5%，檔案裡記成 0",
    "Years shown as “< 2.5%” are reported by FAO only as below 2.5% and stored as 0",
)


def _sum(values) -> float | None:
    present = [v for v in values if v is not None]
    return round(sum(present)) if present else None
