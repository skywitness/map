"""國家小檔案的擴充（2026-10-30，製作手冊第六批 96）：匯率制度。

- 資料：英文維基百科「List of countries by exchange rate regime」（固定 revid 1369823927，2026-08-17，CC BY-SA 4.0）的表
  「De Facto Classification of Exchange Rate Arrangements and Monetary Policy Frameworks (2023)」，照 IMF《AREAER 2023》
  的事實分類整理（使用者決定用這份；AREAER Online 要訂閱）。列是匯率安排（10 類），欄是貨幣政策的架構
  （錨定美元、歐元、一籃貨幣、其他貨幣，貨幣總量目標、通膨目標、其他）。
- 歐元區國家在表裡是「自由浮動、其他架構」（歐元對外自由浮動；IMF 依歐元區整體分類），照表畫，附註寫明。
  「European Union」那一列是歐盟本身，不是國家，不收。
- 10 類併成 8 類（類別圖最多 8 色）：爬行釘住（3 國）、類爬行安排（24 國）、水平區間內的釘住（1 國）併成「爬行與區間」。
- 台灣：IMF 與表裡都沒有。中央銀行 2011-09-04 新聞稿「新台幣匯率制度係採管理浮動匯率（managed floating）」
  （https://www.cbc.gov.tw/tw/cp-302-39220-C6D22-1.html），歸到 IMF 的「浮動」（IMF 2009 年以前叫 managed floating）。
- 輸出 public/data/topics/profiles/exchange-regime.json（一年 2026，跟小檔案其他指標一樣）；hints 是 tooltip 的
  貨幣政策架構（錨定哪一種貨幣、通膨目標…）。
"""
from __future__ import annotations

import re

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import from_name

URL = "https://en.wikipedia.org/w/index.php?title=List_of_countries_by_exchange_rate_regime&action=raw&oldid=1369823927"
OUT = OUT_DIR / "topics" / "profiles"
YEAR = 2026

# 表的列（依順序）→ 代碼（src/topics/profiles.ts 的 EXCHANGE_REGIME）
ROWS = [
    ("No separate", 1), ("Currency board", 2), ("Conventional peg", 3), ("Stabilized arrangement", 4),
    ("Crawling peg", 5), ("Crawl-like arrangement", 5), ("horizontal bands", 5), ("Other managed", 6),
    ("Floating", 7), ("Free floating", 8),
]
# 表的欄 → tooltip 的貨幣政策架構
COLUMNS = [
    ("錨定美元", "Anchor: US dollar"), ("錨定歐元", "Anchor: euro"), ("錨定一籃貨幣", "Anchor: currency composite"),
    ("錨定其他貨幣", "Anchor: another currency"), ("貨幣總量目標", "Monetary aggregate target"),
    ("通膨目標", "Inflation targeting"), ("其他架構", "Other framework"),
]
NAMES = {"Vatican City": "VAT", "Micronesia": "FSM", "Czech Republic": "CZE", "Kosovo": "XKX", "Turkey": "TUR",
         "The Gambia": "GMB", "Gambia": "GMB", "Ivory Coast": "CIV", "São Tomé and Príncipe": "STP", "Laos": "LAO",
         "Republic of the Congo": "COG", "Republic of Congo": "COG", "Sint Maarten": "SXM", "Democratic Republic of the Congo": "COD", "Eswatini": "SWZ"}
EURO_AREA_NOTE = ("歐元區國家沒有自己的貨幣，IMF 依歐元區整體分類：歐元對其他貨幣自由浮動",
                  "Euro area members have no currency of their own; the IMF classifies the euro area as a whole, and the "
                  "euro floats freely against other currencies")
TAIWAN = ("台灣不在 IMF 的分類裡；中央銀行 2011 年的新聞稿說「新台幣匯率制度係採管理浮動匯率」，歸到浮動",
          "Taiwan is not in the IMF classification; the central bank describes the New Taiwan dollar as a managed "
          "float (press release, 2011), classed here as floating")


def build() -> None:
    text = download(URL, "wikipedia", "exchange-rate-regime-1369823927.txt").read_text(encoding="utf-8")
    table = text[text.index("{| class"):text.index("\n|}")]
    rows = table.split("\n|-")[3:]
    if len(rows) != len(ROWS):
        raise RuntimeError(f"匯率制度的表有 {len(rows)} 列，預期 {len(ROWS)} 列，版面可能變了")
    values: dict[str, list] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    missing = []
    for row, (key, code) in zip(rows, ROWS):
        head, _, body = row.strip("\n").partition("\n")
        if key.lower() not in head.lower():
            raise RuntimeError(f"匯率制度的表第 {code} 類應該是「{key}」，讀到「{head}」")
        cells = re.split(r"^\|\|", body, flags=re.M)[1:]
        for col, cell in enumerate(cells):
            for name in re.findall(r"\{\{flag\|([^}|]+)", cell):
                name = name.strip()
                if name == "European Union":
                    continue
                iso3 = NAMES.get(name) or from_name(name)
                if not iso3:
                    missing.append(name)
                    continue
                if iso3 in values:
                    raise RuntimeError(f"{name} 在匯率制度的表裡出現兩次")
                values[iso3] = [code]
                hints[iso3], hints_en[iso3] = COLUMNS[col]
                if code == 8 and col == 6 and iso3 not in ("SOM", "USA"):
                    notes[iso3], notes_en[iso3] = EURO_AREA_NOTE
    if missing:
        raise RuntimeError(f"對不到國家的名稱：{missing}")
    values["TWN"] = [7]
    notes["TWN"], notes_en["TWN"] = TAIWAN
    write_json(OUT / "exchange-regime.json", indicator_file(
        "exchange-regime", "", [YEAR], values, hints=hints, hintsEn=hints_en, notes=notes, notesEn=notes_en))
    counts = {c: sum(1 for v in values.values() if v[0] == c) for c in range(1, 9)}
    print(f"  exchange-regime.json：{len(values)} 個國家或地區，各類 {counts}")
