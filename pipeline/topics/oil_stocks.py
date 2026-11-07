"""石油庫存與撐得了幾天（2026-11-07，製作手冊第二十五批 529，候選 1206；擴充「石油、天然氣與煤」）。

使用者 2026-11-07 決定只用 EIA（JODI 找不到授權條文）。EIA International（INTL.zip，美國公有領域，sources/eia.py）的
INTL.5-5-<地區>-MBBL.A「Petroleum and other liquids stocks」（原油加油品的年底庫存，百萬桶），1973–2025。
EIA 的這個系列大多數 OECD 國家都標 `w`（不公開），有數字的只有美國、日本、德國、法國、義大利、英國、加拿大、南韓
（冰島、以色列是 0，當作沒有資料不畫）。撐得了幾天＝庫存 ÷ 同一年的每日石油消費（INTL.5-2-<地區>-TBPD，千桶/日）。
輸出 public/data/topics/fossil-fuels/{oil-stocks,oil-stock-days}.json。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eia
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "fossil-fuels"
EXTRA = {"license": "Public domain", "attribution": "U.S. Energy Information Administration, International Energy Statistics"}


def build() -> None:
    raw = eia.annual(["5-5-MBBL", "5-2-TBPD"])
    stocks, cons = raw["5-5-MBBL"], raw["5-2-TBPD"]
    years = list(range(1973, max(y for s in stocks.values() for y in s) + 1))
    vol, days = {}, {}
    for region, s in stocks.items():
        iso3 = to_iso3(region)
        if not iso3 or not any(v > 0 for v in s.values()):
            continue
        vol[iso3] = [round(s[y], 2) if s.get(y) else None for y in years]
        c = cons.get(region, {})
        days[iso3] = [round(s[y] * 1000 / c[y], 1) if s.get(y) and c.get(y) else None for y in years]
    write_json(OUT / "oil-stocks.json", indicator_file("oil-stocks", "million barrels", years, vol, **EXTRA))
    write_json(OUT / "oil-stock-days.json", indicator_file("oil-stock-days", "days", years, days, **EXTRA))
    i = years.index(2025)
    print(f"  石油庫存 {len(vol)} 國：2025 {sorted(((v[i], k) for k, v in vol.items() if v[i]), reverse=True)}")
    print(f"  撐得了幾天 2025：{sorted(((v[i], k) for k, v in days.items() if v[i]), reverse=True)}")
    for k in ("USA", "JPN", "KOR", "DEU"):
        print(f"  {k}：1973 {days[k][0]}、1990 {days[k][years.index(1990)]}、2008 {days[k][years.index(2008)]}、2021 {days[k][years.index(2021)]}、2022 {days[k][years.index(2022)]}")
