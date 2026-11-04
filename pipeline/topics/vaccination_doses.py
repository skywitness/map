"""疫苗與防疫：COVID-19 疫苗的總劑次與加強劑（2026-11-04，製作手冊第二十批 326）。

使用者 2026-11-04 決定用 Our World in Data（跟「完成 COVID-19 基礎劑」同一份 compact.csv，CC BY 4.0），不用手冊建議的 WHO
儀表板 COV_VAC_UPTAKE_2021_2023.csv（授權有疑義、台灣那一列全是空的）。
- `covid-doses`：每百人累計打了幾劑（total_vaccinations_per_hundred）。
- `covid-boosters`：每百人累計打了幾劑加強劑（total_boosters_per_hundred）；是劑次，一個人打兩次加強劑算兩劑，可能超過 100，
  不是「打過加強劑的人」的比例。
每年最後一次公布的值（2021–2023 年，多數國家 2023 年停止公布）。台灣是疾管署的數字（OWID 整理，到 2023-09-24）。
離島小國（托克勞、紐埃）分母是常住人口、分子含外來的人，數字會偏高。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import owid_covid

OUT = OUT_DIR / "topics" / "vaccination"
YEARS = [2021, 2022, 2023]


def _in_year(series: dict[str, float], year: int) -> float | None:
    dates = [d for d in series if d.startswith(str(year))]
    return series[max(dates)] if dates else None


def build() -> None:
    covid = owid_covid.compact()
    for name, attr in (("covid-doses", "doses"), ("covid-boosters", "boosters")):
        series = {k: {y: v for y in YEARS if (v := _in_year(getattr(c, attr), y)) is not None} for k, c in covid.items()}
        world = series.pop("WLD")
        series = {k: s for k, s in series.items() if s}
        last = {k: max(d for d in getattr(covid[k], attr)) for k in series}
        hints = {k: f"最後一次公布是 {d}" for k, d in last.items()}
        hints_en = {k: f"last reported {d}" for k, d in last.items()}
        write_json(OUT / f"{name}.json", indicator_file(
            name, "劑/百人", YEARS, {k: to_series(s, YEARS, 1) for k, s in sorted(series.items())},
            aggregates={"WLD": to_series(world, YEARS, 1)}, latestWithin=1, hints=hints, hintsEn=hints_en))
        end = sorted(((s[2023], k) for k, s in series.items() if 2023 in s), reverse=True)
        print(f"  {name}：{len(series)} 國；2023 年底 {len(end)} 國，最高 {end[:6]}，最低 {end[-6:]}；世界 {world}；台灣 {series.get('TWN')}（{last.get('TWN')}）")
