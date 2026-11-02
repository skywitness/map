"""教育主題：大專以上的成人比例，推估到 2100 年（Wittgenstein Centre，製作手冊第十七批 274，2026-11-02）。

sources/wic.py 的 zen2025V01，SSP2（中推估）：25 歲以上人口裡學歷是 e6（Post Secondary，大專以上）的比例，
2025–2100 年每 5 年，全部是推估（projectionFrom 2025）。世界值用檔裡的 World。
台灣（reg158）的附註對照內政部「15歲以上人口高等教育程度─按區域別分」（data.gov.tw 14219，政府資料開放授權條款第 1 版）：
年齡的範圍不同（15 歲以上），而且開放資料只有一年。
"""
from __future__ import annotations

import csv
import io

from common import OUT_DIR, download, indicator_file, write_json
from sources import wic

OUT = OUT_DIR / "topics" / "education"
SCENARIO = "SSP2"
MIN_AGE = 25
TERTIARY = wic.EDUCATION.index("e6")
MOI_URL = ("https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/A9D6E92E-F9B2-408C-90FA-72C44EC45A4A/"
           "resource/4C8DF504-2355-4479-84E9-D1582D7B11FE/download")


def moi_tertiary() -> tuple[int, float]:
    """內政部 data.gov.tw 14219：（西元年，全國 15 歲以上大專以上人口比率 %）最新一年"""
    text = download(MOI_URL, "moi", "14219-tertiary-15plus.csv").read_bytes().decode("utf-8-sig")
    best: tuple[int, float] | None = None
    for row in csv.reader(io.StringIO(text)):
        if len(row) < 6 or "區域別總計" not in row[0] or "性別總計" not in row[0]:
            continue
        year = int(row[0].split("年")[0]) + 1911
        if best is None or year > best[0]:
            best = (year, float(row[5]))
    if best is None:
        raise RuntimeError("內政部 14219 找不到全國的列，格式可能變了")
    return best


def build() -> None:
    data = wic.attainment(SCENARIO, MIN_AGE)
    years = sorted({y for by in data.values() for y in by})
    values: dict[str, list[float | None]] = {}
    for key, by_year in data.items():
        values[key] = [round(by_year[y][TERTIARY] / sum(by_year[y]) * 100, 2) if y in by_year and sum(by_year[y]) > 0 else None
                       for y in years]
    world = values.pop("WLD")

    moi_year, moi_share = moi_tertiary()
    tw = values["TWN"]
    note = (f"內政部統計（data.gov.tw 14219）：{moi_year} 年底 15 歲以上人口有大專以上學歷的占 {moi_share:.1f}%"
            f"（年齡從 15 歲算，不能直接比；開放資料只有這一年）。這裡是 25 歲以上，{years[0]} 年 {tw[0]:.1f}%。")
    note_en = (f"Ministry of the Interior (data.gov.tw 14219): {moi_share:.1f}% of people aged 15 and over had tertiary education at the end "
               f"of {moi_year} (a different age range, so not directly comparable; the open data cover only that year). "
               f"Here it is ages 25 and over: {tw[0]:.1f}% in {years[0]}.")
    write_json(OUT / "tertiary-2100.json", indicator_file(
        "tertiary-2100", "%", years, values, aggregates={"WLD": world}, projectionFrom=years[0],
        notes={"TWN": note}, notesEn={"TWN": note_en},
    ))

    i50, i100 = years.index(2050), years.index(2100)
    print(f"  {len(values)} 個國家與地區，{years[0]}–{years[-1]}（{SCENARIO}，{MIN_AGE} 歲以上）；世界 {world[0]}% → {world[i50]}% → {world[i100]}%")
    for c in ("TWN", "KOR", "JPN", "CHN", "USA", "IND", "NGA", "DEU"):
        v = values.get(c)
        if v:
            print(f"    {c}：{v[0]}% → {v[i50]}% → {v[i100]}%")
    ranked = sorted(((c, v[0]) for c, v in values.items() if v[0] is not None), key=lambda kv: -kv[1])
    print(f"    {years[0]} 年最高：{ranked[:6]}；最低：{ranked[-4:]}")
    print(f"  內政部 {moi_year} 年 15 歲以上大專以上 {moi_share}%")
