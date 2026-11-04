"""人工生殖（IVF）（2026-11-04，製作手冊第二十批 312）。

- 歐洲：ESHRE 的 EIM「ART in Europe, 2019」（Smeenk 等 2023，《Human Reproduction》38(12):2321，PMC10694409，CC BY 4.0），
  Europe PMC 的全文 XML（不必登入）。表 1 是各國的療程數（IVF、ICSI、冷凍胚胎植入 FET、胚胎著床前基因檢測 PGT、卵子捐贈 ED、
  IVM、冷凍卵 FOR）、有幾家診所與回報了幾家、每百萬人的療程數（只有回報完整的國家才有，缺的用 WPP 2024 的 2019 年人口自己算）；
  表 4 是新鮮週期（IVF＋ICSI）植入幾個胚胎與雙胞胎、三胞胎占分娩的比例。
- 全球：《Human Reproduction Open》2026「cost-to-baby」（PMC13671746，CC BY 4.0）表 1：每年的療程數、試管嬰兒占出生數的比例、
  每千名育齡女性的療程數，15 個國家（澳洲與紐西蘭合在一列）加幾個區域（區域不用）。年份各國不同（表上寫的是來源的出版年），
  所以這個主題不分年份。
- 台灣：國健署《人工生殖施行結果分析報告》（等本機 session 下載）；HROpen 的台灣（84,205 個療程）跟國健署 112 年的
  58,557 個不一樣，療程數等國健署的報告，占出生數的比例先用 HROpen 的 11.9%（來源寫衛福部 2024）。
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import countries, wpp

OUT = OUT_DIR / "topics" / "ivf"
ESHRE = "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10694409/fullTextXML"
HROPEN = "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13671746/fullTextXML"
ESHRE_YEAR = 2019
HROPEN_POP_YEAR = 2023

NAMES = {
    "Bosnia-Herzegovina, Federation part": "BIH", "Czech Republic": "CZE", "The Netherlands": "NLD", "UK": "GBR",
    "Turkey": "TUR", "Russia": "RUS", "Moldova": "MDA", "North Macedonia": "MKD", "Kazakhstan": "KAZ",
    "USA": "USA", "South Korea": "KOR", "Taiwan, China": "TWN", "AUS and NZ": "AUS+NZL",
}
QUALITY = {"High": ("官方或醫學會的登錄", "official or professional-society registries"),
           "Mod": ("灰色文獻與少數診所資料", "grey literature and a few clinic fee schedules"),
           "Estim": ("專家估計", "expert estimate")}


def _text(el: ET.Element) -> str:
    return " ".join("".join(el.itertext()).split())


def _table(path, suffix: str) -> list[list[str]]:
    root = ET.parse(path).getroot()
    tw = next(t for t in root.iter("table-wrap") if (t.get("id") or "").endswith(suffix))
    return [[_text(c) for c in tr if c.tag in ("td", "th")] for tr in tw.iter("tr")]


def _num(cell: str) -> float | None:
    cell = cell.replace(" ", "").replace(" ", "").replace("$", "").replace("%", "").replace("<", "")
    return float(cell) if re.fullmatch(r"-?\d+(\.\d+)?", cell) else None


def _iso3(name: str) -> str:
    iso3 = NAMES.get(name) or countries.from_name(name)
    if not iso3:
        raise RuntimeError(f"人工生殖：對不到的國名 {name!r}")
    return iso3


def _eshre() -> tuple[dict, dict]:
    """回傳 ({iso3: 表 1 的欄位}, {iso3: 表 4 的欄位})"""
    path = download(ESHRE, "ivf", "PMC10694409.xml")
    t1 = _table(path, "T1")
    head = t1[1]
    assert head[:3] == ["Country", "IVF Clinics", "Included IVF clinics"] and head[-3:] == ["All", "Women 15-45", "Population"], head
    rows1 = {}
    for r in t1[2:]:
        if r[0] == "All":
            continue
        rows1[_iso3(r[0])] = {"name": r[0], **{h: _num(v) for h, v in zip(head[1:], r[1:])}}
    t4 = _table(path, "T4")
    head4 = t4[1]
    assert head4[:3] == ["Country", "Transfers", "1 embryo (%)"] and head4[6:9] == ["Deliveries", "Twin (%)", "Triplet (%)"], head4
    rows4 = {}
    for r in t4[2:]:
        if r[0].startswith("All"):
            continue
        rows4[_iso3(r[0])] = {"single": _num(r[2]), "deliveries": _num(r[6]), "twin": _num(r[7]), "triplet": _num(r[8])}
    return rows1, rows4


def _hropen() -> dict:
    path = download(HROPEN, "ivf", "PMC13671746.xml")
    t1 = _table(path, "T1")
    head = t1[0]
    assert head[2] == "Annual ART cycles (n)" and head[9] == "% of ART births" and head[10] == "ART cycles/1000 women", head
    out = {}
    for r in t1[1:]:
        name = re.sub(r"[¶†‡§]$", "", r[0]).strip()
        if name in ("Africa", "East Europe", "Latin America", "Middle East", "SE Asia", "West Europe"):
            continue
        rec = {"name": name, "cycles": _num(r[2]), "share": _num(r[9]), "per1000": _num(r[10]),
               "source": r[12], "quality": r[13]}
        for iso3 in _iso3(name).split("+"):
            out[iso3] = rec
    return out


def _fmt(v: float) -> str:
    return f"{v:,.0f}"


def build() -> None:
    eshre, transfers = _eshre()
    hropen = _hropen()
    pop = wpp.demographic(["TPopulation1July"], last_year=HROPEN_POP_YEAR)["TPopulation1July"]  # 千人

    cycles, hints, hints_en = {}, {}, {}
    computed, no_value, no_value_en = [], {}, {}
    for iso3, r in eshre.items():
        reported = r["Population"]
        if r["Included IVF clinics"] < r["IVF Clinics"] / 2:
            # 回報的診所不到一半：每百萬人會低估很多，不畫，原因寫在「無資料」
            no_value[iso3] = f"ESHRE {ESHRE_YEAR}：{r['IVF Clinics']:.0f} 家診所只有 {r['Included IVF clinics']:.0f} 家回報（{_fmt(r['All'])} 個療程），算每百萬人會低估很多"
            no_value_en[iso3] = f"ESHRE {ESHRE_YEAR}: only {r['Included IVF clinics']:.0f} of {r['IVF Clinics']:.0f} clinics reported ({_fmt(r['All'])} cycles), so a per-million figure would be far too low"
            continue
        value = reported if reported is not None else r["All"] / pop[iso3][ESHRE_YEAR] * 1000
        if reported is None:
            computed.append(iso3)
        cycles[iso3] = round(value)
        parts = [("IVF", r["IVF"]), ("ICSI", r["ICSI"]), ("冷凍胚胎植入", r["FET"]), ("卵子捐贈", r["ED"])]
        parts_en = [("IVF", r["IVF"]), ("ICSI", r["ICSI"]), ("frozen embryo transfer", r["FET"]), ("egg donation", r["ED"])]
        mix = "、".join(f"{k} {v / r['All'] * 100:.0f}%" for k, v in parts if v)
        mix_en = ", ".join(f"{k} {v / r['All'] * 100:.0f}%" for k, v in parts_en if v)
        coverage = f"{r['IVF Clinics']:.0f} 家診所有 {r['Included IVF clinics']:.0f} 家回報"
        coverage_en = f"{r['Included IVF clinics']:.0f} of {r['IVF Clinics']:.0f} clinics reported"
        partial = r["Included IVF clinics"] < r["IVF Clinics"]
        zh = [f"ESHRE {ESHRE_YEAR} 年 {_fmt(r['All'])} 個療程（{mix}）", coverage + ("，實際比這多" if partial else "")]
        en = [f"ESHRE {ESHRE_YEAR}: {_fmt(r['All'])} cycles ({mix_en})", coverage_en + ("; the true figure is higher" if partial else "")]
        if reported is None:
            zh.append("每百萬人是用聯合國的人口自己算的")
            en.append("per-million figure computed with UN population")
        hints[iso3], hints_en[iso3] = "；".join(zh), "; ".join(en)

    for iso3, r in hropen.items():
        if iso3 in cycles or iso3 == "TWN":
            continue
        pair = iso3 in ("AUS", "NZL")
        total_pop = (pop["AUS"][HROPEN_POP_YEAR] + pop["NZL"][HROPEN_POP_YEAR]) if pair else pop[iso3][HROPEN_POP_YEAR]
        cycles[iso3] = round(r["cycles"] / total_pop * 1000)
        q_zh, q_en = QUALITY[r["quality"]]
        hints[iso3] = (f"每年約 {_fmt(r['cycles'])} 個療程{'（澳洲與紐西蘭合計）' if pair else ''}，用聯合國 {HROPEN_POP_YEAR} 年的人口換算；"
                       f"HROpen 2026 彙整（{r['source']}，{q_zh}）")
        hints_en[iso3] = (f"About {_fmt(r['cycles'])} cycles a year{' (Australia and New Zealand combined)' if pair else ''}, "
                          f"per million with UN {HROPEN_POP_YEAR} population; compiled by HROpen 2026 ({r['source']}; {q_en})")

    share, share_hints, share_hints_en = {}, {}, {}
    for iso3, r in hropen.items():
        share[iso3] = r["share"]
        q_zh, q_en = QUALITY[r["quality"]]
        pair = iso3 in ("AUS", "NZL")
        share_hints[iso3] = (f"{'澳洲與紐西蘭合計；' if pair else ''}每千名 15–49 歲女性每年 {r['per1000']:g} 個療程；"
                             f"來源 {r['source']}（{q_zh}）")
        share_hints_en[iso3] = (f"{'Australia and New Zealand combined; ' if pair else ''}{r['per1000']:g} cycles a year per 1,000 women aged 15–49; "
                                f"source {r['source']} ({q_en})")

    multiples, m_hints, m_hints_en = {}, {}, {}
    for iso3, r in transfers.items():
        if r["twin"] is None or not r["deliveries"] or r["deliveries"] < 50:
            continue
        multiples[iso3] = round(r["twin"] + (r["triplet"] or 0), 1)
        single = f"；只植入一個胚胎的占 {r['single']:g}%" if r["single"] is not None else ""
        single_en = f"; single-embryo transfers {r['single']:g}%" if r["single"] is not None else ""
        m_hints[iso3] = f"雙胞胎 {r['twin']:g}%、三胞胎 {r['triplet']:g}%（{_fmt(r['deliveries'])} 次分娩）{single}"
        m_hints_en[iso3] = f"Twins {r['twin']:g}%, triplets {r['triplet']:g}% ({_fmt(r['deliveries'])} deliveries){single_en}"

    tw_note = ("台灣的療程數等國健署《人工生殖施行結果分析報告》補上（HROpen 寫每年 84,205 個療程，國健署 112 年是 58,557 個，定義不同）；"
               "占出生數的 11.9% 是 HROpen 引用衛福部 2024 年的數字。")
    tw_note_en = ("Taiwan’s cycle count will come from the Health Promotion Administration’s annual ART report (HROpen lists 84,205 cycles a year; "
                  "the HPA reports 58,557 in 2023, with a different definition). The 11.9% share of births is HROpen’s figure citing the Ministry of Health and Welfare (2024).")
    notes, notes_en = {"TWN": tw_note}, {"TWN": tw_note_en}

    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "births-share.json", indicator_file(
        "births-share", "%", [HROPEN_POP_YEAR], {c: [v] for c, v in sorted(share.items())},
        hints=share_hints, hintsEn=share_hints_en, notes=notes, notesEn=notes_en))
    write_json(OUT / "cycles.json", indicator_file(
        "cycles", "每百萬人", [HROPEN_POP_YEAR], {c: [v] for c, v in sorted(cycles.items())},
        hints=hints, hintsEn=hints_en, notes=notes, notesEn=notes_en, noValue=no_value, noValueEn=no_value_en))
    write_json(OUT / "multiples.json", indicator_file(
        "multiples", "%", [ESHRE_YEAR], {c: [v] for c, v in sorted(multiples.items())},
        hints=m_hints, hintsEn=m_hints_en))
    write_json(OUT / "manifest.json", {
        "topic": "ivf", "generatedAt": now_iso(),
        "source": "ESHRE EIM, ART in Europe 2019 (Smeenk et al. 2023, Hum Reprod, PMC10694409, CC BY 4.0); "
                  "Human Reproduction Open 2026 cost-to-baby study (PMC13671746, CC BY 4.0); UN WPP 2024",
        "license": "CC BY 4.0",
    })
    top = sorted(((v, c) for c, v in cycles.items()), reverse=True)
    print(f"  人工生殖：療程 {len(cycles)} 國（自己算每百萬人的 {computed}；回報不到一半不畫的 {sorted(no_value)}）；最高 {[(c, v) for v, c in top[:8]]}，最低 {[(c, v) for v, c in top[-5:]]}")
    print(f"  占出生數 {len(share)} 國：{sorted(((v, c) for c, v in share.items()), reverse=True)}")
    print(f"  多胞胎 {len(multiples)} 國：{sorted(((v, c) for c, v in multiples.items()), reverse=True)}")
