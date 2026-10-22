"""內政部（政府資料開放授權條款）：台灣的識字率與簡易生命表。

- 識字率：統計查詢網（data.gov.tw 14246），依戶籍登記的教育程度計算，不是抽樣調查；每年年底，1997 年起。
- 簡易生命表：依戶籍登記的出生、死亡與年中人口編算，每年一版。
  - 0 歲平均餘命：統計查詢網（data.gov.tw 14249 全國、14250 臺灣地區）。
  - 0 歲與未滿 5 歲死亡機率：統計查詢網沒有，要讀每年的生命表檔案（https://www.moi.gov.tw/cl.aspx?n=2953）。
    81–98 年是 htm、99–105 年是 ods、106 年起是 xlsx 或 ods，版面都一樣：
    「全體」（或「兩性」「兩性平均」）、「男性」「女性」三段，第 1 欄年齡、第 2 欄 qx、第 3 欄 lx。
  - 全國（含金門、連江）的生命表 81 年（1992）起才有。更早只有臺灣地區，而且只分男女、沒有兩性合計。
"""
from __future__ import annotations

import base64
import csv
import html
import re
import urllib.parse
import zipfile
from datetime import date
from pathlib import Path
from xml.etree import ElementTree

import openpyxl

from common import download

# ym／ymt 是起訖年（民國年 × 100）
LITERACY_URL = (
    "https://statis.moi.gov.tw/micst/webMain.aspx?sys=220&kind=21&type=1&funid=c0110404&cycle=4&outmode=12&utf=1"
    "&compmode=0&outkind=3&fldlst=1111&codspc0=0,2,3,2,6,1,9,1,12,1,15,16,&codlst1=111&ym=8600&ymt={ymt}"
)
LIFE_EXPECTANCY_URL = (
    "https://statis.moi.gov.tw/micst/webMain.aspx?sys=220&kind=21&type=1&funid={funid}&cycle=4&outmode=12&utf=1"
    "&compmode=0&outkind=3&fldlst=111&codspc0=1,91,&ym={ym}&ymt={ymt}"
)
NATIONAL_FROM = 1992  # 81 年起有全國的生命表
LIFE_EXPECTANCY_TABLES = [  # (funid, 起始年 × 100, 最後一年)
    ("c1210102", 5900, NATIONAL_FROM - 1),  # 臺灣地區（不含金門、連江），59 年起，只有男女
    ("c1210101", 8100, None),  # 全國
]
LIFE_TABLE_LIST_URL = "https://www.moi.gov.tw/cl.aspx?n=2953&PageSize=100"
# 全國生命表的檔名：106 年起「112年全國web.xlsx」、99–105 年「105年簡易生命表.ods」、81–98 年「tc9820s.htm」。
# 清單頁的側欄還有縣市別的檔案（「113年簡易生命表web.ods」「108年縣市別web.xlsx」），名稱對不上就不會用到。
LIFE_TABLE_FILE = re.compile(r"^\d+年全國(web)?\.(xlsx|ods)$|^\d+年簡易生命表\.ods$|^tc\d+20s\.htm$")
NATIONAL_TITLE = re.compile(r"(全國|臺閩地區)簡易生命表")
BOTH_SEXES = {"全體", "兩性", "兩性平均"}
SEX_LABELS = BOTH_SEXES | {"男性", "女性"}
ODS = {
    "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
}


def _roc_year_now() -> int:
    return date.today().year - 1911


def literacy() -> dict[int, float]:
    """{西元年: 識字率 %}，識字率 = 100 − 不識字率。"""
    path = download(LITERACY_URL.format(ymt=_roc_year_now() * 100), "moi", "literacy.csv")
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


def life_expectancy() -> dict[str, dict[int, float]]:
    """{'total'／'male'／'female': {西元年: 0 歲平均餘命}}。1992 年起是全國；更早是臺灣地區，只有男女。"""
    out: dict[str, dict[int, float]] = {"total": {}, "male": {}, "female": {}}
    for funid, ym, last in LIFE_EXPECTANCY_TABLES:
        url = LIFE_EXPECTANCY_URL.format(funid=funid, ym=ym, ymt=_roc_year_now() * 100)
        with open(download(url, "moi", f"life-expectancy-{funid}.csv"), encoding="utf-8-sig", newline="") as f:
            for row in csv.reader(f):
                # 例如「112年/ 0歲」，後面三欄是總計、男、女
                parts = [p.strip() for p in row[0].split("/")] if row else []
                if len(parts) != 2 or parts[1] != "0歲" or not parts[0].endswith("年"):
                    continue
                year = int(parts[0][:-1]) + 1911
                if last and year > last:
                    continue
                for key, cell in zip(("total", "male", "female"), row[1:4]):
                    if (v := _number(cell)) is not None:
                        out[key][year] = v
    if not out["total"]:
        raise RuntimeError("內政部平均餘命讀不到資料，查詢網址的格式可能變了")
    return out


