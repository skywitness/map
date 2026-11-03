"""台灣的藥從哪裡來（2026-11-03，製作手冊第十九批 298；醫藥分類的藥物組，新主題）。

**資料**：食品藥物管理署「未註銷藥品許可證資料集」（data.gov.tw 9123，`https://data.fda.gov.tw/data/opendata/export/37/csv`，
zip 裡一個 CSV，每週與藥證系統同步）。每一列是一張有效的許可證，欄位有許可證種類（製劑、原料藥、菌疫、硬空膠囊）、
製造商、製造廠國別（ISO 二碼）等。依製造廠國別數許可證：全部、製劑、原料藥、菌疫（生物製劑與疫苗）。
**授權**：政府資料開放授權條款第 1 版。
**注意**：是許可證的張數，不是用量或金額；同一個成分常有很多張證（不同廠牌、劑量）。製造廠國別空白的不算。
地圖的年份寫資料的異動日期最新那一年。
"""
from __future__ import annotations

import csv
import io
import zipfile
from collections import Counter

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import countries

OUT = OUT_DIR / "topics" / "taiwan-medicines"
URL = "https://data.fda.gov.tw/data/opendata/export/37/csv"
# 指標 id → 許可證種類（None 是全部）
KINDS = {"all": None, "products": "製劑", "api": "原料藥", "biologics": "菌疫"}


def build() -> None:
    path = download(URL, "fda-tw", "licences-37.csv")
    with zipfile.ZipFile(path) as z:
        name = next(n for n in z.namelist() if n.endswith(".csv"))
        rows = list(csv.DictReader(io.StringIO(z.read(name).decode("utf-8-sig"))))
    if not rows or "製造廠國別" not in rows[0] or "許可證種類" not in rows[0]:
        raise RuntimeError("未註銷藥品許可證資料集的欄位變了")
    year = int(max(r["異動日期"] for r in rows if r["異動日期"])[:4])
    blank = sum(1 for r in rows if not r["製造廠國別"].strip())
    unknown: Counter[str] = Counter()
    for item, kind in KINDS.items():
        counts: Counter[str] = Counter()
        for r in rows:
            if kind and r["許可證種類"].replace("　", "").strip() != kind:
                continue
            code = r["製造廠國別"].strip()
            if not code:
                continue
            iso3 = countries.from_alpha2(code)
            if not iso3:
                unknown[code] += 1
                continue
            counts[iso3] += 1
        total = sum(counts.values())
        write_json(OUT / f"{item}.json", indicator_file(item, "張", [year], {c: [n] for c, n in sorted(counts.items())},
                                                       total=total))
        top = ", ".join(f"{c} {n:,}（{n / total:.1%}）" for c, n in counts.most_common(6))
        print(f"  {item}：{total:,} 張、{len(counts)} 國；{top}")
    if unknown:
        raise RuntimeError(f"製造廠國別對不到國家代碼：{dict(unknown)}")
    write_json(OUT / "manifest.json", {
        "topic": "taiwan-medicines", "generatedAt": now_iso(),
        "source": "Taiwan Food and Drug Administration, unrevoked drug licences (data.gov.tw 9123)",
        "license": "Open Government Data License, Taiwan 1.0",
        "records": len(rows), "blankCountry": blank,
    })
    print(f"  {len(rows):,} 張許可證，製造廠國別空白 {blank} 張，資料異動到 {year} 年")


if __name__ == "__main__":
    build()
