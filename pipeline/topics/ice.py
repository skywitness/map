"""冰河、海冰與海平面主題：三份資料各畫一種東西。

**冰河**（WGMS AMCE 2026-02-10，CC BY 4.0；Dussaillant 等 2025）：全世界每一條冰河（RGI 6.0 的輪廓，約 21 萬條）
1976 年起每個水文年的質量變化（m 水當量），由遙測的多年高程變化與實地量測的年變化合成。每條冰河的中心點歸到國家
（geoindex.countries_at，1:10m；不在國界內的找 0.3° 內最近的），依面積加權：
- glacier-thinning.json：國家冰河平均變薄了多少（m 水當量，1976 年起累計到那一年，面積加權；正的是變薄，負的是變厚）
- glacier-gt.json：國家冰河累計少了多少質量（Gt，1976 年起，正的是減少），比例圓
水文年：北半球 10 月 1 日起、南半球 4 月 1 日起、熱帶 1 月 1 日起，用結束的那一年標示（WGMS 的寫法）。
南極洲本體與格陵蘭冰蓋不是冰河（AMCE 只有周邊的冰河）。

**海冰**（NSIDC Sea Ice Index G02135 v4，美國政府作品）：北極每年 9 月、南極每年 2 月（各自海冰最少的月份）的
月平均海冰範圍的邊緣線（shapefile 的 polyline，極地立體投影，rasterio 的 PROJ 換成經緯度；沿著 25 km 格子邊的鋸齒
在投影座標上用移動平均抹平，smooth()），1979 年起一年一條；
加上 1981–2010 年的中位數邊緣（虛線，比較的基準）。ice-edges.json：types 是年代（0：1979–1989 … 4：2020 年代、
5：中位數），records 有年份、北極或南極、那個月的海冰範圍（百萬 km²，NSIDC 的月表）。

**海平面**（NOAA STAR 衛星測高，TOPEX、Jason-1/2/3、Sentinel-6MF，1993–2025 年，0.5° 網格，要標示
「Altimetry data are provided by NOAA Laboratory for Satellite Altimetry」）：每一格的海平面上升速度（mm/年）。
- grid/sea-level.png：分級後的代碼（SEA_LEVEL_BINS，0 是陸地或沒有資料），前端的類別網格圖層依代碼上色
- sea-level.json：國家沿海（離國界 NEAR_KM 公里以內的海，用颱風主題的 NearIndex）的平均上升速度（依緯度加權）；
  內陸國（Marine Regions 的 Landlocked country，海洋主題同一份）不算

panel.json：每國的冰河數與面積、沿海的海平面速度與格子數；全球的冰河累計變化（Gt、mm 海平面）、
每年 9 月北極與 2 月南極的海冰範圍。

約 1 分鐘（第一次下載 WGMS 54 MB、NSIDC 約 200 個小檔）。
"""
from __future__ import annotations

import csv
import io
import struct
import zipfile
from collections import defaultdict

import numpy as np

import geoindex
from common import OUT_DIR, download, indicator_file, lines_file, now_iso, write_json
from topics.koppen import png_gray
from topics.typhoons import NearIndex, simplify, unwrap

OUT = OUT_DIR / "topics" / "ice"
AMCE_URL = "https://wgms.ch/downloads/wgms-amce-2026-02-10.zip"
NSIDC = "https://noaadata.apps.nsidc.org/NOAA/G02135"
STAR_URL = "https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/slr/slr_map_ref.nc"
FIRST_ICE_YEAR = 1979
FIRST_GLACIER_YEAR = 1976
# 北極 9 月、南極 2 月：各自海冰最少的月份
HEMISPHERES = {"N": ("north", 9, "09_Sep"), "S": ("south", 2, "02_Feb")}
DECADES = [1979, 1990, 2000, 2010, 2020]
MEDIAN = len(DECADES)
SIMPLIFY_DEG = 0.05
SMOOTH = 2  # 海冰邊緣的移動平均：前後各幾點（格子邊上的點約 25 km 一個）
NEAR_KM = 200
# 海平面上升速度的分級（mm/年）：代碼 1 是下降（< 0），之後每一級；src/topics/ice.ts 的 SEA_LEVEL_CLASSES 要一致
SEA_LEVEL_BINS = [0, 2, 3, 4, 5, 6]


