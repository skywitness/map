"""藥品支出與取得（2026-11-03，製作手冊第十九批 295、296、301；醫藥分類的藥物組，新主題）。

**資料**：
- 藥費（296）：OECD Health expenditure and financing（SHA，`OECD.ELS.HD,DSD_SHA@DF_SHA,1.1`）的功能別
  HC.5.1「藥品與其他醫療非耐久財」：占經常性醫療支出（`PT_EXP_HLTH`）與每人購買力平價美元（`USD_PPP_PS`，當年
  價格）；全部財源、全部提供者。HC.5.1 是門診拿的藥（處方藥與成藥），住院用的藥算在住院醫療裡。OECD 資料條款可用。
- 台灣：衛福部「國民醫療保健支出統計表」表11（藥品消費支出占經常性醫療保健支出，同 OECD 的 SHA 口徑，2013–2024），
  每人藥費用表1 的平均每人經常性醫療保健支出（元）乘以表11 的比重，再除以 IMF 的購買力平價換算率（`PPPEX`，
  跟「各國健康與醫療」的台灣自付醫療費同一種算法）。政府資料開放授權。
- 學名藥（296）：OECD Generic market（`OECD.ELS.HD,HEALTH_PHMC@DF_GEN_MRKT,1.0`），學名藥占藥品市場的**數量**
  比例（`PT_SL_VOL_M`），**全部市場**（`_T`）。分數量／金額、全部／健保給付／社區藥局／醫院四種市場，同一種口徑
  只有十幾國；製作手冊要「選一種並寫明」，選有日本、加拿大的全部市場數量（13 國）。台灣沒有。
- 止痛藥與胰島素（295）：WHO 非傳染病國家能力調查（NCD CCS）的 `NCD_CCS_OralMorph`（公立醫療體系是不是普遍
  拿得到口服嗎啡）與 `NCD_CCS_Insulin`（胰島素），2013–2021 年，194 國，各國衛生部自填（xmart，CC BY 4.0）。
  Yes／No 兩類，Don't know、No response、No data received 不畫。台灣沒有（不是 WHO 會員），也沒有同樣問法的官方答案。
  INCB 的鴉片類止痛藥用量不能用（條款只准個人、非商業）。
- 基本藥物清單（301）：Persaud 等 2019〈Comparison of essential medicines lists in 137 countries〉（Bull World
  Health Organ 97(6):394–404C）的表1：各國清單的年份、收的藥數、跟 WHO 示範清單（2017 年第 20 版）相同的藥數。
  論文 CC BY 3.0 IGO（Europe PMC 全文 XML）。網站 global.essentialmeds.org 的資料庫沒有授權文字，不用
  （使用者 2026-11-03 同意改用論文的表）。台灣沒有國家基本藥物清單（健保給付清單性質不同）。
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from collections import defaultdict

from common import (
    OUT_DIR, append_note, download, indicator_file, later_years_note, now_iso, to_series, write_json, year_span,
)
from sources import countries, imf, mohw, oecd, who_xmart

OUT = OUT_DIR / "topics" / "medicines"
SHA_FLOW = "OECD.ELS.HD,DSD_SHA@DF_SHA,1.1"
SHA_KEY = ".A.....HC51....."
GEN_FLOW = "OECD.ELS.HD,HEALTH_PHMC@DF_GEN_MRKT,1.0"
EML_XML = "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6560372/fullTextXML"
NHE_TABLE11 = "表11"
ANSWERS = {"Yes": 1, "No": 0}
# 論文表1 的國名，pycountry 對不到的
EML_NAMES = {
    "Bolivia (Plurinational State of)": "BOL", "Democratic Republic of the Congo": "COD", "Iran (Islamic Republic of)": "IRN",
    "Lao People's Democratic Republic": "LAO", "Micronesia (Federated States of)": "FSM", "Republic of Korea": "KOR",
    "Republic of Moldova": "MDA", "United Republic of Tanzania": "TZA", "Venezuela (Bolivarian Republic of)": "VEN",
    "Côte d’Ivoire": "CIV", "Côte d'Ivoire": "CIV", "Syrian Arab Republic": "SYR", "Viet Nam": "VNM",
    "The former Yugoslav Republic of Macedonia": "MKD", "Democratic People's Republic of Korea": "PRK",
    "Cabo Verde": "CPV", "Czechia": "CZE", "Eswatini": "SWZ", "Swaziland": "SWZ", "Turkey": "TUR",
}

TWN_NOTE = "台灣不在 OECD 裡，用衛生福利部國民醫療保健支出統計（表11，同 OECD 的 SHA 口徑）"
TWN_NOTE_EN = ("Taiwan is not in the OECD; from the Ministry of Health and Welfare’s National Health Expenditure statistics "
               "(Table 11, on the same SHA basis as the OECD)")
TWN_PPP_NOTE = ("台灣不在 OECD 裡：衛生福利部國民醫療保健支出統計的平均每人經常性醫療保健支出（表1）乘以藥品的比重（表11），"
                "再用 IMF 的購買力平價換算率換成美元")
TWN_PPP_NOTE_EN = ("Taiwan is not in the OECD: per-capita current health expenditure (Table 1 of the Ministry of Health and "
                   "Welfare’s National Health Expenditure statistics) times the pharmaceutical share (Table 11), converted "
                   "with the IMF’s PPP conversion rate")


def _sha() -> tuple[dict[str, dict[int, float]], dict[str, dict[int, float]]]:
    """OECD SHA 的 HC.5.1：(占經常性醫療支出 %, 每人 PPP 美元)，全部財源、全部提供者"""
    share: dict[str, dict[int, float]] = defaultdict(dict)
    ppp: dict[str, dict[int, float]] = defaultdict(dict)
    for r in oecd.rows(SHA_FLOW, SHA_KEY):
        if (r["FUNCTION"] != "HC51" or r["FINANCING_SCHEME"] != "_T" or r["PROVIDER"] != "_T"
                or r["MODE_PROVISION"] != "_T" or r["OBS_VALUE"] == ""):
            continue
        iso3 = countries.to_iso3(r["REF_AREA"])
        if not iso3:
            continue
        if r["UNIT_MEASURE"] == "PT_EXP_HLTH":
            share[iso3][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
        elif r["UNIT_MEASURE"] == "USD_PPP_PS" and r["PRICE_BASE"] == "V":
            ppp[iso3][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    return dict(share), dict(ppp)


def _taiwan_share() -> dict[int, float]:
    """衛福部國民醫療保健支出統計表的表11：中華民國那一列，{西元年: %}"""
    rows = mohw._rows(mohw.NHE_URL, "nhe.xlsx", NHE_TABLE11)
    years = next(r for r in rows if r and isinstance(r[1], int) and 1990 < r[1] < 2100)
    row = next(r for r in rows if r and isinstance(r[0], str) and r[0].strip() == "中華民國")
    out = {int(y): float(v) for y, v in zip(years[1:], row[1:]) if isinstance(y, int) and isinstance(v, (int, float))}
    if not out:
        raise RuntimeError("國民醫療保健支出表11 讀不到台灣的藥品比重，表格格式可能變了")
    return out


def _write(name: str, unit: str, data: dict[str, dict[int, float]], digits: int,
           twn: dict[int, float] | None, note: tuple[str, str] | None, fmt) -> list[int]:
    years = year_span(data)
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    if twn:
        data = {**data, "TWN": twn}
        notes["TWN"], notes_en["TWN"] = note[0] + "。", note[1] + "."
        append_note(notes, notes_en, "TWN", later_years_note(twn, years, fmt))
    values = {c: to_series(s, years, digits) for c, s in sorted(data.items())}
    values = {c: v for c, v in values.items() if any(x is not None for x in v)}
    write_json(OUT / f"{name}.json", indicator_file(name, unit, years, values, notes=notes, notesEn=notes_en))
    latest = sorted(((s[max(s)], c, max(s)) for c, s in data.items()), reverse=True)
    print(f"  {name}：{len(values)} 國，{years[0]}–{years[-1]}；最高 {latest[:5]}；最低 {latest[-3:]}")
    return years


def _generics() -> dict[str, dict[int, float]]:
    out: dict[str, dict[int, float]] = defaultdict(dict)
    for r in oecd.rows(GEN_FLOW, "all"):
        if r["UNIT_MEASURE"] != "PT_SL_VOL_M" or r["MARKET_TYPE"] != "_T" or r["OBS_VALUE"] == "":
            continue
        if iso3 := countries.to_iso3(r["REF_AREA"]):
            out[iso3][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    return dict(out)


def _availability(name: str, code: str) -> None:
    answers = who_xmart.answers(code)
    years = sorted({y for s in answers.values() for y in s})
    values = {
        iso3: [ANSWERS.get(s.get(y, "")) for y in years]
        for iso3, s in sorted(answers.items())
        if any(ANSWERS.get(v) is not None for v in s.values())
    }
    write_json(OUT / f"{name}.json", indicator_file(name, "", years, values))
    last = [s[-1] for s in values.values()]
    print(f"  {name}：{years}，{years[-1]} 年 有 {last.count(1)}、沒有 {last.count(0)}、沒有答案 {last.count(None)}")


def _cell(td: ET.Element) -> str:
    return re.sub(r"\s+", " ", "".join(td.itertext()).replace(" ", "").replace("\xa0", "")).strip()


def _essential_medicines() -> None:
    root = ET.parse(download(EML_XML, "europepmc", "PMC6560372.xml")).getroot()
    table = next(tw for tw in root.iter("table-wrap") if (tw.findtext("label") or "").strip() == "Table 1")
    rows = [[_cell(td) for td in tr] for tr in table.iter("tr")]
    head = rows[0]
    if not (head[3].startswith("Year of list") and head[4].startswith("Total no.") and head[5].startswith("Similarity")):
        raise RuntimeError(f"Persaud 2019 表1 的欄位變了：{head}")
    values: dict[str, list[float | None]] = {}
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    missing = []
    for r in rows[1:]:
        name = r[0].replace("’", "'")
        iso3 = EML_NAMES.get(r[0]) or EML_NAMES.get(name) or countries.from_name(name)
        if not iso3:
            missing.append(r[0])
            continue
        year, total = int(r[3]), int(r[4])
        m = re.match(r"(\d+) \((\d+)\)", r[5])
        same, pct = int(m.group(1)), int(m.group(2))
        values[iso3] = [total]
        notes[iso3] = f"{year} 年的清單；跟 WHO 示範清單（2017 年）相同的藥 {same} 種（占這份清單的 {pct}%）。"
        notes_en[iso3] = (f"List from {year}; {same} medicines ({pct}% of this list) also on the WHO Model List (2017).")
    if missing:
        raise RuntimeError(f"Persaud 2019 表1 對不到國家代碼：{missing}")
    write_json(OUT / "essential-medicines.json", indicator_file(
        "essential-medicines", "種", [2017], dict(sorted(values.items())), notes=notes, notesEn=notes_en))
    top = sorted(((v[0], c) for c, v in values.items()), reverse=True)
    print(f"  essential-medicines：{len(values)} 國；最多 {top[:5]}；最少 {top[-3:]}")


def build() -> None:
    share, ppp = _sha()
    twn_share = _taiwan_share()
    _write("pharma-share", "%", share, 1, twn_share, (TWN_NOTE, TWN_NOTE_EN), lambda v: f"{v:.1f}%")
    table = mohw.nhe()
    pppex = imf.fetch("PPPEX")[0]["TWN"]
    twn_ppp = {
        y: table["che-per-capita-ntd"][y] * s / 100 / pppex[y]
        for y, s in twn_share.items() if y in table["che-per-capita-ntd"] and y in pppex
    }
    _write("pharma-per-capita", "國際元", ppp, 0, twn_ppp, (TWN_PPP_NOTE, TWN_PPP_NOTE_EN),
           lambda v: f"{v:,.0f} 國際元")
    print(f"  台灣：藥費占 {max(twn_share)} 年 {twn_share[max(twn_share)]}%，每人 {max(twn_ppp)} 年 {twn_ppp[max(twn_ppp)]:,.0f} 美元")
    _write("generics", "%", _generics(), 1, None, None, None)
    _availability("oral-morphine", "NCD_CCS_OralMorph")
    _availability("insulin", "NCD_CCS_Insulin")
    _essential_medicines()
    write_json(OUT / "manifest.json", {
        "topic": "medicines", "generatedAt": now_iso(),
        "source": ("OECD Health expenditure and financing (SHA, HC.5.1); OECD Generic market; Ministry of Health and "
                   "Welfare (Taiwan) National Health Expenditure; IMF WEO (PPPEX); WHO NCD Country Capacity Survey "
                   "(NCD_CCS_OralMorph, NCD_CCS_Insulin); Persaud et al. 2019, Bull World Health Organ 97:394, Table 1"),
        "license": "OECD terms; Taiwan Open Government Data License 1.0; CC BY 4.0; CC BY 3.0 IGO",
    })


if __name__ == "__main__":
    build()
