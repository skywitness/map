"""環球的所有權與母公司 NBCUniversal（Comcast）的影視據點（2026-11-08，製作手冊第二十八批 684，候選 1531、1532；1533 不做；
擴充「環球影城」；步驟 universal-media，輸出 topics/universal/）。

- **四種所有權關係**（1531）寫在 `topics/park_ownership.py`，樂園的點與清單在 `universal`、`disney` 兩個步驟就帶上了。
- **影視據點**（1532）：手冊實測 Comcast 的所有權鏈 773 筆、62% 是美國專利、有座標的 86 筆裡一半是體育館，**鏈不能直接用**，
  照順序 676 的做法固定成手工白名單 `pipeline/data/universal/media.csv`（QID 用英文維基條目名經 sitelink 找到，2026-11-08）：
  有自己座標的建築 8 處畫點（`mapped=1`）；總部只寫到城市的單位只進清單、不畫點（手冊：落在市中心不是辦公室，Illumination 的
  總部還有一筆是「美國」）。
- **1533（Comcast 的體育館、有線電視與寬頻）不做**：手冊的建議是「拆出去或乾脆不做」，那些不屬於旅遊，而且多半只是經營管理。
- Universal Music Group 不是 Comcast 的（名字像而已），不收。
"""
from __future__ import annotations

import csv

import geoindex
from common import OUT_DIR, ROOT, points_file, write_json
from sources import qlever_wikidata as wd

OUT = OUT_DIR / "topics" / "universal"
CSV = ROOT / "pipeline" / "data" / "universal" / "media.csv"
# Wikidata 沒有英文標籤回來的
NAMES = {"Q67765302": "Peacock"}
ROLES = ["hq", "office", "studio", "broadcast", "parks", "streaming"]  # 前端 universal.ts 的 MEDIA_ROLES（代碼是索引 + 1）


def build() -> None:
    with open(CSV, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    found = wd.cached("universal-media", """SELECT ?item ?label ?coord ?hq ?hqc ?hqLabel WHERE { VALUES ?item { %s }
  OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label)="en") } OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P159 ?hq . OPTIONAL { ?hq wdt:P625 ?hqc } OPTIONAL { ?hq rdfs:label ?hqLabel FILTER(LANG(?hqLabel)="en") } } }"""
                      % " ".join(f"wd:{r['qid']}" for r in rows))
    meta: dict[str, dict] = {}
    for b in found:
        o = meta.setdefault(b["item"]["value"].rsplit("/", 1)[1], {"hqs": []})
        if "label" in b:
            o["en"] = b["label"]["value"]
        if "coord" in b and "lon" not in o:
            lon, lat = b["coord"]["value"].split("(", 1)[1].rstrip(")").split()
            o["lon"], o["lat"] = float(lon), float(lat)
        if "hqc" in b and b.get("hqLabel", {}).get("value") not in (None, "United States", "California", "New Jersey"):
            lon, lat = b["hqc"]["value"].split("(", 1)[1].rstrip(")").split()
            o["hqs"].append((b["hqLabel"]["value"], float(lon), float(lat)))
    out = []
    for r in rows:
        m = meta.get(r["qid"], {"hqs": []})
        if r["mapped"] == "1":
            if "lon" not in m:
                raise ValueError(f"{r['qid']} 沒有自己的座標")
            lon, lat, city = m["lon"], m["lat"], None
        elif m["hqs"]:
            city, lon, lat = sorted(m["hqs"])[0]
        else:
            city, lon, lat = None, None, None
        out.append({"lon": lon, "lat": lat, "qid": r["qid"], "en": m.get("en") or NAMES.get(r["qid"], r["qid"]), "role": ROLES.index(r["role"]) + 1,
                    "mapped": int(r["mapped"]), "city": city, "note": r["note"]})
    located = [o for o in out if o["lon"] is not None]
    for o, c in zip(located, geoindex.countries_at([o["lon"] for o in located], [o["lat"] for o in located])):
        o["iso3"] = c
    fields = ["lon", "lat", "qid", "en", "role", "mapped", "city", "note", "iso3"]
    scale = {"lon": 0.0001, "lat": 0.0001, "role": 1, "mapped": 1}
    write_json(OUT / "media-all.json", points_file(out, fields, scale))
    write_json(OUT / "media.json", points_file([o for o in out if o["mapped"]], fields, scale))
    print(f"  母公司的影視據點：{len(out)} 筆，畫點 {sum(o['mapped'] for o in out)}；只到城市 {[(o['en'], o['city']) for o in out if not o['mapped']]}")