# ── 冰河 ──────────────────────────────────────────────

def glaciers() -> tuple[list[int], dict[str, np.ndarray], dict[str, np.ndarray], dict[str, dict], list[dict]]:
    """每國每年的累計變化：(年份, m 水當量（面積加權平均）, Gt, 每國的冰河數與面積, 全球)"""
    path = download(AMCE_URL, "wgms", "wgms-amce-2026-02-10.zip")
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        regions = sorted({n.split("/")[1].split("_")[0] for n in names if n.startswith("glacier/") and n.endswith("_metadata.csv")})
        meta_rows, series = [], []
        years: list[int] | None = None
        for region in regions:
            meta = list(csv.DictReader(io.TextIOWrapper(z.open(f"glacier/{region}_metadata.csv"), encoding="utf-8")))
            reader = csv.reader(io.TextIOWrapper(z.open(f"glacier/{region}_mwe.csv"), encoding="utf-8"))
            header = next(reader)
            # 各區域開始的年份不同（中歐 1915 年起、多數 1976 年起），只用全球都有的 FIRST_GLACIER_YEAR 起
            cols = [i for i, h in enumerate(header) if i > 0 and int(h) >= FIRST_GLACIER_YEAR]
            ys = [int(header[i]) for i in cols]
            if years is None:
                years = ys
            elif ys != years:
                raise ValueError(f"{region} 的年份跟其他區域不一樣：{ys[0]}–{ys[-1]}")
            by_id = {row[0]: [float(row[i]) if row[i] else np.nan for i in cols] for row in reader}
            for m in meta:
                values = by_id.get(m["outline_id"])
                if values is None:
                    continue
                meta_rows.append((float(m["longitude"]), float(m["latitude"]), float(m["area_km2"])))
                series.append(values)
        global_rows = list(csv.DictReader(io.TextIOWrapper(z.open("global.csv"), encoding="utf-8")))
    assert years is not None
    lon = np.array([r[0] for r in meta_rows])
    lat = np.array([r[1] for r in meta_rows])
    area = np.array([r[2] for r in meta_rows])
    mwe = np.array(series)
    print(f"  冰河 {len(area):,} 條（{len(regions)} 個區域），{years[0]}–{years[-1]} 年，總面積 {area.sum():,.0f} km²")
    owner = np.array(geoindex.countries_at(lon, lat, nearest=True), dtype=object)
    cum = np.nancumsum(np.nan_to_num(mwe, nan=0.0), axis=1)
    out_mwe, out_gt, info = {}, {}, {}
    for code in sorted({c for c in owner.tolist() if c}):
        m = owner == code
        a = area[m]
        # m 水當量 × km² × 10⁶ m²/km² × 1,000 kg/m³ = kg；1 Gt = 10¹² kg
        out_mwe[code] = -(cum[m] * a[:, None]).sum(axis=0) / a.sum()
        out_gt[code] = -(cum[m] * a[:, None]).sum(axis=0) * 1e6 * 1000 / 1e12
        info[code] = {"n": int(m.sum()), "area": round(float(a.sum()), 1)}
    print(f"  {len(info)} 個國家與地區有冰河；歸不到國家的 {int((owner == None).sum()):,} 條")  # noqa: E711
    return years, out_mwe, out_gt, info, global_rows


# ── 海冰 ──────────────────────────────────────────────

