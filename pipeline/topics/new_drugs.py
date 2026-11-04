"""藥品支出與取得：每年核准幾個新藥、孤兒藥（2026-11-04，製作手冊第二十批 330、331）。

- 美國：FDA《Compilation of CDER NME and New Biologic Approvals 1985–2025》（xlsx，公共領域）：每年核准的新分子實體與新生物製劑
  （Approval Year），其中有孤兒藥指定的（Orphan Drug Designation = Yes）。
- 歐盟：EMA 的 medicines 表（xlsx，表頭第 9 列；EMA 條款，可轉載，需註明 EMA）：人用藥、有上市許可日（Marketing authorisation
  date，日/月/年）的，去掉學名藥（Generic）與生物相似藥（Biosimilar），依上市許可年份算；其中 Orphan medicine = Yes 的是孤兒藥。
  EMA 的中央核准在歐盟 27 國與 EEA 的冰島、列支敦斯登、挪威都有效，所以這 30 國畫同一個數字（說明寫）。各國自己核准的
  （國家程序、去中央化程序）不在 EMA 的表裡。
- 歐盟的孤兒藥指定：EMA 的 orphan designations 表（表頭第 9 列），依指定日的年份算（同一個藥可能有好幾筆指定）。美國的指定在
  accessdata.fda.gov（cloud 被擋，已請本機 session 下載），到了再補。
- 「新藥」的定義各國不同（FDA 只算新成分，EMA 去掉學名藥與生物相似藥後還含新劑型、同成分不同商品名），不能直接比大小。
  台灣（食藥署年報）、日本（PMDA 的 PDF）等本機 session 的檔或之後再做。
"""
from __future__ import annotations

import datetime as dt
import re
from collections import Counter

import openpyxl

from common import OUT_DIR, download, indicator_file, write_json

OUT = OUT_DIR / "topics" / "medicines"
FDA_URL = "https://www.fda.gov/media/177921/download?attachment"
EMA_URL = "https://www.ema.europa.eu/en/documents/report/medicines-output-medicines-report_en.xlsx"
EMA_ORPHAN_URL = "https://www.ema.europa.eu/en/documents/report/medicines-output-orphan_designations-report_en.xlsx"
FIRST = 1995
LAST = 2025
EU_EEA = ["AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "IRL", "ITA", "LVA",
          "LTU", "LUX", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE", "ISL", "LIE", "NOR"]


def _year(cell: object) -> int | None:
    if isinstance(cell, (dt.date, dt.datetime)):
        return cell.year
    m = re.search(r"(\d{4})", str(cell or ""))
    return int(m.group(1)) if m else None


def _sheet(path, header_first: str) -> list[dict]:
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(max_col=60, values_only=True))
    hi = next(i for i, r in enumerate(rows) if r and r[0] and str(r[0]).strip() == header_first)
    head = [str(c).strip() if c else "" for c in rows[hi]]
    return [dict(zip(head, r)) for r in rows[hi + 1:] if r and any(r)]


def build() -> None:
    fda = _sheet(download(FDA_URL, "newdrugs", "fda-nme.xlsx"), "Proprietary  Name")
    us_new = Counter(int(r["Approval Year"]) for r in fda if r.get("Approval Year"))
    us_orphan = Counter(int(r["Approval Year"]) for r in fda if r.get("Approval Year") and str(r.get("Orphan Drug Designation", "")).strip() == "Yes")
    ema = _sheet(download(EMA_URL, "newdrugs", "ema-medicines.xlsx"), "Category")
    human = [r for r in ema if r["Category"] == "Human" and r.get("Marketing authorisation date")
             and r.get("Generic") != "Yes" and r.get("Biosimilar") != "Yes"]
    eu_new = Counter(_year(r["Marketing authorisation date"]) for r in human)
    eu_orphan = Counter(_year(r["Marketing authorisation date"]) for r in human if r.get("Orphan medicine") == "Yes")
    orphan = _sheet(download(EMA_ORPHAN_URL, "newdrugs", "ema-orphan.xlsx"), "Medicine name")
    date_col = next(k for k in orphan[0] if "designation" in k.lower() and "date" in k.lower())
    # 「Negative」是被拒絕的申請，不是指定
    eu_designations = Counter(_year(r[date_col]) for r in orphan if r.get(date_col) and r.get("Status") != "Negative")
    years = list(range(FIRST, LAST + 1))
    eu_note = "歐盟中央核准（EMA），歐盟 27 國與冰島、列支敦斯登、挪威共用同一個數字；各國自己核准的不算"
    eu_note_en = "Central EU authorisation (EMA), shared by the 27 EU countries plus Iceland, Liechtenstein and Norway; national authorisations are not included"
    for name, us, eu, unit in (("new-drugs", us_new, eu_new, "個"), ("orphan-approvals", us_orphan, eu_orphan, "個"),
                               ("orphan-designations", None, eu_designations, "件")):
        values = {}
        if us is not None:
            values["USA"] = [us.get(y, 0) for y in years]
        for c in EU_EEA:
            values[c] = [eu.get(y, 0) for y in years]
        hints = {c: eu_note for c in EU_EEA}
        hints_en = {c: eu_note_en for c in EU_EEA}
        if us is not None:
            hints["USA"] = "FDA 的新分子實體與新生物製劑" + ("，其中有孤兒藥指定的" if name == "orphan-approvals" else "")
            hints_en["USA"] = "FDA new molecular entities and new biologics" + (" with orphan drug designation" if name == "orphan-approvals" else "")
        no_value = {"TWN": "台灣的數字等食藥署的年報（定義也不同）", "JPN": "日本的 PMDA 清單是 PDF，還沒有做"}
        no_value_en = {"TWN": "Taiwan’s figures await the Taiwan FDA annual report (with a different definition)", "JPN": "Japan’s PMDA list is a PDF and has not been processed yet"}
        if name == "orphan-designations":
            no_value["USA"] = "美國 FDA 的孤兒藥指定資料庫還在下載"
            no_value_en["USA"] = "US FDA orphan designation data are still being obtained"
        write_json(OUT / f"{name}.json", indicator_file(
            name, unit, years, dict(sorted(values.items())), hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en))
    print(f"  美國新藥：{ {y: us_new[y] for y in (2018, 2023, 2024, 2025)} }，孤兒藥 { {y: us_orphan[y] for y in (2023, 2024, 2025)} }")
    print(f"  歐盟新藥（不含學名藥、生物相似藥）：{ {y: eu_new[y] for y in (2009, 2018, 2022, 2025)} }，孤兒藥 { {y: eu_orphan[y] for y in (2023, 2024, 2025)} }")
    print(f"  歐盟孤兒藥指定：{ {y: eu_designations[y] for y in (2015, 2016, 2022, 2025)} }（{date_col}，共 {sum(eu_designations.values())}）")
