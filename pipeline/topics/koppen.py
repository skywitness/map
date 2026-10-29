"""氣候分區（柯本）主題：Beck 等人 2023 的柯本－蓋格氣候分類圖（figshare v2，2026-01，CC BY 4.0），0.1° 網格。

**來源**：koppen_geiger_tif.zip（130 MB）裡的 0.1° GeoTIFF（3600 × 1800、uint8，0 是海、1–30 是 30 種氣候類型，
對照表是 legend.txt；CLASSES 照抄代碼與 Beck 用的顏色）。時期：1901–1930、1931–1960、1961–1990、1991–2020 四個
歷史時期，2041–2070、2071–2099 兩個未來時期取 SSP2-4.5（中度排放）與 SSP5-8.5（高排放）兩個情境（使用者決定）。

**地圖**（grid/<時期>.png）：每個時期一張 3600 × 1800 的 8 位元灰階 PNG，像素值就是類型代碼（不上色，前端用自己的
WebGL 圖層依代碼上色，src/map/classGridLayer.ts），自己編碼（不濾波、zlib 9），每張約 160 KB。

**國家**：每個陸地格子的中心點歸到國家（geoindex.countries_at，1:10m 國界；不在國界內的找 0.3° 內最近的國界），
面積依 cos(緯度) 加權。指標（各情境一個檔，歷史時期兩個檔一樣）：
- main/<情境>.json：面積最大的氣候類型（代碼 1–30，地圖不上色，給 tooltip 與排名表）
- group/<情境>.json：面積最大的氣候帶（1 熱帶 A、2 乾燥 B、3 溫帶 C、4 冷溫帶 D、5 極地 E）
- changed/<情境>.json：氣候類型跟 1991–2020 年不同的面積比例（%）
- panel.json：每國每個時期各類型的面積比例（千分比，≥ 1‰ 的才列）
小國沒有任何格子中心落在國界內時（0.1° 太粗，例如吐瓦魯），值是 null。

約 1 分鐘（判斷 220 萬個陸地格子的國家）。
"""
from __future__ import annotations

import io
import struct
import zipfile
import zlib
from collections import defaultdict

import numpy as np

import geoindex
from common import OUT_DIR, download, indicator_file, now_iso, write_json

OUT = OUT_DIR / "topics" / "koppen"
URL = "https://ndownloader.figshare.com/files/61012822"
# 時間軸的年份是時期的第一年；未來時期依情境分開（子項目）
PERIODS = [(1901, "1901_1930"), (1931, "1931_1960"), (1961, "1961_1990"), (1991, "1991_2020"),
           (2041, "2041_2070"), (2071, "2071_2099")]
FUTURE_FROM = 2041
SCENARIOS = ["ssp245", "ssp585"]
BASE = 1991

# legend.txt：代碼、符號、Beck 用的顏色（src/topics/koppen.ts 的 CLASSES 要一致）
CLASSES = [
    ("Af", "#0000ff"), ("Am", "#0078ff"), ("Aw", "#46aafa"),
    ("BWh", "#ff0000"), ("BWk", "#ff9696"), ("BSh", "#f5a500"), ("BSk", "#ffdc64"),
    ("Csa", "#ffff00"), ("Csb", "#c8c800"), ("Csc", "#969600"),
    ("Cwa", "#96ff96"), ("Cwb", "#64c864"), ("Cwc", "#329632"),
    ("Cfa", "#c8ff50"), ("Cfb", "#64ff50"), ("Cfc", "#32c800"),
    ("Dsa", "#ff00ff"), ("Dsb", "#c800c8"), ("Dsc", "#963296"), ("Dsd", "#966496"),
    ("Dwa", "#aaafff"), ("Dwb", "#5a78dc"), ("Dwc", "#4b50b4"), ("Dwd", "#320087"),
    ("Dfa", "#00ffff"), ("Dfb", "#37c8ff"), ("Dfc", "#007d7d"), ("Dfd", "#00465f"),
    ("ET", "#b2b2b2"), ("EF", "#666666"),
]
GROUPS = "ABCDE"


def group_of(code: int) -> int:
    """類型代碼 → 氣候帶 1–5（A–E）"""
    return GROUPS.index(CLASSES[code - 1][0][0]) + 1


def key(year: int, scenario: str) -> str:
    return str(year) if year < FUTURE_FROM else f"{year}-{scenario}"


def read_grids() -> dict[str, np.ndarray]:
    from rasterio.io import MemoryFile

    path = download(URL, "koppen", "koppen_geiger_tif.zip")
    out = {}
    with zipfile.ZipFile(path) as z:
        legend = z.read("legend.txt").decode("utf-8")
        for i, (sym, _color) in enumerate(CLASSES, start=1):
            if f"{i}:" not in legend or f" {sym} " not in legend:
                raise ValueError(f"legend.txt 跟 CLASSES 不一致：{i} {sym}")
        for year, folder in PERIODS:
            for scenario in SCENARIOS if year >= FUTURE_FROM else [None]:
                name = f"{folder}/{scenario}/koppen_geiger_0p1.tif" if scenario else f"{folder}/koppen_geiger_0p1.tif"
                with MemoryFile(z.read(name)) as m, m.open() as ds:
                    t = ds.transform
                    if ds.shape != (1800, 3600) or (t.a, t.c, t.e, t.f) != (0.1, -180, -0.1, 90):
                        raise ValueError(f"{name} 的範圍不是 0.1° 全球網格：{ds.shape} {t}")
                    out[key(year, scenario or "")] = ds.read(1)
    return out


