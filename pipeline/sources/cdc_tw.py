"""衛生福利部疾病管制署（疾管署）的幼兒常規疫苗接種完成率：台灣的 DTP3、麻疹第一劑、麻疹第二劑（2024 年，自算）。

- 來源：疾管署網站「預防接種統計」（https://www.cdc.gov.tw/Category/MPage/S2UF2-VuMgfzgzpy7qdvlA）每年一份的
  「幼兒各項常規疫苗接種完成率」PDF（全國性預防接種資訊管理系統 NIIS，每年 12 月底的資料）。數字只畫在長條圖上
  （PDF 裡是圖，沒有文字），所以 KNOWN 是照圖上標的數字抄的，PDF 換版時要重抄。
- 統計定義（PDF 第 2 頁）：接種完成率 = 統計出生世代裡接種的人數 ÷ 應接種的人數（不分接種地點）。
  五合一疫苗（白喉破傷風非細胞性百日咳、b 型嗜血桿菌及不活化小兒麻痺混合疫苗）第三劑算前一年出生的幼兒（出生滿 6 個月接種），
  MMR（麻疹、腮腺炎、德國麻疹混合疫苗）第一劑算前兩年出生的（出生滿 12 個月接種）。例如 114 年（2025）的報表是
  113 年出生者的五合一第三劑、112 年出生者的 MMR 第一劑。WUENIC 的 DTP3、MCV1 是當年滿 1 歲的嬰兒，口徑接近但不完全相同。
- 疾管署開放資料的「各項預防接種完成率統計」（data.gov.tw 24457，CSV，2022–2025 年的縣市別完成率，含 MMR 第二劑）
  放在 od.cdc.gov.tw，從 cloud 連不上（連線逾時）。2024 年的檔使用者用瀏覽器下載，原樣放在
  `pipeline/data/cdc/immunization-coverage-2024.csv`（來源、授權寫在同一個資料夾的 README.md），麻疹第二劑用它自算
  （製作手冊第八批 145，使用者 2026-10-30 決定只做 2024 年）：檔裡只有 22 個縣市的完成率、沒有全國值，
  用內政部「村里戶數、單一年齡人口」（data.gov.tw 77132）2024 年 12 月各縣市的 5 歲人口加權（縣市沒有分母，
  權重是戶籍人口，所以是估計值）。統計對象是衛生所及合約醫院診所。
- 授權：疾管署全球資訊網的「政府網站資料開放宣告」（https://www.cdc.gov.tw/Category/FPage/TxkBIR9agw_IBRRmvn9TcQ ）：
  網站上的資料與素材以無償、非專屬、得再授權的方式提供，註明出處即可利用（跟政府資料開放授權條款相同）。
"""
from __future__ import annotations

import csv

from common import ROOT, download

PAGE = "https://www.cdc.gov.tw/Category/MPage/S2UF2-VuMgfzgzpy7qdvlA"

# 西元年（報表的年份）: (五合一第三劑, MMR 第一劑)，%；PDF 是 /Uploads/files/<下面的檔名>
KNOWN: dict[int, tuple[float, float]] = {
    2015: (97.78, 98.28),  # 104 年，0f90ad3e-79e0-4bf2-b344-4814b8e3d0b1.pdf（只有這一年標到小數第二位）
    2016: (97.6, 98.2),  # 105 年，9ce44692-1476-46f8-a157-5a2802faf8d9.pdf
    2017: (97.8, 98.4),  # 106 年，7805a4dd-7f8b-4b8c-bbd4-d9d00c2f2915.pdf
    2018: (98.0, 98.6),  # 107 年，0c1c047e-dd5a-4f35-aa52-2b3e1294a500.pdf
    2019: (98.3, 98.9),  # 108 年，a1d74c4d-3792-45d8-b49f-96c80aa9e2f6.pdf
    2020: (98.4, 98.8),  # 109 年，c21b9fcf-757a-4ba2-b6fe-158e9a02c196.pdf
    2021: (98.5, 98.8),  # 110 年，1ec3e745-d624-4822-b401-3c013e67bc42.pdf
    2022: (98.0, 98.6),  # 111 年，4033d38d-2e78-4eb5-bed7-3d86518e82de.pdf
    2023: (98.1, 98.7),  # 112 年，44cdce75-e53a-41c6-bf0d-12f18afae998.pdf
    2024: (98.3, 98.8),  # 113 年，2cd2abe0-1dc1-431f-849f-8112b536d139.pdf
    2025: (98.0, 98.7),  # 114 年，11993b50-6244-43ee-963b-9769c3a51ab3.pdf
}

