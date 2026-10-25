"""法務部《法務統計年報》表 4-1「矯正機關收容情形」（政府資料開放授權條款第 1 版）：台灣的監禁人口率。

法務統計資訊網（https://www.rjsd.moj.gov.tw/RJSDWeb/book/Book.aspx?category_id=4）只放了 113、114 年版的年報，
每一版的表 4-1 有最近 10 年的年底人數，兩版合起來是 104–114 年（2015–2025 年）；同一年兩版都有時用新的。
檔案是 ODS（XLS 要另裝套件讀），用 zipfile 讀 content.xml。

- 「矯正機關總收容人數」= 監獄收容人（受刑人、受保安處分人及押候執行者）＋強制工作受處分人（2021 年釋字第 812 號後沒有）
  ＋受感化教育學生（少年矯正學校）＋被告及被管收人（看守所的羈押被告）＋收容少年（少年觀護所）
  ＋受觀察勒戒人＋受戒治人（毒品的觀察勒戒、強制戒治）。法務部的「監禁人口率」（每十萬人中收容於矯正機關之人數，
  行政院人權指標）就是這個數 ÷ 年底戶籍人口，2025 年底 271.7。
- 法務統計資訊網的「常用統計表」也有同一張表（list_id=1216），但只列最近 4 年。

授權：法務部網站的「資料開放宣告」：網站上的資料與素材採政府資料開放授權條款第 1 版（https://www.moj.gov.tw/2807/2817/33911/）。
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
import zipfile

from common import download

BOOK = "https://www.rjsd.moj.gov.tw/RJSDWeb/book/Book_File.ashx?chapter_id={chapter}"
# (年報的年份（民國）, 表 4-1 ODS 的 chapter_id)；新的放前面
EDITIONS = [(114, "733_45_2"), (113, "683_47_2")]
PAGE = "https://www.rjsd.moj.gov.tw/RJSDWeb/book/Book.aspx?category_id=4"

_T = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
_P = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}p"

# 表裡的列名 → 程式裡的鍵
ROWS = {
    "矯正機關總收容人數": "total",
    "監獄收容人": "prison",
    "強制工作受處分人": "forced_labour",
    "受感化教育學生": "reform_school",
    "被告及被管收人": "detainees",
    "收容少年": "juvenile_detention",
    "受觀察勒戒人": "drug_observation",
    "受戒治人": "drug_treatment",
}


def _ods_rows(path) -> list[list[str]]:
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("content.xml"))
    table = next(root.iter(_T + "table"))
    rows = []
    for row in table.iter(_T + "table-row"):
        cells: list[str] = []
        for cell in row:
            n = min(int(cell.get(_T + "number-columns-repeated", "1")), 64)
            text = " ".join("".join(p.itertext()) for p in cell.iter(_P)).strip()
            cells.extend([text] * n)
        rows.append(cells)
    return rows


def _number(text: str) -> float | None:
    text = text.replace(",", "").strip()
    if text in ("－", "-", "—"):
        return 0.0
    return float(text) if re.fullmatch(r"\d+(\.\d+)?", text) else None


def corrections() -> dict[int, dict[str, float]]:
    """{西元年: {'total': 年底總收容人數, 'prison': 監獄收容人, 'detainees': 被告…}}"""
    out: dict[int, dict[str, float]] = {}
    for roc, chapter in EDITIONS:
        path = download(BOOK.format(chapter=chapter), "moj", f"yearbook{roc}-table4-1.ods")
        rows = _ods_rows(path)
        head = next((r for r in rows if r and r[0].replace(" ", "") == "項目別"), None)
        if not head:
            raise RuntimeError(f"{roc} 年版年報表 4-1 的表頭變了")
        years = {j: 1911 + int(m.group(1)) for j, c in enumerate(head) if (m := re.fullmatch(r"(\d+)年", c))}
        if not years or max(years.values()) != 1911 + roc:
            raise RuntimeError(f"{roc} 年版年報表 4-1 的年份不對：{sorted(years.values())}")
        found = set()
        for r in rows:
            label = next((c for c in r if c), "")
            key = next((k for name, k in ROWS.items() if label.startswith(name)), None)
            if not key or key in found:
                continue
            found.add(key)
            for j, year in years.items():
                v = _number(r[j]) if j < len(r) else None
                if v is not None and key not in out.get(year, {}):
                    out.setdefault(year, {})[key] = v
        if "total" not in found:
            raise RuntimeError(f"{roc} 年版年報表 4-1 找不到總收容人數")
    for year, parts in out.items():
        components = sum(v for k, v in parts.items() if k != "total")
        if abs(components - parts["total"]) > 1:
            raise RuntimeError(f"{year} 年各類收容人加起來 {components} 不等於總收容人數 {parts['total']}")
    return out