def png_gray(a: np.ndarray) -> bytes:
    h, w = a.shape
    raw = np.hstack([np.zeros((h, 1), np.uint8), a.astype(np.uint8)]).tobytes()

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    return b"".join([
        b"\x89PNG\r\n\x1a\n",
        chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0)),
        chunk(b"IDAT", zlib.compress(raw, 9)),
        chunk(b"IEND", b""),
    ])


def build() -> None:
    grids = read_grids()
    keys = list(grids)
    print(f"  讀了 {len(keys)} 個時期：{', '.join(keys)}")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "grid").mkdir(exist_ok=True)
    total = 0
    for k, a in grids.items():
        data = png_gray(a)
        (OUT / "grid" / f"{k}.png").write_bytes(data)
        total += len(data)
    print(f"  輸出 grid/*.png {len(keys)} 張，共 {total / 1024:.0f} KB")

    # 陸地格子（任何一個時期有類型）歸國家
    land = np.zeros((1800, 3600), dtype=bool)
    for a in grids.values():
        land |= a > 0
    rows, cols = np.nonzero(land)
    lons = -180 + (cols + 0.5) * 0.1
    lats = 90 - (rows + 0.5) * 0.1
    print(f"  陸地格子 {len(rows):,} 個，判斷國家…")
    owner = np.array(geoindex.countries_at(lons, lats, nearest=True), dtype=object)
    weight = np.cos(np.radians(lats))
    codes = sorted({c for c in owner.tolist() if c})
    index = {c: i for i, c in enumerate(codes)}
    oi = np.array([index.get(c, -1) for c in owner.tolist()])
    has = oi >= 0
    print(f"  {len(codes)} 個國家與地區有格子；沒有國家的陸地格子 {int((~has).sum()):,} 個")

    # 每國每個時期各類型的面積（加權）
    shares: dict[str, np.ndarray] = {}
    for k, a in grids.items():
        cls = a[rows, cols].astype(np.int64)
        m = has & (cls > 0)
        acc = np.zeros((len(codes), 31))
        np.add.at(acc, (oi[m], cls[m]), weight[m])
        tot = acc.sum(axis=1, keepdims=True)
        with np.errstate(invalid="ignore", divide="ignore"):
            shares[k] = np.where(tot > 0, acc / tot, np.nan)
    base_cls = grids[str(BASE)][rows, cols]
    changed: dict[str, np.ndarray] = {}
    for k, a in grids.items():
        cls = a[rows, cols]
        m = has & (cls > 0) & (base_cls > 0)
        num = np.zeros(len(codes))
        den = np.zeros(len(codes))
        np.add.at(den, oi[m], weight[m])
        np.add.at(num, oi[m & (cls != base_cls)], weight[m & (cls != base_cls)])
        with np.errstate(invalid="ignore", divide="ignore"):
            changed[k] = np.where(den > 0, num / den * 100, np.nan)

    years = [y for y, _ in PERIODS]
    for scenario in SCENARIOS:
        ks = [key(y, scenario) for y in years]
        main, group, change = {}, {}, {}
        for c, i in index.items():
            m_vals, g_vals, c_vals = [], [], []
            for k in ks:
                s = shares[k][i]
                if np.isnan(s).all():
                    m_vals.append(None)
                    g_vals.append(None)
                    c_vals.append(None)
                    continue
                m_vals.append(int(np.argmax(s[1:]) + 1))
                g = np.zeros(6)
                for code in range(1, 31):
                    g[group_of(code)] += s[code]
                g_vals.append(int(np.argmax(g[1:]) + 1))
                v = changed[k][i]
                c_vals.append(None if np.isnan(v) else round(float(v), 1))
            main[c], group[c], change[c] = m_vals, g_vals, c_vals
        meta = {"projectionFrom": FUTURE_FROM}
        write_json(OUT / "main" / f"{scenario}.json", indicator_file("main", "", years, main, **meta))
        write_json(OUT / "group" / f"{scenario}.json", indicator_file("group", "", years, group, **meta))
        write_json(OUT / "changed" / f"{scenario}.json", indicator_file("changed", "%", years, change, **meta))

    panel: dict[str, dict[str, list[list[int]]]] = {}
    for c, i in index.items():
        per = {}
        for k in keys:
            s = shares[k][i]
            if np.isnan(s).all():
                continue
            rows_ = [[code, int(round(s[code] * 1000))] for code in range(1, 31) if s[code] * 1000 >= 1]
            per[k] = sorted(rows_, key=lambda r: -r[1])
        panel[c] = per
    write_json(OUT / "panel.json", {"periods": keys, "countries": panel})
    write_json(OUT / "manifest.json", {
        "topic": "koppen",
        "generatedAt": now_iso(),
        "source": "Beck et al. (2023), High-resolution (1 km) Köppen-Geiger maps for 1901–2099 based on constrained CMIP6 projections, figshare v2 (doi:10.6084/m9.figshare.21789074)",
        "license": "CC BY 4.0",
    })
    for c in ("TWN", "JPN", "CHN", "USA", "AUS", "TUV", "NRU", "SGP"):
        if c in panel:
            print(f"    {c}: 1991 {panel[c].get('1991', [])[:6]}；2071-ssp585 {panel[c].get('2071-ssp585', [])[:6]}")
        else:
            print(f"    {c}: 沒有格子")


if __name__ == "__main__":
    build()
