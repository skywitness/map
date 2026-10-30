"""臭氧洞：NASA Ozone Watch 的每日 1° 臭氧全量網格，畫每年南極臭氧洞面積最大那一天的範圍（220 DU 的等值線）。

- 使用者 2026-10-30 決定「一年一張」：畫南極 9–10 月最大的臭氧洞範圍，不做每天的全球動畫。
- 哪一天：Ozone Watch 的年表（statistics/annual_data.html）列出每年「臭氧洞面積最大的一天」與「臭氧最低的一天」
  與數值（1979 年起，1995 年沒有資料）。抓那一天的 L3 網格檔（data/<衛星>/Y<年>/…<年>m<月日>….txt），
  畫 220 DU（臭氧洞的定義）的等值線，另外記下這一天網格上的最低值。
- 衛星：1979–1992 Nimbus-7 TOMS、1993–1994 Meteor-3 TOMS、1996–2004 Earth Probe TOMS、2005 年起 Aura OMI
  （跟 Ozone Watch 的年表一樣的順序；OMPS 2012 年起才有）。
- 資料檔裡 0 是沒有量測（極夜、軌道之間的空隙）。Ozone Watch 的圖用 GEOS 模式補，資料檔沒有補；這裡自己補：
  先依同一條緯線左右最近的值內插（軌道空隙），還是 0 的（極點附近的極夜）用北邊一格的值往南延伸，
  所以極點附近的範圍是推的。面積用補過的網格算（220 DU 以下、南緯 40° 以南的格子），跟年表的數字比對。
- 授權：data/README.txt「The data in these directories are public data whose release is authorized by NASA」；
  網站「Please credit all material to “NASA Ozone Watch” unless otherwise noted」；NASA ESDIS 的資料政策
  「Unless the content is marked with a use restriction or license, data provided from a NASA-led mission are licensed
  as Creative Commons Zero (CC0)」。
"""
from __future__ import annotations

import html
import math
import re
import urllib.request

import numpy as np
from contourpy import contour_generator

from common import CACHE_DIR, OUT_DIR, USER_AGENT, download, indicator_file, lines_file, now_iso, write_json

BASE = "https://ozonewatch.gsfc.nasa.gov"
TABLE_URL = f"{BASE}/statistics/annual_data.html"
SOURCE = "ozonewatch"
OUT = OUT_DIR / "topics" / "ozone-hole"
HOLE = 220  # DU
MONTHS = {m: i + 1 for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July", "August",
                                           "September", "October", "November", "December"])}
EARTH_KM2 = 4 * math.pi * 6371.0088**2


def satellites(year: int) -> list[str]:
    """這一年可用的衛星，依優先順序"""
    if year <= 1992:
        return ["nimbus7"]
    if year <= 1994:
        return ["meteor3"]
    if year <= 2004:
        return ["eptoms"]
    # OMI 有幾天少了一半的軌道（2014-09-11、2019-09-08），那時改用 OMPS（Suomi NPP 2012 年起、NOAA-20 2018 年起）
    return ["omi"] + (["omps"] if year >= 2012 else []) + (["omps_n20"] if year >= 2018 else [])


def annual_table() -> dict[int, dict]:
    """{年: {area_date: (月, 日), area: 百萬 km², min_date, min: DU}}（面積最大、臭氧最低的一天）"""
    path = download(TABLE_URL, SOURCE, "annual_data.html")
    s = path.read_text(encoding="latin-1")
    out = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", s, flags=re.S):
        cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.S)]
        if len(cells) != 5 or not cells[0].isdigit():
            continue
        year = int(cells[0])
        if year in out:  # 第二張表（平均）只有 3 欄，這裡不會進來；保險起見只取第一次出現的
            continue

        def date(text: str) -> tuple[int, int]:
            day, month = text.split()
            return MONTHS[month], int(day)

        out[year] = {"area_date": date(cells[1]), "area": float(cells[2]), "min_date": date(cells[3]), "min": float(cells[4])}
    if 1995 in out or len(out) < 45:
        raise ValueError(f"Ozone Watch 年表的格式變了（{len(out)} 年）")
    return out


