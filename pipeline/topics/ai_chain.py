"""AI 產業鏈的公司（新主題，2026-11-13 使用者要求「把 AI 產業鏈全景網站的資料應用到 map」；步驟 ai-chain，輸出 topics/ai-chain/）。

- 資料：AI 產業鏈全景（skywitness/ai-chain，同一作者，使用者同意照 CC BY 4.0 使用；sources/ai_chain.py）的公司名冊：
  710 家公司，每家一個主要環節（14 個環節、5 層）、等級（1 一線、2 二線、3 三線與新創）、總部城市、一句定位。
  資料基準日 2026-10-06。
- 總部的位置：只到城市。ai-chain 的座標沒寫出處，所以改用 Wikidata 同一個國家、同名聚落的座標（CC0；英文或多語名稱，
  也試「X City」「X Township」）；同名的好幾個取離 ai-chain 座標最近的。Wikidata 找不到、或最近的也差 30 公里以上的
  （寫錯的、區域名稱「San Francisco Bay Area」），沿用 ai-chain 的座標，q = 2，tooltip 寫出來。
  同一個城市的好幾家依序錯開（黃金角螺旋，約 0.6 公里一圈），放大時點得到每一家。
- 指標：各國的公司數（子項目是 14 個環節）、一線公司數。香港照 ai-chain 單獨算（HKG）。
- 台灣 AI 供應鏈據點（ai-chain 的 taiwan/sites.yaml）在 build_sites()。
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import ai_chain as A
from sources.countries import from_alpha2
from sources.wikidata_profiles import _rows, _sparql

OUT = OUT_DIR / "topics" / "ai-chain"
VARIANTS = ("{}", "{} City", "{} Township")
# 名冊的拼法跟 Wikidata 不同的
ALIASES = {("West Lake Village", "USA"): "Westlake Village", ("Kitakyushu", "JPN"): "Kitakyūshū", ("Washington", "USA"): "Washington, D.C."}
# Wikidata 的 P17 沒有 ISO 代碼的國家項目（荷蘭 Q55 的 P298 在荷蘭王國 Q29999 上），香港的地點 P17 是中國
COUNTRY_ITEMS = {"Q55": "NLD", "Q29999": "NLD"}
LOOKUP_COUNTRY = {"HKG": "CHN"}
MAX_KM = 30
OWNERSHIP = {"listed": 1, "private": 2, "subsidiary": 3, "state-owned": 4, "nonprofit": 5}


def _km(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot((a[0] - b[0]) * 111.32 * math.cos(math.radians(b[1])), (a[1] - b[1]) * 110.57)


def _wikidata(pairs: dict[tuple[str, str], tuple[float, float]]) -> dict[tuple[str, str], dict]:
    """(城市英文名, ISO3) → Wikidata 的點（qid、lon、lat）；挑同國同名裡離 ai-chain 座標最近的，差 MAX_KM 以上的不要"""
    names = sorted({v.format(ALIASES.get(k, k[0])) for k in pairs for v in VARIANTS})
    isos = sorted({LOOKUP_COUNTRY.get(iso, iso) for _n, iso in pairs})
    values = " ".join(f"{json.dumps(n, ensure_ascii=False)}@{lang}" for n in names for lang in ("en", "mul"))
    query = f"""SELECT ?name ?item (SAMPLE(?c0) AS ?c) (SAMPLE(?iso0) AS ?iso) (SAMPLE(?country0) AS ?country) WHERE {{
  VALUES ?name {{ {values} }}
  ?item rdfs:label ?name ; wdt:P625 ?c0 ; wdt:P17 ?country0 .
  OPTIONAL {{ ?country0 wdt:P298 ?iso0 }}
  FILTER(?country0 IN ({", ".join("wd:" + q for q in COUNTRY_ITEMS)}) || (BOUND(?iso0) && ?iso0 IN ({", ".join(f'"{i}"' for i in isos)})))
}} GROUP BY ?name ?item"""
    import hashlib
    found: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in _rows(_sparql(query, f"ai-chain-cities-{hashlib.sha1(values.encode()).hexdigest()[:10]}.json")):
        iso = r["iso"]["value"] if "iso" in r else COUNTRY_ITEMS.get(r["country"]["value"].rsplit("/", 1)[-1])
        m = re.fullmatch(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["c"]["value"])
        if iso and m:
            found[(r["name"]["value"], iso)].append({"qid": r["item"]["value"].rsplit("/", 1)[-1], "lon": float(m.group(1)), "lat": float(m.group(2))})
    out = {}
    for key, ref in pairs.items():
        name, iso = ALIASES.get(key, key[0]), LOOKUP_COUNTRY.get(key[1], key[1])
        cands = [c for v in VARIANTS for c in found.get((v.format(name), iso), [])]
        if cands:
            best = min(cands, key=lambda c: _km((c["lon"], c["lat"]), ref))
            best["km"] = _km((best["lon"], best["lat"]), ref)
            out[key] = best
    return out


def _spread(rows: list[dict], step: float) -> None:
    """同一個座標的好幾點依黃金角螺旋錯開（第 i 個離中心 step·√i 度）"""
    same: dict[tuple, list] = defaultdict(list)
    for r in rows:
        same[(r["lon"], r["lat"])].append(r)
    for group in same.values():
        for i, r in enumerate(group[1:], 1):
            ang, rad = i * 2.39996, step * math.sqrt(i)
            r["lon"] = round(r["lon"] + rad * math.cos(ang) / max(0.2, math.cos(math.radians(r["lat"]))), 5)
            r["lat"] = round(r["lat"] + rad * math.sin(ang), 5)


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    roster = A.roster()
    seg_index = {s[0]: i + 1 for i, s in enumerate(A.SEGMENTS)}
    refs: dict[tuple[str, str], tuple[float, float]] = {}
    for c in roster:
        h = c["hq"]
        c["iso3"] = from_alpha2(h["country"])
        if not c["iso3"]:
            raise RuntimeError(f"{c['id']} 的國家代碼對不到：{h['country']}")
        refs.setdefault((h["city"], c["iso3"]), (h["lon"], h["lat"]))
    wd = _wikidata(refs)
    fallback = {k for k in refs if k not in wd or wd[k]["km"] > MAX_KM}
    why = {k: "找不到" if k not in wd else f"差 {wd[k]['km']:.0f} 公里" for k in fallback}
    print(f"  總部城市 {len(refs)} 個：Wikidata {len(refs) - len(fallback)}；沿用 ai-chain 座標 {len(fallback)}：" + "、".join(
        f"{n}（{i}，{why[(n, i)]}）" for n, i in sorted(fallback)))
    far = sorted((round(v["km"], 1), k) for k, v in wd.items() if k not in fallback and v["km"] > 10)
    print(f"  Wikidata 跟 ai-chain 差 10–30 公里的 {len(far)} 個：{far[:12]}")
    rows = []
    for c in roster:
        h, key = c["hq"], (c["hq"]["city"], c["iso3"])
        lon, lat = (h["lon"], h["lat"]) if key in fallback else (wd[key]["lon"], wd[key]["lat"])
        s = seg_index[c["segment"]]
        rows.append({"lon": round(lon, 5), "lat": round(lat, 5), "iso3": c["iso3"], "s": s, "l": A.SEGMENTS[s - 1][3], "t": c["tier"], "w": 4 - c["tier"],
                     "o": OWNERSHIP[c["ownership"]], "f": c.get("founded"), "q": 2 if key in fallback else 1,
                     "name": c["name"], "zh": c["nameZh"] if c["nameZh"] != c["name"] else None, "city": h.get("cityZh") or h["city"],
                     "cityEn": h["city"], "role": c["role"].strip(), "id": c["id"]})
    _spread(rows, 0.006)
    rows.sort(key=lambda r: (r["t"], r["s"], r["name"].lower()))
    # 總部點與左邊的清單：全部（all）與 14 個環節各一個檔（2026-11-14 使用者回報選了環節點與清單沒變，前端讀 companies/{item}.json）
    (OUT / "companies").mkdir(exist_ok=True)
    for item in ["all", *(s[0] for s in A.SEGMENTS)]:
        part = rows if item == "all" else [r for r in rows if A.SEGMENTS[r["s"] - 1][0] == item]
        write_points(OUT / "companies" / f"{item}.json", {**points_file(
            part, ["lon", "lat", "iso3", "s", "l", "t", "w", "o", "f", "q", "id", "name", "zh", "city", "cityEn", "role"],
            {"lon": 0.00001, "lat": 0.00001, "s": 1, "l": 1, "t": 1, "w": 1, "o": 1, "f": 1, "q": 1}, strings=("iso3",)),
            "license": A.LICENSE + "；總部座標：Wikidata（CC0）"}, ("id", "name", "zh", "city", "cityEn", "role"), quiet=True)
    # 各國的公司數：全部與 14 個環節
    (OUT / "count").mkdir(exist_ok=True)
    year = [int(A.AS_OF[:4])]
    by = defaultdict(Counter)
    for r in rows:
        by["all"][r["iso3"]] += 1
        by[A.SEGMENTS[r["s"] - 1][0]][r["iso3"]] += 1
    seg_of = defaultdict(Counter)
    for r in rows:
        seg_of[r["iso3"]][r["s"]] += 1
    for item, cnt in by.items():
        hints, hints_en = {}, {}
        for iso, n in cnt.items():
            if item == "all":
                top = seg_of[iso].most_common(3)
                hints[iso] = "最多的環節：" + "、".join(f"{A.SEGMENTS[s - 1][1]} {k}" for s, k in top)
                hints_en[iso] = "Top segments: " + ", ".join(f"{A.SEGMENTS[s - 1][2]} {k}" for s, k in top)
            else:
                names = [r["name"] for r in rows if r["iso3"] == iso and A.SEGMENTS[r["s"] - 1][0] == item]
                hints[iso] = hints_en[iso] = "、".join(names[:6]) + ("…" if len(names) > 6 else "")
        write_json(OUT / "count" / f"{item}.json", indicator_file(
            "ai-chain-companies", "家", year, {k: [v] for k, v in sorted(cnt.items())}, hints=hints, hintsEn=hints_en,
            license=A.LICENSE), quiet=True)
    # 一線公司：全部與 14 個環節（跟公司數同一組子項目，換指標時環節不變）
    (OUT / "tier1").mkdir(exist_ok=True)
    for item in ["all", *(s[0] for s in A.SEGMENTS)]:
        part = [r for r in rows if r["t"] == 1 and (item == "all" or A.SEGMENTS[r["s"] - 1][0] == item)]
        cnt = Counter(r["iso3"] for r in part)
        hints = {iso: "、".join(r["name"] for r in part if r["iso3"] == iso) for iso in cnt}
        write_json(OUT / "tier1" / f"{item}.json", indicator_file("ai-chain-tier1", "家", year, {k: [v] for k, v in sorted(cnt.items())},
                                                                  hints=hints, hintsEn=hints, license=A.LICENSE), quiet=True)
    t1 = Counter(r["iso3"] for r in rows if r["t"] == 1)
    print(f"  {len(rows)} 家、{len(by['all'])} 國：" + "、".join(f"{k} {v}" for k, v in by["all"].most_common(14)))
    print("  一線 " + str(sum(t1.values())) + "：" + "、".join(f"{k} {v}" for k, v in t1.most_common(10)))
    print("  等級：" + str(Counter(r["t"] for r in rows)) + "；所有權：" + str(Counter(r["o"] for r in rows)))
    for iso in ("USA", "TWN", "CHN", "JPN", "KOR"):
        print(f"  {iso}：" + "、".join(f"{A.SEGMENTS[s - 1][1]} {k}" for s, k in seg_of[iso].most_common()))
    for item, *_ in A.SEGMENTS:
        print(f"  {item}：{sum(by[item].values())} 家；" + "、".join(f"{k} {v}" for k, v in by[item].most_common(5)))
    build_sites({c["id"]: c for c in roster})
    cities = Counter((r["city"], r["iso3"]) for r in rows)
    print("  城市：" + "、".join(f"{c}（{i}）{n}" for (c, i), n in cities.most_common(12)))


KINDS = ["science-park", "fab", "packaging", "server-cluster", "research", "port"]  # src/topics/ai-chain.ts 的 SITE_KINDS


def build_sites(names: dict[str, dict]) -> None:
    """台灣 AI 供應鏈據點（ai-chain 的 taiwan/sites.yaml，23 個）：科學園區、晶圓廠、封測廠、伺服器聚落、研究機構、港口。
    座標照 ai-chain 寫的出處：維基百科（CC BY-SA）或 OpenStreetMap Nominatim（ODbL），每一點記下是哪一個（cs）"""
    rows = []
    for x in A.load("src/data/taiwan/sites.yaml")["sites"]:
        m = re.search(r"座標[：:]([^。]*)。?$", x["note"].strip())
        if not m:
            raise RuntimeError(f"{x['id']} 的 note 沒寫座標出處")
        cs = 1 if "維基百科" in m.group(1) else 2 if "OpenStreetMap" in m.group(1) else 0
        cos = [names[c] for c in x["companies"]]
        rows.append({"lon": round(x["lon"], 5), "lat": round(x["lat"], 5), "iso3": "TWN", "k": KINDS.index(x["kind"]) + 1, "cs": cs,
                     "name": x["name"], "nameEn": x["nameEn"], "city": x["city"], "note": x["note"][:m.start()].strip(),
                     "cos": "、".join(c["nameZh"] for c in cos) or None, "cosEn": ", ".join(c["name"] for c in cos) or None})
    write_points(OUT / "taiwan-sites.json", {**points_file(
        rows, ["lon", "lat", "iso3", "k", "cs", "name", "nameEn", "city", "note", "cos", "cosEn"],
        {"lon": 0.00001, "lat": 0.00001, "k": 1, "cs": 1}, strings=("iso3",)),
        "license": A.LICENSE + "；座標：維基百科（CC BY-SA 4.0）、OpenStreetMap Nominatim（ODbL 1.0）"}, ("name", "nameEn", "city", "note", "cos", "cosEn"))
    print(f"  台灣據點 {len(rows)} 個：" + str(Counter(KINDS[r['k'] - 1] for r in rows)) + "；座標 " + str(Counter(r["cs"] for r in rows)))
