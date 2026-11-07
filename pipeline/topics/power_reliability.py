"""供電可靠度：平均停電時間與次數（SAIDI／SAIFI）（新主題，2026-11-07，製作手冊第二十七批 610，候選 1339；
步驟 power-reliability，輸出 topics/power-reliability/）。

- 經濟部能源署「電力系統可靠度資料統計」（data.gov.tw 25549，政府資料開放授權條款第 1 版），
  `wHandOpenData_File.ashx?set_id=101`：年度、國家（中文名）、SAIDI（每戶每年平均停電分鐘）、SAIFI（每戶每年平均停電次數）。
  歐洲 29 國 2008–2013 年與台灣 2008–2015 年（手冊寫的 2014 年其實只有台灣）。「捷克」與「捷克共和國」併成一國。
- 台電「蒐整國際電業公司每戶停電時間及每戶停電次數」（data.gov.tw 166244）的主機 cloud 連不上，等本機 session 的檔。
"""
from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json

OUT = OUT_DIR / "topics" / "power-reliability"
URL = "https://www.moeaea.gov.tw/ECW/populace/opendata/wHandOpenData_File.ashx?set_id=101"
NAMES = {
    "丹麥": "DNK", "保加利亞": "BGR", "克羅埃西亞": "HRV", "匈牙利": "HUN", "台灣": "TWN", "奧地利": "AUT", "希臘": "GRC",
    "德國": "DEU", "意大利": "ITA", "愛沙尼亞": "EST", "愛爾蘭": "IRL", "拉脫維亞": "LVA", "挪威": "NOR", "捷克": "CZE",
    "捷克共和國": "CZE", "斯洛伐克共和國": "SVK", "斯洛維尼亞": "SVN", "法國": "FRA", "波蘭": "POL", "瑞典": "SWE", "瑞士": "CHE",
    "盧森堡": "LUX", "立陶宛": "LTU", "羅馬尼亞": "ROU", "芬蘭": "FIN", "英國": "GBR", "荷蘭": "NLD", "葡萄牙": "PRT",
    "西班牙": "ESP", "馬爾他": "MLT",
}
LICENSE = "政府資料開放授權條款第 1 版"


def build() -> None:
    data: dict[str, dict[str, dict[int, float]]] = {"saidi": defaultdict(dict), "saifi": defaultdict(dict)}
    with open(download(URL, "moeaea", "reliability_101.csv"), encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            iso = NAMES[r["國家"].strip()]
            y = int(r["年度(西元年)"])
            for k, col in (("saidi", "SAIDI"), ("saifi", "SAIFI")):
                if r[col].strip():
                    data[k][iso][y] = float(r[col])
    for k, unit in (("saidi", "分鐘"), ("saifi", "次")):
        years = sorted({y for v in data[k].values() for y in v})
        write_json(OUT / f"{k}.json", indicator_file(
            k, unit, years, {c: [v.get(y) for y in years] for c, v in sorted(data[k].items())}, latestWithin=2, license=LICENSE))
        for y in (2008, 2013):
            r = sorted(((c, v[y]) for c, v in data[k].items() if y in v), key=lambda x: x[1])
            print(f"  {k} {y}（{len(r)} 國）最少：" + "、".join(f"{c} {v:g}" for c, v in r[:6]) + "；最多：" + "、".join(f"{c} {v:g}" for c, v in r[-5:][::-1]))
        print(f"  {k} 台灣：{dict(sorted(data[k]['TWN'].items()))}")
