"""World Magnetic Model 2025（NOAA NCEI 與英國 BGS，公有領域）：地球主磁場的 12 階球諧模型，2025.0–2030.0 適用。

- 係數檔：https://www.ncei.noaa.gov/sites/default/files/2024-12/WMM2025COF.zip（官網的「WMM2025 Coefficient File」
  連結會先轉到問卷頁，這是同一個檔的直連，不必填問卷）。壓縮檔裡有 `WMM2025.COF` 與官方的測試值 `WMM2025_TestValues.txt`。
- 授權：「The WMM source code is in the public domain and not licensed or under copyright. The information and software
  may be used freely by the public」。引用：NOAA NCEI Geomagnetic Modeling Team; British Geological Survey. 2024:
  World Magnetic Model 2025. NOAA National Centers for Environmental Information. https://doi.org/10.25921/aqfd-sd83
- 算法照 WMM2025 技術報告（The US/UK World Magnetic Model for 2025-2030: Technical Report）第 1.2 節：
  大地座標（WGS84）換成地心座標，Schmidt 半正規化的連帶 Legendre 函數（用不會在極點除以零的遞迴求導數），
  算出地心座標的 X'、Y'、Z' 再轉回大地座標的 X（北）、Y（東）、Z（向下）；磁偏角 D = atan2(Y, X)（東為正）。
- 前端 src/lib/wmm.ts 是同一套算法（滑到地圖上任一點時算那裡的磁偏角），兩邊都用壓縮檔的測試值驗證。
- WMM2025 只適用 2025–2030 年，不能回推歷史的磁偏角（歷史要用 IGRF，授權待確認，第一版不做）。
"""
from __future__ import annotations

import zipfile
from dataclasses import dataclass

import numpy as np

from common import download

URL = "https://www.ncei.noaa.gov/sites/default/files/2024-12/WMM2025COF.zip"
CITATION = ("NOAA NCEI Geomagnetic Modeling Team; British Geological Survey. 2024: World Magnetic Model 2025. "
            "NOAA National Centers for Environmental Information. https://doi.org/10.25921/aqfd-sd83")

A_REF = 6371.2  # 地磁的參考半徑（km）
WGS84_A = 6378.137
WGS84_F = 1 / 298.257223563
E2 = WGS84_F * (2 - WGS84_F)


@dataclass
class Model:
    epoch: float
    degree: int
    g: np.ndarray  # [n, m]，nT
    h: np.ndarray
    gdot: np.ndarray  # nT/年
    hdot: np.ndarray


def _zip() -> zipfile.ZipFile:
    return zipfile.ZipFile(download(URL, "wmm", "WMM2025COF.zip"))


def load() -> Model:
    with _zip() as z:
        text = z.read("WMM2025COF/WMM2025.COF").decode("ascii")
    lines = text.splitlines()
    epoch = float(lines[0].split()[0])
    rows = [l.split() for l in lines[1:] if l.strip() and not l.startswith("9999")]
    degree = max(int(r[0]) for r in rows)
    g, h, gd, hd = (np.zeros((degree + 1, degree + 1)) for _ in range(4))
    for r in rows:
        n, m = int(r[0]), int(r[1])
        g[n, m], h[n, m], gd[n, m], hd[n, m] = map(float, r[2:6])
    if epoch != 2025.0 or degree != 12:
        raise RuntimeError(f"WMM 係數檔不是 WMM2025（epoch {epoch}、{degree} 階）")
    return Model(epoch, degree, g, h, gd, hd)


def _legendre(theta: np.ndarray, degree: int) -> tuple[np.ndarray, np.ndarray]:
    """Schmidt 半正規化的 P[n, m](cos θ) 與 dP/dθ；θ 是地心餘緯（弧度），形狀 (k,) → 回傳 (n, m, k)"""
    c, s = np.cos(theta), np.sin(theta)
    P = np.zeros((degree + 1, degree + 1, theta.size))
    dP = np.zeros_like(P)
    P[0, 0] = 1.0
    for n in range(1, degree + 1):
        # 對角線
        if n == 1:
            P[1, 1] = s
            dP[1, 1] = c
        else:
            k = np.sqrt((2 * n - 1) / (2 * n))
            P[n, n] = k * s * P[n - 1, n - 1]
            dP[n, n] = k * (s * dP[n - 1, n - 1] + c * P[n - 1, n - 1])
        for m in range(n):
            a = (2 * n - 1) / np.sqrt(n * n - m * m)
            b = np.sqrt(((n - 1) ** 2 - m * m) / (n * n - m * m)) if n > 1 else 0.0
            P[n, m] = a * c * P[n - 1, m] - (b * P[n - 2, m] if n > 1 else 0.0)
            dP[n, m] = a * (c * dP[n - 1, m] - s * P[n - 1, m]) - (b * dP[n - 2, m] if n > 1 else 0.0)
    return P, dP


