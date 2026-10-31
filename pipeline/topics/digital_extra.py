"""網路普及的擴充（2026-10-31，製作手冊第十批 169）：4G／5G 涵蓋率、男女的網路使用率、國際頻寬、家戶上網與電腦、
數位支付、手機持有、國家資安指數。由 topics/digital.py 呼叫，輸出到同一個資料夾。

- ITU DataHub（世界銀行 Data360 轉載的 ITU_DH：MOB_COV_4G、MOB_COV_5G、INT_BAND_PER_USR、IT_HH_INT、IT_HH_COMP）：
  CC BY-NC-SA 3.0 IGO（Data360 的 license 欄），只准非商業使用，這幾個指標檔照同一種授權（使用者決定照做並在頁尾寫明）。
  datahub.itu.int 從 cloud 回 403，所以用 Data360 的檔。
  - 國際頻寬：Data360 標的單位是 kbit/s，但 ITU 原站的《Core List of Indicators》（2022-03）與《Handbook for the
    Collection of Administrative Data on Telecommunications/ICT 2020》都寫 bits/second（每人），台灣 2023 年的
    4,547,918 若是 kbit/s 等於每位使用者 4.5 Gbit/s，不合理；照 ITU 原站當作 bit/s。
- 男女的網路使用率：World Bank WDI 的 IT.NET.USER.FE.ZS、IT.NET.USER.MA.ZS（ITU 資料，CC BY 4.0）；台灣用數位發展部
  「數位近用調查」（使用者決定）。
- 家戶上網、家戶電腦：台灣用數位部的值（家戶電腦只調查到 2016 年），ITU 的台灣值寫附註（使用者決定）。
- 數位支付、手機持有：World Bank Global Findex Database 2025（CC BY 4.0）的 g20_any、con1、con9a，15 歲以上；
  各國用自己最新的一年（latestWithin，使用者決定），高所得國的數位支付多半只有 2021 年。
- 國家資安指數：ITU Global Cybersecurity Index 2024 的五級（pipeline/data/digital/gci-2024.json，CC BY-NC-SA 3.0 IGO），
  台灣不是 ITU 會員，沒有評比。
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

from common import download, indicator_file, to_series, write_json, year_span
from sources import moda, worldbank

DATA360 = "https://data360files.worldbank.org/data360-data/data/ITU_DH/{code}.csv"
FINDEX = ("https://thedocs.worldbank.org/en/doc/be6615202d1f08a25855c8ac2d615122-0050012025/related/"
          "GlobalFindexDatabase2025.csv")
GCI = Path(__file__).resolve().parent.parent / "data" / "digital" / "gci-2024.json"
NC = {"license": "CC BY-NC-SA 3.0 IGO",
      "attribution": "International Telecommunication Union (ITU), ICT Indicators Database (ITU DataHub), via World Bank Data360"}


def _itu(code: str) -> dict[str, dict[int, float]]:
    path = download(DATA360.format(code=code), "data360", f"ITU_DH-{code}.csv")
    out: dict[str, dict[int, float]] = defaultdict(dict)
    with open(path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["SEX"] != "_Z" or r["URBANISATION"] != "_Z" or not r["OBS_VALUE"]:
                continue
            out[r["REF_AREA"]][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    return out


def _fmt_years(series: dict[int, float], fmt) -> str:
    return "、".join(f"{y} 年 {fmt(v)}" for y, v in sorted(series.items())[-3:])


def _fmt_years_en(series: dict[int, float], fmt) -> str:
    return ", ".join(f"{fmt(v)} in {y}" for y, v in sorted(series.items())[-3:])


def _write(out: Path, name: str, unit: str, data: dict[str, dict[int, float]], first: int, digits: int = 2, **extra) -> list[int]:
    years = [y for y in year_span(data) if y >= first]
    write_json(out / f"{name}.json", indicator_file(
        name, unit, years, {c: to_series(s, years, digits) for c, s in sorted(data.items()) if s}, **extra))
    return years


def build(out: Path) -> None:
    # 4G、5G 的人口涵蓋率
    for name, code in (("coverage-4g", "MOB_COV_4G"), ("coverage-5g", "MOB_COV_5G")):
        data = _itu(code)
        years = _write(out, name, "%", data, 2010, **NC)
        print(f"  {name}：{len(data)} 個經濟體，{years[0]}–{years[-1]}；台灣 {sorted(data['TWN'].items())[-1]}")

    # 男女的網路使用率與差距（女 − 男，百分點）
    women, world_w = worldbank.fetch("IT.NET.USER.FE.ZS", 2000)
    men, world_m = worldbank.fetch("IT.NET.USER.MA.ZS", 2000)
    women["TWN"], men["TWN"] = moda.column("女性網路使用率"), moda.column("男性網路使用率")
    gap = {c: {y: round(women[c][y] - men[c][y], 2) for y in women[c] if y in men.get(c, {})} for c in women}
    tw_note = ("台灣不在 ITU／世界銀行資料庫中，改用數位發展部「數位近用調查」的男性、女性網路使用率（12 歲以上，2021 年沒有調查）",
               "Taiwan is not in the ITU/World Bank database; male and female internet use rates from the Ministry of Digital "
               "Affairs' Digital Access Survey are used instead (age 12 and over; no survey in 2021)")
    for name, data, world in (("internet-women", women, world_w), ("internet-men", men, world_m),
                              ("internet-gender-gap", gap, {y: world_w[y] - world_m[y] for y in world_w if y in world_m})):
        years = _write(out, name, "%" if name != "internet-gender-gap" else "百分點", data, 2000,
                       aggregates={"WLD": to_series(world, [y for y in year_span(data) if y >= 2000], 2)},
                       notes={"TWN": tw_note[0]}, notesEn={"TWN": tw_note[1]})
    tw_gap = sorted(gap["TWN"].items())[-1]
    print(f"  男女的網路使用率：{sum(1 for s in gap.values() if s)} 國；台灣 {tw_gap[0]} 年差 {tw_gap[1]:+.1f}")

    # 每位網路使用者的國際頻寬（bit/s，見上面的說明）
    band = _itu("INT_BAND_PER_USR")
    years = _write(out, "bandwidth-per-user", "bit/s", band, 2005, digits=0, **NC)
    print(f"  國際頻寬：{len(band)} 個經濟體；台灣 2023 年 {band['TWN'].get(2023):,.0f} bit/s")

    # 家戶上網、家戶電腦：台灣用數位部，ITU 的台灣值寫附註
    pct = lambda v: f"{v:.1f}%"  # noqa: E731
    for name, code, moda_col, label in (("household-internet", "IT_HH_INT", "家戶連網率", ("家戶上網率", "household internet access")),
                                        ("household-computer", "IT_HH_COMP", "家戶電腦擁有率", ("家戶電腦擁有率", "household computer ownership"))):
        data = _itu(code)
        itu_tw = data.pop("TWN", {})
        data["TWN"] = moda.column(moda_col)
        zh = f"台灣用數位發展部「數位近用調查」的{label[0]}"
        en = f"Taiwan uses the {label[1]} rate from the Ministry of Digital Affairs' Digital Access Survey"
        if name == "household-computer":
            zh += "（2016 年以後不再調查）"
            en += " (not surveyed after 2016)"
        zh += f"；ITU 的台灣值：{_fmt_years(itu_tw, pct)}"
        en += f"; ITU's figures for Taiwan: {_fmt_years_en(itu_tw, pct)}"
        years = _write(out, name, "%", data, 2000, notes={"TWN": zh}, notesEn={"TWN": en}, latestWithin=4, **NC)
        print(f"  {name}：{len(data)} 個經濟體；台灣（數位部）{sorted(data['TWN'].items())[-1]}，ITU {sorted(itu_tw.items())[-1]}")

    # Findex：數位支付、手機持有、主要用智慧型手機（15 歲以上，各國用自己最新的一年）
    path = download(FINDEX, "worldbank", "GlobalFindexDatabase2025.csv")
    findex: dict[str, dict[str, dict[int, float]]] = {k: defaultdict(dict) for k in ("g20_any", "con1", "con9a")}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["group"] != "all":
                continue
            for k in findex:
                v = r.get(k, "NA")
                if v not in ("", "NA"):
                    findex[k][r["codewb"]][int(r["year"])] = round(float(v) * 100, 2)
    for name, key, within in (("digital-payments", "g20_any", 3), ("mobile-ownership", "con1", 0), ("smartphone-main", "con9a", 0)):
        data = dict(findex[key])
        world = data.pop("WLD", {})
        years = [y for y in year_span(data) if y >= 2014]
        extra = {"aggregates": {"WLD": to_series(world, years, 2)}} if world else {}
        if within:
            extra["latestWithin"] = within
        write_json(out / f"{name}.json", indicator_file(
            name, "%", years, {c: to_series(s, years, 2) for c, s in sorted(data.items()) if s and len(c) == 3}, **extra))
        latest = {c: max(s) for c, s in data.items() if s}
        print(f"  {name}：{len(data)} 個（含區域合計），最新年份 {dict(sorted(((y, sum(1 for v in latest.values() if v == y)) for y in set(latest.values()))))}；"
              f"台灣 {sorted(data.get('TWN', {}).items())}")

    # ITU 國家資安指數 2024 的五級
    gci = json.loads(GCI.read_text(encoding="utf-8"))
    write_json(out / "cybersecurity.json", indicator_file(
        "cybersecurity", "", [2024], {c: [t] for c, t in gci["countries"].items()},
        noValue={"TWN": "台灣不是 ITU 會員，沒有評比"}, noValueEn={"TWN": "Taiwan is not an ITU member and is not assessed"},
        license=gci["license"], attribution="International Telecommunication Union, Global Cybersecurity Index 2024"))
    print(f"  國家資安指數 2024：{len(gci['countries'])} 國")
