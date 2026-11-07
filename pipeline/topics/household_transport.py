"""家庭花在交通上的錢（新主題，2026-11-07，製作手冊第二十七批 585，候選 1304；步驟 household-transport，
輸出 topics/household-transport/）。

- Eurostat `nama_10_co3_p3`（家庭最終消費支出依 COICOP，CC BY 4.0）：用 CP_MEUR（百萬歐元，當年價格）自己算比例，
  CP07 交通 ÷ TOTAL；子項目 CP071 買車、CP072 養車與油錢（個人交通工具的運作）、CP073 搭車的費用（運輸服務）。
  手冊的陷阱：不要用 PC_TOT（整數四捨五入，而且 2024 年只有 5 國）。英國照網站的規則不收。
- 台灣：主計總處家庭收支調查「家庭消費支出結構按消費型態分」（政府資料開放平臺 6588，政府資料開放授權條款）的
  「交通及資通訊」百分比，1976 年起。**含電信費，跟 Eurostat 的 CP07 不能比**，只放側欄，地圖上台灣灰色、tooltip 寫數字與口徑。
"""
from __future__ import annotations

import csv
import urllib.parse

from common import OUT_DIR, download, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "household-transport"
ITEMS = {"all": "CP07", "vehicles": "CP071", "operation": "CP072", "services": "CP073"}
TW_URL = "https://ws.dgbas.gov.tw/001/Upload/461/relfile/11525/232214/" + urllib.parse.quote("005-家庭消費支出結構按消費型態分.csv")
TW_COLUMN = "交通及資通訊-百分比"


def _taiwan() -> dict[int, float]:
    path = download(TW_URL, "dgbas", "fies-005-consumption-structure.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        return {int(r["年"]): float(r[TW_COLUMN]) for r in csv.DictReader(f) if r[TW_COLUMN]}


def build() -> None:
    total = eurostat.series("nama_10_co3_p3", unit="CP_MEUR", coicop="TOTAL")
    tw = _taiwan()
    tw_last = max(tw)
    no_value = ({"TWN": f"主計總處的分類是「交通及資通訊」（含電信費），{tw_last} 年 {tw[tw_last]:.2f}%，跟歐洲的交通支出不能比，見側欄"},
                {"TWN": f"Taiwan’s statistics combine transport with communications (including phone bills): {tw[tw_last]:.2f}% in {tw_last}, not comparable; see the side panel"})
    shares = {}
    for item, code in ITEMS.items():
        part = eurostat.series("nama_10_co3_p3", unit="CP_MEUR", coicop=code)
        share = {c: {y: v / total[c][y] * 100 for y, v in s.items() if total.get(c, {}).get(y)} for c, s in part.items()}
        share = {c: s for c, s in share.items() if s}
        shares[item] = share
        years = sorted({y for s in share.values() for y in s})
        write_json(OUT / "share" / f"{item}.json", indicator_file(
            f"transport-spending-{item}", "%", years, {c: [round(s[y], 3) if y in s else None for y in years] for c, s in sorted(share.items())},
            noValue=no_value[0], noValueEn=no_value[1], license="CC BY 4.0"))
    years = sorted({y for s in shares["all"].values() for y in s})
    detail = {c: {k: [round(shares[k][c][y], 3) if y in shares[k].get(c, {}) else None for y in years] for k in ("vehicles", "operation", "services")}
              for c in shares["all"]}
    write_json(OUT / "detail.json", {"years": years, "countries": detail,
                                     "tw": {"years": sorted(tw), "values": [tw[y] for y in sorted(tw)]}, "license": "CC BY 4.0；台灣：政府資料開放授權條款"})

    for y in (2022, 2023):
        v = sorted(((round(s[y], 1), c) for c, s in shares["all"].items() if y in s), reverse=True)
        print(f"  {y} 年 {len(v)} 國：{v[:9]} … {v[-6:]}")
    print(f"  1995：{sorted(((round(s[1995], 1), c) for c, s in shares['all'].items() if 1995 in s), reverse=True)[:4]}")
    print(f"  希臘、盧森堡 2023 運輸服務 {[round(shares['services'].get(c, {}).get(2023, 0), 1) for c in ('GRC', 'LUX')]}，盧森堡養車 {round(shares['operation'].get('LUX', {}).get(2023, 0), 1)}")
    print(f"  台灣 {min(tw)} {tw[min(tw)]}% → 2024 {tw.get(2024)}% → {tw_last} {tw[tw_last]}%")
