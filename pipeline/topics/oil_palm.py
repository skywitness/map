"""油棕園（新主題，2026-10-30）：Descals 等的全球油棕園範圍（10 m，2021 年）與種植年份（30 m，1990–2021）。

**資料**：Zenodo 13379129 v1.2（2024-08-27，cc-by-4.0，不必登入）：
- GlobalOilPalm_OP-extent.zip（156 MB）：609 個 100 km 圖磚（EPSG:4326，約 10 m），1 是工業油棕園、2 是小農油棕園、0 不是
- GlobalOilPalm_OP-YoP.zip（146 MB）：同樣 609 個圖磚（約 30 m），值是種植年份（1989 是 1990 年以前，0 不是油棕園；
  少數 2022 年的像素算 2021 年）
只抓得到林冠已閉合的成熟油棕，新種的看不到；種植年份跟範圍圖的解析度不同、像素不一一對應（說明寫明）。
台灣沒有油棕園（609 個圖磚最北到北緯 19.8°），不必補。

**網格**（類別網格，src/map/classGridLayer.ts；範圍 BOUNDS、每格 CELL 度，約 7 km，4096 × 640）：
- grid/planting.png：每一格的代碼是「這一格的油棕園有一半種下去的年份」（種植年份的中位數）− 1988：
  1 是 1990 年以前，2 是 1990 年 … 33 是 2021 年。油棕園占這一格不到 MIN_SHARE 的不畫（0）。前端依時間軸只畫代碼
  不晚於那一年的格子，播放就是擴張的過程。
- grid/type.png：2021 年的範圍裡工業還是小農多：1 工業、2 小農（同樣 MIN_SHARE 以上）。

**國家**（像素依 0.01° 的小格歸國，geoindex.countries_at）：
- area.json：油棕園的面積（萬公頃）。2021 年是範圍圖（10 m）的面積；1990–2020 年依種植年份圖：2021 年的面積 ×（那一年以前
  種下的像素 ÷ 種植年份圖的全部像素），也就是 2021 年還在的油棕園當年已經種下的部分（後來砍掉的不算）。
- smallholder.json：2021 年小農油棕園占的比例（%）。

第一次讀 609 × 2 個圖磚約 15 分鐘（之後用 .cache/oilpalm/aggregate.npz）。
"""
from __future__ import annotations

import io
import zipfile
from collections import defaultdict

import numpy as np

from common import CACHE_DIR, OUT_DIR, download, indicator_file, now_iso, write_json
from geoindex import countries_at
from topics.koppen import png_gray

OUT = OUT_DIR / "topics" / "oil-palm"
RECORD = "https://zenodo.org/api/records/13379129/files"
# 網格的範圍與大小：4096 × 640（WebGL 的貼圖至少要支援 4096）
BOUNDS = (-96.0, -19.5, 160.0, 20.5)
CELL = 0.0625
FINE = 0.01  # 歸國用的小格
MIN_SHARE = 0.03  # 油棕園占一格 3% 以上才畫（7 km 的格子約 150 公頃）
FIRST, LAST = 1989, 2021
AGG = CACHE_DIR / "oilpalm" / "aggregate.npz"


