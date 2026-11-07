"""資料能不能出國：數位貿易的壁壘（新主題，2026-11-07，製作手冊第二十七批 586，候選 1306；步驟 digital-trade，
輸出 topics/digital-trade/）。

- OECD Digital Services Trade Restrictiveness Index（`OECD.TAD.TPD,DSD_STRI@DF_STRI_DIGITAL,1.0`，sdmx.oecd.org，
  OECD 資料條款〔2024 年 7 月起的 Data Explorer 資料預設 CC BY 4.0〕），129 個經濟體，2014–2025，0–1，越高越封閉。
  MEASURE：STRI 整體；CLAS1_6 基礎設施與連線、CLAS1_7 電子交易、CLAS1_8 支付系統、CLAS1_9 智慧財產權、
  CLAS1_10 其他障礙（五個支柱加起來就是整體）。
- 手冊的陷阱：越高越封閉（lowerIsBetter）；有些項目是「沒有相關法律」也算限制，法規還不完整的國家分數偏高，側欄寫明。
- 台灣：OECD 沒有評（灰色加 tooltip）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import oecd

OUT = OUT_DIR / "topics" / "digital-trade"
FLOW = "OECD.TAD.TPD,DSD_STRI@DF_STRI_DIGITAL,1.0"
PILLARS = {"all": "STRI", "infrastructure": "CLAS1_6", "transactions": "CLAS1_7", "payments": "CLAS1_8", "ip": "CLAS1_9", "other": "CLAS1_10"}
NO_TW = ({"TWN": "OECD 沒有評台灣"}, {"TWN": "Taiwan is not covered by the OECD index"})


def build() -> None:
    data = {}
    for item, code in PILLARS.items():
        series, _ = oecd.series(FLOW, MEASURE=code)
        data[item] = series
        years = sorted({y for s in series.values() for y in s})
        write_json(OUT / "dstri" / f"{item}.json", indicator_file(
            f"dstri-{item}", "指數", years, {c: [round(s[y], 4) if y in s else None for y in years] for c, s in sorted(series.items())},
            noValue=NO_TW[0], noValueEn=NO_TW[1], license="OECD 資料條款（CC BY 4.0）"))
    years = sorted({y for s in data["all"].values() for y in s})
    parts = [k for k in PILLARS if k != "all"]
    detail = {c: [[round(data[k].get(c, {}).get(y, 0), 4) for k in parts] if y in data["all"][c] else None for y in years] for c in data["all"]}
    write_json(OUT / "pillars.json", {"years": years, "pillars": parts, "countries": detail, "license": "OECD 資料條款（CC BY 4.0）"})
    last = years[-1]
    v = sorted(((round(s[last], 3), c) for c, s in data["all"].items() if last in s), reverse=True)
    print(f"  {len(v)} 個經濟體 {years[0]}–{last}：{v[:6]} … {v[-6:]}")
    print(f"  中國 {round(data['all']['CHN'][last], 3)} 印度 {round(data['all']['IND'][last], 3)} 德國 {round(data['all']['DEU'][last], 3)} 美國 {round(data['all']['USA'][last], 3)}")
