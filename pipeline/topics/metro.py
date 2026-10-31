"""交通主題的地鐵與高鐵（Wikidata，CC0）：地鐵站依開通年份累積出現、各國的地鐵站數（1863 年起每一年），
各國第一條高鐵的開通年份（1964 年起每一年）。topics/transport.py 的 build() 最後呼叫 build()，
國家側欄的資料併進交通主題的 countries/<ISO3>.json。

地鐵站：
- 收：P31 是地鐵站（Q928830）或它的子類別（倫敦地鐵站、首爾地鐵站、地下的地鐵站…），
  或所屬路網（P16）是地鐵（Q5503 或子類別）、P31 是一般車站（車站、地下車站、高架車站…，wikidata_metro.STATION_CLASSES）。
- 不收：輕軌與通勤鐵路（使用者 2026-10-28 決定只收地鐵）。P31 只有電車站、單軌站、旅客捷運（people mover，
  Wikidata 把它當成地鐵站的子類別，其實是機場、園區的接駁）、鬼站的不算（EXCLUDED_CLASSES）；
  興建中、規劃中、取消、蓋好還沒啟用的不算（NOT_OPEN）。
- 開通年份：啟用日期（P1619）最早的一個；沒有的話用成立時間（P571）。晚於今年的（預定開通）不算。
  沒有開通年份的照使用者的決定畫在最後一年（今年），圖例與 tooltip 標「開通日期不明」，站數也只算在今年。
- 開通年份不能早於路網（P16，沒有的話路線的路網）的通車年份（路網的 P1619，沒有的話 P571）：跟火車站同一個項目、
  或從舊鐵路改成地鐵的車站（台北捷運的南港站寫的是 1899 年的台鐵南港站，奧斯陸、首爾的郊區鐵路車站）寫的是火車站的年份，
  改成路網的年份。代價是紐約 1868 年起的高架鐵路車站也從紐約地鐵的 1904 年算起（路網的項目是 1904 年通車的地鐵）。
- 停止營運：廢止（P576）或停止營運日期（P3999）最早的一個，那一年起不畫、不算；使用狀態是停用、廢棄、
  永久關閉卻沒有日期的不算（不知道哪一年起不在）。
- 重複：同一個車站常常每條路線各一個項目（東京的新宿、首爾的轉乘站），同一個國家、英文或中文名稱相同（去掉「站」「Station」、
  括號裡的路線名稱）、距離 500 m 以內的算一個站，開通年份取最早的（_dedupe）。
- 國家：依座標（geoindex 的 Natural Earth 1:10m，香港、澳門、台灣各自一國），沒有座標的用 P17；沒有座標的不畫，只算站數。
- 路網：P16 是地鐵路網的；沒有的話用路線（P81）的 P16、P361。

高鐵（HSR_RULE）：P31 是高速鐵路線（Q858485）或子類別、使用狀態不是興建中或規劃中的路線，開通年份只用啟用日期（P1619），
P571 多半是規劃或動工的年份，不用。每一國最早的一條逐一看過（HSR_FIXES、HSR_EXCLUDE）。
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from datetime import date

import geoindex
from common import OUT_DIR, indicator_file, points_file, write_json
from sources import wikidata_metro as wm

OUT = OUT_DIR / "topics" / "transport"
FIRST_YEAR = 1863  # 倫敦大都會鐵路
HSR_FIRST_YEAR = 1964  # 東海道新幹線
LAST_YEAR = date.today().year
MERGE_METRES = 500

EXCLUDED_CLASSES = {
    "Q63979268": "people mover station", "Q2175765": "tram stop", "Q63125083": "monorail station",
    "Q168565": "ghost station",
}
NOT_OPEN = {
    "Q12377751": "under construction", "Q811683": "proposed", "Q30108381": "cancelled",
    "Q110713763": "built but not yet in use", "Q87772960": "postponed", "Q28109487": "proposed railway station",
    "Q28043022": "proposed rail infrastructure", "Q64728694": "proposed entity", "Q21514702": "abandoned project",
}
CLOSED = {"Q11639308": "decommissioned", "Q63065035": "abandoned", "Q104664889": "permanently closed",
          "Q56651571": "out of service"}
WIKI_ISO = {"XKS": "XKX"}

# 開通年份的分段（點的顏色，src/topics/metro.ts 的 ERA_COLORS 同順序）；ERA_UNKNOWN 是開通日期不明
ERAS = (1950, 2000, 2020)
ERA_UNKNOWN = len(ERAS) + 1

# ── 高鐵：每一國最早的一條逐一看過（2026-10-29） ─────────────────────────
HSR_EXCLUDE: dict[str, str] = {
    "Q11344389": "東海道新幹線的鴨宮模型線：1962 年的試驗線，不載客",
    "Q573513": "特拉維夫–耶路撒冷鐵路：最高 160 km/h，不到高鐵的標準（新建 250、改良 200 km/h 以上）",
    "Q4102017": "莫斯科–喀山高鐵：還沒有興建，2019 年是計畫的年份",
    "Q782093": "加州高鐵：興建中，1996 年是加州高鐵局成立的年份",
}
HSR_FIXES: dict[str, tuple[int, str]] = {
    "Q264936": (2002, "科隆–亞琛高速鐵路：1981 年是舊線的日期；改建成 250 km/h 的科隆–迪倫段 2002 年通車，德國第一條高鐵仍是 1991 年"),
    "Q513146": (2009, "安卡拉–伊斯坦堡高鐵：第一段安卡拉–埃斯基謝希爾 2009-03-13 通車，2014 年是全線"),
    "Q85886652": (2023, "雅加達–萬隆高鐵（Whoosh）：2023-10-02 通車，Wikidata 沒有啟用日期"),
}
HSR_COUNTRY: dict[str, tuple[str, str]] = {
    "Q225221": ("NLD", "HSL-Zuid（荷蘭南部高鐵）：Wikidata 沒有國家"),
}
HSR_NOTE = (
    "Wikidata 沒有標成「高速鐵路線」、或沒有啟用日期的高鐵不算，所以奧地利、瑞士、丹麥、波蘭、俄羅斯（Sapsan 跑在改良的舊線上）、"
    "美國（Acela）等國家沒有值；中國最早的是 2003 年的秦瀋客運專線（一般常說的京津城際是 2008 年）。"
)
HSR_NOTE_EN = (
    "High-speed lines not classed as such in Wikidata, or without an opening date, are not counted, so Austria, Switzerland, "
    "Denmark, Poland, Russia (Sapsan runs on an upgraded line) and the United States (Acela) have no value; China’s earliest "
    "is the Qinhuangdao–Shenyang line of 2003 (the Beijing–Tianjin intercity line of 2008 is often cited instead)."
)


def _year(value: str) -> int | None:
    m = re.match(r"^(\d{4})-", value)
    return int(m.group(1)) if m else None


def _years(p: dict, prop: str) -> list[int]:
    return [y for y in (_year(v) for v in p.get(prop, [])) if y]


def _coord(p: dict) -> tuple[float, float] | None:
    for v in p.get("P625", []):
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", v)
        if m:
            return float(m.group(1)), float(m.group(2))
    return None


def _label(p: dict, lang: str = "en") -> str | None:
    labels = dict(p.get("label", []))
    return labels.get(lang) or labels.get("mul") or (labels.get("en") if lang != "en" else None)


SUFFIX = re.compile(
    r"\b(metro|subway|underground|u-bahn|mrt|lrt|tube|rail(way)?|train)?\s*(station|stn|stop)\b|\bstation\b", re.I)


def _norm(name: str | None) -> str:
    """比對用的名稱：去掉括號裡的（路線、城市）、「站」「Station」，只留字母與數字"""
    if not name:
        return ""
    name = re.sub(r"[（(].*?[)）]", "", name)
    name = SUFFIX.sub("", name)
    name = re.sub(r"站$", "", name.strip())
    return "".join(ch for ch in name.lower() if ch.isalnum())


def _distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    dx = (a[0] - b[0]) * 111_320 * math.cos(math.radians((a[1] + b[1]) / 2))
    dy = (a[1] - b[1]) * 110_540
    return math.hypot(dx, dy)


# 路網的通車年份，Wikidata 沒有的（逐一查過）
NETWORK_YEARS: dict[str, tuple[int, str]] = {
    "Q6720451": (2016, "吉隆坡捷運（MRT）：2016-12-16 第一段通車"),
}


def _network_years() -> dict[str, int]:
    """路網的通車年份：啟用日期（P1619），沒有的話成立時間（P571），再沒有的話 NETWORK_YEARS"""
    out = {q: y for q, (y, _) in NETWORK_YEARS.items()}
    for q, p in wm.systems().items():
        years = _years(p, "P1619") or _years(p, "P571")
        if years and q not in out:
            out[q] = min(years)
    return out


def _stations(log: list[str]) -> list[dict]:
    raw = wm.stations()
    subs = set(wm._list("subclasses")) - set(EXCLUDED_CLASSES)
    nets = set(wm._list("networks"))
    lines = wm.lines()
    systems = wm.systems()
    net_open = _network_years()
    why = Counter()
    raised = Counter()
    rows = []
    for qid, p in raw.items():
        classes = set(p.get("P31", []))
        state = set(p.get("P5817", []))
        if not classes & subs and not (classes & set(wm.STATION_CLASSES) and not classes & set(EXCLUDED_CLASSES)):
            why["電車、單軌、旅客捷運、鬼站"] += 1
            continue
        if (classes | state) & set(NOT_OPEN):
            why["興建中、規劃中或取消"] += 1
            continue
        opened = _years(p, "P1619") or _years(p, "P571")
        year = min(opened) if opened else None
        if year and year > LAST_YEAR:
            why["預定開通"] += 1
            continue
        closed = _years(p, "P576") + _years(p, "P3999")
        end = min(closed) if closed else None
        if end is None and (classes | state) & set(CLOSED):
            why["已停用、沒有停用年份"] += 1
            continue
        if end is not None and end > LAST_YEAR:
            end = None
        if end is not None and year is not None and end <= year:
            log.append(f"停用年份 {end} 不晚於開通年份 {year}：{qid} {_label(p)}，停用年份不用")
            end = None
        if end is not None and year is None:
            why["已停用、沒有開通年份"] += 1
            continue
        network = [n for n in p.get("P16", []) if n in nets]
        if not network:
            for line in p.get("P81", []):
                lp = lines.get(line, {})
                network += [n for n in lp.get("P16", []) + lp.get("P361", []) if n in nets and n not in network]
        # 從舊鐵路改成地鐵的車站（台北的淡水線、桃園機場捷運的台北車站）：P571 是舊車站的年份，不能早於路網的通車年份
        floor = min((net_open[n] for n in network if n in net_open), default=None)
        if year is not None and floor is not None and year < floor:
            raised[_label(systems[next(n for n in network if net_open.get(n) == floor)]) or "?"] += 1
            year = floor
        rows.append({
            "qid": qid, "year": year, "end": end, "coord": _coord(p), "p17": [WIKI_ISO.get(c, c) for c in p.get("P17", [])],
            "en": _label(p), "networks": network, "zh": wm.zh_name(p),
        })
    for k, n in why.most_common():
        log.append(f"不算：{k} {n} 個")
    log.append(f"開通年份早於路網的通車年份，改成路網的年份：共 {sum(raised.values())} 個")
    for k, n in raised.most_common(15):
        log.append(f"  {k} {n} 個")
    return rows


def _countries(rows: list[dict], log: list[str]) -> None:
    with_coord = [r for r in rows if r["coord"]]
    found = geoindex.countries_at([r["coord"][0] for r in with_coord], [r["coord"][1] for r in with_coord])
    for r, iso in zip(with_coord, found):
        r["iso3"] = iso
    differ = Counter()
    for r in rows:
        if not r["coord"]:
            r["iso3"] = r["p17"][0] if r["p17"] else None
        elif r["p17"] and r["iso3"] not in r["p17"] and not (r["iso3"] in ("HKG", "MAC", "TWN") and "CHN" in r["p17"]):
            differ[(r["iso3"], tuple(r["p17"]))] += 1
    for (geo, p17), n in differ.most_common(20):
        log.append(f"國家：座標在 {geo}、P17 是 {list(p17)} 的 {n} 個，依座標")


def _country_floor(rows: list[dict], log: list[str]) -> None:
    """沒有路網的車站（例如吉隆坡的加影站是跟 1897 年的火車站同一個項目）：開通年份不能早於這個國家最早的地鐵路網"""
    net_open = _network_years()
    first: dict[str, int] = {}
    for r in rows:
        for n in r["networks"]:
            if n in net_open:
                first[r["iso3"]] = min(first.get(r["iso3"], 9999), net_open[n])
    raised = Counter()
    for r in rows:
        floor = first.get(r["iso3"])
        if not r["networks"] and r["year"] is not None and floor and r["year"] < floor:
            raised[r["iso3"]] += 1
            r["year"] = floor
    if raised:
        log.append(f"沒有路網、開通年份早於這個國家最早的地鐵，改成那一年：{dict(raised)}")


def _dedupe(rows: list[dict], log: list[str]) -> list[dict]:
    """同一個國家、名稱相同、距離 500 m 以內的算一個站（_norm 的英文名稱，或相同的中文名稱）"""
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for r in rows:
        keys = {_norm(r["en"]), _norm(r["zh"])}
        r["keys"] = {k for k in keys if k}
        for k in r["keys"]:
            groups[(r["iso3"], k)].append(r)
    parent = {r["qid"]: r["qid"] for r in rows}

    def find(q: str) -> str:
        while parent[q] != q:
            parent[q] = parent[parent[q]]
            q = parent[q]
        return q

    for members in groups.values():
        for i, a in enumerate(members):
            for b in members[i + 1:]:
                if a["coord"] and b["coord"] and _distance_m(a["coord"], b["coord"]) <= MERGE_METRES:
                    parent[find(a["qid"])] = find(b["qid"])
    clusters: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        clusters[find(r["qid"])].append(r)
    out = []
    merged = 0
    for members in clusters.values():
        dated = [m for m in members if m["year"] is not None]
        keep = min(dated, key=lambda m: (m["year"], int(m["qid"][1:]))) if dated else min(members, key=lambda m: int(m["qid"][1:]))
        if len(members) > 1:
            merged += len(members) - 1
            ends = [m["end"] for m in members]
            keep = {**keep, "end": None if None in ends else max(ends),
                    "networks": list(dict.fromkeys(keep["networks"] + [n for m in members for n in m["networks"]])),
                    "merged": [m["qid"] for m in members if m is not keep]}
        out.append(keep)
    log.append(f"重複：{merged} 個項目跟同名、500 m 內的車站合併")
    return out


def _era(year: int | None) -> int:
    if year is None:
        return ERA_UNKNOWN
    return sum(1 for t in ERAS if year >= t)


def _open(r: dict, year: int) -> bool:
    """這一年營運中：開通日期不明的只算在最後一年"""
    start = r["year"] if r["year"] is not None else LAST_YEAR
    return start <= year and (r["end"] is None or r["end"] > year)


def _system_names(qids: list[str]) -> dict[str, tuple[str, str | None]]:
    """{路網: (英文名稱, 中文名稱)}"""
    systems = wm.systems()
    return {q: (_label(systems.get(q, {})) or q, wm.zh_name(systems.get(q, {}))) for q in qids}


def _hsr(units: set[str], log: list[str]) -> dict[str, list[dict]]:
    """{ISO3: [{'qid', 'year', 'en'}…]}，依開通年份排"""
    by_country: dict[str, list[dict]] = defaultdict(list)
    for qid, p in wm.hsr_lines().items():
        if qid in HSR_EXCLUDE:
            log.append(f"高鐵不算：{qid} {HSR_EXCLUDE[qid]}")
            continue
        if set(p.get("P5817", [])) & set(NOT_OPEN):
            continue
        year = HSR_FIXES[qid][0] if qid in HSR_FIXES else min(_years(p, "P1619"), default=None)
        if year is None or year > LAST_YEAR:
            continue
        countries = [HSR_COUNTRY[qid][0]] if qid in HSR_COUNTRY else [WIKI_ISO.get(c, c) for c in p.get("P17", [])]
        for iso in countries:
            if iso in units:
                by_country[iso].append({"qid": qid, "year": year, "en": _label(p) or qid, "zh": wm.zh_name(p)})
    for iso, lines in by_country.items():
        lines.sort(key=lambda l: (l["year"], l["en"]))
        log.append(f"高鐵：{iso} {lines[0]['year']} 年 {lines[0]['en']}（{lines[0]['qid']}，共 {len(lines)} 條）")
    return by_country


def build(units: list[str]) -> dict[str, dict]:
    """寫出地鐵站與高鐵的指標檔、點；回傳 {ISO3: 側欄資料}（併進交通主題的 countries/<ISO3>.json）"""
    log: list[str] = []
    rows = _stations(log)
    _countries(rows, log)
    rows = [r for r in rows if r["iso3"]]
    _country_floor(rows, log)
    rows = _dedupe(rows, log)
    unit_set = set(units)
    outside = Counter(r["iso3"] for r in rows if r["iso3"] not in unit_set)
    if outside:
        raise RuntimeError(f"車站的國家不在 countries.json 裡：{dict(outside)}")

    network_ids = sorted({n for r in rows for n in r["networks"]}, key=lambda q: int(q[1:]))
    systems = _system_names(network_ids)

    years = list(range(FIRST_YEAR, LAST_YEAR + 1))
    by_country: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_country[r["iso3"]].append(r)
    values = {iso: [sum(1 for r in by_country.get(iso, []) if _open(r, y)) for y in years] for iso in units}
    world = [sum(1 for r in rows if _open(r, y)) for y in years]
    undated = Counter(r["iso3"] for r in rows if r["year"] is None)
    write_json(OUT / "metro-stations.json", indicator_file(
        "metro-stations", "站", years, values, aggregates={"WLD": world},
        notes={iso: f"另有 {n} 個開通日期不明的站，只算在 {LAST_YEAR} 年" for iso, n in undated.items()},
        notesEn={iso: f"Another {n} stations with unknown opening dates are counted only in {LAST_YEAR}"
                 for iso, n in undated.items()},
    ))

    # ── 點：依開通年份排（不明的放最後），沒有座標的不畫 ──
    ordered = sorted((r for r in rows if r["coord"]), key=lambda r: (r["year"] or 9999, r["qid"]))
    out_rows = []
    for r in ordered:
        net = systems.get(r["networks"][0]) if r["networks"] else None
        name_zh = r["zh"]
        out_rows.append({
            "lon": r["coord"][0], "lat": r["coord"][1], "y": r["year"] or LAST_YEAR, "d": r["end"], "e": _era(r["year"]),
            "iso3": r["iso3"], "name": r["en"] or name_zh, "zh": name_zh if name_zh and name_zh != r["en"] else None,
            "sys": net[0] if net else None, "sysZh": net[1] if net and net[1] != net[0] else None,
        })
    write_json(OUT / "metro.json", points_file(
        out_rows, ["lon", "lat", "y", "d", "e", "iso3", "name", "zh", "sys", "sysZh"],
        {"lon": 0.0001, "lat": 0.0001, "y": 1, "d": 1, "e": 1}, delta=("y",), strings=("iso3", "sys", "sysZh"),
    ))

    # ── 高鐵 ──
    hsr = _hsr(unit_set, log)
    hsr_years = list(range(HSR_FIRST_YEAR, LAST_YEAR + 1))
    first = {iso: ls[0]["year"] for iso, ls in hsr.items()}
    write_json(OUT / "hsr-first.json", indicator_file(
        "hsr-first", "年", hsr_years, {iso: [f if f <= y else None for y in hsr_years] for iso, f in first.items()},
    ))

    # ── 側欄 ──
    net_open = _network_years()
    panel: dict[str, dict] = {}
    for iso, rs in by_country.items():
        per_net: dict[str, list[dict]] = defaultdict(list)
        for r in rs:
            per_net[r["networks"][0] if r["networks"] else ""].append(r)
        nets = []
        for n, members in per_net.items():
            dated = [m["year"] for m in members if m["year"] is not None]
            en, zh_name = systems.get(n, (None, None)) if n else (None, None)
            now = sum(1 for m in members if _open(m, LAST_YEAR))
            if now:
                nets.append([en, zh_name if zh_name != en else None, net_open.get(n) or (min(dated) if dated else None), now])
        nets.sort(key=lambda x: (x[0] is None, x[2] or 9999, -x[3]))
        panel[iso] = {"metro": {
            "year": LAST_YEAR, "stations": values[iso][-1], "undated": undated.get(iso, 0),
            "first": min((r["year"] for r in rs if r["year"] is not None), default=None), "systems": nets,
        }}
    for iso, ls in hsr.items():
        panel.setdefault(iso, {})["hsr"] = [[l["en"], l["zh"] if l["zh"] != l["en"] else None, l["year"]] for l in ls]

    total = len(rows)
    print(f"  地鐵站 {total} 個（開通日期不明 {sum(undated.values())}、沒有座標 {sum(1 for r in rows if not r['coord'])}），"
          f"{LAST_YEAR} 年營運中 {world[-1]}；有地鐵的國家 {sum(1 for v in values.values() if v[-1])}；"
          f"有高鐵的國家 {len(first)}")
    for line in log:
        print("  " + line)
    write_json(OUT / "metro-manifest.json", {
        "dataDate": wm.fetched_date(), "stations": total, "undated": sum(undated.values()), "open": world[-1],
        "hsrCountries": len(first), "hsrNote": HSR_NOTE, "hsrNoteEn": HSR_NOTE_EN,
    })
    return panel
