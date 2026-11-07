"""機場與旅客的擴充：跑道有沒有燈、關閉與廢棄的機場、飛機靠什麼導航（2026-11-07，製作手冊第二十七批 569，
候選 1284、1285、1287；步驟 airport-navaids，輸出 topics/aviation/）。

資料都是 OurAirports（公有領域），經 GitHub Pages 的鏡像（ourairports.com 本站從 cloud 連不上，手冊的提醒）。
- **跑道有沒有燈**：runways.csv 的 `lighted`，口徑跟第二十三批 399（airport_runways.py）一樣：只算有定期航班的機場
  （scheduled_service = yes、不是直升機場等、不在 EXCLUDE）、沒有關閉、有長度、不是水上跑道。`lighted` 只認 0 與 1，
  空值不當 0（手冊的陷阱；2026-11 的檔沒有空值）。跑道不到 MIN_RUNWAYS 條的國家不畫（一兩條就是 0% 或 100%）。
  手冊數的是含已關閉跑道、含有定期航班的直升機場與水上機場（全球 5,731 條、台灣 20 條），這裡跟 399 的跑道總長同一個口徑
  （全球 5,343 條、台灣 18 條，屏東機場不算）。
- **關閉與廢棄的機場**：airports.csv 的 `type = closed`，點圖層（美國占一半以上、來自 FAA 匯入，國家比較沒有意義，手冊的陷阱）；
  國家的數字只寫在 tooltip，不上色。沒有關閉日期，沒有時間軸。
- **導航台**：navaids.csv（NDB、VOR、VOR-DME、VORTAC、TACAN、DME、NDB-DME），點依種類上色，各國座數畫比例圓。
  沒有 ILS；NDB 正在大量除役，這是 2026-11-07 的快照；軍用的 TACAN 也在裡面。
"""
from __future__ import annotations

import csv
from collections import Counter, defaultdict

from common import OUT_DIR, download, indicator_file, points_file, write_json
from topics.airport_runways import AIRPORTS_URL, EXCLUDE, NOT_AIRPORTS, RUNWAYS_URL, _iso3

OUT = OUT_DIR / "topics" / "aviation"
NAVAIDS_URL = "https://davidmegginson.github.io/ourairports-data/navaids.csv"
YEAR = 2026
MIN_RUNWAYS = 5
# 導航台的種類（前端 aviation-navaids.ts 的 NAVAID_TYPES 要一致）
NAVAID_TYPES = {"NDB": 1, "NDB-DME": 2, "VOR": 3, "VOR-DME": 4, "VORTAC": 5, "TACAN": 6, "DME": 7}


def _lighting() -> tuple[dict[str, int], dict[str, int]]:
    airports = {}
    with open(download(AIRPORTS_URL, "ourairports", "airports.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["scheduled_service"] == "yes" and r["type"] not in NOT_AIRPORTS and r["ident"] not in EXCLUDE:
                airports[r["id"]] = r
    lit, total = Counter(), Counter()
    with open(download(RUNWAYS_URL, "ourairports", "runways.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            water = r["surface"].strip().upper().startswith("WAT") or r["le_ident"].endswith("W")
            if (r["airport_ref"] in airports and r["closed"] != "1" and r["length_ft"] not in ("", "0") and not water
                    and r["lighted"] in ("0", "1")):
                iso3 = _iso3(airports[r["airport_ref"]]["iso_country"])
                if iso3:
                    total[iso3] += 1
                    lit[iso3] += r["lighted"] == "1"
    return lit, total


def build() -> None:
    lit, total = _lighting()
    share, hints, hints_en, nv, nv_en = {}, {}, {}, {}, {}
    for c in sorted(total):
        hints[c] = f"有定期航班的機場 {total[c]} 條跑道裡 {lit[c]} 條有燈"
        hints_en[c] = f"{lit[c]} of {total[c]} runways at airports with scheduled flights are lighted"
        if total[c] >= MIN_RUNWAYS:
            share[c] = [round(lit[c] / total[c] * 100, 1)]
        else:
            nv[c] = f"只有 {total[c]} 條跑道，不畫"
            nv_en[c] = f"Only {total[c]} {'runway' if total[c] == 1 else 'runways'}, so not shown"
    write_json(OUT / "runway-lit.json", indicator_file(
        "runway-lit", "%", [YEAR], share, hints=hints, hintsEn=hints_en, noValue=nv, noValueEn=nv_en))

    closed, closed_count = [], Counter()
    with open(download(AIRPORTS_URL, "ourairports", "airports.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            iso3 = _iso3(r["iso_country"])
            if r["type"] != "closed" or not iso3:
                continue
            closed_count[iso3] += 1
            closed.append({"lon": round(float(r["longitude_deg"]), 3), "lat": round(float(r["latitude_deg"]), 3),
                           "name": r["name"].strip(), "iso3": iso3})
    write_json(OUT / "closed-airports.json", points_file(
        closed, ["lon", "lat", "name", "iso3"], {"lon": 0.001, "lat": 0.001}, strings=["iso3"]))
    write_json(OUT / "closed-airports-count.json", indicator_file(
        "closed-airports", "座", [YEAR], {c: [n] for c, n in sorted(closed_count.items())}))

    navaids, nav_count = [], Counter()
    by_type: dict[str, Counter] = defaultdict(Counter)
    with open(download(NAVAIDS_URL, "ourairports", "navaids.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            iso3 = _iso3(r["iso_country"])
            t = NAVAID_TYPES.get(r["type"])
            if not iso3 or not t or not r["latitude_deg"]:
                continue
            nav_count[iso3] += 1
            by_type[iso3][r["type"]] += 1
            khz = float(r["frequency_khz"]) if r["frequency_khz"] else None
            navaids.append({"lon": round(float(r["longitude_deg"]), 3), "lat": round(float(r["latitude_deg"]), 3),
                            "id": r["ident"], "name": r["name"].strip(), "t": t,
                            "f": round(khz / 1000, 2) if khz and khz >= 10000 else khz, "iso3": iso3})
    write_json(OUT / "navaids.json", points_file(
        navaids, ["lon", "lat", "id", "name", "t", "f", "iso3"], {"lon": 0.001, "lat": 0.001, "t": 1, "f": 0.01},
        strings=["iso3"]))
    nh = {c: "、".join(f"{k} {v}" for k, v in by_type[c].most_common()) for c in by_type}
    write_json(OUT / "navaids-count.json", indicator_file(
        "navaids", "座", [YEAR], {c: [n] for c, n in sorted(nav_count.items())}, hints=nh, hintsEn=nh))

    print(f"  跑道照明：全球 {sum(total.values()):,} 條、有燈 {sum(lit.values()):,}（{sum(lit.values()) / sum(total.values()):.1%}），"
          f"上色 {len(share)} 國")
    for c in ("KOR", "JPN", "FRA", "USA", "NGA", "TWN", "IND", "RUS", "CHN", "DEU", "GBR", "ETH", "IDN", "PNG", "BRA"):
        print(f"    {c} {lit[c]}/{total[c]} {share.get(c)}")
    print(f"  關閉的機場 {len(closed):,} 座：{closed_count.most_common(12)}；TWN {closed_count['TWN']}、KOR {closed_count['KOR']}、CHN {closed_count['CHN']}")
    print(f"  導航台 {len(navaids):,} 座、{len(nav_count)} 國：{nav_count.most_common(12)}；TWN {nav_count['TWN']} {nh.get('TWN')}")
