"""Erik Voeten 的聯合國大會投票資料（Harvard Dataverse，doi:10.7910/DVN/LEJUQZ）。

- 資料集原名「United Nations General Assembly Voting Data」，2025 年 7 月（第 35 版）起改名
  「United Nations General Assembly Ideal Points」，同時改成依投票的日曆年估計（之前依大會屆次）。
  現在只放理想點與兩兩國家的一致度，沒有逐筆表決；估計用的原始表決除了 2024、2025 年的最後表決（作者自己整理）以外，
  來自 UNGA-DM 資料庫（https://unvotes.unige.ch/ ，Fjelstul, Hug & Kilby 2025）。
- 授權：CC0 1.0（Dataverse 的 license 欄位，第 39 版也一樣）。
- 用第 39 版（2026-07-30 發布）的兩個檔，都只看「決議案的最後表決」（final passage，含沒有通過的）：
  - IdealpointestimatesFP_2026FP.csv（file id 14098429，1.4 MB）：每國每年的理想點，1946–2025。
  - AgreementScores.Rdata（file id 11837232，21.7 MB）：兩兩國家每年的一致度，1946–2024。
    同一份資料也有 CSV（AgreementScores.csv，file id 11837234，145 MB），RData 小很多，
    用民主主題寫好的 R 序列化讀取器（sources/vdem.py 的 read_rdata_columns）讀。
- 下載：https://dataverse.harvard.edu/api/access/datafile/<file id>。file id 對應固定內容的檔案
  （作者更新時會換新的 id），下載後比對 Dataverse 公布的 MD5。新版出來時改 VERSION 與 FILES。
- 國家代碼是 Correlates of War（COW）的數字代碼；理想點檔另外有 iso3c 欄，歷史上的國家寫 CSK、YUG、SCG、DDR、
  YAR、YMD，台灣（COW 713）是 TWN。
"""
from __future__ import annotations

import csv
import hashlib
from pathlib import Path

from common import download
from sources.vdem import read_rdata_columns

VERSION = "39.0"
RELEASED = "2026-07-30"
DOI = "https://doi.org/10.7910/DVN/LEJUQZ"
API = "https://dataverse.harvard.edu/api/access/datafile/"

# 檔案：(Dataverse file id, 檔名, MD5)
FILES = {
    "ideal": (14098429, "IdealpointestimatesFP_2026FP.csv", "ba6b6c7b6d1344d68fc0dc94ecbbfd9d"),
    "agree": (11837232, "AgreementScores.Rdata", "1cc866ab5502110ac3c2a8b6f860792c"),
}


def _fetch(key: str) -> Path:
    file_id, name, md5 = FILES[key]
    path = download(f"{API}{file_id}", "unvotes", name)
    digest = hashlib.md5(path.read_bytes()).hexdigest()
    if digest != md5:
        raise RuntimeError(f"{name} 的 MD5 是 {digest}，跟 Dataverse 公布的 {md5} 不同（檔案不完整，或作者更新了內容）")
    return path


def ideal_points() -> list[dict]:
    """理想點：每國每年一列。ccode（COW）、iso3c、name、year、votes（參加的最後表決次數）、
    ideal（後驗平均）、q5、q95（90% 可信區間）"""
    out = []
    with open(_fetch("ideal"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            out.append({
                "ccode": int(r["ccode"]),
                "iso3c": r["iso3c"],
                "name": r["Countryname"],
                "year": int(r["year"]),
                "votes": int(r["NVotesFP"]),
                "ideal": float(r["IdealPointFP"]),
                "q5": float(r["Q5%FP"]),
                "q95": float(r["Q95%FP"]),
            })
    return out


def agreement() -> dict[str, list]:
    """兩兩國家的一致度：ccode1、ccode2、year、agree（0–1）四個等長的欄位。
    每一對國家兩個方向都有一列（A–B 與 B–A），約 182 萬列。"""
    cols = read_rdata_columns(_fetch("agree"), ["ccode1", "ccode2", "year", "agree"])
    cols["year"] = [None if y is None else int(y) for y in cols["year"]]
    return cols
