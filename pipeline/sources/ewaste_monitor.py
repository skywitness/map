"""Global E-waste Monitor 2024（UNITAR、ITU）：各國 2022 年的電子垃圾產生量與正式回收量。

**授權**：CC BY-NC-SA 3.0 IGO（報告的版權頁與 ewastemonitor.info 的 Copyright 頁），非商業、相同方式分享：
這裡輸出的資料檔也用 CC BY-NC-SA 3.0 IGO（DESIGN.md 第 8 節第 12 點）。

**資料**：只在報告 PDF 的附錄 2（Annex 2. Datasets）的各國表裡，用 sources/pdfreader.py 讀文字片段，依每頁表頭
「REGION」的位置對齊欄位（左右頁的邊界不同）。一列的欄位：國名、區域、產生量（百萬公斤）、每人（公斤）、
正式收集回收量（百萬公斤，沒有的寫 N/A）、回收資料出處、有沒有電子垃圾的法規、生產者延伸責任（EPR）、收集目標、
回收目標。數字用逗號當小數點，沒有千分位。國名太長的換行接在下一列（只有國名欄有字）。
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass

from common import download
from sources import pdfreader
from sources.countries import from_name

URL = "https://ewastemonitor.info/wp-content/uploads/2024/12/GEM_2024_EN_11_NOV-web.pdf"
YEAR = 2022
# 欄位的 x 範圍（以「REGION」在 105 的頁面為準，其他頁依表頭平移）
COLUMNS = [("name", 0, 105), ("region", 105, 150), ("generated", 150, 205), ("per_capita", 205, 262),
           ("recycled", 262, 338), ("reference", 338, 573), ("law", 573, 636), ("epr", 636, 682)]
REGIONS = {"Africa", "Americas", "Asia", "Europe", "Oceania"}
# 報告的國名 → ISO3（pycountry 對不到的）
NAMES = {
    "Taiwan (Province of China)": "TWN", "China, Hong Kong SAR": "HKG", "China, Hong Kong": "HKG",
    "China, Macao SAR": "MAC", "China, Macao": "MAC", "Republic of Korea": "KOR",
    "Democratic People's Republic of Korea": "PRK", "Democratic Republic of the Congo": "COD", "Congo": "COG",
    "Türkiye": "TUR", "Turkey": "TUR", "Iran (Islamic Republic of)": "IRN", "Bolivia (Plurinational State of)": "BOL",
    "Venezuela (Bolivarian Republic of)": "VEN", "Lao People's Democratic Republic": "LAO", "Viet Nam": "VNM",
    "Russian Federation": "RUS", "Republic of Moldova": "MDA", "United Republic of Tanzania": "TZA",
    "Syrian Arab Republic": "SYR", "Côte d'Ivoire": "CIV", "Cabo Verde": "CPV", "Eswatini": "SWZ", "Swaziland": "SWZ",
    "Micronesia (Federated States of)": "FSM", "State of Palestine": "PSE", "Kosovo": "XKX", "Saudi": "SAU",
    "China, Hong Kong Special Administrative Region": "HKG", "China, Macao Special Administrative Region": "MAC",
    "The former Yugoslav Republic of Macedonia": "MKD", "Sao Tomé and Príncipe": "STP", "Czech Republic": "CZE",
}


@dataclass
class Row:
    iso3: str
    name: str
    generated: float  # 百萬公斤
    per_capita: float  # 公斤
    recycled: float | None  # 百萬公斤；報告寫 N/A 的是 None
    law: bool
    epr: bool


def _number(text: str) -> float | None:
    text = text.strip().replace(" ", "")
    if not text or text.upper() == "N/A":
        return None
    try:
        return float(text.replace(",", "."))
    except ValueError:
        return None  # 不是數字（例如國家分組表的「Northern Europe」）


def rows() -> list[Row]:
    texts, _rects = pdfreader.read(download(URL, "ewaste", "GEM_2024_EN_11_NOV-web.pdf"))
    # 各國表的頁面：表頭有「COUNTRY」（前面的區域表也有「REGION」，版面不同）
    pages = {t.page for t in texts if t.text.startswith("COUNTR") and t.x < 60}
    shift = {t.page: t.x - 105 for t in texts if t.text.startswith("REGION") and t.page in pages}
    lines: dict[tuple[int, float], list] = defaultdict(list)
    for t in texts:
        if t.page in shift and 40 < t.y < 490:  # 表頭（y 約 495–540）與頁首「Annex 2. Datasets」、頁尾不算
            lines[(t.page, round(t.y, 1))].append(t)
    parsed: list[dict[str, str]] = []
    for key in sorted(lines, key=lambda k: (k[0], -k[1])):
        cells = {c: "" for c, _, _ in COLUMNS}
        for t in sorted(lines[key], key=lambda t: t.x):
            x = t.x - shift[key[0]]
            for c, lo, hi in COLUMNS:
                if lo <= x < hi:
                    cells[c] += t.text
                    break
        cells = {k: v.strip() for k, v in cells.items()}
        if cells["region"] in REGIONS and _number(cells["generated"]) is not None:
            parsed.append(cells)
        elif parsed and cells["name"] and not any(cells[c] for c in ("region", "generated", "per_capita", "law")):
            # 國名換行：斷字的連字號後面接小寫的是同一個字（Adminis- trative），接大寫的保留連字號（Guinea-Bissau）
            prev = parsed[-1]["name"]
            if prev.endswith("-"):
                parsed[-1]["name"] = (prev[:-1] if cells["name"][:1].islower() else prev) + cells["name"]
            else:
                parsed[-1]["name"] = prev + " " + cells["name"]
    out: list[Row] = []
    missing = []
    for c in parsed:
        name = re.sub(r"\s+", " ", c["name"])
        iso3 = NAMES.get(name) or from_name(name)
        if not iso3:
            missing.append(name)
            continue
        out.append(Row(iso3, name, _number(c["generated"]), _number(c["per_capita"]), _number(c["recycled"]),
                       c["law"].startswith("Yes"), c["epr"].startswith("Yes")))
    if missing:
        raise RuntimeError(f"Global E-waste Monitor 的國名對不到 ISO3：{missing}")
    if len(out) < 150:
        raise RuntimeError(f"Global E-waste Monitor 只讀到 {len(out)} 國，PDF 的版面可能變了")
    return out
