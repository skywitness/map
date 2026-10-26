"""UNCTAD Data Hub（UNCTADstat）的整包下載（bulk download）。

- 網址：https://unctadstat-api.unctad.org/bulkdownload/<報表>/<報表的檔名>，不必註冊、不必金鑰；
  回傳 7z 壓縮的 CSV（一個報表一個檔），用 py7zr 解開。
- 授權：CC BY 3.0 IGO。UNCTADstat 的 About／FAQ 頁：「All materials provided on this website are copyrighted under
  the Creative Commons Attribution 3.0 IGO license」「All data and metadata provided on the UNCTAD Data Hub may be
  copied freely, duplicated and further distributed provided that United Nations Trade and Development Data Hub is
  cited as the source.」（2026-10-26 查，DESIGN.md 第 8 節第 12 點）
- 經濟體代碼是 UN M49（3 碼的數字字串，台灣是 158「China, Taiwan Province of」），4 碼的是區域與組別
  （0000 世界、1400 開發中經濟體…），不收。
"""
from __future__ import annotations

import csv

import py7zr

from common import download
from sources.countries import from_numeric

URL = "https://unctadstat-api.unctad.org/bulkdownload/{report}/{name}"
SOURCE_URL = "https://unctadstat.unctad.org/datacentre/dataviewer/{report}"
WORLD = "0000"


def rows(report: str) -> list[dict[str, str]]:
    """報表的 CSV（例如 'US.ContPortThroughput'）→ 每列一個 dict（欄名照 CSV 的表頭）"""
    name = report.replace(".", "_")
    path = download(URL.format(report=report, name=name), "unctadstat", f"{name}.7z")
    folder = path.with_suffix("")
    with py7zr.SevenZipFile(path) as archive:
        names = archive.getnames()
        csvs = [k for k in names if k.lower().endswith(".csv")]
        if len(csvs) != 1:
            raise RuntimeError(f"{report} 的壓縮檔裡應該只有一個 CSV：{names}")
        target = folder / csvs[0]
        if not target.exists() or target.stat().st_mtime < path.stat().st_mtime:
            archive.extractall(folder)
    with open(target, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def iso3(code: str) -> str | None:
    """UNCTAD 的經濟體代碼 → ISO alpha-3；區域、組別（4 碼）與已經不存在的（荷屬安地列斯 530）回傳 None"""
    if len(code) != 3 or not code.isdigit() or code == "530":
        return None
    return from_numeric(code)


def number(text: str) -> float | None:
    return float(text) if text.strip() else None
