"""專利的國際化、技術貿易收支、研發的租稅優惠、政府研發預算花在哪（2026-11-07，製作手冊第二十五批 511，
候選 1184–1187；擴充「研發與創新」）。

- 專利（OECD MSTI，`.A.P_TRIAD+P_PCT+P_ICTPCT+P_BIOPCT......`，單位 PATN，分數計數）：三方專利家族（歐、日、美同時申請，
  優先權年，最近 2–3 年會被低估）、PCT 國際申請、ICT 與生技領域的 PCT。有台灣；台灣不是 PCT 締約國，台灣的 PCT 是
  有台灣籍發明人掛名、由其他國家的申請人遞出的分數計數（說明與附註寫明）。
- 技術貿易收支（World Bank WDI BX.GSR.ROYL.CD 收入、BM.GSR.ROYL.CD 支出，CC BY 4.0，來源 IMF）：智慧財產權使用費；
  台灣用中央銀行國際收支（BPP2Y01，百萬美元）。淨額占 GDP（WDI NY.GDP.MKTP.CD；台灣用主計總處 GDP ÷ 央行匯率）。
- 研發的租稅優惠（OECD DSD_RDTAX@DF_RDSUB，1 − B-index）：大企業／中小企業 × 有賺錢／虧錢四種情境。沒有台灣。
- 政府研發預算依社會經濟目標（OECD DSD_RDS_GOV@DF_GBARD_NABS07，FUNDMODE、TRANSCOORD 只取總額，USD_PPP 當年價）：
  14 個目標占總額的比例與總額。有台灣。太空（NABS03）「太空」主題已經有，這裡一起列、不另外做。
輸出 public/data/topics/innovation/{patents-intl,ip,rd-tax,gbard}/…。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import cbc, oecd, worldbank
from sources.countries import to_iso3
from topics.reserves import taiwan_gdp_usd

OUT = OUT_DIR / "topics" / "innovation"
MSTI = "OECD.STI.STP,DSD_MSTI@DF_MSTI,1.3"
RDSUB = "OECD.STI.STP,DSD_RDTAX@DF_RDSUB,1.0"
GBARD = "OECD.STI.STP,DSD_RDS_GOV@DF_GBARD_NABS07,1.0"
PATENTS = {"triad": "P_TRIAD", "pct": "P_PCT", "ict-pct": "P_ICTPCT", "bio-pct": "P_BIOPCT"}
TAX = {"large-profit": ("LARGE", "PROFITABLE"), "sme-profit": ("SME", "PROFITABLE"),
       "large-loss": ("LARGE", "LOSS_MAKING"), "sme-loss": ("SME", "LOSS_MAKING")}
SEO = {"earth": "NABS01", "environment": "NABS02", "space": "NABS03", "infrastructure": "NABS04", "energy": "NABS05",
       "industry": "NABS06", "health": "NABS07", "agriculture": "NABS08", "education": "NABS09", "culture": "NABS10",
       "society": "NABS11", "knowledge-guf": "NABS12", "knowledge-other": "NABS13", "defence": "NABS14"}
PCT_NOTE = ("台灣不是 PCT 締約國，台灣的申請人不能直接遞 PCT；這裡是有台灣籍發明人掛名、由其他國家的申請人（多半是外國母公司或海外子公司）"
            "遞出的 PCT 申請，依發明人所在地分數計數，不是「台灣申請了多少件 PCT」。",
            "Taiwan is not a PCT contracting state, so applicants in Taiwan cannot file PCT applications directly; this counts PCT applications "
            "with inventors in Taiwan filed by applicants elsewhere (mostly foreign parents or overseas subsidiaries), fractionally by inventor "
            "location, not PCT applications filed by Taiwan.")
TAX_HAVEN = ("IRL", "NLD", "CHE", "SGP", "LUX", "MLT", "CYP")
IP_NOTE = ("跨國企業把專利、商標等無形資產登記在低稅率的地方再對外授權，這裡的權利金收支被稅務規劃大幅放大，不代表當地的技術實力。",
           "Multinationals register patents, trademarks and other intangibles in low-tax jurisdictions and license them from there, so royalty "
           "flows here are greatly inflated by tax planning and do not reflect local technological strength.")
TW_IP = {"receipts": "服務-其他服務-智慧財產權使用費-收入", "payments": "服務-其他服務-智慧財產權使用費-支出"}


def _write(path, name: str, unit: str, data: dict[str, dict[int, float]], digits: int, first: int,
           agg: dict[str, dict[int, float]] | None = None, **extra) -> list[int]:
    years = list(range(first, max(y for s in data.values() for y in s) + 1))
    values = {k: [round(s[y], digits) if y in s else None for y in years] for k, s in sorted(data.items()) if any(y in s for y in years)}
    if agg:
        extra["aggregates"] = {k: [round(s[y], digits) if y in s else None for y in years] for k, s in agg.items()}
    write_json(path, indicator_file(name, unit, years, values, **extra))
    return years


def _split(rows, pick) -> tuple[dict[str, dict[int, float]], dict[str, dict[int, float]]]:
    data: dict[str, dict[int, float]] = {}
    agg: dict[str, dict[int, float]] = {}
    for r in rows:
        if not r["OBS_VALUE"] or not pick(r):
            continue
        iso3 = to_iso3(r["REF_AREA"])
        (data.setdefault(iso3, {}) if iso3 else agg.setdefault(r["REF_AREA"], {}))[int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    return data, agg


def _patents() -> None:
    rows = [r for r in oecd.rows(MSTI, ".A.P_TRIAD+P_PCT+P_ICTPCT+P_BIOPCT......")
            if r["UNIT_MEASURE"] == "PATN" and r["TRANSFORMATION"] == "_Z"]
    for item, code in PATENTS.items():
        data, agg = _split(rows, lambda r, c=code: r["MEASURE"] == c)
        notes = {"notes": {"TWN": PCT_NOTE[0]}, "notesEn": {"TWN": PCT_NOTE[1]}} if item != "triad" else {}
        years = _write(OUT / "patents-intl" / f"{item}.json", f"patents-intl/{item}", "patents", data, 1, 2000, agg,
                       latestWithin=3, license="OECD Terms and Conditions", **notes)
        print(f"  專利 {item}：{len(data)} 國（{years[0]}–{years[-1]}）")


def _royalties() -> None:
    tw = cbc.balance_of_payments(list(TW_IP.values()))
    gdp, _ = worldbank.fetch("NY.GDP.MKTP.CD", 2000)
    gdp["TWN"] = taiwan_gdp_usd()
    flows = {}
    for item, code in (("receipts", "BX.GSR.ROYL.CD"), ("payments", "BM.GSR.ROYL.CD")):
        data, _ = worldbank.fetch(code, 2000)
        data["TWN"] = {y: v * 1e6 for y, v in tw[TW_IP[item]].items() if y >= 2000}
        flows[item] = data
        years = _write(OUT / "ip" / f"{item}.json", f"ip/{item}", "USD", data, 0, 2000, latestWithin=2, license="CC BY 4.0",
                       notes={k: IP_NOTE[0] for k in TAX_HAVEN}, notesEn={k: IP_NOTE[1] for k in TAX_HAVEN})
        print(f"  智慧財產權使用費 {item}：{len(data)} 國（{years[0]}–{years[-1]}）")
    net = {}
    for k in set(flows["receipts"]) & set(flows["payments"]):
        s = {y: (flows["receipts"][k][y] - flows["payments"][k][y]) / gdp[k][y] * 100
             for y in flows["receipts"][k] if y in flows["payments"][k] and gdp.get(k, {}).get(y)}
        if s:
            net[k] = s
    _write(OUT / "ip" / "net-gdp.json", "ip/net-gdp", "%", net, 3, 2000, latestWithin=2, license="CC BY 4.0",
           notes={k: IP_NOTE[0] for k in TAX_HAVEN}, notesEn={k: IP_NOTE[1] for k in TAX_HAVEN})
    print(f"  淨額占 GDP：{len(net)} 國")


def _tax() -> None:
    rows = oecd.rows(RDSUB)
    for item, (size, profit) in TAX.items():
        data, _ = _split(rows, lambda r, s=size, p=profit: r["SIZE"] == s and r["PROFIT_SCENARIO"] == p)
        years = _write(OUT / "rd-tax" / f"{item}.json", f"rd-tax/{item}", "index", data, 2, 2000,
                       latestWithin=1, license="OECD Terms and Conditions")
        print(f"  研發租稅優惠 {item}：{len(data)} 國（{years[0]}–{years[-1]}）")


def _gbard() -> None:
    rows = [r for r in oecd.rows(GBARD) if r["UNIT_MEASURE"] == "USD_PPP" and r["PRICE_BASE"] == "V"
            and r["FUNDMODE"] == "_T" and r["TRANSCOORD"] == "_Z"]
    total, total_agg = _split(rows, lambda r: r["SEO"] == "_T")
    _write(OUT / "gbard" / "total.json", "gbard/total", "USD PPP", {k: {y: v * 1e6 for y, v in s.items()} for k, s in total.items()},
           0, 2000, latestWithin=2, license="OECD Terms and Conditions")
    for item, code in SEO.items():
        data, _ = _split(rows, lambda r, c=code: r["SEO"] == c)
        share = {k: {y: v / total[k][y] * 100 for y, v in s.items() if total.get(k, {}).get(y)} for k, s in data.items()}
        _write(OUT / "gbard" / f"{item}.json", f"gbard/{item}", "%", {k: s for k, s in share.items() if s}, 2, 2000,
               latestWithin=2, license="OECD Terms and Conditions")
    print(f"  政府研發預算：{len(total)} 國")


def build() -> None:
    _patents()
    _royalties()
    _tax()
    _gbard()
