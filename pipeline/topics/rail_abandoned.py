"""鐵路的擴充：廢線——拆掉與停用的鐵路（2026-11-07，製作手冊第二十七批 566，候選 1279；步驟 rail-abandoned，
輸出 topics/transport/）。

資料：OpenStreetMap（ODbL 1.0）經 QLever（sources/osm_qlever.py）。
- `railway=abandoned`（已拆、路基還在）與 `railway=disused`（軌還在、沒有車）的長度：osm2rdf 算好的
  `<https://osm2rdf.cs.uni-freiburg.de/rdf#length>`（公尺）依國家加總。手冊的提醒：標籤與長度一定要放進內層子查詢，
  放在 `sfContains` 後面會要 6.1 GB 然後失敗。跨國界的線段不在任何一國「裡面」，不算（少數）。
- 只做長度（手冊的「中」），不畫線圖層。長度照第二十一批的規則只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py；
  美國一半來自 TIGER 匯入，手冊的陷阱），其他國家的公里數寫在 tooltip。
- 同時標了 `highway` 的廢線（已改成步道、自行車道）另外加總，寫在 tooltip（手冊的陷阱：廢線會跟鐵道自行車道重疊）。
- 側欄：各國有名稱（`name`）的廢線依名稱加總長度，列最長的 TOP_NAMES 條（原文名稱）；這份清單是 Derivative Database，
  依 ODbL 分享。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import osm_coverage, osm_qlever
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "transport"
YEAR = 2026
TOP_NAMES = 15
LENGTH = "<https://osm2rdf.cs.uni-freiburg.de/rdf#length>"
KINDS = ("abandoned", "disused")


def _length_query(kind: str, extra: str = "") -> str:
    return f"""SELECT ?iso (SUM(?len) AS ?m) (COUNT(DISTINCT ?x) AS ?n) WHERE {{
  {osm_qlever.COUNTRIES}
  {{ SELECT ?x ?len WHERE {{ ?x osmkey:railway "{kind}" ; {LENGTH} ?len . {extra} }} }}
}} GROUP BY ?iso"""


def _names_query(kind: str) -> str:
    return f"""SELECT ?iso ?name (SUM(?len) AS ?m) WHERE {{
  {osm_qlever.COUNTRIES}
  {{ SELECT ?x ?len ?name WHERE {{ ?x osmkey:railway "{kind}" ; osmkey:name ?name ; {LENGTH} ?len . }} }}
}} GROUP BY ?iso ?name"""


def _per_country(rows) -> dict[str, tuple[float, int]]:
    out: dict[str, tuple[float, int]] = {}
    for r in rows:
        iso3 = from_alpha2(r["iso"]["value"])
        if iso3:
            km, n = out.get(iso3, (0.0, 0))
            out[iso3] = (km + float(r["m"]["value"]) / 1000, n + int(r["n"]["value"]))
    return out


def build() -> None:
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    lengths = {k: _per_country(osm_qlever.query(_length_query(k), f"rail-{k}-length")) for k in KINDS}
    trails = _per_country(osm_qlever.query(_length_query("abandoned", "?x osmkey:highway ?h ."), "rail-abandoned-highway-length"))

    for kind in KINDS:
        data = lengths[kind]
        values, hints, hints_en, nv, nv_en = {}, {}, {}, {}, {}
        for c, (km, n) in sorted(data.items()):
            if kind == "abandoned":
                t = trails.get(c, (0.0, 0))[0]
                hints[c] = f"OpenStreetMap 上 {n:,} 段、約 {km:,.0f} km；其中 {t:,.0f} km 同時標了 highway（已改成道路、步道或自行車道）"
                hints_en[c] = f"{n:,} segments, about {km:,.0f} km on OpenStreetMap; {t:,.0f} km of it is also tagged highway (now a road, path or cycleway)"
            else:
                hints[c] = f"OpenStreetMap 上 {n:,} 段、約 {km:,.0f} km"
                hints_en[c] = f"{n:,} segments, about {km:,.0f} km on OpenStreetMap"
            if c in covered:
                values[c] = [round(km)]
            else:
                nv[c], nv_en[c] = osm_coverage.reason(c, cov.get(c))
        write_json(OUT / f"rail-{kind}.json", indicator_file(
            f"rail-{kind}", "km", [YEAR], values, hints=hints, hintsEn=hints_en, noValue=nv, noValueEn=nv_en,
            license="ODbL 1.0"))

    names: dict[str, dict[str, list]] = {}
    totals = {}
    for kind in KINDS:
        per: dict[str, dict[str, float]] = {}
        for r in osm_qlever.query(_names_query(kind), f"rail-{kind}-names"):
            iso3 = from_alpha2(r["iso"]["value"])
            name = r["name"]["value"].strip()
            if iso3 and name:
                per.setdefault(iso3, {})
                per[iso3][name] = per[iso3].get(name, 0.0) + float(r["m"]["value"]) / 1000
        totals[kind] = sum(len(v) for v in per.values())
        for c, d in per.items():
            top = sorted(d.items(), key=lambda kv: -kv[1])[:TOP_NAMES]
            names.setdefault(c, {})[kind[0]] = [[n, round(km, 1)] for n, km in top if km >= 0.1]
    write_json(OUT / "rail-abandoned-names.json", {"license": "ODbL 1.0", "countries": dict(sorted(names.items()))})

    for kind in KINDS:
        data = lengths[kind]
        top = sorted(((km, c) for c, (km, _) in data.items()), reverse=True)
        print(f"  {kind}：{len(data)} 國、{sum(n for _, n in data.values()):,} 段、{sum(km for km, _ in data.values()):,.0f} km；"
              f"{[(c, round(km)) for km, c in top[:12]]}")
        print(f"    TWN {data.get('TWN')}；上色 {sum(1 for c in data if c in covered)} 國；有名稱的 {totals[kind]:,} 條")
    print(f"  abandoned 兼 highway：{sum(km for km, _ in trails.values()):,.0f} km、{sum(n for _, n in trails.values()):,} 段；"
          f"USA {trails.get('USA')} TWN {trails.get('TWN')}")
    print(f"  TWN 名稱：{names.get('TWN')}")
