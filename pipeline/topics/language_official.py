"""語言：官方語言有幾種（2026-11-05，製作手冊第二十二批 393；步驟 language-official，輸出 topics/language/）。

「官方語言」沒有統一的定義，兩個來源差很多，這個差別本身就是主題，所以兩個數字並列：
- Unicode CLDR 49 的 supplementalData.xml territoryInfo（Unicode License v3，語言主題本來就在用）：languagePopulation 的
  officialStatus 是 official 或 de_facto_official 的語言數；official_regional（部分地區官方，例如南非的 10 種、瑞士的
  羅曼什語）另外寫在附註，不算。同一種語言的不同文字（bs 與 bs_Cyrl、sr 與 sr_Latn）只算一次。
- Wikidata 的 P37（官方語言，CC0）：各國項目的 P37 值（wdt，最佳等級），經 QLever 的 Wikidata 端點查
  （query.wikidata.org 的 /sparql 在 robots.txt 不允許）。國家的項目用 profiles/<ISO3>.json 的 q（國家小檔案的 Wikidata 項目）。
  P37 各國的編輯慣例不一致（台灣 22 種含臺灣手語、美國聯邦沒有官方語言卻有值），只能當「編輯者認定的清單」。
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, write_json
from sources import cldr

OUT = OUT_DIR / "topics" / "language"
ENDPOINT = "https://qlever.dev/api/wikidata"
YEAR = 2026
OFFICIAL = {"official", "de_facto_official"}
QUERY = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?c ?lang ?tw ?hant ?zh ?en WHERE {{
  VALUES ?c {{ {items} }}
  ?c wdt:P37 ?lang .
  OPTIONAL {{ ?lang rdfs:label ?tw . FILTER(LANG(?tw) = "zh-tw") }}
  OPTIONAL {{ ?lang rdfs:label ?hant . FILTER(LANG(?hant) = "zh-hant") }}
  OPTIONAL {{ ?lang rdfs:label ?zh . FILTER(LANG(?zh) = "zh") }}
  OPTIONAL {{ ?lang rdfs:label ?en . FILTER(LANG(?en) = "en") }}
}}"""
TAIWAN_NOTE = (
    "《國家語言發展法》（2019 年）第 3 條：國家語言指臺灣各固有族群使用之自然語言及臺灣手語。Wikidata 照這個列了 22 種"
    "（華語、台語、客語、15 種原住民族語、馬祖話、金門話、烏坵話與臺灣手語），CLDR 只算華語、台語、客語 3 種。",
    "Taiwan’s Development of National Languages Act (2019), Article 3, defines national languages as the natural languages "
    "of Taiwan’s ethnic groups and Taiwan Sign Language. Wikidata lists 22 (Mandarin, Taiwanese, Hakka, 15 indigenous "
    "languages, the Matsu, Kinmen and Wuqiu varieties, and Taiwan Sign Language); CLDR counts only Mandarin, Taiwanese and Hakka.",
)


def _wikidata(qids: dict[str, str]) -> list[dict]:
    path = CACHE_DIR / "wikidata" / "official-languages.json"
    if not path.exists():
        query = QUERY.format(items=" ".join(f"wd:{q}" for q in sorted(set(qids.values()))))
        req = urllib.request.Request(ENDPOINT, data=urllib.parse.urlencode({"query": query}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(6):
            try:
                print("  QLever（Wikidata）：P37", flush=True)
                with urllib.request.urlopen(req, timeout=300) as r:
                    data = r.read()
                json.loads(data)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, ConnectionError, TimeoutError, ValueError) as err:
                wait = 60 * (attempt + 1)
                print(f"    QLever：{err}，等 {wait} 秒", flush=True)
                time.sleep(wait)
        else:
            raise RuntimeError("QLever 一直失敗，稍後再跑")
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def build() -> None:
    qids = {}
    for path in sorted((OUT_DIR / "topics" / "profiles" / "profiles").glob("*.json")):
        q = json.loads(path.read_text(encoding="utf-8")).get("q")
        if q:
            qids[path.stem] = q
    by_item: dict[str, list[str]] = {}
    for iso3, q in qids.items():
        by_item.setdefault(q, []).append(iso3)

    wd: dict[str, dict[str, list[str]]] = {}
    for r in _wikidata(qids):
        item = r["c"]["value"].rsplit("/", 1)[-1]
        lang = r["lang"]["value"].rsplit("/", 1)[-1]
        zh = next((r[k]["value"] for k in ("tw", "hant", "zh") if k in r), None)
        en = r.get("en", {}).get("value") or lang
        for iso3 in by_item.get(item, []):
            wd.setdefault(iso3, {}).setdefault(lang, [lang, zh or en, en])

    territories = cldr.territories()
    names = cldr.names()
    detail: dict[str, dict] = {}
    cldr_values, wd_values, hints, hints_en = {}, {}, {}, {}
    for iso3, info in territories.items():
        official, regional = [], []
        for code, _, status in sorted(info["languages"], key=lambda l: -l[1]):
            base = code.split("_")[0]
            target = official if status in OFFICIAL else regional if status == "official_regional" else None
            if target is not None and base not in [c for c, _ in official + regional]:
                target.append((base, status))
        if not official:
            continue  # 南極洲等無人的地區、CLDR 沒有收的索馬利蘭與北賽普勒斯
        cldr_values[iso3] = [len(official)]
        detail.setdefault(iso3, {})["cldr"] = official + regional
        if regional:
            zh = "、".join((names.get(c) or (None, c))[0] or names.get(c, (None, c))[1] for c, _ in regional)
            en = ", ".join(names.get(c, (None, c))[1] for c, _ in regional)
            hints[iso3] = f"另有部分地區官方的 {len(regional)} 種：{zh}"
            hints_en[iso3] = f"Plus {len(regional)} official in some regions: {en}"
    for iso3, langs in wd.items():
        wd_values[iso3] = [len(langs)]
        detail.setdefault(iso3, {})["wd"] = list(langs.values())
    # 有 Wikidata 項目但沒有 P37 的國家是 0
    for iso3 in qids:
        if iso3 not in wd_values:
            wd_values[iso3] = [0]
    notes = {"TWN": TAIWAN_NOTE[0]}
    notes_en = {"TWN": TAIWAN_NOTE[1]}
    write_json(OUT / "official-cldr.json", indicator_file(
        "official-cldr", "種", [YEAR], dict(sorted(cldr_values.items())), hints=hints, hintsEn=hints_en, notes=notes, notesEn=notes_en,
    ))
    write_json(OUT / "official-wikidata.json", indicator_file(
        "official-wikidata", "種", [YEAR], dict(sorted(wd_values.items())), notes=notes, notesEn=notes_en,
    ))
    write_json(OUT / "official-detail.json", detail)
    for label, values in (("CLDR", cldr_values), ("Wikidata P37", wd_values)):
        counts: dict[int, int] = {}
        for (v,) in values.values():
            counts[v] = counts.get(v, 0) + 1
        top = sorted(values.items(), key=lambda kv: -kv[1][0])[:10]
        print(f"  {label}：{len(values)} 個地區；{dict(sorted(counts.items()))}；最多 {[(c, v[0]) for c, v in top]}；"
              f"台灣 {values.get('TWN')}、南非 {values.get('ZAF')}、美國 {values.get('USA')}、印度 {values.get('IND')}、瑞士 {values.get('CHE')}")
    print(f"  台灣 CLDR {detail['TWN']['cldr']}；Wikidata {[x[1] for x in detail['TWN'].get('wd', [])]}")
