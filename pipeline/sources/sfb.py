"""金融監督管理委員會證券期貨局（證期局）的證券市場統計（政府資料開放授權條款）：台灣上市、上櫃公司的家數與市值。

世界銀行（WFE）沒有台灣，證交所、櫃買中心是公司組織，網站的使用條款禁止用程式下載、未經書面同意不得重製散布
（只有授權給政府資料開放平臺的資料例外），所以用證期局彙編的數字：

- data.gov.tw 103533「公開發行公司股票發行概況統計表」（stat.fsc.gov.tw 的 CSV 匯出），月資料，1998 年 8 月起：
  上市家數、上市市值、上櫃家數、上櫃市值（新臺幣十億元）。開放資料更新得比較慢（2026 年 10 月只到 2025 年 7 月）。
- 證期局網站「證券暨期貨市場重要指標」每月一個 zip（裡面再包 ods 與 xls 兩個 zip），表 1（t01）是同一張表，
  有最近 11 年的年底值；附註寫出當月的本國與第一上市（櫃）外國企業家數。開放資料沒有的年份用最新一期 12 月份的 t01 補。
  網站資料開放宣告採政府資料開放授權條款第 1 版。

口徑（t01 的附註）：上市含一般板與臺灣創新板、第一上市的外國企業（KY 公司），不含臺灣存託憑證（TDR）；
「未上市未上櫃」含興櫃。
"""
from __future__ import annotations

import csv
import io
import re
import zipfile
from xml.etree import ElementTree

from common import download

MONTHLY_URL = "https://stat.fsc.gov.tw/api/v1/public/datasets/103533/export"
# 證券暨期貨市場 114 年 12 月份重要指標（2026-01-15 發布；每年 1 月中發布前一年 12 月份，網址要手動換）
# 清單頁：https://www.sfb.gov.tw/ch/home.jsp?id=622&parentpath=0,4,109
LATEST_DECEMBER_URL = "https://www.fsc.gov.tw/userfiles/file/20260115.zip"
ROC_OFFSET = 1911

ODS = {
    "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
}

# 歷年 12 月份重要指標 t01 附註的第一上市、第一上櫃外國企業家數（證期局 2020 年 12 月份起才在附註寫出拆分）。
# 最新一年由 LATEST_DECEMBER_URL 自動讀；這裡是之前各期的 12 月份（xls）手抄的：
#   2020 https://www.fsc.gov.tw/fckdowndoc?file=/10912.zip&flag=doc
#   2021 https://www.fsc.gov.tw/userfiles/file/11012(1).zip
#   2022 https://www.fsc.gov.tw/userfiles/file/11112.zip
#   2023 https://www.fsc.gov.tw/userfiles/file/11212.zip
#   2024 https://www.fsc.gov.tw/userfiles/file/20250115.zip
FOREIGN_PRIMARY = {  # 年: (第一上市, 第一上櫃)
    2020: (77, 33),
    2021: (78, 32),
    2022: (76, 31),
    2023: (79, 30),
    2024: (85, 28),
}

FIELDS = {  # 103533 的欄名 → 這裡的名稱
    "上市家數": "twse_n",
    "上市市值_十億元": "twse_cap",
    "上櫃家數": "tpex_n",
    "上櫃市值_十億元": "tpex_cap",
}


