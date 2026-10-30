"""最新的兵力（軍事主題的擴充，2026-10-30，製作手冊第七批 130，DESIGN.md 第 8 節第 212 點）。

WDI 的兵力（MS.MIL.TOTL.P1、MS.MIL.TOTL.TF.ZS）停在 2020 年，舊的時間序列留著（topics/military.py）；
這裡另加「現役兵力（最新）」與「每千人現役兵力」，資料是英文維基百科「List of countries by number of military
and paramilitary personnel」（CC BY-SA 4.0，固定 revid，sources/wiki_military_personnel.py），資料檔也用 CC BY-SA 4.0。

- 各國的數字引自 IISS The Military Balance 2024、2025、2026 不同版本，每國的附註寫出處的版本與頁碼，
  另列後備與準軍事部隊的人數；少數國家的出處是維基百科的條目，附註寫明。
- 每千人：現役 ÷ WPP 2024 的年中人口 × 1000；人口用那個版本描述的年份（The Military Balance 2026 描述的是
  2025 年底，用 2025 年的人口；不是 IISS 的用 2025 年）。
- 年份是維基百科那個版本的年份（2026），只有一年。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import wiki_military_personnel as wiki
from sources import wpp
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "military"
LICENSE = "CC BY-SA 4.0"
YEAR = 2026
OTHER_SOURCE_YEAR = 2025  # 出處不是 IISS 時人口用的年份


def _num(v: int) -> str:
    return f"{v:,}"


def build() -> None:
    population = wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"]  # 千人
    active: dict[str, list[float]] = {}
    per_thousand: dict[str, list[float]] = {}
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    unknown = []
    for r in wiki.rows():
        iso3 = from_name(r.country)
        if not iso3:
            unknown.append(r.country)
            continue
        if iso3 in active:
            raise RuntimeError(f"兵力表的 {r.country} 重複")
        active[iso3] = [r.active]
        pop_year = r.edition - 1 if r.edition else OTHER_SOURCE_YEAR
        if pop := population.get(iso3, {}).get(pop_year):
            per_thousand[iso3] = [round(r.active / (pop * 1000) * 1000, 2)]
        others = f"後備 {_num(r.reserve)} 人、準軍事部隊 {_num(r.paramilitary)} 人"
        others_en = f"reserves {_num(r.reserve)}, paramilitary {_num(r.paramilitary)}"
        if r.edition:
            notes[iso3] = f"出處：IISS The Military Balance {r.edition}，第 {r.pages} 頁（{others}）"
            notes_en[iso3] = f"Source: IISS, The Military Balance {r.edition}, p. {r.pages} ({others_en})"
        else:
            notes[iso3] = f"出處：英文維基百科的條目「{r.article}」，不是 IISS（{others}）"
            notes_en[iso3] = f"Source: the English Wikipedia article “{r.article}”, not IISS ({others_en})"
    if unknown:
        raise RuntimeError(f"國名對不到 ISO3：{unknown}")
    OUT.mkdir(parents=True, exist_ok=True)
    for name, unit, values in (("active-latest", "人", active), ("active-per-1000", "人/千人", per_thousand)):
        write_json(OUT / f"{name}.json", indicator_file(
            name, unit, [YEAR], dict(sorted(values.items())), license=LICENSE, notes=notes, notesEn=notes_en))
    top = sorted(((v[0], k) for k, v in active.items()), reverse=True)[:6]
    print(f"  {len(active)} 國；最多 {top}；台灣 {active.get('TWN')}、每千人 {per_thousand.get('TWN')}")


if __name__ == "__main__":
    build()
