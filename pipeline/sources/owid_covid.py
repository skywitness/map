"""Our World in Data 的 COVID-19 資料（CC BY 4.0）：確診死亡、疫苗接種。

- **compact.csv**（https://catalog.ourworldindata.org/garden/covid/latest/compact/compact.csv ，約 180 MB）：
  OWID 的 ETL 在 GitHub 的 covid-19-data 封存（2024-08-19 最後更新）以後接手更新的版本，2026-10 下載的檔案是 2026-10-02。
  - 確診死亡（`total_deaths_per_million`）：WHO COVID-19 dashboard 的各國通報數（data.who.int 的資料集是 CC BY 4.0），
    每週一筆，到 2026-08-30。WHO 的 dashboard 沒有台灣。
  - 疫苗接種（`people_vaccinated_per_hundred` 至少打了一劑、`people_fully_vaccinated_per_hundred` 完成基礎劑）：
    OWID 自己從各國官方公布的數字整理的，最後一筆是 2024-08-12（多數國家 2023 年就停止公布）。含台灣（到 2023-09-24，
    來源是疾管署）。分母是聯合國 WPP 2024 的人口。
- **JHU CSSE 的累計死亡**（OWID 封存的 covid-19-data 裡的 `public/data/jhu/total_deaths.csv`，CC BY 4.0）：只用台灣。
  JHU 的台灣是疾管署（中央流行疫情指揮中心）每天公布的累計死亡，到 2023-02-22（指揮中心 2 月 23 日起不再每天公布明細）。

OWID 的代碼：OWID_WRL 是世界、OWID_KOS 是科索沃，其他 OWID_ 開頭的（各洲、所得組、北賽普勒斯）不用。
"""
from __future__ import annotations

import csv
from dataclasses import dataclass, field

from common import download
from sources.countries import to_iso3

COMPACT_URL = "https://catalog.ourworldindata.org/garden/covid/latest/compact/compact.csv"
# 封存的 GitHub 版本（最後一個 commit，2026-03-23 加上封存說明）
JHU_URL = (
    "https://raw.githubusercontent.com/owid/covid-19-data/dc00e7296b17ab5548092c9e388b6fac6751f095/"
    "public/data/jhu/total_deaths.csv"
)
CODES = {"OWID_WRL": "WLD", "OWID_KOS": "XKX"}
FIELDS = {
    "deaths": "total_deaths_per_million",
    "death_count": "total_deaths",
    "vaccinated": "people_vaccinated_per_hundred",
    "fully": "people_fully_vaccinated_per_hundred",
}


@dataclass
class Covid:
    """一個國家（或世界）每個日期（'2021-06-30'）的值"""

    deaths: dict[str, float] = field(default_factory=dict)  # 累計確診死亡，每百萬人
    death_count: dict[str, float] = field(default_factory=dict)  # 累計確診死亡，人
    vaccinated: dict[str, float] = field(default_factory=dict)  # 至少打了一劑，占人口 %
    fully: dict[str, float] = field(default_factory=dict)  # 完成基礎劑，占人口 %


def compact() -> dict[str, Covid]:
    """{iso3 或 'WLD': Covid}"""
    path = download(COMPACT_URL, "owid-covid", "compact.csv")
    out: dict[str, Covid] = {}
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        missing = [c for c in [*FIELDS.values(), "code", "date"] if c not in (reader.fieldnames or [])]
        if missing:
            raise RuntimeError(f"OWID 的 COVID 資料少了欄位 {missing}")
        for row in reader:
            code = CODES.get(row["code"]) or to_iso3(row["code"])
            if not code:
                continue
            entry = out.setdefault(code, Covid())
            for name, col in FIELDS.items():
                if row[col]:
                    getattr(entry, name)[row["date"]] = float(row[col])
    if "TWN" not in out or "WLD" not in out:
        raise RuntimeError("OWID 的 COVID 資料沒有台灣或世界")
    return out


def jhu_deaths(names: tuple[str, ...] = ("Taiwan", "China", "Hong Kong", "Macao")) -> dict[str, dict[str, float]]:
    """JHU CSSE 的累計確診死亡：{'Taiwan' 等: {日期: 人}}。JHU 的 China 只有中國大陸，香港、澳門、台灣分開列；
    台灣是疾管署每天公布的數字，到 2023-02-22"""
    path = download(JHU_URL, "owid-covid", "jhu-total-deaths.csv")
    out: dict[str, dict[str, float]] = {n: {} for n in names}
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            for n in names:
                if row.get(n):
                    out[n][row["date"]] = float(row[n])
    if not all(out.values()):
        raise RuntimeError(f"JHU 的累計死亡少了 {[n for n, s in out.items() if not s]}")
    # JHU 停止更新以後一直重複最後一個值（台灣 2023-02-23 起），只留到最後一次有變化的那天
    for n, s in out.items():
        dates = sorted(s)
        while len(dates) > 1 and s[dates[-1]] == s[dates[-2]]:
            del s[dates.pop()]
    return out
