"""國土一年升降幾公釐（2026-11-08，製作手冊第二十七批 547，候選 1234；擴充「海拔」；步驟 land-motion，輸出 topics/elevation/）。

- 資料：Nevada Geodetic Laboratory（NGL）的 MIDAS 速度場，IGS20 參考框架的 `midas.IGS.txt`
  （https://geodesy.unr.edu/gps_timeseries/IGS20/midas/，每週更新）。手冊寫的 `velocities/midas.IGS14.txt` 是舊框架，
  那個目錄的 README.txt 寫「older files that have been superceded by IGS20 velocities」，所以改用 IGS20。
  垂直速度跟參考框架的板塊旋轉無關，換框架只差在框架本身的定義（毫米以下）。
- 授權：CC BY 4.0（NGL 的 Disclaimer 頁說 NBMG 的資料政策適用，NBMG 的 Copyright Statement 是 CC BY 4.0；
  map-plan 的 data/ngl/README.md）。要標示 NBMG（Nevada Bureau of Mines and Geology, University of Nevada, Reno）、
  引用 Blewitt, Hammond & Kreemer（2018, Eos 99）與 MIDAS 的論文 Blewitt et al.（2016, JGR 121）。檔案本身沒有另外的聲明。
- 欄位（midas.readme.txt）：1 站名、3–5 起訖年份與年數、9–11 東北上的速度（m/yr）、12–14 誤差、25–27 緯度、經度、高度。
  經度有的寫成 −229° 這種（往西繞超過 180°），換回 −180–180。
- 篩選：時間序列至少 3 年（MIDAS 的論文說短於 2.5 年會被季節變化帶偏）、垂直速度的誤差 ≤ 2 mm/年
  （刪掉冰河上、冰層上的站：誤差大，例如紐西蘭 Fox 冰河上的 FOX1 −6,315 mm/年）。留下的極端值是真的：墨西哥城 MMX1
  −265 mm/年（抽地下水）、加州中央谷地、冰島冰帽退縮後的上升、南極西部的冰後回彈。
- 國家：依測站位置（geoindex，跟地圖的國界一樣）；值是境內測站垂直速度的中位數，至少 3 站才上色
  （測站多半在都市與板塊邊界，中位數不是「全國平均」，說明寫清楚）。
"""
from __future__ import annotations

import statistics
from collections import defaultdict

import geoindex
from common import OUT_DIR, download, indicator_file, points_file, write_json

OUT = OUT_DIR / "topics" / "elevation"
URL = "https://geodesy.unr.edu/gps_timeseries/IGS20/midas/midas.IGS.txt"
YEAR = 2026  # 海拔主題是 timeless；指標檔要有一個年份，用資料的年份
MIN_YEARS = 3.0
MAX_SIGMA_MM = 2.0
MIN_STATIONS = 3

FIELDS = ["lon", "lat", "v", "s", "y0", "y1", "iso3"]
SCALE = {"lon": 0.01, "lat": 0.01, "v": 0.1, "y0": 0.1, "y1": 0.1}


def stations() -> list[dict]:
    path = download(URL, "ngl", "midas.IGS20.txt")
    out = []
    for line in path.read_text(encoding="ascii").splitlines():
        f = line.split()
        if len(f) != 27:
            raise ValueError(f"MIDAS 的欄數不是 27：{line[:60]}")
        first, last, years = float(f[2]), float(f[3]), float(f[4])
        up, sigma = float(f[10]) * 1000, float(f[13]) * 1000
        lat, lon = float(f[24]), (float(f[25]) + 180) % 360 - 180
        out.append({"s": f[0], "y0": first, "y1": last, "years": years, "v": up, "sigma": sigma, "lat": lat, "lon": lon})
    return out


def _mm(v: float) -> str:
    return f"{'+' if v > 0 else '−' if v < 0 else ''}{abs(v):.1f}"


def build() -> None:
    allst = stations()
    kept = [s for s in allst if s["years"] >= MIN_YEARS and s["sigma"] <= MAX_SIGMA_MM]
    iso = geoindex.countries_at([s["lon"] for s in kept], [s["lat"] for s in kept])
    by_country: dict[str, list[dict]] = defaultdict(list)
    for s, c in zip(kept, iso):
        s["iso3"] = c
        if c:
            by_country[c].append(s)

    values, hints, hints_en, counts = {}, {}, {}, {}
    for c, ss in sorted(by_country.items()):
        counts[c] = [len(ss)]
        if len(ss) < MIN_STATIONS:
            continue
        med = statistics.median(s["v"] for s in ss)
        values[c] = [round(med, 2)]
        hi = max(ss, key=lambda s: s["v"])
        lo = min(ss, key=lambda s: s["v"])
        hints[c] = f"{len(ss)} 個測站的中位數；上升最快 {hi['s']} {_mm(hi['v'])}、下沉最快 {lo['s']} {_mm(lo['v'])} 公釐／年"
        hints_en[c] = f"Median of {len(ss)} stations; fastest rising {hi['s']} {_mm(hi['v'])}, fastest sinking {lo['s']} {_mm(lo['v'])} mm/yr"
    few = {c: f"只有 {len(ss)} 個測站（至少 3 個才上色）" for c, ss in by_country.items() if len(ss) < MIN_STATIONS}
    few_en = {c: f"Only {len(ss)} station{'s' if len(ss) > 1 else ''} (at least 3 needed)" for c, ss in by_country.items() if len(ss) < MIN_STATIONS}

    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "land-motion.json", indicator_file(
        "land-motion", "mm/yr", [YEAR], values, hints=hints, hintsEn=hints_en, noValue=few, noValueEn=few_en,
        license="CC BY 4.0（Nevada Bureau of Mines and Geology, University of Nevada, Reno；Blewitt et al. 2018）"))

    rows = []
    # MapLibre 照資料的順序畫：升降慢的（大多數）先寫，極端的最後寫、畫在最上面，才不會被附近一堆慢的站蓋住
    for s in sorted(kept, key=lambda s: abs(s["v"])):
        rows.append({"lon": s["lon"], "lat": s["lat"], "v": round(s["v"], 1), "s": s["s"],
                     "y0": round(s["y0"], 1), "y1": round(s["y1"], 1), "iso3": s["iso3"]})
    write_json(OUT / "land-motion-stations.json", points_file(rows, FIELDS, SCALE))

    print(f"  國土升降：MIDAS {len(allst)} 站，留下 {len(kept)} 站（≥{MIN_YEARS:g} 年、誤差 ≤{MAX_SIGMA_MM:g} mm/年），"
          f"{len(values)} 國上色（≥{MIN_STATIONS} 站），{len(few)} 國站太少")
    top = sorted(values.items(), key=lambda kv: kv[1][0])
    print("    下沉最多：", [(c, v[0], counts[c][0]) for c, v in top[:8]])
    print("    上升最多：", [(c, v[0], counts[c][0]) for c, v in top[-8:]])
    if "TWN" in values:
        print("    台灣：", values["TWN"], hints["TWN"])
