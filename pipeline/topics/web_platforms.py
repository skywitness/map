"""上網用什麼：搜尋引擎、瀏覽器與作業系統（新主題，2026-11-07，製作手冊第二十七批 587，候選 1307、1308；
步驟 web-platforms，輸出 topics/web-platforms/）。

- 資料：StatCounter Global Stats 的 CSV 匯出（sources/statcounter.py，不必登入；CC BY-SA 3.0 Unported，要附連結）。
  一國一種統計一個檔，2009 年 1 月到 2026 年 10 月每月；作業系統是「桌機＋手機＋平板＋遊戲機」合併（手冊的陷阱：
  平板分開算會讓 iOS 跳動）。地區代碼是 ISO alpha-2，另加全世界 ww。
- 年值是那一年有資料的月份的平均（2026 年是 1–10 月）；整個月全部是 0 的月份不算。
- 同一家公司的品牌先合併（手冊的陷阱）：Yandex 與 Yandex RU、Bing 與 MSN、Windows Live（Bing 的前身）、
  Edge 與舊版 Edge（Edge Legacy）、IE 與 IE Mobile、OS X 與 macOS。CSV 的「Other」是 StatCounter 把小品牌加總的欄，
  不參加第一名的比較。
- 指標：搜尋引擎、瀏覽器、作業系統的第一名（類別圖），iOS 市占減 Android 市占（百分點，發散圖）。
  沒有常住人口的地區（南極、布威島、赫德島、南喬治亞、法屬南方領地、美國本土外小島嶼、英屬印度洋領地）不畫；
  人口不到 5,000 人（UN WPP 2024）或 WPP 沒有的地區（托克勞、聖誕島等）樣本太小、數字亂跳，也不畫。
- 側欄：每一國一個檔 countries/<ISO3>.json：最近一個月三種統計的各家百分比，與歷年（年平均）曾經到 5% 的品牌。
- 陷阱：StatCounter 的樣本是裝了它的追蹤碼的網站的瀏覽次數，偏向這些網站，中國、俄羅斯的樣本特別不具代表性；
  不是使用者人數，也沒有國家權重。
"""
from __future__ import annotations

import csv
from collections import defaultdict

import pycountry

from common import CACHE_DIR, OUT_DIR, indicator_file, write_json
from sources import statcounter, wpp
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "web-platforms"
UNTIL = "2026-10"
SKIP = {"AQ", "BV", "HM", "GS", "TF", "UM", "IO"}
MIN_POP = 5.0  # 千人（WPP 2024）
LICENSE = {"license": "CC BY-SA 3.0", "attribution": "StatCounter Global Stats (https://gs.statcounter.com/)"}
# 品牌合併：CSV 的欄名 → 顯示名稱
MERGE = {
    "search": {"YANDEX": "Yandex", "YANDEX RU": "Yandex", "bing": "Bing", "MSN": "Bing", "Windows Live": "Bing"},
    "browser": {"Edge Legacy": "Edge", "IE": "Internet Explorer", "IEMobile": "Internet Explorer"},
    "os": {"OS X": "macOS"},
}
NOT_BRANDS = {"Other", "Unknown", ""}
# 類別圖的代碼（前端 web-platforms.ts 的 CATEGORIES 要一致）；不在表裡的第一名算「其他」
CATEGORY = {
    "search": {"Google": 1, "Baidu": 2, "Yandex": 3, "Naver": 4, "Bing": 5, "Yahoo!": 6, "Seznam": 7},
    "browser": {"Chrome": 1, "Safari": 2, "Internet Explorer": 3, "Firefox": 4, "Opera": 5, "Edge": 6, "UC Browser": 7},
    "os": {"Windows": 1, "Android": 2, "iOS": 3, "macOS": 4},
}
OTHER = {"search": 8, "browser": 8, "os": 5}
PANEL_MIN = 5.0  # 側欄的歷年曲線：年平均曾經到 5% 的品牌
PANEL_LINES = 6
PANEL_BARS = 6


def _monthly(stat: str, iso2: str) -> dict[str, dict[str, float]]:
    """{月份: {合併後的品牌: %}}，含「Other」；整個月都是 0 的月份不算"""
    raw = statcounter.monthly(stat, iso2, UNTIL)
    out: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for brand, series in raw.items():
        name = MERGE[stat].get(brand, brand)
        name = "Other" if name in NOT_BRANDS else name
        for month, v in series.items():
            out[month][name] += v
    return {m: dict(v) for m, v in out.items() if sum(v.values()) > 0}


def _annual(months: dict[str, dict[str, float]]) -> dict[int, dict[str, float]]:
    by_year: dict[int, list[dict[str, float]]] = defaultdict(list)
    for m, v in months.items():
        by_year[int(m[:4])].append(v)
    out = {}
    for y, rows in by_year.items():
        brands = {b for r in rows for b in r}
        out[y] = {b: sum(r.get(b, 0.0) for r in rows) / len(rows) for b in brands}
    return out


def _leader(shares: dict[str, float]) -> str:
    return max((b for b in shares if b != "Other"), key=lambda b: shares[b])


