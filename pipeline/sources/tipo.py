"""經濟部智慧財產局的專利統計開放資料（政府資料開放授權條款）：補上 WIPO／世界銀行沒有的台灣。

data.gov.tw 81180「本國人與外國人新申請專利件數統計表」：民國年 × 本國人／外國人 × 發明／新型／設計，2007 年起。
檔案是 Big5（cp950）。
"""
from __future__ import annotations

import csv
import io

from common import download

URL = "https://tiponet.tipo.gov.tw/datagov/pt/130-107-001.csv"
ROC_OFFSET = 1911
APPLICANTS = {"本國人": "resident", "外國人": "nonresident"}


def invention_applications() -> dict[str, dict[int, int]]:
    """發明專利的新申請件數：{'resident': {年: 件數}, 'nonresident': {年: 件數}}。

    只取「發明」：WIPO 的 patent applications 是發明專利，新型（utility model）與設計另外統計。
    智慧局依申請人的國籍分本國人／外國人，WIPO 依第一申請人的居住地分 resident／non-resident。
    """
    path = download(URL, "tipo", "new-applications.csv")
    text = path.read_bytes().decode("cp950")
    if text.lstrip().startswith("<"):
        path.unlink()  # 下次重新下載
        raise RuntimeError("智慧局回傳的是網頁不是 CSV，下載網址可能變了")
    out: dict[str, dict[int, int]] = {v: {} for v in APPLICANTS.values()}
    for row in csv.DictReader(io.StringIO(text)):
        who = APPLICANTS.get(row["本國人/外國人"].strip())
        if who and row["專利類型"].strip() == "發明":
            out[who][int(row["年度"]) + ROC_OFFSET] = int(row["件數"].replace(",", ""))
    if not out["resident"]:
        raise RuntimeError("智慧局的專利統計沒有發明專利的資料，欄位可能變了")
    return out


def design_applications() -> dict[int, int]:
    """本國人的設計專利新申請件數 {年: 件數}（同一個檔，專利類型「設計」；WIPO 的工業設計申請依居住地、以設計數計）"""
    path = download(URL, "tipo", "new-applications.csv")
    out: dict[int, int] = {}
    for row in csv.DictReader(io.StringIO(path.read_bytes().decode("cp950"))):
        if row["本國人/外國人"].strip() == "本國人" and row["專利類型"].strip() == "設計":
            out[int(row["年度"]) + ROC_OFFSET] = int(row["件數"].replace(",", ""))
    if not out:
        raise RuntimeError("智慧局的專利統計沒有設計專利的資料，欄位可能變了")
    return out


TRADEMARK_URL = "https://tiponet.tipo.gov.tw/datagov/tm/100-105-001.zip"  # data.gov.tw 35459「商標案件統計季報」


def trademark_applications() -> tuple[dict[int, int], dict[int, float]]:
    """本國人的商標申請註冊件數 {年: 件數}（表 3-2，四季加總，只收四季都有的年份），以及全部申請的平均每件類別數
    {年: 類別數 ÷ 件數}（表 3-1；WIPO 的商標申請是類別數，本國人沒有分開的類別數）"""
    import zipfile

    z = zipfile.ZipFile(download(TRADEMARK_URL, "tipo", "trademark-quarterly.zip"))

    def table(prefix: str) -> list[dict]:
        name = next(n for n in z.namelist() if n.startswith(prefix))
        raw = z.read(name)
        for enc in ("utf-8-sig", "cp950"):
            try:
                return list(csv.DictReader(io.StringIO(raw.decode(enc))))
            except UnicodeDecodeError:
                continue
        raise RuntimeError(f"智慧局的商標統計 {name} 讀不出來")

    year_of = lambda r: int(r["年"].replace("年", "").strip()) + ROC_OFFSET  # noqa: E731
    quarters: dict[int, dict[str, int]] = {}
    for r in table("表3-2"):
        if r["類別"].strip() == "申請註冊(案件)" and r["本國人/外國人"].strip() == "本國人":
            quarters.setdefault(year_of(r), {})[r["季"].strip()] = int(r["數量"].replace(",", ""))
    resident = {y: sum(q.values()) for y, q in quarters.items() if len(q) == 4}
    totals: dict[int, list[int]] = {}
    for r in table("表3-1"):
        t = totals.setdefault(year_of(r), [0, 0, 0])
        t[0] += int(r["申請註冊(案件)"].replace(",", ""))
        t[1] += int(r["申請註冊(類別)"].replace(",", ""))
        t[2] += 1
    ratio = {y: c / n for y, (n, c, q) in totals.items() if q == 4 and n}
    if not resident:
        raise RuntimeError("智慧局的商標統計沒有本國人的申請件數，欄位可能變了")
    return resident, ratio
