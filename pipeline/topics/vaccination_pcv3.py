"""疫苗與防疫的擴充（第十四批順序 261，P24，2026-10-31）：結合型肺炎鏈球菌疫苗第三劑（PCV3）的接種率。

**資料**：WHO 資料平臺（data.who.int）的 PCV3 指標（https://data.who.int/indicators/i/4B4DAF2/D45F91C ），整份 CSV
`https://srhdpeuwpubsa.blob.core.windows.net/whdh/DATADOT/INDICATOR/D45F91C_ALL_LATEST.csv`（2008–2024 年；地區用
M49 數字代碼，GLOBAL 是世界值）。WHO/UNICEF 的估計，1 歲幼兒打完第三劑的比例（還沒有把 PCV 納入常規接種的國家是 0）。
**授權**：指標頁的「Data copyright and licensing」寫 CC BY 4.0，另有附加條款（爭議先調解再仲裁、禁止去匿名化、禁止扭曲內容、
禁止暗示 WHO 背書），跟網站已經用的 DTP3、MCV2 同一套（2026-10-30 規劃 session 讀）。

**台灣**：WHO 沒有台灣。照第〇節的規則用疾管署的預防接種完成率補：`pipeline/data/cdc/immunization-coverage-2024.csv`
（疾管署 data.gov.tw 24457，2024 年各縣市的「結合型肺炎鏈球菌疫苗第三劑（完成率）」）依各縣市 1 歲戶籍人口加權成全國值
（方法同麻疹第二劑，`sources/cdc_tw.county_weighted`；第三劑在 12–15 個月大時接種）。2022、2023 年的檔 od.cdc.gov.tw
連不上（本機與使用者的瀏覽器也連不上，使用者決定先不做），2025 年資料集沒有，所以只有 2024 年。

**輸出**：public/data/topics/vaccination/pcv3.json。
"""
from __future__ import annotations

import csv

from common import OUT_DIR, download, indicator_file, to_series, write_json
from sources import cdc_tw
from sources.countries import from_numeric

OUT = OUT_DIR / "topics" / "vaccination"
URL = "https://srhdpeuwpubsa.blob.core.windows.net/whdh/DATADOT/INDICATOR/D45F91C_ALL_LATEST.csv"
PCV3_COLUMN = "結合型肺炎鏈球菌疫苗第三劑（完成率）"
WEIGHT_AGE = 1  # 第三劑在 12–15 個月大時接種


def build() -> None:
    with open(download(URL, "who-datadot", "D45F91C_ALL_LATEST.csv"), encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    countries: dict[str, dict[int, float]] = {}
    world: dict[int, float] = {}
    unmatched = set()
    for r in rows:
        year, value = int(r["DIM_TIME"]), float(r["RATE_PER_100_N"])
        kind = r["DIM_GEO_CODE_TYPE"]
        if kind == "GLOBAL":
            world[year] = value
        elif kind in ("COUNTRY", "NATIONAL LIBERATION MOVEMENT"):
            iso3 = from_numeric(r["DIM_GEO_CODE_M49"])
            if not iso3:
                unmatched.add((r["DIM_GEO_CODE_M49"], r["GEO_NAME_SHORT"]))
                continue
            countries.setdefault(iso3, {})[year] = value
    if unmatched:
        raise RuntimeError(f"PCV3 對不到的 M49 代碼：{sorted(unmatched)}")
    years = list(range(min(world), max(world) + 1))
    tw = round(cdc_tw.county_weighted(PCV3_COLUMN, WEIGHT_AGE), 2)
    tw_age2 = round(cdc_tw.county_weighted(PCV3_COLUMN, 2), 2)
    if not 90 <= tw <= 100:
        raise RuntimeError(f"台灣自算的 PCV3 {tw}% 看起來不對")
    values = {k: to_series(s, years, 0) for k, s in sorted(countries.items())}
    values["TWN"] = to_series({cdc_tw.COUNTY_YEAR: tw}, years)
    notes = {"TWN": (
        "台灣不在 WHO/UNICEF 的估計裡。疾管署沒有公布全國的結合型肺炎鏈球菌疫苗第三劑完成率，這裡是自算的估計，只有 2024 年："
        "疾管署開放資料「各縣市衛生所及合約醫院診所 2024 年預防接種完成率統計」的 22 個縣市完成率，用內政部 2024 年 12 月底"
        f"各縣市的 1 歲戶籍人口加權（第三劑在 12–15 個月大時接種；用 2 歲人口加權是 {tw_age2}%）。縣市的完成率沒有附分母，"
        "統計對象是衛生所及合約醫院診所。")}
    notes_en = {"TWN": (
        "Taiwan is not in the WHO/UNICEF estimates. Taiwan CDC publishes no national completion rate for the third dose of "
        "pneumococcal conjugate vaccine, so this is an estimate for 2024 only: the completion rates of Taiwan's 22 counties and "
        "cities in Taiwan CDC's open data on immunization coverage at health stations and contracted clinics in 2024, weighted "
        "by each county's registered population aged one at the end of 2024 (the third dose is given at 12–15 months; weighting "
        f"by age two gives {tw_age2}%). The county rates come without denominators.")}
    write_json(OUT / "pcv3.json", indicator_file(
        "pcv3", "%", years, values, aggregates={"WLD": to_series(world, years, 0)}, notes=notes, notesEn=notes_en))
    print(f"  PCV3：{len(countries)} 國，{years[0]}–{years[-1]}，{years[-1]} 年世界 {world[years[-1]]}%；"
          f"台灣 2024 年 {tw}%（2 歲人口加權 {tw_age2}%）")


if __name__ == "__main__":
    build()
