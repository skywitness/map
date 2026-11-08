"""機場與旅客的擴充：機場的設施——登機門、空橋、報到櫃台、停車位與用地面積（2026-11-07，製作手冊第二十七批 570，
候選 1286；步驟 airport-facilities，輸出 topics/aviation/）。

- Eurostat `avia_if_typ`（各機場申報的基礎設施，2003–2024，CC BY 4.0）：登機門（PAS_GATE，其中有空橋的 PAS_GATE_BB）、
  報到櫃台（CKIN，其中自助 CKIN_SELF）、停車位（PARK_CAR）、跑道（RWAY）。自願申報，很多機場只有少數年份
  （戴高樂最後是 2016、法蘭克福 2021），每個機場取最近有登機門數字的一年；缺值不當 0，而 0 也當成沒有申報
  （法蘭克福 2016 年的停車位是 0）。機場的位置用 OurAirports 的 ICAO 代碼對。英國不收（sources/eurostat.py）。
  輸出成點（大小是登機門）與側欄的各國機場表。
- OpenStreetMap 經 QLever（ODbL 1.0）：`aeroway=gate` 的個數（各國登機門，比例圓）與 `aeroway=aerodrome` 的面積
  （osm2rdf 算好的 `<https://osm2rdf.cs.uni-freiburg.de/rdf#area>`，平方公尺，依國界加總，比例圓）。手冊的陷阱：
  面積含軍用機場（伊拉克、利比亞幾乎全是軍用），另外加總同時標 `military=airfield` 或 `aerodrome:type=military`
  的，寫在 tooltip。登機門（小的標記）只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py），其他國家寫在 tooltip；
  機場的範圍是大面積、各國都畫得齊的物件，而且是總量不是密度，所有國家都畫。
"""
from __future__ import annotations

import csv
import gzip

from common import OUT_DIR, download, indicator_file, points_file, write_json
from sources import eurostat, osm_coverage, osm_qlever
from sources.countries import from_alpha2
from topics.airport_runways import AIRPORTS_URL

OUT = OUT_DIR / "topics" / "aviation"
YEAR = 2026
FIELDS = {"PAS_GATE": "g", "PAS_GATE_BB": "bb", "CKIN": "ck", "CKIN_SELF": "cs", "PARK_CAR": "pk", "RWAY": "rw"}
AREA = "<https://osm2rdf.cs.uni-freiburg.de/rdf#area>"


def _area_query(extra: str = "") -> str:
    return f"""SELECT ?iso (SUM(?a) AS ?m) (COUNT(DISTINCT ?x) AS ?n) WHERE {{
  {osm_qlever.COUNTRIES}
  {{ SELECT ?x ?a WHERE {{ ?x osmkey:aeroway "aerodrome" ; {AREA} ?a . {extra} }} }}
}} GROUP BY ?iso"""


def _per_country(rows) -> dict[str, tuple[float, int]]:
    out: dict[str, tuple[float, int]] = {}
    for r in rows:
        iso3 = from_alpha2(r["iso"]["value"])
        if iso3:
            a, n = out.get(iso3, (0.0, 0))
            out[iso3] = (a + float(r["m"]["value"]) / 1e6, n + int(r["n"]["value"]))
    return out


def _area(extra: str, name: str) -> dict[str, tuple[float, int]]:
    """各國機場的面積（平方公里）與個數；子屬地分開、從母國減掉（製作手冊 1-f，sources/osm_qlever.py）"""
    totals = _per_country(osm_qlever.query(_area_query(extra), name))
    subs = osm_qlever.sub_objects(f'?x osmkey:aeroway "aerodrome" ; {AREA} ?a . {extra}', name, extra=("a",))
    a = osm_qlever.split({c: v[0] for c, v in totals.items()}, [{**s, "a": float(s["a"]) / 1e6} for s in subs], "a")
    n = osm_qlever.split({c: v[1] for c, v in totals.items()}, subs)
    return {c: (a[c], int(round(n.get(c, 0)))) for c in a}


