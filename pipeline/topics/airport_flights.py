"""機場與旅客的擴充：每個月飛了幾班——航班架次與 COVID（2026-11-07，製作手冊第二十七批 571，候選 1288；
步驟 airport-flights，輸出 topics/aviation/）。

- Eurostat `avia_tf_cm`（各申報國的商業航班架次，**每月**，2019-01 起，CC BY 4.0）：schedule = TOTAL／SCHED／NSCHED
  三個子項目（TOTAL 含非定期的商務機、貨機，手冊的陷阱，所以定期另外做），unit = NR；「比 2019 年同月」用資料集自帶的
  PCH_SM_19（TOTAL）。時間軸是月份：年份欄位存「2000 年 1 月起的第幾個月」（跟各國在讀什麼一樣，reads.month_index）。
  英國照 sources/eurostat.py 不收（英國 2026 年 9 月 181,604 架次只寫在說明）。
- 台灣：交通部民用航空局「民航運輸各機場營運量－按機場分」（data.gov.tw 31915，政府資料開放授權條款第 1 版；
  索引 CSV 指到最新的 ODS，cloud 下載得到，跟 map-plan 的 data/caa/ 同一個檔）的「總計」起降架次：2016 年起每年，
  加最近 13 個月。起降架次是起飛加降落、國內線在兩端各算一次，跟 Eurostat 的口徑不同，只放側欄、地圖不上色。
"""
from __future__ import annotations

import csv
import gzip
import re
from pathlib import Path

from common import OUT_DIR, download, indicator_file, write_json
from sources import eurostat
from sources.moe import _sheet_rows
from topics.reads import month_index

OUT = OUT_DIR / "topics" / "aviation"
CAA_INDEX = "https://www.caa.gov.tw/FileAtt.ashx?lang=1&id=30683"
ITEMS = {"TOTAL": "all", "SCHED": "scheduled", "NSCHED": "nonscheduled"}
TWN_NOTE = ("民航局的起降架次（起飛加降落）跟這裡的航班架次口徑不同，見側欄", "Taiwan’s CAA counts take-offs plus landings, a different measure; see the side panel")


def _eurostat() -> tuple[dict[tuple[str, str, str], dict[int, float]], list[int]]:
    """{(schedule, unit, geo): {月份編號: 值}} 與所有月份編號"""
    path = download(eurostat.URL.format(dataset="avia_tf_cm"), "eurostat", "avia_tf_cm.tsv.gz")
    out: dict[tuple[str, str, str], dict[int, float]] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        dims = header[0].split("\\")[0].split(",")
        months = []
        for h in header[1:]:
            y, m = h.strip().split("-")
            months.append(month_index(int(y), int(m)))
        for line in f:
            cells = line.rstrip("\n").split("\t")
            key = dict(zip(dims, cells[0].split(",")))
            values = {}
            for mi, cell in zip(months, cells[1:]):
                number = cell.strip().split(" ")[0]
                if number not in (":", ""):
                    values[mi] = float(number)
            out[(key["schedule"], key["unit"], key["geo"])] = values
    return out, months


def _taiwan() -> dict:
    with open(download(CAA_INDEX, "caa", "airport-ops-by-airport-index.csv"), encoding="utf-8-sig", newline="") as f:
        latest = next(csv.DictReader(f))
    file_id = re.search(r"id=(\d+)", latest["路徑"]).group(1)
    rows = _sheet_rows(Path(download(latest["路徑"], "caa", f"airport-ops-by-airport-{file_id}.ods")))
    annual: dict[int, int] = {}
    monthly: list[list] = []
    year = None
    last_month: dict[int, int] = {}
    for row in rows:
        label = str(row[0] or "").strip()
        if m := re.fullmatch(r"(\d+)年", label):
            year = int(m.group(1)) + 1911
            annual[year] = round(row[1])
        elif year and (m := re.fullmatch(r"(\d+)月", label)):
            month = int(m.group(1))
            last_month[year] = month
            monthly.append([month_index(year, month), round(row[1])])
    for y, month in last_month.items():
        if month != 12:
            annual.pop(y, None)  # 年份後面接的單月沒到 12 月：今年到最近一個月的累計，不是全年
    return {"version": latest["版本"], "annual": sorted([y, n] for y, n in annual.items() if y >= 2016), "monthly": monthly}


def build() -> None:
    data, months = _eurostat()
    for code, item in ITEMS.items():
        values = {}
        for (sch, unit, geo), s in data.items():
            if sch != code or unit != "NR":
                continue
            iso3 = eurostat._iso3(geo)
            if not iso3 or eurostat.noncommercial(geo):
                continue
            values[iso3] = [s.get(m) for m in months]
        write_json(OUT / "flights" / f"{item}.json", indicator_file(
            f"flights-{item}", "架次", months, dict(sorted(values.items())),
            noValue={"TWN": TWN_NOTE[0]}, noValueEn={"TWN": TWN_NOTE[1]}, license="CC BY 4.0"))
    vs = {}
    for (sch, unit, geo), s in data.items():
        if sch == "TOTAL" and unit == "PCH_SM_19":
            iso3 = eurostat._iso3(geo)
            if iso3 and not eurostat.noncommercial(geo):
                vs[iso3] = [s.get(m) for m in months]
    vs_months = [m for m in months if any(v[months.index(m)] is not None for v in vs.values())]
    write_json(OUT / "flights-vs-2019.json", indicator_file(
        "flights-vs-2019", "%", vs_months, {c: [v[months.index(m)] for m in vs_months] for c, v in sorted(vs.items())},
        noValue={"TWN": TWN_NOTE[0]}, noValueEn={"TWN": TWN_NOTE[1]}, license="CC BY 4.0"))
    tw = _taiwan()
    write_json(OUT / "flights-tw.json", tw)

    def at(geo: str, y: int, m: int, sch: str = "TOTAL", unit: str = "NR"):
        return data.get((sch, unit, geo), {}).get(month_index(y, m))
    print(f"  月份 {months[0]}–{months[-1]}（{len(months)} 個月）；比 2019 年同月 {vs_months[0]}–{vs_months[-1]}")
    print(f"  EU27 2019-04 {at('EU27_2020', 2019, 4)} → 2020-04 {at('EU27_2020', 2020, 4)}（{at('EU27_2020', 2020, 4, unit='PCH_SM_19')}%）"
          f" → 2026-09 {at('EU27_2020', 2026, 9)}；定期 {at('EU27_2020', 2026, 9, 'SCHED')}")
    print(f"  台灣 {tw['version']}：{tw['annual']}；最近 {tw['monthly'][-3:]}")
