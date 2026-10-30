"""國際勞工組織 ILOSTAT（https://ilostat.ilo.org/），透過 ILO 的 SDMX API 下載整個資料集的 CSV。

- 網址：https://sdmx.ilo.org/rest/data/ILO,DF_<資料集>,1.0/all?format=csv（資料集代碼是 ILOSTAT 的代碼去掉
  結尾的 _A，例如 EAR_INEE_CUR_NB_A → DF_EAR_INEE_CUR_NB；資料集清單 https://sdmx.ilo.org/rest/dataflow/ILO ）。
  原本用 rplumber API（rplumber.ilo.org），2026-10-30 起回 HTTP 200 但內容是空的，改用這裡（製作手冊第八批 147）。
  ilostat.ilo.org 本身有 Cloudflare 驗證，不用。
- 欄位：REF_AREA（ISO alpha-3；X01 是世界、X02… 是各區域與所得組）、SEX（SEX_T 是男女合計）、分類維度
  （例如貨幣 CUR：CUR_TYPE_LCU／USD／PPP；年齡 AGE；出生地 CBR）、TIME_PERIOD、OBS_VALUE、OBS_STATUS（B 序列中斷、
  U 不可靠、R 實際值）、NOTE_INDICATOR、NOTE_SOURCE。附註是文字（多個用「 | 」分開，例如
  「Central tendency measure: Median」），rplumber 是代碼（T8:128），程式裡沿用代碼，用 NOTE_LABELS 對照。
  `rows()` 把每一列換成 rplumber 的欄位名稱（ref_area、sex、classif1、classif2、time、obs_value、obs_status、
  note_indicator、note_source），分類維度依欄位順序是 classif1、classif2。
- ILOSTAT 標為不可靠（U）的值不收（例如馬爾他 2021 年的月薪一下子比前一年高 53%）。
- 年資料每個國家、每年只有一個來源（ILOSTAT 已經挑好主要序列）。
- 授權：2023 年 5 月 3 日起 ILO 的資料庫與資料集是 CC BY 4.0（https://www.ilo.org/rights-and-permissions）。
- 台灣不是 ILO 會員，ILOSTAT 沒有台灣。
"""
from __future__ import annotations

import csv
import functools
import time
import urllib.error

from common import download
from sources.countries import to_iso3

API = "https://sdmx.ilo.org/rest/data/ILO,DF_{id},1.0/all?format=csv"
WORLD = "X01"
UNRELIABLE = "U"
# rplumber 的附註代碼 → SDMX 的附註文字
NOTE_LABELS = {
    "T8:128": "Central tendency measure: Median",
    "S4:31": "Geographical coverage: Urban areas only",
    "S4:33": "Geographical coverage: Main cities or metropolitan areas",
    "S4:6333": "Geographical coverage: Excluding Gaza Strip",
}
# 不是分類維度的欄位
_FIXED = {"DATAFLOW", "REF_AREA", "FREQ", "MEASURE", "SEX", "TIME_PERIOD"}

Series = dict[str, dict[int, float]]


@functools.cache
def rows(dataset: str) -> list[dict[str, str]]:
    """資料集的每一列，欄位換成 rplumber 的名稱（見上面）。dataset 是 ILOSTAT 的代碼（結尾 _A）。
    同一次執行只讀一次（--refresh 時也只下載一次；sdmx.ilo.org 短時間重複下載會回 403）。"""
    flow = dataset.removesuffix("_A")
    for attempt in range(4):
        try:
            path = download(API.format(id=flow), "ilostat", f"{flow}.csv")
            break
        except urllib.error.HTTPError as e:
            # sdmx.ilo.org 偶爾回 403（2026-10-30，同一個網址過幾秒再試就好），等一下再試，最多 4 次
            if e.code != 403 or attempt == 3:
                raise
            time.sleep(15 * (attempt + 1))
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or "OBS_VALUE" not in reader.fieldnames:
            path.unlink()  # 空檔或錯誤訊息不要留在快取裡
            raise RuntimeError(f"ILOSTAT {dataset} 的內容不是預期的 CSV，API 可能改了")
        classifs = [c for c in reader.fieldnames[: reader.fieldnames.index("TIME_PERIOD")] if c not in _FIXED]
        out = []
        for row in reader:
            if row["FREQ"] != "A":  # 有些資料集也有月、季資料（TIME_PERIOD 2021-M01），只收年資料
                continue
            r = {
                "ref_area": row["REF_AREA"], "time": row["TIME_PERIOD"], "obs_value": row["OBS_VALUE"],
                "obs_status": row["OBS_STATUS"], "note_indicator": row["NOTE_INDICATOR"], "note_source": row["NOTE_SOURCE"],
            }
            if "SEX" in row:
                r["sex"] = row["SEX"]
            for i, c in enumerate(classifs, 1):
                r[f"classif{i}"] = row[c]
            out.append(r)
    if not out:
        raise RuntimeError(f"ILOSTAT {dataset} 沒有資料")
    return out


