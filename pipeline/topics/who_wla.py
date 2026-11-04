"""國際組織：各國藥政機關在 WHO 的成熟度（ML3、ML4）與過渡期的 WHO 認可機關（2026-11-04，製作手冊第二十批 328）。

WHO 的兩份 PDF（cdn.who.int，不必登入）：
- 《List of National Regulatory Authorities (NRAs) operating at maturity level 3 (ML3) and maturity level 4 (ML4)》，
  2026 年 8 月版，21 國：用 Global Benchmarking Tool 評到 ML3（穩定、運作良好）或 ML4（進階、持續改善）的藥政機關、
  範圍（藥品、疫苗〔有生產或沒有生產〕、醫療器材）與公布年份。
- 《List of transitional WLAs》：過渡期的 WHO 認可機關（WHO-Listed Authorities），56 國加歐盟（EMA/EC），來源是 2022-03-31 的
  暫行名單：A ML3／ML4、B 原本的嚴格監管機關（SRA，藥品）、C 表現優良的疫苗監管機關、D 美洲的區域參考機關、E 功能完備的疫苗監管機關。
授權：WHO 的出版物是 CC BY-NC-SA 3.0 IGO，兩份 PDF 本身沒有印授權；照使用者 2026-11-04 對 333、334 的決定（同 PIC/S 會員的做法），
只取「哪一國的哪個機關在哪一級」的事實自行整理，寫在下面的表裡，不轉載 PDF。PDF 的 SHA-256 記在 SHA256，WHO 換版就報錯，
重新核對名單（WHO 寫名單會持續更新）。
"""
from __future__ import annotations

import hashlib

from common import OUT_DIR, download, indicator_file, write_manifest_part, write_json

OUT = OUT_DIR / "topics" / "organizations"
ML_URL = "https://cdn.who.int/media/docs/default-source/medicines/regulatory-systems/wla/list-of-nras-operating-at-ml3-and-ml4.pdf"
TWLA_URL = "https://cdn.who.int/media/docs/default-source/medicines/regulatory-updates/wla/list-of-transitional-wlas.pdf"
SHA256 = {
    "ml34.pdf": "0d34581e68b2ce62fd6004d464d6a137cc80c393b3d3ac86fb5495dcb89aff95",
    "twla.pdf": "8349215693baf1f5b48bd7e41c84f512b10fcd4b29d7ab4b561ad78ad262aea8",
}
AS_OF = "2026 年 8 月"
YEAR = 2026

# src/topics/organizations.ts 的 WHO_MATURITY
ML4, ML3, ML3_VACCINES, TWLA_ONLY = 1, 2, 3, 4

