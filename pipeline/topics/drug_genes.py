"""藥物過敏與藥效的基因（2026-11-03，製作手冊第十九批 291；醫藥分類的基因組）：依遺傳族群，不是國家。

**資料**：CPIC（Clinical Pharmacogenetics Implementation Consortium）的 API（PostgREST，不必登入）
`https://api.cpicpgx.org/v1/population_frequency_view`：19 個基因、7,372 筆「基因–等位基因–生物地理群」的
加權平均頻率（`freq_weighted_avg`，依各研究的人數加權）與總人數（`subjectcount`）。
**授權**：`cpicpgx/cpic-data` 的 LICENSE.md：「All curated content published by CPIC is available free of restriction
under the CC0 1.0 Universal (CC0 1.0) Public Domain Dedication」，並請引用網址與下載日期（manifest.json 寫日期）。
**不做各國地圖**（使用者 2026-11-03 決定先做依族群版）：CPIC 依 9 個生物地理群分組，對不到國家；各國版要等
Allele Frequency Net Database（AFND）的授權確認。CPIC 底層的台灣研究多半轉引自 AFND，這裡也不列。
**挑的等位基因**：跟常見藥物的嚴重副作用或藥效有關、CPIC 有指引的 8 個（`ALLELES`）。
"""
from __future__ import annotations

import json

from common import OUT_DIR, download, indicator_file, now_iso, write_json

OUT = OUT_DIR / "topics" / "drug-genes"
API = "https://api.cpicpgx.org/v1/population_frequency_view?limit=20000"
YEAR = 2026
# 9 個生物地理群（CPIC 的名稱），依畫面上的順序
GROUPS = ["East Asian", "Central/South Asian", "Near Eastern", "European", "Sub-Saharan African",
          "African American/Afro-Caribbean", "Latino", "American", "Oceanian"]
# 子項目 id → (基因, 等位基因)
ALLELES = {
    "b1502": ("HLA-B", "*15:02"),
    "a3101": ("HLA-A", "*31:01"),
    "b5801": ("HLA-B", "*58:01"),
    "b5701": ("HLA-B", "*57:01"),
    "cyp2c19-2": ("CYP2C19", "*2"),
    "cyp2c9-3": ("CYP2C9", "*3"),
    "nudt15-3": ("NUDT15", "*3"),
    "dpyd-2a": ("DPYD", "c.1905+1G>A (*2A)"),
}


def build() -> None:
    rows = json.loads(download(API, "cpic", "population_frequency_view.json").read_text(encoding="utf-8"))
    by_key = {(r["genesymbol"], r["name"], r["population_group"]): r for r in rows}
    out = {}
    for item, (gene, allele) in ALLELES.items():
        f, n = [], []
        for g in GROUPS:
            r = by_key.get((gene, allele, g))
            f.append(round(r["freq_weighted_avg"] * 100, 2) if r and r["freq_weighted_avg"] is not None else None)
            n.append(r["subjectcount"] if r else None)
        out[item] = {"gene": gene, "allele": allele, "f": f, "n": n}
        top = sorted(((v, g) for v, g in zip(f, GROUPS) if v is not None), reverse=True)[:3]
        print(f"  {gene} {allele}：" + "、".join(f"{g} {v}%" for v, g in top))
    write_json(OUT / "groups.json", {"groups": GROUPS, "alleles": out})
    # 指標檔：國家不上色（依族群，不是國家）；每個子項目一個空的檔，前端才會出現「基因與藥物」的選單
    for item in ALLELES:
        write_json(OUT / "allele" / f"{item}.json", indicator_file("allele", "", [YEAR], {}))
    write_json(OUT / "manifest.json", {
        "topic": "drug-genes", "generatedAt": now_iso(),
        "source": "CPIC population_frequency_view (https://api.cpicpgx.org/v1/population_frequency_view)",
        "license": "CC0 1.0",
    })
    print(f"  CPIC：{len(rows):,} 筆，{len({r['genesymbol'] for r in rows})} 個基因")


if __name__ == "__main__":
    build()
