"""各國的航空公司（新主題，科技與交通類，2026-10-29，製作手冊第五批 57）：Wikidata（CC0）的航空公司，各國每年營運中的家數。

使用者 2026-10-29 決定：地圖預設只算營運中的航空公司，停業的放時間軸（每一年算那一年營運中的）。

**取捨**（手冊的陷阱：停業的很多沒有停業日期、包機貨運直升機混在一起、P17 有錯）：
- 收哪些：直接標成航空公司（Q46970）或它的客運子類別（低成本、國家航空、區域、包機、客運、補充航空公司、空中接駁）的；
  另外收有 IATA 或 ICAO 航空公司代碼、標成一般公司（公司、企業、上市公司、子公司、國營事業、航空器營運者…）的
  （台灣虎航在 Wikidata 只標成「組織」）。只標成貨運、直升機、虛擬航空公司的不收；有代碼的鐵路、軍隊、政府機關、
  航空聯盟、租賃公司等也不收。
- 營運中：沒有停業日期（P576）、也有 IATA 或 ICAO 代碼的才算（沒有代碼的多半是還沒開航、很小或早就停業但沒寫日期的）；
  標成「已不存在的實體」「已解散的組織」這類的不算。停業的（有 P576）依成立到停業的年份畫在時間軸上，不必有代碼。
- 成立年份不詳的營運中航空公司只算在最後一年（跟地鐵站開通日期不明的一樣）。
- 國家用 P17，有兩個以上國家的（北歐航空）每個國家都算；荷蘭的國家項目（Q55）2026-10 沒有 ISO 代碼，手動對到荷蘭
  （COUNTRY_FIX）；沒有 P17 的用總部所在地（P159）的國家；
  都是已經不存在的國家（蘇聯等，沒有 ISO 代碼）的不收。
- 時間軸從 1909 年（德國的飛船航空公司 DELAG 與法國的 CGTA）開始。
- HAND_END：Wikidata 沒有停業日期、但確定停業的（寫出處）。
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, indicator_file, now_iso, write_json
from sources import wikidata_attractions
from sources.countries import from_alpha2
from sources.wikidata_attractions import _sparql

OUT = OUT_DIR / "topics" / "airlines"
FIRST_YEAR, LAST_YEAR = 1909, 2026
AIRLINE = {"Q46970", "Q190915", "Q721639", "Q2440569", "Q607958", "Q7142591", "Q131632054", "Q3455680"}
NOT_PASSENGER = {"Q1057026", "Q53649729", "Q4357531"}  # 貨運、直升機、虛擬航空公司
# 有航空公司代碼時也收的一般公司類別
COMPANY = {"Q4830453", "Q783794", "Q43229", "Q6881511", "Q891723", "Q658255", "Q65679955", "Q270791", "Q134161",
           "Q219577", "Q1875615", "Q740752", "Q1589009", "Q7258079", "Q21980538", "Q5189488", "Q1480166", "Q693737",
           "Q65176929", "Q17376040", "Q48748864", "Q124343324", "Q137925492", "Q3778211"}
# 標成已不存在的（沒有停業日期也不算營運中）
DEFUNCT = {"Q15893266", "Q55097243", "Q124343348", "Q130499319"}
FLAG_CARRIER = "Q721639"
# 國家項目沒有 ISO 代碼（P297）的：荷蘭的航空公司（KLM、Transavia、Martinair…）的 P17 是「荷蘭」（Q55，2026-10 沒有 P297）或「荷蘭王國」
COUNTRY_FIX = {"Q55": "NL", "Q29999": "NL", "Q756617": "DK"}
# Wikidata 沒有停業日期、但確定停業的
HAND_END = {"Q15642610": 2016}  # 威航（V Air）：2016 年 10 月 1 日停止營運（英文維基百科 V Air 條目）
QUERY = """SELECT ?item ?cls ?country ?cc ?inc ?end ?iata ?icao ?sl ?en ?mul ?zhtw ?zhhant ?zh WHERE {{
  {{ VALUES ?c {{ {airline} }} ?item wdt:P31 ?c }} UNION {{ ?item wdt:P229 [] }} UNION {{ ?item wdt:P230 [] }}
  ?item wikibase:sitelinks ?sl .
  OPTIONAL {{ ?item wdt:P31 ?cls }}
  OPTIONAL {{ ?item wdt:P17 ?country . OPTIONAL {{ ?country wdt:P297 ?cc }} }}
  OPTIONAL {{ ?item wdt:P571 ?inc }}
  OPTIONAL {{ ?item wdt:P576 ?end }}
  OPTIONAL {{ ?item wdt:P229 ?iata }}
  OPTIONAL {{ ?item wdt:P230 ?icao }}
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
}}"""


def _year(v: str | None) -> int | None:
    m = re.match(r"(\d{4})-", v or "")
    return int(m.group(1)) if m else None


def fetch() -> list[dict]:
    path = CACHE_DIR / "wikidata" / "airlines.json"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(_sparql(QUERY.format(airline=" ".join(f"wd:{q}" for q in sorted(AIRLINE))))), encoding="utf-8")
    return json.loads(path.read_text(encoding="utf-8"))


HQ_QUERY = """SELECT ?item ?cc WHERE {{ VALUES ?item {{ {items} }} ?item wdt:P159 ?hq . ?hq wdt:P17 ?c . ?c wdt:P297 ?cc }}"""


def hq_countries(qids: list[str]) -> dict[str, set[str]]:
    """沒有 P17 的航空公司：總部所在地的國家（ISO alpha-2）"""
    path = CACHE_DIR / "wikidata" / "airlines-hq.json"
    if not path.exists():
        rows = _sparql(HQ_QUERY.format(items=" ".join(f"wd:{q}" for q in sorted(qids)))) if qids else []
        path.write_text(json.dumps(rows), encoding="utf-8")
    out: dict[str, set[str]] = defaultdict(set)
    for r in json.loads(path.read_text(encoding="utf-8")):
        out[r["item"]["value"].rsplit("/", 1)[1]].add(r["cc"]["value"])
    return out


def build() -> None:
    from opencc import OpenCC

    s2tw, s2twp = OpenCC("s2tw"), OpenCC("s2twp")
    items: dict[str, dict] = {}
    for r in fetch():
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("item").rsplit("/", 1)[1]
        d = items.setdefault(q, {"q": q, "cls": set(), "cc": set(), "inc": set(), "end": set(), "iata": set(), "icao": set(),
                                 "sl": int(v("sl"))})
        if v("cls"):
            d["cls"].add(v("cls").rsplit("/", 1)[1])
        for k in ("cc", "iata", "icao"):
            if v(k):
                d[k].add(v(k))
        if v("country") and (fix := COUNTRY_FIX.get(v("country").rsplit("/", 1)[1])):
            d["cc"].add(fix)
        if (y := _year(v("inc"))) is not None:
            d["inc"].add(y)
        if v("end"):
            d["end"].add(_year(v("end")) or 0)  # 有停業但日期不明的記 0
        for k in ("en", "mul", "zhtw", "zhhant", "zh"):
            if v(k) and not d.get(k):
                d[k] = v(k)

    hq = hq_countries([q for q, d in items.items() if not d["cc"] and d["cls"] & (AIRLINE | COMPANY)])
    for q, ccs in hq.items():
        items[q]["cc"] |= ccs
    kept: list[dict] = []
    skipped = Counter()
    for d in items.values():
        cls = d["cls"]
        coded = bool(d["iata"] or d["icao"])
        if cls & AIRLINE:
            pass
        elif coded and cls & COMPANY:
            pass
        else:
            skipped["not-airline"] += 1
            continue
        if cls & NOT_PASSENGER and not cls & (AIRLINE - {"Q46970"}):
            skipped["cargo-helicopter-virtual"] += 1
            continue
        end = HAND_END.get(d["q"]) or (max(d["end"]) if d["end"] else None)
        if end == 0:
            skipped["ceased-unknown"] += 1
            continue
        if end is None and (not coded or cls & DEFUNCT):
            skipped["no-code-or-defunct"] += 1
            continue
        start = min(d["inc"]) if d["inc"] else None
        if end is not None and (start is None or end < start):
            skipped["ceased-no-start"] += 1
            continue
        countries = sorted({iso for cc in d["cc"] if (iso := from_alpha2(cc))})
        if not countries:
            skipped["no-country"] += 1
            continue
        d.update(start=start, stop=end, countries=countries)
        kept.append(d)

    names = wikidata_attractions.fallback_names(sorted(d["q"] for d in kept if not (d.get("en") or d.get("mul"))))
    years = list(range(FIRST_YEAR, LAST_YEAR + 1))
    counts: dict[str, list[int]] = defaultdict(lambda: [0] * len(years))
    by_country: dict[str, list] = defaultdict(list)
    for d in kept:
        start, stop = d["start"], d["stop"]
        first = LAST_YEAR if start is None else max(start, FIRST_YEAR)
        last = LAST_YEAR if stop is None else stop - 1  # 停業那一年不算
        zh = s2tw.convert(d.get("zhtw") or d.get("zhhant")) if d.get("zhtw") or d.get("zhhant") else (
            s2twp.convert(d["zh"]) if d.get("zh") else None)
        en = d.get("en") or d.get("mul") or names.get(d["q"]) or d["q"]
        entry = [zh if zh != en else None, en, start, stop, sorted(d["iata"])[0] if d["iata"] else None,
                 sorted(d["icao"])[0] if d["icao"] else None, 1 if FLAG_CARRIER in d["cls"] else 0]
        for iso in d["countries"]:
            for y in range(first, last + 1):
                if FIRST_YEAR <= y <= LAST_YEAR:
                    counts[iso][y - FIRST_YEAR] += 1
            by_country[iso].append(entry)

    OUT.mkdir(parents=True, exist_ok=True)
    world = [sum(c[i] for c in counts.values()) for i in range(len(years))]
    write_json(OUT / "operating.json", indicator_file(
        "operating", "家", years, {iso: c for iso, c in sorted(counts.items())}, aggregates={"WLD": world}))
    fields = ["zh", "en", "founded", "ceased", "iata", "icao", "flag"]
    for iso, rows in by_country.items():
        rows.sort(key=lambda r: (r[3] is not None, r[2] or 9999, r[1]))
        write_json(OUT / "countries" / f"{iso}.json", {"fields": fields, "rows": rows}, quiet=True)
    write_json(OUT / "manifest.json", {"topic": "airlines", "generatedAt": now_iso(), "sources": ["Wikidata (CC0)"]})

    now = sorted(((c[-1], iso) for iso, c in counts.items()), reverse=True)
    print(f"  航空公司 {len(kept)} 家（不收 {dict(skipped)}）；{LAST_YEAR} 年營運中 {world[-1]} 家，1950 年 {world[1950 - FIRST_YEAR]}、"
          f"2000 年 {world[2000 - FIRST_YEAR]}")
    print(f"  營運中最多：{now[:10]}")
    print(f"  台灣：{[(r[0] or r[1], r[2], r[3]) for r in by_country.get('TWN', [])]}")


if __name__ == "__main__":
    build()