# ISO3: (機關, 等級, 範圍, 公布年份)；範圍 m 藥品、v 疫苗（有生產）、n 疫苗（沒有生產）、d 醫療器材
ML = {
    "CHN": ("國家藥品監督管理局（NMPA）", 3, "v", "2022"),
    "EGY": ("Egyptian Drug Authority（EDA）", 3, "mv", "疫苗 2022、藥品 2024"),
    "ETH": ("Ethiopian Food and Drug Authority（EFDA）", 3, "mn", "2025"),
    "GHA": ("Food and Drugs Authority（FDA）", 3, "mn", "2020、2025"),
    "IND": ("Central Drugs Standard Control Organisation（CDSCO）", 3, "v", "2017、2024"),
    "IDN": ("Badan POM", 3, "v", "2019"),
    "KAZ": ("衛生部藥品醫療器材管制委員會與國家鑑定中心", 3, "mn", "2026"),
    "MOZ": ("Autoridade Nacional Reguladora de Medicamentos（ANARME）", 3, "mn", "2026"),
    "NGA": ("National Agency for Food and Drug Administration and Control（NAFDAC）", 3, "mn", "2022、2025"),
    "KOR": ("食品醫藥品安全處（MFDS）", 4, "mv", "2022"),
    "RWA": ("Rwanda Food and Drugs Authority（FDA）", 3, "mn", "2024"),
    "SAU": ("Saudi Food and Drug Authority（SFDA）", 4, "mv", "2023"),
    "SEN": ("Agence sénégalaise de Réglementation Pharmaceutique", 3, "mn", "2024"),
    "SRB": ("Medicines and Medical Devices Agency（ALIMS）", 3, "v", "2019"),
    "SGP": ("Health Sciences Authority（HSA）", 4, "mnd", "2022、醫療器材 2026"),
    "ZAF": ("South African Health Products Regulatory Authority（SAHPRA）", 3, "v", "2022、2026"),
    "THA": ("Food and Drug Administration（Thai FDA）", 3, "v", "2021"),
    "TUR": ("Turkish Medicines and Medical Devices Agency（TİTCK）", 3, "mv", "2023"),
    "TZA": ("Tanzania Medicines and Medical Devices Authority（TMDA）", 3, "mn", "2018、2025"),
    "VNM": ("越南藥品管理局（DAV）等四個機關組成的疫苗監管體系", 3, "v", "2020"),
    "ZWE": ("Medicines Control Authority of Zimbabwe（MCAZ）", 3, "mn", "2024"),
}
# ISO3: (機關, 來源, 範圍)；範圍 m 藥品、v 疫苗
TWLA = {
    "ARG": ("ANMAT", "D", "mv"), "AUS": ("TGA", "BCE", "mv"), "AUT": ("AGES", "B", "m"), "BEL": ("FAMHP", "BCE", "mv"),
    "BRA": ("ANVISA", "DE", "mv"), "BGR": ("BDA", "BE", "mv"), "CAN": ("Health Canada", "BCDE", "mv"), "CHL": ("ISP", "D", "m"),
    "CHN": ("NMPA", "E", "v"), "COL": ("INVIMA", "D", "m"), "HRV": ("HALMED", "B", "m"), "CYP": ("MoH-PHS", "B", "m"),
    "CUB": ("CECMED", "DE", "mv"), "CZE": ("SÚKL", "B", "m"), "DNK": ("DKMA", "BE", "mv"), "EGY": ("EDA", "A", "v"),
    "EST": ("SAM", "B", "m"), "FIN": ("FIMEA", "B", "m"), "FRA": ("ANSM", "BCE", "mv"), "DEU": ("BfARM（藥品）、PEI（疫苗）", "BCE", "mv"),
    "GHA": ("FDA", "A", "m"), "GRC": ("EOF", "B", "m"), "HUN": ("OGYÉI", "B", "m"), "ISL": ("IMA", "B", "m"),
    "IND": ("CDSCO", "A", "v"), "IDN": ("Badan POM", "A", "v"), "IRN": ("IFDA", "E", "v"), "IRL": ("HPRA", "B", "m"),
    "ITA": ("AIFA", "BCE", "mv"), "JPN": ("PMDA", "BE", "mv"), "LVA": ("ZVA", "B", "m"), "LIE": ("Office of Health", "B", "m"),
    "LTU": ("VVKT", "B", "m"), "LUX": ("MoH", "B", "m"), "MLT": ("Medicines Authority", "B", "m"), "MEX": ("COFEPRIS", "DE", "mv"),
    "NLD": ("MEB", "BCE", "mv"), "NGA": ("NAFDAC", "A", "m"), "NOR": ("NOMA", "B", "m"), "POL": ("URPL", "B", "m"),
    "PRT": ("INFARMED", "B", "m"), "KOR": ("MFDS", "E", "v"), "ROU": ("ANMDMR", "B", "m"), "RUS": ("衛生部", "E", "v"),
    "SRB": ("ALIMS", "A", "v"), "SGP": ("HSA", "A", "m"), "SVK": ("ŠÚKL", "B", "m"), "SVN": ("JAZMP", "B", "m"),
    "ESP": ("AEMPS", "B", "m"), "SWE": ("MPA", "BE", "mv"), "CHE": ("Swissmedic", "BCE", "mv"), "THA": ("Thai FDA", "A", "v"),
    "GBR": ("MHRA", "BCE", "mv"), "TZA": ("TMDA", "A", "m"), "USA": ("US FDA", "BCDE", "mv"), "VNM": ("DAV", "A", "v"),
}
SCOPE_ZH = {"m": "藥品", "v": "疫苗（有生產）", "n": "疫苗（沒有生產）", "d": "醫療器材"}
SCOPE_EN = {"m": "medicines", "v": "vaccines (producing)", "n": "vaccines (non-producing)", "d": "medical devices"}
ORIGIN_ZH = {"A": "ML3／ML4", "B": "原本的嚴格監管機關（藥品）", "C": "表現優良的疫苗監管機關", "D": "美洲的區域參考機關",
             "E": "功能完備的疫苗監管機關"}
