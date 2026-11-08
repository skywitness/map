"""博物館與美術館的擴充：最大的美術館、歐洲城市的博物館參觀人次、畫廊的密度（2026-11-08，製作手冊第二十七批 639，
候選 1397、1400、1401；步驟 museums-extra，輸出 topics/museums/）。

- **最大的美術館**：英文維基「List of largest art museums」固定版本（revid 1381300801，/wiki/?oldid=；手冊寫的 Special:Export
  被 robots.txt 禁止）的第一張表（第二張是規劃中的，不收），展覽面積（gallery space，m²）與成立年份；CC BY-SA 4.0，
  只引用事實。座標用條目在 Wikidata 的 P625（CC0），沒有就用城市的。
- **歐洲城市的博物館參觀人次**：Eurostat `urb_ctour` 的 CR1007V（CC BY 4.0），城市的位置用 sources/urban_audit.py 的
  Wikidata 名稱比對（快取另用 ctour- 開頭，跟第二十一批的城市分開）。同一個都市有 city（…C）與 greater city（…K）兩列時
  只留 greater city（手冊：不要加總）；英國、科索沃照規則不收。
- **畫廊**：OpenStreetMap `tourism=gallery`（ODbL 1.0，多半是商業畫廊，跟 Wikidata 的美術館不同），各國處數與每百萬人
  （只替覆蓋良好的國家上色）。
"""
from __future__ import annotations

import json
import re
from collections import Counter

from common import CACHE_DIR, OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import osm_coverage, osm_qlever, urban_audit, wpp
from sources import wikipedia_html as H
from sources.countries import from_name
from topics.attractions_extra import wiki_items

OUT = OUT_DIR / "topics" / "museums"
YEAR = 2026
LARGEST = ("List_of_largest_art_museums", 1381300801)
MIN_POPULATION = 100  # 千人
COUNTRY_FIX = {"United States": "USA", "United Kingdom": "GBR", "Vatican City": "VAT", "Russia": "RUS", "South Korea": "KOR",
               "Taiwan": "TWN"}


def _largest() -> None:
    rows = H.tables(H.page(*LARGEST))[0][1:]
    items = []
    for r in rows:
        if len(r) < 7:
            continue
        m = re.match(r"([\d,]+)", r[5][0])
        if not m:
            continue
        items.append({"rank": int(re.sub(r"\D", "", r[0][0]) or 0), "en": r[2][0], "links": r[2][1][:1] + r[3][1][:1],
                      "city": r[3][0], "iso3": COUNTRY_FIX.get(r[4][0]) or from_name(r[4][0]), "a": int(m.group(1).replace(",", "")),
                      "y": int(y.group(1)) if (y := re.search(r"(\d{3,4})", r[6][0])) else None})
    coords = wiki_items([t for it in items for t in it["links"]])
    out, missing = [], []
    for it in items:
        hit, ct = None, 0
        for j, t in enumerate(it["links"]):
            c = coords.get(t[0].upper() + t[1:])
            if c and c["lon"] is not None:
                hit, ct = c, j
                break
        if not hit or not it["iso3"]:
            missing.append((it["en"], it["city"]))
            continue
        out.append({"lon": hit["lon"], "lat": hit["lat"], "a": it["a"], "r": it["rank"], "y": it["y"], "ct": ct, "iso3": it["iso3"],
                    "en": it["en"], "zh": hit["zh"] if ct == 0 else None, "city": it["city"]})
    write_points(OUT / "largest.json", points_file(out, ["lon", "lat", "a", "r", "y", "ct", "iso3", "en", "zh", "city"],
                                                   {"lon": 0.001, "lat": 0.001, "a": 1, "r": 1, "y": 1, "ct": 1}, strings=("iso3",)), ("en", "zh", "city"))
    by = Counter(o["iso3"] for o in out)
    print(f"  最大的美術館：表上 {len(items)} 館、畫出 {len(out)} 館（{len(by)} 國：{by.most_common(8)}）；沒座標 {missing}")
    print("    台灣：" + "、".join(f"{o['en']} {o['a']:,} m²（第 {o['r']}）" for o in out if o["iso3"] == "TWN"))


