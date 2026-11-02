"""冰河、海冰與海平面主題：2050、2100 年的海平面上升推估（IPCC AR6，製作手冊第十七批 275，2026-11-02）。

資料：Zenodo「IPCC AR6 Sea Level Projections」（Garner 等，版本 20210809，doi:10.5281/zenodo.6382554，
concept doi:10.5281/zenodo.5914709）。license 欄是 cc-by-4.0，說明也寫「licensed by the authors under a Creative Commons
Attribution 4.0 International License」；說明要求引用 AR6 第一工作組第 9 章（Fox-Kemper 等 2021）、FACTS 模型論文
（Kopp 等 2023）與資料集本身，並加一段致謝（前端的資料來源與說明都有）。

ar6-regional-confidence.zip（9.2 GB）用 HTTP Range 只讀三個情境的
`medium_confidence/<ssp>/total_<ssp>_medium_confidence_values.nc`（各約 7,200 萬 bytes，netCDF4／HDF5，用 h5py 讀），
快取在 .cache/ar6-slr/。每個檔是 107 個分位數 × 14 個年份（2020–2150 每 10 年）× 66,190 個地點的上升量（mm，
相對 1995–2014 年的平均，「total」含垂直地殼運動）：1,030 個 PSMSL 潮位站（地點代碼小於 10 億，名稱在 location_list.lst）
加上全球 1° 網格（代碼 10 億以上，內陸是缺值）。全球值在 ar6.zip 的 global 檔（各約 16 KB）。

使用者 2026-11-02 決定：2050、2100 年；SSP1-2.6、SSP2-4.5、SSP5-8.5 可以切換；潮位站畫成點、國家用海岸外網格的平均；
相對 1995–2014 年（IPCC 的寫法）。
- sea-level-rise/<情境>.json：國家的值是離國界 NEAR_KM 公里以內（颱風主題的 NearIndex，跟現有的海平面上升速度同一個做法）
  有值的 1° 網格點的中位數（50%）依緯度加權平均，公分；內陸國不算。世界值用 ar6.zip 的全球中位數。
- slr-gauges/<情境>.json：潮位站的點，m／l／h<年> 是中位數與 17%、83%（IPCC 的 likely range），公分；iso3 是最近的國家。
"""
from __future__ import annotations

import io
import shutil
import zipfile
from collections import defaultdict

import h5py
import numpy as np

from common import CACHE_DIR, OUT_DIR, download, indicator_file, points_file, write_json
from sources.climate_trace import _RangeFile
from topics.ice import NEAR_KM
from topics.typhoons import NearIndex

OUT = OUT_DIR / "topics" / "ice"
ZENODO = "https://zenodo.org/records/6382554/files"
REGIONAL_ZIP = f"{ZENODO}/ar6-regional-confidence.zip?download=1"
GLOBAL_ZIP = f"{ZENODO}/ar6.zip?download=1"
LOCATIONS = f"{ZENODO}/location_list.lst?download=1"
SCENARIOS = ["ssp126", "ssp245", "ssp585"]  # 前端 ice.ts 的 SLR_SCENARIOS 同一組 id
YEARS = [2050, 2100]
QUANTILES = {"m": 0.5, "l": 0.17, "h": 0.83}
GRID_FROM = 1_000_000_000  # 地點代碼 10 億以上是 1° 網格
FILL = -32768


def _extract(zip_url: str, member: str, name: str) -> str:
    """從 Zenodo 的大 zip 用 HTTP Range 只取一個檔（存到 .cache/ar6-slr/）"""
    target = CACHE_DIR / "ar6-slr" / name
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        print(f"  從 {zip_url.split('/')[-1].split('?')[0]} 讀 {member}")
        z = zipfile.ZipFile(io.BufferedReader(_RangeFile(zip_url), buffer_size=1 << 22))
        tmp = target.with_suffix(".part")
        with z.open(member) as src, open(tmp, "wb") as dst:
            shutil.copyfileobj(src, dst, 1 << 22)
        tmp.replace(target)
    return str(target)


def _read(path: str) -> tuple[np.ndarray, np.ndarray, np.ndarray, dict[str, np.ndarray]]:
    """(地點代碼, 緯度, 經度, {m/l/h: 年份 × 地點 的 mm，缺值是 nan})"""
    with h5py.File(path, "r") as f:
        years = f["years"][:].tolist()
        quantiles = f["quantiles"][:]
        cols = [years.index(y) for y in YEARS]
        out = {}
        for key, q in QUANTILES.items():
            qi = int(np.argmin(abs(quantiles - q)))
            if abs(quantiles[qi] - q) > 1e-6:
                raise RuntimeError(f"AR6 的分位數裡沒有 {q}")
            a = f["sea_level_change"][qi, :, :][cols, :].astype(float)
            a[a == FILL] = np.nan
            out[key] = a
        return f["locations"][:], f["lat"][:].astype(float), f["lon"][:].astype(float), out