def _eurostat_airports() -> list[dict]:
    path = download(eurostat.URL.format(dataset="avia_if_typ"), "eurostat", "avia_if_typ.tsv.gz")
    data: dict[str, dict[str, dict[int, float]]] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        dims = header[0].split("\\")[0].split(",")
        years = [int(h) for h in header[1:]]
        for line in f:
            cells = line.rstrip("\n").split("\t")
            key = dict(zip(dims, cells[0].split(",")))
            if key["tra_infr"] not in FIELDS:
                continue
            for y, cell in zip(years, cells[1:]):
                number = cell.strip().split(" ")[0]
                if number not in (":", "") and float(number) > 0:
                    data.setdefault(key["rep_airp"], {}).setdefault(key["tra_infr"], {})[y] = float(number)
    coords = {}
    with open(download(AIRPORTS_URL, "ourairports", "airports.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            for code in {r["ident"], r["icao_code"], r["gps_code"]} - {""}:
                coords.setdefault(code, (float(r["longitude_deg"]), float(r["latitude_deg"]), r["name"], r["iata_code"]))
    out = []
    for rep, by in sorted(data.items()):
        geo, icao = rep.split("_", 1)
        iso3 = eurostat._iso3(geo)
        gates = by.get("PAS_GATE")
        if not iso3 or eurostat.noncommercial(geo) or not gates or icao not in coords:
            continue
        y = max(gates)
        lon, lat, name, iata = coords[icao]
        p = {"lon": round(lon, 3), "lat": round(lat, 3), "name": name, "icao": icao, "iata": iata, "iso3": iso3, "y": y}
        for code, field in FIELDS.items():
            v = by.get(code, {}).get(y)
            p[field] = int(v) if v is not None else None
        p["y0"] = min(gates)
        p["g0"] = int(gates[min(gates)])
        out.append(p)
    return out


def build() -> None:
    airports = _eurostat_airports()
    fields = ["lon", "lat", "name", "icao", "iata", "iso3", "y", "g", "bb", "ck", "cs", "pk", "rw", "y0", "g0"]
    write_json(OUT / "airport-facilities.json", points_file(
        airports, fields, {"lon": 0.001, "lat": 0.001, "y": 1, "g": 1, "bb": 1, "ck": 1, "cs": 1, "pk": 1, "rw": 1, "y0": 1, "g0": 1},
        strings=["iso3"]))

    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    gates = osm_qlever.counts("aeroway", "gate")
    area = _area("", "aerodrome-area")
    military = _area('{ ?x osmkey:military "airfield" } UNION { ?x <https://www.openstreetmap.org/wiki/Key:aerodrome:type> "military" }',
                     "aerodrome-area-military")

    def write(name: str, unit: str, values: dict[str, float], hint, digits: int, restrict: bool = True) -> None:
        v, hints, hints_en, nv, nv_en = {}, {}, {}, {}, {}
        for c, x in sorted(values.items()):
            hints[c], hints_en[c] = hint(c)
            if c in covered or not restrict:
                v[c] = [round(x, digits)]
            else:
                nv[c], nv_en[c] = osm_coverage.reason(c, cov.get(c))
        write_json(OUT / f"{name}.json", indicator_file(
            name, unit, [YEAR], v, hints=hints, hintsEn=hints_en, noValue=nv, noValueEn=nv_en, license="ODbL 1.0"))

    write("osm-gates", "個", {c: n for c, n in gates.items()},
          lambda c: (f"OpenStreetMap 上有 {gates[c]:,} 個登機門", f"{gates[c]:,} gates on OpenStreetMap"), 0)
    write("aerodrome-area", "平方公里", {c: a for c, (a, _) in area.items()},
          lambda c: (f"{area[c][1]:,} 座機場的範圍，其中標成軍用的 {military.get(c, (0, 0))[1]:,} 座、{military.get(c, (0.0, 0))[0]:,.1f} 平方公里",
                     f"Outlines of {area[c][1]:,} aerodromes, of which {military.get(c, (0, 0))[1]:,} tagged military cover {military.get(c, (0.0, 0))[0]:,.1f} km²"), 1,
          restrict=False)

    print(f"  Eurostat 機場 {len(airports)} 座；登機門最多：{sorted(((p['g'], p['icao'], p['y']) for p in airports), reverse=True)[:8]}")
    for icao in ("LEMD", "EDDF", "EDDM", "LFPG", "LEBL", "LTFM", "EHAM", "LFPO", "LIRF"):
        p = next((x for x in airports if x["icao"] == icao), None)
        print(f"    {icao} {p}")
    print(f"  OSM 登機門 {sum(gates.values()):,}、{len(gates)} 國：{sorted(((n, c) for c, n in gates.items()), reverse=True)[:10]}；TWN {gates.get('TWN')}")
    top = sorted(((a, c) for c, (a, _) in area.items()), reverse=True)
    print(f"  機場面積 {len(area)} 國：{[(c, round(a, 1)) for a, c in top[:10]]}；TWN {area.get('TWN')} SGP {area.get('SGP')}")
    print(f"    軍用：{[(c, round(military[c][0], 1)) for c in ('IRQ', 'LBY', 'USA', 'RUS', 'CHN', 'SAU', 'TWN') if c in military]}")