def _monthly_december() -> dict[int, dict[str, float]]:
    """103533 的每年 12 月：{年: {twse_n, twse_cap, tpex_n, tpex_cap}}，市值是新臺幣元。"""
    path = download(MONTHLY_URL, "sfb", "103533.csv")
    text = path.read_bytes().decode("utf-8-sig")
    if text.lstrip().startswith(("<", "{")):
        path.unlink()  # 下次重新下載
        raise RuntimeError("證期局開放資料回傳的不是 CSV，下載網址可能變了")
    out: dict[int, dict[str, float]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        month = row["年月"].strip()
        if not month.endswith("12"):
            continue
        out[int(month[:4])] = {
            key: float(row[name]) * (1e9 if key.endswith("_cap") else 1) for name, key in FIELDS.items()
        }
    if not out:
        raise RuntimeError(f"證期局 103533 沒有 12 月的資料，欄位可能變了：{text[:200]}")
    return out


def _member(z: zipfile.ZipFile, pattern: str) -> zipfile.ZipInfo:
    """zip 裡檔名符合 pattern 的那一個；舊的 zip 檔名是 Big5，沒有標 UTF-8。"""
    for info in z.infolist():
        name = info.filename
        if not info.flag_bits & 0x800:
            try:
                name = name.encode("cp437").decode("cp950")
            except UnicodeError:
                pass
        if re.search(pattern, name):
            return info
    raise RuntimeError(f"證期局的 zip 裡找不到 {pattern}：{[i.filename for i in z.infolist()][:10]}")


def _ods_rows(data: bytes) -> list[list[float | str | None]]:
    """ods 第一張工作表的所有列（數值格是 float，文字格是字串）。"""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        root = ElementTree.fromstring(z.read("content.xml"))
    table = root.find(".//table:table", ODS)
    rows = []
    for tr in table.iter(f"{{{ODS['table']}}}table-row"):
        cells: list[float | str | None] = []
        for td in tr:
            repeat = min(int(td.get(f"{{{ODS['table']}}}number-columns-repeated", "1")), 50)
            value = td.get(f"{{{ODS['office']}}}value")
            text = "".join(td.itertext()).strip()
            cells.extend([float(value) if value is not None else (text or None)] * repeat)
        rows.append(cells)
    return rows


def _latest_december() -> tuple[int, dict[int, dict[str, float]], tuple[int, int]]:
    """最新一期 12 月份重要指標的 t01：(年, {年: 年底值}, (第一上市, 第一上櫃))。"""
    path = download(LATEST_DECEMBER_URL, "sfb", LATEST_DECEMBER_URL.rsplit("/", 1)[-1])
    with zipfile.ZipFile(path) as outer:
        inner = zipfile.ZipFile(io.BytesIO(outer.read(_member(outer, r"odf\.zip$"))))
    rows = _ods_rows(inner.read(_member(inner, r"t01.*\.ods$")))
    clean = [[str(c).replace("　", "").replace(" ", "") if isinstance(c, str) else c for c in r] for r in rows]

    header = next(r for r in clean if r and r[0] == "年")
    count_cols = [i for i, c in enumerate(header) if c == "家數"]
    cols = {
        "twse_n": count_cols[0],
        "twse_cap": header.index("上市公司市值"),
        "tpex_n": count_cols[1],
        "tpex_cap": header.index("上櫃市值"),
    }
    annual: dict[int, dict[str, float]] = {}
    for r in clean:
        if r and isinstance(r[0], float) and 1990 < r[0] < 2100:
            annual[int(r[0])] = {k: r[i] * (1e9 if k.endswith("_cap") else 1) for k, i in cols.items()}

    note = "".join(str(c) for r in clean for c in r if isinstance(c, str))
    as_of = re.search(r"截至(\d+)年12月底", note)
    listed = re.search(r"本國上市公司(\d+)家、第一上市之外國企業(\d+)家", note)
    otc = re.search(r"本國上櫃公司(\d+)家、第一上櫃之外國企業(\d+)家", note)
    if not (as_of and listed and otc):
        raise RuntimeError("證期局 t01 的附註格式變了，找不到本國與外國企業的家數")
    year = int(as_of.group(1)) + ROC_OFFSET
    total = annual[year]
    if int(listed.group(1)) + int(listed.group(2)) != total["twse_n"] or int(otc.group(1)) + int(otc.group(2)) != total["tpex_n"]:
        raise RuntimeError(f"證期局 t01 附註的家數跟表裡的 {year} 年對不起來：{listed.group(0)}；{otc.group(0)}")
    return year, annual, (int(listed.group(2)), int(otc.group(2)))


def year_end() -> tuple[dict[int, dict[str, float]], dict[int, tuple[int, int]]]:
    """({年: {twse_n, twse_cap, tpex_n, tpex_cap}}, {年: (第一上市, 第一上櫃)})，年底值，市值是新臺幣元，1998 年起。

    開放資料（103533）的 12 月為主，之後的年份用最新一期 12 月份重要指標的 t01 補；兩邊都有的年份檢查是否一致。
    """
    out = _monthly_december()
    year, annual, foreign = _latest_december()
    for y, v in annual.items():
        if y in out:
            diff = {k: (out[y][k], v[k]) for k in v if abs(out[y][k] - v[k]) > max(1.0, abs(v[k]) * 1e-6)}
            if diff:
                print(f"  警告：證期局 {y} 年的開放資料跟重要指標 t01 不同：{diff}")
        else:
            out[y] = v
    return dict(sorted(out.items())), {**FOREIGN_PRIMARY, year: foreign}