def read_polylines(data: bytes) -> list[list[tuple[float, float]]]:
    """shapefile（.shp）的 PolyLine（類型 3）或 Polygon（類型 5）：每個 part 一條線（投影座標）"""
    out = []
    pos = 100
    while pos + 8 <= len(data):
        _num, length = struct.unpack(">ii", data[pos : pos + 8])
        content = data[pos + 8 : pos + 8 + length * 2]
        pos += 8 + length * 2
        shape = struct.unpack("<i", content[:4])[0]
        if shape == 0:
            continue
        if shape not in (3, 5):
            raise ValueError(f"不支援的 shapefile 類型 {shape}")
        nparts, npoints = struct.unpack("<ii", content[36:44])
        parts = list(struct.unpack(f"<{nparts}i", content[44 : 44 + 4 * nparts]))
        pts = struct.unpack(f"<{2 * npoints}d", content[44 + 4 * nparts : 44 + 4 * nparts + 16 * npoints])
        xy = list(zip(pts[0::2], pts[1::2]))
        for i, start in enumerate(parts):
            end = parts[i + 1] if i + 1 < nparts else npoints
            out.append(xy[start:end])
    return out


def smooth(line: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """NSIDC 的邊緣沿著 25 km 的格子邊走（鋸齒狀）：在投影座標上取前後各 SMOOTH 點的移動平均，
    兩端（或封閉的環）照原樣接起來，鋸齒變成斜線；格子大小以下的細節本來就不可靠"""
    n = len(line)
    if n < 2 * SMOOTH + 1:
        return line
    a = np.asarray(line, dtype=float)
    closed = np.allclose(a[0], a[-1])
    if closed:
        ring = a[:-1]
        padded = np.vstack([ring[-SMOOTH:], ring, ring[:SMOOTH]])
    else:
        padded = np.vstack([np.repeat(a[:1], SMOOTH, axis=0), a, np.repeat(a[-1:], SMOOTH, axis=0)])
    kernel = np.ones(2 * SMOOTH + 1) / (2 * SMOOTH + 1)
    xs = np.convolve(padded[:, 0], kernel, mode="valid")
    ys = np.convolve(padded[:, 1], kernel, mode="valid")
    out = list(zip(xs.tolist(), ys.tolist()))
    if closed:
        out.append(out[0])
    else:
        out[0], out[-1] = line[0], line[-1]
    return out


def to_lonlat(zip_path, hemisphere: str) -> list[list[tuple[float, float]]]:
    from rasterio.crs import CRS
    from rasterio.warp import transform

    with zipfile.ZipFile(zip_path) as z:
        shp = next(n for n in z.namelist() if n.endswith(".shp"))
        prj = next(n for n in z.namelist() if n.endswith(".prj"))
        lines = read_polylines(z.read(shp))
        crs = CRS.from_wkt(z.read(prj).decode("utf-8"))
    out = []
    for line in lines:
        line = smooth(line)
        xs, ys = transform(crs, "EPSG:4326", [p[0] for p in line], [p[1] for p in line])
        lons = unwrap(list(xs))
        idx = simplify(lons, list(ys), set(), SIMPLIFY_DEG)
        out.append([(lons[i], ys[i]) for i in idx])
    return out


def extents(hemisphere: str, month: int) -> dict[int, float]:
    region, _, _ = HEMISPHERES[hemisphere]
    path = download(f"{NSIDC}/{region}/monthly/data/{hemisphere}_{month:02d}_extent_v4.0.csv", "nsidc", f"{hemisphere}_{month:02d}_extent_v4.0.csv")
    out = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.reader(f):
            if not row or not row[0].strip().isdigit():
                continue
            v = float(row[4])
            if v > 0:  # -9999 是缺值（1987-12、1988-01）
                out[int(row[0])] = v
    return out


def sea_ice(last_year: int) -> tuple[dict, dict[str, dict[int, float]]]:
    lines, types, records = [], [], []
    ext: dict[str, dict[int, float]] = {}
    for hemi, (region, month, folder) in HEMISPHERES.items():
        ext[hemi] = extents(hemi, month)
        for year in range(FIRST_ICE_YEAR, last_year + 1):
            name = f"extent_{hemi}_{year}{month:02d}_polyline_v4.0.zip"
            try:
                path = download(f"{NSIDC}/{region}/monthly/shapefiles/shp_extent/{folder}/{name}", "nsidc", name)
            except Exception as e:  # noqa: BLE001 — 今年還沒到那個月
                print(f"    沒有 {name}：{e}")
                continue
            decade = sum(year >= d for d in DECADES) - 1
            for line in to_lonlat(path, hemi):
                lines.append(line)
                types.append(decade)
                records.append({"y": year, "h": hemi, "e": ext[hemi].get(year)})
        name = f"median_extent_{hemi}_{month:02d}_1981-2010_polyline_v4.0.zip"
        path = download(f"{NSIDC}/{region}/monthly/shapefiles/shp_median/{name}", "nsidc", name)
        for line in to_lonlat(path, hemi):
            lines.append(line)
            types.append(MEDIAN)
            # 中位數一直都畫：年份寫成第一年（時間軸是累積的，1979 年起每一年都看得到）
            records.append({"y": FIRST_ICE_YEAR, "h": hemi, "e": None, "m": 1})
    data = lines_file(
        lines, 0.02, types,
        records=records,
        record_fields=["y", "h", "e", "m"],
        record_scale={"y": 1, "e": 0.01, "m": 1},
        record_delta=["y"],
        record_strings=["h"],
    )
    print(f"  海冰邊緣 {len(data['lines']):,} 條線")
    return data, ext


# ── 海平面 ──────────────────────────────────────────────

def sea_level() -> tuple[np.ndarray, np.ndarray]:
    """(全球 0.5° 的上升速度 mm/年，360 × 720，第一列北緯 90°；海以外是 nan, 分級代碼)"""
    import rasterio

    path = download(STAR_URL, "noaa-star", "slr_map_ref.nc")
    with rasterio.open(path) as ds:
        a = ds.read(1).astype(float)
        t = ds.transform
    # 0.5° 的格子，經度 −180–180、緯度 ±85（GDAL 讀 netCDF 時列由北到南）
    if abs(t.a - 0.5) > 1e-9 or abs(t.e + 0.5) > 1e-9:
        raise ValueError(f"海平面網格不是 0.5°：{t}")
    full = np.full((360, 720), np.nan)
    r0 = int(round((90 - t.f) / 0.5))
    c0 = int(round((t.c + 180) / 0.5))
    h, w = a.shape
    if c0 != 0 or w != 720:
        raise ValueError(f"海平面網格的經度範圍不是全球：{t} {a.shape}")
    full[r0 : r0 + h, :] = a
    codes = np.zeros(full.shape, dtype=np.uint8)
    ok = np.isfinite(full)
    codes[ok] = 1 + np.searchsorted(SEA_LEVEL_BINS, full[ok], side="right")
    return full, codes


def coastal_trends(grid: np.ndarray) -> dict[str, tuple[float, int]]:
    """沿海（離國界 NEAR_KM 公里以內的海）的平均上升速度與格子數；內陸國不算（瑞士、奧地利離地中海不到 200 公里）"""
    from sources import marine_regions

    landlocked = marine_regions.landlocked() | {"XKX"}  # Marine Regions 沒有科索沃，它也是內陸國（同海洋主題）
    rows, cols = np.nonzero(np.isfinite(grid))
    lons = -180 + (cols + 0.5) * 0.5
    lats = 90 - (rows + 0.5) * 0.5
    index = NearIndex(NEAR_KM)
    hp, hc, _ = index.query(lons, lats, np.zeros(len(lons), dtype=bool))
    w = np.cos(np.radians(lats))
    v = grid[rows, cols]
    acc, wsum, cnt = defaultdict(float), defaultdict(float), defaultdict(int)
    for p, c in zip(hp.tolist(), hc.tolist()):
        code = index.codes[c]
        if code in landlocked:
            continue
        acc[code] += v[p] * w[p]
        wsum[code] += w[p]
        cnt[code] += 1
    return {code: (acc[code] / wsum[code], cnt[code]) for code in acc}


def build() -> None:
    years, mwe, gt, info, global_rows = glaciers()
    ice, ext = sea_ice(max(years[-1], 2026))
    grid, codes = sea_level()
    coastal = coastal_trends(grid)
    print(f"  海平面：{int(np.isfinite(grid).sum()):,} 格，{len(coastal)} 個國家有沿海的格子")

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "grid").mkdir(exist_ok=True)
    (OUT / "grid" / "sea-level.png").write_bytes(png_gray(codes))
    write_json(OUT / "ice-edges.json", ice)
    write_json(OUT / "glacier-thinning.json", indicator_file(
        "glacier-thinning", "m w.e.", years, {c: [round(float(v), 2) for v in s] for c, s in mwe.items()}))
    write_json(OUT / "glacier-gt.json", indicator_file(
        "glacier-gt", "Gt", years, {c: [round(float(v), 3) for v in s] for c, s in gt.items()}))
    write_json(OUT / "sea-level.json", indicator_file(
        "sea-level", "mm/年", [2025], {c: [round(float(v), 2)] for c, (v, _n) in coastal.items()}))
    # 海冰的指標：國家沒有值（海冰不屬於任何國家），只給時間軸的年份
    ice_years = sorted({int(y) for e in ext.values() for y in e if y >= FIRST_ICE_YEAR})
    write_json(OUT / "sea-ice.json", indicator_file("sea-ice", "", ice_years, {}))
    ok = np.isfinite(grid)
    lat_w = np.cos(np.radians(90 - (np.nonzero(ok)[0] + 0.5) * 0.5))
    global_rate = float((grid[ok] * lat_w).sum() / lat_w.sum())
    print(f"  全球海洋的平均上升速度 {global_rate:.2f} mm/年（依緯度加權）")
    write_json(OUT / "panel.json", {
        "glaciers": info,
        "coastal": {c: [round(float(v), 2), n] for c, (v, n) in coastal.items()},
        "globalRate": round(global_rate, 2),
        "global": {
            "years": [int(r["year"]) for r in global_rows],
            "gt": [round(float(r["gt_cumsum"]), 1) for r in global_rows],
            "mmsle": [round(float(r["mmsle_cumsum"]), 2) for r in global_rows],
        },
        "seaIce": {h: {str(y): v for y, v in sorted(e.items()) if y >= FIRST_ICE_YEAR} for h, e in ext.items()},
    })
    write_json(OUT / "manifest.json", {
        "topic": "ice",
        "generatedAt": now_iso(),
        "sources": [
            "WGMS (2026): Annual mass-change estimates for the world's glaciers, doi:10.5904/wgms-amce-2026-02-10 (CC BY 4.0)",
            "NSIDC Sea Ice Index, Version 4 (G02135), US Government work",
            "Altimetry data are provided by NOAA Laboratory for Satellite Altimetry",
        ],
    })
    for c in ("CHE", "NOR", "ISL", "USA", "CAN", "CHN", "NPL", "NZL", "TWN", "JPN", "PHL", "NLD"):
        g = f"冰河 {info[c]['n']} 條、變薄 {mwe[c][-1]:.1f} m w.e.、{gt[c][-1]:.1f} Gt" if c in info else "沒有冰河"
        s = f"沿海海平面 {coastal[c][0]:.2f} mm/年（{coastal[c][1]} 格）" if c in coastal else "沒有沿海的格子"
        print(f"    {c}: {g}；{s}")


if __name__ == "__main__":
    build()
