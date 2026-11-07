"""物質流與循環經濟（新主題，2026-11-07，製作手冊第二十五批 490，候選 1168；環境的「污染與廢棄物」）。

- OECD「Material flow accounts」（OECD.ENV.EPI,DSD_MATERIAL_RESOURCES@DF_MATERIAL_RESOURCES,1.0，SDMX，CC BY 4.0）：
  只抓 MEASURE＝DMC（國內物質消費）與 MF（物質足跡）、UNIT_MEASURE＝T_PS（公噸／人）、GROUP＝TOT、BIO（生物質）、
  MET（金屬）、IND（非金屬礦物）、FUEL（化石能源）。key「.A.DMC+MF.T_PS.TOT+BIO+MET+IND+FUEL」，不抓全量（305 MB）。
  REF_AREA 的 TWN 是台灣（OECD 寫 Chinese Taipei），只有 DMC、沒有物質足跡。
  DMC 是負的（蒙特塞拉特 −96.3）或不到 0.5 公噸／人的（關島、北馬里亞納、美屬維京群島等屬地）明顯是貿易餘額算出來的異常，不收。
- Eurostat「Circular material use rate」（cei_srm030，CC BY 4.0），unit=PC，2004 年起；英國、科索沃照網站的規則不收。

UNEP IRP 的 Global Material Flows Database 整頁沒有授權文字與下載連結，不用（手冊）。
輸出 public/data/topics/materials/：dmc/{item}.json、footprint/{item}.json（公噸／人）、circular.json（%）。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat, oecd
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "materials"
FLOW = "OECD.ENV.EPI,DSD_MATERIAL_RESOURCES@DF_MATERIAL_RESOURCES,1.0"
KEY = ".A.DMC+MF.T_PS.TOT+BIO+MET+IND+FUEL"
GROUPS = {"TOT": "all", "BIO": "biomass", "MET": "metals", "IND": "minerals", "FUEL": "fossil"}
FIRST = 1970


def build() -> None:
    data: dict[tuple[str, str], dict[str, dict[int, float]]] = {}
    dropped = set()
    for r in oecd.rows(FLOW, KEY):
        if not r["OBS_VALUE"]:
            continue
        area = r["REF_AREA"]
        iso3 = "WLD" if area == "W" else to_iso3(area)
        if not iso3:
            continue
        value = float(r["OBS_VALUE"])
        if r["MEASURE"] == "DMC" and r["GROUP"] == "TOT" and value < 0.5:
            dropped.add(iso3)
        data.setdefault((r["MEASURE"], r["GROUP"]), {}).setdefault(iso3, {})[int(r["TIME_PERIOD"])] = value
    # 總量異常（負值或不到 0.5 公噸／人）的國家年，各物質群一起不收
    bad = {(k, y) for k, s in data[("DMC", "TOT")].items() for y, v in s.items() if v < 0.5}
    last = max(y for s in data[("DMC", "TOT")].values() for y in s)
    years = list(range(FIRST, last + 1))
    for measure, folder in (("DMC", "dmc"), ("MF", "footprint")):
        for group, item in GROUPS.items():
            series = data.get((measure, group), {})
            world = series.pop("WLD", {})
            values = {k: [round(s[y], 2) if y in s and (measure != "DMC" or (k, y) not in bad) else None for y in years]
                      for k, s in series.items()}
            values = {k: v for k, v in values.items() if any(x is not None for x in v)}
            write_json(OUT / folder / f"{item}.json", indicator_file(
                folder, "公噸/人", years, values, aggregates={"WLD": [round(world[y], 2) if y in world else None for y in years]},
                license="CC BY 4.0"))
    circular = eurostat.json_series("cei_srm030", unit="PC")
    cyears = sorted({y for s in circular.values() for y in s})
    write_json(OUT / "circular.json", indicator_file(
        "circular", "%", cyears, {k: [s.get(y) for y in cyears] for k, s in circular.items()}, license="CC BY 4.0"))
    tw = data[("DMC", "TOT")]["TWN"]
    print(f"  OECD 物質流 {years[0]}–{last}：DMC {len(data[('DMC', 'TOT')])} 區、物質足跡 {len(data[('MF', 'TOT')])} 區；"
          f"台灣 DMC {tw.get(last)} 公噸／人；異常不收 {sorted(dropped)}；循環物質使用率 {len(circular)} 國 {cyears[0]}–{cyears[-1]}")
