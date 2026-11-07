"""能源的淨有效稅率：課稅減補貼（2026-11-07，製作手冊第二十五批 528，候選 1205；新主題，能源・能源的使用與政策）。

OECD Net Effective Energy Rates（Taxing Energy Use 系列，`OECD.CTP.TPS,DSD_NEER@DF_NEERS,1.1`，sdmx.oecd.org，條款同 DESIGN.md
第 8 節第 129 點）。整個資料流 85 MB，用 key 只取要的：部門 ENE（全部能源）、ROAD（公路運輸）、ENEXROAD（公路以外）、ELEC（發電）、
RESCOM（住宅與商業）、INDUSTRY（工業）；能源 `_T`；量 NETEER（淨有效能源稅率）、EER（有效能源稅率＝能源稅＋碳稅＋電力稅）、
SUBSID（化石燃料補貼，資料裡是負值，存成正的）；單位 EUR_GJ（每 GJ 多少歐元）；統計方法只用 MEANW（依能源用量加權，同一列另有 MEAN 算術平均，要去重）；
PRICE_BASE 只用 V（當期價格）。2018、2021、2023 三期，存到小數兩位（畫面顯示的位數，避免存三位再四捨五入兩次）。
79 個國家（另有 G7、G20、OECD 等 7 個合計不收）；美國、台灣不在資料裡。
輸出 public/data/topics/energy-taxes/{net,tax,subsidy}/<部門>.json。
"""

from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import oecd
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "energy-taxes"
FLOW = "OECD.CTP.TPS,DSD_NEER@DF_NEERS,1.1"
SECTORS = {"ENE": "all", "ROAD": "road", "ENEXROAD": "non-road", "ELEC": "electricity", "RESCOM": "buildings", "INDUSTRY": "industry"}
MEASURES = {"NETEER": "net", "EER": "tax", "SUBSID": "subsidy"}
KEY = f".{'+'.join(SECTORS)}._T.{'+'.join(MEASURES)}.EUR_GJ.MEANW.V.A"


def build() -> None:
    data: dict[tuple[str, str], dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for r in oecd.rows(FLOW, KEY):
        if r["STATISTICAL_OPERATION"] != "MEANW" or r["PRICE_BASE"] != "V" or r["OBS_VALUE"] in ("", None):
            continue
        iso3 = to_iso3(r["REF_AREA"])
        if not iso3:
            continue
        key = (MEASURES[r["MEASURE"]], SECTORS[r["SECTOR"]])
        y = int(r["TIME_PERIOD"])
        if y in data[key][iso3]:
            raise RuntimeError(f"NEER {key} {iso3} {y} 有兩筆")
        # 補貼在資料裡是負值（減掉的稅），存成正的「每 GJ 補貼多少歐元」
        v = float(r["OBS_VALUE"])
        data[key][iso3][y] = (-v if key[0] == "subsidy" else v) + 0.0  # + 0.0 把 -0.0 變成 0.0
    years = [2018, 2021, 2023]
    extra = {"license": "CC BY 4.0", "attribution": "OECD, Net Effective Energy Rates (Taxing Energy Use)"}
    for (measure, sector), by in sorted(data.items()):
        write_json(OUT / measure / f"{sector}.json", indicator_file(
            f"{measure}/{sector}", "EUR/GJ", years, {k: [round(s[y], 2) if y in s else None for y in years] for k, s in sorted(by.items())}, **extra))
    for measure in ("net", "subsidy"):
        by = data[(measure, "all")]
        top = sorted(((s[2023], k) for k, s in by.items() if 2023 in s), reverse=True)
        print(f"  {measure} 全部能源 2023：{len(top)} 國；高 {top[:6]}；低 {top[-6:]}；負的 {sum(1 for v, _ in top if v < 0)} 國")
    for sector in ("road", "electricity", "buildings", "industry"):
        by = data[("net", sector)]
        top = sorted(((s[2023], k) for k, s in by.items() if 2023 in s), reverse=True)
        print(f"  net {sector} 2023：{len(top)} 國；高 {top[:5]}；低 {top[-5:]}")
    print(f"  美國 {dict(data[('net', 'all')].get('USA', {}))}；日本 {dict(data[('net', 'all')].get('JPN', {}))}；中國 {dict(data[('net', 'all')].get('CHN', {}))}；南韓 {dict(data[('net', 'all')].get('KOR', {}))}")
