"""行政院主計總處 總體統計資料庫（nstatdb）：補上國際資料庫沒有的台灣。

API 參數是從網站本身的查詢頁面整理出來的：
- funid：資料表代碼；fldspc / codspc0：欄、列的「起點,數量」（從 0 起算）
- ymf / ymt：起訖年，民國年 × 100；cycle=4 為年資料
- outmode=3：UTF-8 CSV（含 BOM），前幾列是標題，最後有「註解」區塊
- 缺值寫成「...」（尚未發布）或「-」（無）
"""
from __future__ import annotations

import csv
from datetime import date

from common import download

URL = (
    "https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx?sys=220&funid={funid}&outmode=3&outkind=1"
    "&ymf={ymf}&ymt={ymt}&fldspc={fld}&codspc0={cod}&codspc1=&cycle=4&compmode=0&ratenm=&title="
)
ROC_OFFSET = 1911


def _table(funid: str, first_roc: int, fld: str, cod: str) -> tuple[list[str], dict[int, list[str]]]:
    """回傳 (欄名, {西元年: 該列數值字串})。"""
    last_roc = date.today().year - ROC_OFFSET
    url = URL.format(funid=funid, ymf=first_roc * 100, ymt=last_roc * 100, fld=fld, cod=cod)
    path = download(url, "dgbas", f"{funid}.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    is_data = [bool(r) and r[0].endswith("年") and r[0][:-1].isdigit() for r in rows]
    if not any(is_data):
        raise RuntimeError(f"{funid} 沒有資料列，API 格式可能變了")
    header = rows[is_data.index(True) - 1]  # 欄名在第一列資料的上一列
    data = {int(r[0][:-1]) + ROC_OFFSET: r for r, ok in zip(rows, is_data) if ok}
    return header, data


def _num(text: str) -> float | None:
    text = text.strip().replace(",", "")
    try:
        return float(text)
    except ValueError:
        return None  # 「...」「-」


def gdp_by_industry() -> dict[int, dict[str, float]]:
    """國內各業生產（名目 GDP，新臺幣百萬元），1981 年起。{年: {行業名: 值}}。

    行業名例如「A.農、林、漁、牧業」「C.製造業」「CR.電子零組件製造業」「GDP」「總計(生產面)」。
    最新一年通常只有大行業，製造業細項要晚一年才有。
    """
    header, data = _table("A018103010", 70, "2,1", "0,86")
    out: dict[int, dict[str, float]] = {}
    for year, row in data.items():
        values = {name: v for name, cell in zip(header[1:], row[1:]) if name and (v := _num(cell)) is not None}
        if values:
            out[year] = values
    return out


# 就業人口依行業分，五次行業分類修訂各一張表（月資料，cycle=4 取年平均，千人）
EMPLOYMENT_TABLES = [  # (資料表, 起始民國年, 欄數)
    ("A040103010", 67, 12),
    ("A040103020", 88, 17),
    ("A040103030", 90, 20),
    ("A040103040", 101, 20),
    ("A040103050", 106, 20),
]
INDUSTRY_COLUMNS = {
    "礦業及土石採取業", "製造業", "水電燃氣業", "電力及燃氣供應業", "用水供應及污染整治業", "營造業", "營建工程業",
}


def employment_by_sector() -> dict[int, dict[str, float]]:
    """就業人口三級產業（千人）：{年: {total, agriculture, industry, services}}。

    行業分類修訂重疊的年份用較新的表；今年還沒結束（年平均只含部分月份），不收。
    """
    this_year = date.today().year
    out: dict[int, dict[str, float]] = {}
    for funid, first_roc, columns in EMPLOYMENT_TABLES:
        header, data = _table(funid, first_roc, f"0,{columns}", "0,1")
        for year, row in data.items():
            if year >= this_year:
                continue
            cells = dict(zip(header, row))
            total = _num(cells["總計"])
            agriculture = _num(cells["農、林、漁、牧業"])
            industry = sum(_num(cells[c]) or 0 for c in INDUSTRY_COLUMNS if c in cells)
            if total and agriculture is not None and industry:
                out[year] = {
                    "total": total,
                    "agriculture": agriculture,
                    "industry": industry,
                    "services": total - agriculture - industry,
                }
    return out
