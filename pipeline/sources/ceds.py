"""CEDS（Community Emissions Data System，美國太平洋西北國家實驗室 PNNL）v_2025_03_18：化石燃料燃燒的二氧化碳
用在哪裡（發電、工業、運輸、住商…），各國，到 2023 年。

- Zenodo：https://doi.org/10.5281/zenodo.15059443（CC BY 4.0，不必登入），用 CEDS_v_2025_03_18_aggregate.zip
  裡的 CO2_CEDS_estimates_by_country_sector_v_2025_03_18.csv（千公噸 CO₂，1750–2023 年，小寫的 ISO alpha-3）。
  Zenodo 下載常常中途斷線，common.download() 失敗時用 curl -C - 續傳到 .cache/ceds/。
- 只用來算「燃料燃燒的二氧化碳在各用途的比例」：CEDS 的總量跟 Global Carbon Project 不同（台灣 2023 年 CEDS
  2.95 億公噸、GCP 2.67 億公噸、環境部清冊 2.67 億公噸），所以側欄只寫比例，不跟 GCP 的總量混在一起。
- 為什麼不用 EDGAR 的部門：EDGAR 的燃料燃燒 CO₂ 是 IEA-EDGAR CO₂，CC BY-NC-ND 4.0（禁止改作），見 edgar.py。
- 國際航空、航運只有全球（global），不算在各國；「srb (kosovo)」是科索沃。
"""
from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict

from common import download
from sources.countries import to_iso3

URL = "https://zenodo.org/api/records/15059443/files/CEDS_v_2025_03_18_aggregate.zip/content"
DOI = "https://doi.org/10.5281/zenodo.15059443"
MEMBER = "CEDS_v_2025_03_18_aggregate/CO2_CEDS_estimates_by_country_sector_v_2025_03_18.csv"
FIRST_YEAR = 1970

# CEDS 的燃料燃燒部門 → 用途（完整比對部門名稱；1A3ai、1A3di 的國際航空、航運只出現在 global）
USES = {
    "1A1a_Electricity-public": "power",
    "1A1a_Electricity-autoproducer": "power",
    "1A1a_Heat-production": "power",
    "1A1bc_Other-transformation": "energy",  # 煉油、煉焦等能源業自用
    "1A3aii_Domestic-aviation": "transport",
    "1A3b_Road": "transport",
    "1A3c_Rail": "transport",
    "1A3dii_Domestic-navigation": "transport",
    "1A3eii_Other-transp": "transport",
    "1A4a_Commercial-institutional": "buildings",
    "1A4b_Residential": "buildings",
    "1A4c_Agriculture-forestry-fishing": "other",
    "1A5_Other-unspecified": "other",
}
USE_KEYS = ["power", "energy", "industry", "transport", "buildings", "other"]


def combustion_by_use() -> dict[str, dict[str, dict[int, float]]]:
    """{iso3: {用途: {年: 公噸 CO₂}}}，1970 年起；製造業各細項（1A2…）都算工業"""
    path = download(URL, "ceds", "CEDS_v_2025_03_18_aggregate.zip")
    out: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    with zipfile.ZipFile(path) as z, z.open(MEMBER) as raw:
        for row in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8", newline="")):
            sector = row["sector"]
            use = USES.get(sector) or ("industry" if sector.startswith("1A2") else None)
            code = row["country"]
            iso3 = "XKX" if code == "srb (kosovo)" else to_iso3(code)
            if use is None or iso3 is None:
                continue
            for col, value in row.items():
                if col.startswith("X") and int(col[1:]) >= FIRST_YEAR and value:
                    out[iso3][use][int(col[1:])] += float(value) * 1000  # 千公噸 → 公噸
    return {iso3: {k: dict(v) for k, v in uses.items()} for iso3, uses in out.items()}
