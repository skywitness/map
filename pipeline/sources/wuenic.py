"""WHO/UNICEF 各國預防接種涵蓋率估計（WUENIC）與 WHO 的 HPV 疫苗涵蓋率估計。

- **2000 年起用 WHO Global Health Observatory（GHO）**（data.who.int 的資料集條款是 CC BY 4.0，跟 `sources/who.py` 一樣）：
  DTP3 `WHS4_100`、DTP1 `VACCINECOVERAGE_DTP1`、麻疹第一劑 `WHS8_110`、麻疹第二劑 `MCV2`、
  HPV `SDGHPVRECEIVED`（9–14 歲女孩這個主要目標世代打了第一劑的比例，WHO 的 HPV 估計）。
  2026-10 的版本是 WUENIC 2025 年版（2026-07-15 完成），2000–2025 年、195 個 WHO 會員國；沒有台灣。
- **1980–1999 年用世界銀行 WDI 轉載的 WUENIC**（`SH.IMM.IDPT`、`SH.IMM.MEAS`，序列中繼資料標 CC BY-4.0）：
  GHO 只有 2000 年起。WDI（2026-10-08 更新）還是 2024 年版的 WUENIC，2000 年以後各國有 150 個值跟 2025 年版不同
  （每年改版都會修訂整個序列），但 1980–1999 年跟 WHO 免疫資料入口的 2025 年版逐一比對完全相同（3,249 個值），
  所以只拿 WDI 的 1980–1999 年接在 GHO 前面。DTP1、麻疹第二劑、HPV 沒有 2000 年以前的。
- **沒有用的**：
  - WHO 免疫資料入口（immunizationdata.who.int）的整包 Excel 有 1980 年起的 WUENIC，但入口網站只連到 WHO 網站的一般使用條款，
    沒有寫資料集的授權（data.who.int 才明寫 CC BY 4.0）；WHO 網站的「Terms and conditions of use for WHO data compilations」
    只准「public health purposes」、改作要書面同意。
  - UNICEF 資料倉儲（data.unicef.org）有同一份 WUENIC，但網站有 Cloudflare 驗證，讀不到使用條款，所以不用。
- 麻疹第二劑：還沒有把第二劑納入常規接種的國家 GHO 記成 0（奈及利亞 2018 年以前），照原樣用。
  HPV：還沒有 HPV 疫苗計畫的國家沒有值。
"""
from __future__ import annotations

from sources import who, worldbank

FIRST_YEAR = 1980
GHO_FROM = 2000

GHO_CODES = {
    "dtp3": "WHS4_100",
    "dtp1": "VACCINECOVERAGE_DTP1",
    "mcv1": "WHS8_110",
    "mcv2": "MCV2",
    "hpv": "SDGHPVRECEIVED",
}
# 2000 年以前接 WDI 的序列
WDI_BEFORE_2000 = {"dtp3": "SH.IMM.IDPT", "mcv1": "SH.IMM.MEAS"}

Series = dict[str, dict[int, float]]


def coverage(antigen: str) -> tuple[Series, dict[int, float]]:
    """{iso3: {年: %}} 與世界值 {年: %}（世界值只有 GHO 的 2000 年起）"""
    countries, world = who.gho(GHO_CODES[antigen], {})
    countries = {k: {y: v for y, v in s.items() if y >= GHO_FROM} for k, s in countries.items()}
    if code := WDI_BEFORE_2000.get(antigen):
        early, _ = worldbank.fetch(code, FIRST_YEAR, GHO_FROM - 1)
        for iso3, s in early.items():
            if iso3 not in countries:
                continue  # WDI 有、GHO 沒有的（WHO 會員國以外的屬地）不收，涵蓋的國家才一致
            for y, v in s.items():
                if not (0 <= v <= 100) or v != round(v):
                    raise RuntimeError(f"WDI {code} {iso3} {y} 年的值 {v} 不是 0–100 的整數，格式可能變了")
                countries[iso3][y] = v
    return countries, world