def _regions() -> list[tuple[str, str]]:
    have = {p.name.split("-")[1] for p in (CACHE_DIR / "statcounter").glob(f"search-*-{UNTIL}.csv")}
    codes = sorted(({c.alpha_2 for c in pycountry.countries} | {"XK"}) & have - SKIP)
    pop = wpp.demographic(["TPopulation1July"], last_year=2024)["TPopulation1July"]
    out, small = [], []
    for cc in codes:
        iso = from_alpha2(cc)
        if not iso:
            print(f"    StatCounter 的 {cc} 對不到地圖代碼，不畫")
        elif pop.get(iso, {}).get(2024, 0) < MIN_POP:
            small.append(iso)
        else:
            out.append((cc, iso))
    print(f"    人口不到 5,000 或 WPP 沒有，不畫：{'、'.join(small)}")
    return out


def build() -> None:
    regions = _regions()
    years = list(range(2009, int(UNTIL[:4]) + 1))
    leaders: dict[str, dict[str, list]] = {s: {} for s in CATEGORY}
    gap: dict[str, list] = {}
    latest_leaders: dict[str, dict[str, int]] = {s: defaultdict(int) for s in CATEGORY}
    for cc, iso in regions:
        detail: dict[str, object] = {"month": UNTIL}
        for stat in CATEGORY:
            months = _monthly(stat, cc)
            annual = _annual(months)
            row = []
            for y in years:
                if y not in annual:
                    row.append(None)
                    continue
                row.append(CATEGORY[stat].get(_leader(annual[y]), OTHER[stat]))
            if any(v is not None for v in row):
                leaders[stat][iso] = row
            if UNTIL in months:
                latest_leaders[stat][_leader(months[UNTIL])] += 1
            if stat == "os":
                g = [round(annual[y].get("iOS", 0) - annual[y].get("Android", 0), 2) if y in annual else None for y in years]
                if any(v is not None for v in g):
                    gap[iso] = g
            # 側欄
            last = months.get(UNTIL)
            block: dict[str, object] = {}
            if last:
                ranked = sorted(((b, v) for b, v in last.items() if b != "Other"), key=lambda x: -x[1])
                bars = [[b, round(v, 2)] for b, v in ranked[:PANEL_BARS] if v > 0]
                rest = round(100 - sum(v for _, v in bars), 2)
                block["latest"] = bars + ([["", rest]] if rest >= 0.01 else [])
            peaks = {b: max(annual[y].get(b, 0) for y in annual) for b in {b for v in annual.values() for b in v}} if annual else {}
            lines = sorted((b for b, p in peaks.items() if p >= PANEL_MIN and b != "Other"), key=lambda b: -peaks[b])[:PANEL_LINES]
            if lines:
                ys = sorted(annual)
                block["years"] = ys
                block["lines"] = [[b, [round(annual[y].get(b, 0), 1) for y in ys]] for b in lines]
            if block:
                detail[stat] = block
        write_json(OUT / "countries" / f"{iso}.json", detail)
    world = _annual(_monthly("os", "ww"))
    wgap = [round(world[y].get("iOS", 0) - world[y].get("Android", 0), 2) if y in world else None for y in years]
    for stat in CATEGORY:
        write_json(OUT / f"{stat}-leader.json", indicator_file(f"{stat}-leader", "", years, leaders[stat], **LICENSE))
    write_json(OUT / "ios-android.json", indicator_file("ios-android", "百分點", years, gap, aggregates={"WLD": wgap}, **LICENSE))
    print(f"  {len(regions)} 個地區；{UNTIL} 的第一名：")
    for stat, c in latest_leaders.items():
        print(f"    {stat}：" + "、".join(f"{b} {n}" for b, n in sorted(c.items(), key=lambda x: -x[1])))
    for stat in CATEGORY:
        y = years[-1]
        counts: dict[int, int] = defaultdict(int)
        for row in leaders[stat].values():
            if row[-1] is not None:
                counts[row[-1]] += 1
        print(f"    {stat} {y} 年平均的第一名（代碼:地區數）：{dict(sorted(counts.items()))}；非第一類的："
              + "、".join(f"{c}={row[-1]}" for c, row in leaders[stat].items() if row[-1] not in (None, 1))[:400])
    w = world[years[-1]]
    print(f"  全世界 {years[-1]}：iOS {w.get('iOS', 0):.2f}、Android {w.get('Android', 0):.2f}、Windows {w.get('Windows', 0):.2f}")
    top = sorted(((c, v[-1]) for c, v in gap.items() if v[-1] is not None), key=lambda x: -x[1])
    print("  iOS−Android 最高：" + "、".join(f"{c} {v:+.1f}" for c, v in top[:15]))
    print("  最低：" + "、".join(f"{c} {v:+.1f}" for c, v in top[-10:]))
    print("  " + "、".join(f"{c} {gap[c][-1]:+.1f}" for c in ("TWN", "USA", "JPN", "KOR", "CHN", "GBR", "AUS", "CAN", "DEU", "FRA", "IND", "BRA", "IDN") if c in gap))