ORIGIN_EN = {"A": "ML3/ML4", "B": "former stringent regulatory authority (medicines)", "C": "highly performing NRA (vaccines)",
             "D": "regional reference authority of the Americas", "E": "functional NRA (vaccines)"}
TWLA_SCOPE_ZH = {"m": "藥品", "v": "疫苗", "mv": "藥品與疫苗"}
TWLA_SCOPE_EN = {"m": "medicines", "v": "vaccines", "mv": "medicines and vaccines"}


def _check(url: str, name: str) -> None:
    digest = hashlib.sha256(download(url, "who-wla", name).read_bytes()).hexdigest()
    if digest != SHA256[name]:
        raise RuntimeError(f"WHO 的 {name} 換版了（SHA-256 {digest}），請重新核對 ML、TWLA 兩張表再更新 SHA256")


def build() -> None:
    _check(ML_URL, "ml34.pdf")
    _check(TWLA_URL, "twla.pdf")
    if len(ML) != 21 or len(TWLA) != 56:
        raise RuntimeError(f"名單的國數不對：ML {len(ML)}、tWLA {len(TWLA)}")
    values, hints, hints_en = {}, {}, {}
    for iso3, (body, level, scope, years) in ML.items():
        vaccines_only = "m" not in scope
        values[iso3] = ML4 if level == 4 else (ML3_VACCINES if vaccines_only else ML3)
        hints[iso3] = f"{body}：ML{level}，範圍 " + "、".join(SCOPE_ZH[s] for s in scope) + f"（公布 {years}）"
        hints_en[iso3] = f"{body}: ML{level}, scope " + ", ".join(SCOPE_EN[s] for s in scope) + f" (announced {years})"
    for iso3, (body, origin, scope) in TWLA.items():
        values.setdefault(iso3, TWLA_ONLY)
        zh = f"過渡期 WHO 認可機關：{body}（{TWLA_SCOPE_ZH[scope]}；來源 " + "、".join(ORIGIN_ZH[o] for o in origin) + "）"
        en = f"Transitional WHO-Listed Authority: {body} ({TWLA_SCOPE_EN[scope]}; origin " + ", ".join(ORIGIN_EN[o] for o in origin) + ")"
        hints[iso3] = f"{hints[iso3]}；{zh}" if iso3 in hints else zh
        hints_en[iso3] = f"{hints_en[iso3]}; {en}" if iso3 in hints_en else en
    write_json(OUT / "who-maturity.json", indicator_file(
        "who-maturity", "類別", [YEAR], {c: [v] for c, v in sorted(values.items())}, hints=hints, hintsEn=hints_en))
    write_manifest_part(OUT, "organizations", "who-maturity", {
        "source": "WHO, List of NRAs operating at ML3 and ML4 (August 2026); WHO, List of transitional WLAs",
        "asOf": AS_OF,
    })
    counts = {k: sum(1 for v in values.values() if v == k) for k in (ML4, ML3, ML3_VACCINES, TWLA_ONLY)}
    print(f"  WHO 藥政成熟度：{len(values)} 國；ML4 {counts[ML4]}、ML3 {counts[ML3]}、ML3 只有疫苗 {counts[ML3_VACCINES]}、只在過渡期名單 {counts[TWLA_ONLY]}")
