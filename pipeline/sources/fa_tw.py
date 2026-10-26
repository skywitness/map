"""農業部漁業署《漁業統計年報》：台灣的漁業生產量（公噸），依漁業種類（遠洋、近海、沿岸、內陸漁撈、海面養殖、內陸養殖）。

- 民國 114 年（2025）版的「7. 漁業生產量統計相關報表」zip 裡的「11406_歷年漁業生產量值.ods」（1959–2025 年）。
  年報放在漁業署網站（https://www.fa.gov.tw/list.php?theme=FS_AR ），不必登入。
- 授權：漁業署網站的「網站資料開放宣告」（https://www.fa.gov.tw/information.php ，2026-10-26 查）不是政府資料開放授權
  條款：網站內容受著作權法保護，以漁業署名義發表的著作「在合理範圍內，得重製、公開播送或公開傳輸，利用時，並請註明出處」。
  政府資料開放平臺上漁業署的生產量資料集（UnitId G76 等）只有舊年份。所以這裡只在台灣的附註與側欄引用年報的數字
  （統計數字是事實，註明出處），地圖上的值一律用 FAO（各國同一套方法），不混用（DESIGN.md 第 8 節第 12 點）。
- 跟 FAO 的比較（oceans.py 會檢查）：捕撈（遠洋＋近海＋沿岸＋內陸漁撈）跟 FAO 的台灣捕撈量幾乎一樣（2024 年
  773,634 對 773,463 公噸）。養殖差很多：FAO 的牡蠣是帶殼的活體重量（2024 年 112,673 公噸），漁業署的牡蠣
  只有 16,153 公噸（113 年年報的英文摘要「Oyster: The production in 2024 was 16,153 M.T.」）。
- ODS 是 zip 裡的 content.xml（OpenDocument），用標準函式庫的 xml.etree 讀，不必另外裝套件。
"""
from __future__ import annotations

import io
import re
import xml.etree.ElementTree as ET
import zipfile

from common import download

URL = "https://www.fa.gov.tw/redirect_file.php?theme=FS_AR&id=24949"
INFO_URL = "https://www.fa.gov.tw/view.php?theme=FS_AR&subtheme=&id=31"
REPORT = "民國114年(2025)漁業統計年報"
REPORT_EN = "Fisheries Statistical Yearbook 2025 (Taiwan)"
# 113 年年報英文摘要的牡蠣產量（公噸），說明 FAO 與漁業署的養殖量為什麼差很多
OYSTER_2024 = 16153

# 代碼 → 漁業種類
TYPES = {
    "1000": "distant",  # 遠洋漁業
    "2000": "offshore",  # 近海漁業
    "3000": "coastal",  # 沿岸漁業
    "4000": "inlandCapture",  # 內陸漁撈
    "5000": "marineCulture",  # 海面養殖
    "6000": "inlandCulture",  # 內陸養殖
}
TOTAL = "0000"
CAPTURE_TYPES = ("distant", "offshore", "coastal", "inlandCapture")
CULTURE_TYPES = ("marineCulture", "inlandCulture")

NS_TABLE = "urn:oasis:names:tc:opendocument:xmlns:table:1.0"
NS_TEXT = "urn:oasis:names:tc:opendocument:xmlns:text:1.0"
NS_OFFICE = "urn:oasis:names:tc:opendocument:xmlns:office:1.0"
T = "{%s}" % NS_TABLE


def _cells(row: ET.Element) -> list[str]:
    out: list[str] = []
    for cell in row:
        if cell.tag not in (T + "table-cell", T + "covered-table-cell"):
            continue
        repeat = min(int(cell.get(T + "number-columns-repeated", "1")), 64)
        value = cell.get("{%s}value" % NS_OFFICE)
        if value is None:
            value = " ".join("".join(p.itertext()) for p in cell.iter("{%s}p" % NS_TEXT)).strip()
        out.extend([value] * repeat)
    return out


def production() -> dict[int, dict[str, float]]:
    """{年: {漁業種類: 公噸, 'total': 公噸}}，1959 年起"""
    path = download(URL, "fa-tw", "fisheries_production_114.zip")
    with zipfile.ZipFile(path) as outer:
        names = [n for n in outer.namelist() if n.endswith(".ods")]

        def decoded(n: str) -> str:
            try:
                return n.encode("cp437").decode("big5")
            except (UnicodeEncodeError, UnicodeDecodeError):
                return n

        member = next((n for n in names if "歷年漁業生產量值" in decoded(n)), None)
        if member is None:
            raise RuntimeError(f"漁業署的年報 zip 裡找不到「歷年漁業生產量值」：{[decoded(n) for n in names]}")
        ods = zipfile.ZipFile(io.BytesIO(outer.read(member)))
        root = ET.fromstring(ods.read("content.xml"))

    out: dict[int, dict[str, float]] = {}
    for table in root.iter(T + "table"):
        years: list[int | None] = []
        for row in table.iter(T + "table-row"):
            cells = _cells(row)
            if len(cells) > 2 and cells[1].strip() == "Year":
                # 每年兩欄（產量、價值），年份寫在產量那一欄
                years = [int(c) if re.fullmatch(r"\d{4}", c.strip()) else None for c in cells]
                continue
            if not years or not cells or cells[0] not in TYPES and cells[0] != TOTAL:
                continue
            key = "total" if cells[0] == TOTAL else TYPES[cells[0]]
            for i, y in enumerate(years):
                if y is None or i >= len(cells):
                    continue
                text = cells[i].strip()
                out.setdefault(y, {})[key] = 0.0 if text in ("", "-") else float(text)
    if not out or max(out) < 2025:
        raise RuntimeError(f"漁業署的歷年漁業生產量讀不到 2025 年（讀到 {min(out, default=None)}–{max(out, default=None)}）")
    for y, v in out.items():
        parts = sum(v.get(k, 0.0) for k in TYPES.values())
        if abs(parts - v["total"]) > max(5.0, v["total"] * 0.001):
            raise RuntimeError(f"漁業署 {y} 年的各漁業種類加起來 {parts:.0f} 跟總計 {v['total']:.0f} 對不上")
    return out
