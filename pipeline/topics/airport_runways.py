"""跑道：條數、總長與 3,000 公尺以上的跑道（2026-11-05，製作手冊第二十三批 399；步驟 airport-runways，
輸出 topics/aviation/，擴充「機場與旅客」）。

- **跑道**：OurAirports 的 runways.csv（公有領域）依 airport_ref 對 airports.csv。OurAirports 的覆蓋嚴重偏向美國（不設條件
  時美國 1 萬 6 千條、中國 3 百多條，美國直接來自 FAA 登記簿），所以國家層級**只算有定期航班的機場**
  （scheduled_service = yes，排除直升機場、水上機場、氣球場與已關閉的機場）、跑道沒有關閉、有長度（英尺，換成公尺）。
  同一條跑道重複列的（嘉義有 18 與 18R、18L，「18」沒有長度）因為沒有長度自然不算；水上跑道（surface 是 WATER、
  代號像 09W）不算。軍民合用的機場（台中、嘉義、台南、
  花蓮、澎湖、松山）有定期航班，照算。
- **EXCLUDE**：OurAirports 標成有定期航班、其實已經停止民航的機場（屏東機場 2011-08-11 停止營運，民航局的表 72 附註）。
- **鋪面機場的比例**：OurAirports 的 surface 欄不是控制詞彙（實測六百多種寫法），不自己算，改用 CIA World Factbook
  2022-12-29 那一版（sources/factbook_2022.py）的「Airports - with paved／unpaved runways」：鋪面機場 ÷（鋪面＋未鋪面），
  多數是 2021 年。這是全部機場（含沒有定期航班的），跟跑道的口徑不同。
- **台灣的官方數字**：民航局「民航機場設施與能量（年資料）」（data.gov.tw 47490，政府資料開放授權條款第 1 版）索引 CSV
  指到的最新一年 ODS 表 72，17 座機場的跑道長寬、起降容量、營運中最大機型與進場燈光，放側欄。

輸出：runway-km.json（跑道總長，公里）、runways-3000.json（3,000 公尺以上的跑道條數）、paved-share.json（鋪面機場 %）、
runways.json（左側欄：有定期航班的機場與最長的跑道）、runways-tw.json（民航局的表）。
"""
from __future__ import annotations

import csv
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict

import pycountry

from common import OUT_DIR, download, indicator_file, points_file, write_json
from sources import factbook_2022

OUT = OUT_DIR / "topics" / "aviation"
AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"
RUNWAYS_URL = "https://davidmegginson.github.io/ourairports-data/runways.csv"
CAA_INDEX = "https://www.caa.gov.tw/FileAtt.ashx?lang=1&id=34967"
YEAR = 2026
FT = 0.3048
LONG_M = 3000
NOT_AIRPORTS = {"heliport", "seaplane_base", "balloonport", "closed"}
EXCLUDE = {"RCSQ"}  # 屏東機場：OurAirports 還標有定期航班，2011-08-11 已停止營運
_T = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
_P = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}p"


def _iso3(alpha2: str) -> str | None:
    if alpha2 == "XK":
        return "XKX"
    c = pycountry.countries.get(alpha_2=alpha2)
    return c.alpha_3 if c else None


