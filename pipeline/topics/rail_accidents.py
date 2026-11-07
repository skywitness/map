"""鐵路的擴充：搭火車有多安全——鐵路事故的死傷（2026-11-07，製作手冊第二十七批 567，候選 1280；步驟 rail-accidents，
輸出 topics/transport/）。

- Eurostat `rail_ac_catvict`（重大鐵路事故的死傷人數，依事故類型 × 死／傷 × 身分：旅客 PAS、員工 EMP、其他 OTH〔平交道使用者、
  擅自進入路線的人等〕、不明 UNK；2004–2015 年）與 `rail_ac_catnmbr`（重大事故件數，依事故類型，2004–2016 年）。
  Eurostat 2016 年後不再收（移交歐盟鐵路局 ERA 的共同安全指標 CSI）；自殺不算在這兩個表裡。
- ERA 的 CSI xlsx（延到 2023 年）沒有用：ERA 網站找不到法律聲明（`/legal-notice_en` 等 2026-11-07 仍是 404），
  授權待使用者決定；兩套序列口徑也不同，不能直接接。
- 台灣：臺鐵的「行車事故件數及傷亡人數」（政府資料開放平臺 37932）下載點 ods.railway.gov.tw 從 cloud 連不上，
  等本機 session 放進 map-plan 的 data/tra/ 再補側欄（口徑跟 Eurostat 不同，不上地圖）。
- CC BY 4.0；英國、科索沃由 sources/eurostat.py 統一排除。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "transport"
PERSONS = ("PAS", "EMP", "OTH", "UNK")
TYPES = ("COLLIS", "DERAIL", "LVLCROS", "RSTK_MOT", "RSTK_FIRE", "OTH", "UNK")


def _file(name: str, data: dict[str, dict[int, float]], unit: str) -> list[int]:
    years = sorted({y for s in data.values() for y in s})
    write_json(OUT / f"{name}.json", indicator_file(
        name, unit, years, {c: [s.get(y) for y in years] for c, s in sorted(data.items())}, license="CC BY 4.0"))
    return years


def build() -> None:
    deaths = eurostat.series("rail_ac_catvict", unit="NR", accident="TOTAL", victim="KIL", pers_cat="TOTAL")
    passengers = eurostat.series("rail_ac_catvict", unit="NR", accident="TOTAL", victim="KIL", pers_cat="PAS")
    accidents = eurostat.series("rail_ac_catnmbr", unit="NR", accident="TOTAL")
    _file("rail-deaths", deaths, "人")
    _file("rail-passenger-deaths", passengers, "人")
    _file("rail-accidents", accidents, "件")

    # 側欄：死者的身分、事故的類型（件數），每國每年
    by_person = {p: eurostat.series("rail_ac_catvict", unit="NR", accident="TOTAL", victim="KIL", pers_cat=p) for p in PERSONS}
    by_type = {t: eurostat.series("rail_ac_catnmbr", unit="NR", accident=t) for t in TYPES}
    years = list(range(2004, 2017))
    detail = {}
    for c in sorted(set(deaths) | set(accidents)):
        row = {
            "k": {p: [by_person[p].get(c, {}).get(y) for y in years] for p in PERSONS if by_person[p].get(c)},
            "a": {t: [by_type[t].get(c, {}).get(y) for y in years] for t in TYPES if by_type[t].get(c)},
        }
        detail[c] = row
    write_json(OUT / "rail-accidents-detail.json", {"years": years, "countries": detail, "license": "CC BY 4.0"})

    eu = eurostat.series("rail_ac_catnmbr", extra_geos=("EU27_2020",), unit="NR", accident="TOTAL").get("EU27_2020", {})
    der = eurostat.series("rail_ac_catnmbr", extra_geos=("EU27_2020",), unit="NR", accident="DERAIL").get("EU27_2020", {})
    print(f"  死亡 {len(deaths)} 國、旅客 {len(passengers)} 國、事故 {len(accidents)} 國；EU27 事故 {eu.get(2006)} → {eu.get(2015)}、"
          f"出軌 {der.get(2006)} → {der.get(2015)}")
    for c in ("POL", "DEU", "HUN", "ROU", "FRA", "TUR", "CZE", "ESP"):
        print(f"    {c} 死亡 {deaths.get(c, {}).get(2004)} → {deaths.get(c, {}).get(2015)}；旅客 2015 {passengers.get(c, {}).get(2015)}；"
              f"事故 2015 {accidents.get(c, {}).get(2015)}")
