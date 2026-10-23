"""世界遺產主題：各國的世界遺產數（全部、文化、自然、複合，依登錄年份累計）、瀕危世界遺產數，每個遺產一個點。

- 名錄：UNESCO DataHub 的 World Heritage List（CC BY-SA 4.0，`sources/unesco_whc.py`）。
- 國家：跨國遺產照 UNESCO 的算法，每個締約國都算一次（所以各國加起來比世界的總數多）；世界的值是不重複的遺產數。
  沒有遺產的締約國是 0，不是締約國的（台灣）沒有值。「耶路撒冷舊城及其城牆」由約旦提名、UNESCO 沒有寫締約國，
  只算進世界的總數，地圖上照樣有點。
- 瀕危名錄只有「目前在名錄上」與列入的年份，沒有移出的紀錄，所以只做目前的快照，不做歷年。
- 中文名稱：Wikidata（CC0）以 P757（世界遺產編號）對到的項目，依序用 zh-tw、zh-hant、zh-hk，沒有時用伺服器從簡體轉成的台灣用字
  （`sources/nobel.py` 的 `_pick_zh`）；對不到的顯示英文名稱。
"""
from __future__ import annotations

import hashlib
import json
import urllib.parse

from common import OUT_DIR, download, indicator_file, now_iso, points_file, write_json
from sources import unesco_whc
from sources.countries import from_alpha2
from sources.nobel import BATCH, WIKIDATA_API, ZH_ORDER, _pick_zh

OUT = OUT_DIR / "topics" / "world-heritage"
FIRST_YEAR = 1978
ITEMS = {"all": None, "cultural": "Cultural", "natural": "Natural", "mixed": "Mixed"}
# 點的分類（src/topics/world-heritage.ts 的 SITE_COLORS）：瀕危的優先
CULTURAL, NATURAL, MIXED, IN_DANGER = 1, 2, 3, 4
CLASS = {"Cultural": CULTURAL, "Natural": NATURAL, "Mixed": MIXED}

# Wikidata 的 zh-tw 名稱偶爾是簡體（sources/nobel.py 的 S2T 沒有收的字，2026-10 實際出現的）
EXTRA_S2T = str.maketrans("态样观难来厅阇迹綫羣", "態樣觀難來廳闍跡線群")

QID_QUERY = """
SELECT ?item ?id ?whs WHERE {
  ?item wdt:P757 ?id .
  FILTER(REGEX(?id, "^[0-9]+$"))
  OPTIONAL { ?item wdt:P1435 ?whs . FILTER(?whs = wd:Q9259) }
}
"""


def _qids(ids: set[str]) -> dict[str, str]:
    """UNESCO 編號 → Wikidata QID。同一個編號有好幾個項目時（2026-10 有 87 個），取標了「世界遺產」（P1435 = Q9259）的、
    再取 QID 數字小的（通常是整個遺產，不是其中一部分）"""
    url = f"https://query.wikidata.org/sparql?{urllib.parse.urlencode({'query': QID_QUERY, 'format': 'json'})}"
    path = download(url, "wikidata", "whs-qids.json")
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)["results"]["bindings"]
    best: dict[str, tuple[int, int, str]] = {}
    for r in rows:
        wid = r["id"]["value"]
        if wid not in ids:
            continue
        qid = r["item"]["value"].rsplit("/", 1)[1]
        key = (0 if "whs" in r else 1, int(qid[1:]), qid)
        if wid not in best or key < best[wid]:
            best[wid] = key
    return {k: v[2] for k, v in best.items()}


def _zh_names(qids: list[str]) -> dict[str, str]:
    ids = sorted(set(qids), key=lambda q: int(q[1:]))
    out: dict[str, str] = {}
    for start in range(0, len(ids), BATCH):
        batch = ids[start:start + BATCH]
        params = {
            "action": "wbgetentities", "ids": "|".join(batch), "props": "labels",
            "languages": "|".join(ZH_ORDER), "languagefallback": "1", "format": "json",
        }
        digest = hashlib.sha1(",".join(batch).encode()).hexdigest()[:12]
        path = download(f"{WIKIDATA_API}?{urllib.parse.urlencode(params)}", "wikidata", f"whs-labels-{digest}.json")
        with open(path, encoding="utf-8") as f:
            entities = json.load(f)["entities"]
        for qid in batch:
            name, _ = _pick_zh(entities.get(qid, {}).get("labels", {}))
            if name:
                out[qid] = name.translate(EXTRA_S2T)
    return out