def child_mortality() -> tuple[dict[int, float], dict[int, float]]:
    """全國簡易生命表的（0 歲死亡機率 ‰, 未滿 5 歲死亡機率 ‰），{西元年: 值}，1992 年起。

    0 歲死亡機率是用各月齡的嬰兒死亡數除以當年與前一年的月別出生數算的，
    跟 WPP 的嬰兒死亡率（1q0，每千活產）同一個概念；未滿 5 歲是 1 − l5／l0，對應 WPP 的 Q5。
    """
    infant: dict[int, float] = {}
    under5: dict[int, float] = {}
    for year, path in _life_table_files().items():
        q0, q5 = _child_mortality(path)
        infant[year] = q0 * 1000
        under5[year] = q5 * 1000
    return infant, under5


def _life_table_files() -> dict[int, Path]:
    """{西元年: 全國簡易生命表檔案}"""
    page = download(LIFE_TABLE_LIST_URL, "moi", "life-tables.html").read_text(encoding="utf-8")
    files: dict[int, Path] = {}
    for href, text in re.findall(r'<a [^>]*href="([^"]*Download\.ashx[^"]*)"[^>]*>\s*(\d+)年\s*</a>', page):
        url = html.unescape(href)
        query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        name = base64.b64decode(query["n"][0]).decode("utf-8")  # 下載網址的 n 參數是 base64 的檔名
        year = int(text) + 1911
        if year in files or not LIFE_TABLE_FILE.match(name):
            continue
        files[year] = download(url, "moi", f"life-table-{text}{Path(name).suffix}")
    if NATIONAL_FROM not in files or len(files) < date.today().year - NATIONAL_FROM - 2:
        raise RuntimeError(f"內政部簡易生命表的清單頁只找到 {len(files)} 年，網頁格式可能變了")
    return dict(sorted(files.items()))


def _child_mortality(path: Path) -> tuple[float, float]:
    """一年全國簡易生命表的（q0, 1 − l5／l0）"""
    for rows in _sheets(path):
        national = False
        sex = None
        found: dict[float, tuple[float, float]] = {}  # 年齡 → (qx, lx)
        for row in rows:
            first = next((c for c in row if c not in (None, "")), None)
            label = re.sub(r"\s", "", first) if isinstance(first, str) else None
            if label and NATIONAL_TITLE.search(label):
                national = True  # 99–105 年的檔案：目錄頁沒有數字，全國表在後面幾頁，旁邊還有臺灣地區、臺灣省
            elif label in SEX_LABELS:
                sex = label
            elif national and sex in BOTH_SEXES and row and (age := _number(row[0])) in (0, 5):
                q, lx = _number(row[1]), _number(row[2])
                if q is not None and lx is not None:
                    found.setdefault(age, (q, lx))
        if 0 in found and 5 in found:
            (q0, l0), (_q5, l5) = found[0], found[5]
            return q0, 1 - l5 / l0
    raise RuntimeError(f"{path.name} 找不到全國簡易生命表兩性的 0 歲與 5 歲，檔案格式可能變了")


def _number(cell: object) -> float | None:
    if isinstance(cell, (int, float)):
        return float(cell)
    try:
        return float(str(cell).replace(",", "").strip())
    except ValueError:
        return None  # 「-」、「0M」


def _sheets(path: Path) -> list[list[list]]:
    """每張工作表的所有列。xlsx 用 openpyxl；ods 直接讀 content.xml；htm 是 Excel 另存的網頁，一個 <tr> 一列。"""
    if path.suffix == ".xlsx":
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        return [[list(r) for r in ws.iter_rows(values_only=True)] for ws in wb.worksheets]
    if path.suffix == ".ods":
        with zipfile.ZipFile(path) as z:
            root = ElementTree.fromstring(z.read("content.xml"))
        sheets = []
        for table in root.iter(f"{{{ODS['table']}}}table"):
            rows = []
            for tr in table.iter(f"{{{ODS['table']}}}table-row"):
                cells: list = []
                for td in tr:
                    repeat = min(int(td.get(f"{{{ODS['table']}}}number-columns-repeated", "1")), 50)
                    value = td.get(f"{{{ODS['office']}}}value")
                    text = "".join(td.itertext()).strip()
                    cells.extend([float(value) if value is not None else (text or None)] * repeat)
                rows.append(cells)
            sheets.append(rows)
        return sheets
    page = path.read_bytes().decode("cp950", errors="replace")  # Big5
    rows = []
    for tr in re.findall(r"(?is)<tr[^>]*>(.*?)</tr>", page):
        cells = re.findall(r"(?is)<t[dh][^>]*>(.*?)</t[dh]>", tr)
        rows.append([html.unescape(re.sub(r"(?s)<[^>]+>", "", c)).replace("\xa0", " ").strip() or None for c in cells])
    return [rows]
