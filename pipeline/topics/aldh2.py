"""菸酒的擴充：喝酒臉紅的基因（ALDH2*2，rs671）在各族群的頻率（2026-11-03，製作手冊第十九批 303；
輸出到 topics/tobacco-alcohol/aldh2.json，沒選國家時的側欄用）。

**資料**：
- Ensembl REST `variation/human/rs671?pops=1`：gnomAD v4 外顯子（gnomADe）的 7 個遺傳族群、1000 Genomes 第 3 期的
  東亞 5 個族群（日本東京 JPT、北京漢人 CHB、華南漢人 CHS、胡志明市京族 KHV、西雙版納傣族 CDX）。
- NCBI dbSNP 的 Variation API `refsnp/671`：日本 TOMMO、韓國（KOREAN、Korea1K、Korea4K）、越南（Vietnamese）的研究。
  dbSNP 給的是參考等位基因 G 的次數，A（ALDH2*2）= 總數 − G。
**授權**：Ensembl「imposes no restrictions on access to, or use of, the data provided」；NCBI 的資料「places no restrictions」。
**只能依族群、不能畫成各國地圖**（手冊），台灣沒有分組（gnomAD、1000 Genomes 都沒有台灣；TaiwanGenomes 要同意條款），
不寫台灣的數字。
"""
from __future__ import annotations

import json

from common import OUT_DIR, download, write_json

OUT = OUT_DIR / "topics" / "tobacco-alcohol"
ENSEMBL = "https://rest.ensembl.org/variation/human/rs671?pops=1;content-type=application/json"
NCBI = "https://api.ncbi.nlm.nih.gov/variation/v0/refsnp/671"
ALT = "A"  # ALDH2*2（Glu504Lys）
# Ensembl 的族群代碼 → 畫面上的 id（名稱在前端 panels/Aldh2Panel.tsx）
ENSEMBL_POPS = {
    "gnomADe:eas": "gnomad-eas", "gnomADe:sas": "gnomad-sas", "gnomADe:nfe": "gnomad-nfe", "gnomADe:fin": "gnomad-fin",
    "gnomADe:afr": "gnomad-afr", "gnomADe:amr": "gnomad-amr", "gnomADe:mid": "gnomad-mid",
    "1000GENOMES:phase_3:JPT": "kg-jpt", "1000GENOMES:phase_3:CHB": "kg-chb", "1000GENOMES:phase_3:CHS": "kg-chs",
    "1000GENOMES:phase_3:KHV": "kg-khv", "1000GENOMES:phase_3:CDX": "kg-cdx",
}
NCBI_STUDIES = {"TOMMO": "tommo", "KOREAN": "korean", "Korea1K": "korea1k", "Korea4K": "korea4k", "Vietnamese": "vietnamese"}


def build() -> None:
    ensembl = json.loads(download(ENSEMBL, "ensembl", "rs671.json").read_text(encoding="utf-8"))
    ncbi = json.loads(download(NCBI, "ncbi", "refsnp-671.json").read_text(encoding="utf-8"))
    rows: dict[str, dict] = {}
    for p in ensembl["populations"]:
        key = ENSEMBL_POPS.get(p["population"])
        if key and p["allele"] == ALT:
            n = round(p["allele_count"] / p["frequency"]) if p.get("allele_count") and p["frequency"] else None
            rows[key] = {"id": key, "f": round(p["frequency"] * 100, 3), "n": n,
                         "src": "gnomAD" if key.startswith("gnomad") else "1000 Genomes"}
    for f in ncbi["primary_snapshot_data"]["allele_annotations"][0]["frequency"]:
        key = NCBI_STUDIES.get(f["study_name"])
        obs = f["observation"]
        if not key or obs["inserted_sequence"] != obs["deleted_sequence"] or not f["total_count"]:
            continue  # 第一個等位基因的註記是參考 G 的次數（G > G）
        rows[key] = {"id": key, "f": round((1 - f["allele_count"] / f["total_count"]) * 100, 2), "n": f["total_count"],
                     "src": f"dbSNP {f['study_name']}"}
    missing = (set(ENSEMBL_POPS.values()) | set(NCBI_STUDIES.values())) - set(rows)
    if missing:
        raise RuntimeError(f"rs671 少了這些族群：{sorted(missing)}")
    write_json(OUT / "aldh2.json", {"variant": "rs671", "allele": ALT, "populations": sorted(rows.values(), key=lambda r: -r["f"])})
    print("  ALDH2*2（rs671）：" + "、".join(f"{r['id']} {r['f']}%" for r in sorted(rows.values(), key=lambda r: -r["f"])))


if __name__ == "__main__":
    build()
