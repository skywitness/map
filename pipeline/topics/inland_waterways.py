"""河流與流域：可通航的內河航道、內河貨運與船閘（2026-11-05，製作手冊第二十三批 411〔候選 999〕；步驟 inland-waterways，
輸出 topics/rivers/，照手冊的建議併進「河流與流域」）。

- **可通航水道長度（全世界）**：CIA 世界概況 2022-12-29 版（factbook/factbook.json commit 61dadec0，公有領域；
  sources/factbook_2022.py）的「Waterways」欄，2023 年以後的版本拿掉了這一欄。欄位是文字：取第一個「… km」的數字與
  第一個括號裡的年份（法國寫「metropolitan France: 8,501 km … (2010)」、美國寫「41,009 km (2012) (19,312 km used for
  commerce…)」）；沒有公里數的（肯亞「none specifically」、南蘇丹「see entry for Sudan」）不收。各國的年份不同
  （2009–2022），一律放在 2022 年這一欄，年份寫在 hints；「可通航」各國自己定義，只能看量級。
- **歐洲（Eurostat，CC BY 4.0）**：`iww_if_infrastr` 可通航水道長度（運河 CNL、河川與湖泊 RIV_LAK、合計 TOTAL，
  1962–2024）與運河占的比例；`iww_go_atygo` 內河貨運（所有航線 TOTAL、所有貨類 TOTAL、所有包裝 TOTAL，百萬延噸公里，
  2007–2025）。照網站的 Eurostat 規則，英國與科索沃不收。
- **船閘**：Global Dam Watch v1.0（CC BY 4.0，sources/gdw.py；「水壩」圖層刻意不收的那一批）DAM_TYPE 是 Lock 的
  1,152 座，國家依點的位置（geoindex）。GDW 的船閘幾乎都沒有名稱、河名與年份，tooltip 只寫國家。OSM 的
  `waterway=lock_gate` 是閘門不是船閘（一座船閘有兩個以上閘門），手冊建議不混用，沒有用。
- **台灣**：CIA 世界概況沒有這一欄（台灣沒有可通航的內陸水道），Eurostat 也沒有；照使用者 2026-11-05 的決定，
  地圖灰色、tooltip 說明（前端的 noValue）。
"""
from __future__ import annotations

import re
from collections import Counter

import geoindex
from common import OUT_DIR, indicator_file, points_file, write_json
from sources import eurostat, factbook_2022, gdw

OUT = OUT_DIR / "topics" / "rivers"
FACTBOOK_YEAR = 2022
EXCLUDED = {"GBR", "XKX"}
SHARE_WITHIN = 16


def _factbook() -> tuple[dict[str, float], dict[str, int | None]]:
    km, year = {}, {}
    for iso3, t in factbook_2022.transportation().items():
        text = re.sub(r"<[^>]+>", "", t.get("Waterways", {}).get("text", ""))
        m = re.search(r"([\d,]+(?:\.\d+)?)\s*km", text)
        if not m:
            if text:
                print(f"  {iso3} 沒有公里數：{text[:80]}")
            continue
        km[iso3] = float(m.group(1).replace(",", ""))
        y = re.search(r"\((\d{4})\)", text)
        year[iso3] = int(y.group(1)) if y else None
    return km, year


def _europe(series: dict[str, dict[int, float]]) -> tuple[list[int], dict[str, list[float | None]]]:
    series = {c: s for c, s in series.items() if c not in EXCLUDED}
    years = sorted({y for s in series.values() for y in s})
    return years, {c: [s.get(y) for y in years] for c, s in sorted(series.items())}


def build() -> None:
    km, year = _factbook()
    hints = {c: f"{y} 年的數字" if y else "年份沒寫" for c, y in year.items()}
    hints_en = {c: f"Figure for {y}" if y else "Year not given" for c, y in year.items()}
    write_json(OUT / "waterways.json", indicator_file(
        "waterways", "公里", [FACTBOOK_YEAR], {c: [v] for c, v in sorted(km.items())}, hints=hints, hintsEn=hints_en))
    top = sorted(((v, c, year[c]) for c, v in km.items()), reverse=True)
    print(f"  CIA：{len(km)} 國；{top[:14]}")
    print(f"  年份：{sorted(Counter(year.values()).items(), key=lambda kv: (kv[0] is None, kv[0] or 0))}")

    total = eurostat.series("iww_if_infrastr", freq="A", unit="KM", tra_infr="TOTAL")
    canal = eurostat.series("iww_if_infrastr", freq="A", unit="KM", tra_infr="CNL")
    river = eurostat.series("iww_if_infrastr", freq="A", unit="KM", tra_infr="RIV_LAK")
    years, values = _europe(total)
    write_json(OUT / "waterways-eu.json", indicator_file("waterways-eu", "公里", years, values, license="CC BY 4.0", latestWithin=5))
    # 運河 ÷（運河＋河川湖泊）：荷蘭、比利時的分項只到 2011、2008 年（合計照常有），所以最近值可以舊到 16 年
    share = {c: {y: round(v / (v + river[c][y]) * 100, 1) for y, v in s.items() if y in river.get(c, {}) and v + river[c][y] > 0}
             for c, s in canal.items()}
    share = {c: s for c, s in share.items() if s}
    s_years, s_values = _europe(share)
    write_json(OUT / "canal-share.json", indicator_file("canal-share", "%", s_years, s_values, license="CC BY 4.0", latestWithin=SHARE_WITHIN))
    last = {c: (max(s), s[max(s)]) for c, s in total.items() if c not in EXCLUDED}
    print(f"  Eurostat 長度 {len(values)} 國 {years[0]}–{years[-1]}：{sorted(((v, c, y) for c, (y, v) in last.items()), reverse=True)}")
    print(f"  運河占：{sorted(((s[max(s)], c, max(s)) for c, s in share.items() if c not in EXCLUDED), reverse=True)}")

    freight = eurostat.series("iww_go_atygo", freq="A", tra_cov="TOTAL", nst07="TOTAL", typpack="TOTAL", unit="MIO_TKM")
    f_years, f_values = _europe(freight)
    write_json(OUT / "inland-freight.json", indicator_file("inland-freight", "百萬延噸公里", f_years, f_values, license="CC BY 4.0", latestWithin=3))
    f_last = {c: (max(s), s[max(s)]) for c, s in freight.items() if c not in EXCLUDED}
    print(f"  內河貨運 {len(f_values)} 國 {f_years[0]}–{f_years[-1]}：{sorted(((v, c, y) for c, (y, v) in f_last.items()), reverse=True)}")

    locks = [d for d in gdw.dams() if d.dam_type == "Lock"]
    iso = geoindex.countries_at([d.lon for d in locks], [d.lat for d in locks])
    rows = [{"lon": round(d.lon, 4), "lat": round(d.lat, 4), "n": d.name or "", "r": d.river or "", "iso3": c or ""}
            for d, c in zip(locks, iso)]
    rows.sort(key=lambda r: (r["iso3"], r["lon"]))
    write_json(OUT / "locks.json", points_file(rows, ["lon", "lat", "n", "r", "iso3"], {"lon": 0.0001, "lat": 0.0001}, strings=("iso3",)))
    print(f"  船閘 {len(rows)} 座：{Counter(r['iso3'] for r in rows).most_common(12)}；台灣 {sum(1 for r in rows if r['iso3'] == 'TWN')}")
