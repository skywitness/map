"""晶圓廠地圖（2026-10-31，製作手冊第十批 172）：英文維基「List of semiconductor fabrication plants」的運作中與已關閉的晶圓廠。

- 資料：英文維基的固定版本（revid 1379416921，2026-10-09，CC BY-SA 4.0）「Open plants」（473 列）與「Closed plants」（49 列）
  兩張表；條目標「Incomplete list」與「Update section（2025-03）」，說明寫明不完整。輸出的檔照 CC BY-SA 4.0。
- 廠區（使用者決定）：同一家公司在同一個城市的好幾列（例如聯電新竹 Fab 8A–8F、台積電亞利桑那的 P1–P3）算一個點，
  滑過時列出各期；國家的值是運作中的廠區數。公司名稱去掉「(formerly …)」「(part of …)」後比對。
- 位置：表裡只有「國家, 城市」（順序與層級不一），用 WDQS 查同一個國家裡名稱相同的聚落（human settlement 的子類別，
  英文或多語名稱）的座標（CC0，存在 .cache/wikidata/）；同名的取 P131 或上一層名稱跟表裡的州、省相符的，再取人口最多的。
  只寫到州、省的（台積電亞利桑那）用那個州、省的座標，tooltip 寫「位置是大約的」。表裡沒有地點的 16 列不收。
- 狀態：Started production 寫 planned、under construction 或 2027 年以後的是興建中、規劃中；其他（含沒寫年份的）
  算運作中。關閉的表有關閉年份。

輸出（public/data/topics/wafer-fabs/）：fabs.json（運作中的廠區，左邊的清單也用）、planned.json、closed.json、
campuses.json、campuses-300.json（各國運作中的廠區數、有 300 mm 產線的廠區數）。
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, now_iso, points_file, write_json
from sources import wikitable as W
from sources.countries import from_name
from sources.wikidata_profiles import _rows, _sparql

OUT = OUT_DIR / "topics" / "wafer-fabs"
REVISION = 1379416921
URL = f"https://en.wikipedia.org/w/index.php?title=List_of_semiconductor_fabrication_plants&action=raw&oldid={REVISION}"
YEAR = 2026
COUNTRY_ALIASES = {"UK": "GBR", "United Kingdom": "GBR", "United States": "USA", "USA": "USA", "South Korea": "KOR",
                   "Korea": "KOR", "Taiwan": "TWN", "Russia": "RUS", "Czech Republic": "CZE", "North Korea": "PRK",
                   "Hong Kong": "HKG", "Soviet Union": None, "Vietnam": "VNM", "Iran": "IRN"}
OPERATING, PLANNED, CLOSED = 1, 2, 3
# 表裡的地名跟 Wikidata 的名稱不同（拼法、園區、地址）：(ISO, 表裡的名稱) → (Wikidata 的英文名稱, 查詢用的國家)
PLACE_ALIASES = {
    ("TWN", "Chunan Science Park"): ("Zhunan", "TWN"), ("TWN", "Hsin-Chu Science Park"): ("Hsinchu Science Park", "TWN"),
    ("TWN", "Hsinchu Science-based Industrial Park"): ("Hsinchu Science Park", "TWN"),
    ("TWN", "Longtan Science Park"): ("Longtan District", "TWN"), ("TWN", "Miao-Li"): ("Miaoli", "TWN"),
    ("TWN", "Taipei City"): ("Taipei", "TWN"), ("TWN", "Taipei Country"): ("New Taipei", "TWN"),
    ("TWN", "Taoyuan City"): ("Taoyuan", "TWN"),
    ("JPN", "Hyogo Prefecture"): ("Hyōgo Prefecture", "JPN"), ("JPN", "Nagano prefecture"): ("Nagano Prefecture", "JPN"),
    ("JPN", "Toyama prefecture"): ("Toyama Prefecture", "JPN"), ("JPN", "Oita"): ("Ōita", "JPN"), ("JPN", "Ome"): ("Ōme", "JPN"),
    ("JPN", "Saijo-shi"): ("Saijō", "JPN"), ("JPN", "Atsugi Operation Base"): ("Atsugi", "JPN"),
    ("KOR", "Paju-si"): ("Paju", "KOR"), ("KOR", "Eumsung-Kun"): ("Eumseong County", "KOR"),
    ("KOR", "Giheung"): ("Giheung District", "KOR"), ("MYS", "Kulim Hi-Tech Park"): ("Kulim", "MYS"),
    ("IND", "Bangalore"): ("Bengaluru", "IND"), ("CRI", "San Jose"): ("San José", "CRI"),
    ("DEU", "Hans-Bunte-Strasse"): ("Freiburg im Breisgau", "DEU"),  # 郵遞區號 79108 是弗萊堡
    ("SGP", "Bedok South Road"): ("Singapore", "SGP"), ("CHN", "Shaanxi Province"): ("Shaanxi", "CHN"),
    ("HKG", "Hong Kong"): ("Hong Kong", "CHN"), ("JPN", "Miyasaki"): ("Miyazaki", "JPN"),  # Wikidata 的香港 P17 是中華人民共和國
}


def _company(text: str) -> str:
    """比對廠區用的公司名稱：去掉括號裡的前身、母公司"""
    return re.sub(r"\s*\((?:formerly|part of|previously|originally|now)[^)]*\)", "", text, flags=re.I).strip()


def _country(tokens: list[str]) -> tuple[str | None, list[str]]:
    for i, t in enumerate(tokens):
        iso = COUNTRY_ALIASES.get(t, from_name(t) if t not in COUNTRY_ALIASES else None)
        if iso:
            return iso, tokens[:i] + tokens[i + 1:]
    return None, tokens


def _parse() -> list[dict]:
    raw = download(URL, "wikipedia", f"list-of-semiconductor-fabrication-plants-{REVISION}.txt").read_text(encoding="utf-8")
    tables = W.tables(raw)
    out = []
    for kind, table in ((OPERATING, tables[0]), (CLOSED, tables[1])):
        for r in W.rows(table):
            if len(r) < 9:
                continue
            company, plant, loc, _cost, started, wafer, node, cap, tech = (W.text(c) for c in r[:9])
            closed = W.text(r[9]) if kind == CLOSED and len(r) > 9 else ""
            tokens = [t.strip() for t in re.split(r"[,\n]", loc) if t.strip()]
            iso, rest = _country(tokens)
            if not iso:
                continue
            if not rest and iso in ("SGP", "HKG"):  # 城市國家：用國家本身
                rest = tokens[:1]
            elif not rest and plant:  # 地點欄只寫國家、廠名是城市的（羅姆的 Miyasaki 等）
                rest = [plant]
            status = kind
            start_years = [int(y) for y in re.findall(r"(?<!\d)(19[4-9]\d|20\d\d)(?!\d)", started)]
            if kind == OPERATING and (re.search(r"plan|construction|under", started, re.I) or (start_years and min(start_years) > YEAR)):
                status = PLANNED
            wafers = [float(w) for w in re.findall(r"\d+(?:\.\d+)?", wafer)]
            out.append({
                "company": company, "key": _company(company), "plant": plant, "iso3": iso, "places": rest, "loc": loc.replace("\n", " "),
                "status": status, "start": min(start_years) if start_years else None, "wafer": wafer, "maxWafer": max(wafers) if wafers else None,
                "node": node, "cap": cap, "tech": tech,
                "closed": int(m.group(1)) if (m := re.search(r"(19\d\d|20\d\d)", closed)) else None,
            })
    return out


VARIANTS = ("{}", "{} City", "{} District", "{} County")
# P17 的國家沒有 ISO 代碼的（荷蘭王國）
COUNTRY_ITEMS = {"http://www.wikidata.org/entity/Q29999": "NLD"}


def _geocode(pairs: set[tuple[str, str]]) -> dict[tuple[str, str], list[dict]]:
    """(名稱, ISO) → 候選地點（座標、人口、上一層與上兩層的名稱、是不是聚落）；名稱也試「X City」「X District」「X County」，
    國家在程式裡比對（荷蘭的地點 P17 是荷蘭王國，沒有 ISO 代碼）"""
    names = sorted({v.format(n) for n, _iso in pairs for v in VARIANTS})
    values = " ".join(f"{json.dumps(n, ensure_ascii=False)}@{lang}" for n in names for lang in ("en", "mul"))
    isos = sorted({iso for _n, iso in pairs})
    query = f"""SELECT ?name ?item (SAMPLE(?c0) AS ?c) (MAX(?pop0) AS ?pop) (SAMPLE(?iso0) AS ?iso) (SAMPLE(?country0) AS ?country)
       (MAX(?s) AS ?settle) (GROUP_CONCAT(DISTINCT ?aL; separator="|") AS ?admins) WHERE {{
  VALUES ?name {{ {values} }}
  ?item rdfs:label ?name ; wdt:P625 ?c0 ; wdt:P17 ?country0 .
  OPTIONAL {{ ?country0 wdt:P298 ?iso0 }}
  FILTER(?country0 = wd:Q29999 || (BOUND(?iso0) && ?iso0 IN ({", ".join(f'"{i}"' for i in isos)})))
  OPTIONAL {{ ?item wdt:P1082 ?pop0 }}
  BIND(IF(EXISTS {{ ?item wdt:P31/wdt:P279* wd:Q486972 }}, 1, 0) AS ?s)
  OPTIONAL {{ ?item wdt:P131|wdt:P131/wdt:P131 ?a . ?a rdfs:label ?aL . FILTER(LANG(?aL) = "en") }}
}} GROUP BY ?name ?item"""
    name = f"wafer-fabs-places-{hashlib.sha1(values.encode()).hexdigest()[:10]}.json"
    found: dict[tuple[str, str], dict[str, dict]] = defaultdict(dict)
    for r in _rows(_sparql(query, name)):
        iso = r["iso"]["value"] if "iso" in r else COUNTRY_ITEMS.get(r["country"]["value"])
        if not iso:
            continue
        key = (r["name"]["value"], iso)
        point = re.fullmatch(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["c"]["value"])
        if not point:  # 別的星球的座標（開頭是 <…entity/Q405>）或格式不對
            continue
        d = found[key].setdefault(r["item"]["value"], {"admins": set(), "pop": 0, "settle": False})
        d["lon"], d["lat"] = float(point.group(1)), float(point.group(2))
        if "pop" in r:
            try:
                d["pop"] = max(d["pop"], float(r["pop"]["value"]))
            except ValueError:
                pass
        if r.get("settle", {}).get("value") == "1":
            d["settle"] = True
        d["admins"].update(a.lower() for a in r.get("admins", {}).get("value", "").split("|") if a)
    out: dict[tuple[str, str], list[dict]] = {}
    for n, iso in pairs:
        cands: dict[str, dict] = {}
        for v in VARIANTS:
            for item in found.get((v.format(n), iso), {}).items():
                cands.setdefault(*item)
        if cands:
            out[(n, iso)] = list(cands.values())
    return out


def _pick(cands: list[dict], others: list[str], settlement: bool) -> dict | None:
    cands = [c for c in cands if c["settle"] == settlement] if settlement else cands
    if not cands:
        return None
    hint = [o.lower() for o in others]
    match = [c for c in cands if any(h in a or a in h for h in hint for a in c["admins"])]
    return max(match or cands, key=lambda c: c["pop"])


def build() -> None:
    rows = _parse()
    for r in rows:
        r["lookup"] = [PLACE_ALIASES.get((r["iso3"], p), (p, r["iso3"])) for p in r["places"]]
    pairs = {q for r in rows for q in r["lookup"]}
    places = _geocode(pairs)
    approx_rows = 0
    for r in rows:
        best = None
        # 先找聚落（城市、鄉鎮），表裡的其他名稱當作州、省比對；都沒有再用州、省本身的座標
        for i, q in enumerate(r["lookup"]):
            got = _pick(places.get(q, []), r["places"][:i] + r["places"][i + 1:], True)
            if got and (best is None or got["pop"] < best["pop"] or best.get("approx")):
                best = got
        if best is None:
            for q in r["lookup"]:
                got = _pick(places.get(q, []), [], False)
                if got:
                    best = {**got, "approx": True}
                    approx_rows += 1
                    break
        r["geo"] = best

    # 廠區：同一家公司、同一個地點（城市）
    campuses: dict[tuple, dict] = {}
    for r in rows:
        if not r["geo"]:
            continue
        key = (r["status"] == CLOSED, r["key"].lower(), round(r["geo"]["lon"], 2), round(r["geo"]["lat"], 2))
        c = campuses.setdefault(key, {"company": r["key"], "iso3": r["iso3"], "lon": r["geo"]["lon"], "lat": r["geo"]["lat"],
                                      "approx": bool(r["geo"].get("approx")), "loc": r["loc"], "phases": []})
        c["phases"].append(r)
    unlocated = [f"{r['company']}（{r['loc']}）" for r in rows if not r["geo"]]
    print(f"  英文維基：{sum(1 for r in rows if r['status'] != CLOSED)} 列運作中或規劃中、{sum(1 for r in rows if r['status'] == CLOSED)} 列關閉"
          f"（表裡沒有國家的不收）；對不到地點 {len(unlocated)} 列：{'；'.join(unlocated[:12])}")

    def campus_row(c: dict) -> dict:
        ph = sorted(c["phases"], key=lambda r: (r["start"] or 9999, r["plant"]))
        status = (CLOSED if ph[0]["status"] == CLOSED else
                  OPERATING if any(r["status"] == OPERATING for r in ph) else PLANNED)
        starts = [r["start"] for r in ph if r["start"] and r["status"] != PLANNED]
        wafers = [r["maxWafer"] for r in ph if r["maxWafer"]]
        closed = max((r["closed"] for r in ph if r["closed"]), default=None)
        lines = []
        for r in ph[:8]:
            bits = [r["plant"] or "—"]
            if r["status"] == PLANNED:
                bits.append("planned")
            elif r["start"]:
                bits.append(str(r["start"]))
            if r["wafer"]:
                bits.append(f"{r['wafer']} mm")
            if r["node"]:
                bits.append(f"{r['node']} nm")
            if r["cap"]:
                bits.append(f"{r['cap']} wpm")
            lines.append(" · ".join(bits))
        if len(ph) > 8:
            lines.append(f"+{len(ph) - 8}")
        tech = "; ".join(dict.fromkeys(t for r in ph for t in [r["tech"]] if t))[:160]
        return {"lon": round(c["lon"], 4), "lat": round(c["lat"], 4), "st": status, "y": min(starts) if starts else None,
                "w": max(wafers) if wafers else 0, "n": len(ph), "ap": 1 if c["approx"] else 0, "end": closed,
                "co": c["company"], "loc": c["loc"], "ph": "\n".join(lines), "tech": tech or None, "iso3": c["iso3"]}

    out_rows = [campus_row(c) for c in campuses.values()]
    fields = ["lon", "lat", "st", "y", "w", "n", "ap", "end", "co", "loc", "ph", "tech", "iso3"]
    scale = {"lon": 0.0001, "lat": 0.0001, "st": 1, "y": 1, "w": 1, "n": 1, "ap": 1, "end": 1}
    strings = ("co", "iso3")
    attribution = {"license": "CC BY-SA 4.0",
                   "attribution": f"Wikipedia contributors, “List of semiconductor fabrication plants” (revision {REVISION}); "
                                  "locations from Wikidata (CC0)"}
    for name, st in (("fabs", OPERATING), ("planned", PLANNED), ("closed", CLOSED)):
        sel = [x for x in out_rows if x["st"] == st]
        write_json(OUT / f"{name}.json", {**points_file(sel, fields, scale, strings=strings), **attribution})
    operating = [x for x in out_rows if x["st"] == OPERATING]
    counts: dict[str, int] = defaultdict(int)
    counts300: dict[str, int] = defaultdict(int)
    for x in operating:
        counts[x["iso3"]] += 1
        if (x["w"] or 0) >= 300:
            counts300[x["iso3"]] += 1
    for name, data in (("campuses", counts), ("campuses-300", counts300)):
        write_json(OUT / f"{name}.json", indicator_file(name, "處", [YEAR], {c: [n] for c, n in sorted(data.items())}))
    top = sorted(counts.items(), key=lambda kv: -kv[1])[:8]
    print(f"  廠區：運作中 {len(operating)}（位置是大約的 {sum(1 for x in operating if x['ap'])}）、興建中或規劃中 "
          f"{sum(1 for x in out_rows if x['st'] == PLANNED)}、已關閉 {sum(1 for x in out_rows if x['st'] == CLOSED)}；"
          + "、".join(f"{c} {n}" for c, n in top) + f"；300 mm：{dict(sorted(counts300.items(), key=lambda kv: -kv[1])[:6])}")
    tw = [x for x in operating if x["iso3"] == "TWN"]
    print(f"  台灣：{len(tw)} 個廠區，例如 " + "、".join(f"{x['co']} {x['loc']}（{x['n']} 列）" for x in tw[:5]))
    write_json(OUT / "manifest.json", {"topic": "wafer-fabs", "generatedAt": now_iso(), "revision": REVISION})
