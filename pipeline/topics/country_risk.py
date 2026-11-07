"""外匯存底與外債：OECD 國家風險等級（2026-11-07，製作手冊第二十五批 457，候選 1100；步驟 reserves-country-risk，
輸出 topics/reserves/country-risk.json）。

- OECD《Country Risk Classifications of the Participants to the Arrangement on Officially Supported Export Credits》
  （「Valid as of: 16 October 2026」，6 頁、201 國）：《官方支持出口信用安排》參加國共同評定的國家風險等級，0（最低）到 7，
  是各國出口信用機構最低保費的基準。PDF 在 www.oecd.org 的 /content/dam/oecd/ 底下，robots.txt 不准，主題頁又是 Cloudflare
  驗證頁，由使用者用瀏覽器下載到 map-plan 的 data/oecd/（SHA-256 3708343a…），執行前複製到 .cache/oecd/。
- 授權：PDF 裡沒有授權文字，照 OECD Terms and Conditions 第 3 節（Data）：可轉載、改作，商業也可以，要註明出處
  （map-plan data/oecd/README.md 有原文）。
- 用 sources/pdfreader.py 讀（不必裝 pdftotext）：同一頁同一個 y 的文字片段排成一列，序號在最左欄，ISO3 與國名在第二欄
  （前三個字是 ISO3），前次等級、現行等級、附註各一欄。
- 代碼：0–7 是等級；「-」照附註分兩類：8 是高所得 OECD 會員國、歐元區國家與用歐元的歐洲小國（附註 6、7、8），
  9 是「Currently not reviewed or classified」（附註 5）。OECD 的科索沃代碼 XKV 換成網站用的 XKX。
- 附註 9（2023 年《安排》第 23 條）：另外評估主權風險，標出「不是國內風險最低的債務人」且「信用風險明顯高於國家風險」的政府，
  寫進 tooltip 的提示。前次等級跟現行不同的國家也寫在提示。
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from pathlib import Path

from common import CACHE_DIR, OUT_DIR, indicator_file, write_json
from sources import pdfreader

PDF = CACHE_DIR / "oecd" / "cre-crc-current-english.pdf"
OUT = OUT_DIR / "topics" / "reserves" / "country-risk.json"
YEAR = 2026
NOT_CLASSIFIED = 8  # 高所得 OECD、歐元區、用歐元的歐洲小國（附註 6、7、8）
NOT_REVIEWED = 9  # 未評級（附註 5）
CODES = {"XKV": "XKX"}
EXPECTED_ROWS = 201


def _rows(path: Path) -> list[dict[str, str]]:
    texts, _ = pdfreader.read(path)
    lines: dict[tuple[int, int], list[pdfreader.Text]] = defaultdict(list)
    for t in texts:
        lines[(t.page, round(t.y))].append(t)
    rows = []
    for key in sorted(lines, key=lambda k: (k[0], -k[1])):
        cols = {"nb": "", "country": "", "prev": "", "cur": "", "notes": ""}
        for t in sorted(lines[key], key=lambda t: t.x):
            col = "nb" if t.x < 100 else "country" if t.x < 390 else "prev" if t.x < 450 else "cur" if t.x < 510 else "notes"
            cols[col] += t.text
        cols = {k: v.strip() for k, v in cols.items()}
        if re.fullmatch(r"\d+", cols["nb"]):
            rows.append(cols)
    return rows


def _grade(text: str) -> int | None:
    return None if text == "-" else int(text)


def build() -> None:
    if not PDF.exists():
        raise SystemExit(f"找不到 {PDF}：先把 map-plan 的 data/oecd/cre-crc-current-english.pdf 複製到 .cache/oecd/")
    rows = _rows(PDF)
    if len(rows) != EXPECTED_ROWS or [int(r["nb"]) for r in rows] != list(range(1, EXPECTED_ROWS + 1)):
        raise SystemExit(f"OECD 國家風險等級：讀到 {len(rows)} 列，序號不連續或不是 {EXPECTED_ROWS} 列，PDF 版面可能改了")
    values: dict[str, list[float | None]] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    for r in rows:
        iso, name = r["country"][:3], r["country"][3:]
        if not re.fullmatch(r"[A-Z]{3}", iso):
            raise SystemExit(f"OECD 國家風險等級：第 {r['nb']} 列的代碼看不懂：{r['country']!r}")
        iso = CODES.get(iso, iso)
        notes = set(re.findall(r"\((\d)\)", r["notes"]))
        prev, cur = _grade(r["prev"]), _grade(r["cur"])
        if cur is None:
            if notes & {"6", "7", "8"}:
                code = NOT_CLASSIFIED
            elif "5" in notes:
                code = NOT_REVIEWED
            else:
                raise SystemExit(f"OECD 國家風險等級：{iso} {name} 不分級但沒有附註 5–8")
        else:
            code = cur
        values[iso] = [code]
        zh: list[str] = []
        en: list[str] = []
        if cur is not None and prev is not None and prev != cur:
            up = cur > prev
            zh.append(f"前次 {prev} 級，這次{'調升' if up else '調降'}到 {cur} 級（風險{'變高' if up else '變低'}）")
            en.append(f"Previously {prev}, now {'raised' if up else 'lowered'} to {cur} (risk {'up' if up else 'down'})")
        if "8" in notes:
            zh.append("透過與歐盟的貨幣協定使用歐元的歐洲小國，不評級")
            en.append("European micro-state using the euro through a monetary agreement with the EU; not classified")
        if "9" in notes:
            zh.append("政府本身的信用風險明顯高於這一國的國家風險（《安排》第 23 條另外評估主權風險）")
            en.append("The government's own credit risk is significantly higher than the country risk (sovereign risk assessed under Article 23 of the Arrangement)")
        if zh:
            hints[iso], hints_en[iso] = "；".join(zh), "; ".join(en)
    count = Counter(v[0] for v in values.values())
    print(f"  {len(values)} 國；各級國家數 {sorted(count.items())}")
    print(f"  台灣 {values.get('TWN')}；有提示的 {len(hints)} 國：{sorted(hints)}")
    write_json(
        OUT,
        indicator_file(
            "country-risk",
            "級",
            [YEAR],
            values,
            hints=hints,
            hintsEn=hints_en,
            license="OECD Terms and Conditions",
            attribution="OECD (2026), Country Risk Classifications of the Participants to the Arrangement on Officially Supported Export Credits (valid as of 16 October 2026)",
        ),
    )