def _cities() -> None:
    labels, data = urban_audit.series("urb_ctour", "CR1007V")
    keep = {}
    for code in data:
        base = code[:-1]
        if code.endswith("C") and base + "K" in data:
            continue  # 有 greater city 就只留它
        keep[code] = data[code]
    real = urban_audit._wdqs
    need: dict[str, set[str]] = {}
    for c in keep:
        need.setdefault(c[:2], set()).add(c)

    def cached_first(q: str, cc: str) -> list[dict]:
        """先用第二十一批（自行車、通勤）查過的同一國快取；那一份已經有這次所有城市的名稱就不再查 QLever
        （2026-11-08：瑞士那一支連回 8 次 429）"""
        old = CACHE_DIR / "wikidata" / f"urban-audit-{cc}.json"
        rows = json.loads(old.read_text(encoding="utf-8"))["results"]["bindings"] if old.exists() else []
        have = {r["name"]["value"] for r in rows}
        if old.exists() or all(any(n in have for n in urban_audit._names(labels[c], c)) for c in need.get(cc, ())):
            # 2026-11-08：QLever 一直回 429，有舊快取的國家就只用舊快取，對不到的城市不畫（數量印出來）
            new = CACHE_DIR / "wikidata" / f"urban-audit-ctour-{cc}.json"
            return rows + (json.loads(new.read_text(encoding="utf-8"))["results"]["bindings"] if new.exists() else [])
        return rows + real(q, f"ctour-{cc}")

    urban_audit._wdqs = cached_first
    try:
        where = urban_audit.locate({c: labels[c] for c in keep})
    finally:
        urban_audit._wdqs = real
    years = sorted({y for v in keep.values() for y in v})
    rows, missing = [], []
    for code, series in keep.items():
        loc = where.get(code)
        if not loc:
            missing.append(labels[code])
            continue
        row = {"lon": loc[0], "lat": loc[1], "iso3": urban_audit.iso3(code), "name": labels[code]}
        for y in years:
            row[f"v{y}"] = round(series[y]) if y in series else None
        rows.append(row)
    fields = ["lon", "lat", "iso3", "name"] + [f"v{y}" for y in years]
    write_points(OUT / "city-visitors.json", {**points_file(rows, fields, {"lon": 0.001, "lat": 0.001, **{f"v{y}": 1 for y in years}},
                                                            strings=("iso3",)), "years": years}, ("name",))
    # 時間軸用的空指標檔（國家不上色，只要年份）
    write_json(OUT / "city-visitors-years.json", indicator_file("city-visitors", "人次", years, {}, license="CC BY 4.0"))
    last = {}
    for y in (2024, 2022):
        vals = sorted(((r["name"], r[f"v{y}"]) for r in rows if r.get(f"v{y}")), key=lambda x: -x[1])
        last[y] = (len(vals), vals[:6])
    print(f"  歐洲城市的博物館人次：{len(keep)} 個地區（去掉有 greater city 的 city 列）、畫出 {len(rows)}；年份 {years[0]}–{years[-1]}；"
          f"對不到位置 {len(missing)}：{missing[:8]}")
    for y, (n, top) in last.items():
        print(f"    {y} 年 {n} 個地區有值：" + "、".join(f"{a} {b:,}" for a, b in top))


def _galleries() -> None:
    n = osm_qlever.counts("tourism", "gallery")
    write_json(OUT / "galleries.json", indicator_file("galleries", "家", [YEAR], {c: [v] for c, v in sorted(n.items())}, license="ODbL 1.0"))
    pop = {c: s[2024] for c, s in wpp.demographic(["TPopulation1July"], last_year=2024)["TPopulation1July"].items() if s.get(2024)}
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    values, nv, nv_en = {}, {}, {}
    for c in sorted(set(n) | covered):
        if c not in pop:
            continue
        if c not in covered:
            nv[c], nv_en[c] = osm_coverage.reason(c, cov.get(c))
        elif pop[c] < MIN_POPULATION:
            nv[c] = "人口不到 10 萬，一兩家就差很多，不畫"
            nv_en[c] = "Population under 100,000, too small for a stable rate, so not shown"
        else:
            values[c] = [round(n.get(c, 0) / pop[c] * 1000, 2)]
    write_json(OUT / "galleries-per-million.json", indicator_file("galleries-per-million", "家/百萬人", [YEAR], values, noValue=nv,
                                                                  noValueEn=nv_en, license="ODbL 1.0"))
    top = sorted(n.items(), key=lambda kv: -kv[1])
    r = sorted(((c, v[0]) for c, v in values.items()), key=lambda x: -x[1])
    print(f"  OSM tourism=gallery：{sum(n.values()):,} 家、{len(n)} 國；" + "、".join(f"{c} {v:,}" for c, v in top[:12]) + f"；台灣 {n.get('TWN')}")
    print(f"    每百萬人（覆蓋良好 {len(values)} 國）：" + "、".join(f"{c} {v}" for c, v in r[:10]) + " … "
          + "、".join(f"{c} {values[c][0]}" for c in ("TWN", "JPN", "USA", "DEU", "FRA", "GBR", "KOR") if c in values))


def build() -> None:
    _largest()
    _cities()
    _galleries()
