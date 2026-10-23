"""內政部警政署「警政統計查詢網」的故意殺人概況（政府資料開放授權條款）：只用在台灣的附註。

https://ba.npa.gov.tw/statis/webMain.aspx?k=defjsp →「暴力犯罪」→「故意殺人」→「故意殺人概況」，
跟內政部統計查詢網是同一套系統（sources/moi.py），網址參數改成 outmode=12（CSV）。
欄位是發生數（件）、破獲數（件）、嫌疑犯（人）、被害人（人），2000 年（89 年）起。

- 故意殺人的發生數、被害人都含未遂，查詢網沒有分既遂、未遂，所以不能直接跟 UNODC 的
  「故意殺人被害人」（只算死亡）比；地圖上台灣的值改用衛福部死因統計的他殺死亡人數（topics/crime.py）。
- 2024 年 9 月起部分刑案的發生數改成「1 被害人 1 發生數」（原本是 1 案 1 發生數）。

授權：警政署的開放資料（政府資料開放平臺上的警政署資料集）採政府資料開放授權條款第 1 版。
"""
from __future__ import annotations

import csv
from datetime import date

from common import download

URL = (
    "https://ba.npa.gov.tw/statis/webMain.aspx?sys=220&kind=21&type=1&funid=q02010201&cycle=4&outmode=12&utf=1"
    "&compmode=0&outkind=3&fldlst=1111&codspc0=0,1,&ym=8900&ymt={ymt}"
)


def homicide() -> dict[int, dict[str, int]]:
    """{西元年: {'cases': 發生數, 'victims': 被害人數}}，都含未遂"""
    ymt = (date.today().year - 1 - 1911) * 100  # 到去年：今年只有到上個月的累計
    path = download(URL.format(ymt=ymt), "npa", "homicide.csv")
    out: dict[int, dict[str, int]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = csv.reader(f)
        header = next(rows)
        if header[1:] != ["發生數(件)", "破獲數(件)", "嫌疑犯(人)", "被害人(人)"]:
            raise RuntimeError(f"警政署故意殺人概況的欄位變了：{header}")
        for row in rows:
            if not row:
                continue
            # 例如「112年/ 機關別總計(全選)」
            label = row[0].split("/")[0].strip()
            if not label.endswith("年") or not label[:-1].isdigit():
                continue
            out[int(label[:-1]) + 1911] = {"cases": int(row[1].replace(",", "")), "victims": int(row[4].replace(",", ""))}
    if not out:
        raise RuntimeError("警政署故意殺人概況讀不到資料，查詢網址的格式可能變了")
    return out
