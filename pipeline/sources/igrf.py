"""IGRF-14（第 14 代國際地磁參考場，IAGA）：1900–2025 年每 5 年一組的球諧係數（第十四批順序 256，2026-10-31）。

- 檔案：igrf14coeffs.txt，Zenodo（IAGA 發布，doi:10.5281/zenodo.14012302），跟 NCEI 的同名檔完全相同（MD5 相同）。
- 授權：Zenodo 的紀錄標 CC BY 4.0（2026-10-30 讀）。引用照 Zenodo 頁：
  Alken, P. et al. (2024). International Geomagnetic Reference Field: the fourteenth generation (IGRF-14) coefficients.
- 格式：# 開頭是說明；「c/s deg ord IGRF … DGRF …」一行是模型種類，「g/h n m 1900.0 1905.0 … 2025.0 2025-30」一行是年份，
  之後每一列是 g 或 h、n、m 與各年份的係數（nT；最後一欄是 2025–2030 年的年變率，這裡不用）。
  1995 年以前只到 10 階（11–13 階是 0），2000 年起到 13 階。DGRF 是定案的歷史模型，1900–1940 與 2025 是 IGRF。
- 算法跟 WMM 一樣（Schmidt 半正規化、地磁參考半徑 6371.2 km），所以用 sources/wmm.py 的 Model 與 field()，年變率是 0。
"""
from __future__ import annotations

import numpy as np

from common import download
from sources.wmm import Model

URL = "https://zenodo.org/api/records/14218973/files/igrf14coeffs.txt/content"
CITATION = ("Alken, P., Chulliat, A., Nair, M. et al. (2024). International Geomagnetic Reference Field: "
            "the fourteenth generation (IGRF-14) coefficients. IAGA, Zenodo, doi:10.5281/zenodo.14012302 (CC BY 4.0)")


def models() -> dict[int, Model]:
    """年份（1900、1905 … 2025）→ 那一年的主磁場模型"""
    path = download(URL, "igrf", "igrf14coeffs.txt")
    with open(path, encoding="ascii") as fh:
        lines = [l.split() for l in fh.read().splitlines() if l.strip() and not l.startswith("#")]
    head = next(i for i, l in enumerate(lines) if l[:3] == ["g/h", "n", "m"])
    years = [int(float(y)) for y in lines[head][3:] if "-" not in y]
    rows = lines[head + 1:]
    degree = max(int(r[1]) for r in rows)
    out: dict[int, Model] = {}
    for k, year in enumerate(years):
        g, h = np.zeros((degree + 1, degree + 1)), np.zeros((degree + 1, degree + 1))
        for r in rows:
            n, m, v = int(r[1]), int(r[2]), float(r[3 + k])
            (g if r[0] == "g" else h)[n, m] = v
        zero = np.zeros_like(g)
        out[year] = Model(float(year), degree, g, h, zero, zero)
    if years[0] != 1900 or years[-1] != 2025 or len(years) != 26:
        raise RuntimeError(f"IGRF-14 的年份不是 1900–2025 每 5 年：{years}")
    return out
