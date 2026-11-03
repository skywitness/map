"""風與季風主題：NOAA PSL 的 NCEP/NCAR 再分析，離地 10 公尺的風，1991–2020 年每個月的長期平均（LTM）。

**來源**：uwnd.10m.mon.ltm.1991-2020.nc、vwnd.10m.mon.ltm.1991-2020.nc（風的東西、南北分量的月平均）與
wspd.10m.mon.ltm.1991-2020.nc（每天的風速的月平均）（T62 高斯網格，經度 0–358.125° 每 1.875°、緯度 94 列不等距，12 個月）。
風速用 wspd：u、v 的月平均合成的向量會互相抵消（風向常變的地方很小），只拿來畫風向與粒子。PSL 的 downloads 伺服器對這裡回 403，改從同一個單位的 THREDDS（psl.noaa.gov/thredds/fileServer）
下載同一個檔。資料集說明寫「Usage Restrictions: None」，要致謝「NCEP Reanalysis data provided by the NOAA PSL, Boulder,
Colorado, USA, from their Web site at https://psl.noaa.gov」。GDAL 讀 netCDF 時把緯度當成等距，這裡用高斯求積的節點
（numpy 的 leggauss）算出真正的緯度。

**輸出**（public/data/topics/wind/）：
- field/<月>.json：那個月的風場，內插到經度 −180–180°、緯度 −90–90° 每 FIELD_DEG 一格的規則網格（雙線性），u、v 各存成
  0.25 m/s 一級的 int8（base64），前端的粒子圖層（src/map/windLayer.ts）用來移動粒子。
- grid/<月>.png：風速（wspd）分級（SPEED_BINS）的 1° 類別網格（氣候分區的 classGrid 圖層），粒子底下的底色。
- speed.json：各國陸地格子的平均風速（wspd，m/s，依緯度加權），時間軸是 1–12 月。1° 的格子中心都不在國界內的小國
  （新加坡、多數島國）用國家標籤的位置（各國在讀什麼的 label_points()）內插一個點。
- panel.json：各國每個月的 [風速, 平均風向（u、v 的向量平均換成風從哪個方位吹來，16 方位）, 向量平均的風速]，
  給側欄的月曆；向量平均的風速 ÷ 風速是風向的穩定度（季風、信風接近 1）。

**高空的風**（2026-11-03，製作手冊第十七批 283）：同一個伺服器的 Monthlies/pressure 的 uwnd、vwnd、wspd.mon.ltm.1991-2020.nc
（17 層、2.5° 網格、12 個月，netCDF4 用 h5py 讀），取 850、500、250 hPa（約 1.5、5.5、10 公里）。輸出
field/<層>/<月>.json（u、v 的 int8 一級是 SCALE_UPPER 的值，250 hPa 的噴流到 74 m/s，0.25 m/s 一級存不下；pace 是前端粒子
的速度倍數，噴流太快會看不清楚）、grid/<層>/<月>.png（UPPER_BINS 分級）、speed/<層>.json（國土上空的平均風速）；
地面的風另外寫一份 speed/10m.json（跟 speed.json 一樣），「風向與風速」指標的高度選單用。

約 30 秒。
"""
from __future__ import annotations

import base64
from collections import defaultdict

import numpy as np

import geoindex
from common import OUT_DIR, download, indicator_file, now_iso, write_json
from topics.koppen import png_gray

OUT = OUT_DIR / "topics" / "wind"
BASE = "https://psl.noaa.gov/thredds/fileServer/Datasets/ncep.reanalysis/Monthlies/surface_gauss"
FIELD_DEG = 2
SCALE = 0.25
# 風速分級（m/s）：src/topics/wind.ts 的 SPEED_CLASSES 要一致（代碼 1 是最小一級）
SPEED_BINS = [2, 4, 6, 8, 10]
# 高空：層（hPa）→（int8 一級幾 m/s，粒子速度倍數）；分級是 wind.ts 的 UPPER_CLASSES
PRESSURE = "https://psl.noaa.gov/thredds/fileServer/Datasets/ncep.reanalysis/Monthlies/pressure"
UPPER = {850: (0.25, 1.0), 500: (0.5, 0.5), 250: (1.0, 0.3)}
UPPER_BINS = [5, 10, 20, 30, 40]


def read(var: str) -> np.ndarray:
    """(12, 94, 192)：月、緯度（北到南）、經度（0 起往東）"""
    import rasterio

    path = download(f"{BASE}/{var}.10m.mon.ltm.1991-2020.nc", "ncep", f"{var}.10m.mon.ltm.1991-2020.nc")
    with rasterio.open(f"NETCDF:{path}:{var}") as ds:
        if ds.count != 12 or ds.shape != (94, 192):
            raise ValueError(f"{var} 的網格不是 12 × 94 × 192：{ds.count} {ds.shape}")
        return ds.read().astype(float)


