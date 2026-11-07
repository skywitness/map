"""熱帶氣旋的累積氣旋能量 ACE（2026-11-07，製作手冊第二十五批 479，候選 1144；擴充「颱風與颶風」）。

ACE＝每 6 小時（00、06、12、18 UTC）的最大持續風速（kt）平方加總 ÷ 10⁴，只算熱帶風暴以上的熱帶時刻
（USA_SSHS ≥ 0，也就是熱帶性質而且風速 ≥ 34 kt；副熱帶、溫帶、擾動階段不算）。風速只用美國機構的 USA_WIND
（1 分鐘平均），不混日本氣象廳的 10 分鐘風速。資料與 topics/typhoons.py 同一份 IBTrACS（sources/ibtracs.py 的快取），
颱風的篩選（select）、「經過這一國」的規則（passes：中心進入國界或 100 公里內、當時達熱帶風暴）也沿用 typhoons.py。

輸出 public/data/topics/typhoons/：
- ace-year/usa.json：這一年經過這一國的颱風，各自整個生命期的 ACE 加總（同一個颱風可以算好幾國）；
  北印度洋與南半球 1980 年以前沒有美國機構的風速，依賴這些海域的國家 1980 年以前不算（跟次數一樣）；
  ace-year/jma.json：上面「風速」選日本氣象廳時沒有值（noValue 寫原因）。
- ace-basins.json：六個海域（西北太平洋、北大西洋、東北太平洋、北印度洋、南印度洋、南太平洋）每年的 ACE，
  依颱風生成的年份（南半球的季拆在兩個年份，跟主題的時間軸一樣），1991–2020 年平均；側欄畫折線。
"""

from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import ibtracs
from topics import typhoons as ty

OUT = OUT_DIR / "topics" / "typhoons"
BASINS = ["WP", "NA", "EP", "NI", "SI", "SP"]
NORMAL = (1991, 2020)


def storm_ace(storm) -> tuple[float, dict[str, float]]:
    """(整個颱風的 ACE, {海域: ACE})"""
    total = 0.0
    by_basin: dict[str, float] = defaultdict(float)
    for f in storm.fixes:
        if f.synoptic and f.sshs is not None and f.sshs >= 0 and f.wind is not None and f.wind >= ty.TS_KT:
            v = f.wind ** 2 / 1e4
            total += v
            by_basin[f.basin] += v
    return total, by_basin


def build() -> None:
    from datetime import date

    this_year = date.today().year
    years = list(range(ty.START_YEAR, this_year + 1))
    storms = ibtracs.storms(ty.START_YEAR)
    tracks = ty.select(storms)
    ace = []
    basin_year: dict[str, dict[int, float]] = {b: defaultdict(float) for b in BASINS}
    for t in tracks:
        total, by_basin = storm_ace(t.storm)
        ace.append(total)
        for b, v in by_basin.items():
            if b in basin_year:
                basin_year[b][t.year] += v

    index = ty.NearIndex()
    all_passes = ty.passes(tracks, index)
    counted = [p for p in all_passes if p.counted]
    recent: dict[str, list] = defaultdict(list)
    for p in counted:
        if tracks[p.track].year >= ty.PARTIAL_FROM:
            recent[p.country].append(p)
    partial = {c for c, ps in recent.items()
               if sum(1 for p in ps if p.basins & set(ty.US_WIND_FROM)) / len(ps) >= ty.PARTIAL_SHARE}
    per_year: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for p in counted:
        per_year[p.country][tracks[p.track].year] += ace[p.track]

    codes = sorted(index.codes)
    values = {c: [None if (c in partial and y < ty.PARTIAL_FROM) else round(per_year[c].get(y, 0.0), 1) for y in years]
              for c in codes}
    world = [round(sum(basin_year[b].get(y, 0.0) for b in BASINS), 1) if y >= ty.PARTIAL_FROM else None for y in years]
    notes = {c: ty.PARTIAL_NOTE["zh"] for c in partial}
    notes_en = {c: ty.PARTIAL_NOTE["en"] for c in partial}
    write_json(OUT / "ace-year" / "usa.json", indicator_file(
        "ace-year", "10⁴ kt²", years, values, aggregates={"WLD": world}, notes=notes, notesEn=notes_en))
    no = {c: "累積氣旋能量只用美國機構的 1 分鐘風速算，上面的「風速」請選美國機構" for c in codes}
    no_en = {c: "Accumulated cyclone energy uses US 1-minute winds only; choose US agencies under Winds above" for c in codes}
    write_json(OUT / "ace-year" / "jma.json", indicator_file("ace-year", "10⁴ kt²", years, {}, noValue=no, noValueEn=no_en))

    normal = {b: round(sum(basin_year[b].get(y, 0.0) for y in range(NORMAL[0], NORMAL[1] + 1)) / (NORMAL[1] - NORMAL[0] + 1), 1)
              for b in BASINS}
    write_json(OUT / "ace-basins.json", {
        "years": years, "normal": normal, "normalYears": list(NORMAL),
        # 北印度洋與南半球 1980 年以前沒有美國機構的風速
        "basins": {b: [round(basin_year[b].get(y, 0.0), 1) if (b not in ty.US_WIND_FROM or y >= ty.PARTIAL_FROM) else None
                       for y in years] for b in BASINS},
    })
    last = this_year - 1
    print("  海域 ACE " + "、".join(f"{b} {last} 年 {basin_year[b].get(last, 0):.1f}（常年 {normal[b]}）" for b in BASINS))
    top = sorted(((per_year[c].get(last, 0.0), c) for c in codes), reverse=True)[:8]
    print(f"  {last} 年經過的颱風 ACE 最多：" + "、".join(f"{c} {v:.1f}" for v, c in top))
