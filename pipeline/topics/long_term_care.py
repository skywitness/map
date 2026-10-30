"""長期照顧（健康主題的擴充，2026-10-30，製作手冊第六批 90；輸出到 topics/health/）。

- 每千名 65 歲以上的長照機構床數：OECD Health Statistics「Long-term care resources and utilisation - beds」
  （DSD_HEALTH_LTCR@DF_HEALTH_LTCR_BED，單位 Per 1 000 inhabitants aged 65 years or over，機構＝nursing and residential
  long-term care facilities）。
- 65 歲以上使用長照的比例：同一套的 recipients（DF_HEALTH_LTCR_RECIPIENT，Percentage of population aged 65 years or over），
  機構（Institution）與居家（Home-based）兩者同一年都有才相加。各國定義差很多（立陶宛算進現金給付）。
- 台灣（使用者決定：用衛福部、社家署的資料加總）：
  - 衛政：衛福部統計處「醫事機構服務量統計年報」表 18 的一般護理之家床數（2007 年起）。
  - 社政：衛福部社會福利公務統計 2.4.6「老人長期照顧、安養機構概況」的長期照顧機構（長期照護型、養護型、失智照顧型）
    可供進住人數（年底，2015 年起），不含照顧生活能自理老人的安養機構（OECD 的長照床數不含沒有照顧服務的住宅）。
  - 兩者相加 ÷ WPP 的 65 歲以上年中人口 × 1,000。退輔會的榮譽國民之家、精神護理之家、長照服務法的住宿式長照機構
    沒有算進來（使用者決定只用衛福部、社家署）。使用長照的比例沒有可以比的台灣數字。
- 授權：OECD 的資料適用 OECD 資料條款（可轉載、改作，需註明出處，已記）；衛福部是政府資料開放授權條款（已記）。
"""
from __future__ import annotations

import re

import openpyxl

from common import OUT_DIR, download, indicator_file, to_series, write_json, year_span
from sources import oecd, wpp

OUT = OUT_DIR / "topics" / "health"
BEDS_FLOW = "OECD.ELS.HD,DSD_HEALTH_LTCR@DF_HEALTH_LTCR_BED,1.0"
RECIPIENT_FLOW = "OECD.ELS.HD,DSD_HEALTH_LTCR@DF_HEALTH_LTCR_RECIPIENT,1.0"
# 衛福部的下載網址每年新版的 dl 編號會變：到 https://dep.mohw.gov.tw/DOS/lp-5099-113.html 找「NNN年醫事機構服務量統計年報」的 .xlsx，
# 與 https://dep.mohw.gov.tw/DOS/np-5308-113.html（社會福利公務統計一覽表）的 2.4.6
NURSING_URL = "https://www.mohw.gov.tw/dl-101451-edb3ead7-5658-4ec3-bdd8-38b891082abc.html"  # 114 年版（資料到 2025 年）
ELDERLY_URL = "https://www.mohw.gov.tw/dl-22134-14969240-e876-4061-b76d-bf1bf2efd4ed.html"
TWN_LAST = 2025


def _nursing_home_beds() -> dict[int, float]:
    """表 18 的一般護理之家床數：{年: 床}"""
    wb = openpyxl.load_workbook(download(NURSING_URL, "mohw", "service-volume-114.xlsx"), read_only=True)
    out: dict[int, float] = {}
    for row in wb["18"].iter_rows(values_only=True):
        if row and isinstance(row[0], str) and row[0].startswith("民國") and isinstance(row[1], int):
            out[row[1]] = float(row[3])  # 年、家數、床數
    if not out or "一般護理之家" not in str(list(wb["18"].iter_rows(values_only=True))[3]):
        raise RuntimeError("醫事機構服務量統計年報表 18 的格式跟預期不同")
    return out


def _elderly_institutions() -> dict[int, float]:
    """2.4.6 的長期照顧機構（總計扣掉安養機構）可供進住人數：{年: 人}，只取年底"""
    wb = openpyxl.load_workbook(download(ELDERLY_URL, "mohw", "elderly-institutions.xlsx"), read_only=True)
    rows = list(wb["歷年"].iter_rows(values_only=True))
    header = " ".join(str(c) for r in rows[:6] for c in r if c)
    if "安養機構" not in header or "長期照顧機構" not in header:
        raise RuntimeError("老人長期照顧、安養機構概況的欄位跟預期不同")
    out: dict[int, float] = {}
    for row in rows:
        label = str(row[0] or "")
        m = re.match(r"\d+年,\s*(\d{4})\s*$", label)
        if m:
            # 欄位：總計（機構數、可供進住、實際進住計男女）、長期照護型、養護型、失智照顧型、安養機構，各 5 欄
            out[int(m.group(1))] = float(row[3]) - float(row[23])
    return out


