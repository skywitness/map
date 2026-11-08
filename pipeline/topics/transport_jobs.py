"""運輸與倉儲業的就業（新主題，2026-11-07，製作手冊第二十七批 585，候選 1305；步驟 transport-jobs，
輸出 topics/transport-jobs/）。

- ILOSTAT SDMX `DF_EMP_TEMP_SEX_ECO_NB`（就業人數依經濟活動，千人，CC BY 4.0）：ECO_ISIC4_H（運輸與倉儲，含郵政與快遞 H53）
  與 ECO_ISIC4_TOTAL，男女合計，2000 年起。key 要 5 段（`.A..SEX_T.<ECO>`）。sdmx.ilo.org 偶爾回 403 或 504，等一下再試。
  OBS_STATUS 是 U（不可靠）的不收。比例 = H ÷ TOTAL，同一年都有才算。各國最近一年不同（latestWithin 5）。
- 台灣：ILO 只到 2020 年（主計總處人力資源調查），改用主計總處 A040103050「就業者－按行業分」（跟 `osm_coverage.py` 共用快取）
  的「運輸及倉儲業」與「總計」，年平均，只收已過完的年份；2016 年以前接 ILO 的值（也是人力資源調查）。
"""
from __future__ import annotations

import csv
import time
import urllib.error
from datetime import date

from common import OUT_DIR, download, indicator_file, write_json
from sources import dgbas

OUT = OUT_DIR / "topics" / "transport-jobs"
URL = "https://sdmx.ilo.org/rest/data/ILO,DF_EMP_TEMP_SEX_ECO_NB,1.0/.A..SEX_T.{eco}?format=csv&startPeriod=2000"
LATEST = 5


def _ilo(eco: str) -> dict[str, dict[int, float]]:
    for attempt in range(4):
        try:
            path = download(URL.format(eco=eco), "ilostat", f"EMP_TEMP_SEX_ECO_NB-{eco}-2000.csv")
            break
        except urllib.error.HTTPError as e:
            if e.code not in (403, 502, 503, 504) or attempt == 3:
                raise
            time.sleep(15 * (attempt + 1))
    out: dict[str, dict[int, float]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["OBS_STATUS"] == "U" or not r["OBS_VALUE"] or len(r["REF_AREA"]) != 3 or r["REF_AREA"].startswith("X"):
                continue
            out.setdefault(r["REF_AREA"], {})[int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"]) * 1000
    return out


def _taiwan() -> tuple[dict[int, float], dict[int, float]]:
    header, data = dgbas._table("A040103050", 106, "0,20", "0,1")
    rows = {y: dict(zip(header, v)) for y, v in data.items() if y < date.today().year}
    return ({y: float(dgbas._num(r["運輸及倉儲業"])) * 1000 for y, r in rows.items()},
            {y: float(dgbas._num(r["總計"])) * 1000 for y, r in rows.items()})


def build() -> None:
    jobs, total = _ilo("ECO_ISIC4_H"), _ilo("ECO_ISIC4_TOTAL")
    # 台灣：主計總處 2017 年起的表接在 ILO（也是主計總處的人力資源調查）2016 年以前的值後面
    tw_jobs, tw_total = _taiwan()
    jobs["TWN"] = {**{y: v for y, v in jobs.get("TWN", {}).items() if y < min(tw_jobs)}, **tw_jobs}
    total["TWN"] = {**{y: v for y, v in total.get("TWN", {}).items() if y < min(tw_total)}, **tw_total}
    note = ({"TWN": "主計總處人力資源調查（就業者按行業分）"}, {"TWN": "DGBAS Manpower Survey (employment by industry)"})
    years = sorted({y for s in jobs.values() for y in s})
    write_json(OUT / "workers.json", indicator_file(
        "transport-workers", "人", years, {c: [round(s[y]) if y in s else None for y in years] for c, s in sorted(jobs.items())},
        hints=note[0], hintsEn=note[1], latestWithin=LATEST, license="CC BY 4.0"))
    share = {c: {y: v / total[c][y] * 100 for y, v in s.items() if total.get(c, {}).get(y)} for c, s in jobs.items()}
    share = {c: s for c, s in share.items() if s}
    write_json(OUT / "share.json", indicator_file(
        "transport-workers-share", "%", years, {c: [round(s[y], 3) if y in s else None for y in years] for c, s in sorted(share.items())},
        hints=note[0], hintsEn=note[1], latestWithin=LATEST, license="CC BY 4.0"))

    latest = {c: (max(s), s[max(s)]) for c, s in jobs.items() if max(s) >= date.today().year - 1 - LATEST}
    print(f"  {len(jobs)} 國（近 {LATEST} 年有值的 {len(latest)} 國）：{[(c, y, round(v)) for c, (y, v) in sorted(latest.items(), key=lambda x: -x[1][1])[:12]]}")
    print(f"  台灣 {[(y, round(jobs['TWN'][y])) for y in sorted(jobs['TWN'])[-3:]]}")
    ls = {c: (max(s), round(s[max(s)], 2)) for c, s in share.items() if max(s) >= date.today().year - 1 - LATEST}
    print(f"  比例：{sorted(((v, c, y) for c, (y, v) in ls.items()), reverse=True)[:12]} … {sorted((v, c, y) for c, (y, v) in ls.items())[:8]}")
    print(f"  台灣 {ls.get('TWN')} 日本 {ls.get('JPN')} 南韓 {ls.get('KOR')} 美國 {ls.get('USA')} 德國 {ls.get('DEU')}")
