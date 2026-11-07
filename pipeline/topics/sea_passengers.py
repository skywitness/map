"""航運與港口的擴充：海運旅客——渡輪、郵輪與國內客船（2026-11-07，製作手冊第二十七批 581，候選 1299；步驟 sea-passengers，
輸出 topics/shipping/）。

- Eurostat `mar_mp_aa_cphd`（海運旅客，千人次，direct = TOTAL 是上船加下船，同一個人會算兩次，說明寫明；1997–2024）與
  `mar_mt_am_csvi`（靠港船舶依船種，ODC_PCRU 郵輪的艘次），CC BY 4.0。維度是 rep_mar 不是 geo，自己讀檔。英國不收。
- 台灣：臺灣港務公司「臺灣地區國際商港旅客人數」（政府資料開放平臺 8366，`fapi/opendata?id=13879`，跟 cruise.py 共用快取），
  每月、各港的郵輪母港、郵輪掛靠港、國際渡輪、兩岸渡輪、國內客船的艘次與人次；加總成全年（只收 12 個月都有的年份）。
  港務公司的人次也是進出港合計，跟 Eurostat 的 TOTAL 口徑接近，畫上地圖並在 tooltip 註明來源；郵輪的艘次用母港加掛靠港。
"""
from __future__ import annotations

import csv
import gzip
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "shipping"
TWPORT = "https://www.twport.com.tw/fapi/opendata?id=13879&format=csv"
TW_KINDS = [("cruise-home", "郵輪母港"), ("cruise-call", "郵輪掛靠港"), ("ferry-intl", "國際渡輪"), ("ferry-strait", "兩岸渡輪"),
            ("domestic", "國內客船")]


def _load(dataset: str) -> tuple[dict[tuple[str, ...], dict[int, float]], list[int]]:
    path = download(eurostat.URL.format(dataset=dataset), "eurostat", f"{dataset}.tsv.gz")
    out = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        dims = header[0].split("\\")[0].split(",")
        years = [int(h) for h in header[1:]]
        for line in f:
            cells = line.rstrip("\n").split("\t")
            key = dict(zip(dims, cells[0].split(",")))
            geo = key["rep_mar"]
            iso3 = None if eurostat.noncommercial(geo) else eurostat._iso3(geo)
            if not iso3 and geo != "EU27_2020":
                continue
            values = {}
            for y, cell in zip(years, cells[1:]):
                number = cell.strip().split(" ")[0]
                if number not in (":", ""):
                    values[y] = float(number)
            out[tuple(key[d] for d in dims if d not in ("freq", "rep_mar")) + (iso3 or geo,)] = values
    return out, years


def _taiwan() -> dict[int, dict[str, list[float]]]:
    """{西元年: {種類: [艘次, 人次]}}，只收 12 個月都有的年份"""
    rows = list(csv.DictReader(open(download(TWPORT, "twport", "passengers.csv"), encoding="utf-8-sig")))
    out: dict[int, dict[str, list[float]]] = defaultdict(lambda: {k: [0.0, 0.0] for k, _ in TW_KINDS})
    months: dict[int, set] = defaultdict(set)
    for r in rows:
        ym = r["年月"].strip()
        y, m = int(ym[:-2]) + 1911, ym[-2:]
        months[y].add(m)
        for key, name in TW_KINDS:
            out[y][key][0] += float(r[f"國際商港{name}艘次"] or 0)
            out[y][key][1] += float(r[f"國際商港{name}人次"] or 0)
    return {y: v for y, v in out.items() if len(months[y]) == 12}


def build() -> None:
    pas, years = _load("mar_mp_aa_cphd")
    ves, vyears = _load("mar_mt_am_csvi")
    tw = _taiwan()
    note = ("臺灣港務公司的國際商港旅客人次（進出港合計，政府資料開放平臺 8366）", "Taiwan International Ports Corporation, passengers at international commercial ports (arrivals plus departures; data.gov.tw 8366)")
    passengers = {c: s for (unit, direct, c), s in pas.items() if unit == "THS_PAS" and direct == "TOTAL" and c != "EU27_2020"}
    passengers["TWN"] = {y: sum(v[1] for v in k.values()) / 1000 for y, k in tw.items()}
    write_json(OUT / "sea-passengers.json", indicator_file(
        "sea-passengers", "千人次", years + [y for y in sorted(tw) if y > years[-1]],
        {c: [round(s[y], 1) if y in s else None for y in years + [y for y in sorted(tw) if y > years[-1]]] for c, s in sorted(passengers.items())},
        hints={"TWN": note[0]}, hintsEn={"TWN": note[1]}, license="CC BY 4.0"))
    cruise = {c: s for (unit, vessel, c), s in ves.items() if unit == "NR" and vessel == "ODC_PCRU" and c != "EU27_2020"}
    cruise["TWN"] = {y: k["cruise-home"][0] + k["cruise-call"][0] for y, k in tw.items()}
    cyears = sorted({y for s in cruise.values() for y in s})
    write_json(OUT / "cruise-calls.json", indicator_file(
        "cruise-calls", "艘次", cyears, {c: [s.get(y) for y in cyears] for c, s in sorted(cruise.items())},
        hints={"TWN": "臺灣港務公司的郵輪母港加掛靠港艘次"}, hintsEn={"TWN": "Taiwan International Ports Corporation: cruise home-port plus port-of-call calls"},
        license="CC BY 4.0"))
    tw_years = sorted(tw)
    write_json(OUT / "sea-passengers-tw.json", {
        "years": tw_years, "kinds": [k for k, _ in TW_KINDS],
        "calls": [[round(tw[y][k][0]) for k, _ in TW_KINDS] for y in tw_years],
        "people": [[round(tw[y][k][1]) for k, _ in TW_KINDS] for y in tw_years], "license": "政府資料開放授權條款"})

    eu = pas.get(("THS_PAS", "TOTAL", "EU27_2020"), {})
    print(f"  EU27 海運旅客 2024 {eu.get(2024)} 千人次；郵輪 {ves.get(('NR', 'ODC_PCRU', 'EU27_2020'), {}).get(2024)} 艘次")
    print(f"  2024：{sorted(((s.get(2024, 0), c) for c, s in passengers.items()), reverse=True)[:10]}")
    print(f"  台灣 {tw_years[0]}–{tw_years[-1]}：2025 {tw.get(2025)}；2019 人次 {sum(v[1] for v in tw[2019].values()) if 2019 in tw else None}")