def day_file(sat: str, year: int, month: int, day: int) -> str | None:
    """那一天的 L3 檔名（從目錄列表找；同一天可能有好幾個版本，取最後一個）"""
    listing = CACHE_DIR / SOURCE / "listing" / f"{sat}_{year}.html"
    if not listing.exists():
        listing.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(f"{BASE}/data/{sat}/Y{year}/", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req) as resp:
            listing.write_bytes(resp.read())
    names = sorted(set(re.findall(rf'href="([^"/?]*{year}m?{month:02d}{day:02d}[^"/0-9][^"/]*\.txt|[^"/?]*{year}m?{month:02d}{day:02d}\.txt)"', listing.read_text(encoding="latin-1"))))
    return names[-1] if names else None


def read_grid(sat: str, year: int, month: int, day: int) -> tuple[np.ndarray, np.ndarray, np.ndarray] | None:
    """(緯度, 經度, 臭氧 DU[緯度, 經度])，緯度由南到北；0 改成 NaN。那一天沒有檔是 None"""
    name = day_file(sat, year, month, day)
    if name is None:
        return None
    path = download(f"{BASE}/data/{sat}/Y{year}/{name}", SOURCE, name)
    lines = path.read_text(encoding="latin-1").splitlines()
    lon_head, lat_head = lines[1], lines[2]
    nlon = int(re.search(r"(\d+)\s+bins", lon_head).group(1))
    nlat = int(re.search(r"(\d+)\s+bins", lat_head).group(1))
    lon_step = float(re.search(r"\(\s*([\d.]+)\s+degree", lon_head).group(1))
    lat_step = float(re.search(r"\(\s*([\d.]+)\s+degree", lat_head).group(1))
    # 每列開頭一個空格，之後每 3 個字元一個值（一列 25 個）；每條緯線的最後一列後面接「lat = …」
    rows, buf = [], ""
    for line in lines[3:]:
        if "lat =" in line:
            buf += line[1 : line.index("lat =")].rstrip()
            if len(buf) != nlon * 3:
                raise ValueError(f"{name} 的一條緯線有 {len(buf)} 個字元，應該是 {nlon * 3}")
            rows.append([int(buf[i : i + 3]) for i in range(0, nlon * 3, 3)])
            buf = ""
        else:
            buf += line[1:].rstrip()
    grid = np.array(rows, dtype=float)
    if grid.shape != (nlat, nlon):
        raise ValueError(f"{name} 的大小 {grid.shape} 跟表頭 {nlat}×{nlon} 不同")
    grid[grid <= 0] = np.nan
    lat = -90 + lat_step * (np.arange(nlat) + 0.5)
    lon = -180 + lon_step * (np.arange(nlon) + 0.5)
    return lat, lon, grid


def best_grid(year: int, month: int, day: int):
    """可用的衛星裡，南緯 50–75° 缺最少的那一個（極夜在更南邊，不算）"""
    best = None
    for sat in satellites(year):
        got = read_grid(sat, year, month, day)
        if got is None:
            continue
        lat, lon, grid = got
        band = (lat < -50) & (lat > -75)
        missing = float(np.isnan(grid[band]).mean())
        if best is None or missing < best[0] - 0.05:
            best = (missing, lat, lon, grid, sat)
        if missing < 0.1:
            break
    if best is None:
        raise ValueError(f"{year}/{month}/{day} 沒有任何衛星的檔")
    return best[1], best[2], best[3], best[4]


def fill(lat: np.ndarray, grid: np.ndarray) -> np.ndarray:
    """補沒有量測的格子：同一條緯線左右內插，再把北邊的值往南（往極點）延伸"""
    g = grid.copy()
    n = g.shape[1]
    for i in range(g.shape[0]):
        row = g[i]
        ok = np.nonzero(~np.isnan(row))[0]
        if 0 < ok.size < n:
            x = np.arange(n)
            g[i] = np.interp(x, ok, row[ok], period=n)
    south = np.nonzero(lat < 0)[0]
    for i in south[::-1]:  # 由赤道往南極
        if i + 1 < g.shape[0]:
            bad = np.isnan(g[i])
            g[i, bad] = g[i + 1, bad]
    return g


