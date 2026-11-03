"""疾管署「抗藥性監測通報之抗生素敏感性統計資料分析」（data.gov.tw 43600，2026-11-03，製作手冊第十九批 293 的台灣數字）。

**檔案**：https://od.cdc.gov.tw/icb/labantibiogram.csv（UTF-8 有 BOM、CRLF）。od.cdc.gov.tw 從 cloud 連線被重設，本機 session
2026-11-03 下載，放在 skywitness/map-plan 的 `data/cdc/labantibiogram.csv`（README 寫了欄位與檢查）；重跑前複製到
pipeline/.cache/cdc/。**授權**：政府資料開放授權條款第 1 版（data.gov.tw 43600 的 license "1"），提供機關衛福部疾病管制署。
**內容**：2021–2025 年、醫院層級（醫學中心、區域醫院、地區醫院、全國）、9 種菌、22 種抗生素的檢測菌株數、敏感、
非敏感菌株數。2026 年 5 月起資料來源改成「抗生素抗藥性監測通報」，統計從 2021 年開始，跟舊版不能接。
**比例**：全國的非敏感性菌株數 ÷ 檢測藥敏試驗菌株總數（README：算比例用檢測數當分母）。
"""
from __future__ import annotations

import csv
import hashlib

from common import CACHE_DIR

CSV = CACHE_DIR / "cdc" / "labantibiogram.csv"
SHA256 = "d229b14b1814043591eed589ab4458b2ee875a80de91eb27e00dae21ebb0f213"


def _rows() -> list[dict[str, str]]:
    if not CSV.exists():
        raise RuntimeError(f"沒有 {CSV}：請把 map-plan 的 data/cdc/labantibiogram.csv 複製到這裡")
    if hashlib.sha256(CSV.read_bytes()).hexdigest() != SHA256:
        raise RuntimeError(f"{CSV} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改 SHA256")
    with CSV.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def national(species: str, antibiotic: str) -> dict[int, tuple[float, int, int]]:
    """{年: (非敏感比例 %, 非敏感菌株數, 檢測菌株數)}，全國"""
    out = {}
    for r in _rows():
        if r["醫院層級"] == "全國" and r["菌種名稱"] == species and r["抗生素名稱"] == antibiotic:
            tested, ns = int(r["檢測藥敏試驗菌株總數"]), int(r["非敏感性菌株數"])
            if tested:
                out[int(r["年度"])] = (ns / tested * 100, ns, tested)
    if not out:
        raise RuntimeError(f"抗生素敏感性統計沒有全國的 {species} × {antibiotic}")
    return out


def hospitals() -> dict[int, int]:
    """{年: 通報醫院家數}，全國"""
    return {int(r["年度"]): int(r["通報醫院家數"]) for r in _rows() if r["醫院層級"] == "全國"}