def _years(series: dict[str, dict[int, float]]) -> list[int]:
    """開頭截掉國家太少的年份；最後一年照收（各國用 5 年內最近一年的值，最新一年只有少數國家也不會全灰）"""
    return list(range(year_span(series, 0.3)[0], max(max(s) for s in series.values()) + 1))


def build_beds() -> None:
    beds, _ = oecd.series(BEDS_FLOW, UNIT_MEASURE="10P3HB_Y_GE65")
    nursing, elderly = _nursing_home_beds(), _elderly_institutions()
    ages = wpp.population_by_age("TWN", min(elderly), TWN_LAST)
    old = {y: sum(v for g, v in groups.items() if int(g.split("-")[0].rstrip("+")) >= 65) for y, groups in ages.items()}
    beds["TWN"] = {
        y: round((nursing[y] + elderly[y]) / old[y] * 1000, 1) for y in elderly if y in nursing and y <= TWN_LAST
    }
    years = _years(beds)
    y = max(beds["TWN"])
    note = (f"台灣是衛福部的一般護理之家床數（{y} 年 {nursing[y]:,.0f} 床，醫事機構服務量統計年報表 18）加上社家署的"
            f"老人長期照顧機構可供進住人數（{elderly[y]:,.0f} 人，長期照護型、養護型、失智照顧型，不含安養機構）÷ 聯合國的"
            f" 65 歲以上人口（{old[y] / 1e4:,.0f} 萬人）。退輔會的榮民之家、住宿式長照機構沒有算進來。")
    note_en = (f"Taiwan: general nursing home beds from the Ministry of Health and Welfare ({nursing[y]:,.0f} in {y}) plus places in "
               f"long-term care institutions for the elderly from the Social and Family Affairs Administration ({elderly[y]:,.0f}; "
               f"excluding residential homes for self-reliant older people), divided by the UN population aged 65+ "
               f"({old[y] / 1e6:.2f} million). Veterans' homes and residential long-term care institutions are not included.")
    write_json(OUT / "ltc-beds.json", indicator_file(
        "ltc-beds", "床/千名 65 歲以上", years, {k: to_series(s, years, 1) for k, s in sorted(beds.items())},
        latestWithin=5, notes={"TWN": note}, notesEn={"TWN": note_en},
    ))
    latest = sorted(((s[max(s)], k, max(s)) for k, s in beds.items()), reverse=True)
    print(f"  長照床數：{len(beds)} 國（含台灣），{years[0]}–{years[-1]}；最多 {latest[:5]}；最少 {latest[-3:]}")
    print(f"  台灣 {y}：護理之家 {nursing[y]:,.0f} + 長照機構 {elderly[y]:,.0f}，65+ {old[y]:,.0f} → {beds['TWN'][y]}")


def build_recipients() -> None:
    parts: dict[str, dict[str, dict[int, float]]] = {}
    for mode in ("INST", "HB"):
        parts[mode], _ = oecd.series(RECIPIENT_FLOW, UNIT_MEASURE="PT_POP_Y_GE65", MODE_PROVISION=mode, SEX="_T", AGE="Y_GE65")
    total = {
        iso3: {y: round(v + parts["HB"][iso3][y], 1) for y, v in s.items() if y in parts["HB"].get(iso3, {})}
        for iso3, s in parts["INST"].items()
    }
    total = {k: s for k, s in total.items() if s}
    years = _years(total)
    # 台灣沒有可以比的數字，地圖照舊留白，寫在附註（第七批 135，DESIGN.md 第 217 點）
    write_json(OUT / "ltc-recipients.json", indicator_file(
        "ltc-recipients", "%", years, {k: to_series(s, years, 1) for k, s in sorted(total.items())}, latestWithin=5,
        notes={"TWN": "長照 2.0 的照顧服務（居家服務、日間照顧、家庭托顧）2025 年全年服務 431,420 人（衛福部社會福利公務統計表 4.1，"
                      "全年歸人計算），沒有年齡別，又是全年累計、不是某一天的人數，不能跟 OECD 的 65 歲以上比例比"},
        notesEn={"TWN": "Long-term Care 2.0 care services (home care, day care and family care) served 431,420 people over the whole "
                        "of 2025 (Ministry of Health and Welfare social welfare statistics, table 4.1, unique persons in the year); "
                        "there is no breakdown by age and it is a count over the year, not on one day, so it cannot be compared "
                        "with the OECD share of people aged 65+"},
    ))
    latest = sorted(((s[max(s)], k, max(s)) for k, s in total.items()), reverse=True)
    print(f"  使用長照：{len(total)} 國，{years[0]}–{years[-1]}；最多 {latest[:6]}；最少 {latest[-3:]}")


def build() -> None:
    build_beds()
    build_recipients()