def read_upper(var: str, level: int) -> np.ndarray:
    """(12, 73, 144)：月、緯度（90 → −90 每 2.5°）、經度（0 起往東每 2.5°）"""
    import h5py

    path = download(f"{PRESSURE}/{var}.mon.ltm.1991-2020.nc", "ncep", f"{var}.mon.ltm.1991-2020.nc")
    with h5py.File(path, "r") as f:
        levels = f["level"][:].tolist()
        lat = f["lat"][:]
        if f[var].shape != (12, 17, 73, 144) or lat[0] != 90 or lat[-1] != -90:
            raise ValueError(f"{var} 的網格不是 12 × 17 × 73 × 144（北到南）：{f[var].shape}")
        a = f[var][:, levels.index(level)].astype(float)
    if (np.abs(a) > 1e3).any():
        raise ValueError(f"{var} {level} hPa 有缺值")
    return a


def write_upper(owner, codes, weight, lo, la, small) -> dict[int, dict[str, list[float]]]:
    """850、500、250 hPa 的風場、風速分級與國家的平均風速"""
    lats = np.arange(90, -90.1, -2.5)
    out = {}
    for level, (scale, pace) in UPPER.items():
        u, v, wspd = (read_upper(var, level) for var in ("uwnd", "vwnd", "wspd"))
        (OUT / "field" / str(level)).mkdir(parents=True, exist_ok=True)
        (OUT / "grid" / str(level)).mkdir(parents=True, exist_ok=True)
        series: dict[str, list[float]] = {c: [] for c in codes}
        for m in range(12):
            uf, vf = regrid(u[m], lats, FIELD_DEG), regrid(v[m], lats, FIELD_DEG)
            q = lambda a: np.clip(np.round(a / scale), -127, 127).astype(np.int8)  # noqa: E731
            write_json(OUT / "field" / str(level) / f"{m + 1}.json", {
                "width": uf.shape[1], "height": uf.shape[0], "deg": FIELD_DEG, "scale": scale, "pace": pace,
                "u": base64.b64encode(q(uf).tobytes()).decode(), "v": base64.b64encode(q(vf).tobytes()).decode(),
            }, quiet=True)
            sp = interp(wspd[m], lats, lo, la)
            classes = (1 + np.searchsorted(UPPER_BINS, sp, side="right")).astype(np.uint8)
            (OUT / "grid" / str(level) / f"{m + 1}.png").write_bytes(png_gray(classes))
            for c in codes:
                mask = owner == c
                w = weight[mask]
                series[c].append(round(float((sp[mask] * w).sum() / w.sum()), 2))
            for c, (plon, plat) in small.items():
                series.setdefault(c, []).append(round(float(interp(wspd[m], lats, plon, plat)), 2))
        write_json(OUT / "speed" / f"{level}.json", indicator_file(f"speed/{level}", "m/s", list(range(1, 13)), series))
        out[level] = series
        tpe = [round(float(np.hypot(interp(u[m], lats, 121.5, 25.04), interp(v[m], lats, 121.5, 25.04))), 1) for m in (0, 6)]
        jan = np.hypot(u[0], v[0])
        k = np.unravel_index(int(np.argmax(jan)), jan.shape)
        print(f"  {level} hPa：臺北上空 1 月 {tpe[0]}、7 月 {tpe[1]} m/s（u、v 的月平均合成）；1 月最強 {jan.max():.1f} m/s"
              f"（北緯 {lats[k[0]]}°、東經 {k[1] * 2.5}°）；台灣國土上空 1 月 {series.get('TWN', [None])[0]} m/s")
    return out


def gaussian_lats(n: int = 94) -> np.ndarray:
    """T62 的高斯緯度（北到南）"""
    x, _ = np.polynomial.legendre.leggauss(n)
    return np.degrees(np.arcsin(x))[::-1]


def interp(a: np.ndarray, lats: np.ndarray, lon, lat) -> np.ndarray:
    """經度從 0° 起等距的網格（地面是 94 × 192 的高斯網格，高空是 73 × 144 的 2.5° 網格）在任意經緯度的值
    （雙線性，兩極外插用最近的那一列）"""
    from scipy.interpolate import RegularGridInterpolator

    # 經度補上 360° 那一欄，才能內插到最後一欄與第一欄之間
    ext = np.hstack([a, a[:, :1]])
    ext_lons = np.append(np.arange(a.shape[1]) * (360 / a.shape[1]), 360.0)
    f = RegularGridInterpolator((lats[::-1], ext_lons), ext[::-1], bounds_error=False, fill_value=None)
    return f((np.clip(lat, lats[-1], lats[0]), np.asarray(lon) % 360))


