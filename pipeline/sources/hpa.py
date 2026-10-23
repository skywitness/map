"""衛生福利部國民健康署「國人吸菸行為調查」的 18 歲以上成人吸菸率（政府資料開放授權條款）：台灣的吸菸率。

- 開放資料 data.gov.tw 14462「18歲以上人口目前吸菸率-依性別分」（CSV、Big5）只到 107 年（2018），
  108 年起調查改成兩年一次（民國單數年辦理：109、111、113 年），開放資料之後沒有再更新。
- 所以 KNOWN 是國健署網站「國人吸菸行為調查結果」（https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=1718&pid=9913 ，
  2026-01-07 更新）圖 1「歷年 18 歲以上成人吸菸率－標準化」標出的數字（男性、女性、整體）；
  CSV 有的年份（102–107 年）兩邊一致，程式每次都核對。
- 定義：以前到現在吸菸超過 100 支（5 包），而且最近 30 天內吸過紙菸；以 89 年（2000）戶口普查的人口結構，
  依性別、年齡、教育程度、居住地區加權標準化。WHO 的是 15 歲以上、所有燃燒式菸品、以 WHO 標準人口做年齡標準化，
  兩者不完全可比。
- 93 年（2004）起才是同一個調查（電話訪問），之前是菸酒公賣局等其他調查，不收。

授權：國健署在政府資料開放平臺的資料集（14462）採政府資料開放授權條款第 1 版；網站本身的「政府網站資料開放宣告」相同。
"""
from __future__ import annotations

import csv
import io

from common import download

CSV_URL = "https://www.hpa.gov.tw/Pages/ashx/GetFile.ashx?lang=c&type=1&sid=199da8f3eb7640828c59c0dd4196da2f"

# 西元年: (整體, 男性, 女性)，國健署網站圖 1 的數字（%）
KNOWN: dict[int, tuple[float, float, float]] = {
    2004: (24.1, 42.9, 4.6),
    2005: (22.7, 40.0, 4.8),
    2006: (22.1, 39.6, 4.1),
    2007: (22.3, 39.0, 5.1),
    2008: (21.9, 38.6, 4.8),
    2009: (20.0, 35.4, 4.2),
    2010: (19.8, 35.0, 4.1),
    2011: (19.1, 33.5, 4.4),
    2012: (18.7, 32.7, 4.3),
    2013: (18.0, 32.5, 3.3),
    2014: (16.4, 29.2, 3.5),
    2015: (17.1, 29.9, 4.2),
    2016: (15.3, 28.6, 3.8),
    2017: (14.5, 26.4, 2.3),
    2018: (13.0, 23.4, 2.4),
    2020: (13.1, 23.1, 2.9),
    2022: (14.0, 24.4, 3.7),
    2024: (12.8, 21.5, 4.2),
}
SEXES = ("total", "male", "female")


def smoking() -> dict[str, dict[int, float]]:
    """{'total' | 'male' | 'female': {西元年: %}}"""
    path = download(CSV_URL, "hpa", "adult-smoking-14462.csv")
    text = path.read_bytes().decode("cp950")
    rows = list(csv.reader(io.StringIO(text)))
    if [c.strip() for c in rows[0][:5]] != ["年份別", "有效樣本數", "合計 (%)", "男性 (%)", "女性 (%)"]:
        raise RuntimeError(f"國健署成人吸菸率的欄位變了：{rows[0]}")
    table = dict(KNOWN)
    for row in rows[1:]:
        if not row or not row[0].startswith("民國"):
            continue
        year = int(row[0].removeprefix("民國").removesuffix("年")) + 1911
        values = (float(row[2]), float(row[3]), float(row[4]))
        if year in KNOWN and KNOWN[year] != values:
            raise RuntimeError(f"國健署成人吸菸率 {year} 年：開放資料 {values} 跟網站的圖 {KNOWN[year]} 不一樣")
        table[year] = values
    return {sex: {y: v[i] for y, v in table.items()} for i, sex in enumerate(SEXES)}
