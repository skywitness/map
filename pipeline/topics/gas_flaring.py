"""油田燒掉的天然氣（燃除）（2026-11-08，製作手冊第二十七批 617，候選 1350；步驟 gas-flaring，輸出 topics/fossil-infrastructure/）。

- 資料：世界銀行 Data Catalog 0037743「Global Gas Flaring Database」（https://datacatalog.worldbank.org/search/dataset/0037743，
  License 欄「Creative Commons Attribution 4.0」），2017–2021 各年一個 xlsx，是 VIIRS 衛星估計的逐個火炬燃除量（十億立方公尺，BCM）。
  使用者 2026-11-08 決定只用這五年（GFMR 網頁上 2012–2025 的國家檔照世界銀行一般條款不得改作，不用）。
- 各年的工作表與類型名稱不一樣，統一成：上游（油田 flare／upstream／upstream oil、氣田 gas／upstream gas）、
  中游與下游（煉油廠 refinery、液化天然氣 lng、天然氣處理廠 gpp、石化 opp、midstream、Other ex LNG）。
  國家依 ISO Code 把火炬加總（一般說的「燃除量」是上游）；加總可能跟 GFMR 公布的國家數字略有出入。
- 點：2021 年的每一個火炬（座標、BCM、類型）。
"""
from __future__ import annotations

from collections import defaultdict

import openpyxl

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_points
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "fossil-infrastructure"
BASE = "https://datacatalogfiles.worldbank.org/ddh-published/0037743/5/"
URLS = {
    2017: BASE + "DR0045623/viirs_global_flaring_d.7_slope_0.029353_2017_web_v1.xlsx",
    2018: BASE + "DR0045622/viirs_global_flaring_d.7_slope_0.029353_2018_web.xlsx",
    2019: BASE + "DR0045621/viirs_global_flaring_d.7_slope_0.029353_2019_web_v20201114-3.xlsx",
    2020: BASE + "DR0084248/2020%20Global%20Gas%20Flaring%20Volumes.xlsx",
    2021: BASE + "DR0087112/2021%20Global%20Gas%20Flaring%20Volumes.xlsx",
}
# 2019 年的「all flares」是其他工作表的合集，不讀；其餘有 Type 與 Latitude 欄的工作表就是逐個火炬
SKIP_SHEETS = {"all flares"}
UPSTREAM = {"flare", "upstream", "gas", "upstream oil", "upstream gas"}


def _flares(year: int) -> list[dict]:
    path = download(URLS[year], "worldbank-gfmr", f"flaring-{year}.xlsx")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out = []
    for ws in wb.worksheets:
        if ws.title in SKIP_SHEETS:
            continue
        rows = ws.iter_rows(values_only=True)
        hdr = [str(h).strip() if h is not None else "" for h in next(rows)]
        if "Type" not in hdr or "Latitude" not in hdr:
            continue
        iso_i = hdr.index("ISO Code") if "ISO Code" in hdr else hdr.index("ISO_Code")
        bcm_i = next(i for i, h in enumerate(hdr) if h.startswith("BCM"))
        for r in rows:
            if r[hdr.index("Type")] is None or r[bcm_i] is None:
                continue
            out.append({"iso": str(r[iso_i]).strip(), "lat": float(r[hdr.index("Latitude")]), "lon": float(r[hdr.index("Longitude")]),
                        "bcm": float(r[bcm_i]), "type": str(r[hdr.index("Type")]).strip()})
    return out


def build() -> None:
    years = sorted(URLS)
    up: dict[str, dict[int, float]] = defaultdict(dict)
    every: dict[str, dict[int, float]] = defaultdict(dict)
    world = {}
    last_flares = []
    for y in years:
        flares = _flares(y)
        unknown = {f["iso"] for f in flares if not to_iso3(f["iso"])}
        for f in flares:
            iso = to_iso3(f["iso"])
            if not iso:
                continue
            every[iso][y] = every[iso].get(y, 0) + f["bcm"]
            if f["type"].lower() in UPSTREAM:
                up[iso][y] = up[iso].get(y, 0) + f["bcm"]
        world[y] = (sum(f["bcm"] for f in flares if f["type"].lower() in UPSTREAM), sum(f["bcm"] for f in flares))
        print(f"  {y}：{len(flares):,} 個火炬；上游 {world[y][0]:.1f} BCM、全部 {world[y][1]:.1f} BCM；對不到國碼 {sorted(unknown)}")
        if y == years[-1]:
            last_flares = flares
    for name, data in (("flaring/upstream", up), ("flaring/all", every)):
        values = {c: [round(s[y], 3) if y in s else None for y in years] for c, s in sorted(data.items())}
        write_json(OUT / f"{name}.json", indicator_file(name.replace("/", "-"), "十億立方公尺", years, values, license="CC BY 4.0",
                                                        noValue={"TWN": "台灣沒有油氣田的燃除"}, noValueEn={"TWN": "No gas flaring in Taiwan"}))
    pts = []
    for f in last_flares:
        iso = to_iso3(f["iso"])
        t = f["type"].lower()
        k = 1 if t in UPSTREAM else 2
        pts.append({"lon": round(f["lon"], 4), "lat": round(f["lat"], 4), "k": k, "v": round(f["bcm"] * 1000, 2), "iso3": iso})
    pts.sort(key=lambda p: -p["v"])
    write_points(OUT / "flares.json", points_file(pts, ["lon", "lat", "k", "v", "iso3"], {"lon": 0.0001, "lat": 0.0001, "k": 1, "v": 0.01},
                                                  strings=("iso3",)))
    y = years[-1]
    top = sorted(((round(s[y], 2), c) for c, s in up.items() if y in s), reverse=True)
    print(f"  上游燃除 {y}：{len(top)} 國；{top[:12]}")
    first = years[0]
    print(f"    {first}→{y}：" + "、".join(f"{c} {up[c].get(first, 0):.2f}→{up[c].get(y, 0):.2f}" for c in ("RUS", "IRQ", "IRN", "USA", "VEN", "DZA", "NGA", "LBY", "MEX", "CHN")))
    print(f"    世界（上游、全部）：{ {k: (round(a, 1), round(b, 1)) for k, (a, b) in world.items()} }；點 {len(pts):,}")
