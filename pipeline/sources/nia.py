"""內政部移民署 外僑居留人數（內政部統計查詢網，data.gov.tw 13506，政府資料開放授權條款）。

- 統計對象是持有效外僑居留證、實際在臺居留的外國人，每年 12 月底，1996 年起。
- 不含大陸地區人民與港澳居民（他們不是「外僑」，另有統計）；UN DESA 的台灣移民數含大陸地區（約 25 萬人），所以比這裡多。
- 欄位是主要國籍（印尼、越南、菲律賓、泰國…），其他國家併在「其他」。
"""
from __future__ import annotations

import csv
from datetime import date

from common import download

URL = (
    "https://statis.moi.gov.tw/micst/webMain.aspx?sys=220&kind=21&type=1&funid=c0930102&cycle=4&outmode=12&utf=1"
    "&compmode=0&outkind=3&fldspc=0,60,&codspc0=0,2,&codlst1=111&ym=8500&ymt={ymt}"
)


def foreign_residents() -> dict[int, dict[str, int]]:
    """{西元年: {國籍（中文）: 人數}}，「總計」是全部外僑。"""
    path = download(URL.format(ymt=(date.today().year - 1911) * 100), "nia", "foreign-residents.csv")
    out: dict[int, dict[str, int]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    header = rows[0]
    for row in rows[1:]:
        # 例如「113年/ 區域別總計/ 性別總計」
        parts = [p.strip() for p in row[0].split("/")] if row else []
        if len(parts) != 3 or parts[1] != "區域別總計" or parts[2] != "性別總計" or not parts[0].endswith("年"):
            continue
        year = int(parts[0][:-1]) + 1911
        out[year] = {name: int(v) for name, v in zip(header[1:], row[1:]) if v.strip().isdigit()}
    if not out:
        raise RuntimeError("外僑居留人數讀不到資料，查詢網址的格式可能變了")
    return out