def field(model: Model, lat: np.ndarray, lon: np.ndarray, height_km: float = 0.0, year: float | None = None) -> dict[str, np.ndarray]:
    """網格上的磁場：lat (k,)、lon (j,) 是大地緯度、經度（度），回傳形狀 (k, j) 的 X、Y、Z、H（nT）與 D、I（度）。
    緯度不能是 ±90（Y 要除以 cos 地心緯度）。"""
    t = model.epoch if year is None else year
    g = model.g + (t - model.epoch) * model.gdot
    h = model.h + (t - model.epoch) * model.hdot
    phi = np.radians(lat)
    rc = WGS84_A / np.sqrt(1 - E2 * np.sin(phi) ** 2)
    p = (rc + height_km) * np.cos(phi)
    z = (rc * (1 - E2) + height_km) * np.sin(phi)
    r = np.hypot(p, z)
    phic = np.arcsin(z / r)  # 地心緯度
    P, dP = _legendre(np.pi / 2 - phic, model.degree)
    lam = np.radians(lon)
    ns = np.arange(model.degree + 1)
    ratio = (A_REF / r)[None, :] ** (ns[:, None] + 2)  # (n, k)
    Xp = np.zeros((lat.size, lon.size))
    Yp = np.zeros_like(Xp)
    Zp = np.zeros_like(Xp)
    for m in range(model.degree + 1):
        cm, sm = np.cos(m * lam), np.sin(m * lam)  # (j,)
        for n in range(max(m, 1), model.degree + 1):
            gn, hn = g[n, m], h[n, m]
            if gn == 0 and hn == 0:
                continue
            rr = ratio[n][:, None]
            gc = gn * cm + hn * sm  # (j,)
            gs = gn * sm - hn * cm
            # X' = −Σ (a/r)^(n+2) (g cos mλ + h sin mλ) dP/dφ'，dP/dφ' = −dP/dθ
            Xp += rr * dP[n, m][:, None] * gc[None, :]
            Yp += rr * (m * P[n, m])[:, None] * gs[None, :]
            Zp -= (n + 1) * rr * P[n, m][:, None] * gc[None, :]
    Yp /= np.cos(phic)[:, None]
    psi = (phic - phi)[:, None]
    X = Xp * np.cos(psi) - Zp * np.sin(psi)
    Y = Yp
    Z = Xp * np.sin(psi) + Zp * np.cos(psi)
    H = np.hypot(X, Y)
    return {"X": X, "Y": Y, "Z": Z, "H": H, "D": np.degrees(np.arctan2(Y, X)), "I": np.degrees(np.arctan2(Z, H))}


def check(model: Model) -> int:
    """跟壓縮檔裡的官方測試值比（D、I 到 0.01°，X、Y、Z 到 0.1 nT）；不符就報錯，回傳比對了幾筆"""
    with _zip() as z:
        text = z.read("WMM2025COF/WMM2025_TestValues.txt").decode("ascii")
    count = 0
    for line in text.splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        v = [float(x) for x in line.split()]
        year, alt, lat, lon, D, I, _H, X, Y, Z = v[:10]
        f = field(model, np.array([lat]), np.array([lon]), alt, year)
        got = {k: float(f[k][0, 0]) for k in ("D", "I", "X", "Y", "Z")}
        if abs(got["D"] - D) > 0.01 or abs(got["I"] - I) > 0.01 or any(
            abs(got[k] - e) > 0.1 for k, e in (("X", X), ("Y", Y), ("Z", Z))
        ):
            raise RuntimeError(f"WMM2025 的測試值不符：{line.strip()} → {got}")
        count += 1
    return count
