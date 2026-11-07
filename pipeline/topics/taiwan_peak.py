"""台灣的尖峰負載與備用容量率（2026-11-07，製作手冊第二十五批 531，候選 1212；「發電量」的台灣側欄）。

台灣電力公司「歷年尖峰負載及備用容量率」（data.gov.tw 8307，政府資料開放授權條款第 1 版），
https://service.taipower.com.tw/data/opendata/apply/file/d003002/001.csv ，1982 年起每年一列（尖峰負載 MW、備用容量率 %）。
service.taipower.com.tw 從 cloud 時通時斷（第一次常連線被重設），download() 失敗時用 .cache/taipower/ 的檔。
國際上沒有可用的尖峰負載資料（ENTSO-E 要 token、Ember 與 EIA 都沒有），所以只有台灣。
輸出 public/data/topics/electricity/tw-peak.json。
"""

from __future__ import annotations

import csv

from common import OUT_DIR, download, write_json

URL = "https://service.taipower.com.tw/data/opendata/apply/file/d003002/001.csv"


def build() -> None:
    path = download(URL, "taipower", "peak-load-reserve.csv")
    years, peak, reserve = [], [], []
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            years.append(int(r["年度"]))
            peak.append(float(r["尖峰負載(MW)"]))
            reserve.append(float(r["備用容量率(％)"]))
    write_json(OUT_DIR / "topics" / "electricity" / "tw-peak.json", {
        "years": years, "peak": peak, "reserve": reserve,
        "license": "政府資料開放授權條款第 1 版", "attribution": "台灣電力公司"})
    low = sorted(zip(reserve, years))[:5]
    print(f"  台灣尖峰負載 {years[0]}–{years[-1]}：{years[-1]} 年 {peak[-1]:,.0f} MW、備用容量率 {reserve[-1]}%；最低 {low}；最高負載 {max(zip(peak, years))}")