def fetch(dataset: str, classif: str | None = None) -> tuple[Series, dict[int, float]]:
    """回傳 (各國 {iso3: {year: value}}, 世界 {year: value})。

    有 sex 欄的資料集只取男女合計；classif 指定 classif1 的值（例如 'CUR_TYPE_USD'）。
    世界值只有部分資料集有（工時的 X01 是 ILO 的模型估計）。
    """
    return fetch_sexes(dataset, classif)["SEX_T"]


def _has_note(text: str, note: str) -> bool:
    return NOTE_LABELS[note] in text.split(" | ")


def flagged(dataset: str, note: str) -> dict[str, list[int]]:
    """男女合計的值裡，note_indicator 含某個附註（代碼見 NOTE_LABELS，例如 'T8:128' 中位數）的 {iso3: [年份]}。"""
    out: dict[str, set[int]] = {}
    for row in rows(dataset):
        if row.get("sex", "SEX_T") != "SEX_T" or not row["obs_value"]:
            continue
        if _has_note(row["note_indicator"], note) and (iso3 := to_iso3(row["ref_area"])):
            out.setdefault(iso3, set()).add(int(row["time"]))
    return {iso3: sorted(years) for iso3, years in out.items()}


def fetch_sexes(dataset: str, classif: str | None = None) -> dict[str, tuple[Series, dict[int, float]]]:
    """跟 fetch() 一樣，但一次取男女合計與男、女：{'SEX_T' | 'SEX_M' | 'SEX_F': (各國, 世界)}。"""
    out: dict[str, tuple[Series, dict[int, float]]] = {sex: ({}, {}) for sex in ("SEX_T", "SEX_M", "SEX_F")}
    for row in rows(dataset):
        sex = row.get("sex", "SEX_T")
        if sex not in out or (classif and row.get("classif1") != classif):
            continue
        if not row["obs_value"] or row.get("obs_status") == UNRELIABLE:
            continue
        countries, world = out[sex]
        year, value = int(row["time"]), float(row["obs_value"])
        if row["ref_area"] == WORLD:
            world[year] = value
        elif iso3 := to_iso3(row["ref_area"]):  # X02… 區域合計、已解散的 ANT 會被略過
            countries.setdefault(iso3, {})[year] = value
    return out


def real_years(dataset: str, classif: str | None = None) -> dict[str, list[int]]:
    """ILO 模型估計（ILOEST）裡，男女合計的值標為「實際值」（obs_status R，依各國申報的資料）的 {iso3: [年份]}。

    其他年份是模型推算的（沒有申報、或還沒有那一年的資料）。
    """
    out: dict[str, set[int]] = {}
    for row in rows(dataset):
        if row.get("sex", "SEX_T") != "SEX_T" or (classif and row.get("classif1") != classif):
            continue
        if row.get("obs_status") == "R" and (iso3 := to_iso3(row["ref_area"])):
            out.setdefault(iso3, set()).add(int(row["time"]))
    return {iso3: sorted(years) for iso3, years in out.items()}


def flagged_source(dataset: str, note: str) -> dict[str, list[int]]:
    """跟 flagged() 一樣，但看的是來源的附註 note_source（例如 'S4:31' 只涵蓋都市地區）。"""
    out: dict[str, set[int]] = {}
    for row in rows(dataset):
        if row.get("sex", "SEX_T") != "SEX_T" or not row["obs_value"]:
            continue
        if _has_note(row["note_source"], note) and (iso3 := to_iso3(row["ref_area"])):
            out.setdefault(iso3, set()).add(int(row["time"]))
    return {iso3: sorted(years) for iso3, years in out.items()}
