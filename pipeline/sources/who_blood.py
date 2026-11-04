"""WHO《Global status report on blood safety and availability 2025》（2026 年，CC BY-NC-SA 3.0 IGO）的附錄 9：
各國用本國採集的血漿分餾成血漿製劑（PDMP）的方式、用量與自給率，2014–2023 年（PDF 第 141–147 頁）。

只有 PDF。用 `sources.pdfreader`（標準函式庫）讀出每段文字的座標，同一條基線上相連的片段先接起來；
每一頁從表頭的字（Recovered、Apheresis、Source、Total、L per 1000、recovered、Albumin、IVIG、Factor…）定出各欄的中心，
資料格（置中排）歸到中心最近的欄。一國有好幾列（各資料年），國名在名稱欄（x < 年份欄），依 y 歸到最近的資料列，
年份比上一列小（或一樣）就是下一國。缺值三種：「…」沒有回報、「—」沒有回覆、空白不適用，都當成沒有值（不當 0）；
上標的註腳數字（「A, C3」「…4」「Austria2」）拿掉。
"""
from __future__ import annotations

import re
from pathlib import Path

from common import download
from sources import pdfreader

URL = "https://iris.who.int/server/api/core/bitstreams/aa36bd85-6947-4097-adf6-f734922c8026/content"
PAGES = range(141, 148)
YEARS = {2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023}
FIELDS = ["year", "arrangement", "recovered", "apheresis", "source", "total", "per1000", "pct_recovered",
          "prod_albumin", "prod_ivig", "prod_f8", "prod_f9", "sr_albumin", "sr_ivig", "sr_f8"]


def _merge(texts: list[pdfreader.Text]) -> list[tuple[float, float, float, str]]:
    """同一條基線上相連的片段接起來 → [(x, y, x1, 文字)]"""
    out: list[list] = []
    for t in sorted(texts, key=lambda t: (-round(t.y, 1), t.x)):
        if out and abs(out[-1][1] - t.y) < 0.8 and -1.0 < t.x - out[-1][2] < 1.2:
            out[-1][2] = t.x1
            out[-1][3] += t.text
        else:
            out.append([t.x, t.y, t.x1, t.text])
    return [(x, y, x1, s.strip()) for x, y, x1, s in out if s.strip()]


def _columns(items: list[tuple[float, float, float, str]]) -> tuple[dict[str, float], float, float]:
    """表頭 → ({欄位: 中心 x}, 年份欄左緣, 第一個資料列以上的 y)"""
    def centers(label: str) -> list[float]:
        return sorted((x + x1) / 2 for x, y, x1, s in items if s == label)
    year = centers("year")
    recovered = [c for c in centers("recovered") if c > (year[0] if year else 0) + 150]
    albumin, ivig, factor = centers("Albumin"), centers("IVIG"), centers("Factor")
    cols = {
        "year": year[0], "recovered": centers("Recovered")[0], "apheresis": centers("Apheresis")[0],
        "source": centers("Source")[0], "total": centers("Total")[0], "per1000": centers("L per 1000")[0],
        "pct_recovered": recovered[0], "prod_albumin": albumin[0], "prod_ivig": ivig[0],
        "prod_f8": factor[0], "prod_f9": factor[1], "sr_albumin": albumin[1], "sr_ivig": ivig[1], "sr_f8": factor[2],
    }
    cols["arrangement"] = (cols["year"] + cols["recovered"]) / 2 - 3
    year_left = min(x for x, y, x1, s in items if s == "year")
    header_y = min(y for x, y, x1, s in items if s in ("Recovered", "year"))
    return cols, year_left, header_y


def _clean(s: str) -> str:
    s = re.sub(r"(?<=[A-D…])\d$", "", s.strip())
    if re.fullmatch(r"[A-D](\s*,\s*[A-D])*", s):
        s = ", ".join(re.findall(r"[A-D]", s))
    return s


def parse(path: Path) -> dict[str, list[dict]]:
    """{英文國名: [{year, arrangement, total, per1000, sr_albumin…}]}（值是字串，缺值是 None）"""
    texts, _ = pdfreader.read(path)
    out: dict[str, list[dict]] = {}
    for page in PAGES:
        items = _merge([t for t in texts if t.page == page])
        cols, year_left, header_y = _columns(items)
        rows: dict[float, dict] = {}
        names: list[tuple[float, str]] = []
        for x, y, x1, s in items:
            if y >= header_y - 4:
                continue
            if x1 < year_left - 2:
                if not re.fullmatch(r"\d+", s):
                    names.append((y, s))
                continue
            field = min(cols, key=lambda k: abs(cols[k] - (x + x1) / 2))
            row = rows.setdefault(round(y, 1), {})
            row[field] = (row.get(field, "") + " " + s).strip()
        data = [(y, r) for y, r in sorted(rows.items(), reverse=True) if re.fullmatch(r"\d{4}", r.get("year", "")) and int(r["year"]) in YEARS]
        # 依年份把資料列分成各國
        blocks: list[list[tuple[float, dict]]] = []
        for y, r in data:
            if not blocks or int(r["year"]) <= int(blocks[-1][-1][1]["year"]):
                blocks.append([])
            blocks[-1].append((y, r))
        for block in blocks:
            top, bottom = block[0][0] + 7, block[-1][0] - 7
            name = " ".join(s for y, s in sorted(names, key=lambda n: -n[0]) if bottom <= y <= top)
            name = re.sub(r"\s*\d+$", "", name).strip()
            if not name:
                raise RuntimeError(f"WHO 血液報告第 {page} 頁：找不到 {block[0][1]['year']} 起那幾列的國名")
            out.setdefault(name, []).extend(
                {f: (None if _clean(r.get(f, "")) in ("", "…", "—", "..") else _clean(r[f])) for f in FIELDS} for _, r in block)
    return out


def fetch() -> dict[str, list[dict]]:
    return parse(download(URL, "who-blood", "gsrbsa-2025.pdf"))


def number(s: str | None) -> float | None:
    if s is None:
        return None
    s = s.replace(" ", "").replace(" ", "").replace(",", "")
    return float(s) if re.fullmatch(r"\d+(\.\d+)?", s) else None
