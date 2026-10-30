"""OECD Education at a Glance（Data Explorer 的 SDMX API，OECD 資料條款）與 OECD Family Database PF3.2（托育）。

- 教師的法定薪資（DSD_EAG_SAL_STA@DF_TCH 2.1）：公立學校、各級教育、資格與年資；同一個檔有本國貨幣（PRICE_BASE V，
  UNIT_MEASURE XDC）與購買力平價美元（PRICE_BASE Q，USD_PPP）兩種值，只取 USD_PPP。年份在 REF_PERIOD（只有 2025）。
- 平均每班人數（DSD_EAG_UOE_NON_FIN_PERS@DF_UOE_NF_PERS_CLS 1.1）：小學、國中，全部學校（INST_EDU）或公私立，
  2013–2024，年份在 TIME_PERIOD。
- 上課時間（DSD_EAG_IT@DF_EAG_IT_ALL 1.1）：UNIT_MEASURE D_Y 是每年上課天數、H_Y 是每年時數，2024–2025，年份在 REF_PERIOD。
- 比利時分法語區（BEFR、BFR）與荷語區（BEFL、BFL），英國分英格蘭（UKB）與蘇格蘭（UKM），美國、加拿大、西班牙另有
  各州（省、自治區）的值（US08、CA24、ES51……），全國另有一列。
- 三個檔的 OBS_STATUS 有 M、O、L（沒有值），OBS_VALUE 是空的，略過。
- PF3.2「Enrolment in childcare and pre-school」（2026-02-16）：工作表 Enrolment_0-2-year-olds，第 1 欄國名、
  第 2 欄附註號碼、之後是 2005–2025 年；沒有值寫「..」。
"""
from __future__ import annotations

import csv

import openpyxl

from common import download
from sources.countries import from_name, to_iso3

SDMX = "https://sdmx.oecd.org/public/rest/data/{flow}/all?format=csvfilewithlabels"
SALARY_FLOW = "OECD.EDU.IMEP,DSD_EAG_SAL_STA@DF_TCH,2.1"
CLASS_FLOW = "OECD.EDU.IMEP,DSD_EAG_UOE_NON_FIN_PERS@DF_UOE_NF_PERS_CLS,1.1"
TIME_FLOW = "OECD.EDU.IMEP,DSD_EAG_IT@DF_EAG_IT_ALL,1.1"
PF32_URL = "https://webfs.oecd.org/Els-com/Family_Database/PF3_2_Enrolment_childcare_preschool.xlsx"
# 次國家單位：比利時、英國沒有全國的值，用其中一個代表（附註寫另一個）
REGIONS = {"BEFL": "BEL", "BFL": "BEL", "UKB": "GBR"}
OTHER_REGIONS = {"BEFR": "BEL", "BFR": "BEL", "UKM": "GBR"}
NAMES = {"Korea": "KOR", "Slovak Republic": "SVK", "Türkiye": "TUR"}

Series = dict[str, dict[int, float]]


def _rows(flow: str, name: str) -> list[dict[str, str]]:
    path = download(SDMX.format(flow=flow), "oecd-eag", name)
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _collect(rows: list[dict[str, str]], year_field: str, **filters: str) -> tuple[Series, Series]:
    """({iso3: {年: 值}}, 另一個次國家單位 {iso3: {年: 值}})"""
    out: Series = {}
    other: Series = {}
    for r in rows:
        if not r["OBS_VALUE"] or any(r.get(k) != v for k, v in filters.items()):
            continue
        area = r["REF_AREA"]
        year, value = int(r[year_field]), float(r["OBS_VALUE"])
        if area in REGIONS:
            out.setdefault(REGIONS[area], {})[year] = value
        elif area in OTHER_REGIONS:
            other.setdefault(OTHER_REGIONS[area], {})[year] = value
        elif len(area) == 3 and to_iso3(area) == area:
            out.setdefault(area, {})[year] = value
    return out, other


def teacher_salary() -> tuple[Series, Series]:
    """國中（一般課程）教師的法定年薪，最普遍的資格、15 年年資，購買力平價美元（不變價格）。"""
    rows = _rows(SALARY_FLOW, "teacher-salary.csv")
    if not rows or "REF_PERIOD" not in rows[0]:
        raise RuntimeError("OECD 教師薪資的欄位變了")
    return _collect(rows, "REF_PERIOD", UNIT_MEASURE="USD_PPP", EDUCATION_LEV="ISCED11_24",
                    PERS_QUAL_LEV="TYP", PERS_EXP_LEV="EXP15", INST_TYPE_EDU="INST_EDU_PUB")


def class_size() -> tuple[Series, Series]:
    """小學的平均每班人數（公私立全部學校）。"""
    return _collect(_rows(CLASS_FLOW, "class-size.csv"), "TIME_PERIOD", EDUCATION_LEV="ISCED11_1", INST_TYPE_EDU="INST_EDU")


def school_days() -> tuple[Series, Series]:
    """小學一年上課幾天（公立學校）。"""
    return _collect(_rows(TIME_FLOW, "instruction-time.csv"), "REF_PERIOD", UNIT_MEASURE="D_Y", EDUCATION_LEV="ISCED11_1")


def childcare_0_2() -> Series:
    """0–2 歲上托育（ISCED 0 與其他登記的托育服務）的比例（%）。"""
    wb = openpyxl.load_workbook(download(PF32_URL, "oecd-family", "PF3_2_Enrolment_childcare_preschool.xlsx"),
                                read_only=True, data_only=True)
    sheet = wb["Enrolment_0-2-year-olds"]
    sheet.reset_dimensions()
    rows = list(sheet.iter_rows(values_only=True))
    header = next(r for r in rows if r and r[0] == "Country")
    years = {i: int(c) for i, c in enumerate(header) if isinstance(c, int)}
    out: Series = {}
    for row in rows[rows.index(header) + 1 :]:
        if not row or not isinstance(row[0], str) or row[0].startswith(".."):
            break
        iso3 = NAMES.get(row[0]) or to_iso3(row[0]) or from_name(row[0])
        if not iso3:
            raise RuntimeError(f"PF3.2 的國名對不到代碼：{row[0]}")
        for col, year in years.items():
            if col < len(row) and isinstance(row[col], (int, float)):
                out.setdefault(iso3, {})[year] = float(row[col])
    return out
