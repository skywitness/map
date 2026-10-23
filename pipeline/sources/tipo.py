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
