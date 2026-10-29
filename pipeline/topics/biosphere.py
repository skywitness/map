"""生物圈保護區（世界遺產主題的擴充，2026-10-29）：UNESCO「人與生物圈計畫」（MAB）的生物圈保護區，點與各國的處數。

**來源**：Wikidata（CC0），SPARQL 查有 P2520（UNESCO Biosphere Reserve URL）或 P1435 = Q158454（生物圈保護區）的項目，
已除名的（P576）不收。UNESCO 的網站（unesco.org/en/mab）的使用條款禁止大量擷取資料庫，只拿來核對總數（2026 年 797 處）。
使用者決定（2026-10-29）：先只做生物圈保護區，世界地質公園等 Wikidata 補齊再加。

**清理**（Wikidata 同一處常有好幾個項目：國家公園與保護區各一個、新舊兩種 UNESCO 網址各一個）：
1. 網址的代稱相同的是同一處：新網址 `unesco.org/en/mab/<代稱>`、舊網址 `.../biosphere-reserves/<區域>/<國家>/<代稱>/`、
   `en.unesco.org/biosphere/<區域>/<代稱>`、更舊的 `mabdb/...?code=SPA+33`（國家代碼加編號）。
2. 同一國裡英文名稱（拿掉 biosphere、reserve、national park 這類字）相同、或一個包含另一個（6 個字元以上）的是同一處。
3. 一處保留名稱裡有 Biosphere／Biosfera 的項目（沒有的取編號小的），座標用它的，沒有就用同一處其他項目的；國家合併。
跨國的保護區每一國都算一次（跟世界遺產一樣）。

**輸出**（public/data/topics/world-heritage/）：biosphere-points.json（點：經緯度、英文與中文名稱、國家）、
biosphere.json（國家不上色，只有世界遺產名錄最新的那一年）。使用者決定只畫點、不做各國的處數：去重後 709 處，
UNESCO 公布 797 處，而且有已除名沒標的（美國 2017 年撤出的一批）。
"""
from __future__ import annotations

import json
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, points_file, write_json
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "world-heritage"
SPARQL = "https://query.wikidata.org/sparql"
QUERY = """
SELECT ?item ?url ?country ?cc ?coord ?dissolved WHERE {
  { ?item wdt:P2520 ?url } UNION { ?item wdt:P1435 wd:Q158454 }
  OPTIONAL { ?item wdt:P2520 ?url }
  OPTIONAL { ?item wdt:P17 ?country . OPTIONAL { ?country wdt:P297 ?cc } }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P576 ?dissolved }
}"""
STOP = r"\b(biosphere|biosfera|biósfera|reserve|reserva|r[ée]serve|national|nature|natural|park|parque|parc|nacional|the|and|y|e|of|de|la|del|du|des|area|region)\b"


def query() -> list[dict]:
    path = CACHE_DIR / "wikidata" / "biosphere-reserves.json"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(
            SPARQL, data=urllib.parse.urlencode({"query": QUERY}).encode(),
            headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"},
        )
        for _ in range(6):
            try:
                with urllib.request.urlopen(req, timeout=180) as r:
                    path.write_bytes(r.read())
                break
            except urllib.error.HTTPError as err:
                if err.code not in (429, 500, 502, 503, 504):
                    raise
                time.sleep(int(err.headers.get("Retry-After") or 15) + 1)
        else:
            raise RuntimeError("Wikidata 的 SPARQL 一直失敗，稍後再跑")
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def _slug(url: str) -> str | None:
    for pattern in (r"/mab/(?:50anniversary/\w+/)?([a-z0-9-]+)", r"/biosphere-reserves/[^/]+/[^/]+/([a-z0-9-]+)/?$",
                    r"/biosphere/[a-z-]+/([a-z0-9-]+)"):
        m = re.search(pattern, url)
        if m:
            return "s:" + m.group(1)
    m = re.search(r"code=([A-Z]+)\+(\d+)", url)
    return f"c:{m.group(1)}{m.group(2)}" if m else None


