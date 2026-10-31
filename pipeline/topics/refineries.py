"""煉油廠與煉油能力（2026-10-31，製作手冊第十批 163，石油、天然氣與煤主題的擴充）。

使用者 2026-10-30 決定：用英文維基百科「List of oil refineries」的清單（固定版本 1380836230，2026-10-18，CC BY-SA 4.0），
座標用 Wikidata（CC0），能力統一換成萬桶/日，資料年份寫在 tooltip。開頭的「Global summary」表引自 Energy Institute 與 OPEC，
不能用，所以各國合計自己從清單加；「World's largest refineries」表也不用（清單裡都有）。

- 清單是條列文字：`* 名稱（業者），{{cvt|能力|oilbbl/d}} – 說明`。能力取第一個 {{cvt|…|oilbbl/d}}；沒有的話找「X million tonnes
  per year」這類寫法，1 公噸原油約 7.33 桶、÷ 365 換成桶/日。
- 狀態：在「Closed」小節、或能力前面寫 formerly／previously 的算已關閉；說明裡有 closed、shut down、decommissioned、
  mothballed 等（沒有 re-started、reopened）也算已關閉；有 under construction、planned、proposed 等（沒有 operational、
  began operating 等）算規劃中或興建中；其他算運轉中。逐列看過規則判斷錯的，寫在 OVERRIDES。
- 同一國裡名稱相同、能力差 5% 以內的算重複（撫順列了兩次），留第一個。
- 國家的值是運轉中的能力合計；點只畫 Wikidata 對得到座標的（清單裡的條目連結對到 Wikidata 的英文條目，或名稱相同）。
"""
from __future__ import annotations

import json
import re
from collections import defaultdict

from common import indicator_file, points_file, write_json
from sources import wikitable
from sources.countries import from_name
from sources.wikidata_profiles import _sparql
from topics.fossil_fuels import OUT

PAGE, REVISION, REVISION_DATE = "List of oil refineries", 1380836230, "2026-10-18"
YEAR = 2026
BARRELS_PER_TONNE = 7.33
OPERATING, PLANNED, CLOSED = 1, 2, 3

# 清單的小節名稱 → 國家（from_name 認不得的）
SECTION_ISO = {
    "Russia in Asia": "RUS", "Russia in Europe": "RUS", "Kyrgzstan": "KGZ", "Ivory Coast": "CIV", "Congo": "COG",
    "Democratic Republic of the Congo": "COD", "Curaçao": "CUW", "Martinique": "MTQ", "Taiwan": "TWN", "Turkey": "TUR",
    "Czech Republic": "CZE", "Bahamas": "BHS", "Vietnam": "VNM", "Syria": "SYR", "Iran": "IRN", "South Korea": "KOR",
    "Bolivia": "BOL", "Venezuela": "VEN", "Tanzania": "TZA", "Laos": "LAO",
}
# 美國底下另列的屬地
SUBSECTION_ISO = {"Puerto Rico": "PRI", "US Virgin Islands": "VIR"}

BEFORE_CAPACITY = re.compile(r"\b(formerly|previously|former|originally)\s*(about|around|approximately)?\s*$", re.I)
CLOSED_WORDS = re.compile(
    r"\b(closed|shut ?down|ceased|decommissioned|mothballed|idle|defunct|not operating|no longer in operation|not operational|"
    r"out of use|demolished|crude (oil )?processing (stopped|terminated|ceased)|converted (in)?to)\b", re.I)
NOT_CLOSED = re.compile(r"\b(to be closed|planned closure|temporar\w*|restarted|re-started|reopened|re-opened|resumed|rebuilt|"
                        r"recommissioned)\b", re.I)
PLANNED_WORDS = re.compile(
    r"\b(under construction|planned|proposed|to be (completed|built|commissioned)|in development|construction (began|to begin|"
    r"started|is)|expected to (start|begin|be)|commissioning \d|tender|feasibility|in financing|delayed|being built|announced|"
    r"to start|suspended)\b", re.I)
OPERATING_WORDS = re.compile(
    r"\b(began operat\w+|started operat\w+|operational|in operation|operating since|opened|commissioned( in)? \d|start-?up \d|"
    r"came on ?stream|inaugurated|online|on stream|began production|production started)\b", re.I)
TONNES = re.compile(r"([\d.,]+)\s*(million\s*)?(metric\s*)?(tonnes|tons|tones)\b[^.;–]*?(per year|/year|a year|per annum|annually|/y)",
                    re.I)

