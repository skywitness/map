"""熱量自給率：吃的熱量有幾成自己種（2026-11-07，製作手冊第二十五批 443 合併的候選 1077；擴充「農業」）。

FAO 不直接發佈熱量自給率，照日本農林水產省「供給熱量ベースの総合食料自給率」的思路用 FAOSTAT 糧食平衡表（FBS，2010–2023，
CC BY 4.0）自算：
- 每個品項（item < 2900，不含 2901 合計等彙總項）的國產熱量 ＝ 熱量供給（664，大卡／人／日）×（生產量 5511 ÷ 國內供給量 5301）；
  品項自給率不設上限（出口國可以超過 100%，所以全國也可能超過 100%）。
- 畜產品（肉、內臟、動物油脂、奶油、鮮奶油、蛋、奶）再乘「飼料自給率」：各品項的飼料用量（5521，千公噸）加權的
  min(生產量 ÷ 國內供給量, 1)。水產不乘。
- 熱量自給率 ＝ Σ 國產熱量 ÷ Σ 熱量供給。國內供給量小於等於 0 的品項略過。
使用者 2026-11-07 決定：各國一律用這個自算值；台灣附註農業部「糧食自給率_熱量」（data.gov.tw 87929，政府資料開放授權條款
第 1 版；data.moa.gov.tw 的 agrstatUnit，`agrstat.moa.gov.tw` 已 404）的官方值與口徑差異（農業部另算可食部分、飼料用 TDN 換算等）。
輸出 public/data/topics/agriculture/calorie-self-sufficiency.json。
"""

from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import faostat

OUT = OUT_DIR / "topics" / "agriculture"
PROD, DSQ, FEED, KCAL = 5511, 5301, 5521, 664
LIVESTOCK = {2731, 2732, 2733, 2734, 2735, 2736, 2737, 2740, 2743, 2744, 2848}
FIRST, LAST = 2010, 2023
MOA_URL = ("https://data.moa.gov.tw/service/opendata/agrstatUnit.aspx?item_code=FB0130&dimension_group_code_1=FA01"
           "&FOTT=CSV&IsTransData=1&UnitId=D35")


def _official() -> dict[int, float]:
    out = {}
    with open(download(MOA_URL, "moa", "calorie-self-sufficiency-87929.csv"), encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["dname1"] == "合計":
                out[int(r["year"]) + 1911] = float(r["value"])
    return out


def build() -> None:
    v: dict[tuple[str, int], dict[int, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for r in faostat.rows("FBS", {PROD, DSQ, FEED, KCAL}):
        if r.item < 2900 and FIRST <= r.year <= LAST:
            v[(r.area, r.year)][r.item][r.element] = r.value
    years = list(range(FIRST, LAST + 1))
    data: dict[str, dict[int, float]] = defaultdict(dict)
    for (area, y), items in v.items():
        feed_w = feed_ssr = 0.0
        for d in items.values():
            if d.get(FEED, 0) > 0 and d.get(DSQ, 0) > 0:
                feed_w += d[FEED]
                feed_ssr += d[FEED] * min(d.get(PROD, 0) / d[DSQ], 1)
        feed_rate = feed_ssr / feed_w if feed_w else 1.0
        total = domestic = 0.0
        for item, d in items.items():
            kcal = d.get(KCAL, 0)
            if kcal <= 0 or d.get(DSQ, 0) <= 0:
                continue
            ssr = d.get(PROD, 0) / d[DSQ]
            total += kcal
            domestic += kcal * ssr * (feed_rate if item in LIVESTOCK else 1)
        if total > 0:
            data[area][y] = domestic / total * 100
    official = _official()
    values = {a: [round(s[y], 1) if y in s else None for y in years] for a, s in sorted(data.items()) if a != "WLD"}
    tw = data.get("TWN", {}).get(LAST)
    notes = {"TWN": f"農業部公布的熱量自給率：{LAST} 年 {official[LAST]:.2f}%、{max(official)} 年 {official[max(official)]:.2f}%。"
                    "這裡跟其他國家一樣用 FAO 糧食平衡表自算，農業部另外算可食部分、飼料換算等，口徑不同，所以數字差不少。"}
    notes_en = {"TWN": f"The Ministry of Agriculture puts Taiwan's calorie self-sufficiency at {official[LAST]:.2f}% in {LAST} "
                       f"and {official[max(official)]:.2f}% in {max(official)}. The value here is computed from FAO food balance "
                       "sheets like every other country; the ministry's own method (edible portions, feed conversion and so on) differs, "
                       "so the figures diverge."}
    write_json(OUT / "calorie-self-sufficiency.json", indicator_file(
        "calorie-self-sufficiency", "%", years, values, latestWithin=1, notes=notes, notesEn=notes_en,
        license="CC BY 4.0", attribution="Computed from FAOSTAT Food Balances (FBS); Taiwan official figures: Ministry of Agriculture"))
    top = sorted(((s[LAST], a) for a, s in data.items() if LAST in s and a != "WLD"), reverse=True)
    print(f"  熱量自給率 {LAST}：{len(top)} 國；最高 {[(round(x, 1), a) for x, a in top[:10]]}；最低 {[(round(x, 1), a) for x, a in top[-8:]]}")
    print(f"  台灣 {LAST} 自算 {tw and round(tw, 1)}、農業部 {official[LAST]:.2f}（{max(official)} 年 {official[max(official)]:.2f}）；"
          f"{[(k, round(data[k][LAST], 1)) for k in ('KOR', 'JPN', 'CHN', 'USA', 'FRA', 'DEU', 'GBR', 'AUS', 'CAN', 'IND', 'SGP', 'NLD') if LAST in data.get(k, {})]}")