def build() -> None:
    sites = unesco_whc.sites()
    parties = {from_alpha2(c) for c in unesco_whc.states_parties()} - {None}
    last = max(s.year for s in sites)
    years = list(range(FIRST_YEAR, last + 1))

    def iso3s(site: unesco_whc.Site) -> list[str]:
        out = []
        for code in site.states:
            iso3 = from_alpha2(code)
            if not iso3:
                raise RuntimeError(f"世界遺產 {site.id} 的締約國代碼對不到 ISO：{code}")
            out.append(iso3)
        return out

    no_state = [s for s in sites if not s.states]
    print(f"  {len(sites)} 個世界遺產（{last} 年為止）、{len(parties)} 個締約國；沒有締約國的：{[s.name for s in no_state]}")
    outside = {i for s in sites for i in iso3s(s)} - parties
    if outside:
        raise RuntimeError(f"有世界遺產的國家不在締約國清單裡：{outside}")

    # ── 各國的世界遺產數（依登錄年份累計） ──
    summary = {}
    for item, category in ITEMS.items():
        chosen = [s for s in sites if category is None or s.category == category]
        values = {}
        for iso3 in sorted(parties):
            mine = [s.year for s in chosen if iso3 in iso3s(s)]
            values[iso3] = [sum(y <= year for y in mine) for year in years]
        world = [sum(s.year <= year for s in chosen) for year in years]
        write_json(OUT / "sites" / f"{item}.json", indicator_file(item, "處", years, values, aggregates={"WLD": world}))
        summary[item] = world[-1]

    # ── 瀕危（目前的快照） ──
    danger = [s for s in sites if s.danger_since]
    danger_values = {iso3: [sum(iso3 in iso3s(s) for s in danger)] for iso3 in sorted(parties)}
    write_json(OUT / "danger.json", indicator_file("danger", "處", [last], danger_values, aggregates={"WLD": [len(danger)]}))

    # ── 每個遺產一個點 ──
    qids = _qids({s.id for s in sites})
    zh = _zh_names(list(qids.values()))
    rows = []
    for s in sorted(sites, key=lambda s: (s.year, int(s.id))):
        states = iso3s(s)
        rows.append({
            "lon": s.lon, "lat": s.lat, "year": s.year,
            "cls": IN_DANGER if s.danger_since else CLASS[s.category],
            "type": CLASS[s.category],
            "danger": s.danger_since,
            "iso3": states[0] if states else None,
            # 跨國遺產的其他締約國（逗號分隔），側欄依它列出每個國家的遺產
            "more": ",".join(states[1:]) or None,
            "id": int(s.id),
            "name": s.name,
            "zh": zh.get(qids.get(s.id, ""), None),
        })
    write_json(OUT / "sites.json", points_file(
        rows, ["lon", "lat", "year", "cls", "type", "danger", "iso3", "more", "id", "name", "zh"],
        {"lon": 0.01, "lat": 0.01, "year": 1, "cls": 1, "type": 1, "danger": 1, "id": 1}, delta=("year",),
    ))
    write_json(OUT / "manifest.json", {"generatedAt": now_iso(), "lastSession": last, "counts": summary, "inDanger": len(danger)})

    missing_zh = sum(1 for r in rows if not r["zh"])
    print(f"  全部 {summary['all']}、文化 {summary['cultural']}、自然 {summary['natural']}、複合 {summary['mixed']}、瀕危 {len(danger)}；"
          f"中文名稱 {len(rows) - missing_zh} 個（{missing_zh} 個用英文）；沒有座標 {sum(1 for r in rows if r['lon'] is None)} 個")
