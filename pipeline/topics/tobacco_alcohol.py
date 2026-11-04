"""菸酒主題：成人菸草使用率（全部、男性、女性）、人均飲酒量（純酒精）。

使用者 2026-11-04 決定：只在 WHO GHO 的指標不用，data.who.int 有同一個或相近指標的改用 data.who.int 的版本。
- 菸草使用率（原本是 GHO 的吸菸率 M_Est_smk_curr_std，data.who.int 沒有）：data.who.int 的 M_Est_tob_curr_std
  （https://data.who.int/indicators/i/847662C/75DDA77 ，整份 CSV，`sources/who_datadot.py`）：15 歲以上目前使用任何菸草
  （吸的與不燃燒的，例如嚼菸、鼻菸；不含電子煙）的比例，年齡標準化，《WHO 全球菸草使用趨勢報告》的模型估計，
  2000、2005、2007、2010、2015、2018、2020–2022 年，2025、2030 年是推估（projectionFrom）。三個指標用同一組門檻。
  指標 id 仍是 smoking、smoking-male、smoking-female（舊網址照樣能開）。
- 人均飲酒量：SA_0000001688（15 歲以上平均每人一年喝的純酒精公升數，SDG 3.5.2；data.who.int 有指標頁
  https://data.who.int/indicators/i/EF38E6A/EE6F72A ），有登記的銷售量加上自釀、走私等沒有登記的量，扣掉觀光客喝的，
  2000–2024 年，有世界值。
- 主要酒類與各類酒的消費量（GHO 的 SA_0000001400）data.who.int 沒有，2026-11-04 拿掉。
- 授權：data.who.int 的資料集是 CC BY 4.0（加上爭議先調解再仲裁、不准反匿名化、不准暗示 WHO 背書的附加條款）。

台灣不在 WHO 的資料中：
- 菸草使用率：國健署「國人吸菸行為調查」的 18 歲以上成人吸菸率（sources/hpa.py），以台灣 2000 年的人口結構標準化，
  跟 WHO（15 歲以上、WHO 標準人口、含不燃燒的菸草）不完全可比。調查 2018 年起兩年一次；地圖的年份加上台灣有調查的
  2024 年，指標檔加 latestWithin: 2，沒有值的年份顯示兩年內最近的值並標出資料年份。
- 飲酒量：財政部、國健署都沒有公布換算成純酒精的人均消費量，所以留空，附註寫 FAOSTAT 的酒類供給量
  （酒的重量，不是純酒精；飲食主題有）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import hpa, who, who_datadot

OUT = OUT_DIR / "topics" / "tobacco-alcohol"

TOBACCO_CSV = "75DDA77"  # data.who.int 的菸草使用率（M_Est_tob_curr_std）
SMOKING_YEARS = [2000, 2005, 2007, 2010, 2015, 2018, 2020, 2021, 2022, 2024, 2025, 2030]
SMOKING_PROJECTION_FROM = 2025
SMOKING = {"smoking": ("TOTAL", "total"), "smoking-male": ("MALE", "male"), "smoking-female": ("FEMALE", "female")}
SEX_ZH = {"total": "", "male": "男性", "female": "女性"}
SEX_EN = {"total": "", "male": "men's ", "female": "women's "}

TAIWAN_ALCOHOL = (
    "台灣不在 WHO 的資料中，財政部、國健署也沒有公布換算成純酒精的人均消費量，所以地圖上留空。"
    "FAOSTAT 的酒類供給量 2023 年平均每人 38.4 公斤（酒的重量，不是純酒精，見飲食主題）",
    "Taiwan is not in the WHO data, and neither the Ministry of Finance nor the Health Promotion Administration "
    "publishes consumption per person in pure alcohol, so it is left blank. FAOSTAT puts the supply of alcoholic "
    "beverages at 38.4 kg per person in 2023 (the weight of the drinks, not pure alcohol; see the diet topic)",
)


def build() -> None:
    # ── 菸草使用率（data.who.int）──
    taiwan = hpa.smoking()
    rows = who_datadot.csv_rows(TOBACCO_CSV)
    for key, (dim, sex) in SMOKING.items():
        series: dict[str, dict[int, float]] = {}
        for r in rows:
            if r["DIM_SEX"] == dim and r["PERCENT_POP_N"]:
                series.setdefault(r["iso3"], {})[int(r["DIM_TIME"])] = float(r["PERCENT_POP_N"])
        tw = taiwan[sex]
        series["TWN"] = {y: v for y, v in tw.items() if y in SMOKING_YEARS}
        last = max(series["TWN"])
        values = {iso3: to_series(s, SMOKING_YEARS, 1) for iso3, s in series.items()}
        note = (
            f"台灣不在 WHO 的資料中，改用國健署「國人吸菸行為調查」的 18 歲以上{SEX_ZH[sex]}吸菸率"
            f"（以台灣 2000 年的人口結構標準化；WHO 是 15 歲以上、用 WHO 的標準人口，也算嚼菸等不燃燒的菸草），"
            f"{last} 年 {tw[last]}%。2018 年起調查兩年一次",
            f"Taiwan is not in the WHO data; the Health Promotion Administration's Adult Smoking Behavior Survey is used "
            f"instead: {SEX_EN[sex]}smoking prevalence at ages 18+, standardised to Taiwan's 2000 population (WHO uses "
            f"ages 15+ and the WHO standard population and also counts smokeless tobacco), {tw[last]}% in {last}. "
            "The survey has been held every two years since 2018",
        )
        write_json(
            OUT / f"{key}.json",
            indicator_file(
                key, "%", SMOKING_YEARS, values,
                projectionFrom=SMOKING_PROJECTION_FROM, latestWithin=2, license="CC BY 4.0",
                notes={"TWN": note[0]}, notesEn={"TWN": note[1]},
            ),
        )
        top = sorted(((s[2022], c) for c, s in series.items() if 2022 in s and c != "TWN"), reverse=True)
        print(f"  {key}：{len(values)} 國；2022 年最高 {top[:5]}；台灣 {last} 年 {tw[last]}%；"
              f"日本 {series.get('JPN', {}).get(2022)}、南韓 {series.get('KOR', {}).get(2022)}、中國 {series.get('CHN', {}).get(2022)}、"
              f"美國 {series.get('USA', {}).get(2022)}、印尼 {series.get('IDN', {}).get(2022)}")

    # ── 人均飲酒量 ──
    alcohol, world = who.gho("SA_0000001688", {"Dim1": "SEX_BTSX"})
    years = year_span(alcohol)
    values = {iso3: to_series(s, years, 2) for iso3, s in alcohol.items() if any(y in s for y in years)}
    write_json(
        OUT / "alcohol.json",
        indicator_file(
            "alcohol", "公升", years, values,
            aggregates={"WLD": to_series(world, years, 2)},
            notes={"TWN": TAIWAN_ALCOHOL[0]}, notesEn={"TWN": TAIWAN_ALCOHOL[1]},
        ),
    )
    print(f"  人均飲酒量：{years[0]}–{years[-1]}，{len(values)} 國；世界 {years[-1]} 年 {world[years[-1]]:.2f} 公升")

    write_json(
        OUT / "manifest.json",
        {
            "topic": "tobacco-alcohol",
            "generatedAt": now_iso(),
            "sources": [
                "WHO data.who.int M_Est_tob_curr_std (75DDA77), SA_0000001688",
                "國民健康署國人吸菸行為調查（data.gov.tw 14462 與網站的歷年成人吸菸率）",
            ],
        },
    )
