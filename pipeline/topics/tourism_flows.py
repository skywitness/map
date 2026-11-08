"""觀光：旅客從哪裡來、往哪裡去（2026-11-04，製作手冊第二十一批 349）。

- 來的旅客：Eurostat `tour_occ_arnraw`（旅宿業的到達人次依旅客的居住國，CC BY 4.0），旅館、度假住宿與露營地合計
  （nace_r2 = I551-I553），36 個目的地國；來源只有 42 個有名字的國家，其餘歸到洲的「其他」，不畫。國外客合計是
  WORLD − DOM（WRL_NAL 是「沒有分配」的，不是國外客）。CH_LI（瑞士加列支敦斯登）算瑞士。這是旅宿登記的到達人次，
  一個人住兩家旅館算兩次，跟「國際旅客」（入境人次）口徑不同。
- 去的旅客：Eurostat `tour_dem_ttw`（本國居民一夜以上的旅次依主要目的地，全部目的；CC BY 4.0），29 個來源國，2012 年起。
- 台灣：交通部觀光署觀光統計資料庫的開放資料（政府資料開放授權條款）：/data/opendata/7「來臺旅客按居住地」
  （不是 /11 的國籍）與 /1「國人出國按首站抵達地」，2002 年起。「香港.澳門」合在一起，算香港；首站抵達地不是
  最終目的地（轉機的算第一站）。
- 歐洲以外（2026-11-08，製作手冊第二十七批 669）：OECD 觀光統計的入境旅客主要來源（TOP_MKT，過夜旅客，見 _oecd_visitors），
  日本、南韓、美國、加拿大、墨西哥、澳洲等；這是入境人次，跟 Eurostat 的旅宿到達人次口徑不同，總數用列出的來源加總。
- 輸出：flows/visitors/<年>.json（import：來源國）、flows/trips/<年>.json（export：目的地），每國前 15 個；
  foreign-arrivals.json（國外客的旅宿到達人次，台灣用來臺旅客人次）、outbound-trips.json（出國旅次，台灣用出國人次）、
  foreign-share.json（國外客占旅宿到達人次的比例，台灣沒有）。
"""
from __future__ import annotations

import csv
import gzip
import re
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, to_series, write_json
from sources.eurostat import _iso3, noncommercial

OUT = OUT_DIR / "topics" / "tourism"
URL = "https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/{}/?format=TSV&compressed=true"
TW_URL = "https://stat.taiwan.net.tw/data/opendata/{}"
FIRST = 2010
TOP_N = 15
TW_NAMES = {
    "Japan": "JPN", "Korea": "KOR", "HongKong. Macao": "HKG", "Hong Kong": "HKG", "China": "CHN", "Macao": "MAC",
    "Vietnam": "VNM", "Thailand": "THA", "Malaysia": "MYS", "Singapore": "SGP", "Philippines": "PHL", "Indonesia": "IDN",
    "Brunei": "BRN", "Cambodia": "KHM", "Myanmar": "MMR", "UAE": "ARE", "Turkey": "TUR", "India": "IND",
    "S. Africa": "ZAF", "USA": "USA", "Canada": "CAN", "Mexico": "MEX", "Argentina": "ARG", "Brazil": "BRA",
    "Australia": "AUS", "New Zealand": "NZL", "Palau": "PLW", "Belgium": "BEL", "France": "FRA", "Germany": "DEU",
    "Italy": "ITA", "Netherlands": "NLD", "U.K.": "GBR", "Spain": "ESP", "Sweden": "SWE", "Switzerland": "CHE",
    "Austria": "AUT", "Greece": "GRC", "Russian Federation": "RUS",
}


