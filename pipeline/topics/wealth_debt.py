"""存款與財產：有負債的家庭比例、財富撐不過半年貧窮線生活的人（2026-11-07，製作手冊第二十五批 454，候選 1099；
步驟 wealth-debt，輸出 topics/wealth/）。

- OECD Wealth Distribution Database（OECD.WISE.INE 的 DSD_WEALTH@DF_WEALTH，CC BY 4.0，600 KB），31 國，2009–2023 年，
  各國調查年份差到 7 年，前端用 8 年內最近一次（latestWithin）：
  - indebted/share.json：SH_D，有負債的家庭比例（% 家庭）；indebted/over3x.json：SH_DI_3，有負債的家庭裡負債超過年
    所得 3 倍的比例；
  - asset-poor.json：SH_NW_B、THRESHOLD=PL_50，等值化淨財富低於「所得貧窮線一年所得的 50%」的人口比例（財富不夠在貧窮
    線上過半年）。
- 不做 SH_TOP1、SH_TOP10、M_NW_RATIO：主題已經有 WID 的最富 1%、10% 財富占比與側欄的平均÷中位數。
- 台灣：主計總處的家庭財富分配統計調查設計不同（行政資料推估），不放上地圖。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import oecd

OUT = OUT_DIR / "topics" / "wealth"
FLOW = "OECD.WISE.INE,DSD_WEALTH@DF_WEALTH,1.0"
FIRST = 2009
WITHIN = 8
NO_TW = {"TWN": "OECD 的財富分配資料沒有台灣"}
NO_TW_EN = {"TWN": "Taiwan is not in the OECD wealth distribution data"}


def _write(path, indicator, series):
    last = max(y for s in series.values() for y in s)
    years = list(range(FIRST, last + 1))
    values = {c: to_series(s, years, 1) for c, s in sorted(series.items())}
    write_json(path, indicator_file(indicator, "%", years, values, latestWithin=WITHIN, noValue=NO_TW, noValueEn=NO_TW_EN,
                                    license="CC BY 4.0"), quiet=True)
    top = sorted(((round(s[max(s)], 1), c, max(s)) for c, s in series.items()), reverse=True)
    print(f"  {path.name}：{len(top)} 國；最高 {top[:7]}；最低 {top[-6:]}")


def build() -> None:
    s, _ = oecd.series(FLOW, MEASURE="SH_D", THRESHOLD="_Z")
    _write(OUT / "indebted" / "share.json", "indebted", s)
    s, _ = oecd.series(FLOW, MEASURE="SH_DI_3", THRESHOLD="_Z")
    _write(OUT / "indebted" / "over3x.json", "indebted", s)
    s, _ = oecd.series(FLOW, MEASURE="SH_NW_B", THRESHOLD="PL_50")
    _write(OUT / "asset-poor.json", "asset-poor", s)
