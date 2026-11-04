"""疫苗與防疫：WHO 預認證的疫苗與品管實驗室、mRNA 疫苗技術移轉的夥伴國（2026-11-04，製作手冊第二十批 333）。

使用者 2026-11-04 決定 333 當事實自行整理（同 PIC/S 會員的做法；預認證站沒有授權文字、條款頁 404）。
- 預認證疫苗：WHO Prequalification 的匯出（extranet.who.int/prequal/vaccines/prequalified/export?page&_format=csv，287 項），
  依「Responsible NRA」（負責的監管機關，不是工廠所在地）算每國幾項；歐盟 EMA 不是國家，不畫，數字寫在說明裡。
- 預認證品管實驗室：同站的 quality-control-labs 匯出（68 間），依 Country 算每國幾間。
- mRNA 技術移轉：WHO「mRNA Technology Transfer (mRNA TT) Programme」頁（who.int/initiatives/the-mRNA-vaccine-technology-transfer-hub
  轉到 mrna-technology-transfer-(mrna-tt)-programme）：南非的樞紐加 14 個夥伴國；程式核對頁面上有這 15 個國名，對不上就報錯。
清單是現況快照，退出的產品會消失、沒有歷史，所以不分年份。台灣不在這些清單裡。
"""
from __future__ import annotations

import csv
import html
import re
from collections import Counter, defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "vaccination"
VACCINES_URL = "https://extranet.who.int/prequal/vaccines/prequalified/export?page&_format=csv"
LABS_URL = "https://extranet.who.int/prequal/medicines/prequalified/quality-control-labs/export?page&_format=csv"
MRNA_URL = "https://www.who.int/initiatives/the-mRNA-vaccine-technology-transfer-hub"
YEAR = 2026
NRA = {
    "Central Drugs Standard Control Organization": "IND", "Ministry of Food and Drug Safety": "KOR",
    "Federal Agency for Medicines and Health Products": "BEL", "National Agency of Drug and Food Control Indonesia": "IDN",
    "National Medical Products Administration": "CHN", "Bulgarian Drug Agency": "BGR", "CBER/FDA": "USA",
    "US Food and Drug Administration- Office of Vaccine Research and Review": "USA",
    "Agence nationale de sécurité du médicament et des produits de santé": "FRA",
    "Centro para el Control Estatal de la Calidad de los Medicamentos": "CUB", "Medicines Evaluation Board (MEB)": "NLD",
    "Agencia Nacional da Vigilancia Sanitaria": "BRA",
    "Federal Service on Surveillance in Healthcare (ROSZDRAVNADZOR) of the Russian Federation": "RUS",
    "Danish Medicines Agency": "DNK", "Ministère de la Santé publique": "SEN",  # 塞內加爾（達卡巴斯德研究所的黃熱病疫苗）
    "Pharmaceutical and Medical Devices Agency": "JPN", "Health Canada - Santé Canada": "CAN", "Paul-Ehrlich-Institut": "DEU",
    "Medical Products Agency": "SWE", "Thai Food and Drug Administration": "THA", "Therapeutic Goods Administration": "AUS",
}
EMA = "European Medicines Agency"
LAB_NAMES = {"Iran (Islamic Republic of)": "IRN", "United Republic of Tanzania": "TZA", "Russian Federation": "RUS", "Vietnam": "VNM",
             "Bolivia": "BOL"}
MRNA_HUB = "ZAF"
MRNA_PARTNERS = {"Argentina": "ARG", "Bangladesh": "BGD", "Brazil": "BRA", "Egypt": "EGY", "India": "IND", "Indonesia": "IDN",
                 "Kenya": "KEN", "Nigeria": "NGA", "Pakistan": "PAK", "Senegal": "SEN", "Serbia": "SRB", "Tunisia": "TUN",
                 "Ukraine": "UKR", "Vietnam": "VNM"}


