"""EDGAR（歐盟執委會聯合研究中心 JRC 的 Emissions Database for Global Atmospheric Research）2026 年版的
甲烷（CH₄）、氧化亞氮（N₂O）與含氟氣體（F-gases），各國、各部門，1970–2025 年（含氟氣體 1990–2024 年）。

- 資料頁：https://edgar.jrc.ec.europa.eu/dataset_ghg2026（EDGAR_2026_GHG，2026 年 9 月），不必登入。
  用三個年排放檔：EDGAR_CH4_1970_2025.zip、EDGAR_N2O_1970_2025.zip、EDGAR_AR5g_F-gases_1990_2025.zip
  （含氟氣體已經換算成 CO₂ 當量，依 HFC、PFC、SF₆、NF₃ 分；2025 年的欄位是空的，所以到 2024 年）。
  每個 Excel 的「IPCC 2006」工作表是各國 × IPCC 2006 部門代碼 × fossil/bio 的排放量（Gg，也就是千公噸）。
- 授權：資料頁與 Excel 的「Citations and references」寫「Unless otherwise noted, all material owned by the European
  Union is licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) licence」。
  **二氧化碳不用 EDGAR**：EDGAR 的化石燃料燃燒 CO₂ 是「IEA-EDGAR CO₂」，以 IEA 的資料為基礎，另外標
  「licensed under CC BY-NC-ND 4.0」（禁止改作），EDGAR 的溫室氣體合計（EDGAR_AR5_GHG）也含這一塊，
  所以都不用；二氧化碳改用 Global Carbon Project（Our World in Data 轉載，CC BY 4.0，DESIGN.md 第 8 節第 12、14 點）。
- 換算 CO₂ 當量用 IPCC 第五次評估報告（AR5）的 100 年全球暖化潛勢（GWP-100），跟 EDGAR 自己的 GHG 合計一樣：
  化石來源的甲烷 30、生物來源的甲烷 28、氧化亞氮 265。用 EDGAR_AR5_GHG 的各部門反推驗證過：
  畜牧、稻田、掩埋等只有甲烷的部門剛好是 28 倍，化石燃料開採（1.B，不論 fossil、bio 欄）剛好是 30 倍，
  燃料燃燒裡標 bio 的（燒柴等）是 28；農地土壤等只有氧化亞氮的是 265。
- 國家：EDGAR 用 ISO alpha-3，另有 AIR（國際航空）、SEA（國際航運）、ANT（已經解散的荷屬安地列斯）、
  SCG（塞爾維亞與蒙特內哥羅，含科索沃）。幾個國家併在別國計算（EDGAR 沒有單獨列出）：南蘇丹併在蘇丹、
  巴勒斯坦併在以色列、列支敦斯登併在瑞士、摩納哥併在法國、安道爾併在西班牙、聖馬利諾與梵蒂岡併在義大利。
  這裡把 SCG 算在塞爾維亞，人均用這些國家合計的人口（MEMBERS）。AIR、SEA、ANT 只算進世界合計。
- 台灣是「Taiwan_Province of China」（TWN），中國（CHN）只有大陸，香港、澳門各自一國。
"""
from __future__ import annotations

import zipfile
from collections import defaultdict
from dataclasses import dataclass, field

import openpyxl

from common import download
from sources.countries import to_iso3

BASE = "https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/EDGAR/datasets/EDGAR_2026_GHG/"
PAGE = "https://edgar.jrc.ec.europa.eu/dataset_ghg2026"
VERSION = "EDGAR_2026_GHG"
CITATION = (
    "EDGAR (Emissions Database for Global Atmospheric Research) Community GHG Database, EDGAR_2026_GHG (2026), "
    "European Commission, JRC; Crippa, M. et al., GHG emissions of all world countries - 2026 Report, "
    "Publications Office of the European Union, 2026, doi:10.2760/7717504"
)
FILES = {
    "ch4": "EDGAR_CH4_1970_2025",
    "n2o": "EDGAR_N2O_1970_2025",
    "fgas": "EDGAR_AR5g_F-gases_1990_2025",
}
N2O_GWP = 265
# EDGAR 自己的代碼 → 算在哪一國（只算進世界合計的不列）
CODE_TO_ISO3 = {"SCG": "SRB"}
WORLD_ONLY = {"AIR", "SEA", "ANT"}
# EDGAR 併在一起計算的國家：人均要用合計的人口，GCP 的二氧化碳也要合計，全部溫室氣體才一致
MEMBERS = {
    "SDN": ["SDN", "SSD"],
    "ISR": ["ISR", "PSE"],
    "SRB": ["SRB", "MNE", "XKX"],
    "CHE": ["CHE", "LIE"],
    "FRA": ["FRA", "MCO"],
    "ESP": ["ESP", "AND"],
    "ITA": ["ITA", "SMR", "VAT"],
}
# 併進去的國家 → 併在哪一國
MERGED_INTO = {m: host for host, members in MEMBERS.items() for m in members if m != host}

