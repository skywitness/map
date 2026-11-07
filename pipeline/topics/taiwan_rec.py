"""台灣的再生能源憑證（T-REC）發放張數（2026-11-07，製作手冊第二十七批 621，候選 1358；「發電量」的台灣側欄）。

經濟部標準檢驗局「再生能源憑證發放統計」（data.gov.tw 162931，政府資料開放授權條款第 1 版），
https://data.bsmi.gov.tw/opendata/download/313000000G-000156-001.action ，每年每種能源一列（憑證張數，一張 ＝ 1,000 度），
2017 年起、每三個月更新（robots.txt 404）。國際比較做不了（歐洲 AIB 沒有可下載的檔、授權不明），所以只有台灣。
手冊的陷阱：「發放」不等於轉供或交易，也不是綠電占比。輸出 public/data/topics/electricity/tw-rec.json。
"""

from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, write_json

URL = "https://data.bsmi.gov.tw/opendata/download/313000000G-000156-001.action"
# 能源類型 → 代碼（前端 panels/TaiwanRec.tsx 的 TYPES 要一致）；沒有列在這裡的類型報錯
TYPES = {"風力能": "wind", "太陽能": "solar", "水力能": "hydro", "生質能": "bio", "地熱能": "geothermal", "其他能源": "other"}


def build() -> None:
    path = download(URL, "bsmi", "trec-issued.csv")
    counts: dict[str, dict[int, int]] = defaultdict(dict)
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            kind = TYPES.get(r["能源類型"].strip())
            if not kind:
                raise RuntimeError(f"T-REC 有新的能源類型：{r['能源類型']}")
            counts[kind][int(r["憑證發放年分"])] = int(r["憑證張數"])
    years = sorted({y for s in counts.values() for y in s})
    types = [t for t in TYPES.values() if t in counts]
    write_json(OUT_DIR / "topics" / "electricity" / "tw-rec.json", {
        "years": years, "types": types, "values": {t: [counts[t].get(y, 0) for y in years] for t in types},
        "license": "政府資料開放授權條款第 1 版", "attribution": "經濟部標準檢驗局"})
    for y in (years[0], 2020, 2022, 2024, years[-1]):
        total = sum(counts[t].get(y, 0) for t in types)
        print(f"  T-REC {y}：{total:,} 張（" + "、".join(f"{t} {counts[t].get(y, 0):,}" for t in types if counts[t].get(y)) + "）")
