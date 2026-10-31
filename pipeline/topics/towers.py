"""摩天大樓的擴充：電視塔與觀景塔（第十批順序 183，2026-10-31，製作手冊第一百三十一節）。

使用者 2026-10-30 決定：只畫 150 m 以上的塔，小瞭望台不畫；左邊的清單依高度。
資料是 Wikidata（CC0）：P31 是電視塔（Q11166728）、觀景塔（Q1440300）、電信塔（Q1798641）、地標塔（Q107096063），
加上摩天大樓主題排除的、P31 寫成建築的電視塔（skyscrapers.py 的 EXCLUDE 裡註明電視塔、電信塔的）；高度用沒有棄用的
P2048 換算成公尺的最大值（Wikidata 的塔多半含天線），150 m 以上。
排除：拉線式的天線桅杆（手冊的陷阱：P31 是拉線桅杆、名稱有 mast 或是美國的電台呼號、GUYED 逐一看過的）、煙囪；已拆除（P576、P5817）、
還沒完工的（P5817 興建中、計畫中）。年份用啟用日期（P1619），沒有的用成立時間（P571）；沒有年份的照樣畫，但不算進各國的累計。

輸出（public/data/topics/skyscrapers/）：towers.json（點：高度 h、年份 y、拆除年份 d、類型 t 1 電視塔、2 觀景塔、3 其他塔）、
towers-count.json（各國 150 m 以上的塔數，依年份累計）。
"""
from __future__ import annotations

import re
from collections import defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json, write_manifest_part
from sources.wikidata_profiles import _rows, _sparql

OUT = OUT_DIR / "topics" / "skyscrapers"
MIN_HEIGHT = 150
WANT = {"Q11166728": 1, "Q1440300": 2, "Q1798641": 3, "Q107096063": 3}
# P31 寫成建築、摩天大樓主題排除的電視塔與電信塔（topics/skyscrapers.py 的 EXCLUDE）
EXTRA = {"Q223207": 1, "Q745016": 3, "Q122832816": 1, "Q2371922": 1}
NOT_TOWER = {"Q5622819", "Q170477", "Q1056661", "Q804399"}  # 拉線桅杆、煙囪、排煙塔、Blaw-Knox 塔
# 美國的電視桅杆多半只標「電視塔」：名稱是電台呼號（KATV、WCIX…）的都是拉線式桅杆；其他逐一看過的（2026-10-31）
CALL_SIGN = re.compile(r"\b[KW][A-Z]{2,4}(?:-TV|-FM)?\b")
GUYED: dict[str, str] = {
    "TV Alabama tower": "拉線式的電視桅杆（美國阿拉巴馬）",
    "Diversified Communications Tower": "拉線式的電視桅杆（美國南卡羅來納）",
    "Griffin Television Tower Oklahoma": "拉線式的電視桅杆（美國奧克拉荷馬）",
    "AFLAC Tower": "拉線式的電視桅杆（KWTV，美國奧克拉荷馬）",
    "Lakihegy Tower": "拉線式的廣播桅杆（匈牙利）",
    "Dudelange Radio Tower": "拉線式的廣播桅杆（盧森堡）",
    "NTT Docomo Yoyogi Building": "辦公大樓（摩天大樓主題已算）",
}
BUILDING_DESTROYED = "Q19860854"  # P31 寫「已拆除或毀損的建築」
UNBUILT = {"Q12377751", "Q811683", "Q124835105", "Q30108381", "Q105821051", "Q21514702", "Q1570262", "Q64728694"}
DESTROYED = {"Q19860854", "Q56556915"}

QUERY = """
SELECT ?item (MAX(?h0) AS ?h) (SAMPLE(?coord0) AS ?coord) (GROUP_CONCAT(DISTINCT ?cls; separator=",") AS ?classes)
       (MIN(?open0) AS ?open) (MIN(?inc0) AS ?inc) (MIN(?end0) AS ?end) (GROUP_CONCAT(DISTINCT ?state; separator=",") AS ?states)
       (GROUP_CONCAT(DISTINCT ?iso0; separator=",") AS ?isos) (SAMPLE(?en0) AS ?en) (SAMPLE(?zhtw0) AS ?zhtw)
       (SAMPLE(?zhhant0) AS ?zhhant) (SAMPLE(?zh0) AS ?zh) WHERE {
  { VALUES ?want { %s } ?item wdt:P31 ?want } UNION { VALUES ?item { %s } }
  ?item p:P2048 ?hs . ?hs wikibase:rank ?rk ; psn:P2048/wikibase:quantityAmount ?h0 .
  FILTER(?rk != wikibase:DeprecatedRank && ?h0 >= %d)
  ?item wdt:P31 ?cls .
  OPTIONAL { ?item wdt:P625 ?coord0 }
  OPTIONAL { ?item wdt:P1619 ?o . BIND(YEAR(?o) AS ?open0) }
  OPTIONAL { ?item wdt:P571 ?i . BIND(YEAR(?i) AS ?inc0) }
  OPTIONAL { ?item wdt:P576 ?e . BIND(YEAR(?e) AS ?end0) }
  OPTIONAL { ?item wdt:P5817 ?state }
  OPTIONAL { ?item wdt:P17/wdt:P298 ?iso0 }
  OPTIONAL { ?item rdfs:label ?en0 FILTER(lang(?en0) = "en") }
  OPTIONAL { ?item rdfs:label ?zhtw0 FILTER(lang(?zhtw0) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant0 FILTER(lang(?zhhant0) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh0 FILTER(lang(?zh0) = "zh") }
} GROUP BY ?item
"""