# 部門：IPCC 2006 代碼的開頭 → 這裡的分類（由長到短比對）。前端 ClimatePanel 依這些鍵分組上色
CH4_SECTORS = [
    ("1.A", "combustion"),  # 燃料燃燒（發電、運輸、住宅燒柴…）
    ("1.B", "fugitive"),  # 化石燃料開採的逸散（煤礦、油氣）
    ("5.B", "fugitive"),  # 化石燃料火災（地下煤火）
    ("2.", "industry"),
    ("3.A.1", "enteric"),  # 牲畜腸胃發酵
    ("3.A.2", "manure"),
    ("3.C.7", "rice"),
    ("3.C.1", "burning"),  # 農業廢棄物、生質燃燒
    ("4.D", "wastewater"),
    ("4.", "solidwaste"),  # 掩埋、堆肥、焚化、其他
]
N2O_SECTORS = [
    ("1.A", "combustion"),
    ("1.B", "fugitive"),
    ("5.B", "fugitive"),
    ("2.", "industry"),  # 硝酸、己二酸等化學工業
    ("3.A.2", "manure"),
    ("3.C.6", "manure"),  # 糞尿處理的間接排放
    ("3.C.4", "soils"),  # 農地土壤（施肥等）的直接排放
    ("3.C.5", "soils"),  # 間接排放
    ("3.C.1", "burning"),
    ("4.D", "wastewater"),
    ("4.", "solidwaste"),
    ("5.A", "indirect"),  # 氮氧化物、氨沉降後的間接排放
]
FGAS_SPECIES = {
    "GWP_100_AR5_HFC": "hfc",
    "GWP_100_AR5_PFC": "pfc",
    "GWP_100_AR5_SF6": "sf6",
    "GWP_100_AR5_NF3": "nf3",
}
SECTOR_KEYS = {
    "ch4": sorted({k for _, k in CH4_SECTORS}),
    "n2o": sorted({k for _, k in N2O_SECTORS}),
    "fgas": list(FGAS_SPECIES.values()),
}


def _sector(table: list[tuple[str, str]], code: str) -> str:
    for prefix, key in table:
        if code.startswith(prefix):
            return key
    raise ValueError(f"EDGAR 有沒見過的部門代碼 {code}")


def _ch4_gwp(code: str, fossil_bio: str) -> int:
    """EDGAR 的 AR5 換算：化石來源 30、生物來源 28（見模組說明）"""
    if code.startswith(("1.B", "2.", "5.B")):
        return 30
    if code.startswith("1.A"):
        return 30 if fossil_bio == "fossil" else 28
    return 28


@dataclass
class Emissions:
    """各國、各部門的排放（公噸 CO₂ 當量）"""

    # {氣體: {iso3: {部門鍵: {年: 公噸 CO₂e}}}}
    by_sector: dict[str, dict[str, dict[str, dict[int, float]]]] = field(default_factory=dict)
    # {氣體: {年: 公噸 CO₂e}}，含國際航空、航運與已經解散的荷屬安地列斯
    world: dict[str, dict[int, float]] = field(default_factory=dict)

    def totals(self, gas: str) -> dict[str, dict[int, float]]:
        """{iso3: {年: 公噸 CO₂e}}：各部門加總"""
        out: dict[str, dict[int, float]] = {}
        for iso3, sectors in self.by_sector[gas].items():
            total: dict[int, float] = defaultdict(float)
            for series in sectors.values():
                for y, v in series.items():
                    total[y] += v
            out[iso3] = dict(total)
        return out


def _rows(gas: str):
    name = FILES[gas]
    path = download(BASE + name + ".zip", "edgar", name + ".zip")
    with zipfile.ZipFile(path) as z, z.open(name + ".xlsx") as f:
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        header = None
        for row in wb["IPCC 2006"].iter_rows(values_only=True):
            if header is None:
                if row and row[0] == "IPCC_annex":
                    header = list(row)
                continue
            if row[2] is None:
                continue
            yield dict(zip(header, row))
        wb.close()


def emissions() -> Emissions:
    out = Emissions()
    for gas in FILES:
        by: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
        world: dict[int, float] = defaultdict(float)
        for r in _rows(gas):
            code = r["Country_code_A3"]
            sector_code = r["ipcc_code_2006_for_standard_report"]
            if gas == "ch4":
                key, factor = _sector(CH4_SECTORS, sector_code), _ch4_gwp(sector_code, r["fossil_bio"])
            elif gas == "n2o":
                key, factor = _sector(N2O_SECTORS, sector_code), N2O_GWP
            else:
                key, factor = FGAS_SPECIES[r["Substance"]], 1  # 已經是 CO₂ 當量
            iso3 = None if code in WORLD_ONLY else CODE_TO_ISO3.get(code) or to_iso3(code)
            if iso3 is None and code not in WORLD_ONLY:
                raise ValueError(f"EDGAR 的國家代碼 {code}（{r['Name']}）對不到 ISO")
            for col, value in r.items():
                if not col.startswith("Y_") or value is None:
                    continue
                year, tonnes = int(col[2:]), float(value) * factor * 1000  # Gg → 公噸
                world[year] += tonnes
                if iso3:
                    by[iso3][key][year] += tonnes
        out.by_sector[gas] = {iso3: {k: dict(v) for k, v in sectors.items()} for iso3, sectors in by.items()}
        out.world[gas] = dict(world)
    return out
