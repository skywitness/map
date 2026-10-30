"""洗腎大國（疾病主題的擴充，2026-10-30，製作手冊第六批 89；輸出到 topics/disease/）。

- 每百萬人的透析人數：USRDS Annual Data Report 2025 第 11 章圖 11.15（2023 年年底的盛行率，49 個國家或地區，
  `sources/usrds.py`）。2023 年沒有值的韓國、印尼、蒙特內哥羅用圖 11.16a 的 2022 年。
  墨西哥只有阿瓜斯卡連特斯州、比利時分成荷語區與法語區、英國分成英格蘭威爾斯北愛爾蘭與蘇格蘭，
  都畫成地圖上的點（前端 disease.ts 的 PLACES，鍵跟這裡的 PLACES 一致），國家本身不上色。
- 公立醫療體系能不能洗腎：WHO 非傳染病國家能力調查（NCD CCS）的 NCD_CCS_dialysis「General availability of
  dialysis in the public health system」，2015、2017、2019、2021 年，194 國（xmart，CC BY 4.0，`sources/who_xmart.py`）。
- 台灣：USRDS 有台灣（第一）；WHO 的調查沒有台灣，全民健保給付透析（健保署），編成「可以」，附註寫明。
"""
from __future__ import annotations

import pycountry

from common import OUT_DIR, indicator_file, write_json
from sources import usrds, who_xmart

OUT = OUT_DIR / "topics" / "disease"

# USRDS 的名稱 → ISO alpha-3（pycountry 查不到或會查錯的）；次國家的地區用底線開頭的鍵
NAMES = {
    "Taiwan": "TWN",
    "China, Mainland": "CHN",
    "Hong Kong": "HKG",
    "Republic of Korea": "KOR",
    "Republic of Ireland": "IRL",
    "Czech Republic": "CZE",
    "Brunei Darussalam": "BRN",
    "Bosnia and Herzegovina": "BIH",
    "Aguascalientes (Mexico)": "_MX-AGU",
    "Belgium, French speaking": "_BE-FR",
    "Belgium, Dutch speaking": "_BE-NL",
    "England, Wales & Northern Ireland": "_GB-EWN",
    "Scotland": "_GB-SCT",
}
PLACES = {"_MX-AGU", "_BE-FR", "_BE-NL", "_GB-EWN", "_GB-SCT"}

# WHO 的答案 → 類別圖的值
ANSWERS = {"Yes": 1, "No": 0}


def _iso3(name: str) -> str:
    if name in NAMES:
        return NAMES[name]
    country = pycountry.countries.lookup(name)
    return country.alpha_3


def build_prevalence() -> None:
    year = 2023
    latest = {_iso3(k): {year: round(v)} for k, v in usrds.by_place("Figure 11.15").items()}
    filled = []
    for name, series in usrds.trends("Figure 11.16a").items():
        iso3 = _iso3(name)
        if iso3 not in latest and series:
            last = max(series)
            latest[iso3] = {last: round(series[last])}
            filled.append(f"{iso3} {last}")
    years = list(range(2022, year + 1))
    values = {k: [s.get(y) for y in years] for k, s in sorted(latest.items())}
    note = {k: f"{next(iter(s))} 年（2023 年沒有值）" for k, s in latest.items() if year not in s}
    write_json(OUT / "dialysis.json", indicator_file(
        "dialysis", "人/百萬人", years, values, latestWithin=1,
        notes={k: f"USRDS 圖 11.16a 的 {v}。" for k, v in note.items()},
        notesEn={k: f"USRDS figure 11.16a, {next(iter(latest[k]))} (no 2023 value)." for k in note},
    ))
    top = sorted(((next(iter(s.values())), k) for k, s in latest.items()), reverse=True)
    print(f"  透析盛行率：{len(latest)} 個（含 {len(PLACES)} 個次國家地區）；用 2022 年補的 {filled}")
    print(f"  最多 {top[:6]}；最少 {top[-4:]}")


def build_public() -> None:
    answers = who_xmart.answers("NCD_CCS_dialysis")
    years = sorted({y for s in answers.values() for y in s})
    values = {
        iso3: [ANSWERS.get(s.get(y, "")) for y in years]
        for iso3, s in sorted(answers.items())
        if any(ANSWERS.get(v) is not None for v in s.values())
    }
    values["TWN"] = [1 for _ in years]
    note = ("WHO 的調查沒有台灣。全民健康保險給付透析（血液透析與腹膜透析），健保特約的醫院與診所普遍提供，這裡編成「可以」。")
    note_en = ("Taiwan is not in the WHO survey. National Health Insurance covers dialysis (haemodialysis and peritoneal dialysis), "
               "which contracted hospitals and clinics provide widely, so it is coded as available here.")
    write_json(OUT / "dialysis-public.json", indicator_file(
        "dialysis-public", "", years, values, notes={"TWN": note}, notesEn={"TWN": note_en},
    ))
    last = years[-1]
    counts = {v: sum(1 for s in values.values() if s[-1] == v) for v in (1, 0, None)}
    print(f"  公立體系能不能洗腎：{years}，{last} 年 可以 {counts[1]}、不行 {counts[0]}、沒回答 {counts[None]}（含台灣）")


def build() -> None:
    build_prevalence()
    build_public()
