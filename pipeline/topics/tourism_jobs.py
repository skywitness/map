"""觀光：住宿及餐飲業的就業比例（2026-11-04，製作手冊第二十一批 357；使用者指定改成就業比例）。

- ILOSTAT 的 EMP_TEMP_SEX_ECO_NB（依行業的就業人數，CC BY 4.0）：ISIC Rev.4 的 I 類「住宿及餐飲業」÷ 全部行業
  （ECO_SECTOR_TOTAL），男女合計，標為不可靠（U）的不收，2000 年起。這一份 ILOSTAT 有台灣（LFS，2001–2020 年）。
- 台灣 2021 年以後用主計總處人力資源調查的「住宿及餐飲業」與總計（dgbas.py 的 A040103050），今年還沒結束的不收。
- 住宿及餐飲業不等於觀光業（在地人的外食也在裡面，航空與旅行社不在），只能看大概。
"""
from __future__ import annotations

import csv
from collections import defaultdict
from datetime import date

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import dgbas
from sources.osm_coverage import _ilo

OUT = OUT_DIR / "topics" / "tourism"
FIRST = 2000


def _ilo_all(eco: str) -> dict[str, dict[int, float]]:
    """{iso3: {年: 千人}}（_ilo 只留最近一年，這裡要整個序列）"""
    from common import download
    from sources.osm_coverage import ILO_URL
    path = download(ILO_URL.format(eco=eco, start=FIRST), "ilostat", f"EMP_TEMP_SEX_ECO_NB-{eco}-{FIRST}.csv")
    out: dict[str, dict[int, float]] = defaultdict(dict)
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["OBS_STATUS"] == "U" or not r["OBS_VALUE"] or len(r["REF_AREA"]) != 3 or r["REF_AREA"].startswith("X"):
                continue
            out[r["REF_AREA"]][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    return out


def build() -> None:
    _ilo("ECO_ISIC4_I", 2015)  # 確保快取（重試 403）
    food = _ilo_all("ECO_ISIC4_I")
    total = _ilo_all("ECO_SECTOR_TOTAL")
    header, data = dgbas._table("A040103050", 106, "0,20", "0,1")
    this_year = date.today().year
    for y, row in data.items():
        if y >= this_year or y < 2021:
            continue
        cells = dict(zip(header, row))
        food.setdefault("TWN", {})[y] = float(dgbas._num(cells["住宿及餐飲業"]))
        total.setdefault("TWN", {})[y] = float(dgbas._num(cells["總計"]))
    share = {c: {y: v / total[c][y] * 100 for y, v in s.items() if total.get(c, {}).get(y)} for c, s in food.items()}
    share = {c: s for c, s in share.items() if s}
    years = sorted({y for s in share.values() for y in s})
    write_json(OUT / "hospitality-jobs-share.json", indicator_file(
        "hospitality-jobs-share", "%", years, {c: to_series(s, years, 2) for c, s in sorted(share.items())}, latestWithin=5,
        notes={"TWN": "2001–2020 年是 ILOSTAT（台灣的人力資源調查），2021 年起用主計總處人力資源調查"},
        notesEn={"TWN": "2001–2020 from ILOSTAT (Taiwan’s labour force survey), from 2021 DGBAS Manpower Survey"}))
    write_json(OUT / "hospitality-jobs.json", indicator_file(
        "hospitality-jobs", "千人", years, {c: to_series({y: v for y, v in s.items() if y in years}, years, 1) for c, s in sorted(food.items()) if c in share},
        latestWithin=5))
    last = {c: (max(s), s[max(s)]) for c, s in share.items()}
    recent = sorted(((round(v, 1), c, y) for c, (y, v) in last.items() if y >= 2020), reverse=True)
    print(f"  住宿及餐飲業就業比例：{len(share)} 國，{years[0]}–{years[-1]}；2020 年以後有資料 {len(recent)} 國")
    print(f"  最高 {recent[:10]}；最低 {recent[-6:]}")
    print(f"  台灣 {sorted(share['TWN'].items())[-4:]}；美國 {last.get('USA')}；日本 {last.get('JPN')}；泰國 {last.get('THA')}")
