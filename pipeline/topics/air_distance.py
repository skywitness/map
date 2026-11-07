"""航線與航空公司的擴充：飛多遠、搭什麼機型（2026-11-07，製作手冊第二十七批 572，候選 1289；步驟 air-distance，
輸出 topics/aviation/，航線與航空公司的 dataTopic）。

- Eurostat `avia_paodis`（機上旅客 PAS_BRD，依航程級距 × 機型，tra_cov = TOTAL，2008–2024，CC BY 4.0）。
  每個國家各級距、各機型占全部機上旅客的比例；側欄是人次。
- 機型代碼的名稱照 Eurostat 代碼表 AIRCRAFT（https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/codelist/ESTAT/AIRCRAFT）：
  AC_NJ Narrow-body jet、AC_WJ Wide-body jet、AC_JJ Jumbo jet、AC_RJ Regional jet、AC_RT Regional turboprop、OTH Other、
  UNK Unknown（手冊的提醒：讀 metadata 再寫，不憑記憶翻譯）。距離是大圓距離的級距（DISTANCE 代碼表）。
- 英國照 sources/eurostat.py 不收；台灣沒有。
"""
from __future__ import annotations

import gzip

from common import OUT_DIR, download, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "aviation"
DISTANCES = {"KM_LT300": "lt300", "KM300-499": "300-499", "KM500-999": "500-999", "KM1000-1499": "1000-1499",
             "KM1500-1999": "1500-1999", "KM_GE2000": "ge2000"}
AIRCRAFT = {"AC_NJ": "narrow", "AC_WJ": "wide", "AC_JJ": "jumbo", "AC_RJ": "regional-jet", "AC_RT": "turboprop",
            "OTH": "other", "UNK": "unknown"}
MAP_AIRCRAFT = ["narrow", "wide", "jumbo", "regional-jet", "turboprop"]


def build() -> None:
    path = download(eurostat.URL.format(dataset="avia_paodis"), "eurostat", "avia_paodis.tsv.gz")
    data: dict[tuple[str, str, str], dict[int, float]] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        dims = header[0].split("\\")[0].split(",")
        years = [int(h) for h in header[1:]]
        for line in f:
            cells = line.rstrip("\n").split("\t")
            key = dict(zip(dims, cells[0].split(",")))
            if key["tra_cov"] != "TOTAL" or key["tra_meas"] != "PAS_BRD":
                continue
            if key["aircraft"] != "TOTAL" and key["distance"] != "TOTAL":
                continue
            iso3 = eurostat._iso3(key["geo"])
            if not iso3 or eurostat.noncommercial(key["geo"]):
                continue
            values = {}
            for y, cell in zip(years, cells[1:]):
                number = cell.strip().split(" ")[0]
                if number not in (":", ""):
                    values[y] = float(number)
            data[(iso3, key["aircraft"], key["distance"])] = values
    countries = sorted({c for c, _, _ in data})
    total = {c: data.get((c, "TOTAL", "TOTAL"), {}) for c in countries}

    def share_files(folder: str, codes: dict[str, str], part) -> None:
        for code, item in codes.items():
            values = {}
            for c in countries:
                t, s = total[c], part(c, code)
                row = [round(s[y] / t[y] * 100, 2) if y in s and t.get(y) else None for y in years]
                if any(v is not None for v in row):
                    values[c] = row
            write_json(OUT / folder / f"{item}.json", indicator_file(f"{folder}-{item}", "%", years, values, license="CC BY 4.0"))

    share_files("flight-distance", DISTANCES, lambda c, code: data.get((c, "TOTAL", code), {}))
    share_files("aircraft-type", {k: v for k, v in AIRCRAFT.items() if v in MAP_AIRCRAFT}, lambda c, code: data.get((c, code, "TOTAL"), {}))
    detail = {}
    for c in countries:
        row = {"t": [total[c].get(y) for y in years],
               "d": {item: [data.get((c, "TOTAL", code), {}).get(y) for y in years] for code, item in DISTANCES.items()},
               "a": {item: [data.get((c, code, "TOTAL"), {}).get(y) for y in years] for code, item in AIRCRAFT.items()}}
        detail[c] = row
    write_json(OUT / "air-distance-detail.json", {"years": years, "countries": detail, "license": "CC BY 4.0"})

    for c in ("ESP", "GRC", "NOR", "IRL", "TUR", "FRA", "DEU"):
        y = 2024
        t = total[c].get(y)
        print(f"  {c} {y} 機上旅客 {t:,.0f}；<300 km {data.get((c, 'TOTAL', 'KM_LT300'), {}).get(y)}；"
              f"螺旋槳 {data.get((c, 'AC_RT', 'TOTAL'), {}).get(y)}；廣體 {data.get((c, 'AC_WJ', 'TOTAL'), {}).get(y)}")
    lt = sorted(((data.get((c, 'TOTAL', 'KM_LT300'), {}).get(2024, 0) / total[c][2024] * 100, c) for c in countries if total[c].get(2024)), reverse=True)
    rt = sorted(((data.get((c, 'AC_RT', 'TOTAL'), {}).get(2024, 0) / total[c][2024] * 100, c) for c in countries if total[c].get(2024)), reverse=True)
    print(f"  不到 300 km 的比例：{[(c, round(v, 2)) for v, c in lt[:8]]}")
    print(f"  螺旋槳的比例：{[(c, round(v, 2)) for v, c in rt[:8]]}")
