"""開公司有多麻煩、國家持股有多深：OECD 產品市場管制指標（新主題，2026-11-07，製作手冊第二十五批 469，候選 1120；
步驟 market-regulation，輸出 topics/market-regulation/）。

- OECD `OECD.ECO.GCRD,DSD_PMR@DF_PMR,1.4`（Product Market Regulation，sources/oecd.py，CC BY 4.0），2018、2023 兩波，
  57 個經濟體**含台灣**，48 個 MEASURE 分總指標、中層與細項三層。0–6 分，越高管制越多。
- 依層次分成四個指標，各自一組子項目（GROUPS）：總指標與兩大支柱、公營事業與政府介入、開公司與外資、
  各行業（專業服務、網路型產業、零售）。每個檔的 aggregates 有 `MED`（當年有值國家的中位數，側欄對照用）。
- OECD 的國有企業專門資料庫查不到可下載的資料流（手冊 2026-11-05 查過），「國家持股有多深」只能用這裡的公營事業指標；
  這不是國有企業占 GDP 的比重。
"""
from __future__ import annotations

import statistics
from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import oecd
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "market-regulation"
FLOW = "OECD.ECO.GCRD,DSD_PMR@DF_PMR,1.4"
YEARS = [2018, 2023]
GROUPS = {
    "pmr": {"total": "PMR", "state": "STATE_INVOL", "entry": "BARRIER_ENTRY"},
    "state": {"scope": "PUBLIC_OWNER", "distort": "DISTORT_PUBLIC", "governance": "GOVERNANCE", "business": "INVOL_BUSINESS"},
    "entry": {"startup": "ADBURDEN", "burden": "ADREG_BURDEN", "fdi": "FDI_INDEX", "tariffs": "TARIFFS"},
    "sector": {
        "retail": "RETAIL_TRADE", "price": "PRICE", "medicines": "MEDICINES", "lawyers": "LAWYERS", "notaries": "NOTARIES",
        "accountants": "ACCOUNTANTS", "architects": "ARCHITECTS", "engineers": "ENGINEERS", "estate-agents": "ESTATEAGENTS",
        "electricity": "ELECTRICITY", "gas": "GAS", "ecomm": "ECOMM", "rail": "RAIL", "road": "ROAD", "air": "AIR",
        "water": "WATER", "digital": "DIGITAL_MARKET",
    },
}


def build() -> None:
    data: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for r in oecd.rows(FLOW, "all"):
        if r["OBS_VALUE"] and (iso3 := to_iso3(r["REF_AREA"])):
            data[r["MEASURE"]][iso3][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    summary = {}
    for group, items in GROUPS.items():
        for key, measure in items.items():
            series = data[measure]
            if len(series) < 30:
                raise RuntimeError(f"PMR 的 {measure} 只有 {len(series)} 國，代碼可能變了")
            values = {c: [round(s[y], 2) if y in s else None for y in YEARS] for c, s in sorted(series.items())}
            med = [round(statistics.median(s[y] for s in series.values() if y in s), 2) for y in YEARS]
            write_json(OUT / group / f"{key}.json", indicator_file(
                group, "分", YEARS, values, aggregates={"MED": med}, license="CC BY 4.0"), quiet=True)
            v23 = sorted(((s[2023], c) for c, s in series.items() if 2023 in s), reverse=True)
            rank = next((i + 1 for i, (_, c) in enumerate(v23) if c == "TWN"), None)
            summary[measure] = (len(v23), med[1], rank, round(series.get("TWN", {}).get(2023, -1), 2))
    for m, (n, med, rank, tw) in summary.items():
        print(f"  {m}：2023 年 {n} 國、中位數 {med}；台灣 {tw}（第 {rank} 高）")
    write_json(OUT / "manifest.json", {"topic": "market-regulation", "generatedAt": now_iso(),
                                       "sources": ["OECD Product Market Regulation (DSD_PMR@DF_PMR, 1.4)"]})
