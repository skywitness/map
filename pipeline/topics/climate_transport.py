"""溫室氣體排放的擴充：交通運輸的碳排放（第十批順序 180，2026-10-31，製作手冊第一百二十八節）。

使用者 2026-10-30 決定照候選清單用 CEDS（sources/ceds.py，網站的氣候側欄已在用它的用途比例）：
- transport-co2-share.json：燃料燃燒的二氧化碳裡運輸（國內航空、公路、鐵路、國內水運、其他運輸）占幾 %，1970–2023 年。
  燃料燃燒總量不到 SHARE_MIN 的國家不放（比例容易跳動）。
- transport-co2-per-capita.json：人均運輸二氧化碳（公噸／人），人口用 UN WPP 2024。
CEDS 的總量比 Global Carbon Project 高（台灣 2023 年 CEDS 2.95 億公噸、GCP 2.67 億公噸），所以只用比例與 CEDS 自己的運輸量，
不跟 GCP 的總量混在一起。國際航空與海運的燃料（bunkers）CEDS 只有全球，不算在任何國家。
台灣另外對照交通部運輸研究所「運輸部門歷年二氧化碳排放量推估」（data.gov.tw 8331，政府資料開放授權條款第 1 版）：
CSV（www.motc.gov.tw/uploaddowndoc?file=datagov/1227894820517711872.csv）2026-10-31 從 cloud 兩次都是 HTTP 502（HiNetCDN），
數字用規劃 session 2026-10-30 讀到的 CSV（IOT_2021）：2021 年國內運輸 34,614 千公噸，其中公路 33,458 千公噸。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import ceds, wpp

OUT = OUT_DIR / "topics" / "climate"
FIRST_YEAR = 1970
SHARE_MIN = 1e6  # 燃料燃燒的二氧化碳不到 100 萬公噸的國家不算比例
IOT_2021 = {"transport": 34614e3, "road": 33458e3}  # 公噸


def build() -> None:
    uses = ceds.combustion_by_use()
    pop = wpp.demographic(["TPopulation1July"], last_year=2025)["TPopulation1July"]
    years = sorted({y for u in uses.values() for s in u.values() for y in s if y >= FIRST_YEAR})
    share, per_capita = {}, {}
    for iso3, u in sorted(uses.items()):
        t = u.get("transport", {})
        if not t:
            continue
        s_row, p_row = [], []
        for y in years:
            total = sum(series.get(y, 0.0) for series in u.values())
            s_row.append(round(100 * t.get(y, 0.0) / total, 1) if total >= SHARE_MIN else None)
            p = pop.get(iso3, {}).get(y)
            p_row.append(round(t.get(y, 0.0) / (p * 1000), 3) if p else None)
        if any(v is not None for v in s_row):
            share[iso3] = s_row
        if any(v is not None for v in p_row):
            per_capita[iso3] = p_row

    last = years[-1]
    tw = uses["TWN"]["transport"]
    tw_total = sum(series.get(last, 0.0) for series in uses["TWN"].values())
    diff = tw[2021] / IOT_2021["transport"] - 1
    note = (f"運研所推估 2021 年國內運輸排放 3,461 萬公噸（公路 3,346 萬），CEDS 是 {tw[2021] / 1e6:,.1f} 百萬公噸"
            f"（{'多' if diff > 0 else '少'} {abs(diff) * 100:.0f}%）。CEDS {last} 年台灣運輸 {tw[last] / 1e6:,.1f} 百萬公噸，"
            f"占燃料燃燒二氧化碳的 {100 * tw[last] / tw_total:.1f}%。")
    note_en = (f"Taiwan’s Institute of Transportation estimates domestic transport emissions at 34.6 million tonnes in 2021 "
               f"(road 33.5 million); CEDS has {tw[2021] / 1e6:,.1f} million ({abs(diff) * 100:.0f}% {'higher' if diff > 0 else 'lower'}). "
               f"In {last}, CEDS puts Taiwan’s transport emissions at {tw[last] / 1e6:,.1f} million tonnes, "
               f"{100 * tw[last] / tw_total:.1f}% of fuel-combustion CO₂.")
    extra = {"notes": {"TWN": note}, "notesEn": {"TWN": note_en}}
    write_json(OUT / "transport-co2-share.json", indicator_file("transport-co2-share", "%", years, share, **extra))
    write_json(OUT / "transport-co2-per-capita.json", indicator_file("transport-co2-per-capita", "公噸/人", years, per_capita, **extra))

    i = years.index(last)
    big = {c: v[i] for c, v in share.items() if v[i] is not None and sum(s.get(last, 0) for s in uses[c].values()) >= 5e6}
    print(f"  {len(share)} 國有比例、{len(per_capita)} 國有人均；{last} 年 5 百萬公噸以上 {len(big)} 國，比例最高 "
          f"{sorted(big.items(), key=lambda kv: -kv[1])[:5]}")
    for c in ("USA", "FRA", "NOR", "DEU", "JPN", "KOR", "CHN", "IND", "TWN", "PRY"):
        if c in share:
            print(f"    {c}：{share[c][i]}%，人均 {per_capita.get(c, [None] * len(years))[i]} 公噸，"
                  f"運輸 {uses[c]['transport'].get(last, 0) / 1e6:,.1f} 百萬公噸")
    print("   ", note)
