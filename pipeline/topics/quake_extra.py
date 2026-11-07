"""地震的經濟損失與房屋毀損、各國史上最大的地震規模與地震密度（2026-11-07，製作手冊第二十七批 540，候選 1219、1240；
擴充「地震與火山」；步驟 quake-extra，輸出到 topics/earthquakes/）。

- 損失、房屋、受傷：NOAA NCEI 全球重大地震資料庫（sources/ncei.py 同一批快取的頁，1900 年起；公有領域，doi:10.7289/V5TD9V7K）。
  damageMillionsDollarsTotal（百萬美元，當年的名目金額，沒有通膨調整）、housesDestroyedTotal、injuriesTotal，沒有 Total 的用
  不含次生災害的欄；只有數量級（AmountOrder）的不算。國家用 NOAA 的國名（earthquakes.noaa_iso3），跟地震死亡人數（依震央）不同：
  損失記在受災的國家。
- 史上最大的規模（max-magnitude）：USGS ComCat 1900 年起規模 6 以上的地震（earthquakes 步驟輸出的 quakes.json），
  國家歸屬同 earthquakes：震央在國界內或離岸 50 公里以內，更遠但 NOAA 記錄有人死亡的照 NOAA 的國名。
  早年的規模是不同方法估的，1960 年以前不要跟現在直接比。
- 地震密度（quake-density）：同一批地震，每萬平方公里陸地有幾次（FAOSTAT 的陸地面積，oceans.land_areas）。
- 側欄：quake-costliest.json，每國損失最大的 8 次（年、月日、規模、損失、全毀棟數、地點）。
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import date

from common import CACHE_DIR, indicator_file, load_points_json, read_points_file, write_json
from topics.earthquakes import OUT, START_YEAR, noaa_iso3
from topics.oceans import land_areas


def _ncei_items() -> list[dict]:
    """earthquakes 步驟下載的 NOAA 頁（ncei._pages 的快取），原樣讀出所有欄位"""
    files = sorted((CACHE_DIR / "ncei").glob(f"earthquakes_{START_YEAR}-now_p*.json"))
    if not files:
        raise SystemExit("找不到 NOAA 的快取：先跑 earthquakes 步驟")
    items: list[dict] = []
    for f in files:
        items += json.loads(f.read_text(encoding="utf-8"))["items"]
    return items


def _num(it: dict, field: str) -> float | None:
    v = it.get(f"{field}Total", it.get(field))
    return float(v) if v is not None else None


def build() -> None:
    this_year = date.today().year
    items = _ncei_items()
    damage: Counter = Counter()
    houses: Counter = Counter()
    injuries: Counter = Counter()
    costliest: dict[str, list[list]] = defaultdict(list)
    unknown: Counter = Counter()
    for it in items:
        c = noaa_iso3(it.get("country") or "")
        if not c:
            unknown[it.get("country")] += 1
            continue
        d, h, inj = _num(it, "damageMillionsDollars"), _num(it, "housesDestroyed"), _num(it, "injuries")
        if d:
            damage[c] += d
            md = (it.get("month") or 0) * 100 + (it.get("day") or 0)
            costliest[c].append([it["year"], md, it.get("eqMagnitude"), round(d, 1), int(h) if h else None, (it.get("locationName") or "").strip()])
        if h:
            houses[c] += h
        if inj:
            injuries[c] += inj
    print(f"  NOAA 1900 年起 {len(items)} 筆；有金額 {sum(1 for it in items if _num(it, 'damageMillionsDollars'))}、"
          f"有全毀棟數 {sum(1 for it in items if _num(it, 'housesDestroyed'))}；國名對不到 {sum(unknown.values())} 筆 {unknown.most_common(6)}")
    for name, counter, unit in (("quake-damage", damage, "million US$"), ("quake-houses", houses, "houses"), ("quake-injuries", injuries, "people")):
        write_json(OUT / f"{name}.json", indicator_file(
            name, unit, [this_year], {c: [round(v, 1) if unit == "million US$" else round(v)] for c, v in sorted(counter.items())},
            aggregates={"WLD": [round(sum(counter.values()), 1)]}))
        top = counter.most_common(12)
        rank = sorted(counter, key=lambda k: -counter[k])
        print(f"  {name}：{[(k, round(v)) for k, v in top]}；台灣 {round(counter.get('TWN', 0))}（第 {rank.index('TWN') + 1 if 'TWN' in rank else '-'} 名）")
    write_json(OUT / "quake-costliest.json", {
        "fields": ["year", "md", "mag", "damage", "houses", "place"],
        "countries": {c: sorted(rows, key=lambda r: -r[3])[:8] for c, rows in sorted(costliest.items())},
    })

    # ── 史上最大的規模、地震密度（USGS 規模 6 以上，1900 年起）──
    # 用 earthquakes 步驟輸出的 quakes.json：國家歸屬已經照那邊的規則（離岸 50 公里內；更遠但 NOAA 記錄有人死亡的照 NOAA 的國名，
    # 所以 2011 年東北地震算日本），不必再對一次 NOAA
    quakes = read_points_file(load_points_json(OUT / "quakes.json"))
    largest: dict[str, tuple[float, int]] = {}
    count: Counter = Counter()
    for q in quakes:
        c, mag = q.get("iso3"), q.get("mag")
        if not c or mag is None:
            continue
        count[c] += 1
        if c not in largest or mag > largest[c][0]:
            largest[c] = (float(mag), int(q["year"]))
    write_json(OUT / "max-magnitude.json", indicator_file(
        "max-magnitude", "magnitude", [this_year], {c: [round(m, 1)] for c, (m, _y) in sorted(largest.items())}))
    areas = land_areas()
    density = {c: [round(n / areas[c] * 1e4, 2)] for c, n in sorted(count.items()) if areas.get(c)}
    write_json(OUT / "quake-density.json", indicator_file("quake-density", "per 10,000 km²", [this_year], density))
    big = sorted(((m, y, c) for c, (m, y) in largest.items()), reverse=True)
    print(f"  USGS 規模 6 以上 {len(quakes)} 筆，有國家的 {sum(count.values())} 筆（{len(count)} 國）；最大 {big[:14]}；台灣 {largest.get('TWN')}")
    dens = sorted(((v[0], c, count[c]) for c, v in density.items() if count[c] >= 5), reverse=True)
    print(f"  密度（5 次以上）：{dens[:14]}；台灣 {density.get('TWN')}（{count.get('TWN')} 次）、日本 {density.get('JPN')}")
    missing_area = [c for c in count if not areas.get(c)]
    print(f"  沒有陸地面積的：{missing_area}")
