"""OECD 發展援助委員會（DAC）的統計：OECD Data Explorer 的 SDMX API（https://sdmx.oecd.org/public/rest/）。

OECD 的使用條款（https://www.oecd.org/en/about/terms-conditions.html 第 3 節「Data」）：資料可以下載、複製、改作、
散布，商業使用也可以，要註明 OECD 與資料集名稱（另有第三方權利的資料會在中繼資料寫明；DAC1、DAC2A 的資料流說明
沒有另外的限制）。CC BY 4.0 是 2024 年 7 月起出版的「書面內容」的授權，資料本身適用上面那一節，效果相同（姓名標示）。
見 DESIGN.md 第 8 節。

用到的兩個資料流（版本留空 = 最新版，2026-10 是 DAC1 1.8、DAC2A 1.7）：
- **DAC1**（`DSD_DAC1@DF_DAC1`，Flows by provider）：每個援助國（DAC 會員、向 OECD 申報的其他國家，含台灣
  「Chinese Taipei」）的 ODA 總額、占 GNI 比例、雙邊與多邊的組成。維度 DONOR.SECTOR.MEASURE.TYING_STATUS.
  FLOW_TYPE.UNIT_MEASURE.PRICE_BASE。FLOW_TYPE 1140 是淨撥付（net disbursements）、1160 是贈與等值
  （grant equivalent，2018 年起的官方口徑）。最新一年（2025）是 2026 年 4 月的初步數字。
- **DAC2A**（`DSD_DAC2@DF_DAC2A`，Aid disbursements to countries and regions）：援助國 × 受援國的 ODA 淨撥付
  （MEASURE 206），以及受援國收到的 ODA 占 GNI（286）、人均（296）。維度 DONOR.RECIPIENT.MEASURE.UNIT_MEASURE.
  PRICE_BASE。援助國含多邊機構（IDA、歐盟機構、聯合國各機構、區域開發銀行…）與民間基金會；
  ALLD 是「Official donors」（雙邊加多邊，不含民間），ALLM 是多邊機構合計，DPGC 是「Developing countries」
  （含沒有分到特定國家的「unspecified」）。

數值單位是百萬美元（UNIT_MULT 6），當期價格（PRICE_BASE V）。用不含標籤的 CSV（format=csvfile），檔案小一半。
"""
from __future__ import annotations

import csv

from common import download

URL = (
    "https://sdmx.oecd.org/public/rest/data/OECD.DCD.FSD,{flow},/{key}"
    "?startPeriod={start}&dimensionAtObservation=AllDimensions&format=csvfile"
)
DAC1 = "DSD_DAC1@DF_DAC1"
DAC2A = "DSD_DAC2@DF_DAC2A"

# DAC1 用到的 MEASURE：
# 1010 ODA（淨撥付；2018 年起 1160 = 贈與等值）、11010 ODA 贈與等值；2 / 11002 ODA 占 GNI（淨撥付 / 贈與等值）；
# 1015 / 11015 雙邊 ODA、2000 / 12000 多邊 ODA；1820 在捐助國境內的難民支出（雙邊 ODA 的一部分）；
# 2101–2108 給多邊機構的核心捐款：聯合國機構、歐盟機構、IDA、世界銀行其他（IBRD、IFC、MIGA）、區域開發銀行、
# 全球環境基金、蒙特婁議定書、其他機構
DAC1_MEASURES = (
    "1010", "11010", "2", "11002", "1015", "11015", "2000", "12000", "1820",
    "2101", "2102", "2103", "2104", "2105", "2106", "2107", "2108",
)

Key1 = tuple[str, str, str]  # (DONOR, MEASURE, FLOW_TYPE)
Key2 = tuple[str, str, str]  # (DONOR, RECIPIENT, MEASURE)


def _rows(flow: str, key: str, start: int, filename: str) -> list[dict[str, str]]:
    path = download(URL.format(flow=flow, key=key, start=start), "oecd-dac", filename)
    with open(path, encoding="utf-8-sig", newline="") as f:
        text = f.read()
    if text.startswith("NoResultsFound") or not text.startswith("DATAFLOW"):
        raise RuntimeError(f"OECD {flow} {key} 沒有資料：{text[:200]}")
    return list(csv.DictReader(text.splitlines()))


def dac1(start: int = 1960) -> dict[Key1, dict[int, float]]:
    """{(援助國代碼, MEASURE, FLOW_TYPE): {年: 百萬美元或 %}}；只收當期美元（USD）與占 GNI 的比例（PT_B5G）。"""
    key = f"..{'+'.join(DAC1_MEASURES)}._Z.1140+1160.USD+PT_B5G.V"
    out: dict[Key1, dict[int, float]] = {}
    for r in _rows(DAC1, key, start, "dac1.csv"):
        if r["OBS_VALUE"] == "":
            continue
        out.setdefault((r["DONOR"], r["MEASURE"], r["FLOW_TYPE"]), {})[int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    return out


def dac2a_pairs(start: int = 1960) -> dict[tuple[str, str], dict[int, float]]:
    """{(援助國, 受援國): {年: 百萬美元}}：ODA 淨撥付（206），當期美元。兩邊都含區域、所得組等合計的代碼。"""
    out: dict[tuple[str, str], dict[int, float]] = {}
    for r in _rows(DAC2A, "..206.USD.V", start, "dac2a-206.csv"):
        if r["OBS_VALUE"] == "":
            continue
        out.setdefault((r["DONOR"], r["RECIPIENT"]), {})[int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    return out


def dac2a_recipient_ratios(start: int = 1960) -> dict[str, dict[str, dict[int, float]]]:
    """{MEASURE: {受援國: {年: 值}}}：所有官方援助者（ALLD）給的 ODA 占受援國 GNI（286，%）與人均（296，美元）。"""
    out: dict[str, dict[str, dict[int, float]]] = {"286": {}, "296": {}}
    for r in _rows(DAC2A, "ALLD..286+296..V", start, "dac2a-ratios.csv"):
        if r["OBS_VALUE"] == "":
            continue
        out[r["MEASURE"]].setdefault(r["RECIPIENT"], {})[int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    return out