def build() -> None:
    with open(download(VACCINES_URL, "who-pq", "vaccines.csv"), encoding="utf-8-sig", newline="") as f:
        vaccines = list(csv.DictReader(f))
    by_nra: dict[str, list[dict]] = defaultdict(list)
    ema = 0
    for r in vaccines:
        nra = r["Responsible NRA"].strip()
        if nra == EMA:
            ema += 1
            continue
        if nra not in NRA:
            raise RuntimeError(f"WHO 預認證疫苗：沒有對應國家的監管機關 {nra!r}")
        by_nra[NRA[nra]].append(r)
    counts = {c: len(rows) for c, rows in by_nra.items()}
    hints, hints_en = {}, {}
    for c, rows in by_nra.items():
        makers = Counter(" ".join(r["Manufacturer"].split()) for r in rows).most_common(3)
        nras = sorted({r["Responsible NRA"].strip() for r in rows})
        hints[c] = f"監管機關 {'、'.join(nras)}；製造商 " + "、".join(f"{m} {n} 項" for m, n in makers)
        hints_en[c] = f"Regulator {', '.join(nras)}; manufacturers " + ", ".join(f"{m} ({n})" for m, n in makers)
    no_value = {"TWN": "台灣不在 WHO 的預認證體系裡"}
    no_value_en = {"TWN": "Taiwan is not part of WHO prequalification"}
    write_json(OUT / "pq-vaccines.json", indicator_file(
        "pq-vaccines", "項", [YEAR], {c: [v] for c, v in sorted(counts.items())}, hints=hints, hintsEn=hints_en,
        noValue=no_value, noValueEn=no_value_en))
    with open(download(LABS_URL, "who-pq", "qcl.csv"), encoding="utf-8-sig", newline="") as f:
        labs = list(csv.DictReader(f))
    lab_counts: Counter = Counter()
    lab_names: dict[str, list[str]] = defaultdict(list)
    for r in labs:
        iso3 = LAB_NAMES.get(r["Country"].strip()) or from_name(r["Country"].strip())
        if not iso3:
            raise RuntimeError(f"WHO 預認證品管實驗室：對不到的國名 {r['Country']!r}")
        lab_counts[iso3] += 1
        lab_names[iso3].append(" ".join(r["Applicant Organization"].split()))
    write_json(OUT / "pq-labs.json", indicator_file(
        "pq-labs", "間", [YEAR], {c: [v] for c, v in sorted(lab_counts.items())},
        hints={c: "、".join(n[:4]) + ("…" if len(n) > 4 else "") for c, n in lab_names.items()},
        hintsEn={c: "; ".join(n[:4]) + ("…" if len(n) > 4 else "") for c, n in lab_names.items()},
        noValue=no_value, noValueEn=no_value_en))
    page = download(MRNA_URL, "who-pq", "mrna.html").read_text(encoding="utf-8")
    text = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", page)).split())
    missing = [n for n in [*MRNA_PARTNERS, "South Africa", "Afrigen", "Biovac"] if n not in text]
    if missing or "14 additional global partners" not in text:
        raise RuntimeError(f"WHO 的 mRNA 技術移轉頁變了，找不到 {missing}")
    mrna = {MRNA_HUB: 1, **{c: 2 for c in MRNA_PARTNERS.values()}}
    write_json(OUT / "mrna-hub.json", indicator_file(
        "mrna-hub", "類別", [YEAR], {c: [v] for c, v in sorted(mrna.items())},
        hints={MRNA_HUB: "樞紐：Afrigen Biologics、南非醫學研究理事會（SAMRC）、Biovac"},
        hintsEn={MRNA_HUB: "Hub: Afrigen Biologics, the South African Medical Research Council (SAMRC) and Biovac"},
        noValue=no_value, noValueEn=no_value_en))
    print(f"  預認證疫苗：{len(vaccines)} 項，國家 {sorted(counts.items(), key=lambda kv: -kv[1])}，EMA {ema}")
    print(f"  品管實驗室：{len(labs)} 間、{len(lab_counts)} 國 {lab_counts.most_common(6)}；mRNA：{len(mrna)} 國")