# 規則判斷錯的（名稱的開頭 → 狀態；None 是不收：生質燃料廠不是煉油廠）
OVERRIDES: dict[str, int | None] = {
    "Bataan Refinery": OPERATING,  # 2020 年疫情期間停工幾個月
    "Waltersmith Refinery": OPERATING,  # 2020 年起運轉，「planned」是擴建
    "Dangote Refinery": OPERATING,  # 2023 年 5 月啟用
    "Jubail Refinery": OPERATING,  # SATORP，2013 年起運轉
    "Sannazzaro": OPERATING,  # 「planned」是改建
    "Sturgeon Refinery": OPERATING,  # 2017 年起運轉
    "Northern Oil Refinery": CLOSED,  # 1938–1999
    "former Wolvertine Refinery": CLOSED,
    "Wamsutta Oil Refinery": CLOSED,  # 歷史上的
    "Greenville Biodiesel Refinery": None,
    "Newton County, Texas Refinery": None,
    "Ohita Refinery": None,  # 跟同一節的 Oita Refinery 是同一座（160,000 桶/日）
}
# 台灣的四座（Wikidata 的中文名稱不一，照中油、台塑的寫法）
TW_ZH = {"Mailiao": "台塑麥寮煉油廠", "Taoyuan": "中油桃園煉油廠", "Dalin": "中油大林煉油廠", "Kaohsiung": "中油高雄煉油廠"}


