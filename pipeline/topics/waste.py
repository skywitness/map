"""都市垃圾（2026-11-04，主題盤點的擴4，併在「廢棄物與回收」主題；前端 src/topics/waste.ts 讀 ../waste/）。

資料：World Bank, What a Waste 3.0 的國家資料檔（What_a_Waste_3.0_COUNTRY_Dataset_&_Codebook.xlsx，2026 年 3 月，
https://datacatalog.worldbank.org/search/dataset/0039597 ），檔案的 Info 頁寫「© March 2026 by World Bank Group, made available
under a Creative Commons license CC BY-4.0」，建議的引用：Cook, Ed, Ionkova, Kremena, Bhada-Tata, Perinaz, Yadav, Sonakshi, and
Van Woerden, Frank. 2026. What a Waste 3.0. Country dataset。217 國含台灣（環境部的資料，2023 年）。
- 每人每天的都市垃圾（kg）、一年的都市垃圾（公噸）：各國自己報的那一年（2007–2024 年，「MSW generation - year reported」）。
- 處理方式占產生量的比例（% weight MSW generated）：回收（含堆肥、厭氧消化）、焚化、掩埋（衛生、控制、未說明）、
  露天傾倒與沒有收集。年份是 Codebook 裡這幾項的「date_of_measurement」（2003–2025 年，各國不同）。
  處理方式只有各國有報的那幾項：報的項目加起來不到 95% 的國家不算（缺的部分不知道去哪裡），「其他」與「不明」加起來
  三成以上的也不算（例如印度）；其他國家沒報的項目當成 0（例如巴西沒有焚化）。中國沒有報回收：資料只算正式
  處理的都市垃圾，拾荒、資源回收業收走的不在裡面；回收、堆肥、厭氧消化一項都沒報的國家，回收的比例當成沒有資料（不是 0）。

各國的資料年份不同，所以指標都不分年份（timeless），每個國家的附註寫資料年份。
"""
from __future__ import annotations

from collections import defaultdict

import openpyxl

from common import OUT_DIR, download, indicator_file, now_iso, write_json

URL = "https://datacatalogfiles.worldbank.org/ddh-published/0039597/DR0095901/What_a_Waste_3.0_COUNTRY_Dataset_&_Codebook.xlsx"
OUT = OUT_DIR / "topics" / "waste"
# 不分年份的指標檔用一個欄位（前端 timeless，不顯示年份）
YEAR = 2024

GEN_YEAR, GEN_TONNES, GEN_KG = 7, 8, 10
TREATMENT = {
    "open": 55, "controlled": 56, "sanitary": 57, "landfill": 58, "anaerobic": 59, "compost": 60, "recycling": 61,
    "incineration": 62, "mbt": 63, "rdf": 64, "other": 65, "uncollected": 66, "unaccounted": 67,
}
GROUPS = {
    "waste-recycled": ("recycling", "compost", "anaerobic"),
    "waste-incinerated": ("incineration",),
    "waste-landfilled": ("controlled", "sanitary", "landfill"),
    "waste-dumped": ("open", "uncollected"),
}


def _num(v: object) -> float | None:
    try:
        return float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def build() -> None:
    path = download(URL, "worldbank-waw", "What_a_Waste_3.0_COUNTRY.xlsx")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = list(wb["Country dataset"].iter_rows(values_only=True))
    if rows[1][GEN_KG] != "msw_total_msw_generated_kg_per_cap_per_day" or rows[1][TREATMENT["recycling"]] != "waste_treatment_recycling_percent":
        raise RuntimeError(f"What a Waste 3.0 的欄位變了：{rows[1][:12]}")

    # 處理方式的資料年份：Codebook 裡 waste_treatment_*、waste_uncollected_percent 的 date_of_measurement，取最新的
    treat_year: dict[str, int] = {}
    for i, r in enumerate(wb["Codebook"].iter_rows(values_only=True)):
        if i == 0 or not r[1] or not str(r[3]).startswith(("waste_treatment", "waste_uncollected")):
            continue
        year = _num(r[8])
        if year:
            treat_year[r[1]] = max(treat_year.get(r[1], 0), int(year))

    values: dict[str, dict[str, float]] = defaultdict(dict)
    notes: dict[str, dict[str, str]] = defaultdict(dict)
    notes_en: dict[str, dict[str, str]] = defaultdict(dict)
    skipped = []
    for r in rows[2:]:
        iso3 = r[0]
        if not iso3:
            continue
        year, kg, tonnes = _num(r[GEN_YEAR]), _num(r[GEN_KG]), _num(r[GEN_TONNES])
        if year and kg is not None:
            values["msw-per-capita"][iso3] = round(kg, 3)
            notes["msw-per-capita"][iso3] = f"{int(year)} 年的資料"
            notes_en["msw-per-capita"][iso3] = f"Data for {int(year)}"
        if year and tonnes is not None:
            values["msw-total"][iso3] = round(tonnes)
            notes["msw-total"][iso3] = f"{int(year)} 年的資料"
            notes_en["msw-total"][iso3] = f"Data for {int(year)}"
        shares = {k: _num(r[i]) for k, i in TREATMENT.items()}
        reported = {k: v for k, v in shares.items() if v is not None}
        if not reported:
            continue
        total = sum(reported.values())
        vague = (reported.get("other") or 0) + (reported.get("unaccounted") or 0)
        if total < 0.95 or vague >= 0.3:
            skipped.append(iso3)
            continue
        ty = treat_year.get(iso3)
        for key, parts in GROUPS.items():
            # 回收一項都沒報的國家（中國、阿根廷…）不畫成 0%：多半是沒有統計，不是沒有回收
            if key == "waste-recycled" and not any(p in reported for p in parts):
                continue
            values[key][iso3] = round(100 * sum(reported.get(p) or 0 for p in parts), 1)
            if ty:
                notes[key][iso3] = f"{ty} 年的資料"
                notes_en[key][iso3] = f"Data for {ty}"

    units = {"msw-per-capita": "公斤/人/天", "msw-total": "公噸"} | {k: "%" for k in GROUPS}
    for key, unit in units.items():
        series = {iso3: [v] for iso3, v in sorted(values[key].items())}
        write_json(
            OUT / f"{key}.json",
            indicator_file(key, unit, [YEAR], series, notes=notes[key], notesEn=notes_en[key]),
            quiet=True,
        )
    write_json(
        OUT / "manifest.json",
        {
            "topic": "waste",
            "generatedAt": now_iso(),
            "source": "World Bank, What a Waste 3.0, country dataset (March 2026)",
            "sourceUrl": "https://datacatalog.worldbank.org/search/dataset/0039597",
            "license": "CC BY 4.0",
        },
    )
    print(f"  每人每天的垃圾 {len(values['msw-per-capita'])} 國；處理方式 {len(values['waste-recycled'])} 國（不算 {len(skipped)} 國）")
    tw = {k: values[k].get("TWN") for k in units}
    print(f"  台灣：{tw}")
