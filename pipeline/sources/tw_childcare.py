"""台灣 0–2 歲上托育的比例（自算，製作手冊第七批 134；DESIGN.md 第 216 點）。

（托嬰中心收托人數 ＋ 居家托育 0–2 歲收托人數 ＋ 幼兒園「未滿 3 歲」幼生數）÷ 0–2 歲人口 × 100，2018 年起。

- 托嬰中心：衛福部社會福利公務統計表 2.5.1「托嬰中心所數及收托人數」（年底，104 年起；另有 6 月底的列，不用）。
- 居家托育：衛福部表 2.5.3「居家托育人員數及收托人數」（年底，107 年起；只取未滿 3 歲的三欄，3 歲以上不算）。
  衛福部網站資料採政府資料開放授權條款第 1 版（https://www.mohw.gov.tw/cp-81-155-1.html ）。
  新一期的表會換 dl 編號：到 https://dep.mohw.gov.tw/DOS/np-5308-113.html 找新的網址。
- 幼兒園：教育部幼兒園概況（data.gov.tw 31449，政府資料開放授權條款第 1 版）的「未滿3歲幼生數」男女、各類幼兒園相加；
  edu_B_2_1_1 是 104–110 學年度，edu_B_2_1_2 是 111 學年度起（欄位不同，項目別所在的欄也不同）。基準日是 11 月 1 日。
- 分母：內政部統計查詢網 c0110203 單一年齡人口（data.gov.tw 14226）的年底 0、1、2 歲，區域別總計、性別總計。
OECD PF3.2 收的也是登記的托育服務（ISCED 0 與其他登記的服務），不含非正式的親屬照顧。
"""
from __future__ import annotations

import csv
import re

import openpyxl

from common import download

DAYCARE_URL = "https://www.mohw.gov.tw/dl-22252-9a819f19-edd0-4125-b816-46851410fe35.html"  # 表 2.5.1，到 115 年 6 月底
HOME_URL = "https://www.mohw.gov.tw/dl-52620-ca1807c6-929f-418d-8178-6490ebd8faae.html"  # 表 2.5.3，到 115 年 6 月底
KINDERGARTEN_URLS = [
    "https://stats.moe.gov.tw/files/opendata/edu_B_2_1_1.csv",  # 104–110 學年度
    "https://stats.moe.gov.tw/files/opendata/edu_B_2_1_2.csv",  # 111 學年度起
]
POPULATION_URL = (
    "https://statis.moi.gov.tw/micst/webMain.aspx?sys=220&kind=21&type=1&funid=c0110203&cycle=41&outmode=12&utf=1"
    "&compmode=0&outkind=3&fldspc=0,103,&codspc0=0,2,3,2,6,1,9,1,12,1,15,16,&codlst1=111&ym=10712&ymt=11412"
)
FIRST_YEAR = 2018  # 居家托育 107 年底起


def _year_end(cell: object) -> int | None:
    """「114年底，End of 2025」「107年 End of 2018」→ 西元年；6 月底的列回傳 None。"""
    text = str(cell or "")
    m = re.match(r"\s*(\d+)年\s*(底|End)", text)
    return int(m.group(1)) + 1911 if m else None


def _under_3(url: str, filename: str) -> dict[int, float]:
    """衛福部表的年底收托人數：未滿 1 歲、1–未滿 2 歲、2–未滿 3 歲三個「小計」相加。"""
    wb = openpyxl.load_workbook(download(url, "mohw", filename), read_only=True, data_only=True)
    rows = list(wb["歷年"].iter_rows(values_only=True))
    age_row = next(r for r in rows if any(str(c or "").startswith("未滿1歲") for c in r))
    first = next(i for i, c in enumerate(age_row) if str(c or "").startswith("未滿1歲"))
    labels = [str(age_row[first + 3 * k] or "") for k in range(3)]
    if not (labels[1].startswith("1-未滿2歲") and labels[2].startswith("2-未滿3歲")):
        raise RuntimeError(f"{filename} 的年齡欄位變了：{labels}")
    out: dict[int, float] = {}
    for row in rows:
        if (year := _year_end(row[0])) and year >= FIRST_YEAR:
            out[year] = sum(float(row[first + 3 * k]) for k in range(3))
    return out


def _kindergarten() -> dict[int, float]:
    """幼兒園「未滿3歲幼生數」（男＋女，各類幼兒園相加），學年度開始的西元年。"""
    out: dict[int, float] = {}
    for url in KINDERGARTEN_URLS:
        path = download(url, "moe", url.rsplit("/", 1)[1])
        with open(path, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.reader(f))
        label_col = rows[0].index("項目別")
        for row in rows[1:]:
            if len(row) > label_col and row[label_col].startswith("未滿3歲幼生數") and row[0].isdigit():
                year = int(row[0]) + 1911
                out[year] = out.get(year, 0) + sum(float(c) for c in row[label_col + 1:] if c.strip())
    return out


def _population_0_2() -> dict[int, float]:
    """年底 0–2 歲人口（「107年/ 區域別總計/ 性別總計」那一列就是 12 月底）。"""
    path = download(POPULATION_URL, "moi", "single-age-population.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    header = rows[0]
    cols = [header.index(f"{a}歲") for a in range(3)]
    out: dict[int, float] = {}
    for row in rows[1:]:
        if row and (m := re.fullmatch(r"(\d+)年/ 區域別總計/ 性別總計", row[0])):
            out[int(m.group(1)) + 1911] = sum(float(row[c]) for c in cols)
    return out


def childcare_0_2() -> dict[int, float]:
    """{西元年: 0–2 歲上托育的比例 %}"""
    daycare = _under_3(DAYCARE_URL, "daycare-2.5.1.xlsx")
    home = _under_3(HOME_URL, "home-childcare-2.5.3.xlsx")
    kindergarten = _kindergarten()
    population = _population_0_2()
    years = sorted(set(daycare) & set(home) & set(kindergarten) & set(population))
    if not years or years[0] != FIRST_YEAR:
        raise RuntimeError(f"托育的年份對不起來：{years}")
    return {y: (daycare[y] + home[y] + kindergarten[y]) / population[y] * 100 for y in years}
