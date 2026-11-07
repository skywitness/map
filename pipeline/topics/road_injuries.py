"""交通安全的擴充：車禍的受傷人數與事故件數（2026-11-07，製作手冊第二十七批 575，候選 1295；步驟 road-injuries，
輸出 topics/road-safety/）。

- OECD／ITF 的年度道路安全趨勢（SDMX `OECD.ITF,DSD_TRENDS@DF_TRENDSSAFETY,1.0`，56 國、1970–2025；OECD 的條款可以
  轉載、改作，要註明出處）：受傷人數（INJURED）、有人受傷的事故件數（CRASHES）、死亡（FATALITIES，30 天內）。
  另算每千名受傷者的死亡人數（同一年都有值的）。手冊的陷阱：受傷的定義各國差很多（有的只收住院、有的收所有報案），
  說明寫「看趨勢、不要比大小」；ITF 的 Injured 含輕傷。OBS_STATUS = B 的序列斷點只寫在說明。
- 台灣：ITF 沒有台灣，用交通部統計查詢網「道路交通事故(30日內)─按駕乘車種分」（表 127，map-plan 的 data/motc/，
  sources/motc.py）的死亡、受傷人數（2008 年起，今年還沒過完的不算）；台灣沒有事故件數。
- 側欄：這一國死亡、受傷、事故件數三條線，各自以第一個三者都有的年份 = 100（不用雙軸）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import motc, oecd

OUT = OUT_DIR / "topics" / "road-safety"
FLOW = "OECD.ITF,DSD_TRENDS@DF_TRENDSSAFETY,1.0"
TWN_LAST = 2025
MIN_INJURED = 500  # 受傷不到 500 人的國家一兩個人就差很多（列支敦斯登），不算比值


def _file(name: str, unit: str, data: dict[str, dict[int, float]], years: list[int], **extra) -> None:
    values = {c: [s.get(y) for y in years] for c, s in sorted(data.items()) if any(y in s for y in years)}
    write_json(OUT / f"{name}.json", indicator_file(name, unit, years, values, **extra))


def build() -> None:
    injured, _ = oecd.series(FLOW, MEASURE="INJURED")
    crashes, _ = oecd.series(FLOW, MEASURE="CRASHES")
    deaths, _ = oecd.series(FLOW, MEASURE="FATALITIES")
    tw_inj = {y: v for y, v in motc.annual(motc.DEATHS_BY_USER, "受傷人數(人)", "總計").items() if y <= TWN_LAST}
    tw_dead = {y: v for y, v in motc.annual(motc.DEATHS_BY_USER, "死亡人數(人)", "總計").items() if y <= TWN_LAST}
    injured["TWN"], deaths["TWN"] = tw_inj, tw_dead
    years = sorted({y for s in list(injured.values()) + list(crashes.values()) for y in s})
    tw_note = ("交通部統計查詢網的 30 日內死傷（ITF 沒有台灣）", "Taiwan’s MOTC statistics, deaths within 30 days (ITF does not cover Taiwan)")
    hints = {"TWN": tw_note[0]}
    hints_en = {"TWN": tw_note[1]}
    _file("road-injured", "人", injured, years, hints=hints, hintsEn=hints_en, license="OECD")
    _file("injury-crashes", "件", crashes, years, noValue={"TWN": "交通部的統計沒有事故件數"},
          noValueEn={"TWN": "Taiwan’s MOTC statistics have no crash counts"}, license="OECD")
    ratio = {}
    for c, inj in injured.items():
        d = deaths.get(c, {})
        r = {y: round(d[y] / inj[y] * 1000, 1) for y in inj if y in d and inj[y] >= MIN_INJURED}
        if r:
            ratio[c] = r
    _file("deaths-per-1000-injured", "人／千名受傷者", ratio, years, hints=hints, hintsEn=hints_en, license="OECD")

    detail = {}
    for c in sorted(set(injured) | set(crashes)):
        detail[c] = {k: [s.get(c, {}).get(y) for y in years] for k, s in (("f", deaths), ("i", injured), ("c", crashes))}
    write_json(OUT / "road-injuries-detail.json", {"years": years, "countries": detail, "license": "OECD"})

    print(f"  受傷 {len(injured)} 國、事故 {len(crashes)} 國，{years[0]}–{years[-1]}")
    for c in ("DEU", "JPN", "TUR", "KOR", "FRA", "ITA", "TWN"):
        print(f"    {c} 2023 受傷 {injured.get(c, {}).get(2023)}、事故 {crashes.get(c, {}).get(2023)}、死亡 {deaths.get(c, {}).get(2023)}、"
              f"每千名受傷者死亡 {ratio.get(c, {}).get(2023)}")
    r23 = sorted((v[2023], c) for c, v in ratio.items() if 2023 in v)
    print(f"  2023 每千名受傷者死亡：{r23[:6]} … {r23[-8:]}")