def _runways() -> tuple[dict[str, list], list[list]]:
    """{ISO3: [(公尺, 機場 ident), …]} 與左側欄的機場列"""
    airports = {}
    with open(download(AIRPORTS_URL, "ourairports", "airports.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["scheduled_service"] == "yes" and r["type"] not in NOT_AIRPORTS and r["ident"] not in EXCLUDE:
                airports[r["id"]] = r
    by_airport: dict[str, list] = defaultdict(list)
    with open(download(RUNWAYS_URL, "ourairports", "runways.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            water = r["surface"].strip().upper().startswith("WAT") or r["le_ident"].endswith("W")
            if r["airport_ref"] in airports and r["closed"] != "1" and r["length_ft"] not in ("", "0") and not water:
                by_airport[r["airport_ref"]].append(r)
    by_country: dict[str, list] = defaultdict(list)
    rows = []
    for aid, runways in by_airport.items():
        a = airports[aid]
        iso3 = _iso3(a["iso_country"])
        if not iso3:
            continue
        for r in runways:
            by_country[iso3].append(float(r["length_ft"]) * FT)
        top = max(runways, key=lambda r: float(r["length_ft"]))
        ident = "/".join(x for x in (top["le_ident"], top["he_ident"]) if x)
        rows.append([
            round(float(a["longitude_deg"]), 4), round(float(a["latitude_deg"]), 4), a["name"], a["iata_code"],
            a["icao_code"] or a["ident"], iso3, round(float(top["length_ft"]) * FT), ident, top["surface"].strip().upper(),
            1 if top["lighted"] == "1" else 0, len(runways),
        ])
    rows.sort(key=lambda r: -r[6])
    return by_country, rows


def _paved_share() -> tuple[dict[str, list], dict[str, int]]:
    """Factbook 2022 年版：鋪面機場 ÷（鋪面＋未鋪面）×100，與資料年份"""
    out, years = {}, {}
    for iso3, t in factbook_2022.transportation().items():
        paved = t.get("Airports - with paved runways", {}).get("total", {})
        unpaved = t.get("Airports - with unpaved runways", {}).get("total", {})
        p, py = factbook_2022.number(paved.get("text") if isinstance(paved, dict) else None)
        u, uy = factbook_2022.number(unpaved.get("text") if isinstance(unpaved, dict) else None)
        if p is None and u is None:
            continue
        total = (p or 0) + (u or 0)
        if total == 0:
            continue
        out[iso3] = [round((p or 0) / total * 100, 1)]
        # 年份寫在每一段的最後一格（例如 under 914 m 的「2 (2021)」）
        texts = [v.get("text", "") for k in ("Airports - with paved runways", "Airports - with unpaved runways")
                 for v in t.get(k, {}).values() if isinstance(v, dict)]
        ys = [y for x in texts if (y := factbook_2022.number(x)[1])]
        years[iso3] = max(ys) if ys else 2021
    return out, years


def _ods_rows(path) -> list[list[str]]:
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("content.xml"))
    table = next(root.iter(_T + "table"))
    rows = []
    for row in table.iter(_T + "table-row"):
        cells: list[str] = []
        for cell in row:
            n = min(int(cell.get(_T + "number-columns-repeated", "1")), 32)
            cells.extend([" ".join("".join(p.itertext()) for p in cell.iter(_P)).strip()] * n)
        rows.append(cells)
    return rows


def _num(text: str) -> float | None:
    m = re.fullmatch(r"[\d,]+", text.strip())
    return float(text.replace(",", "")) if m else None


def taiwan_caa() -> dict:
    """民航局表 72：{year, airports: [[機場, 性質, [[跑道代號或空字串, 長, 寬, 起降容量], …], 最大機型, 進場燈光]]}"""
    index = download(CAA_INDEX, "caa", "facilities-index.csv").read_text(encoding="utf-8-sig")
    rows = list(csv.DictReader(index.splitlines()))
    latest = rows[0]
    roc = int(re.match(r"(\d+)", latest["版本"]).group(1))
    path = download(latest["路徑"], "caa", f"facilities-{roc}.ods")
    airports, cur = [], None
    for r in _ods_rows(path):
        r = (r + [""] * 20)[:20]
        if r[0].startswith("資料來源"):
            break  # 後面是附註（「2.桃園、高雄2機場…」也是數字開頭，不是機場）
        m = re.match(r"\d+\.\s*(.+)", r[0])
        if m:
            cur = {"name": m.group(1).replace(" ", ""), "kind": r[1], "runways": [], "aircraft": r[5], "approach": []}
            airports.append(cur)
            if _num(r[2]):
                cur["runways"].append(["", _num(r[2]), _num(r[3]), r[4]])
        elif cur is None:
            continue
        if not m:
            if re.fullmatch(r"\d{2}[LRC]?/\d{2}[LRC]?", r[2]):
                cur["runways"].append([r[2], None, None, ""])
            elif _num(r[2]) and cur["runways"] and cur["runways"][-1][1] is None:
                cur["runways"][-1][1:4] = [_num(r[2]), _num(r[3]), r[4]]
            if r[5] and not cur["aircraft"]:
                cur["aircraft"] = r[5]
        if r[15] and r[15] != "-":
            cur["approach"].append(r[15])
    out = [[a["name"], a["kind"], a["runways"], a["aircraft"], "、".join(a["approach"])] for a in airports]
    return {"year": roc + 1911, "source": latest["路徑"], "airports": out}


def build() -> None:
    by_country, rows = _runways()
    km = {c: [round(sum(v) / 1000, 1)] for c, v in by_country.items()}
    long_ = {c: [sum(1 for m in v if m >= LONG_M)] for c, v in by_country.items()}
    write_json(OUT / "runway-km.json", indicator_file("runway-km", "公里", [YEAR], km))
    write_json(OUT / "runways-3000.json", indicator_file("runways-3000", "條", [YEAR], long_))
    fields = ["lon", "lat", "name", "iata", "icao", "iso3", "m", "rwy", "surface", "lit", "n"]
    write_json(OUT / "runways.json", points_file(
        [dict(zip(fields, r)) for r in rows], fields, {"lon": 0.001, "lat": 0.001, "m": 1, "lit": 1, "n": 1},
        strings=["surface", "iso3"]))
    paved, years = _paved_share()
    hints = {c: f"{y} 年" for c, y in years.items() if y != 2021}
    hints_en = {c: str(y) for c, y in years.items() if y != 2021}
    write_json(OUT / "paved-share.json", indicator_file(
        "paved-share", "%", [2021], paved, hints=hints, hintsEn=hints_en))
    tw = taiwan_caa()
    write_json(OUT / "runways-tw.json", tw)

    total = sum(len(v) for v in by_country.values())
    print(f"  有定期航班的機場 {len(rows)} 座、跑道 {total} 條、總長 {sum(sum(v) for v in by_country.values()) / 1000:,.0f} 公里，{len(km)} 國")
    for c in ("USA", "CHN", "CAN", "RUS", "AUS", "IND", "JPN", "TWN", "KOR", "SGP", "HKG", "IRN", "TUR"):
        print(f"  {c} {len(by_country.get(c, []))} 條、{km.get(c, [0])[0]} 公里、3,000 m 以上 {long_.get(c, [0])[0]}；鋪面 {paved.get(c)}")
    print(f"  鋪面比例 {len(paved)} 國；最低 {sorted(paved.items(), key=lambda kv: kv[1][0])[:6]}；不是 2021 年的 {hints}")
    print(f"  民航局 {tw['year']} 年 {len(tw['airports'])} 座：{[(a[0], a[2]) for a in tw['airports'][:3]]}")
