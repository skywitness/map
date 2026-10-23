"""世界衛生組織（WHO）的資料。WDI 沒有的指標才直接讀 WHO；兩者都沒有台灣。

授權：data.who.int 的資料集條款是 CC BY 4.0（另加一條爭議先調解、再仲裁的條款），要註明 WHO。

- Global Health Observatory（GHO）OData API（https://ghoapi.azureedge.net/api/<代碼>）：
  糖尿病與肥胖盛行率（NCD-RisC 的年齡標準化估計）、30–70 歲死於四大慢性病的機率。
- Global Health Estimates（GHE）2023 版：各國、各年、各年齡的死因別死亡數，2000–2023 年每年都有。
  從 WHO 自己的 GHE 圖表背後的公開 API（xmart-api-public.who.int/DEX_CMS/GHE_FULL）一年查一次。
  GHE 已經把「症狀、徵候與不明原因」等無法歸類的死因依比例分配到各類，所以各類加總就是全部死亡。
"""
from __future__ import annotations

import json
import urllib.parse

from common import download
from sources.countries import to_iso3

GHO_API = "https://ghoapi.azureedge.net/api/{code}"
GHE_API = "https://xmart-api-public.who.int/DEX_CMS/GHE_FULL"
GHE_YEARS = range(2000, 2024)

# GHE 的死因代碼（DIM_GHECAUSE_CODE）
ALL_CAUSES = 0
COMMUNICABLE = 10  # 傳染病、孕產期、新生兒與營養疾病（第一大類）
NONCOMMUNICABLE = 600  # 非傳染病（第二大類）
INJURIES = 1510  # 傷害（第三大類）
CANCER = 610  # 惡性腫瘤

# 年齡標準化用的 WHO 世界標準人口（2000–2025，每十萬人；85 歲以上合併成一組）。
# 衛福部的標準化死亡率也用這一組，台灣跟其他國家的數字可以直接比。
WHO_STANDARD_POPULATION = {
    "Y0T4": 8860, "Y5T9": 8690, "Y10T14": 8600, "Y15T19": 8470, "Y20T24": 8220, "Y25T29": 7930,
    "Y30T34": 7610, "Y35T39": 7150, "Y40T44": 6590, "Y45T49": 6040, "Y50T54": 5370, "Y55T59": 4550,
    "Y60T64": 3720, "Y65T69": 2960, "Y70T74": 2210, "Y75T79": 1520, "Y80T84": 910, "Y_GE85": 635,
}
# GHE 的未滿 1 歲與 1–4 歲分開列，標準化時合併成 0–4 歲；未滿 28 天、1–11 個月是未滿 1 歲的細分，不用
GHE_AGE_MERGE = {"Y0T1": "Y0T4", "Y1T4": "Y0T4"}


def gho(code: str, dims: dict[str, str]) -> tuple[dict[str, dict[int, float]], dict[int, float]]:
    """GHO 指標，回傳 (各國 {iso3: {年: 值}}, 世界 {年: 值})。dims 例如 {'Dim1': 'SEX_BTSX'}。"""
    path = download(GHO_API.format(code=code), "who", f"{code}.json")
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)["value"]
    countries: dict[str, dict[int, float]] = {}
    world: dict[int, float] = {}
    for row in rows:
        if row["NumericValue"] is None or any(row.get(k) != v for k, v in dims.items()):
            continue
        year, value = int(row["TimeDim"]), float(row["NumericValue"])
        if row["SpatialDimType"] == "GLOBAL":
            world[year] = value
        elif row["SpatialDimType"] == "COUNTRY" and (iso3 := to_iso3(row["SpatialDim"])):
            countries.setdefault(iso3, {})[year] = value
    if not countries:
        raise RuntimeError(f"GHO {code} 讀不到資料（篩選條件 {dims}）")
    return countries, world


def _ghe_url(year: int) -> str:
    # 全年齡的各大類、第二層死因，加上惡性腫瘤的年齡別死亡數與人口（算年齡標準化死亡率用）
    query = (
        f"DIM_YEAR_CODE eq {year} and DIM_SEX_CODE eq 'TOTAL' and ("
        "(DIM_AGEGROUP_CODE eq 'TOTAL' and FLAG_LEVEL le 2) or "
        f"(DIM_GHECAUSE_CODE eq {CANCER} and DIM_AGEGROUP_CODE ne 'D0T27' and DIM_AGEGROUP_CODE ne 'M1T11'))"
    )
    select = "DIM_COUNTRY_CODE,DIM_GHECAUSE_CODE,DIM_AGEGROUP_CODE,VAL_DTHS_COUNT_NUMERIC,ATTR_POPULATION_NUMERIC"
    return f"{GHE_API}?{urllib.parse.urlencode({'$filter': query, '$select': select})}"


class GheYear:
    """一年的 GHE：deaths[iso3][死因代碼] 是全年齡死亡數；cancer_by_age[iso3][年齡組] 是 (死亡數, 人口)。"""

    def __init__(self, year: int):
        path = download(_ghe_url(year), "who", f"ghe-{year}.json")
        with open(path, encoding="utf-8") as f:
            rows = json.load(f)["value"]
        self.deaths: dict[str, dict[int, float]] = {}
        self.cancer_by_age: dict[str, dict[str, tuple[float, float]]] = {}
        for row in rows:
            iso3 = to_iso3(row["DIM_COUNTRY_CODE"])
            if not iso3:
                continue
            cause, age = row["DIM_GHECAUSE_CODE"], row["DIM_AGEGROUP_CODE"]
            deaths = row["VAL_DTHS_COUNT_NUMERIC"] or 0.0
            if age == "TOTAL":
                self.deaths.setdefault(iso3, {})[cause] = deaths
            elif cause == CANCER:
                group = GHE_AGE_MERGE.get(age, age)
                d, p = self.cancer_by_age.setdefault(iso3, {}).get(group, (0.0, 0.0))
                self.cancer_by_age[iso3][group] = (d + deaths, p + (row["ATTR_POPULATION_NUMERIC"] or 0.0))
        if not self.deaths:
            raise RuntimeError(f"GHE {year} 年讀不到資料，API 的格式可能變了")


def age_standardized_rate(by_age: dict[str, tuple[float, float]]) -> float | None:
    """{年齡組: (死亡數, 人口)} → 每十萬人的年齡標準化死亡率（WHO 世界標準人口）。"""
    if set(by_age) != set(WHO_STANDARD_POPULATION) or any(p <= 0 for _d, p in by_age.values()):
        return None
    total = sum(WHO_STANDARD_POPULATION.values())
    return sum(d / p * WHO_STANDARD_POPULATION[age] for age, (d, p) in by_age.items()) / total * 100_000
