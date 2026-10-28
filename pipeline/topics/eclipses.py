"""日食路徑主題：1900–2100 年每一次日全食、日環食、混合食的本影（或偽本影）路徑，由 NASA 公布的貝塞爾根數自己算
（DESIGN.md 第 8 節第 88 點）。

**資料**：NASA 五千年日食目錄（Espenak & Meeus 2006）列出每次日食的類型、沙羅週期、食甚的位置與路徑寬度；
貝塞爾根數（x、y、d、l1、l2、μ 的三次多項式，tan f1、tan f2）每次日食一頁：NASA 路徑表那一組（SEbeselm）有的用它，
沒有的用五千年日食典的（SEdata）（sources/nasa_eclipses.py、elements_for()）。

**路徑怎麼算**（Explanatory Supplement 的基本面座標；地球用 WGS 84 的扁橢球）：
- 基本面：通過地心、垂直於影軸的平面，x 向東、y 向北、z 指向月球。影軸在 (x, y)，本影錐在觀測者高度 ζ 的半徑是
  L2 = l2 − ζ tan f2（l2 < 0 是全食，> 0 是環食；混合食的 l2 很小，ζ 夠大的地方變全食）。
- 基本面的單位向量在地球固定座標（曆書子午線）是 x̂ = (sin μ, cos μ, 0)、ŷ = (−sin d cos μ, sin d sin μ, cos d)、
  ẑ = (cos d cos μ, −cos d sin μ, sin d)；基本面上的點 (ξ, η) 沿 ẑ 打到橢球 X² + Y² + Z²/(1 − e²) = 1 朝月球那一面
  （二次方程式取大的根），換成大地緯度與經度，經度再加 0.00417807° × ΔT（曆書子午線在格林威治以東 1.002738 ΔT）。
- 每 2 秒（太陽很低、地面上拉長的地方再細分）取一條「橫切線」：通過影軸、垂直於影子相對地面的運動方向（a, b）=
  (x′ − ξ′, y′ − η′)。線上落在地球上、而且離影軸 |c| ≤ |L2(ζ)| 的部分就是那一刻在本影裡的地面；兩端用二分法找到邊界。
  地面上的觀測者通過本影時一定會經過某一條橫切線（相鄰兩條在基本面上相距約 0.0003 地球半徑，約 2 公里），所以：
  - 每條橫切線的兩端連起來就是路徑的北界與南界（就是包絡線條件 (u, v) ⊥ (a, b)，L2 的變化率那一項不到 0.1 公里）；
    太陽在地平線上的那一側（只有一條界線的日食、路徑的起點與終點）則是地平線，一併包含。
  - 中心線是橫切線上 c = 0 的點；中心線上的持續時間 = 2|L2| / n（n 是相對速度）。
  - 線上每隔約 2 公里取一點，判斷落在哪一國的陸地（geoindex，1:10m 國界，不找海上最近的國家），算出經過哪些國家；
    每一點的持續時間 ≈ 2√(L2² − c²) / n，取每國的最大值；L2 < 0 的點是全食、> 0 是環食（混合食分段）。
- 北界、南界的線用 Douglas–Peucker 簡化（SIMPLIFY_KM），一次日食畫一條中心線與一個封閉的路徑環（北界、終點、南界、起點）；
  經度展開成連續的（跨 180° 經線不斷開），環繞極點的路徑在極點補上沿 ±90° 的邊。

**驗證**：跟 NASA 的路徑表（SEpath，每 2 分鐘的北界、南界、中心線）比，見 verify()。

**國家的指標**（1900–2100 年每年一筆）：
- 那一年的日食路徑（地圖的預設指標）：1 日環食、2 日全食、3 都有、0 沒有。
- 日全食、日環食的累計次數（1900 年到那一年）。
- 下一次日全食：從那一年（含）起第一次日全食還要幾年（0 是那一年就有）；2100 年以前都沒有的是 null。
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import date

import numpy as np

import geoindex
from common import OUT_DIR, indicator_file, lines_file, now_iso, write_json
from sources import nasa_eclipses as ne
from sources import sea_areas

OUT = OUT_DIR / "topics" / "eclipses"
FIRST, LAST = 1900, 2100
YEARS = list(range(FIRST, LAST + 1))

E2 = 0.00669438  # WGS 84 的 e²
K = 1 - E2
R_KM = 6378.137
DT_LON = 0.00417807  # 度 / 秒：1.002738 × 15″

STEP_H = 2 / 3600  # 橫切線的間隔（小時）
SPAN_H = 3.6  # t0 前後幾小時（根數適用 t0 ± 3 小時，路徑頭尾略超出）
CROSS = 0.0003  # 橫切線上取點的間隔（地球赤道半徑，約 1.9 km）
LIMB_ZETA = 0.3  # 太陽高度很低（ζ 小）時橫切線與取點加密，地面上的間隔才不會拉得很長
SIMPLIFY_KM = 0.6
NARROW_KM = 3.0  # 路徑比這窄的地方北界、南界每約 5 km 固定留一點（兩邊各自簡化會交叉）
QUANTUM = 0.005
CELL = 0.01  # 取點先併到 0.01° 的格子再判斷國家
MAX_LAT = 85.0511  # 麥卡托（與地球儀的圖磚）畫得到的最高緯度

# 日食的類型（paths.json 的 types、panel.json；src/topics/eclipses.ts 的 KIND 要一致）
TOTAL, ANNULAR, HYBRID = 1, 2, 3
KIND_CODE = {"T": TOTAL, "A": ANNULAR, "H": HYBRID}
# 國家那一年的路徑（paths-year.json）
YEAR_ANNULAR, YEAR_TOTAL, YEAR_BOTH = 1, 2, 3

# 大洋本身（IHO 的海域表沒有名稱的）
OCEANS = {
    "North Pacific Ocean": ("北太平洋", "North Pacific"),
    "South Pacific Ocean": ("南太平洋", "South Pacific"),
    "North Atlantic Ocean": ("北大西洋", "North Atlantic"),
    "South Atlantic Ocean": ("南大西洋", "South Atlantic"),
    "Indian Ocean": ("印度洋", "Indian Ocean"),
    "Arctic Ocean": ("北冰洋", "Arctic Ocean"),
    "Southern Ocean": ("南冰洋", "Southern Ocean"),
}


# ── 貝塞爾根數 → 基本面 ─────────────────────────────────────────


def _poly(c: list[float], t: np.ndarray) -> np.ndarray:
    return c[0] + c[1] * t + c[2] * t**2 + c[3] * t**3


def _dpoly(c: list[float], t: np.ndarray) -> np.ndarray:
    return c[1] + 2 * c[2] * t + 3 * c[3] * t**2


class Frame:
    """t（小時，TDT − t0）的基本面：影軸 (x, y) 與變化率、本影的 l2、三個單位向量與它們的變化率（地球固定座標）"""

    def __init__(self, el: ne.Elements, t: np.ndarray):
        self.t = t
        self.x, self.y = _poly(el.x, t), _poly(el.y, t)
        self.xp, self.yp = _dpoly(el.x, t), _dpoly(el.y, t)
        self.l2, self.l2p = _poly(el.l2, t), _dpoly(el.l2, t)
        self.tf2 = el.tan_f2
        d, mu = np.radians(_poly(el.d, t)), np.radians(_poly(el.mu, t))
        dp, mup = np.radians(_dpoly(el.d, t)), np.radians(_dpoly(el.mu, t))
        sd, cd, sm, cm = np.sin(d), np.cos(d), np.sin(mu), np.cos(mu)
        zero = np.zeros_like(t)
        self.X = np.stack([sm, cm, zero])
        self.Y = np.stack([-sd * cm, sd * sm, cd])
        self.Z = np.stack([cd * cm, -cd * sm, sd])
        self.Xp = mup * np.stack([cm, -sm, zero])
        self.Yp = dp * np.stack([-cd * cm, cd * sm, -sd]) + mup * np.stack([sd * sm, sd * cm, zero])
        self.Zp = dp * np.stack([-sd * cm, sd * sm, cd]) + mup * np.stack([-cd * sm, -cd * cm, zero])


_W = np.array([1.0, 1.0, 1.0 / K])


def on_earth(xi, eta, X, Y, Z):
    """基本面上的 (ξ, η) 沿影軸方向打到橢球朝月球那一面的點：(P, ζ, 有沒有打到)。X、Y、Z 的形狀是 (3, …)，可以廣播"""
    A = xi * X + eta * Y
    w = _W.reshape((3,) + (1,) * (A.ndim - 1))
    a2 = (w * Z * Z).sum(0)
    a1 = 2 * (w * A * Z).sum(0)
    a0 = (w * A * A).sum(0) - 1
    disc = a1 * a1 - 4 * a2 * a0
    ok = disc >= 0
    s = (-a1 + np.sqrt(np.where(ok, disc, 0))) / (2 * a2)
    return A + s * Z, s, ok


def geodetic(P: np.ndarray, delta_t: float) -> tuple[np.ndarray, np.ndarray]:
    """地球固定座標（曆書子午線）→ 大地緯度、經度（度，經度未正規化）"""
    lat = np.degrees(np.arctan2(P[2], K * np.hypot(P[0], P[1])))
    lon = np.degrees(np.arctan2(P[1], P[0])) + DT_LON * delta_t
    return lat, lon


def wrap(lon):
    return (np.asarray(lon) + 180) % 360 - 180


class Rows:
    """一次日食的橫切線（見檔頭）：每條線的時間、參考點、方向，與落在本影裡的範圍 [lo, hi]"""

    def __init__(self, el: ne.Elements):
        self.el = el
        coarse = np.arange(-SPAN_H, SPAN_H + STEP_H / 2, STEP_H)
        cf = Frame(el, coarse)
        zeta = self._reference(cf)[1]
        # 影子碰得到地球的時候（影軸離地心不到 1 + 本影半徑）：太陽很低的地方（ζ 小）地面上拉長，時間也加密
        near = np.hypot(cf.x, cf.y) < 1.0 + np.abs(cf.l2) + cf.tf2 + 0.01
        coarse = coarse[max(int(np.argmax(near)) - 1, 0) : len(near) - int(np.argmax(near[::-1])) + 1]
        zeta = zeta[max(int(np.argmax(near)) - 1, 0) : len(near) - int(np.argmax(near[::-1])) + 1]
        parts = []
        for i in range(len(coarse) - 1):
            m = int(np.clip(math.ceil(LIMB_ZETA / max(min(zeta[i], zeta[i + 1]), 0.02)), 1, 15))
            parts.append(coarse[i] + (coarse[i + 1] - coarse[i]) * np.arange(m) / m)
        parts.append(coarse[-1:])
        t = np.concatenate(parts)
        f = self.f = Frame(el, t)
        self.t = t
        P0, z0, ok0, a, b = self._reference(f)
        n = np.hypot(a, b)
        self.n = n
        self.ex, self.ey = -b / n, a / n  # 橫切線的方向：運動方向的左邊（向東走時是北）
        self.R = np.maximum(np.abs(f.l2), np.abs(f.l2 - f.tf2)) + 1e-6
        self.lo, self.hi, self.has = self._extent()
        self.zeta_ref = np.where(ok0, z0, 0.0)

    def _reference(self, f: Frame):
        """參考點：影軸打到地球的點；影軸不在地球上時取地球邊緣離影軸最近的點。回傳 (P, ζ, 影軸在地球上, a, b)"""
        P, z, ok = on_earth(f.x, f.y, f.X, f.Y, f.Z)
        r = np.hypot(f.x, f.y)
        scale = np.where(ok, 1.0, 0.995 / np.maximum(r, 1e-9))
        P2, z2, _ok2 = on_earth(f.x * scale, f.y * scale, f.X, f.Y, f.Z)
        P = np.where(ok, P, P2)
        z = np.where(ok, z, np.maximum(z2, 0))
        xip, etap = (P * f.Xp).sum(0), (P * f.Yp).sum(0)
        return P, z, ok, f.xp - xip, f.yp - etap

    def point(self, c: np.ndarray, rows: np.ndarray | slice = slice(None)):
        """第 rows 條橫切線上離影軸 c 的點：(P, ζ, 在地球上, 在本影裡 |c| ≤ |L2|, L2)。
        c 是一維（每條線一個）或二維（每條線好幾個，形狀 (線, 點)）"""
        f = self.f
        c = np.asarray(c, dtype=float)
        X, Y, Z = f.X[:, rows], f.Y[:, rows], f.Z[:, rows]
        x, y, ex, ey, l2 = f.x[rows], f.y[rows], self.ex[rows], self.ey[rows], f.l2[rows]
        if c.ndim == 2:
            X, Y, Z = X[..., None], Y[..., None], Z[..., None]
            x, y, ex, ey, l2 = x[:, None], y[:, None], ex[:, None], ey[:, None], l2[:, None]
        P, z, ok = on_earth(x + c * ex, y + c * ey, X, Y, Z)
        L = l2 - z * f.tf2
        return P, z, ok, ok & (np.abs(c) <= np.abs(L)), L

    def _extent(self):
        """每條橫切線在本影裡的範圍：先粗取 61 點找到有的，再往兩邊二分到邊界（40 次）"""
        N = len(self.t)
        rows = np.arange(N)
        grid = np.linspace(-1, 1, 61)[None, :] * self.R[:, None]
        inside = self.point(grid, rows)[3]
        has = inside.any(1)
        first = np.argmax(inside, 1)
        last = 60 - np.argmax(inside[:, ::-1], 1)
        lo_in = grid[rows, first]
        hi_in = grid[rows, last]
        lo_out = np.where(first > 0, grid[rows, np.maximum(first - 1, 0)], -self.R * 1.001)
        hi_out = np.where(last < 60, grid[rows, np.minimum(last + 1, 60)], self.R * 1.001)

        def bisect(a_in, a_out):
            for _ in range(40):
                mid = (a_in + a_out) / 2
                ok = self.point(mid, rows)[3]
                a_in = np.where(ok, mid, a_in)
                a_out = np.where(ok, a_out, mid)
            return a_in

        lo = bisect(lo_in, lo_out)
        hi = bisect(hi_in, hi_out)
        return lo, hi, has


# ── 線：中心線、路徑環 ─────────────────────────────────────────


def _xyz(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)


def simplify(lat: np.ndarray, lon: np.ndarray, tol_km: float = SIMPLIFY_KM, always: np.ndarray | None = None) -> np.ndarray:
    """Douglas–Peucker（球面上的弦距離），回傳留下的索引；always 為 True 的點一定留下"""
    n = len(lat)
    if n <= 2:
        return np.arange(n)
    p = _xyz(lat, lon)
    tol = tol_km / 6371.0
    keep = np.zeros(n, dtype=bool) if always is None else always.copy()
    keep[0] = keep[-1] = True
    # 一定留下的點把線切成好幾段，各段分別簡化
    fixed = np.nonzero(keep)[0]
    stack = list(zip(fixed[:-1].tolist(), fixed[1:].tolist()))
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = p[i], p[j]
        seg = b - a
        L2 = seg @ seg
        q = p[i + 1 : j]
        if L2 < 1e-18:
            d = np.linalg.norm(q - a, axis=1)
        else:
            u = np.clip((q - a) @ seg / L2, 0, 1)
            d = np.linalg.norm(q - (a + u[:, None] * seg), axis=1)
        k = int(np.argmax(d))
        if d[k] > tol:
            m = i + 1 + k
            keep[m] = True
            stack += [(i, m), (m, j)]
    return np.nonzero(keep)[0]


def unwrap(lon: np.ndarray) -> np.ndarray:
    out = np.array(lon, dtype=float)
    out[1:] = out[0] + np.cumsum((np.diff(out) + 180) % 360 - 180)
    return out


def runs(mask: np.ndarray) -> list[tuple[int, int]]:
    """連續為 True 的區段 [起, 迄]（含）"""
    out = []
    i = 0
    n = len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j + 1 < n and mask[j + 1]:
                j += 1
            out.append((i, j))
            i = j + 1
        else:
            i += 1
    return out


def _cross2(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return u[..., 0] * v[..., 1] - u[..., 1] * v[..., 0]


def untangle(ring: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """量化後的環在路徑的起點、終點常有一個小小的「8 字形」（地平線那一側的端點往回折，北界、南界在端點附近交叉），
    MapLibre 三角化時會畫出小碎片。找到交叉的兩段 (i, j) 就把中間的點倒過來（2-opt），交叉就解開；最多重複 20 次"""
    pts = np.asarray(ring, dtype=float)
    for _ in range(20):
        a, b = pts[:-1], pts[1:]
        n = len(a)
        found = None
        for i in range(n):
            j = np.arange(i + 2, n)
            if i == 0:
                j = j[j != n - 1]
            if not len(j):
                continue
            p1, p2, p3, p4 = a[i], b[i], a[j], b[j]
            hit = (_cross2(p4 - p3, p1 - p3) * _cross2(p4 - p3, p2 - p3) < 0) & (
                _cross2(p2 - p1, p3 - p1) * _cross2(p2 - p1, p4 - p1) < 0
            )
            if hit.any():
                found = (i, int(j[np.argmax(hit)]))
                break
        if found is None:
            break
        i, j = found
        pts[i + 1 : j + 1] = pts[i + 1 : j + 1][::-1].copy()
    return [tuple(p) for p in pts.tolist()]


def ring_with_pole(lat: np.ndarray, lon: np.ndarray) -> list[tuple[float, float]]:
    """封閉的環（經度已展開）：繞極點一圈的（經度回不到起點）在極點補上沿 ±90° 的邊，MapLibre 才畫得出來"""
    total = (lon[0] - lon[-1] + 180) % 360 - 180 + lon[-1] - lon[0]  # 回到起點時展開後的經度差
    pts = list(zip(lon.tolist(), lat.tolist()))
    if abs(total) < 180:
        return pts + [pts[0]]
    pole = 90.0 if lat.mean() > 0 else -90.0
    k = int(np.argmax(lat if pole > 0 else -lat))
    shift = lon[-1] + ((lon[0] - lon[-1] + 180) % 360 - 180) - lon[0]  # 繞一圈後的位移（±360）
    seq = pts[k:] + [(x + shift, y) for x, y in pts[: k + 1]]
    end_lon = seq[-1][0]
    return seq + [(end_lon, pole), (pts[k][0], pole), pts[k]]


# ── 一次日食 ────────────────────────────────────────────────


class Eclipse:
    def __init__(self, row: ne.CatalogRow, el: ne.Elements):
        self.row = row
        self.el = el
        self.kind = KIND_CODE[row.kind]
        self.rows = Rows(el)

    # 中心線：橫切線上 c = 0（影軸打到地球）
    def central(self):
        r = self.rows
        P, z, ok, inside, L = r.point(np.zeros_like(r.t))
        ok &= r.has
        lat, lon = geodetic(P, self.el.delta_t)
        dur = 2 * np.abs(L) / r.n * 3600
        return ok, lat, lon, dur, L, z

    def edges(self):
        """每條橫切線兩端的點：(有, 北界緯度, 經度, 南界緯度, 經度)"""
        r = self.rows
        Pn = r.point(r.hi)[0]
        Ps = r.point(r.lo)[0]
        nlat, nlon = geodetic(Pn, self.el.delta_t)
        slat, slon = geodetic(Ps, self.el.delta_t)
        return r.has, nlat, nlon, slat, slon

    def lines(self) -> tuple[list[list[tuple[float, float]]], list[int]]:
        """(線, 角色)：角色 1 是中心線、0 是路徑環"""
        out, roles = [], []
        ok, lat, lon, *_ = self.central()
        # 中心線只留地圖畫得到的緯度（±85.05° 以內）：超出的部分 MapLibre 會壓到 85° 的緯線上，在極區畫出一圈
        ok &= np.abs(lat) <= MAX_LAT
        for i, j in runs(ok):
            la, lo = lat[i : j + 1], unwrap(lon[i : j + 1])
            keep = simplify(la, lo)
            out.append(list(zip(lo[keep].tolist(), la[keep].tolist())))
            roles.append(1)
        has, nlat, nlon, slat, slon = self.edges()
        for i, j in runs(has):
            if j - i < 1:
                continue
            nla, nlo = nlat[i : j + 1], nlon[i : j + 1]
            sla, slo = slat[i : j + 1], slon[i : j + 1]
            # 很窄的地方（混合食全食、環食交界的前後，或 1930-04-28 這種只有 1 km 寬的）兩邊各自簡化會交叉，
            # 路徑寬度不到 NARROW_KM 的地方固定留點，各段再簡化
            pn = _xyz(nla, nlo)
            width = np.linalg.norm(pn - _xyz(sla, slo), axis=1) * 6371.0
            # 窄的地方每約 5 km 固定留一點（兩點之間的線偏離不到 0.01 km），不必每一條橫切線都留
            along = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pn, axis=0), axis=1) * 6371.0)])
            step = np.floor(along / 5.0)
            first_in_step = np.concatenate([[True], step[1:] != step[:-1]])
            narrow = (width < NARROW_KM) & first_in_step
            kn = simplify(nla, unwrap(nlo), always=narrow)
            ks = simplify(sla, unwrap(slo), always=narrow)
            ring_lat = np.concatenate([nla[kn], sla[ks][::-1]])
            ring_lon = unwrap(np.concatenate([nlo[kn], slo[ks][::-1]]))
            out.append(ring_with_pole(ring_lat, ring_lon))
            roles.append(0)
        # 第一個點的經度放回 ±180° 內（整條平移 360°）；環先量化（lines_file() 會再量化一次，結果一樣）、去掉重複的點、解開交叉
        fixed = []
        for line, role in zip(out, roles):
            s = 360 * math.floor((line[0][0] + 180) / 360)
            line = [(x - s, y) for x, y in line]
            if role == 0:
                q = [(round(x / QUANTUM) * QUANTUM, round(y / QUANTUM) * QUANTUM) for x, y in line]
                q = [p for k, p in enumerate(q) if k == 0 or p != q[k - 1]]
                line = untangle(q)
            fixed.append(line)
        return fixed, roles

    def samples(self):
        """橫切線上每約 2 公里一點：(緯度, 經度, 全食?, 持續時間秒)"""
        r = self.rows
        idx = np.nonzero(r.has)[0]
        out_lat, out_lon, out_total, out_dur = [], [], [], []
        if not len(idx):
            return np.array([]), np.array([]), np.array([], bool), np.array([])
        spacing = CROSS * np.clip(r.zeta_ref[idx] / LIMB_ZETA, 0.25, 1.0)
        for chunk in np.array_split(idx, max(1, len(idx) // 2000)):
            sp = spacing[np.searchsorted(idx, chunk)]
            width = r.hi[chunk] - r.lo[chunk]
            m = int(np.ceil((width / sp).max())) + 1
            k = np.arange(m)[None, :]
            # [lo, hi] 是二分法找到的本影範圍（兩端都在裡面），中間每 sp 一點，最後一點是 hi
            c = r.lo[chunk, None] + np.minimum(k * sp[:, None], width[:, None])
            P, z, ok, _inside, L = r.point(c, chunk)
            last = np.concatenate([np.ones((len(chunk), 1), bool), k[:, 1:] * sp[:, None] < width[:, None] + sp[:, None]], 1)
            lat, lon = geodetic(P, self.el.delta_t)
            n = r.n[chunk, None]
            dur = 2 * np.sqrt(np.maximum(L * L - c * c, 0)) / n * 3600
            sel = ok & last & np.isfinite(lat)
            out_lat.append(lat[sel])
            out_lon.append(wrap(lon[sel]))
            out_total.append((L < 0)[sel])
            out_dur.append(dur[sel])
        return np.concatenate(out_lat), np.concatenate(out_lon), np.concatenate(out_total), np.concatenate(out_dur)


# ── 地點的名稱（最長持續時間的地方在海上時寫哪一片海） ─────────────────


def sea_name(lat: float, lon: float) -> tuple[str, str] | None:
    from topics.rivers import SEAS

    iho, iho_names, _goas, _goas_names = sea_areas.rasters()
    row = int(np.clip((90 - lat) / sea_areas.RES, 0, sea_areas.H - 1))
    col = int(np.clip((lon + 180) / sea_areas.RES, 0, sea_areas.W - 1))
    v = int(iho[row, col])
    if v <= 0:
        return None
    name = str(iho_names[v - 1])
    return SEAS.get(name) or OCEANS.get(name)


# ── 主程式 ─────────────────────────────────────────────────


def ymd_text(ymd: int) -> str:
    return f"{ymd // 10000}-{ymd // 100 % 100:02d}-{ymd % 100:02d}"


def build() -> None:
    catalog = [r for r in ne.catalog() if FIRST <= r.year <= LAST and r.kind in "ATH"]
    print(f"  {len(catalog)} 次日全食、日環食、混合食（{FIRST}–{LAST}）")
    codes = sorted({c for c in geoindex._index().codes if c})

    lines: list[list[tuple[float, float]]] = []
    types: list[int] = []
    records: list[dict] = []
    groups: list[dict] = []
    table: list[list] = []  # panel.json 的日食表
    # 每國：[(日食編號, 全食?, 環食?, 全食最長秒, 環食最長秒)]
    by_country: dict[str, list[tuple[int, bool, bool, float, float]]] = defaultdict(list)
    checks = []

    sources = {"beselm": 0, "canon": 0}
    for e, row in enumerate(catalog):
        el, src = elements_for(row)
        sources[src] += 1
        ecl = Eclipse(row, el)
        ls, roles = ecl.lines()
        for line, role in zip(ls, roles):
            lines.append(line)
            types.append(ecl.kind)
            records.append({"e": e, "y": row.year, "r": role})

        # 食甚（影軸離地心最近的那一刻）：中心線上的持續時間、位置與路徑寬度，跟 NASA 目錄的定義一樣。
        # 全食的食甚與「最長持續時間」只差 1 秒以內；環食的最長持續時間常在日出、日落的兩端，所以不取最長
        ok, lat, lon, dur, L, z = ecl.central()
        info: dict[str, object] = {"e": e, "d": row.ymd, "k": ecl.kind, "s": row.saros}
        box = None
        j = int(np.argmin(np.hypot(ecl.rows.f.x, ecl.rows.f.y)))
        if ok[j]:
            glat, glon = float(lat[j]), float(wrap(lon[j]))
            info.update({"D": round(float(dur[j]), 1), "la": round(glat, 2), "lo": round(glon, 2)})
            iso3 = geoindex.country_at(glon, glat)
            if iso3:
                info["c"] = iso3
            else:
                sea = sea_name(glat, glon)
                if sea:
                    info["sz"], info["se"] = sea
            # 路徑寬度寫 NASA 目錄的（食甚時）。自己算的（橫切線兩端在地面上的距離，取垂直於地面路徑的分量）只拿來比對：
            # 中位數差 0 km，太陽很低的寬路徑最多差 9%（影子很斜時「垂直於路徑」的取法不同）。
            # 只有一條界線的中心食（2003-05-31、2044-02-28）另一邊是地平線，寬度沒有意義，NASA 目錄也不寫
            if row.width_km is not None:
                info["w"] = round(row.width_km)
            checks.append((row, float(dur[j]), round(width_km(ecl, j)) if row.width_km is not None else None))
        if row.type[1:2] in ("+", "-"):
            info["nc"] = 1  # 非中心食
        # 範圍：整個路徑（側欄點一下移過去）
        has, nlat, nlon, slat, slon = ecl.edges()
        if has.any():
            lats = np.concatenate([nlat[has], slat[has]])
            lons = unwrap(np.concatenate([nlon[has], slon[has][::-1]]))
            box = [float(lons.min()), float(lats.min()), float(lons.max()), float(lats.max())]
            if box[2] - box[0] > 300:  # 繞極點一圈：整圈經度
                box = [-180.0, box[1], 180.0, box[3]]
            shift = 360 * math.floor((box[0] + 180) / 360)
            box = [round(box[0] - shift, 1), round(box[1], 1), round(box[2] - shift, 1), round(box[3], 1)]
        else:
            print(f"  ！{ymd_text(row.ymd)} {row.type} 沒有算出路徑")
        groups.append(info)
        table.append([row.ymd, ecl.kind, row.saros, info.get("D"), info.get("w"), box])

        # 經過的國家
        s_lat, s_lon, s_total, s_dur = ecl.samples()
        if len(s_lat):
            # 先併到 0.01° 的格子，每格判斷一次國家（取格子裡第一個點），再對回每一點
            cell = np.round(s_lat / CELL).astype(np.int64) * 100000 + np.round(s_lon / CELL).astype(np.int64)
            _u, first, inverse = np.unique(cell, return_index=True, return_inverse=True)
            found = geoindex.countries_at(s_lon[first], s_lat[first], nearest=False)
            names = sorted(set(found) - {None})
            code = {c: i for i, c in enumerate(names)}
            cell_code = np.array([code.get(c, -1) for c in found])
            sample_code = cell_code[inverse]
            for i, iso3 in enumerate(names):
                m = sample_code == i
                tot = m & s_total
                ann = m & ~s_total
                # 全食、環食分開記（混合食在交界兩邊都有）；持續時間取這一國最長的地方
                by_country[iso3].append((
                    e, bool(tot.any()), bool(ann.any()),
                    float(s_dur[tot].max()) if tot.any() else 0.0,
                    float(s_dur[ann].max()) if ann.any() else 0.0,
                ))
        if e % 25 == 0:
            print(f"  {e + 1}/{len(catalog)} {ymd_text(row.ymd)} {row.type}：{len(ls)} 條線、{len(s_lat):,} 個取點")

    print(f"  根數：路徑表那一組 {sources['beselm']} 次、五千年日食典 {sources['canon']} 次")
    report_checks(checks)
    write_outputs(catalog, codes, lines, types, records, groups, table, by_country)
    verify()


def elements_for(row: ne.CatalogRow) -> tuple[ne.Elements, str]:
    """NASA 路徑表用的那一組根數（SEbeselm，較新的星曆與 ΔT）有的話用它，沒有的用五千年日食典的根數（SEdata）"""
    el = ne.beselm_elements(row.ymd, row.kind)
    if el is not None:
        return el, "beselm"
    return ne.elements(row.ymd), "canon"


def width_km(ecl: Eclipse, j: int) -> float:
    """第 j 條橫切線的路徑寬度（垂直於地面路徑）"""
    r = ecl.rows
    Pn = r.point(r.hi[j : j + 1], slice(j, j + 1))[0][:, 0]
    Ps = r.point(r.lo[j : j + 1], slice(j, j + 1))[0][:, 0]
    a, b = max(j - 1, 0), min(j + 1, len(r.t) - 1)
    Pa = r.point(np.zeros(1), slice(a, a + 1))[0][:, 0]
    Pb = r.point(np.zeros(1), slice(b, b + 1))[0][:, 0]
    chord = (Pn - Ps) * R_KM
    track = Pb - Pa
    nrm = np.linalg.norm(track)
    if nrm == 0:
        return float(np.linalg.norm(chord))
    track /= nrm
    return float(np.linalg.norm(chord - (chord @ track) * track))


def report_checks(checks) -> None:
    """自己算的食甚持續時間、路徑寬度跟 NASA 目錄比（目錄的持續時間寫到秒、寬度寫到 km）"""
    diffs_d, diffs_w = [], []
    for row, dur, w in checks:
        if row.duration_s:
            diffs_d.append((abs(dur - row.duration_s), row))
        if w is not None and row.width_km:
            diffs_w.append((abs(w - row.width_km) / row.width_km, abs(w - row.width_km), row))
    if diffs_d:
        d = np.array([x for x, _r in diffs_d])
        worst = max(diffs_w, key=lambda x: x[0])
        w = np.array([x[1] for x in diffs_w])
        print(f"  {len(d)} 次中心食：食甚的持續時間跟目錄差 中位數 {np.median(d):.1f} 秒、最大 {d.max():.1f} 秒；"
              f"寬度差 中位數 {np.median(w):.1f} km、最大 {worst[1]:.0f} km（{worst[0] * 100:.0f}%，{ymd_text(worst[2].ymd)}，"
              f"太陽高度 {worst[2].sun_alt}°）")


def write_outputs(catalog, codes, lines, types, records, groups, table, by_country) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    data = lines_file(
        lines, QUANTUM, types,
        records=records, record_fields=["e", "y", "r"], record_scale={"e": 1, "y": 1, "r": 1},
        groups=("e", ne_points(groups)),
    )
    write_json(OUT / "paths.json", data)

    # 每國每年
    year_code = {c: [0] * len(YEARS) for c in codes}
    total_years: dict[str, list[int]] = defaultdict(list)
    annular_years: dict[str, list[int]] = defaultdict(list)
    for iso3, items in by_country.items():
        if iso3 not in year_code:
            year_code[iso3] = [0] * len(YEARS)
        for e, t_, a_, _dt, _da in items:
            y = catalog[e].year
            i = y - FIRST
            code = year_code[iso3][i]
            if t_:
                code = YEAR_BOTH if code in (YEAR_ANNULAR, YEAR_BOTH) else YEAR_TOTAL
                total_years[iso3].append(y)
            if a_:
                code = YEAR_BOTH if code in (YEAR_TOTAL, YEAR_BOTH) else YEAR_ANNULAR
                annular_years[iso3].append(y)
            year_code[iso3][i] = code
    all_codes = sorted(year_code)

    def cumulative(ys: list[int]) -> list[float]:
        out, n, k = [], 0, sorted(ys)
        for y in YEARS:
            while n < len(k) and k[n] <= y:
                n += 1
            out.append(n)
        return out

    def wait(ys: list[int]) -> list[float | None]:
        ks = sorted(set(ys))
        out: list[float | None] = []
        for y in YEARS:
            nxt = next((k for k in ks if k >= y), None)
            out.append(None if nxt is None else nxt - y)
        return out

    write_json(OUT / "paths-year.json", indicator_file("paths-year", "", YEARS, {c: year_code[c] for c in all_codes}))
    write_json(OUT / "total-count.json", indicator_file("total-count", "次", YEARS, {c: cumulative(total_years[c]) for c in all_codes}))
    write_json(OUT / "annular-count.json", indicator_file("annular-count", "次", YEARS, {c: cumulative(annular_years[c]) for c in all_codes}))
    write_json(OUT / "next-total.json", indicator_file("next-total", "年", YEARS, {c: wait(total_years[c]) for c in all_codes}))

    # 側欄：每國經過的日食（依日期），日食表
    countries = {}
    for iso3, items in sorted(by_country.items()):
        rows = []
        for e, t_, a_, dt_, da_ in sorted(items):
            local = YEAR_BOTH if t_ and a_ else YEAR_TOTAL if t_ else YEAR_ANNULAR
            dur = dt_ if t_ else da_
            rows.append([e, local, round(dur)])
        countries[iso3] = rows
    write_json(OUT / "panel.json", {"eclipses": table, "countries": countries})

    write_json(OUT / "manifest.json", {
        "topic": "eclipses",
        "source": "NASA Five Millennium Catalog of Solar Eclipses (Espenak & Meeus, NASA TP-2006-214141), eclipse.gsfc.nasa.gov",
        "credit": ne.CREDIT,
        "license": "Public domain (NASA); credit requested: " + ne.CREDIT,
        "generatedAt": now_iso(),
        "eclipses": len(catalog),
        "files": ["paths.json", "paths-year.json", "total-count.json", "annular-count.json", "next-total.json", "panel.json"],
    })
    taiwan_summary(catalog, by_country)


VERIFY = [(20240408, "T"), (20270802, "T"), (20200621, "A"), (20230420, "H"), (20131103, "H")]


def _km_to_polyline(lat: np.ndarray, lon: np.ndarray, point: tuple[float, float]) -> float:
    """點到折線的球面距離（km，用弦距離近似，幾百公尺內一樣）"""
    q = _xyz(np.array([point[0]]), np.array([point[1]]))[0]
    p = _xyz(lat, lon)
    a, b = p[:-1], p[1:]
    seg = b - a
    L2 = (seg * seg).sum(1)
    u = np.clip(((q - a) * seg).sum(1) / np.maximum(L2, 1e-20), 0, 1)
    return float(np.linalg.norm(q - (a + u[:, None] * seg), axis=1).min() * 6371.0)


def verify() -> None:
    """跟 NASA 的路徑表（SEpath，每 2 分鐘一列，座標到 0.1′ ≈ 0.2 km）比：北界、南界、中心線到我們畫的線的距離，
    與同一時刻中心線位置的距離。兩組根數各算一次：路徑表用的那一組（同一組根數，只差計算方法）、五千年日食典的（星曆與 ΔT 不同）"""
    catalog = {r.ymd: r for r in ne.catalog()}
    for ymd, kind in VERIFY:
        row = catalog[ymd]
        table = ne.path_table(ymd, kind)
        for label, el in (("路徑表的根數", ne.beselm_elements(ymd, kind)), ("五千年日食典", ne.elements(ymd))):
            if el is None:
                continue
            ecl = Eclipse(row, el)
            ok, lat, lon, *_ = ecl.central()
            has, nlat, nlon, slat, slon = ecl.edges()
            errs: dict[str, list[float]] = {"北界": [], "南界": [], "中心線": [], "同時刻": []}
            # NASA 混合食的路徑表在全食的那一段把北界、南界標反了（環食的那一段沒有；看起來是照環食的正負號算哪一邊叫北界：
            # 2023-04-20 表上全食段的「北界」在「南界」的東南邊），全食段對調再比
            swapped = False
            for tm, N, S, C in table:
                if tm == "Limits":
                    continue
                hh, mm = map(int, tm.split(":"))
                t = np.array([hh + mm / 60 + el.delta_t / 3600 - el.t0])
                f = Frame(el, t)
                _P, z0, hit0 = on_earth(f.x, f.y, f.X, f.Y, f.Z)
                if kind == "H" and hit0[0] and f.l2[0] - z0[0] * f.tf2 < 0:
                    N, S = S, N
                    swapped = True
                if N:
                    errs["北界"].append(_km_to_polyline(nlat[has], nlon[has], N))
                if S:
                    errs["南界"].append(_km_to_polyline(slat[has], slon[has], S))
                if C:
                    errs["中心線"].append(_km_to_polyline(lat[ok], lon[ok], C))
                    # 同一時刻：路徑表的時刻是 UT，換成 TDT 用路徑表那一組的 ΔT（兩組根數的 ΔT 不同，用各自的）
                    hh, mm = map(int, tm.split(":"))
                    t = np.array([hh + mm / 60 + el.delta_t / 3600 - el.t0])
                    f = Frame(el, t)
                    P, _z, hit = on_earth(f.x, f.y, f.X, f.Y, f.Z)
                    if hit[0]:
                        la, lo = geodetic(P, el.delta_t)
                        a, b = _xyz(la, lo)[0], _xyz(np.array([C[0]]), np.array([C[1]]))[0]
                        errs["同時刻"].append(float(np.linalg.norm(a - b) * 6371.0))
            text = "、".join(
                f"{k} 中位數 {np.median(v):.2f} km、最大 {max(v):.2f} km（{len(v)} 點）" for k, v in errs.items() if v
            )
            print(f"  驗證 {ymd_text(ymd)} {kind}（{label}，ΔT {el.delta_t} 秒{'，NASA 表上全食段的北界、南界對調' if swapped else ''}）：{text}")


def ne_points(groups: list[dict]) -> dict:
    from common import points_file

    return points_file(
        groups, ["e", "d", "k", "s", "D", "la", "lo", "w", "c", "sz", "se", "nc"],
        {"e": 1, "d": 1, "k": 1, "s": 1, "D": 0.1, "la": 0.01, "lo": 0.01, "w": 1, "nc": 1},
        strings=["c"],
    )


def taiwan_summary(catalog, by_country) -> None:
    today = int(date.today().strftime("%Y%m%d"))
    for iso3 in ["TWN", "JPN", "CHN", "USA", "ESP", "EGY", "CHL", "ARG", "AUS"]:
        items = sorted(by_country.get(iso3, []))
        tot = [catalog[e].ymd for e, t_, *_ in items if t_]
        ann = [catalog[e].ymd for e, _t, a_, *_ in items if a_]
        past = [d for d in tot if d < today]
        fut = [d for d in tot if d >= today]
        print(f"  {iso3}：日全食 {len(tot)} 次、日環食 {len(ann)} 次；上一次日全食 {past[-1] if past else '—'}、"
              f"下一次 {fut[0] if fut else '—'}")
    tw = sorted(by_country.get("TWN", []))
    print("  台灣：" + "、".join(f"{catalog[e].ymd}{'全' if t_ else ''}{'環' if a_ else ''}({max(dt_, da_):.0f}s)" for e, t_, a_, dt_, da_ in tw))
