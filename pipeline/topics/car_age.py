"""汽機車：小客車的車齡（2026-11-05，製作手冊第二十三批 403〔候選 1017〕；步驟 car-age，輸出 topics/road-safety/，擴充「汽機車」）。

- Eurostat road_eqs_carage「Passenger cars by age」（CC BY 4.0），2013–2025，五組車齡：未滿 2 年、2–5、5–10、10–20、
  超過 20 年；指標是超過 20 年、未滿 2 年各占全部小客車的比例。表裡沒有平均車齡，用分組中點估會失真（超過 20 年沒有上界），
  不估。
- 某一組是 0 而全部不是 0 的（捷克 2015 年的「超過 20 年」是 0.0%），是沒報不是真的 0，那一年整列當缺值；五組加起來跟
  TOTAL 差超過 2% 的年份也不用。
- 照網站的 Eurostat 規則（歐盟、EFTA、候選國以外只准非商業），英國與科索沃不收；喬治亞、摩爾多瓦、阿爾巴尼亞等候選國照收。
- 台灣沒有開放資料（data.gov.tw 搜「車齡」0 筆；交通部統計查詢網的「車輛使用年數」robots.txt 整站不准），不畫。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "road-safety"
AGES = ["Y_LT2", "Y2-5", "Y5-10", "Y10-20", "Y_GT20"]
EXCLUDED = {"GBR", "XKX"}
TOLERANCE = 0.02


def build() -> None:
    total = eurostat.series("road_eqs_carage", freq="A", unit="NR", age="TOTAL")
    bands = {a: eurostat.series("road_eqs_carage", freq="A", unit="NR", age=a) for a in AGES}
    years = sorted({y for s in total.values() for y in s})
    shares: dict[str, dict[int, list[float]]] = {}
    dropped = []
    for c, s in total.items():
        if c in EXCLUDED:
            continue
        for y, t in s.items():
            parts = [bands[a].get(c, {}).get(y) for a in AGES]
            if not t or any(p is None for p in parts):
                continue
            if any(p == 0 for p in parts) or abs(sum(parts) - t) > TOLERANCE * t:
                dropped.append((c, y))
                continue
            shares.setdefault(c, {})[y] = [round(p / t * 100, 1) for p in parts]
    old = {c: [s[y][4] if y in s else None for y in years] for c, s in shares.items()}
    new = {c: [s[y][0] if y in s else None for y in years] for c, s in shares.items()}
    write_json(OUT / "car-age-20.json", indicator_file("car-age-20", "%", years, old, latestWithin=3))
    write_json(OUT / "car-age-new.json", indicator_file("car-age-new", "%", years, new, latestWithin=3))
    write_json(OUT / "car-age-detail.json", {"ages": AGES, "years": years, "countries": {c: {str(y): v for y, v in s.items()} for c, s in shares.items()}})
    latest = {c: (max(s), s[max(s)]) for c, s in shares.items()}
    print(f"  {len(shares)} 國，{years[0]}–{years[-1]}；不用的國家年 {dropped}")
    print("  超過 20 年 " + "、".join(f"{c} {v[4]}%（{y}）" for c, (y, v) in sorted(latest.items(), key=lambda kv: -kv[1][1][4])))
    print("  未滿 2 年 " + "、".join(f"{c} {v[0]}%（{y}）" for c, (y, v) in sorted(latest.items(), key=lambda kv: -kv[1][1][0])[:10]))
