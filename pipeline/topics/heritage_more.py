"""世界遺產的擴充：UNESCO 世界記憶、文化與自然遺產的保存支出（2026-11-08，製作手冊第二十七批 649，候選 1420、1422；
步驟 heritage-more，輸出 topics/world-heritage/）。

- **世界記憶**（Memory of the World International Register，文件遺產）：Wikidata（CC0，經 QLever）P1435 = Q16024238 的項目；
  點是收藏地（P276 的座標：檔案館、圖書館，不是遺址），國家的值是登錄件數（P17；跨國共同登錄每國各算一次，
  沒有 P17 的用收藏地所在的國家）。P1435 的述句沒有登錄年份，做不了時間軸。台灣不是 UNESCO 會員國，沒有。
  UNESCO 無形文化遺產 Wikidata 只有 3 筆，做不了（手冊）。
- **遺產保存支出**：UNESCO 統計研究所（UIS）公開 API 的 8 個指標（每人、2017 年固定購買力平價美元，2017–2024；CC BY-SA 4.0）：
  全部（公私合計）HEXPCSTPPPCAP.HER、公部門 .HER.PU、私部門 .HER.PR、只算文化遺產 .CULHER、只算自然遺產 .NATHER；
  政府層級 HEXPCSTPPPCAPGOV.NTL／REG／LOC.HER.PU（中央、區域〔聯邦制是州〕、地方）。「文化」主題已經有 .HER.PU（第 375 點），
  這裡把同一組的其他項攤開。UIS 不收台灣。
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_points
from geoindex import countries_at
from sources import qlever_wikidata
from sources.countries import to_iso3
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "world-heritage"
YEAR = 2026
UIS = "https://api.uis.unesco.org/api/public/data/indicators?indicator={}"
SPEND = {"all": "HEXPCSTPPPCAP.HER", "public": "HEXPCSTPPPCAP.HER.PU", "private": "HEXPCSTPPPCAP.HER.PR",
         "cultural": "HEXPCSTPPPCAP.CULHER", "natural": "HEXPCSTPPPCAP.NATHER"}
LEVELS = {"national": "HEXPCSTPPPCAPGOV.NTL.HER.PU", "regional": "HEXPCSTPPPCAPGOV.REG.HER.PU", "local": "HEXPCSTPPPCAPGOV.LOC.HER.PU"}
NV = {"TWN": "UIS 不收台灣，沒有可比的資料"}
NV_EN = {"TWN": "UIS does not cover Taiwan; no comparable data"}


def memory_of_world() -> None:
    rows = qlever_wikidata.cached("memory-of-the-world", """
SELECT ?x ?en ?zhtw ?zhhant ?zh ?loc ?locen ?coord ?iso WHERE {
  ?x wdt:P1435 wd:Q16024238 .
  OPTIONAL { ?x wdt:P276 ?loc . ?loc wdt:P625 ?coord . OPTIONAL { ?loc rdfs:label ?locen FILTER(LANG(?locen) = "en") } }
  OPTIONAL { ?x wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?x rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?x rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?x rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?x rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}""")
    items: dict[str, dict] = {}
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("x").rsplit("/", 1)[1]
        d = items.setdefault(q, {"en": v("en"), "zh": wikidata_zh(v("zhtw") or v("zhhant"), v("zh"), terms=False), "iso": set(), "places": {}})
        if v("iso"):
            d["iso"].add(v("iso"))
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", v("coord") or "", re.I)
        if m and v("loc"):
            d["places"][v("loc")] = (float(m.group(1)), float(m.group(2)), v("locen"))
    points = []
    for q, d in items.items():
        for lon, lat, place in d["places"].values():
            points.append({"lon": round(lon, 4), "lat": round(lat, 4), "en": d["en"] or q, "zh": d["zh"], "place": place})
    for p, iso in zip(points, countries_at([p["lon"] for p in points], [p["lat"] for p in points])):
        p["iso3"] = iso
    points = [p for p in points if p["iso3"]]
    by_item_place_iso = defaultdict(set)
    for p in points:
        by_item_place_iso[p["en"]].add(p["iso3"])
    counts: Counter = Counter()
    for q, d in items.items():
        isos = {i for i in d["iso"] if i} or by_item_place_iso.get(d["en"] or q, set())
        for i in isos:
            counts[i] += 1
    points.sort(key=lambda p: (p["iso3"], p["en"]))
    write_points(OUT / "memory-of-world.json", points_file(points, ["lon", "lat", "iso3", "en", "zh", "place"], {"lon": 0.0001, "lat": 0.0001},
                                                           strings=("iso3",)), ("en", "zh", "place"))
    write_json(OUT / "memory-of-world-count.json", indicator_file("memory-of-world-count", "件", [YEAR], {c: [v] for c, v in sorted(counts.items())},
                                                                  license="CC0", noValue={"TWN": "台灣不是 UNESCO 會員國"},
                                                                  noValueEn={"TWN": "Taiwan is not a UNESCO member"}))
    print(f"  世界記憶：{len(items)} 件（有收藏地座標 {sum(1 for d in items.values() if d['places'])}），點 {len(points)}；"
          f"{len(counts)} 國、合計 {sum(counts.values())}；最多 {counts.most_common(20)}")


def _uis(code: str) -> dict[str, dict[int, float]]:
    data = json.loads(download(UIS.format(code), "uis", f"{code}.json").read_text(encoding="utf-8"))
    out: dict[str, dict[int, float]] = {}
    for r in data["records"]:
        iso3 = to_iso3(r["geoUnit"])
        if iso3 and r["value"] is not None:
            out.setdefault(iso3, {})[int(r["year"])] = float(r["value"])
    return out


def _write(folder: str, item: str, code: str) -> dict[str, dict[int, float]]:
    series = _uis(code)
    years = list(range(2017, 2025))
    values = {c: [round(s[y], 2) if y in s else None for y in years] for c, s in sorted(series.items()) if any(y in s for y in years)}
    # 年份零散：前端用 7 年內最近一年的值（同「文化」主題的 HEXPCSTPPPCAP.HER.PU）
    write_json(OUT / folder / f"{item}.json", indicator_file(f"{folder}-{item}", "PPP 美元/人", years, values, license="CC BY-SA 4.0",
                                                             latestWithin=7, noValue=NV, noValueEn=NV_EN))
    latest = {c: s[max(s)] for c, s in series.items() if s}
    top = sorted(latest.items(), key=lambda kv: -kv[1])
    print(f"  {folder}/{item}（{code}）：{len(values)} 國、{sum(len(s) for s in series.values())} 筆；最新一年最高 "
          + "、".join(f"{c} {v:.1f}" for c, v in top[:8]) + " … " + "、".join(f"{c} {latest[c]:.1f}" for c in ("JPN", "KOR", "DEU", "FRA", "ITA", "USA", "GBR") if c in latest))
    return series


def build() -> None:
    memory_of_world()
    for item, code in SPEND.items():
        _write("heritage-spend", item, code)
    for item, code in LEVELS.items():
        _write("heritage-gov", item, code)
