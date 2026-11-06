"""世界遺產主題：各國的世界遺產數（全部、文化、自然、複合，依登錄年份累計）、瀕危世界遺產數，每個遺產一個點。

- 名錄：UNESCO DataHub 的 World Heritage List（CC BY-SA 4.0，`sources/unesco_whc.py`）。
- 國家：跨國遺產照 UNESCO 的算法，每個締約國都算一次（所以各國加起來比世界的總數多）；世界的值是不重複的遺產數。
  沒有遺產的締約國是 0，不是締約國的（台灣）沒有值。「耶路撒冷舊城及其城牆」由約旦提名、UNESCO 沒有寫締約國，
  只算進世界的總數，地圖上照樣有點。
- 瀕危名錄只有「目前在名錄上」與列入的年份，沒有移出的紀錄，所以只做目前的快照，不做歷年。
- 中文名稱：原本向 Wikidata（CC0）查 P757（世界遺產編號）對到的項目的 zh-tw、zh-hant、zh-hk 名稱。2026-11-04 重跑時
  Wikidata 回 429，**使用者決定不再查中文名稱**：沿用現有 `sites.json` 裡已有的中文名稱（以前從 Wikidata 查到的），
  新登錄、還沒有中文名稱的遺產顯示英文名稱（`_existing_zh()`）。
- 照片（2026-11-06，城2，參考 thecastlemap.com 的照片卡）：Wikidata 用 P757（世界遺產編號）對到的項目的 P18，
  攝影者與授權查 Commons（sources/commons_photos.py），tooltip 滑過時從 Commons 讀縮圖。名錄（UNESCO DataHub）在雲端
  抓不到，所以另外一個步驟 world-heritage-photos 讀現有的 sites.json 補上照片（build_photos）；主步驟也用同一份快取補。
- sites.json 的名稱、照片路徑、攝影者另外放在 sites-text.json（城6，write_points 的 text）。
"""
from __future__ import annotations

import json

from common import OUT_DIR, indicator_file, load_points_json, now_iso, points_file, read_points_file, write_json, write_points
from sources import commons_photos, unesco_whc
from sources.countries import from_alpha2
from sources.wikidata_attractions import _cached

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
    data = load_points_json(path)
    cols = dict(zip(data["fields"], data["columns"]))
    return {str(i): zh for i, zh in zip(cols["id"], cols["zh"]) if zh}


PHOTOS = """SELECT ?item ?id ?img WHERE { ?item wdt:P757 ?id ; wdt:P18 ?img . }"""
FIELDS = ["lon", "lat", "year", "cls", "type", "danger", "iso3", "more", "id", "name", "zh", "img", "by", "lic"]
SCALE = {"lon": 0.01, "lat": 0.01, "year": 1, "cls": 1, "type": 1, "danger": 1, "id": 1}
TEXT = ("name", "zh", "img", "by")


def add_photos(rows: list[dict]) -> None:
    """每個遺產補上照片（img：Commons 的縮圖路徑、by：攝影者、lic：授權）；Wikidata 沒有照片、Commons 已經刪掉的是 None"""
    first: dict[str, str] = {}
    bindings = sorted(_cached("world-heritage-photos-2026-11-06", PHOTOS), key=lambda b: (b["id"]["value"], b["item"]["value"]))
    for b in bindings:
        first.setdefault(b["id"]["value"], commons_photos.from_url(b["img"]["value"]))
    wanted = {str(int(r["id"])): first[str(int(r["id"]))] for r in rows if str(int(r["id"])) in first}
    meta = commons_photos.metadata(list(wanted.values()))
    for r in rows:
        f = wanted.get(str(int(r["id"])))
        m = meta.get(f.replace("_", " ")) if f else None
        r["img"] = commons_photos.image_path(f) if m else None
        r["by"] = commons_photos.credit(m[0]) if m else None
        r["lic"] = m[1] if m else None
    print(f"  照片：{sum(1 for r in rows if r['img'])} / {len(rows)} 個遺產有（Wikidata 的 P18）")


def _write_sites(rows: list[dict]) -> None:
    write_points(OUT / "sites.json", points_file(rows, FIELDS, SCALE, delta=("year",), strings=("lic",)), text=TEXT)


def build_photos() -> None:
    """步驟 world-heritage-photos：現有的 sites.json 補上照片（名錄在雲端抓不到，不必重跑主步驟）"""
    rows = read_points_file(load_points_json(OUT / "sites.json"))
    add_photos(rows)
    _write_sites(rows)


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
    add_photos(rows)
    _write_sites(rows)
    # 別的步驟寫的部分（世界遺產的擴充，manifest 的 parts）留著
    old = json.loads((OUT / "manifest.json").read_text(encoding="utf-8")) if (OUT / "manifest.json").exists() else {}
    write_json(OUT / "manifest.json", {
        "topic": "world-heritage", "generatedAt": now_iso(), "lastSession": last, "counts": summary, "inDanger": len(danger),
        **({"parts": old["parts"]} if old.get("parts") else {}),
    })

    missing_zh = sum(1 for r in rows if not r["zh"])
    print(f"  全部 {summary['all']}、文化 {summary['cultural']}、自然 {summary['natural']}、複合 {summary['mixed']}、瀕危 {len(danger)}；"
          f"中文名稱 {len(rows) - missing_zh} 個（{missing_zh} 個用英文）；沒有座標 {sum(1 for r in rows if r['lon'] is None)} 個")
