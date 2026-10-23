"""經濟部能源署「發電裝置容量年資料」（能源統計年報的發電裝置容量統計表，data.gov.tw 16480，政府資料開放授權條款第 1 版）。

https://data.gov.tw/dataset/16480 ，下載網址是能源署的開放資料（set_id=69），每年更新一次（2026-09 版到 2025 年底）。
每年一列，欄位依「全國、台電、民營電廠、自用發電設備」分開，再分抽蓄水力、燃煤、燃油、燃氣、核能、
慣常水力、地熱、太陽光電、風力、生質能、廢棄物；單位是千瓩（MW）。
- 全國 = 台電 + 民營電廠（電業法的發電業，含民營太陽光電、離岸風電）+ 自用發電設備（汽電共生、自用的再生能源，
  也含售電業躉購的第三型再生能源）。
- 發電廠地圖用它跟 GEM 的台灣電廠對照（只印出來、寫進附註，不取代 GEM 的數字）。
"""
from __future__ import annotations

import csv
import io

from common import download

URL = "https://www.moeaea.gov.tw/ECW/populace/opendata/wHandOpenData_File.ashx?set_id=69"
PAGE = "https://data.gov.tw/dataset/16480"

# 欄位的能源別 → 發電廠地圖的燃料代碼（pipeline/topics/power_plants.py 的 FUELS）
FUEL_COLUMNS = {
    "coal": ["火力_燃煤"],
    "oil-gas": ["火力_燃油", "火力_燃氣"],
    "nuclear": ["核能"],
    "hydro": ["抽蓄水力", "再生能源_慣常水力"],
    "wind": ["再生能源_風力"],
    "solar": ["再生能源_太陽光電"],
    "bioenergy": ["再生能源_生質能", "再生能源_廢棄物"],
    "geothermal": ["再生能源_地熱"],
    "pumped": ["抽蓄水力"],  # 已經算在 hydro 裡，另外列出來給「再生能源」合計扣掉
}
OWNERS = ["全國", "台電", "民營電廠", "自用發電設備"]


def _number(text: str | None) -> float:
    text = (text or "").replace(",", "").strip()
    try:
        return float(text)
    except ValueError:
        return 0.0


def capacity() -> dict[int, dict[str, dict[str, float]]]:
    """{年: {全國／台電／民營電廠／自用發電設備: {燃料代碼: MW}}}；沒有的欄位（例如台電的生質能）算 0"""
    raw = download(URL, "moeaea", "capacity-annual.csv").read_bytes()
    text = raw.decode("utf-8-sig") if not raw.startswith(b"\xff\xfe") else raw.decode("utf-16")
    out: dict[int, dict[str, dict[str, float]]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        year = row.get("西元年") or row.get("﻿西元年")
        if not year or not year.strip().isdigit():
            continue
        by_owner: dict[str, dict[str, float]] = {}
        for owner in OWNERS:
            by_owner[owner] = {
                fuel: sum(_number(row.get(f"{col}_{owner}(統計數值)")) for col in cols) for fuel, cols in FUEL_COLUMNS.items()
            }
            by_owner[owner]["total"] = _number(row.get(f"總發電裝置容量_{owner}(統計數值)"))
        out[int(year)] = by_owner
    return out


def unit() -> str:
    """CSV 的單位欄（應該是「千瓩」）"""
    raw = download(URL, "moeaea", "capacity-annual.csv").read_bytes()
    text = raw.decode("utf-8-sig")
    for row in csv.DictReader(io.StringIO(text)):
        return row.get("單位", "")
    return ""