def eurostat(ds: str) -> tuple[list[str], list[int], list[tuple[dict[str, str], dict[int, float]]]]:
    """Eurostat 的 TSV：(維度, 年份, [(維度值, {年: 值})])；「:」與空白不收，旗標去掉"""
    path = download(URL.format(ds), "eurostat", f"{ds}.tsv.gz")
    with gzip.open(path, "rt", encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        dims = header[0].split("\\")[0].split(",")
        periods = [h.strip() for h in header[1:]]
        rows = []
        for line in f:
            cells = line.rstrip("\n").split("\t")
            key = dict(zip(dims, cells[0].split(",")))
            if "geo" in key and noncommercial(key["geo"]):  # 英國、科索沃只准非商業（網站的 Eurostat 規則）
                continue
            vals = {}
            for p, c in zip(periods, cells[1:]):
                v = c.strip().split(" ")[0]
                if v not in (":", ""):
                    vals[p] = float(v)
            rows.append((key, vals))
    return dims, periods, rows


def _geo(code: str) -> str | None:
    return "CHE" if code == "CH_LI" else _iso3(code)


def _taiwan(n: int) -> dict[str, dict[int, float]]:
    """觀光署開放資料：{iso3: {年: 人次}}，加上 '_TOTAL'（總計）"""
    path = download(TW_URL.format(n), "twtourism", f"od{n}.csv")
    rows = list(csv.reader(open(path, encoding="utf-8-sig")))
    years = [int(y) for y in rows[0][2:]]
    out: dict[str, dict[int, float]] = {}
    for r in rows[1:]:
        label = r[1].strip()
        en = re.sub(r"^[^A-Za-z]*", "", label).strip()
        key = "_TOTAL" if "Grand Total" in label else TW_NAMES.get(en)
        if not key:
            continue
        out[key] = {y: float(v.replace(",", "")) for y, v in zip(years, r[2:]) if v.strip() not in ("", "-")}
    return out


INBOUND = "OECD.CFE.TOU,DSD_TOURISM_INTER@DF_INBOUND,"


def _oecd_visitors(skip: set[str]) -> dict[int, dict[str, dict[str, float]]]:
    """OECD 觀光統計的入境旅客主要來源（MEASURE=TOP_MKT、VISITOR_TYPE=OVERNIGHT，OECD 資料條款可轉載改作）：
    {年: {目的地: {來源: 人}}}。同一國有需求面調查（TDS）與供給面統計（TSS）兩套、數字不同（土耳其 2024 年的德國客 649 萬對
    854 萬），每個目的地只用筆數多的那一套；來源的彙總代碼（A3、E_O、W 等）由 to_iso3 篩掉，CHE_LIE 算瑞士。
    skip 是已經有 Eurostat 或觀光署資料的目的地（歐洲與台灣），不重複。"""
    from sources import oecd
    from sources.countries import to_iso3

    raw: dict[str, dict[str, dict[int, dict[str, float]]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    for r in oecd.rows(INBOUND):
        if r["MEASURE"] != "TOP_MKT" or r["VISITOR_TYPE"] != "OVERNIGHT" or not r["OBS_VALUE"]:
            continue
        dest = to_iso3(r["REF_AREA"])
        origin = to_iso3("CHE" if r["COUNTERPART_AREA"] == "CHE_LIE" else r["COUNTERPART_AREA"])
        if not dest or not origin or dest in skip or origin == dest:
            continue
        raw[dest][r["SOURCE"]][int(r["TIME_PERIOD"][:4])][origin] = float(r["OBS_VALUE"]) * 10 ** int(r["UNIT_MULT"] or 0)
    out: dict[int, dict[str, dict[str, float]]] = defaultdict(dict)
    for dest, by_source in raw.items():
        best = max(by_source, key=lambda src: sum(len(v) for v in by_source[src].values()))
        for y, origins in by_source[best].items():
            out[y][dest] = origins
    last = {d: max(y for y in out if d in out[y]) for d in raw}
    print(f"  OECD 入境旅客來源：{len(raw)} 個歐洲以外的目的地；" + "、".join(
        f"{d} {y}：" + "、".join(f"{o} {v / 1e4:.0f} 萬" for o, v in sorted(out[y][d].items(), key=lambda kv: -kv[1])[:3])
        for d, y in sorted(last.items()) if d in ("JPN", "KOR", "USA", "AUS", "MEX", "CAN")))
    return out


def _write_flows(path, item: str, year: int, direction: str, pairs: dict[str, dict[str, float]], totals: dict[str, float]) -> None:
    entries = {}
    for country, partners in sorted(pairs.items()):
        ranked = sorted(((p, v) for p, v in partners.items() if p != country and v >= 1), key=lambda kv: -kv[1])[:TOP_N]
        if ranked:
            entries[country] = [round(totals.get(country) or sum(partners.values())), [[p, round(v)] for p, v in ranked]]
    write_json(path, {"item": item, "year": year, "unit": "人次", "scale": 1, direction: entries}, quiet=True)


def build() -> None:
    # 來的旅客
    _, _, rows = eurostat("tour_occ_arnraw")
    visitors: dict[int, dict[str, dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
    foreign: dict[str, dict[int, float]] = defaultdict(dict)
    world: dict[str, dict[int, float]] = defaultdict(dict)
    dom: dict[str, dict[int, float]] = defaultdict(dict)
    for key, vals in rows:
        if key["unit"] != "NR" or key["nace_r2"] != "I551-I553":
            continue
        dest = _geo(key["geo"])
        if not dest:
            continue
        res = key["c_resid"]
        for p, v in vals.items():
            y = int(p)
            if y < FIRST:
                continue
            if res == "WORLD":
                world[dest][y] = v
            elif res == "DOM":
                dom[dest][y] = v
            elif (origin := _geo(res)) and origin != dest:
                visitors[y][dest][origin] = v
    for dest in world:
        for y, v in world[dest].items():
            if y in dom[dest]:
                foreign[dest][y] = v - dom[dest][y]
    share = {d: {y: foreign[d][y] / world[d][y] * 100 for y in foreign[d] if world[d].get(y)} for d in foreign}
    # 2026-11-08（製作手冊第二十七批 669）：歐洲以外的目的地用 OECD 的入境旅客主要來源（TOP_MKT，過夜旅客）
    for y, dests in _oecd_visitors(set(world) | {"TWN"}).items():
        if y >= FIRST:
            for dest, origins in dests.items():
                visitors[y][dest].update(origins)
    tw_in = _taiwan(7)
    for y, v in tw_in["_TOTAL"].items():
        if y >= FIRST:
            foreign["TWN"][y] = v
            for origin, s in tw_in.items():
                if origin != "_TOTAL" and y in s:
                    visitors[y]["TWN"][origin] = s[y]
    # 去的旅客
    _, _, rows = eurostat("tour_dem_ttw")
    trips: dict[int, dict[str, dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
    abroad: dict[str, dict[int, float]] = defaultdict(dict)
    for key, vals in rows:
        if key["unit"] != "NR" or key["purpose"] != "TOTAL" or key["duration"] != "N_GE1":
            continue
        origin = _geo(key["geo"])
        if not origin:
            continue
        for p, v in vals.items():
            y = int(p)
            if key["c_dest"] == "FOR":
                abroad[origin][y] = v
            elif (dest := _geo(key["c_dest"])) and dest != origin:
                trips[y][origin][dest] = v
    tw_out = _taiwan(1)
    for y, v in tw_out["_TOTAL"].items():
        if y >= FIRST:
            abroad["TWN"][y] = v
            for dest, s in tw_out.items():
                if dest != "_TOTAL" and y in s:
                    trips[y]["TWN"][dest] = s[y]
    years = sorted(set(visitors) | set(trips))
    for y in years:
        _write_flows(OUT / "flows" / "visitors" / f"{y}.json", "visitors", y, "import", visitors.get(y, {}),
                     {d: s[y] for d, s in foreign.items() if y in s})
        _write_flows(OUT / "flows" / "trips" / f"{y}.json", "trips", y, "export", trips.get(y, {}),
                     {o: s[y] for o, s in abroad.items() if y in s})
    tw_note = ("台灣是交通部觀光署的來臺旅客人次（入境人次，依居住地），不是旅宿登記的到達人次",
               "Taiwan’s figure is visitor arrivals at the border by country of residence (Tourism Administration), not accommodation arrivals")
    write_json(OUT / "foreign-arrivals.json", indicator_file(
        "foreign-arrivals", "人次", years, {c: to_series(s, years, 0) for c, s in sorted(foreign.items())},
        notes={"TWN": tw_note[0]}, notesEn={"TWN": tw_note[1]}))
    write_json(OUT / "outbound-trips.json", indicator_file(
        "outbound-trips", "人次", years, {c: to_series(s, years, 0) for c, s in sorted(abroad.items())},
        notes={"TWN": "台灣是交通部觀光署的國人出國人次（含當日來回），歐洲各國是一夜以上的出國旅次"},
        notesEn={"TWN": "Taiwan’s figure is outbound departures by nationals (Tourism Administration, including same-day trips); European figures are trips abroad of one night or more"}))
    write_json(OUT / "foreign-share.json", indicator_file(
        "foreign-share", "%", years, {c: to_series(s, years, 1) for c, s in sorted(share.items())},
        noValue={"TWN": "台灣沒有依居住地分的旅宿到達人次"}, noValueEn={"TWN": "No accommodation arrivals by residence for Taiwan"}))
    y = 2024
    def top(pairs, c):
        return sorted(pairs.get(y, {}).get(c, {}).items(), key=lambda kv: -kv[1])[:4]
    print(f"  來的旅客：{len(foreign)} 國，{years[0]}–{years[-1]}；{y} 年西班牙 {top(visitors, 'ESP')}；克羅埃西亞 {top(visitors, 'HRV')}；台灣 {top(visitors, 'TWN')}")
    print(f"  去的旅客：{len(abroad)} 國；德國人去 {top(trips, 'DEU')}；台灣首站 {top(trips, 'TWN')}")
    print(f"  國外客比例 {y}：{sorted((round(s[y], 1), c) for c, s in share.items() if y in s)}")