def _norm(name: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", re.sub(STOP, " ", (name or "").lower())).strip()


def build() -> None:
    from topics.reads import wikidata_labels

    rows = query()
    items: dict[str, dict] = {}
    for r in rows:
        q = r["item"]["value"].rsplit("/", 1)[1]
        d = items.setdefault(q, {"urls": set(), "countries": set(), "coord": None, "dissolved": False})
        if "url" in r:
            d["urls"].add(r["url"]["value"])
        if "cc" in r and (iso3 := from_alpha2(r["cc"]["value"])):
            d["countries"].add(iso3)
        if "coord" in r and not d["coord"]:
            m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"]["value"])
            if m:
                d["coord"] = (float(m.group(1)), float(m.group(2)))
        if "dissolved" in r:
            d["dissolved"] = True
    live = {q: d for q, d in items.items() if not d["dissolved"]}
    labels = wikidata_labels(set(live))
    print(f"  Wikidata：{len(items)} 個項目，除名 {len(items) - len(live)} 個")

    # 併查集：網址代稱相同、同一國名稱相同的併成一處
    parent = {q: q for q in live}

    def find(q: str) -> str:
        while parent[q] != q:
            parent[q] = parent[parent[q]]
            q = parent[q]
        return q

    def union(a: str, b: str) -> None:
        parent[find(a)] = find(b)

    by_slug: dict[str, str] = {}
    for q, d in live.items():
        for s in {_slug(u) for u in d["urls"]} - {None}:
            if s in by_slug:
                union(q, by_slug[s])
            else:
                by_slug[s] = q
    by_country: dict[str, list[str]] = defaultdict(list)
    for q, d in live.items():
        for c in d["countries"]:
            by_country[c].append(q)
    for qs in by_country.values():
        for i, a in enumerate(qs):
            na = _norm((labels.get(a) or [None, None])[1])
            for b in qs[i + 1 :]:
                nb = _norm((labels.get(b) or [None, None])[1])
                if na and nb and (na == nb or (len(na) > 5 and na in nb) or (len(nb) > 5 and nb in na)):
                    union(a, b)
    groups: dict[str, list[str]] = defaultdict(list)
    for q in live:
        groups[find(q)].append(q)

    points, counts = [], defaultdict(int)
    for members in groups.values():
        def rank(q: str) -> tuple[int, int]:
            en = ((labels.get(q) or [None, None])[1] or "").lower()
            return (0 if re.search(r"biosph|biosfera|biósfera", en) else 1, int(q[1:]))

        rep = min(members, key=rank)
        countries = sorted(set().union(*(live[q]["countries"] for q in members)))
        for c in countries:
            counts[c] += 1
        coord = live[rep]["coord"] or next((live[q]["coord"] for q in members if live[q]["coord"]), None)
        zh, en = labels.get(rep) or [None, None]
        if not zh:
            zh = next(((labels.get(q) or [None])[0] for q in members if (labels.get(q) or [None])[0]), None)
        if coord:
            points.append({"lon": round(coord[0], 3), "lat": round(coord[1], 3), "name": en or rep, "zh": zh,
                           "iso3": countries[0] if countries else None, "more": ",".join(countries[1:]) or None, "q": rep})
    print(f"  去重後 {len(groups)} 處（UNESCO 公布 797 處），{len(points)} 處有座標；{len(counts)} 國")
    print(f"  最多：{sorted(counts.items(), key=lambda kv: -kv[1])[:10]}")

    with open(OUT / "manifest.json", encoding="utf-8") as f:
        last = json.load(f)["lastSession"]
    # 使用者決定（2026-10-29）只畫點、不做各國的處數（Wikidata 不完整，也有已除名沒標的）：指標檔只給時間軸那一年
    write_json(OUT / "biosphere.json", indicator_file("biosphere", "", [last], {}))
    points.sort(key=lambda p: p["lon"])
    write_json(OUT / "biosphere-points.json", points_file(
        points, ["lon", "lat", "name", "zh", "iso3", "more", "q"], {"lon": 0.001, "lat": 0.001}, delta=("lon",)))


if __name__ == "__main__":
    build()