def _zh(r: dict) -> str | None:
    from opencc import OpenCC

    for k in ("zhtw", "zhhant"):
        if k in r:
            return r[k]["value"]
    return OpenCC("s2tw").convert(r["zh"]["value"]) if "zh" in r else None


def build() -> None:
    from geoindex import countries_at

    q = QUERY % (" ".join(f"wd:{k}" for k in WANT), " ".join(f"wd:{k}" for k in EXTRA), MIN_HEIGHT)
    rows = _rows(_sparql(q, "towers-2026-10-31.json"))
    out, dropped = [], defaultdict(list)
    for r in rows:
        qid = r["item"]["value"].rsplit("/", 1)[1]
        classes = {c.rsplit("/", 1)[1] for c in r["classes"]["value"].split(",")}
        states = {s.rsplit("/", 1)[1] for s in r.get("states", {}).get("value", "").split(",") if s}
        name = r.get("en", {}).get("value") or qid
        if "en" not in r:
            dropped["no English name"].append(qid)
            continue
        if classes & NOT_TOWER or re.search(r"\bmast\b", name, re.I) or CALL_SIGN.search(name) or name in GUYED:
            dropped["mast"].append(name)
            continue
        if states & UNBUILT:
            dropped["unbuilt"].append(name)
            continue
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r.get("coord", {}).get("value", ""))
        if not m:
            dropped["no coord"].append(name)
            continue
        end = int(r["end"]["value"]) if "end" in r else None
        if (states & DESTROYED or BUILDING_DESTROYED in classes) and end is None:
            dropped["destroyed, no year"].append(name)
            continue
        year = int(r["open"]["value"]) if "open" in r else int(r["inc"]["value"]) if "inc" in r else None
        if year and year > 2026:
            dropped["future"].append(name)
            continue
        t = EXTRA.get(qid) or min((WANT[c] for c in classes if c in WANT), default=3)
        isos = [c for c in r.get("isos", {}).get("value", "").split(",") if c]
        out.append({"qid": qid, "lon": float(m.group(1)), "lat": float(m.group(2)), "en": name, "zh": _zh(r),
                    "h": round(float(r["h"]["value"]), 1), "y": year, "d": end + 1 if end else None, "t": t, "iso3": isos[0] if len(isos) == 1 else None})
    missing = [o for o in out if not o["iso3"]]
    for o, c in zip(missing, countries_at([o["lon"] for o in missing], [o["lat"] for o in missing])):
        o["iso3"] = c
    out.sort(key=lambda o: -o["h"])
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "towers.json", points_file(
        out, ["lon", "lat", "en", "zh", "iso3", "h", "y", "d", "t"], {"lon": 0.001, "lat": 0.001, "h": 0.1, "y": 1, "d": 1, "t": 1}, (), ("iso3",)))
    dated = [o for o in out if o["y"]]
    years = list(range(min(o["y"] for o in dated), 2027))
    counts: dict[str, list[int]] = defaultdict(lambda: [0] * len(years))
    for o in dated:
        for i, y in enumerate(years):
            if y >= o["y"] and (not o["d"] or y < o["d"]):
                counts[o["iso3"]][i] += 1
    write_json(OUT / "towers-count.json", indicator_file(
        "towers-count", "座", years, {c: [v or None for v in s] for c, s in sorted(counts.items()) if c},
        noValue={"TWN": "Wikidata 沒有台灣 150 m 以上的電視塔或觀景塔"}, noValueEn={"TWN": "No TV or observation tower of 150 m or more in Wikidata"}))
    write_manifest_part(OUT, "skyscrapers", "towers", {"license": "CC0", "sources": ["Wikidata (television, observation and communication towers, 150 m+)"]})
    top = [(o["en"], o["h"], o["y"]) for o in out[:8]]
    print(f"  塔：Wikidata {len(rows)} 項，畫出 {len(out)}（電視塔 {sum(1 for o in out if o['t'] == 1)}、觀景塔 {sum(1 for o in out if o['t'] == 2)}、"
          f"其他 {sum(1 for o in out if o['t'] == 3)}；沒有年份 {len(out) - len(dated)}）；排除 { {k: len(v) for k, v in dropped.items()} }")
    print(f"  最高 {top}；國家最多 {sorted(((s[-1], c) for c, s in counts.items() if c), reverse=True)[:6]}；排除的桅杆 {dropped['mast'][:8]}")