def _global(ssp: str) -> dict[int, float]:
    member = f"ar6/global/confidence_output_files/medium_confidence/{ssp}/total_{ssp}_medium_confidence_values.nc"
    with h5py.File(_extract(GLOBAL_ZIP, member, f"global_{ssp}.nc"), "r") as f:
        years = f["years"][:].tolist()
        qi = int(np.argmin(abs(f["quantiles"][:] - 0.5)))
        v = f["sea_level_change"][qi, :, :].astype(float).ravel()
    return {y: float(v[years.index(y)]) / 10 for y in YEARS}


def _names() -> dict[int, str]:
    out = {}
    for line in download(LOCATIONS, "ar6-slr", "location_list.lst").read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) >= 4:
            out[int(parts[1])] = parts[0]
    return out


def build() -> None:
    from sources import marine_regions

    landlocked = marine_regions.landlocked() | {"XKX"}
    names = _names()
    index = NearIndex(NEAR_KM)
    summary = []
    for ssp in SCENARIOS:
        member = f"ar6-regional-confidence/regional/confidence_output_files/medium_confidence/{ssp}/total_{ssp}_medium_confidence_values.nc"
        loc, lat, lon, q = _read(_extract(REGIONAL_ZIP, member, f"total_{ssp}_medium_confidence_values.nc"))
        grid = loc >= GRID_FROM
        med = q["m"]

        # 國家：海岸外 NEAR_KM 公里以內有值的網格點，依緯度加權
        g = np.nonzero(grid & np.isfinite(med).all(axis=0))[0]
        hp, hc, _ = index.query(lon[g], lat[g], np.zeros(len(g), dtype=bool))
        w = np.cos(np.radians(lat[g]))
        acc = defaultdict(lambda: np.zeros(len(YEARS)))
        wsum: dict[str, float] = defaultdict(float)
        for p, c in zip(hp.tolist(), hc.tolist()):
            code = index.codes[c]
            if code in landlocked:
                continue
            acc[code] += med[:, g[p]] * w[p]
            wsum[code] += w[p]
        values = {code: [round(float(v / wsum[code]) / 10, 1) for v in acc[code]] for code in acc}
        world = _global(ssp)
        write_json(OUT / "sea-level-rise" / f"{ssp}.json", indicator_file(
            f"sea-level-rise/{ssp}", "公分", YEARS, values,
            aggregates={"WLD": [round(world[y], 1) for y in YEARS]}, projectionFrom=YEARS[0],
        ), quiet=True)

        # 潮位站：兩個年份都有值的，國家取最近的（國界內是 0）
        s = np.nonzero(~grid & np.isfinite(med).all(axis=0))[0]
        sp, sc, sd = index.query(lon[s], lat[s], np.ones(len(s), dtype=bool))
        nearest: dict[int, tuple[float, str]] = {}
        for p, c, d in zip(sp.tolist(), sc.tolist(), sd.tolist()):
            if p not in nearest or d < nearest[p][0]:
                nearest[p] = (d, index.codes[c])
        rows = []
        for k, j in enumerate(s.tolist()):
            row: dict[str, object] = {
                "lon": round(float(lon[j]), 2), "lat": round(float(lat[j]), 2),
                "name": names.get(int(loc[j]), str(int(loc[j]))).replace("_", " "),
                "iso3": nearest[k][1] if k in nearest else None,
            }
            for key, a in q.items():
                for t, y in enumerate(YEARS):
                    row[f"{key}{y}"] = round(float(a[t, j]) / 10, 1)
            rows.append(row)
        rows.sort(key=lambda r: -r["m2100"])
        fields = ["lon", "lat", "name", "iso3", *[f"{k}{y}" for k in QUANTILES for y in YEARS]]
        scale = {"lon": 0.01, "lat": 0.01, **{f"{k}{y}": 0.1 for k in QUANTILES for y in YEARS}}
        write_json(OUT / "slr-gauges" / f"{ssp}.json", points_file(rows, fields, scale), quiet=True)

        tw = values.get("TWN")
        gauges = {r["name"]: r for r in rows if r["iso3"] == "TWN"}
        summary.append(f"  {ssp}：{len(values)} 國、{len(rows)} 個潮位站；世界 {world[2050]:.1f} → {world[2100]:.1f} 公分；"
                       f"台灣沿海 {tw}；" + "、".join(f"{n} {r['m2100']}（{r['l2100']}–{r['h2100']}）" for n, r in gauges.items()))
        top = [(r["name"], r["iso3"], r["m2100"]) for r in rows[:5]]
        low = [(r["name"], r["iso3"], r["m2100"]) for r in rows[-3:]]
        summary.append(f"    2100 年潮位站最高 {top}，最低 {low}")
        ranked = sorted(values.items(), key=lambda kv: -kv[1][1])
        summary.append(f"    國家最高 {[(c, v[1]) for c, v in ranked[:5]]}，最低 {[(c, v[1]) for c, v in ranked[-4:]]}")
    print("\n".join(summary))
