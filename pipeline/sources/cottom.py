"""Cottom, Cook & Velis (2024) 的塑膠污染排放清冊（SPOT 模型 V1.1.0-G-1223，2020 年，模型估計值）。

Cottom, J.W., Cook, E. & Velis, C.A. A local-to-global emissions inventory of macroplastic pollution.
Nature 633, 101–108 (2024). https://doi.org/10.1038/s41586-024-07758-6（論文 CC BY 4.0）

- 資料：Dryad https://doi.org/10.5061/dryad.8cz8w9gxb（Dryad 的資料一律 CC0 1.0，API 的 license 欄位寫
  https://spdx.org/licenses/CC0-1.0.html，2026-10-26 查）。整包 1.45 GB 的 zip；Dryad 的下載網址擋程式
  （file_stream 回 403，API 的下載要 bearer token），所以改用 Our World in Data 從 Dryad 下載後放在自己公開快照庫的
  同一批檔（OWID ETL 的 snapshots/plastic_waste/2026-01-14/cottom_plastic_waste.zip.dvc 寫明來源是 Dryad 的
  file_stream/3338334，md5 09514d217fdd2aed5d4a827fd490c135），只含 SD_03（各國）與 SD_04（世界、區域）兩個 Excel。
  依內容定址（網址就是 md5），下載後核對 md5，不一樣就報錯。
- 只算城市固體廢棄物（家戶、商店、辦公室等的一般垃圾）裡大於 5 mm 的塑膠（macroplastic），2020 年一年；
  不含生產過程、紡織品、漁具等海上來源、電子廢棄物，也不含出口成廢料後在別國流失的。
- 「排放」是塑膠從有管理或沒管理的系統跑到環境裡：碎片（debris，沒燒掉、以實體留在環境）加上露天焚燒
  （在沒有控制的火裡燒掉）。來源分五類：未收集的垃圾、亂丟的垃圾（litter）、收集與運輸過程的掉落、
  沒有控制的棄置場（露天垃圾場）、回收分選的殘渣（正式與非正式回收）。
- 各國是 5 萬多個城市的機率模型（5,000 次）加總，表上有平均、5、25、50、75、95 百分位數；這裡用平均，
  側欄另外寫 5–95 百分位數（90% 區間）。
- 國家代碼是 ISO3，科索沃寫 XKO；北賽普勒斯（XNC）、阿克羅提利與德凱利亞（XAD）、西沙群島（XPI）沒有 ISO 代碼，
  地圖上也沒有，不收（只在世界合計裡）。
"""
from __future__ import annotations

import hashlib
import io
import zipfile
from dataclasses import dataclass, field

import openpyxl

from common import download
from sources.countries import to_iso3

URL = "https://snapshots.owid.io/09/514d217fdd2aed5d4a827fd490c135"
MD5 = "09514d217fdd2aed5d4a827fd490c135"
DRYAD = "https://doi.org/10.5061/dryad.8cz8w9gxb"
PAPER = "https://doi.org/10.1038/s41586-024-07758-6"
CITATION = (
    "Cottom, J.W., Cook, E. & Velis, C.A. A local-to-global emissions inventory of macroplastic pollution. "
    "Nature 633, 101–108 (2024). Data: Dryad, doi:10.5061/dryad.8cz8w9gxb (CC0 1.0)."
)
YEAR = 2020
NATIONAL = "files of interest/SD_03_Cottom_et_al_V1.1.0-G-1223_SPOT_MFA_Outputs_National.xlsx"
REGIONAL = "files of interest/SD_04_Cottom_et_al_V1.1.0-G-1223_SPOT_MFA_Outputs_Global_Regional_Income.xlsx"
SHEET = "03_Outputs"
ALIASES = {"XKO": "XKX"}
NO_ISO = {"XNC", "XAD", "XPI"}  # 北賽普勒斯、阿克羅提利與德凱利亞、西沙群島

# 用到的欄位（03a_Outputs_legend）：t·y⁻¹ 是公噸／年，per_cap 的排放是 kg·cap⁻¹·y⁻¹，產生量的 per_cap 是 kg·cap⁻¹·d⁻¹
FIELDS = [
    "Population_2020",
    "wg",  # 一般垃圾（MSW）產生量
    "pwg",  # 其中的塑膠
    "pwg_per_cap",  # kg/人/日
    "col_cov_pct_gen_exc_lit",  # 收集服務涵蓋率（% 產生量，不含沒收集的亂丟垃圾）
    "man_cont_pct_gen",  # 在有控制的設施處理（SDG 11.6.1，% 產生量）
    "open_burn_MSW_pct_gen",  # 露天焚燒的垃圾（% 產生量）
    "plas_em",
    "plas_debris_em",
    "plas_burn_em",
    "plas_em_per_cap",
    "plas_debris_em_per_cap",
    "plas_burn_em_per_cap",
    "plas_litter_em",
    "plas_uncol_em",
    "plas_collection_em",
    "plas_disp_em",
    "plas_recy_em",
    "people_no_col",
    "people_no_col_pct_pop",
]
STATS = {"Mean": "mean", "5th percentile": "p5", "95th percentile": "p95"}


@dataclass
class Inventory:
    # {統計量（mean、p5、p95）: {iso3: {欄位: 值}}}
    countries: dict[str, dict[str, dict[str, float]]] = field(default_factory=dict)
    # 世界（SD_04 的 World）：{統計量: {欄位: 值}}
    world: dict[str, dict[str, float]] = field(default_factory=dict)


def _rows(z: zipfile.ZipFile, member: str) -> tuple[dict[str, int], list[tuple]]:
    wb = openpyxl.load_workbook(io.BytesIO(z.read(member)), read_only=True, data_only=True)
    rows = list(wb[SHEET].iter_rows(values_only=True))
    header = {h: i for i, h in enumerate(rows[1]) if h}  # 第一列是單位，第二列是欄位名稱
    missing = [f for f in FIELDS if f not in header]
    if missing:
        raise RuntimeError(f"{member} 沒有欄位 {missing}，SPOT 的輸出格式可能變了")
    return header, rows[2:]


def inventory() -> Inventory:
    path = download(URL, "cottom", "cottom_plastic_waste.zip")
    digest = hashlib.md5(path.read_bytes()).hexdigest()
    if digest != MD5:
        raise RuntimeError(f"{path.name} 的 MD5 是 {digest}，跟 OWID 快照的 {MD5} 不同（檔案不完整或被換掉）")
    inv = Inventory()
    with zipfile.ZipFile(path) as z:
        header, rows = _rows(z, NATIONAL)
        for row in rows:
            stat = STATS.get(row[header["Statistic"]])
            if not stat:
                continue
            code = str(row[header["ISO3"]]).strip()
            if code in NO_ISO:
                continue
            iso3 = to_iso3(ALIASES.get(code, code))
            if not iso3:
                raise RuntimeError(f"SPOT 的國家代碼 {code}（{row[header['Country']]}）對不到 ISO")
            inv.countries.setdefault(stat, {})[iso3] = {f: float(row[header[f]] or 0) for f in FIELDS}
        header, rows = _rows(z, REGIONAL)
        for row in rows:
            stat = STATS.get(row[header["Statistic"]])
            if stat and row[header["Aggregation_lv1"]] == "World":
                inv.world[stat] = {f: float(row[header[f]] or 0) for f in FIELDS}
    if len(inv.countries.get("mean", {})) < 200 or "mean" not in inv.world:
        raise RuntimeError("SPOT 的輸出讀到的國家太少或沒有世界合計，格式可能變了")
    return inv