def regrid(a: np.ndarray, lats: np.ndarray, deg: float) -> np.ndarray:
    """→ 經度 −180–180、緯度 90 → −90 每 deg 的規則網格（格點在 deg 的整數倍上）"""
    la, lo = np.meshgrid(np.arange(90, -90 - 1e-9, -deg), np.arange(-180, 180 + 1e-9, deg), indexing="ij")
    return interp(a, lats, lo, la)


def compass(u: float, v: float) -> int:
    """風從哪裡吹來（0 = 北，順時針 16 方位）：風向是風「來」的方向，向量 (u, v) 的反方向"""
    deg = (np.degrees(np.arctan2(-u, -v)) + 360) % 360
    return int(round(deg / 22.5)) % 16


def build() -> None:
    u, v, wspd = read("uwnd"), read("vwnd"), read("wspd")
    lats = gaussian_lats()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "field").mkdir(exist_ok=True)
    (OUT / "grid").mkdir(exist_ok=True)

    # 國家：1° 網格的陸地格子
    g_lats = np.arange(89.5, -90, -1.0)
    g_lons = np.arange(-179.5, 180, 1.0)
    la, lo = np.meshgrid(g_lats, g_lons, indexing="ij")
    owner = np.array(geoindex.countries_at(lo.ravel(), la.ravel(), nearest=False), dtype=object).reshape(la.shape)
    codes = sorted({c for c in owner.ravel().tolist() if c})
    weight = np.cos(np.radians(la))
    from topics.reads import label_points

    small = {c: p for c, p in label_points().items() if c not in codes}

    speed_series: dict[str, list[float | None]] = {c: [] for c in codes}
    panel: dict[str, list[list]] = defaultdict(list)
    total = 0
    for m in range(12):
        uf = regrid(u[m], lats, FIELD_DEG)
        vf = regrid(v[m], lats, FIELD_DEG)
        q = lambda a: np.clip(np.round(a / SCALE), -127, 127).astype(np.int8)  # noqa: E731
        field = {
            "width": uf.shape[1], "height": uf.shape[0], "deg": FIELD_DEG, "scale": SCALE,
            "u": base64.b64encode(q(uf).tobytes()).decode(), "v": base64.b64encode(q(vf).tobytes()).decode(),
        }
        write_json(OUT / "field" / f"{m + 1}.json", field, quiet=True)
        total += (OUT / "field" / f"{m + 1}.json").stat().st_size

        # 1° 的格子中心（.5 度）的風速（wspd）與 u、v：分級的底色、國家的平均
        u1, v1, sp = (interp(a[m], lats, lo, la) for a in (u, v, wspd))
        classes = (1 + np.searchsorted(SPEED_BINS, sp, side="right")).astype(np.uint8)
        (OUT / "grid" / f"{m + 1}.png").write_bytes(png_gray(classes))
        for c in codes:
            mask = owner == c
            w = weight[mask]
            s = float((sp[mask] * w).sum() / w.sum())
            mu = float((u1[mask] * w).sum() / w.sum())
            mv = float((v1[mask] * w).sum() / w.sum())
            speed_series[c].append(round(s, 2))
            panel[c].append([round(s, 1), compass(mu, mv), round(float(np.hypot(mu, mv)), 1)])
        for c, (plon, plat) in small.items():
            s, mu, mv = (float(interp(a[m], lats, plon, plat)) for a in (wspd, u, v))
            speed_series.setdefault(c, []).append(round(s, 2))
            panel[c].append([round(s, 1), compass(mu, mv), round(float(np.hypot(mu, mv)), 1)])
    print(f"  風場 12 個月共 {total / 1024:.0f} KB；{len(codes)} 個國家與地區有陸地格子，{len(small)} 個小國用標籤的位置")
    write_json(OUT / "speed.json", indicator_file("speed", "m/s", list(range(1, 13)), speed_series))
    write_json(OUT / "speed" / "10m.json", indicator_file("speed/10m", "m/s", list(range(1, 13)), speed_series))
    write_upper(owner, codes, weight, lo, la, small)
    write_json(OUT / "panel.json", {"countries": panel})
    write_json(OUT / "manifest.json", {
        "topic": "wind",
        "generatedAt": now_iso(),
        "source": "NCEP Reanalysis data provided by the NOAA PSL, Boulder, Colorado, USA, from their Web site at https://psl.noaa.gov (10 m wind and 850, 500, 250 hPa winds, monthly long-term mean 1991–2020)",
    })
    names = ["北", "北北東", "東北", "東北東", "東", "東南東", "東南", "南南東", "南", "南南西", "西南", "西南西", "西", "西北西", "西北", "北北西"]
    for c in ("TWN", "IND", "JPN", "NLD", "CHL"):
        if c in panel:
            print(f"    {c}: 1 月 {names[panel[c][0][1]]}風 {panel[c][0][0]} m/s；7 月 {names[panel[c][6][1]]}風 {panel[c][6][0]} m/s")


if __name__ == "__main__":
    build()
