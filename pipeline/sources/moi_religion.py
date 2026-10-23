"""內政部宗教統計（內政部統計查詢網，政府資料開放授權條款）：登記的寺廟與教會（堂）數，依宗教別，每年年底。

台灣的民間信仰多半沒有登記入教，內政部沒有各宗教信徒占人口的比例，只能當作背景。
"""
from __future__ import annotations

import csv
from datetime import date

from common import download

URL = (
    "https://statis.moi.gov.tw/micst/webMain.aspx?sys=220&kind=21&type=1&funid={funid}&cycle=4&outmode=12&utf=1"
    "&compmode=0&outkind=3&fldspc=0,1,&codspc0=0,1,&codspc1=0,30,&ym=10000&ymt={ymt}"
)
TABLES = {"temples": "c0210101", "churches": "c0210201"}  # 寺廟、教會（堂）


def places_of_worship() -> dict[str, dict[int, dict[str, int]]]:
    """{'temples' / 'churches': {西元年: {宗教別（含「宗教別總計」）: 座數}}}"""
    out: dict[str, dict[int, dict[str, int]]] = {}
    for key, funid in TABLES.items():
        path = download(URL.format(funid=funid, ymt=(date.today().year - 1911) * 100), "moi", f"religion-{key}.csv")
        by_year: dict[int, dict[str, int]] = {}
        with open(path, encoding="utf-8-sig", newline="") as f:
            for row in csv.reader(f):
                parts = [p.strip() for p in row[0].split("/")] if row else []
                if len(parts) == 3 and parts[1] == "區域別總計" and parts[0].endswith("年") and row[1].strip().isdigit():
                    by_year.setdefault(int(parts[0][:-1]) + 1911, {})[parts[2]] = int(row[1])
        if not by_year:
            raise RuntimeError(f"內政部宗教統計 {funid} 讀不到資料，查詢網址的格式可能變了")
        out[key] = by_year
    return out
