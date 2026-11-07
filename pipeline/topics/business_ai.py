"""AI 發展的擴充：企業用了多少 AI 與雲端（2026-11-07，製作手冊第二十七批 595，候選 1318；步驟 business-ai，
輸出 topics/ai/）。

- OECD ICT Access and Usage by Businesses（`OECD.STI.DEP,DSD_ICT_B@DF_BUSINESSES,1.1`，sdmx.oecd.org，OECD 資料條款／
  CC BY 4.0；歐洲國家的數字來自 Eurostat 的企業 ICT 調查），2020 年起。10 人以上的企業（SIZE_CLASS S_GE10）、全部產業
  （ACTIVITY _T）、占企業的 %（PT_ENT）。
  - G14_B 用 AI 的企業，子項目依規模：S_GE10 全部、S10T49 小、S50T249 中、S_GE250 大。
  - G3_B 買雲端運算服務的企業。
  - 側欄：G14A–H 八種 AI 技術、G14I–O 七種用途。
- 手冊的陷阱：「用 AI」的定義會變——2025 年的問卷多了一種技術（G14D 生成圖片、影片、聲音），標 methodBreak 2025；
  10 人以下的企業不在調查裡。只有 30 幾個經濟體（歐洲加南韓、巴西等），台灣沒有。
"""
from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "ai"
URL = ("https://sdmx.oecd.org/public/rest/data/OECD.STI.DEP,DSD_ICT_B@DF_BUSINESSES,1.1/all"
       "?startPeriod=2020&dimensionAtObservation=AllDimensions&format=csvfilewithlabels")
SIZES = {"all": "S_GE10", "small": "S10T49", "medium": "S50T249", "large": "S_GE250"}
TECHS = ["G14A_B", "G14B_B", "G14C_B", "G14D_B", "G14E_B", "G14F_B", "G14G_B", "G14H_B"]
USES = ["G14I_B", "G14J_B", "G14K_B", "G14L_B", "G14M_B", "G14N_B", "G14O_B"]
METHOD_BREAK = 2025
NO_TW = ({"TWN": "OECD 的企業 ICT 調查沒有台灣"}, {"TWN": "Taiwan is not in the OECD business ICT survey"})


def build() -> None:
    path = download(URL, "oecd", "ict_businesses_2020.csv")
    data: dict[tuple[str, str], dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["ACTIVITY"] != "_T" or r["UNIT_MEASURE"] != "PT_ENT" or not r["OBS_VALUE"]:
                continue
            c = to_iso3(r["REF_AREA"])
            if c:
                data[(r["MEASURE"], r["SIZE_CLASS"])][c][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    years = sorted({y for s in data[("G14_B", "S_GE10")].values() for y in s})
    extra = dict(noValue=NO_TW[0], noValueEn=NO_TW[1], license="CC BY 4.0")
    for item, size in SIZES.items():
        s = data[("G14_B", size)]
        write_json(OUT / "business-ai" / f"{item}.json", indicator_file(
            f"business-ai-{item}", "%", years, {c: [round(v[y], 3) if y in v else None for y in years] for c, v in sorted(s.items())},
            methodBreak=METHOD_BREAK, **extra))
    cloud = data[("G3_B", "S_GE10")]
    cyears = sorted({y for v in cloud.values() for y in v})
    write_json(OUT / "business-cloud.json", indicator_file(
        "business-cloud", "%", cyears, {c: [round(v[y], 3) if y in v else None for y in cyears] for c, v in sorted(cloud.items())},
        latestWithin=3, **extra))
    detail: dict = {"years": years, "techs": TECHS, "uses": USES, "countries": {}}
    for c in data[("G14_B", "S_GE10")]:
        for key, codes in (("t", TECHS), ("u", USES)):
            detail["countries"].setdefault(c, {})[key] = [[round(data[(m, "S_GE10")].get(c, {}).get(y), 2)
                                                           if y in data[(m, "S_GE10")].get(c, {}) else None for y in years] for m in codes]
    write_json(OUT / "business-ai-detail.json", detail)

    for item, size in SIZES.items():
        s = data[("G14_B", size)]
        v = sorted(((round(x[2025], 1), c) for c, x in s.items() if 2025 in x), reverse=True)
        print(f"  {item} 2025：{len(v)} 國 {v[:8]} … {v[-4:]}")
    print(f"  2024 南韓 {round(data[('G14_B', 'S_GE10')]['KOR'][2024], 1)}；法國 2025 {round(data[('G14_B', 'S_GE10')]['FRA'][2025], 1)}、小企業 {round(data[('G14_B', 'S10T49')]['FRA'][2025], 1)}")
    v = sorted(((round(x[max(x)], 1), c, max(x)) for c, x in cloud.items()), reverse=True)
    print(f"  雲端 {cyears[-1]}：{v[:8]} … {v[-5:]}")