# 疾管署 2025-01-09 的致醫界通函第 559 號（https://www.cdc.gov.tw/Bulletin/Detail/I4e68AH-L8KR4p0S9ia9Lg?typeid=48 ）：
# 「近年 2 劑接種完成率均高達 97% 以上」，沒有逐年的全國數字
MMR2_BULLETIN = "https://www.cdc.gov.tw/Bulletin/Detail/I4e68AH-L8KR4p0S9ia9Lg?typeid=48"

# 國健署（衛福部 2024-06-04 新聞稿，https://www.mohw.gov.tw/cp-16-78934-1.html ）：
# 國中女生公費 HPV 疫苗完成兩劑的涵蓋率，依入學年度（統計到 2024 年 4 月）
HPV_COMPLETE_BY_ENTRY: dict[int, float] = {2018: 75.2, 2019: 86.0, 2020: 86.1, 2021: 91.7}
HPV_SOURCE = "https://www.mohw.gov.tw/cp-16-78934-1.html"


# 縣市別完成率（使用者用瀏覽器下載的原檔）與 MMR 第二劑的欄名
COUNTY_FILE = ROOT / "pipeline" / "data" / "cdc" / "immunization-coverage-2024.csv"
COUNTY_YEAR = 2024
MMR2_COLUMN = "麻疹腮腺炎德國麻疹混合疫苗第二劑（完成率）"
MMR1_COLUMN = "麻疹腮腺炎德國麻疹混合疫苗第一劑（完成率）"
# 內政部「村里戶數、單一年齡人口」113 年 12 月（data.gov.tw 77132，政府資料開放授權條款第 1 版）
POPULATION_URL = (
    "https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/2C7688CB-B505-4D00-B11C-66C4D31B024F/"
    "resource/6CE62A07-0C48-4ADB-A679-48C4752E33BD/download"
)
WEIGHT_AGE = 5  # MMR 第二劑在滿 5 歲到入小學前接種


def _county_population(age: int) -> dict[str, int]:
    """{縣市代碼: 某一歲的戶籍人口}，113 年 12 月底；區域別代碼的前 5 碼是縣市代碼（金門 09020、連江 09007）"""
    path = download(POPULATION_URL, "moi", "village-age-11312.csv")
    out: dict[str, int] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["統計年月"] != "11312":
                continue  # 第二列是英文欄名
            county = row["區域別代碼"][:5]
            out[county] = out.get(county, 0) + int(row[f"{age}歲-男"]) + int(row[f"{age}歲-女"])
    return out


def county_weighted(column: str, age: int = WEIGHT_AGE) -> float:
    """縣市別完成率用各縣市某一歲人口加權的全國估計（%）"""
    with open(COUNTY_FILE, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    if len(rows) != 22:
        raise RuntimeError(f"{COUNTY_FILE.name} 應該有 22 個縣市，讀到 {len(rows)} 列")
    population = _county_population(age)
    missing = [r["縣市名稱"] for r in rows if not population.get(r["縣市代碼"])]
    if missing:
        raise RuntimeError(f"內政部的人口檔找不到這些縣市：{missing}")
    weight = sum(population[r["縣市代碼"]] for r in rows)
    return sum(float(r[column]) * population[r["縣市代碼"]] for r in rows) / weight


def coverage() -> dict[str, dict[int, float]]:
    """{'dtp3' | 'mcv1' | 'mcv2': {西元年: %}}；mcv2 只有 2024 年（縣市別完成率依 5 歲人口加權，自算）"""
    for year, values in KNOWN.items():
        if not all(90 <= v <= 100 for v in values):
            raise RuntimeError(f"疾管署 {year} 年的完成率 {values} 看起來抄錯了")
    mcv2 = round(county_weighted(MMR2_COLUMN), 2)
    # 同法算第一劑核對：疾管署 114 年的 PDF（2025 年的報表，113 年出生的幼兒）是 98.7%，自算 98.77%
    mcv1 = county_weighted(MMR1_COLUMN)
    if not (90 <= mcv2 <= 100) or abs(mcv1 - KNOWN[COUNTY_YEAR + 1][1]) > 0.2:
        raise RuntimeError(f"自算的麻疹第二劑 {mcv2}%、第一劑 {mcv1:.2f}% 看起來不對")
    return {
        "dtp3": {y: v[0] for y, v in KNOWN.items()},
        "mcv1": {y: v[1] for y, v in KNOWN.items()},
        "mcv2": {COUNTY_YEAR: mcv2},
    }
