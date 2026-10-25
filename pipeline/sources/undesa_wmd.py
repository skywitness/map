"""UN DESA Population Division, World Marriage Data 2019（POP/DB/Marr/Rev2019，CC BY 3.0 IGO，寫在 Excel 的 INFORMATION NOTE）。

232 個國家或地區、約 1950–2019 年，來自普查、抽樣調查（DHS、MICS…）與各國依戶籍、人口登記的估計。用到三張工作表：
- SMAM：單身平均結婚年齡（singulate mean age at marriage），依各年齡的未婚比例推算（Hajnal 的方法），男女分開。
- CURRENTLY MARRIED：各年齡組目前有配偶的比例（%），部分國家含同居（consensual union）。
- EVER_MARRIED：各年齡組曾經結婚的比例（%）；100 減掉它就是未婚比例。

同一國同一年常有好幾筆（同一次 DHS 的 STATcompiler 與家戶檔各算一次、同一年的普查與調查），依 _rank() 取一筆：
普查優先，其次是依登記的估計，最後才是抽樣調查；同一類再依資料來源的順序。年份用資料蒐集開始的那一年（YearStart）。
台灣在這裡是「China, Taiwan Province of China」（158，只有美國普查局轉載的 1980、1990 年普查等），主題改用內政部的資料。
"""
from __future__ import annotations

from pathlib import Path

import openpyxl

from common import download
from sources.countries import from_numeric

URL = (
    "https://www.un.org/development/desa/pd/sites/www.un.org.development.desa.pd/files/"
    "undesa_pd_2019_wmd_marital_status.xlsx"
)
SEXES = {"Men": "male", "Women": "female"}
PROCESS_RANK = {"Census": 0, "Estimate": 1}
SOURCE_RANK = [
    "National statistics", "UNSD", "Eurostat", "IPUMS", "US Census Bureau", "INED",
    "DHS_STATcompiler", "DHS_HH", "MICS", "MICS_HH",
]
OPEN_END = 999

Group = dict[str, dict[tuple[int, int], float]]  # {'male'/'female': {(起, 迄): %}}


def _path() -> Path:
    return download(URL, "undesa", "wmd-2019-marital-status.xlsx")


def _rank(process: str | None, source: str | None) -> tuple[int, int]:
    p = PROCESS_RANK.get(process or "", 2)
    s = SOURCE_RANK.index(source) if source in SOURCE_RANK else len(SOURCE_RANK)
    return (p, s)


def _sheet(name: str, header: list[str]) -> list[dict[str, object]]:
    wb = openpyxl.load_workbook(_path(), read_only=True, data_only=True)
    rows = wb[name].iter_rows(values_only=True)
    for row in rows:
        if row and row[0] == "Country or area":
            if list(row[: len(header)]) != header:
                raise RuntimeError(f"World Marriage Data 的 {name} 欄位變了：{row[: len(header)]}")
            names = [str(c) for c in row]
            break
    else:
        raise RuntimeError(f"World Marriage Data 的 {name} 找不到表頭")
    out = []
    for row in rows:
        if row and row[0] and isinstance(row[1], (int, float)):
            out.append(dict(zip(names, row)))
    return out


def smam() -> dict[str, dict[str, dict[int, float]]]:
    """{'male'/'female': {iso3: {年: SMAM}}}"""
    best: dict[tuple[str, str, int], tuple[tuple[int, int], float]] = {}
    for r in _sheet("SMAM", ["Country or area", "ISO code", "YearStart", "YearEnd", "Sex", "DataValue"]):
        iso3, sex = from_numeric(int(r["ISO code"])), SEXES.get(str(r["Sex"]))
        if not iso3 or not sex or not isinstance(r["DataValue"], (int, float)):
            continue
        key = (sex, iso3, int(r["YearStart"]))
        rank = _rank(r["DataProcess"], r["Data Source"])
        if key not in best or rank < best[key][0]:
            best[key] = (rank, float(r["DataValue"]))
    out: dict[str, dict[str, dict[int, float]]] = {"male": {}, "female": {}}
    for (sex, iso3, year), (_rank_, v) in best.items():
        out[sex].setdefault(iso3, {})[year] = v
    return out


def by_age(sheet: str) -> dict[tuple[str, int], list[tuple[tuple[int, int], Group]]]:
    """CURRENTLY MARRIED 或 EVER_MARRIED：{(iso3, 年): [(排序, {性別: {(起, 迄): %}}), …]}，同一年的各筆依 _rank() 排好。

    一筆是同一個資料目錄（DataCatalog ID）與同一個資料來源的所有年齡組，呼叫的一方再挑年齡組齊全的那一筆。
    """
    groups: dict[tuple[str, int, object, object], Group] = {}
    ranks: dict[tuple[str, int, object, object], tuple[int, int]] = {}
    header = ["Country or area", "ISO code", "YearStart", "YearEnd", "Sex", "AgeGroup", "AgeStart", "AgeEnd", "DataValue"]
    for r in _sheet(sheet, header):
        iso3, sex = from_numeric(int(r["ISO code"])), SEXES.get(str(r["Sex"]))
        value, start, end = r["DataValue"], r["AgeStart"], r["AgeEnd"]
        if not iso3 or not sex or not all(isinstance(v, (int, float)) for v in (value, start, end)):
            continue
        key = (iso3, int(r["YearStart"]), r["DataCatalog ID"], r["Data Source"])
        groups.setdefault(key, {}).setdefault(sex, {})[(int(start), int(end))] = float(value)
        ranks[key] = _rank(r["DataProcess"], r["Data Source"])
    out: dict[tuple[str, int], list[tuple[tuple[int, int], Group]]] = {}
    for key, group in groups.items():
        out.setdefault(key[:2], []).append((ranks[key], group))
    for candidates in out.values():
        candidates.sort(key=lambda c: c[0])
    return out
