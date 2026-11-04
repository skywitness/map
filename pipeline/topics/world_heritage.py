"""世界遺產主題：各國的世界遺產數（全部、文化、自然、複合，依登錄年份累計）、瀕危世界遺產數，每個遺產一個點。

- 名錄：UNESCO DataHub 的 World Heritage List（CC BY-SA 4.0，`sources/unesco_whc.py`）。
- 國家：跨國遺產照 UNESCO 的算法，每個締約國都算一次（所以各國加起來比世界的總數多）；世界的值是不重複的遺產數。
  沒有遺產的締約國是 0，不是締約國的（台灣）沒有值。「耶路撒冷舊城及其城牆」由約旦提名、UNESCO 沒有寫締約國，
  只算進世界的總數，地圖上照樣有點。
- 瀕危名錄只有「目前在名錄上」與列入的年份，沒有移出的紀錄，所以只做目前的快照，不做歷年。
- 中文名稱：原本向 Wikidata（CC0）查 P757（世界遺產編號）對到的項目的 zh-tw、zh-hant、zh-hk 名稱。2026-11-04 重跑時
  Wikidata 回 429，**使用者決定不再查中文名稱**：沿用現有 `sites.json` 裡已有的中文名稱（以前從 Wikidata 查到的），
  新登錄、還沒有中文名稱的遺產顯示英文名稱（`_existing_zh()`）。
"""
from __future__ import annotations

import json

from common import OUT_DIR, indicator_file, now_iso, points_file, write_json
from sources import unesco_whc
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "world-heritage"
FIRST_YEAR = 1978
ITEMS = {"all": None, "cultural": "Cultural", "natural": "Natural", "mixed": "Mixed"}
# 點的分類（src/topics/world-heritage.ts 的 SITE_COLORS）：瀕危的優先
CULTURAL, NATURAL, MIXED, IN_DANGER = 1, 2, 3, 4
CLASS = {"Cultural": CULTURAL, "Natural": NATURAL, "Mixed": MIXED}

def _existing_zh() -> dict[str, str]:
    """現有 sites.json 裡的中文名稱：{UNESCO 編號: 中文名稱}（使用者 2026-11-04 決定不再向 Wikidata 查）"""
    path = OUT / "sites.json"
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    cols = dict(zip(data["fields"], data["columns"]))
    return {str(i): zh for i, zh in zip(cols["id"], cols["zh"]) if zh}


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
    zh = _existing_zh()
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
            "zh": zh.get(s.id),
        })
    write_json(OUT / "sites.json", points_file(
        rows, ["lon", "lat", "year", "cls", "type", "danger", "iso3", "more", "id", "name", "zh"],
        {"lon": 0.01, "lat": 0.01, "year": 1, "cls": 1, "type": 1, "danger": 1, "id": 1}, delta=("year",),
    ))
    # 別的步驟寫的部分（世界遺產的擴充，manifest 的 parts）留著
    old = json.loads((OUT / "manifest.json").read_text(encoding="utf-8")) if (OUT / "manifest.json").exists() else {}
    write_json(OUT / "manifest.json", {
        "topic": "world-heritage", "generatedAt": now_iso(), "lastSession": last, "counts": summary, "inDanger": len(danger),
        **({"parts": old["parts"]} if old.get("parts") else {}),
    })

    missing_zh = sum(1 for r in rows if not r["zh"])
    print(f"  全部 {summary['all']}、文化 {summary['cultural']}、自然 {summary['natural']}、複合 {summary['mixed']}、瀕危 {len(danger)}；"
          f"中文名稱 {len(rows) - missing_zh} 個（{missing_zh} 個用英文）；沒有座標 {sum(1 for r in rows if r['lon'] is None)} 個")
