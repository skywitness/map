"""交通的擴充（2026-10-31，製作手冊第十批 176）：高鐵路網與最高時速、地鐵系統、跨國鐵路、磁浮與單軌、鐵路與公路的貨運量。
輸出到交通的資料夾（public/data/topics/transport/），鐵路、高鐵、地鐵與城市軌道三個主題共用（dataTopic）。

- 高鐵：英文維基「List of high-speed railway lines」（revid 1382444993，CC BY-SA 4.0）的「Operational networks」總表
  （30 個國家或地區的營運長度、最高時速、開通年；總表寫「based on UIC figures」，UIC 的統計禁止轉載，這裡只轉載各國的長度
  與速度這兩個事實）。
- 地鐵系統：英文維基「List of metro systems」（revid 1382778845，CC BY-SA 4.0）的主表（使用者決定照這張表收），城市用表裡
  城市條目在 Wikidata 的座標（CC0）。
- 跨國鐵路：Natural Earth 10m railroads（公有領域，2017 年的資料）每條線的頂點依國界判斷所在的國家，相鄰兩點在不同國家就算
  兩國相連；加上人工核對的新線（MANUAL_PAIRS），拿掉不是真的相連的（NOT_LINKED）。使用者決定只畫有沒有鐵路相連，跨國客運
  列車不做。
- 磁浮與單軌：英文維基「List of monorail systems」（revid 1381856722）的交通用單軌表，與「Maglev」（revid 1380628600）的
  「Operational systems」補單軌表沒有的磁浮（使用者決定只收交通用的，不收遊樂園、動物園的）。
- 貨運量：鐵路用世界銀行 WDI IS.RRS.GOOD.MT.K6（UIC、OECD，CC BY 4.0）；公路的 WDI 是 IRF 的資料（不能用），改用 ITF
  （OECD）「Annual freight transport」的公路與鐵路（OECD 資料條款）。台灣附註用臺鐵「貨運業務年分析」（data.gov.tw 21587）。
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict

from common import OUT_DIR, download, indicator_file, now_iso, points_file, write_json, write_manifest_part
from geoindex import countries_at
from sources import worldbank, wpp
from sources import wikitable as W
from sources.countries import from_name
from sources.wikidata_profiles import _rows, _sparql

OUT = OUT_DIR / "topics" / "transport"
YEAR = 2026
PAGES = {
    "hsr": ("List_of_high-speed_railway_lines", 1382444993),
    "metro": ("List_of_metro_systems", 1382778845),
    "monorail": ("List_of_monorail_systems", 1381856722),
    "maglev": ("Maglev", 1380628600),
}
RAILROADS = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_railroads.geojson"
ITF = ("https://sdmx.oecd.org/public/rest/data/OECD.ITF,DSD_TRENDS@DF_TRENDSFREIGHT,1.0/all?startPeriod=2015"
       "&dimensionAtObservation=AllDimensions&format=csvfilewithlabels")
NAMES = {"Taiwan": "TWN", "South Korea": "KOR", "North Korea": "PRK", "Russia": "RUS", "Turkey": "TUR", "Türkiye": "TUR",
         "Iran": "IRN", "Vietnam": "VNM", "Czech Republic": "CZE", "Czechia": "CZE", "Hong Kong": "HKG", "Macau": "MAC",
         "United States": "USA", "United Kingdom": "GBR", "Laos": "LAO", "Venezuela": "VEN", "Bolivia": "BOL"}
# Natural Earth 2017 年以後通車、或資料裡漏掉的跨國鐵路（人工核對）
MANUAL_PAIRS = {
    ("CHN", "LAO"): "中老鐵路（2021 年通車）", ("LAO", "THA"): "廊開–塔納廊（2009 年通車）",
    ("GEO", "TUR"): "巴庫–第比利斯–卡爾斯鐵路（2017 年 10 月通車）", ("AFG", "UZB"): "海拉頓–馬扎里沙里夫（2011 年通車）",
    ("AFG", "TKM"): "阿基納（2016 年通車）", ("AFG", "IRN"): "哈夫–赫拉特（2020 年通車）",
}
# 單軌表的名稱、地點的條目沒有座標的：另外查的條目
MONORAIL_TITLES = {"Tama Toshi Monorail Line": "Tama Toshi Monorail", "Chiba Urban Monorail (2 lines)": "Chiba Urban Monorail",
                   "Pearlridge Skycab": "Aiea, Hawaii"}
# 條目都對不到座標的：城市中心的大約位置（經度, 緯度）
MONORAIL_COORDS = {"Tama Toshi Monorail Line": (139.4237, 35.6233), "Chiba Urban Monorail (2 lines)": (140.1233, 35.6074),
                   "Pearlridge Skycab": (-157.9389, 21.3870)}
# Natural Earth 的線在國界附近、但兩國沒有鐵路相連的
NOT_LINKED = {("MRT", "SEN"), ("ERI", "SDN")}


def _raw(key: str) -> str:
    title, rev = PAGES[key]
    return download(f"https://en.wikipedia.org/w/index.php?title={title}&action=raw&oldid={rev}", "wikipedia",
                    f"{title.lower().replace('_', '-')}-{rev}.txt").read_text(encoding="utf-8")


def _country(cell: str) -> str | None:
    # {{sort|Korea, South| {{flag|South Korea}}}} 這種先取裡面的 flag
    m = re.search(r"\{\{\s*(?:flag|flagcountry|flagicon)\s*\|\s*([^|{}]+)", cell, re.I) or \
        re.search(r"\{\{\s*sort\s*\|\s*([^|{}]+)", cell, re.I)
    name = (m.group(1) if m else W.text(cell)).strip()
    return NAMES.get(name) or from_name(name) if name else None


def _float(text: str) -> float | None:
    m = re.search(r"\d[\d,]*(?:\.\d+)?", text or "")
    return float(m.group(0).replace(",", "")) if m else None


def _km(cell: str) -> float | None:
    m = re.search(r"\{\{\s*(?:cvt|convert)\s*\|\s*([\d,.]+)\s*\|\s*km", cell, re.I)
    return float(m.group(1).replace(",", "")) if m else _float(W.text(cell))


def _coords(titles: list[str], prefix: str) -> dict[str, tuple[float, float]]:
    """英文維基條目 → Wikidata 的座標（WDQS；快取檔名含標題清單的雜湊）"""
    values = " ".join(json.dumps(t, ensure_ascii=False) + "@en" for t in sorted(set(titles)))
    query = f"""SELECT ?title (SAMPLE(?c0) AS ?c) WHERE {{
  VALUES ?title {{ {values} }}
  ?a schema:name ?title ; schema:isPartOf <https://en.wikipedia.org/> ; schema:about ?s . ?s wdt:P625 ?c0 .
}} GROUP BY ?title"""
    out = {}
    for r in _rows(_sparql(query, f"{prefix}-{hashlib.sha1(values.encode()).hexdigest()[:10]}.json")):
        m = re.fullmatch(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["c"]["value"])
        if m:
            out[r["title"]["value"]] = (float(m.group(1)), float(m.group(2)))
    return out


def _norm(t: str) -> str:
    t = t.replace("_", " ").strip()
    return t[:1].upper() + t[1:]


# ── 高鐵 ──────────────────────────────────────────────────────

def high_speed() -> None:
    raw = _raw("hsr")
    table = W.tables(raw[raw.index("=== Operational networks ==="):])[0]
    length, speed, opened = {}, {}, {}
    for r in W.rows(table):
        iso = _country(r[0])
        if not iso:
            raise RuntimeError(f"高鐵：對不到國家「{W.text(r[0])}」")
        length[iso] = _float(W.text(r[2])) or 0
        speed[iso] = _float(W.text(r[7])) or 0
        opened[iso] = int(_float(W.text(r[10])) or 0)
    hints = {c: f"{opened[c]} 年通車" for c in opened if opened[c]}
    hints_en = {c: f"opened {opened[c]}" for c in opened if opened[c]}
    tw_note = ("維基總表的「興建中」寫 56.4 km，但台灣一節列的是 2036 年通車、狀態「核定」的台北–宜蘭延伸，還沒有開工",
               "The table's under-construction column gives 56.4 km, but the Taiwan section lists it as the Taipei–Yilan extension, "
               "approved for 2036 and not yet under construction")
    for name, data, unit in (("hsr-length", length, "km"), ("hsr-speed", speed, "km/h")):
        write_json(OUT / f"{name}.json", indicator_file(
            name, unit, [YEAR], {c: [v] for c, v in sorted(data.items())}, hints=hints, hintsEn=hints_en,
            notes={"TWN": tw_note[0]}, notesEn={"TWN": tw_note[1]}))
    # 左邊的清單（使用者決定：各國高鐵依最高時速）：點了移到首都
    from topics.rd_companies import _capitals
    caps = _capitals()
    pts = [{"lon": round(caps[c][0], 3), "lat": round(caps[c][1], 3), "km": length[c], "v": speed[c], "y": opened.get(c), "iso3": c}
           for c in length if c in caps]
    write_json(OUT / "hsr-list.json", points_file(pts, ["lon", "lat", "km", "v", "y", "iso3"], {"lon": 0.001, "lat": 0.001, "km": 0.1, "v": 1, "y": 1}))
    top = sorted(length.items(), key=lambda kv: -kv[1])[:6]
    print(f"  高鐵：{len(length)} 國；" + "、".join(f"{c} {v:,.0f} km" for c, v in top) + f"；台灣 {length.get('TWN')} km、{speed.get('TWN')} km/h")


# ── 地鐵系統 ───────────────────────────────────────────────────

def metro_systems() -> None:
    raw = _raw("metro")
    table = W.tables(raw[raw.index("==List=="):])[0]
    rows = []
    for r in W.rows(table):
        if len(r) < 8:
            continue
        iso = _country(r[2])
        name = W.text(r[0])
        city_links = W.links(r[1])
        rid = re.match(r"\s*([\d,.]+)\s*\((\d{4})\)", W.text(r[7]))
        rows.append({"name": name, "city": W.text(r[1]), "link": _norm(city_links[0]) if city_links else _norm(W.text(r[1])),
                     "sys": _norm((W.links(r[0]) or [name])[0]), "iso3": iso,
                     "open": int(_float(W.text(r[3])) or 0) or None, "last": int(_float(W.text(r[4])) or 0) or None,
                     "st": int(_float(W.text(r[5])) or 0) or None, "km": _km(r[6]),
                     "rid": float(rid.group(1).replace(",", "")) if rid else None, "ry": int(rid.group(2)) if rid else None})
    missing_iso = [r["name"] for r in rows if not r["iso3"]]
    if missing_iso:
        raise RuntimeError(f"地鐵：對不到國家 {missing_iso[:10]}")
    coords = _coords([r["link"] for r in rows] + [r["sys"] for r in rows], "metro-systems")
    pts = []
    for r in rows:
        c = coords.get(r["link"]) or coords.get(r["sys"])
        if not c:
            print(f"    沒有座標：{r['name']}（{r['city']}）")
            continue
        pts.append({"lon": round(c[0], 4), "lat": round(c[1], 4), **{k: r[k] for k in ("name", "city", "iso3", "open", "last", "st", "km", "rid", "ry")}})
    write_json(OUT / "metro-systems.json", {
        **points_file(pts, ["lon", "lat", "open", "last", "st", "km", "rid", "ry", "name", "city", "iso3"],
                      {"lon": 0.0001, "lat": 0.0001, "open": 1, "last": 1, "st": 1, "km": 0.1, "rid": 0.1, "ry": 1}, strings=("iso3",)),
        "license": "CC BY-SA 4.0",
        "attribution": f"Wikipedia contributors, “List of metro systems” (revision {PAGES['metro'][1]}); city locations from Wikidata (CC0)",
    })
    km_sum: dict[str, float] = defaultdict(float)
    rid_sum: dict[str, float] = defaultdict(float)
    for r in rows:
        km_sum[r["iso3"]] += r["km"] or 0
        rid_sum[r["iso3"]] += r["rid"] or 0
    write_json(OUT / "metro-length.json", indicator_file("metro-length", "km", [YEAR], {c: [round(v, 1)] for c, v in sorted(km_sum.items())}))
    write_json(OUT / "metro-ridership.json", indicator_file(
        "metro-ridership", "百萬人次", [YEAR], {c: [round(v, 1)] for c, v in sorted(rid_sum.items()) if v}))
    tw = [r for r in rows if r["iso3"] == "TWN"]
    print(f"  地鐵系統：{len(rows)} 個（有座標 {len(pts)}）；台灣 {len(tw)} 個 {km_sum['TWN']:.1f} km；"
          f"運量最多 {sorted(((r['name'], r['rid']) for r in rows if r['rid']), key=lambda x: -x[1])[:3]}")


# ── 跨國鐵路 ───────────────────────────────────────────────────

def cross_border() -> None:
    feats = json.loads(download(RAILROADS, "natural-earth", "ne_10m_railroads.geojson").read_text(encoding="utf-8"))["features"]
    lons, lats, owner = [], [], []
    for fi, f in enumerate(feats):
        g = f["geometry"]
        for part in ([g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]):
            for x, y, *_ in part:
                lons.append(x)
                lats.append(y)
                owner.append(fi)
    where = countries_at(lons, lats)
    pairs: set[tuple[str, str]] = set()
    prev_f, prev_c = None, None
    for fi, c in zip(owner, where):
        if fi != prev_f:
            prev_f, prev_c = fi, c
            continue
        if c and prev_c and c != prev_c:
            pairs.add(tuple(sorted((c, prev_c))))
        if c:
            prev_c = c
    found = len(pairs)
    pairs -= NOT_LINKED
    pairs |= {tuple(sorted(p)) for p in MANUAL_PAIRS}
    neighbours: dict[str, set[str]] = defaultdict(set)
    for a, b in pairs:
        neighbours[a].add(b)
        neighbours[b].add(a)
    every = set(wpp.demographic(["TPopulation1July"])["TPopulation1July"]) - {"WLD"}
    notes = {"TWN": "島國，沒有跨國鐵路"}
    notes_en = {"TWN": "An island with no cross-border railway"}
    for (a, b), text in MANUAL_PAIRS.items():
        for c in (a, b):
            notes[c] = (notes.get(c, "") + ("；" if c in notes else "") + f"Natural Earth（2017 年）沒有、人工補上：{text}")
            notes_en[c] = (notes_en.get(c, "") + ("; " if c in notes_en else "") + f"added by hand (not in Natural Earth 2017): {a}–{b}")
    write_json(OUT / "rail-neighbours.json", indicator_file(
        "rail-neighbours", "國", [YEAR], {c: [len(neighbours.get(c, ()))] for c in sorted(every)},
        hints={c: "、".join(sorted(v)) for c, v in neighbours.items()}, hintsEn={c: ", ".join(sorted(v)) for c, v in neighbours.items()},
        notes=notes, notesEn=notes_en))
    deg = Counter({c: len(v) for c, v in neighbours.items()})
    print(f"  跨國鐵路：Natural Earth 算出 {found} 對，拿掉 {len(NOT_LINKED)}、補上 {len(MANUAL_PAIRS)}，共 {len(pairs)} 對、"
          f"{len(neighbours)} 國；最多 {deg.most_common(6)}")


# ── 磁浮與單軌 ─────────────────────────────────────────────────

def monorails() -> None:
    raw = _raw("monorail")
    start = raw.index("Operational monorails")
    table = W.tables(raw[start:])[0]
    rows = []
    for r in W.rows(table):
        if len(r) < 6:
            continue
        cells = [W.text(c) for c in r]
        loc_links = W.links(r[0])
        opened = re.search(r"(18|19|20)\d\d", cells[3])
        rows.append({"name": cells[2], "city": cells[0], "link": _norm(loc_links[0]) if loc_links else _norm(cells[0]),
                     "sys": _norm((W.links(r[2]) or [cells[2]])[0]), "iso3": _country(r[1]),
                     "y": int(opened.group(0)) if opened else None, "km": _km(r[5]) if len(r) > 5 else None,
                     "mg": 1 if "maglev" in " ".join(cells).lower() else 0})
    # Maglev 條目的「Operational systems」：單軌表沒有的低速磁浮（Linimo、清遠）補上
    extra = [{"name": "Linimo (Tobu Kyuryo Line)", "city": "Nagakute", "link": "Linimo", "sys": "Linimo", "iso3": "JPN", "y": 2005, "km": 8.9, "mg": 1},
             {"name": "Qingyuan Maglev", "city": "Qingyuan", "link": "Qingyuan", "sys": "Qingyuan Maglev", "iso3": "CHN", "y": 2025, "km": 8.1, "mg": 1}]
    have = " ".join(r["name"].lower() for r in rows)
    for e in extra:
        if e["name"].split()[0].lower() not in have:
            rows.append(e)
    # 仁川機場磁浮 2022 年停駛，2025 年改當觀光設施，不算交通用的（Maglev 條目）
    rows = [r for r in rows if "incheon airport maglev" not in r["name"].lower()]
    for r in rows:
        r["alt"] = MONORAIL_TITLES.get(r["name"])
    coords = _coords([r["link"] for r in rows] + [r["sys"] for r in rows] + [r["alt"] for r in rows if r["alt"]], "monorails")
    pts = []
    for r in rows:
        c = (coords.get(r["sys"]) or coords.get(r["link"]) or (coords.get(r["alt"]) if r.get("alt") else None)
             or MONORAIL_COORDS.get(r["name"]))
        if not c or not r["iso3"]:
            print(f"    單軌沒有座標或國家：{r['name']}（{r['city']}）")
            continue
        pts.append({"lon": round(c[0], 4), "lat": round(c[1], 4), "y": r["y"] or YEAR, "km": r["km"], "mg": r["mg"],
                    "name": r["name"], "city": r["city"], "iso3": r["iso3"]})
    write_json(OUT / "monorails.json", {
        **points_file(pts, ["lon", "lat", "y", "km", "mg", "name", "city", "iso3"], {"lon": 0.0001, "lat": 0.0001, "y": 1, "km": 0.1, "mg": 1},
                      strings=("iso3",)),
        "license": "CC BY-SA 4.0",
        "attribution": f"Wikipedia contributors, “List of monorail systems” (revision {PAGES['monorail'][1]}) and “Maglev” "
                       f"(revision {PAGES['maglev'][1]}); locations from Wikidata (CC0)",
    })
    print(f"  磁浮與單軌：{len(rows)} 個（有座標 {len(pts)}；磁浮 {sum(1 for p in pts if p['mg'])}：{[p['name'] for p in pts if p['mg']]}）")


# ── 貨運量 ────────────────────────────────────────────────────

def freight() -> None:
    rail, rail_world = worldbank.fetch("IS.RRS.GOOD.MT.K6", 1995)
    itf: dict[str, dict[str, dict[int, float]]] = {"ROAD": defaultdict(dict), "RAIL": defaultdict(dict)}
    with open(download(ITF, "oecd", "itf-freight.csv"), encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["MEASURE"] != "FREIGHT" or r["UNIT_MEASURE"] != "TKM" or r["TRANSPORT_MODE"] not in itf or not r["OBS_VALUE"]:
                continue
            if r["VEHICLE_TYPE"] != "_T" or r["INFRASTRUCTURE_TYPE"] != "_T":
                continue
            itf[r["TRANSPORT_MODE"]][r["REF_AREA"]][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    tw_rail = {2018: 542.5, 2022: 472.5}  # 臺鐵「貨運業務年分析」（百萬延噸公里，規劃 session 2026-10-30 讀到的 CSV）
    note = ("世界銀行與 ITF 都沒有台灣。臺鐵「貨運業務年分析」（data.gov.tw 21587）：2022 年 680.5 萬噸、4.73 億延噸公里"
            "（472.5 百萬延噸公里），2018 年 542.5 百萬；公路的延噸公里只有交通部汽車貨運調查的報告",
            "Taiwan is in neither the World Bank nor the ITF data. Taiwan Railway's annual freight analysis (data.gov.tw 21587): "
            "6.81 million tonnes and 472.5 million tonne-km in 2022 (542.5 million in 2018); road tonne-km is only in the "
            "transport ministry's truck survey reports")
    years = sorted({y for s in rail.values() for y in s})
    write_json(OUT / "rail-freight.json", indicator_file(
        "rail-freight", "百萬延噸公里", years, {c: [round(s[y], 1) if y in s else None for y in years] for c, s in sorted(rail.items()) if s},
        aggregates={"WLD": [round(rail_world[y], 1) if y in rail_world else None for y in years]},
        latestWithin=3, notes={"TWN": note[0]}, notesEn={"TWN": note[1]},
        noValue={"TWN": "沒有資料（見附註）"}, noValueEn={"TWN": "No data (see note)"}))
    road = itf["ROAD"]
    ryears = sorted({y for s in road.values() for y in s})
    write_json(OUT / "road-freight.json", indicator_file(
        "road-freight", "百萬延噸公里", ryears, {c: [round(s[y], 1) if y in s else None for y in ryears] for c, s in sorted(road.items())},
        latestWithin=3, notes={"TWN": note[0]}, notesEn={"TWN": note[1]},
        noValue={"TWN": "沒有資料（見附註）"}, noValueEn={"TWN": "No data (see note)"}))
    share = {}
    for c in set(itf["ROAD"]) & set(itf["RAIL"]):
        share[c] = {y: round(itf["RAIL"][c][y] / (itf["RAIL"][c][y] + itf["ROAD"][c][y]) * 100, 2)
                    for y in itf["ROAD"][c] if y in itf["RAIL"][c] and itf["RAIL"][c][y] + itf["ROAD"][c][y] > 0}
    write_json(OUT / "rail-freight-share.json", indicator_file(
        "rail-freight-share", "%", ryears, {c: [s.get(y) for y in ryears] for c, s in sorted(share.items()) if s},
        latestWithin=3, notes={"TWN": note[0]}, notesEn={"TWN": note[1]}))
    last = max(years)
    top = sorted(((c, s[max(s)], max(s)) for c, s in rail.items() if s), key=lambda x: -x[1])[:5]
    print(f"  鐵路貨運（WDI）：{len(rail)} 國，{years[0]}–{last}；" + "、".join(f"{c} {v:,.0f}（{y}）" for c, v, y in top)
          + f"；公路（ITF）{len(road)} 國；鐵路占比 {len(share)} 國；台灣附註 {tw_rail}")


def build() -> None:
    high_speed()
    metro_systems()
    cross_border()
    monorails()
    freight()
    write_manifest_part(OUT, "transport", "rail-extra", {"revisions": {k: v[1] for k, v in PAGES.items()}, "generatedAt": now_iso()})
