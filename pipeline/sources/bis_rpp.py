"""國際清算銀行（BIS）的住宅價格統計：Selected residential property prices（WS_SPP）的實質指數。

- BIS Data Portal 的 SDMX API（https://stats.bis.org/api/v2/），CSV 每一列是一季：
  REF_AREA（alpha-2，另有 XW 全部經濟體、XM 歐元區、5R 先進經濟體、4T 新興經濟體這類合計）、
  VALUE（N 名目、R 實質）、UNIT_MEASURE（628 是 2010 年 = 100 的指數、771 是年增率）。
- 實質指數是名目指數用各國的消費者物價指數平減（BIS 的說明文件），跟 OECD 用民間消費平減指數不同。
- 授權：BIS 的「Terms of permitted use of BIS statistics」（https://data.bis.org/help/legal）：
  可以自由使用，條件是註明 BIS 是來源、翻譯成其他語言時要說明不是 BIS 的官方翻譯、不能暗示 BIS 背書；
  住宅價格的來源說明（pp_sources.pdf）另外要求註明各國的原始來源（見 NATIONAL_SOURCES）。
- 台灣不在 BIS 的住宅價格統計裡（58 個經濟體加合計，2026-10 查）。
"""
from __future__ import annotations

import csv
from collections import defaultdict

from common import download
from sources.countries import from_alpha2

URL = "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_SPP/1.0/Q..R.628?format=csv"
AGGREGATES = {"XW": "WLD", "XM": "EMU", "5R": "ADV", "4T": "EME"}

# BIS 的 pp_sources.pdf（2026-07-31 版）列的各國原始來源；只列地圖上用到 BIS 的經濟體（OECD 沒有的那些）
NATIONAL_SOURCES = {
    "CYP": "Central Bank of Cyprus",
    "HKG": "Census and Statistics Department (Hong Kong SAR)",
    "MAR": "Bank Al-Maghrib",
    "MKD": "National Bank of the Republic of North Macedonia",
    "MLT": "Central Bank of Malta; National Statistics Office Malta",
    "MYS": "Central Bank of Malaysia; National Property Information Centre (NAPIC)",
    "PER": "Banco Central de Reserva del Perú",
    "PHL": "Bangko Sentral ng Pilipinas",
    "SGP": "Urban Redevelopment Authority; Department of Statistics Singapore",
    "SRB": "Statistical Office of the Republic of Serbia; Republic Geodetic Authority",
    "THA": "Bank of Thailand",
}


def real_index() -> tuple[dict[str, dict[int, float]], dict[str, dict[int, float]]]:
    """實質住宅價格指數的年平均（四季都有才算）：(各國 {iso3: {年: 值}}, 合計 {代碼: {年: 值}})，基期是 BIS 的 2010 年 = 100。"""
    path = download(URL, "bis", "ws_spp_real.csv")
    quarters: dict[str, dict[int, list[float]]] = defaultdict(lambda: defaultdict(list))
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows or not {"REF_AREA", "TIME_PERIOD", "OBS_VALUE", "VALUE", "UNIT_MEASURE"} <= set(rows[0]):
        raise RuntimeError(f"BIS 住宅價格 CSV 的欄位變了：{list(rows[0]) if rows else '空檔'}")
    for r in rows:
        if r["VALUE"] != "R" or r["UNIT_MEASURE"] != "628" or r["OBS_VALUE"] in ("", "NaN"):
            continue
        quarters[r["REF_AREA"]][int(r["TIME_PERIOD"][:4])].append(float(r["OBS_VALUE"]))
    countries: dict[str, dict[int, float]] = {}
    groups: dict[str, dict[int, float]] = {}
    for area, by_year in quarters.items():
        annual = {y: sum(v) / 4 for y, v in by_year.items() if len(v) == 4}
        if area in AGGREGATES:
            groups[AGGREGATES[area]] = annual
        elif iso3 := from_alpha2(area):
            countries[iso3] = annual
        else:
            print(f"  注意：BIS 的 {area} 對不到 ISO 代碼，不收")
    return countries, groups
