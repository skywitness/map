"""溫室氣體排放的擴充：交通運輸的碳排放（第十批順序 180，2026-10-31，製作手冊第一百二十八節）。

使用者 2026-10-30 決定照候選清單用 CEDS（sources/ceds.py，網站的氣候側欄已在用它的用途比例）：
- transport-co2-share.json：燃料燃燒的二氧化碳裡運輸（國內航空、公路、鐵路、國內水運、其他運輸）占幾 %，1970–2023 年。
  燃料燃燒總量不到 SHARE_MIN 的國家不放（比例容易跳動）。
- transport-co2-per-capita.json：人均運輸二氧化碳（公噸／人），人口用 UN WPP 2024。
CEDS 的總量比 Global Carbon Project 高（台灣 2023 年 CEDS 2.95 億公噸、GCP 2.67 億公噸），所以只用比例與 CEDS 自己的運輸量，
不跟 GCP 的總量混在一起。國際航空與海運的燃料（bunkers）CEDS 只有全球，不算在任何國家。
台灣另外對照交通部運輸研究所「運輸部門歷年二氧化碳排放量推估」（data.gov.tw 8331，政府資料開放授權條款第 1 版）：
CSV（www.motc.gov.tw/uploaddowndoc?file=datagov/1227894820517711872.csv）2026-10-31 從 cloud 都是 HTTP 502（HiNetCDN）；
2026-11-05 本機 session 拿到了，放在 map-plan 的 data/motc/transport-co2-8331.csv（README 有 SHA-256）。重跑前複製到
pipeline/.cache/motc/。1990–2021 年，千公噸，依運具分（小客車、小貨車、大客車、大貨車、機車、臺鐵、高鐵、各捷運、國內航空、
國內水運）；「 - 」是那時還沒有這個運具。2026-11-06 起從這個檔讀，原本寫死的 2021 年數字（IOT_2021）拿掉。
"""
from __future__ import annotations

import csv
import hashlib

from common import CACHE_DIR, OUT_DIR, indicator_file, write_json
from sources import ceds, wpp

OUT = OUT_DIR / "topics" / "climate"
FIRST_YEAR = 1970
SHARE_MIN = 1e6  # 燃料燃燒的二氧化碳不到 100 萬公噸的國家不算比例
IOT_CSV = CACHE_DIR / "motc" / "transport-co2-8331.csv"
IOT_SHA256 = "49fef442d34a9e4a7f301aba9cd8ff2f895930e7886cedf13e7f3008bdff6d80"
IOT_MODES = {"小客車": ("小客車", "cars"), "機車": ("機車", "motorcycles"), "大貨車": ("大貨車", "heavy trucks"),
             "小貨車": ("小貨車", "light trucks"), "大客車": ("大客車", "buses")}


def iot() -> dict[int, dict[str, float]]:
    """運研所的運輸部門二氧化碳 {年: {欄名（去掉單位）: 公噸}}"""
    if hashlib.sha256(IOT_CSV.read_bytes()).hexdigest() != IOT_SHA256:
        raise RuntimeError(f"{IOT_CSV} 的 SHA-256 跟 map-plan 的 README 不一樣，先從 map-plan 的 data/motc/ 複製過來")
    with open(IOT_CSV, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    head = [h.split("（")[0] for h in rows[0]]
    out = {}
    for r in rows[1:]:
        if not r or not r[0].strip().isdigit():
            continue  # 最後一列是備註
        out[int(r[0])] = {h: float(v.replace(",", "")) * 1000 for h, v in zip(head[1:], r[1:]) if v.strip() not in ("-", "")}
    return out


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
    official = iot()
    oy = max(official)
    o = official[oy]
    diff = tw[oy] / o["國內小計"] - 1
    parts = sorted(((o[k], zh, en) for k, (zh, en) in IOT_MODES.items()), reverse=True)
    rail = o["軌道小計"]
    note = (f"運研所推估 {oy} 年國內運輸排放 {o['國內小計'] / 1e6:,.1f} 百萬公噸（{official[min(official)]['國內小計'] / 1e6:,.1f} 百萬公噸，"
            f"{min(official)} 年）：" + "、".join(f"{zh} {100 * v / o['國內小計']:.1f}%" for v, zh, _ in parts)
            + f"，軌道 {100 * rail / o['國內小計']:.1f}%、國內航空與水運 {100 * (o['國內航空'] + o['國內水運']) / o['國內小計']:.1f}%；"
            f"CEDS 的 {oy} 年是 {tw[oy] / 1e6:,.1f} 百萬公噸（{'多' if diff > 0 else '少'} {abs(diff) * 100:.0f}%）。"
            f"CEDS {last} 年台灣運輸 {tw[last] / 1e6:,.1f} 百萬公噸，占燃料燃燒二氧化碳的 {100 * tw[last] / tw_total:.1f}%。")
    note_en = (f"Taiwan’s Institute of Transportation estimates domestic transport emissions at {o['國內小計'] / 1e6:,.1f} million tonnes in {oy} "
               f"({official[min(official)]['國內小計'] / 1e6:,.1f} million in {min(official)}): "
               + ", ".join(f"{en} {100 * v / o['國內小計']:.1f}%" for v, _, en in parts)
               + f", rail {100 * rail / o['國內小計']:.1f}%, domestic aviation and shipping {100 * (o['國內航空'] + o['國內水運']) / o['國內小計']:.1f}%; "
               f"CEDS has {tw[oy] / 1e6:,.1f} million for {oy} ({abs(diff) * 100:.0f}% {'higher' if diff > 0 else 'lower'}). "
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
