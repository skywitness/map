"""USGS Mineral Commodity Summaries（MCS）：各礦種的各國產量與蘊藏量（美國政府著作，公有領域）。

https://pubs.usgs.gov/periodicals/mcs2026/
- 每年 1–2 月出一版，每個礦種一章（兩頁），第 2 頁的「World Mine Production and Reserves」表列出主要生產國
  前兩年的產量（後一年是估計值）與最新的蘊藏量，另有「Other countries」與「World total (rounded)」。
- 讀的是 pubs.usgs.gov 上各章的 PDF（`mcs2025-lithium.pdf`），不是 ScienceBase 的資料發布（data release）：
  - ScienceBase（www.sciencebase.gov）有 Cloudflare 驗證，程式下載會回 HTTP 403。
  - 資料發布只有 MCS 2022 起才有，格式每年不同（2022、2023 每章一個 CSV，2024 每章一個項目，2025 一個總表，
    2026 是長表），2022 版的 CSV 沒有蘊藏量。
  - PDF 從 2020 版起表格版面都一樣（見 `world_table()`），pubs.usgs.gov 可以直接下載。
  解析結果跟 Internet Archive 存下的 2022、2023、2025、2026 版資料發布逐筆比對過（DESIGN.md 第 8 節）。
- 各章 PDF 的檔名就是章名（`rare-earths`、`bauxite-alumina`），鉑族金屬 2022 版以前是 `platinum`、
  2023 版起是 `platinum-group`。
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from common import download
from sources import countries, pdfreader

BASE = "https://pubs.usgs.gov/periodicals/mcs{edition}/mcs{edition}-{slug}.pdf"
SOURCE = "usgs-mcs"

# 表格的國名 → ISO alpha-3（USGS 用美國國務院的寫法）；其他的交給 countries.from_name()
NAMES = {
    "Congo (Kinshasa)": "COD",
    "Congo (Brazzaville)": "COG",
    "Burma": "MMR",
    "Korea, North": "PRK",
    "Korea, Republic of": "KOR",
    "Korea, South": "KOR",
    "Laos": "LAO",
    "Côte d’Ivoire": "CIV",
    "Cote d'Ivoire": "CIV",
    "Côte d'Ivoire": "CIV",
    "New Caledonia": "NCL",
    "Greenland": "GRL",
    "Turkey": "TUR",
    "Russia": "RUS",
}
OTHER = "OTHER"  # 「Other countries」（未列出的國家合計）
WORLD = "WLD"


def chapter_pdf(edition: int, slug: str) -> Path:
    if slug == "platinum-group" and edition <= 2022:
        slug = "platinum"
    return download(BASE.format(edition=edition, slug=slug), SOURCE, f"mcs{edition}-{slug}.pdf")


@dataclass
class Cell:
    x0: float
    x1: float
    text: str
    size: float


@dataclass
class Column:
    """表格的一欄：group 是上方的欄位標題（「Mine production」「Platinum」「Bauxite production」），
    year 是年份（蘊藏量那一欄是 None，reserves 為 True）"""

    x1: float
    group: str
    year: int | None
    reserves: bool


@dataclass
class Value:
    value: float | None  # None：W（保密）、NA、XX 等
    flag: str  # ""、"W"、"NA"、"XX"、">"（大於，世界總計的下限）、"small"
    raw: str


@dataclass
class Table:
    edition: int
    slug: str
    title: str
    columns: list[Column]
    rows: list[tuple[str, dict[int, Value]]]  # (原文國名, {欄位索引: 值})


def _lines(path: Path) -> list[tuple[int, float, list[Cell]]]:
    """PDF 的文字依行（同一頁、同一個 y）合併成儲存格：同一行裡間隔 3 pt 以內、字級相同的片段併成一格。"""
    texts, _ = pdfreader.read(path)
    # y 相差 1.5 pt 以內算同一行（同一列的數字偶爾比國名低 1 pt；上標高 3–4 pt，會在另一行）
    groups: list[list] = []
    for t in sorted(texts, key=lambda t: (t.page, -t.y)):
        if groups and groups[-1][0].page == t.page and groups[-1][0].y - t.y <= 1.5:
            groups[-1].append(t)
        else:
            groups.append([t])
    out = []
    for group in groups:
        cells: list[Cell] = []
        for t in sorted(group, key=lambda t: t.x):
            if cells and t.x - cells[-1].x1 <= 3 and abs(t.size - cells[-1].size) < 0.5:
                cells[-1].x1 = t.x1
                cells[-1].text += t.text
            else:
                cells.append(Cell(t.x, t.x1, t.text, t.size))
        cells = [c for c in cells if c.text.strip()]
        for c in cells:
            c.text = c.text.strip()
        out.append((group[0].page, group[0].y, cells))
    return out


TITLE_RE = re.compile(r"^World [A-Za-z ()\-,]*?[Pp]roduction[A-Za-z ()\-,]*:")
YEAR_RE = re.compile(r"^(19|20)\d\d$")
VALUE_RE = re.compile(r"^(>?[\d,]+(\.\d+)?|W|NA|XX|—|–|-|Small|\(|\))$")
SUPERSCRIPT = 8.5  # 註腳編號、e（估計值）的字級是 6，正文是 10


def parse_value(raw: str) -> Value:
    s = raw.strip()
    if s in ("W", "NA", "XX"):
        return Value(None, s, raw)
    if s in ("—", "–", "-"):
        return Value(0.0, "", raw)  # MCS 的「—」是零
    if s == "Small":
        return Value(None, "small", raw)
    if s in ("(", ")"):  # 「(⁴)」：註腳，通常是「併在其他國家」
        return Value(None, "NA", raw)
    flag = ">" if s.startswith(">") else ""
    return Value(float(s.lstrip(">").replace(",", "")), flag, raw)


def world_table(edition: int, slug: str) -> Table:
    """解析一章的世界產量與蘊藏量表。

    版面（2020–2026 版都一樣）：標題「World … Production … :」之後是欄位標題（一或兩行，例如
    「Mine production | Reserves」或「Palladium | Platinum」），下一行是年份，再來每個國家一行，
    國名在左邊、數字靠右對齊；註腳編號與「e」是小字，PDF 裡在另一行。表格到「World Resources」為止。
    欄位依數字的右緣分群，對到最近的年份標題；右邊沒有年份的那一欄是蘊藏量。
    """
    lines = _lines(chapter_pdf(edition, slug))
    start = next(i for i, (_, _, cells) in enumerate(lines) if cells and TITLE_RE.match(cells[0].text))
    end = next(
        i
        for i in range(start + 1, len(lines))
        if lines[i][2] and lines[i][2][0].text.startswith(("World Resources", "Substitutes"))
    )
    region = [(page, y, [c for c in cells if c.size >= SUPERSCRIPT]) for page, y, cells in lines[start:end]]
    title = region[0][2][0].text.split(":")[0]

    # 年份那一行：兩個以上的年份，其他只有「(thousand metric tons)」這類單位說明
    year_row = next(
        (
            i
            for i, (_, _, cells) in enumerate(region)
            if sum(1 for c in cells if YEAR_RE.match(c.text)) >= 2
            and all(YEAR_RE.match(c.text) or c.text.startswith("(") for c in cells)
        ),
        None,
    )
    if year_row is None:  # 例如鍺 2024 版起只剩文字說明
        raise ValueError(f"MCS {edition} {slug}：「{title}」底下沒有表格")
    year_cells = [c for c in region[year_row][2] if YEAR_RE.match(c.text)]
    # 年份正上方那一行欄位標題（PGM、氧化鋁與鋁土礦有兩層，取最靠近年份的一層）
    header_cells: list[Cell] = []
    for _, _, cells in reversed(region[1:year_row]):
        heads = [c for c in cells if c.x0 > 150 and not VALUE_RE.match(c.text)]
        if heads:
            header_cells = heads
            break
    all_headers = [c for _, _, cells in region[1:year_row + 1] for c in cells if c.x0 > 150]
    has_reserves = any("eserves" in c.text for c in all_headers)

    data_rows: list[tuple[str, list[Cell]]] = []
    for _, _, cells in region[year_row + 1 :]:
        if not cells or cells[0].x0 > 80:
            continue
        # 「(⁴)」：括號中間的註腳編號是小字，拿掉後剩下「(」「)」兩格，只留「(」
        values = [c for c in cells[1:] if c.x0 > 150 and VALUE_RE.match(c.text) and c.text != ")"]
        if values:
            data_rows.append((cells[0].text, values))

    # 欄位：數字的右緣分群（容許 12 pt）
    anchors: list[list[float]] = []
    for _, values in data_rows:
        for c in values:
            for group in anchors:
                if abs(sum(group) / len(group) - c.x1) <= 12:
                    group.append(c.x1)
                    break
            else:
                anchors.append([c.x1])
    xs = sorted(sum(g) / len(g) for g in anchors)
    columns: list[Column] = []
    for x in xs:
        near = min(year_cells, key=lambda c: abs(c.x1 - x))
        if abs(near.x1 - x) <= 25:
            center = (near.x0 + near.x1) / 2
            head = min(header_cells, key=lambda h: abs((h.x0 + h.x1) / 2 - center)) if header_cells else None
            columns.append(Column(x, head.text if head else "", int(near.text), False))
        elif has_reserves and x > max(c.x1 for c in year_cells):
            columns.append(Column(x, "Reserves", None, True))
        else:
            raise ValueError(f"MCS {edition} {slug}：x={x:.0f} 的欄位對不到年份")

    rows: list[tuple[str, dict[int, Value]]] = []
    for label, values in data_rows:
        row: dict[int, Value] = {}
        for c in values:
            i = min(range(len(columns)), key=lambda i: abs(columns[i].x1 - c.x1))
            if i in row:
                raise ValueError(f"MCS {edition} {slug}：{label} 有兩個值落在同一欄")
            row[i] = parse_value(c.text)
        rows.append((label, row))
    return Table(edition, slug, title, columns, rows)


def area_code(label: str) -> str | None:
    """表格的國名 → ISO alpha-3；「Other countries」→ OTHER，「World total」→ WLD，認不得回傳 None。"""
    name = label.strip()
    if name.lower().startswith("world total"):
        return WORLD
    if name.lower().startswith("other"):
        return OTHER
    if name in NAMES:
        return NAMES[name]
    # 「Burma (Myanmar)」「Russia (recoverable)」「Kazakhstan, concentrate」
    base = re.sub(r"\s*\(.*?\)\s*$", "", name)
    base = re.sub(r",\s*(concentrate|gross weight|ore)$", "", base)
    if base in NAMES:
        return NAMES[base]
    return countries.from_name(base)
