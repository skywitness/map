"""行政院主計總處 人力資源調查：台灣的失業率、勞動力參與率，依性別與年齡（政府資料開放授權條款）。

- 總體統計資料庫 nstatdb 的 A040109010「勞參率及失業率-按年齡分」（月資料，cycle=4 取年平均），1978 年（民國 67 年）起。
  API 參數見 dgbas.py；這張表有兩個分類維度：codspc0 是性別（合計、男、女）、codspc1 是年齡（合計、15~24歲、25~29歲…）。
  dgbas.py 的 labour_force_participation_by_sex() 也用這張表（只取年齡合計），快取檔名不同，不會互相覆蓋。
- 欄名有兩列：上一列是「勞參率」「失業率」（只寫在每組的第一格），下一列是「合計_合計」「合計_15~24歲」「男_合計」…（性別_年齡）。
- 定義（主計總處〈人力資源調查統計編製方法概述與名詞定義〉）：
  - 範圍：臺灣地區（不含金門縣、連江縣）年滿 15 歲的民間人口，不包括武裝勞動力（現役軍人）及監管人口。
  - 失業者：資料標準週內年滿 15 歲、同時無工作、隨時可以工作、正在找工作或已找工作在等待結果；
    另含等待恢復工作者及已找到工作而還沒開始上班者。跟 ILO 的定義相同。
  - 就業者：從事有酬工作者，或從事 15 小時以上的無酬家屬工作者。
  - 勞動力參與率：勞動力（就業者＋失業者）占 15 歲以上民間人口的比率；失業率：失業者占勞動力的比率。
"""
from __future__ import annotations

import csv
from datetime import date

from common import download
from sources.dgbas import ROC_OFFSET, _num

URL = (
    "https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx?sys=220&funid={funid}&outmode=3&outkind=1"
    "&ymf={ymf}&ymt={ymt}&fldspc={fld}&codspc0={cod0}&codspc1={cod1}&cycle=4&compmode=0&ratenm=&title="
)
FUNID = "A040109010"
FIRST_ROC = 67
FIELDS = {"勞參率": "participation", "失業率": "unemployment"}
SEXES = {"合計": "total", "男": "male", "女": "female"}
AGES = {"合計": "15+", "15~24歲": "15-24"}

# {(指標, 性別, 年齡): {西元年: 值}}，例如 ("unemployment", "total", "15-24")
Table = dict[tuple[str, str, str], dict[int, float]]


def rates_by_sex_and_age() -> Table:
    """失業率與勞動力參與率（%），依性別（合計、男、女）與年齡（15 歲以上、15–24 歲）。今年還沒結束（年平均只含部分月份），不收。"""
    last_roc = date.today().year - ROC_OFFSET
    url = URL.format(funid=FUNID, ymf=FIRST_ROC * 100, ymt=last_roc * 100, fld="0,2", cod0="0,3", cod1="0,2")
    path = download(url, "dgbas", f"{FUNID}-sex-age.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    is_data = [bool(r) and r[0].endswith("年") and r[0][:-1].isdigit() for r in rows]
    if not any(is_data):
        raise RuntimeError(f"{FUNID} 沒有資料列，API 格式可能變了")
    first = is_data.index(True)
    fields, labels = rows[first - 2], rows[first - 1]

    columns: dict[int, tuple[str, str, str]] = {}
    field = None
    for i in range(1, len(labels)):
        field = FIELDS.get(fields[i].strip(), field) if i < len(fields) and fields[i].strip() else field
        sex, _, age = labels[i].partition("_")
        if field and sex in SEXES and age in AGES:
            columns[i] = (field, SEXES[sex], AGES[age])
    if len(columns) != len(FIELDS) * len(SEXES) * len(AGES):
        raise RuntimeError(f"{FUNID} 的欄位跟預期的不同：{fields} / {labels}")

    this_year = date.today().year
    out: Table = {key: {} for key in columns.values()}
    for row, ok in zip(rows, is_data):
        if not ok or (year := int(row[0][:-1]) + ROC_OFFSET) >= this_year:
            continue
        for i, key in columns.items():
            if (v := _num(row[i])) is not None:
                out[key][year] = v
    return out
