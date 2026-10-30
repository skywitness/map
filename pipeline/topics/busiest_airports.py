"""最繁忙的機場（交通主題的擴充，2026-10-30）：2020–2025 每一年旅客量前 50 名的機場，畫成比例圓；國家的值是前 50 名機場的旅客合計。

使用者決定（2026-10-30，製作手冊第九十六節）：照候選清單，2020–2025 年（2019 年以前在別的子條目，不做）。

**資料**：英文維基百科「List of busiest airports by passenger traffic」固定版本 REVISION（CC BY-SA 4.0，衍生的資料檔依同一授權分享）：
2025、2024…2020 各一張前 50 名表（Rank、Airport、Location、Country、Code (IATA/ICAO)、Total passengers…），數字引 ACI 的初步統計
（各機場自己公布的可能不同）；ACI World 網站本身的條款是 All rights reserved，不用。同名次的機場依表上的順序。
機場的座標用 OurAirports（公有領域），依表上的 IATA 代碼對；國家依座標（geoindex）。

**輸出**（public/data/topics/transport/）：busiest-airports.json（點：IATA、英文名稱、國家、每一年的旅客與名次 p2020…p2025、r2020…r2025）、
busiest-passengers.json（國家的指標：這一年前 50 名機場的旅客合計）。
"""
from __future__ import annotations

import csv
import re
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, points_file, write_json
from geoindex import country_at
from sources import wikitable as W

OUT = OUT_DIR / "topics" / "transport"
PAGE = "List of busiest airports by passenger traffic"
REVISION = 1381104599  # 2026-10-20T01:36
YEARS = list(range(2020, 2026))
AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"


def _coords() -> dict[str, tuple[float, float]]:
    out: dict[str, tuple[float, float]] = {}
    with open(download(AIRPORTS_URL, "ourairports", "airports.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["iata_code"] and r["type"] != "closed" and (r["iata_code"] not in out or r["type"] == "large_airport"):
                out[r["iata_code"]] = (float(r["longitude_deg"]), float(r["latitude_deg"]))
    return out


def build() -> None:
    wikitext = W.fetch(PAGE, REVISION, "busiest-airports")
    heads = {m.group(1).strip(): m.end() for m in re.finditer(r"^=+\s*(.*?)\s*=+\s*$", wikitext, re.M)}
    coords = _coords()
    airports: dict[str, dict] = {}
    for year in YEARS:
        rows = W.rows(W.tables(wikitext[heads[f"{year} statistics"]:])[0])
        assert len(rows) == 50, (year, len(rows))
        for rank, r in enumerate(rows, 1):
            code = W.text(r[4]).split("/")[0].strip()
            pax = int(re.sub(r"[^\d]", "", W.text(r[5])))
            a = airports.setdefault(code, {"iata": code, "en": W.text(r[1]), "years": {}})
            a["years"][year] = (pax, int(re.sub(r"\D", "", W.text(r[0])) or rank))
    rows_out = []
    by_country: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for code, a in airports.items():
        lon, lat = coords[code]
        iso3 = country_at(lon, lat)
        row: dict[str, object] = {"lon": lon, "lat": lat, "iata": code, "en": a["en"], "iso3": iso3}
        for y in YEARS:
            pax, rank = a["years"].get(y, (None, None))
            row[f"p{y}"], row[f"r{y}"] = pax, rank
            if pax:
                by_country[iso3][y] += pax
        rows_out.append(row)
    rows_out.sort(key=lambda r: r["lon"])
    fields = ["lon", "lat", "iata", "en", "iso3"] + [f"p{y}" for y in YEARS] + [f"r{y}" for y in YEARS]
    scale = {"lon": 0.001, "lat": 0.001} | {f"p{y}": 1 for y in YEARS} | {f"r{y}": 1 for y in YEARS}
    write_json(OUT / "busiest-airports.json", points_file(rows_out, fields, scale, delta=("lon",), strings=("iso3",)))
    values = {c: [ys.get(y) for y in YEARS] for c, ys in by_country.items()}
    notes = {
        "TWN": "台灣桃園國際機場 2025 年 4,780 萬人次，第 48 名（2020–2024 年都不在前 50 名）；台灣各機場的旅客見民航局的統計。",
    }
    notes_en = {
        "TWN": "Taiwan Taoyuan International Airport handled 47.8 million passengers in 2025, ranking 48th (outside the top 50 in 2020–2024); see the Civil Aeronautics Administration for all of Taiwan’s airports.",
    }
    write_json(OUT / "busiest-passengers.json", indicator_file(
        "busiest-passengers", "人次", YEARS, values,
        aggregates={"WLD": [sum(a["years"][y][0] for a in airports.values() if y in a["years"]) for y in YEARS]},
        notes=notes, notesEn=notes_en))
    top = sorted(((a["years"][2025][0], c) for c, a in airports.items() if 2025 in a["years"]), reverse=True)[:5]
    print(f"  {len(airports)} 座機場出現在 {YEARS[0]}–{YEARS[-1]} 的前 50 名；2025 年前 5：{top}")
    print(f"  台灣：{ {y: airports['TPE']['years'].get(y) for y in YEARS} }")
    print(f"  國家（2025）：{sorted(((v[-1] or 0, c) for c, v in values.items()), reverse=True)[:6]}")


if __name__ == "__main__":
    build()