def _norm(name: str) -> str:
    s = name.lower()
    s = re.sub(r"\b(oil|petroleum|refinery|refining|company|co|ltd|limited|plant|complex|the|of)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)


def _items() -> list[dict]:
    text = wikitable.fetch(PAGE, REVISION, "oil-refineries")
    out: list[dict] = []
    country = sub = None
    for line in text.split("\n"):
        m = re.match(r"^(=+)\s*(.*?)\s*=+\s*$", line)
        if m:
            level = len(m.group(1))
            if level == 2:
                country = sub = None
            elif level == 3:
                country, sub = m.group(2), None
            else:
                sub = m.group(2)
            continue
        if not line.startswith("*") or not country:
            continue
        raw = wikitable.strip_refs(line.lstrip("*").strip())
        cvt = re.search(r"\{\{\s*cvt\s*\|\s*([\d,. ]+)\s*\|\s*oilbbl/d[^}]*\}\}", raw)
        plain = wikitable.text(re.sub(r"\{\{\s*cvt\s*\|\s*([\d,. ]+)\s*\|[^}]*\}\}", r"\1 bbl/d", raw))
        before = wikitable.text(raw[:cvt.start()]) if cvt else ""
        after = wikitable.text(raw[cvt.end():]) if cvt else plain
        bpd = float(cvt.group(1).replace(",", "").replace(" ", "")) if cvt else None
        if bpd is None and (t := TONNES.search(plain)):
            tonnes = float(t.group(1).replace(",", "")) * (1e6 if t.group(2) else 1)
            bpd = tonnes * BARRELS_PER_TONNE / 365
            before = plain[:t.start()]
        name = re.split(r"\s*[(,]", plain, 1)[0].strip().strip('"')
        operator = m.group(1) if (m := re.match(r"[^(]*\(([^)]*)\)", plain)) else None
        if sub and sub.lower() == "closed":
            status = CLOSED
        elif bpd is not None and BEFORE_CAPACITY.search(before):
            status = CLOSED
        elif CLOSED_WORDS.search(after) and not NOT_CLOSED.search(after):
            status = CLOSED
        elif PLANNED_WORDS.search(after) and not OPERATING_WORDS.search(after):
            status = PLANNED
        else:
            status = OPERATING
        override = next((v for k, v in OVERRIDES.items() if name.startswith(k)), "none")
        if override is None:
            continue
        if override != "none":
            status = override
        iso3 = SUBSECTION_ISO.get(sub or "") or SECTION_ISO.get(country) or from_name(country)
        if not iso3:
            raise ValueError(f"煉油廠清單的國家認不得：{country}")
        out.append({"name": name, "operator": operator, "iso3": iso3, "bpd": bpd, "status": status,
                    "links": wikitable.links(raw), "estimated": cvt is None and bpd is not None})
    # 同一國裡名稱相同、能力差 5% 以內的算重複
    seen: dict[tuple[str, str], list[dict]] = defaultdict(list)
    kept = []
    for it in out:
        key = (it["iso3"], _norm(it["name"]))
        if any(o["bpd"] and it["bpd"] and abs(o["bpd"] - it["bpd"]) <= 0.05 * o["bpd"] for o in seen[key]):
            continue
        seen[key].append(it)
        kept.append(it)
    return kept


def _wikidata() -> list[dict]:
    query = """SELECT ?item ?label ?zh ?coord ?iso ?article (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases) WHERE {
  ?item wdt:P31/wdt:P279* wd:Q12353044 .
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "en") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh-tw") }
  OPTIONAL { ?item skos:altLabel ?alias FILTER(LANG(?alias) = "en") }
} GROUP BY ?item ?label ?zh ?coord ?iso ?article"""
    rows = json.load(open(_sparql(query, "oil-refineries-v2.json"), encoding="utf-8"))["results"]["bindings"]
    out = []
    for r in rows:
        if "coord" not in r:
            continue
        lon, lat = map(float, re.findall(r"[-\d.]+", r["coord"]["value"])[:2])
        names = [r.get("label", {}).get("value", "")] + r.get("aliases", {}).get("value", "").split("|")
        article = r.get("article", {}).get("value", "")
        title = article.rsplit("/", 1)[-1].replace("_", " ") if article else None
        out.append({"lon": lon, "lat": lat, "iso3": r.get("iso", {}).get("value"), "title": title,
                    "zh": r.get("zh", {}).get("value"), "norms": {_norm(n) for n in names if n}})
    return out


def _match(item: dict, refineries: list[dict]) -> dict | None:
    from urllib.parse import unquote
    links = {unquote(l).replace("_", " ").lower() for l in item["links"]}
    for r in refineries:
        if r["title"] and unquote(r["title"]).lower() in links:
            return r
    n = _norm(item["name"])
    if len(n) < 4:
        return None
    same = [r for r in refineries if n in r["norms"] and r["iso3"] in (item["iso3"], None)]
    return same[0] if len(same) == 1 else None


def build() -> None:
    items = _items()
    refineries = _wikidata()
    points, totals, counts = [], defaultdict(float), defaultdict(int)
    for it in items:
        if it["status"] == OPERATING and it["bpd"]:
            totals[it["iso3"]] += it["bpd"]
            counts[it["iso3"]] += 1
        wd = _match(it, refineries)
        if not wd:
            continue
        zh = next((v for k, v in TW_ZH.items() if it["iso3"] == "TWN" and it["name"].startswith(k)), None) or wd["zh"]
        points.append({"lon": round(wd["lon"], 3), "lat": round(wd["lat"], 3), "name": it["name"], "zh": zh,
                       "op": it["operator"], "iso3": it["iso3"], "cap": round(it["bpd"] / 1e4, 2) if it["bpd"] else None,
                       "st": it["status"], "est": 1 if it["estimated"] else None})
    points.sort(key=lambda p: -(p["cap"] or 0))
    write_json(OUT / "refineries.json", points_file(
        points, ["lon", "lat", "name", "zh", "op", "iso3", "cap", "st", "est"], {"lon": 0.001, "lat": 0.001, "cap": 0.01, "st": 1, "est": 1},
        (), ("iso3",)))
    tw = sorted(((it["bpd"], it["name"]) for it in items if it["iso3"] == "TWN" and it["status"] == OPERATING and it["bpd"]),
                reverse=True)
    note = ("運轉中的煉油廠：" + "、".join(f"{TW_ZH.get(n.split()[0], n)} {b / 1e4:g} 萬桶/日" for b, n in tw)
            + "；中油高雄煉油廠 2015 年底關閉。能力依英文維基百科的清單。")
    note_en = ("Operating refineries: " + ", ".join(f"{n} {b / 1e3:g} thousand b/d" for b, n in tw)
               + "; CPC’s Kaohsiung refinery closed at the end of 2015. Capacities follow the English Wikipedia list.")
    write_json(OUT / "refining-capacity.json", indicator_file(
        "refining-capacity", "萬桶/日", [YEAR], {c: [round(v / 1e4, 1)] for c, v in sorted(totals.items())},
        notes={"TWN": note}, notesEn={"TWN": note_en}, license="CC BY-SA 4.0"))
    by_status = defaultdict(int)
    for it in items:
        by_status[it["status"]] += 1
    top = sorted(((round(v / 1e4), c) for c, v in totals.items()), reverse=True)[:8]
    print(f"  煉油廠 {len(items)} 筆（運轉中 {by_status[OPERATING]}、規劃或興建中 {by_status[PLANNED]}、已關閉 {by_status[CLOSED]}），"
          f"對到 Wikidata 座標 {len(points)} 筆；{len(totals)} 國有運轉中的能力，最多 {top}（萬桶/日）；台灣 {tw}")
