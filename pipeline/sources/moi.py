"""內政部統計查詢網（data.gov.tw 14246，政府資料開放授權條款）：台灣 15 歲以上人口的識字率。

依戶籍登記的教育程度計算，不是抽樣調查；每年年底，1997 年起。
"""
from __future__ import annotations

import csv
from datetime import date

from common import download

# ym／ymt 是起訖年（民國年 × 100）
LITERACY_URL = (
    "https://statis.moi.gov.tw/micst/webMain.aspx?sys=220&kind=21&type=1&funid=c0110404&cycle=4&outmode=12&utf=1"
    "&compmode=0&outkind=3&fldlst=1111&codspc0=0,2,3,2,6,1,9,1,12,1,15,16,&codlst1=111&ym=8600&ymt={ymt}"
)


def literacy() -> dict[int, float]:
    """{西元年: 識字率 %}，識字率 = 100 − 不識字率。"""
    path = download(LITERACY_URL.format(ymt=(date.today().year - 1911) * 100), "moi", "literacy.csv")
    out: dict[int, float] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.reader(f):
            # 例如「113年/ 區域別總計/ 性別總計」
            parts = [p.strip() for p in row[0].split("/")] if row else []
            if len(parts) == 3 and parts[1] == "區域別總計" and parts[2] == "性別總計" and parts[0].endswith("年"):
                try:
                    out[int(parts[0][:-1]) + 1911] = 100 - float(row[4])
                except ValueError:
                    continue  # 「-」
    if not out:
        raise RuntimeError("內政部識字率讀不到資料，查詢網址的格式可能變了")
    return out
