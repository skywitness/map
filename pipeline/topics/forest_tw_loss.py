"""台灣的森林因為什麼消失：崩塌、風災與森林被害（2026-11-07，製作手冊第二十五批 498，候選 1165；擴充「森林」的台灣側欄）。

- 農業部「2010 年至 2021 年因崩塌或風災減少森林覆蓋面積」（data.gov.tw 169451，政府資料開放授權條款第 1 版）：
  data.moa.gov.tw 的 CSV，8 種林型（公頃）。
- 「森林被害統計－按所有權分」（data.gov.tw 115945，同條款）：agrstat.moa.gov.tw 的年報，民國 92–114 年共 23 份，
  格式混雜（92–105、108 年是 xls，其餘是 ods），表頭是三層合併儲存格。這裡只讀最新一份（民國 114 年，ods）的「總計」
  那一段：發生件數、被害面積（公頃）、損失價值（元），依火災、竊取主副產物、濫墾、其他。被害面積是件數之後的第二個數字
  （第一個數字的欄位名稱在表頭裡對不上，不用）。歷年的 22 份沒有讀。
  林保署網站本身的開放宣告自相矛盾（手冊），只用 data.gov.tw 的資料集。
輸出 public/data/topics/water-forest/tw-forest-loss.json（森林主題的森林覆蓋指標讀它，資料夾跟森林覆蓋一樣）。
"""

from __future__ import annotations

import csv
import json
import zipfile
import xml.etree.ElementTree as ET

from common import OUT_DIR, download, write_json

OUT = OUT_DIR / "topics" / "water-forest"
LANDSLIDE = "https://data.moa.gov.tw/Service/OpenData/DataFileService.aspx?UnitId=I81&FOTT=CSV&IsTransData=1"
DAMAGE_LIST = "https://data.moa.gov.tw/Service/OpenData/agrstat_office_result.aspx?report_code=2234-01-01&IsTransData=1&UnitId=H10"
T = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
CAUSES = ["火災", "竊取主副產物", "濫墾", "其他"]


def _ods_rows(path) -> list[list[str]]:
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("content.xml"))
    rows = []
    table = next(root.iter(T + "table"))
    for row in table.iter(T + "table-row"):
        cells = []
        for c in row.iter(T + "table-cell"):
            rep = min(int(c.get(T + "number-columns-repeated", "1")), 40)
            cells += ["".join(c.itertext()).strip()] * rep
        if any(cells):
            rows.append(cells)
    return rows


def _num(v: str) -> float:
    v = v.replace(",", "").strip()
    return 0.0 if v in ("", "-") else float(v)


def build() -> None:
    path = download(LANDSLIDE, "moa-forest", "landslide.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    header = [h.replace("_公頃", "") for h in rows[0][1:]]
    landslide = {r[0]: [float(x) if x else None for x in r[1:]] for r in rows[1:] if r and r[0]}

    listing = json.loads(download(DAMAGE_LIST, "moa-forest", "damage-list.json").read_text(encoding="utf-8"))
    latest = max(listing, key=lambda x: int(x["year"]))
    year = 1911 + int(latest["year"])
    ods = download(latest["finalized_file_url"], "moa-forest", f"damage-{latest['year']}.ods")
    table = _ods_rows(ods)
    start = next(i for i, r in enumerate(table) if r[0] == "總計")
    by_cause = {}
    # 「總計」那一列：總計、合計、件數、？、面積…；下面四列依原因：原因、件數、？、面積…，損失價值在第 11 個數字
    first = [c for c in table[start] if c]
    total = {"count": int(_num(first[2])), "ha": _num(first[4]), "value": _num(first[12])}
    for r in table[start + 1:start + 5]:
        cells = [c for c in r if c]
        if cells[0] in CAUSES:
            by_cause[cells[0]] = {"count": int(_num(cells[1])), "ha": _num(cells[3]), "value": _num(cells[11])}
    if set(by_cause) != set(CAUSES) or sum(v["count"] for v in by_cause.values()) != total["count"]:
        raise RuntimeError(f"森林被害統計 {latest['year']} 年的表格格式變了：{total} {by_cause}")
    write_json(OUT / "tw-forest-loss.json", {
        "landslide": {"types": header, "years": landslide},
        "damage": {"year": year, "total": total, "causes": [[k, by_cause[k]["count"], by_cause[k]["ha"]] for k in CAUSES]},
    })
    print(f"  崩塌與風災 {min(landslide)}–{max(landslide)}（2010 年 {sum(x or 0 for x in landslide['2010']):,.0f} 公頃）；"
          f"森林被害 {year} 年 {total['count']} 件、{total['ha']} 公頃、{total['value']:,.0f} 元")
