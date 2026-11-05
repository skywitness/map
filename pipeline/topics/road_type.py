"""交通安全：死亡車禍發生在哪一種道路（2026-11-05，製作手冊第二十三批 405〔候選 994〕；步驟 road-type，輸出 topics/road-safety/）。

- Eurostat tran_sf_roadro「Persons killed in road accidents by type of road」（CC BY 4.0，CARE 資料庫，30 天內死亡），
  1999–2024：高速公路（MWAY）、市區道路（RD_URB）、郊區道路（RD_RUR）、不詳（UNK）、合計。指標是高速公路的死亡占合計的比例；
  合計不到 50 人的國家年不算（賽普勒斯 34 人裡 8 人就是 23.5%，比例跳得太大）；前三年平均每年 5 人以上、這一年突然是 0 的
  （瑞典 2024 年，高速公路的死者併進了郊區道路）當缺值。側欄列四類的人數。
- 每十億車公里死亡數：合計死亡 ÷ Eurostat road_tf_vehmov（vehicle=TOTAL、regisveh=TERNAT_REG，國內道路上所有車輛的
  百萬車公里）× 1,000，22 國有車公里，年份零散。
- 照網站的 Eurostat 規則，英國不收（歐盟、EFTA、候選國以外只准非商業）。
- 台灣：交通部統計查詢網沒有按道路類別分的表（使用者 2026-11-05 找過），只有高速公路局《113 年國道事故檢討分析》的國道 30 日內
  死亡 95 人（本機 session 下載的 PDF，map-plan 的 data/motc/），除以交通部的全國 30 日內死亡人數（topics/road_safety.py），
  只畫 2024 年。台灣的「國道」不含快速公路，跟 Eurostat 的 motorway 定義相近但不完全相同，附註寫明。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat
from topics import road_safety

OUT = OUT_DIR / "topics" / "road-safety"
TYPES = ["MWAY", "RD_URB", "RD_RUR", "UNK"]
EXCLUDED = {"GBR", "XKX"}
MIN_DEATHS = 50
TW_FREEWAY_30D = {2024: 95}  # 高速公路局《113 年國道事故檢討分析》摘要：30 日內死亡人數


def build() -> None:
    total = eurostat.series("tran_sf_roadro", freq="A", unit="NR", tra_infr="TOTAL")
    parts = {t: eurostat.series("tran_sf_roadro", freq="A", unit="NR", tra_infr=t) for t in TYPES}
    vkm = eurostat.series("road_tf_vehmov", freq="A", unit="MIO_VKM", vehicle="TOTAL", regisveh="TERNAT_REG")
    years = sorted({y for s in total.values() for y in s})
    share, detail, dropped = {}, {}, []
    for c, s in total.items():
        if c in EXCLUDED:
            continue
        mway = dict(parts["MWAY"].get(c, {}))
        for y in list(mway):
            prev = [mway[p] for p in (y - 1, y - 2, y - 3) if p in mway]
            if mway[y] == 0 and prev and sum(prev) / len(prev) >= 5:
                del mway[y]  # 前幾年每年都有、這一年突然是 0（瑞典 2024 年）：歸類改了，當缺值
                dropped.append((c, y))
        row = [round(mway[y] / s[y] * 100, 1) if s.get(y, 0) >= MIN_DEATHS and y in mway else None for y in years]
        if any(v is not None for v in row):
            share[c] = row
            last = max(y for y in s if s[y] >= MIN_DEATHS and y in mway and all(y in parts[t].get(c, {}) for t in TYPES))
            detail[c] = {"year": last, "total": s[last], "types": [parts[t][c][last] for t in TYPES]}
    tw_total = road_safety._taiwan()["total"]
    for y, n in TW_FREEWAY_30D.items():
        share.setdefault("TWN", [None] * len(years))[years.index(y)] = round(n / tw_total[y] * 100, 1)
    note = (f"台灣是高速公路局《113 年國道事故檢討分析》的國道 30 日內死亡 {TW_FREEWAY_30D[2024]} 人 ÷ 交通部統計的全國 30 日內死亡 "
            f"{tw_total[2024]:,.0f} 人（2024 年）。台灣的國道不含快速公路；交通部沒有按道路類別分的統計，只有這一年。",
            f"Taiwan: {TW_FREEWAY_30D[2024]} deaths within 30 days on national freeways (Freeway Bureau, 2024 accident review) divided by "
            f"{tw_total[2024]:,.0f} road deaths within 30 days nationwide (Ministry of Transportation and Communications), 2024. "
            "Freeways exclude expressways; no breakdown by road type is published, so only this year is shown.")
    write_json(OUT / "motorway-death-share.json", indicator_file(
        "motorway-death-share", "%", years, share, latestWithin=3, notes={"TWN": note[0]}, notesEn={"TWN": note[1]}))
    rate = {}
    for c, s in total.items():
        if c in EXCLUDED or c not in vkm:
            continue
        row = [round(s[y] / vkm[c][y] * 1000, 1) if y in s and vkm[c].get(y) else None for y in years]
        if any(v is not None for v in row):
            rate[c] = row
    write_json(OUT / "deaths-per-vkm.json", indicator_file("deaths-per-vkm", "人/十億車公里", years, rate, latestWithin=5))
    write_json(OUT / "road-type-detail.json", {"types": TYPES, "countries": detail})
    latest = sorted(((v[y], c) for c, v in share.items() for y in [max(i for i, x in enumerate(v) if x is not None)]), reverse=True)
    print(f"  高速公路占比 {len(share)} 國（{years[0]}–{years[-1]}）：{latest}")
    lr = sorted(((v[i], c, years[i]) for c, v in rate.items() for i in [max(i for i, x in enumerate(v) if x is not None)]), reverse=True)
    print(f"  每十億車公里 {len(rate)} 國：{lr}")
    print(f"  突然變 0 當缺值：{dropped}")
    print(f"  德國 {detail.get('DEU')}；西班牙 {detail.get('ESP')}；台灣 {share['TWN'][years.index(2024)]}%")
