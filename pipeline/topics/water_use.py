"""各國水資源：取水量的用途、海水淡化（2026-11-05，製作手冊第二十二批 387；步驟 water-use，輸出 topics/water-forest/）。

- 取水量的用途：World Bank WDI 轉載 FAO AQUASTAT 的 ER.H2O.FWAG.ZS（農業占取水量）、ER.H2O.FWIN.ZS（工業）、
  ER.H2O.FWDM.ZS（家戶與都市），與 ER.H2O.FWTL.K3（年取水總量，十億立方公尺），CC BY 4.0。
  - 多數國家每 5 年左右才有一筆，用 latestWithin（WITHIN 年內最近一年）。
  - 三項加起來應該約等於 100%：同一年三項都有、加總偏離 100 超過 SUM_TOLERANCE 的（北馬其頓 21.9 這類），那一年三項都不用；
    單項超過 100% 的（汶萊的家戶 164.7%）也不用。附註寫出被拿掉的年份。
  - 「工業」含火力與核能電廠的冷卻水，蒙特內哥羅、愛沙尼亞、加拿大的工業占比高主要是發電，說明寫明。
  - 取水量不等於耗水量（不扣蒸發與回歸水）。
- 海水淡化產量：AQUASTAT 批次檔的「Desalinated water produced」（十億立方公尺／年，CC BY 4.0），1980 年代起。
  中國 2023 年 128 億立方公尺遠高於沙烏地（29 億），AQUASTAT 的中國可能含苦鹹水淡化與回用，附註寫口徑可能不同。
- 台灣：WDI、AQUASTAT 都沒有台灣。水利署的用水量開放資料（生活、工業、灌溉、養殖、畜牧五個檔）沒有寫欄位單位，
  各檔的數字差好幾個數量級，換算前要先確認單位（待確認），這一版不畫台灣。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, latest_year_span, to_series, write_json
from sources import aquastat, worldbank

OUT = OUT_DIR / "topics" / "water-forest"
WITHIN = 10
SUM_TOLERANCE = 5.0
SECTORS = {"agriculture": "ER.H2O.FWAG.ZS", "industry": "ER.H2O.FWIN.ZS", "domestic": "ER.H2O.FWDM.ZS"}
TOTAL = "ER.H2O.FWTL.K3"
DESAL = "Desalinated water produced"


def build() -> None:
    shares = {k: worldbank.fetch(code, 1960) for k, code in SECTORS.items()}
    dropped: dict[str, list[int]] = defaultdict(list)
    for c in {c for s, _w in shares.values() for c in s}:
        years = set.union(*(set(s.get(c, {})) for s, _w in shares.values()))
        for y in sorted(years):
            vals = [shares[k][0].get(c, {}).get(y) for k in SECTORS]
            bad = any(v is not None and v > 100.5 for v in vals)
            if all(v is not None for v in vals) and abs(sum(vals) - 100) > SUM_TOLERANCE:
                bad = True
            if bad:
                dropped[c].append(y)
                for k in SECTORS:
                    shares[k][0].get(c, {}).pop(y, None)
    notes = {c: f"AQUASTAT {'、'.join(map(str, ys))} 年的三個用途加起來跟 100% 差太多（或單項超過 100%），那幾年不用" for c, ys in dropped.items()}
    notes_en = {c: f"AQUASTAT’s three uses for {', '.join(map(str, ys))} do not add up to about 100% (or one exceeds 100%), so those years are not used" for c, ys in dropped.items()}
    print(f"  加總不合理、拿掉的國家年份：{dict(sorted(dropped.items()))}")
    for key, (series, world) in shares.items():
        series = {c: s for c, s in series.items() if s}
        years = latest_year_span(series, WITHIN)
        write_json(OUT / "water-use" / f"{key}.json", indicator_file(
            f"water-use/{key}", "%", years, {c: to_series(s, years, 1) for c, s in sorted(series.items())},
            aggregates={"WLD": to_series(world, years, 1)} if world else {}, latestWithin=WITHIN,
            notes={c: n for c, n in notes.items() if c in series}, notesEn={c: n for c, n in notes_en.items() if c in series},
        ))
        latest = {c: s[max(s)] for c, s in series.items()}
        top = sorted(latest.items(), key=lambda kv: -kv[1])
        print(f"  {key}：{len(series)} 國；最高 {top[:5]}；最低 {top[-3:]}；中國 {latest.get('CHN')}、美國 {latest.get('USA')}、德國 {latest.get('DEU')}、日本 {latest.get('JPN')}；世界 {sorted(world.items())[-1:]}")

    total, world = worldbank.fetch(TOTAL, 1960)
    years = latest_year_span(total, WITHIN)
    write_json(OUT / "water-withdrawal.json", indicator_file(
        "water-withdrawal", "十億立方公尺", years, {c: to_series(s, years, 3) for c, s in sorted(total.items())},
        aggregates={"WLD": to_series(world, years, 1)} if world else {}, latestWithin=WITHIN,
    ))
    latest = {c: s[max(s)] for c, s in total.items()}
    print(f"  年取水總量：{len(total)} 國；{sorted(latest.items(), key=lambda kv: -kv[1])[:5]}；世界 {sorted(world.items())[-1:]}")

    desal, dworld = aquastat.series({DESAL})[DESAL]
    desal = {c: {y: v for y, v in s.items() if v > 0} for c, s in desal.items()}
    desal = {c: s for c, s in desal.items() if s}
    dyears = latest_year_span(desal, WITHIN)
    write_json(OUT / "desalination.json", indicator_file(
        "desalination", "十億立方公尺", dyears, {c: to_series(s, dyears, 4) for c, s in sorted(desal.items())},
        aggregates={"WLD": to_series(dworld, dyears, 2)} if dworld else {}, latestWithin=WITHIN,
        notes={"CHN": "AQUASTAT 的中國數字遠高於沙烏地阿拉伯等波灣國家，可能含苦鹹水淡化與廢水回用，口徑可能跟其他國家不同。"},
        notesEn={"CHN": "AQUASTAT’s figure for China is far above Gulf states such as Saudi Arabia and may include brackish-water desalination and wastewater reuse, so it may not be comparable."},
    ))
    dl = {c: (max(s), s[max(s)]) for c, s in desal.items()}
    print(f"  海水淡化：{len(desal)} 國；{sorted(dl.items(), key=lambda kv: -kv[1][1])[:8]}；世界 {sorted(dworld.items())[-1:]}")
