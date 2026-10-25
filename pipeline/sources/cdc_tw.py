"""衛生福利部疾病管制署（疾管署）的幼兒常規疫苗接種完成率：台灣的 DTP3、麻疹第一劑。

- 來源：疾管署網站「預防接種統計」（https://www.cdc.gov.tw/Category/MPage/S2UF2-VuMgfzgzpy7qdvlA）每年一份的
  「幼兒各項常規疫苗接種完成率」PDF（全國性預防接種資訊管理系統 NIIS，每年 12 月底的資料）。數字只畫在長條圖上
  （PDF 裡是圖，沒有文字），所以 KNOWN 是照圖上標的數字抄的，PDF 換版時要重抄。
- 統計定義（PDF 第 2 頁）：接種完成率 = 統計出生世代裡接種的人數 ÷ 應接種的人數（不分接種地點）。
  五合一疫苗（白喉破傷風非細胞性百日咳、b 型嗜血桿菌及不活化小兒麻痺混合疫苗）第三劑算前一年出生的幼兒（出生滿 6 個月接種），
  MMR（麻疹、腮腺炎、德國麻疹混合疫苗）第一劑算前兩年出生的（出生滿 12 個月接種）。例如 114 年（2025）的報表是
  113 年出生者的五合一第三劑、112 年出生者的 MMR 第一劑。WUENIC 的 DTP3、MCV1 是當年滿 1 歲的嬰兒，口徑接近但不完全相同。
- 疾管署開放資料的「各項預防接種完成率統計」（data.gov.tw 24457，CSV，2022–2025 年的縣市別完成率，含 MMR 第二劑）
  放在 od.cdc.gov.tw，2026-10-26 從這裡連不上（連線逾時，跟疾病主題當時一樣），所以沒有用。
- 授權：疾管署全球資訊網的「政府網站資料開放宣告」（https://www.cdc.gov.tw/Category/FPage/TxkBIR9agw_IBRRmvn9TcQ ）：
  網站上的資料與素材以無償、非專屬、得再授權的方式提供，註明出處即可利用（跟政府資料開放授權條款相同）。
"""
from __future__ import annotations

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


def coverage() -> dict[str, dict[int, float]]:
    """{'dtp3' | 'mcv1': {西元年: %}}"""
    for year, values in KNOWN.items():
        if not all(90 <= v <= 100 for v in values):
            raise RuntimeError(f"疾管署 {year} 年的完成率 {values} 看起來抄錯了")
    return {
        "dtp3": {y: v[0] for y, v in KNOWN.items()},
        "mcv1": {y: v[1] for y, v in KNOWN.items()},
    }
