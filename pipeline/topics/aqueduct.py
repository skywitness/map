"""水資源與森林主題的「缺水壓力的推估」：WRI Aqueduct 4.0 的各國基準與 2030、2050、2080 年的水資源壓力（baseline water stress）。

- 使用者 2026-10-30 決定只做小擴充：國家層級的基準與三個推估年份，不畫流域。
- 資料：`aqueduct-4-0-country-rankings.zip`（12,790,153 bytes，2023-08-07）裡的
  Aqueduct40_rankings_download_Y2023M07D05.xlsx：country_baseline（189 國，1979–2019 年的基準）、
  country_future（164 國，2030、2050、2080 年 × 樂觀 opt、照常 bau、悲觀 pes 三種情境，CMIP6）。
  只取 indicator_name = bws（取水量占可用水量）、weight = Tot（依全部用水加權）的 score（0–5）。
  score 的分級：0–1 低（<10%）、1–2 低到中（10–20%）、2–3 中到高（20–40%）、3–4 高（40–80%）、4–5 極高（>80%）；
  −9999 是沒有資料，不輸出。
- 跟 SDG 6.4.2（同一個主題的「水資源壓力」）定義不同：Aqueduct 是水文模型依流域算、再依用水加權到國家，
  SDG 6.4.2 是各國申報的取水量除以可再生淡水扣掉環境流量，兩個數字不會一致。
- 台灣：國家與省級的表都沒有 TWN（GADM 3.6 的國家裡有台灣，但這份排名沒有收；香港、澳門也沒有）。
  地圖照舊留白，附註寫流域資料（aqueduct-4-0-water-risk-data.zip 的 Aqueduct40_baseline_annual_y2023m07d05.csv）
  裡台灣本島大部分所在的流域 pfaf_id 437001 的基準分數（第七批 135，DESIGN.md 第 217 點）。
- 授權：資料頁的 License 欄寫「Creative Commons」，WRI 的 Open Data Commitment「We have adopted the Creative Commons
  Attribution 4.0 International License as our standard license for publications and data」（CC BY 4.0）。
  引用 Kuzma et al. 2023, doi.org/10.46830/writn.23.00061。
"""
from __future__ import annotations

import io
import zipfile

import openpyxl

from common import OUT_DIR, download, indicator_file, write_json

URL = "https://files.wri.org/aqueduct/aqueduct-4-0-country-rankings.zip"
SOURCE = "aqueduct"
OUT = OUT_DIR / "topics" / "water-forest"
BASELINE = 2019  # 1979–2019 的基準存成這一年
FUTURE = [2030, 2050, 2080]
SCENARIOS = ["opt", "bau", "pes"]
# GADM 的代碼跟地圖不同的（科索沃 XKO、北賽普勒斯 XNC 等）在這裡換；地圖上沒有的不輸出
GADM_FIX = {"XKO": "XKX"}


def sheet_rows(wb, name: str) -> list[dict]:
    rows = wb[name].iter_rows(values_only=True)
    head = next(rows)
    return [dict(zip(head, r)) for r in rows]

TW_NOTE = (
    "Aqueduct 4.0 的國家排名沒有台灣（香港、澳門也沒有）。流域資料裡台灣本島大部分所在的流域（pfaf_id 437001）"
    "基準期的分數是 1.36，「低到中（10–20%）」；國家的分數是各流域依用水加權，這個流域的值不等於國家的分數",
    "Taiwan is not in the Aqueduct 4.0 country rankings (nor are Hong Kong and Macao). In the basin data, the basin covering "
    "most of the island of Taiwan (pfaf_id 437001) scores 1.36 for the baseline, “low–medium (10–20%)”; country scores "
    "weight basins by water use, so one basin’s value is not the country score",
)


def build() -> None:
    path = download(URL, SOURCE, "aqueduct-4-0-country-rankings.zip")
    with zipfile.ZipFile(path) as z:
        name = next(n for n in z.namelist() if n.endswith(".xlsx"))
        wb = openpyxl.load_workbook(io.BytesIO(z.read(name)), read_only=True)
    base = {}
    for r in sheet_rows(wb, "country_baseline"):
        if r["indicator_name"] == "bws" and r["weight"] == "Tot" and r["score"] is not None and r["score"] >= 0:
            base[GADM_FIX.get(r["gid_0"], r["gid_0"])] = float(r["score"])
    future: dict[str, dict[tuple[int, str], float]] = {}
    for r in sheet_rows(wb, "country_future"):
        if r["indicator_name"] == "bws" and r["weight"] == "Tot" and r["score"] is not None and r["score"] >= 0:
            future.setdefault(GADM_FIX.get(r["gid_0"], r["gid_0"]), {})[(int(r["year"]), r["scenario"])] = float(r["score"])
    if "TWN" in base or "TWN" in future:
        raise ValueError("Aqueduct 的排名有台灣了，更新說明")
    years = [BASELINE, *FUTURE]
    for scenario in SCENARIOS:
        series = {}
        for iso3 in sorted(base.keys() | future.keys()):
            values = [base.get(iso3)] + [future.get(iso3, {}).get((y, scenario)) for y in FUTURE]
            series[iso3] = [round(v, 2) if v is not None else None for v in values]
        write_json(
            OUT / f"aqueduct-{scenario}.json",
            indicator_file(f"aqueduct-{scenario}", "score", years, series, projectionFrom=FUTURE[0],
                           notes={"TWN": TW_NOTE[0]}, notesEn={"TWN": TW_NOTE[1]}),
        )
    print(f"  基準 {len(base)} 國、推估 {len(future)} 國")
    for iso3 in ("QAT", "ISR", "IND", "CHN", "USA", "JPN", "KOR", "EGY", "BRA"):
        print(f"  {iso3}：基準 {base.get(iso3)}，bau " + "、".join(f"{y} {future.get(iso3, {}).get((y, 'bau'))}" for y in FUTURE))
