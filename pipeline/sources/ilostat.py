"""國際勞工組織 ILOSTAT（https://ilostat.ilo.org/），透過 rplumber API 下載整個資料集的 CSV。

- 網址：https://rplumber.ilo.org/data/indicator/?id=<資料集>&format=.csv&type=code
  資料集代碼可以在 https://rplumber.ilo.org/metadata/toc/indicator?lang=en&format=.csv 查（舊的
  EAR_4MTH_SEX_CUR_NB_A 已經停用，改成 EAR_EMTA_SEX_CUR_NB_A）。
- 沒帶 User-Agent 時伺服器回 HTTP 200 但內容是空的，`common.download()` 已經自帶 User-Agent。
- 欄位：ref_area（ISO alpha-3；X01 是世界、X02… 是各區域與所得組）、source、sex（SEX_T 是男女合計）、
  classif1（例如貨幣 CUR_TYPE_LCU／USD／PPP）、time、obs_value、obs_status（B 序列中斷、U 不可靠）、
  note_indicator（附註代碼，例如 T8:127 平均數、T8:128 中位數）。
  代碼的意思：https://rplumber.ilo.org/metadata/dic/?var=note_indicator&lang=en&format=.csv（var 也可以是 note_source、source）。
- ILOSTAT 標為不可靠（U）的值不收（例如馬爾他 2021 年的月薪一下子比前一年高 53%）。
- 年資料每個國家、每年只有一個來源（ILOSTAT 已經挑好主要序列）。
- 授權：2023 年 5 月 3 日起 ILO 的資料庫與資料集是 CC BY 4.0（https://www.ilo.org/rights-and-permissions）。
- 台灣不是 ILO 會員，ILOSTAT 沒有台灣。
"""
from __future__ import annotations

import csv

from common import download
from sources.countries import to_iso3

API = "https://rplumber.ilo.org/data/indicator/?id={id}&format=.csv&type=code"
WORLD = "X01"
UNRELIABLE = "U"

Series = dict[str, dict[int, float]]


def fetch(dataset: str, classif: str | None = None) -> tuple[Series, dict[int, float]]:
    """回傳 (各國 {iso3: {year: value}}, 世界 {year: value})。

    有 sex 欄的資料集只取男女合計；classif 指定 classif1 的值（例如 'CUR_TYPE_USD'）。
    世界值只有部分資料集有（工時的 X01 是 ILO 的模型估計）。
    """
    path = download(API.format(id=dataset), "ilostat", f"{dataset}.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or "obs_value" not in reader.fieldnames:
            path.unlink()  # 空檔或錯誤訊息不要留在快取裡
            raise RuntimeError(f"ILOSTAT {dataset} 的內容不是預期的 CSV，API 可能改了")
        countries: Series = {}
        world: dict[int, float] = {}
        for row in reader:
            if row.get("sex", "SEX_T") != "SEX_T" or (classif and row.get("classif1") != classif):
                continue
            if not row["obs_value"] or row.get("obs_status") == UNRELIABLE:
                continue
            year, value = int(row["time"]), float(row["obs_value"])
            if row["ref_area"] == WORLD:
                world[year] = value
            elif iso3 := to_iso3(row["ref_area"]):  # X02… 區域合計、已解散的 ANT 會被略過
                countries.setdefault(iso3, {})[year] = value
    return countries, world


def flagged(dataset: str, note: str) -> dict[str, list[int]]:
    """男女合計的值裡，note_indicator 含某個附註代碼的 {iso3: [年份]}（例如 'T8:128' 中位數）。用 fetch() 下載過的快取。"""
    path = download(API.format(id=dataset), "ilostat", f"{dataset}.csv")
    out: dict[str, set[int]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row.get("sex", "SEX_T") != "SEX_T" or not row["obs_value"]:
                continue
            if note in row.get("note_indicator", "").split("_") and (iso3 := to_iso3(row["ref_area"])):
                out.setdefault(iso3, set()).add(int(row["time"]))
    return {iso3: sorted(years) for iso3, years in out.items()}


def fetch_sexes(dataset: str, classif: str | None = None) -> dict[str, tuple[Series, dict[int, float]]]:
    """跟 fetch() 一樣，但一次取男女合計與男、女：{'SEX_T' | 'SEX_M' | 'SEX_F': (各國, 世界)}。用同一個下載快取。"""
    path = download(API.format(id=dataset), "ilostat", f"{dataset}.csv")
    out: dict[str, tuple[Series, dict[int, float]]] = {sex: ({}, {}) for sex in ("SEX_T", "SEX_M", "SEX_F")}
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or "obs_value" not in reader.fieldnames:
            path.unlink()
            raise RuntimeError(f"ILOSTAT {dataset} 的內容不是預期的 CSV，API 可能改了")
        for row in reader:
            sex = row.get("sex", "SEX_T")
            if sex not in out or (classif and row.get("classif1") != classif):
                continue
            if not row["obs_value"] or row.get("obs_status") == UNRELIABLE:
                continue
            countries, world = out[sex]
            year, value = int(row["time"]), float(row["obs_value"])
            if row["ref_area"] == WORLD:
                world[year] = value
            elif iso3 := to_iso3(row["ref_area"]):
                countries.setdefault(iso3, {})[year] = value
    return out


def real_years(dataset: str, classif: str | None = None) -> dict[str, list[int]]:
    """ILO 模型估計（ILOEST）裡，男女合計的值標為「實際值」（obs_status R，依各國申報的資料）的 {iso3: [年份]}。

    其他年份是模型推算的（沒有申報、或還沒有那一年的資料）。用 fetch() 下載過的快取。
    """
    path = download(API.format(id=dataset), "ilostat", f"{dataset}.csv")
    out: dict[str, set[int]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row.get("sex", "SEX_T") != "SEX_T" or (classif and row.get("classif1") != classif):
                continue
            if row.get("obs_status") == "R" and (iso3 := to_iso3(row["ref_area"])):
                out.setdefault(iso3, set()).add(int(row["time"]))
    return {iso3: sorted(years) for iso3, years in out.items()}


def flagged_source(dataset: str, note: str) -> dict[str, list[int]]:
    """跟 flagged() 一樣，但看的是來源的附註 note_source（例如 'S4:31' 只涵蓋都市地區）。"""
    path = download(API.format(id=dataset), "ilostat", f"{dataset}.csv")
    out: dict[str, set[int]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row.get("sex", "SEX_T") != "SEX_T" or not row["obs_value"]:
                continue
            if note in row.get("note_source", "").split("_") and (iso3 := to_iso3(row["ref_area"])):
                out.setdefault(iso3, set()).add(int(row["time"]))
    return {iso3: sorted(years) for iso3, years in out.items()}
