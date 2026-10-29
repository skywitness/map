"""健康平均餘命（健康主題的擴充，2026-10-29）：出生時預期能健康地活幾年，與「不健康的年數」（平均壽命 − 健康平均餘命）。

**來源**：
- WHO 的 HALE（GHO 指標 WHOSIS_000002）與同一次發布的平均壽命（WHOSIS_000001），2000–2021 年，兩性合計與男女分開，
  CC BY 4.0（data.who.int 的條款，跟 sources/who.py 一樣）。GHO 的 OData API 2026-10-29 對所有資料都回 HTTP 500，
  改用 WHO 資料入口（data.who.int）背後的整檔 CSV：C64284D（HALE）、90E2E48（平均壽命）。
  「不健康的年數」用 WHO 同一次發布的平均壽命相減（健康主題的平均壽命是聯合國 WPP，跟 WHO 的 HALE 不是同一套模型，
  相減會混進兩邊估計的差異）。WHO 每次發布會整個重算，不跟舊版混用。
- 台灣（WHO 沒有）：衛生福利部統計處「健康照護服務性別統計」（https://mohw.gov.tw/dl-80447-ce58557e-e2c7-4b8e-b7f3-c8ea4fc6886b.html ）
  的 99 年（2010）與 109 年（2020）男女健康平均餘命，以及內政部的平均壽命（同一張圖），**手抄**在 TAIWAN。
  衛福部只公布男女分開的數字，沒有兩性合計（使用者決定：指標分兩性／女性／男性，台灣畫在女性、男性，兩性留白並寫明）。
  算法是 Sullivan 法、失能比例取自國健署的調查，跟 WHO（GBD 的失能權重）不同，tooltip 與附註寫明。
  衛福部各年的「性別統計圖像」會整串重算（105 年男性 2018 年版寫 68.7、2021 年版寫 69.34），所以只用最新一份的兩個年份，
  不把不同版本接在一起。

**輸出**（public/data/topics/health/）：hale/{total,female,male}.json、unhealthy/{total,female,male}.json（latestWithin 5：
台灣在 2021 年用 2020 年的值）。
"""
from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import from_numeric

OUT = OUT_DIR / "topics" / "health"
BASE = "https://srhdpeuwpubsa.blob.core.windows.net/whdh/DATADOT/INDICATOR/{code}_ALL_LATEST.csv"
CODES = {"hale": "C64284D", "life": "90E2E48"}
SEXES = {"TOTAL": "total", "FEMALE": "female", "MALE": "male"}
# 衛福部統計處「健康照護服務性別統計」：{年: {性別: (平均壽命, 健康平均餘命)}}（109 年的不健康年數 男 7.2、女 8.9 是原文寫的）
TAIWAN = {
    2010: {"male": (76.1, 68.8), "female": (82.5, 73.5)},
    2020: {"male": (78.1, 70.9), "female": (84.7, 75.8)},
}
LATEST_WITHIN = 5
TW_NOTE = (
    "台灣用衛生福利部統計處的數字（健康照護服務性別統計：99 年與 109 年），算法跟 WHO 不同（Sullivan 法，失能比例取自國健署的調查），"
    "不能直接跟其他國家比；平均壽命是內政部的簡易生命表。衛福部只公布男女分開的數字。"
)
TW_NOTE_EN = (
    "Taiwan uses figures from the Ministry of Health and Welfare (2010 and 2020), calculated differently from WHO (the Sullivan method, "
    "with disability rates from Health Promotion Administration surveys), so they are not directly comparable with other countries; "
    "life expectancy is from the Ministry of the Interior’s life tables. The ministry publishes figures for men and women only."
)
TW_HINT = "衛福部，算法跟 WHO 不同"
TW_HINT_EN = "Ministry of Health and Welfare; method differs from WHO"
# 側欄的卡片放得下的長度（長的會把卡片撐得很大）；原因寫在指標的說明裡
TW_TOTAL = "只有男女分開的（見女性、男性）"
TW_TOTAL_EN = "Men and women only (see Women, Men)"


def read(kind: str) -> dict[str, dict[str, dict[int, float]]]:
    """{性別: {iso3: {年: 值}}}"""
    path = download(BASE.format(code=CODES[kind]), "who", f"{kind}-{CODES[kind]}.csv")
    out: dict[str, dict[str, dict[int, float]]] = {s: defaultdict(dict) for s in SEXES.values()}
    with open(path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row["DIM_GEO_CODE_TYPE"] != "COUNTRY" or row["DIM_SEX"] not in SEXES:
                continue
            iso3 = from_numeric(row["DIM_GEO_CODE_M49"])
            if iso3 and row["AMOUNT_N"]:
                out[SEXES[row["DIM_SEX"]]][iso3][int(row["DIM_TIME"])] = float(row["AMOUNT_N"])
    return out


def build() -> None:
    hale, life = read("hale"), read("life")
    years = sorted({y for d in hale["total"].values() for y in d})
    for sex in SEXES.values():
        h = {c: dict(v) for c, v in hale[sex].items()}
        u = {c: {y: life[sex][c][y] - v for y, v in by.items() if y in life[sex].get(c, {})} for c, by in h.items()}
        extra: dict = {}
        if sex != "total":
            h["TWN"] = {y: v[sex][1] for y, v in TAIWAN.items()}
            u["TWN"] = {y: v[sex][0] - v[sex][1] for y, v in TAIWAN.items()}
            extra = {"notes": {"TWN": TW_NOTE}, "notesEn": {"TWN": TW_NOTE_EN}, "hints": {"TWN": TW_HINT}, "hintsEn": {"TWN": TW_HINT_EN}}
        else:
            extra = {"noValue": {"TWN": TW_TOTAL}, "noValueEn": {"TWN": TW_TOTAL_EN}}
        for name, data in (("hale", h), ("unhealthy", u)):
            values = {c: [round(by[y], 2) if y in by else None for y in years] for c, by in sorted(data.items())}
            write_json(OUT / name / f"{sex}.json", indicator_file(
                f"{name}-{sex}", "歲", years, values, latestWithin=LATEST_WITHIN, **extra), quiet=True)
        print(f"  {sex}：{len(h)} 國；" + "、".join(
            f"{c} {h[c].get(years[-1], h[c].get(2020))}" for c in ("JPN", "SGP", "KOR", "TWN", "USA", "LSO") if c in h))
    top = sorted(((v[years[-1]], c) for c, v in hale["total"].items() if years[-1] in v), reverse=True)
    print(f"  {years[-1]} 年兩性最高：{top[:4]}，最低：{top[-3:]}")
    un = sorted(((life["total"][c][years[-1]] - v[years[-1]], c) for c, v in hale["total"].items()
                 if years[-1] in v and years[-1] in life["total"].get(c, {})), reverse=True)
    print(f"  不健康的年數最多：{[(round(a, 1), c) for a, c in un[:4]]}，最少：{[(round(a, 1), c) for a, c in un[-3:]]}")


if __name__ == "__main__":
    build()