def aggregate() -> dict[str, np.ndarray]:
    import rasterio

    if AGG.exists():
        return dict(np.load(AGG))
    W, S, E, N = BOUNDS
    gw, gh = round((E - W) / CELL), round((N - S) / CELL)
    fw, fh = round((E - W) / FINE), round((N - S) / FINE)
    nyears = LAST - FIRST + 1
    ext = np.zeros((3, gh * gw), np.float64)  # 工業、小農的面積（km²），第 0 列不用
    yop = np.zeros((nyears, gh * gw), np.float64)  # 每一年種下的像素數
    fine_ext: dict[int, np.ndarray] = defaultdict(lambda: np.zeros(3))
    fine_yop: dict[int, np.ndarray] = defaultdict(lambda: np.zeros(nyears))
    for kind, name in (("ext", "GlobalOilPalm_OP-extent.zip"), ("yop", "GlobalOilPalm_OP-YoP.zip")):
        path = download(f"{RECORD}/{name}/content", "oilpalm", name)
        with zipfile.ZipFile(path) as z:
            names = sorted(n for n in z.namelist() if n.endswith(".tif"))
            for i, n in enumerate(names):
                with rasterio.open(io.BytesIO(z.read(n))) as r:
                    full = r.read(1)
                    b = r.bounds
                # 一次 1,000 列，nonzero 的索引才不會太大（工業油棕園多的圖磚一半以上是油棕）
                for r0 in range(0, full.shape[0], 1000):
                    a = full[r0:r0 + 1000]
                    ys, xs = np.nonzero(a)
                    if not len(ys):
                        continue
                    v = a[ys, xs].astype(np.int64)
                    lat = b.top - (ys + r0 + 0.5) * (b.top - b.bottom) / full.shape[0]
                    lon = b.left + (xs + 0.5) * (b.right - b.left) / full.shape[1]
                    # 每個像素的面積（km²）
                    px = (((b.right - b.left) / full.shape[1]) * ((b.top - b.bottom) / full.shape[0]) * 111.32 ** 2
                          * np.cos(np.radians(lat)))
                    cell = np.floor((N - lat) / CELL).astype(np.int64) * gw + np.floor((lon - W) / CELL).astype(np.int64)
                    fine = np.floor((N - lat) / FINE).astype(np.int64) * fw + np.floor((lon - W) / FINE).astype(np.int64)
                    if kind == "ext":
                        for t in (1, 2):
                            m = v == t
                            ext[t] += np.bincount(cell[m], weights=px[m], minlength=gh * gw)
                            u, inv = np.unique(fine[m], return_inverse=True)
                            sums = np.bincount(inv, weights=px[m])
                            for f, s_ in zip(u.tolist(), sums.tolist()):
                                fine_ext[f][t] += s_
                    else:
                        year = np.clip(v, FIRST, LAST) - FIRST
                        yop += np.bincount(year * (gh * gw) + cell, minlength=nyears * gh * gw).reshape(nyears, -1)
                        u, c = np.unique(fine * nyears + year, return_counts=True)
                        for k, cnt in zip(u.tolist(), c.tolist()):
                            fine_yop[k // nyears][k % nyears] += cnt
                if i % 50 == 0:
                    print(f"    {kind} {i + 1} / {len(names)}", flush=True)
    keys = sorted(set(fine_ext) | set(fine_yop))
    out = {
        "ext": ext, "yop": yop, "fine": np.array(keys, np.int64),
        "fine_ext": np.array([fine_ext[k] if k in fine_ext else np.zeros(3) for k in keys]),
        "fine_yop": np.array([fine_yop[k] if k in fine_yop else np.zeros(nyears) for k in keys]),
    }
    AGG.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(AGG, **out)
    return out


def build() -> None:
    W, S, E, N = BOUNDS
    gw, gh = round((E - W) / CELL), round((N - S) / CELL)
    fw = round((E - W) / FINE)
    nyears = LAST - FIRST + 1
    years = list(range(FIRST, LAST + 1))
    d = aggregate()
    ext, yop = d["ext"], d["yop"]

    # 每一格的陸地面積近似成整格的面積（海上的格子油棕的比例本來就是 0）
    rows = np.arange(gh)
    cell_km2 = (CELL * 111.32) ** 2 * np.cos(np.radians(N - (rows + 0.5) * CELL))
    cell_km2 = np.repeat(cell_km2, gw)
    total = ext[1] + ext[2]
    drawn = total / cell_km2 >= MIN_SHARE
    # 種植年份的中位數：累計到一半的那一年；種植年份圖沒有值的格子（只有範圍圖有）算 2021 年
    cum = np.cumsum(yop, axis=0)
    half = cum[-1] / 2
    median = np.where(cum[-1] > 0, (cum < half[None, :]).sum(axis=0), nyears - 1)
    planting = np.where(drawn, median + 1, 0).astype(np.uint8)
    kind = np.where(drawn, np.where(ext[1] >= ext[2], 1, 2), 0).astype(np.uint8)
    (OUT / "grid").mkdir(parents=True, exist_ok=True)
    (OUT / "grid" / "planting.png").write_bytes(png_gray(planting.reshape(gh, gw)))
    (OUT / "grid" / "type.png").write_bytes(png_gray(kind.reshape(gh, gw)))
    for f in ("planting", "type"):
        print(f"  輸出 public/data/topics/oil-palm/grid/{f}.png ({(OUT / 'grid' / f'{f}.png').stat().st_size / 1024:.0f} KB)")
    print(f"  畫出的格子 {int(drawn.sum()):,}（{drawn.mean() * 100:.2f}%）；全部油棕園 {total.sum() / 1e4:,.1f} 萬 km²")

    # 國家
    fine = d["fine"]
    lats = N - (fine // fw + 0.5) * FINE
    lons = W + (fine % fw + 0.5) * FINE
    iso = countries_at(lons.tolist(), lats.tolist())
    by_ext: dict[str, np.ndarray] = defaultdict(lambda: np.zeros(3))
    by_yop: dict[str, np.ndarray] = defaultdict(lambda: np.zeros(nyears))
    for c, e, y in zip(iso, d["fine_ext"], d["fine_yop"]):
        if c is None:
            continue
        by_ext[c] += e
        by_yop[c] += y
    area: dict[str, list[float | None]] = {}
    small: dict[str, list[float | None]] = {}
    world = np.zeros(nyears)
    for c, e in by_ext.items():
        km2 = e[1] + e[2]
        if km2 < 1:  # 不到 100 公頃的（多半是邊界上的誤差）不列
            continue
        y = by_yop[c]
        share = np.cumsum(y) / y.sum() if y.sum() > 0 else np.ones(nyears)
        # 2021 年是範圍圖的面積；之前依種植年份的累計比例；1989（1990 年以前）不單獨列
        series = km2 * share / 100  # km² → 萬公頃（1 萬公頃 = 100 km²）
        area[c] = [round(float(v), 3) for v in series[1:]]
        world += series
        small[c] = [round(float(e[2] / km2 * 100), 1)]
    out_years = years[1:]
    top = sorted(area.items(), key=lambda kv: -kv[1][-1])[:8]
    print("  2021 年最多：" + "、".join(f"{c} {v[-1]:,.1f} 萬公頃" for c, v in top))
    print("  1990 年：" + "、".join(f"{c} {v[0]:,.1f}" for c, v in top))
    write_json(OUT / "area.json", indicator_file("area", "萬公頃", out_years, area,
                                                 aggregates={"WLD": [round(float(v), 2) for v in world[1:]]}))
    write_json(OUT / "smallholder.json", indicator_file("smallholder", "%", [LAST], small))
    write_json(OUT / "manifest.json", {
        "topic": "oil-palm", "generatedAt": now_iso(),
        "source": "Descals, A. et al. Global oil palm extent and planting year from 1990 to 2021, v1.2 (Zenodo 13379129, CC BY 4.0)",
        "grid": {"bounds": BOUNDS, "cell": CELL, "width": gw, "height": gh, "minShare": MIN_SHARE},
    })