def hole_area(lat: np.ndarray, lat_step: float, lon_step: float, g: np.ndarray) -> float:
    """220 DU 以下、南緯 40° 以南的面積（百萬 km²）"""
    cell = (np.sin(np.radians(lat + lat_step / 2)) - np.sin(np.radians(lat - lat_step / 2))) * np.radians(lon_step) * 6371.0088**2
    sel = (lat < -40)[:, None] & (g < HOLE)
    return float((cell[:, None] * sel).sum() / 1e6)


def contour(lat: np.ndarray, lon: np.ndarray, g: np.ndarray) -> list[list[tuple[float, float]]]:
    """南緯 40° 以南的 220 DU 等值線：在極射投影的平面上畫（環繞極點的線才會是封閉的），再換回經緯度"""
    sel = lat < -35
    la, lo, v = lat[sel], lon, g[sel]
    # 極射投影的規則網格（南極在中心），用最近的格子取值
    size, half = 241, 55.0  # 半徑 55°（到南緯 35°）
    xs = np.linspace(-half, half, size)
    X, Y = np.meshgrid(xs, xs)
    r = np.hypot(X, Y)
    plat = -90 + r
    plon = np.degrees(np.arctan2(Y, X))
    ii = np.clip(np.round((plat - la[0]) / (la[1] - la[0])).astype(int), 0, len(la) - 1)
    jj = np.round((plon - lo[0]) / (lo[1] - lo[0])).astype(int) % len(lo)
    Z = v[ii, jj]
    Z[plat > -40] = np.nan
    lines = []
    for seg in contour_generator(xs, xs, Z).lines(HOLE):
        if len(seg) < 8:
            continue
        pts = []
        for x, y in seg:
            pts.append((round(float(np.degrees(np.arctan2(y, x))), 2), round(float(-90 + math.hypot(x, y)), 2)))
        lines.append(unwrap(pts))
    return lines


def unwrap(pts: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """經度展開成連續的（跨 180° 經線不斷開）"""
    out = [pts[0]]
    for x, y in pts[1:]:
        px = out[-1][0]
        while x - px > 180:
            x -= 360
        while x - px < -180:
            x += 360
        out.append((round(x, 2), y))
    return out


def build() -> None:
    table = annual_table()
    years = sorted(table)
    records, lines = [], []
    area_series, min_series, used = {}, {}, {}
    for year in years:
        t = table[year]
        month, day = t["area_date"]
        lat, lon, grid, sat = best_grid(year, month, day)
        g = fill(lat, grid)
        area = hole_area(lat, lat[1] - lat[0], lon[1] - lon[0], g)
        segs = contour(lat, lon, g)
        low = float(np.nanmin(grid[lat < -40]))
        used[year] = sat
        print(f"  {year} {month}/{day} {sat}：年表 {t['area']}、自己算 {area:.1f} 百萬 km²，{len(segs)} 段線；"
              f"最低 {t['min']} DU（{t['min_date'][0]}/{t['min_date'][1]}），這一天網格最低 {low:.0f}")
        rec = {
            "year": year, "d": month * 100 + day, "area": t["area"], "min": t["min"],
            "md": t["min_date"][0] * 100 + t["min_date"][1], "sat": sat,
        }
        for seg in segs:
            records.append(rec)
            lines.append(seg)
        area_series[year] = t["area"]
        min_series[year] = t["min"]
    write_json(
        OUT / "holes.json",
        lines_file(
            lines, records=records, record_fields=["year", "d", "area", "min", "md", "sat"],
            record_scale={"year": 1, "d": 1, "area": 0.1, "min": 0.1, "md": 1}, record_delta=["year"], record_strings=["sat"],
        ),
    )
    full = list(range(years[0], years[-1] + 1))
    meta = {y: table[y] for y in years}
    write_json(OUT / "area.json", indicator_file("area", "million km²", full, {"ATA": [area_series.get(y) for y in full]}))
    write_json(OUT / "minimum.json", indicator_file("minimum", "DU", full, {"ATA": [min_series.get(y) for y in full]}))
    write_json(OUT / "dates.json", {str(y): {"area": list(m["area_date"]), "min": list(m["min_date"]), "sat": used[y]} for y, m in meta.items()})
    write_json(OUT / "manifest.json", {"topic": "ozone-hole", "generatedAt": now_iso(), "source": "NASA Ozone Watch (TOMS, OMI daily L3 total ozone; annual statistics)"})
