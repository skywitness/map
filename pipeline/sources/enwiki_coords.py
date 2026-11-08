"""英文維基條目 → Wikidata 的座標與中文名稱（經 QLever：sources/qlever_wikidata.py；2026-11-08，製作手冊第二十七批 648）。

- 不用 attractions_extra.wiki_items：它查 query.wikidata.org/sparql，那裡的 robots.txt 禁止 /sparql（2026-11-08 讀過）。
- 轉址的連結（HTML 裡 class="mw-redirect"）在 Wikidata 的 sitelink 對不到：讀 `/wiki/<條目>`（robots.txt 允許）的
  "wgPageName" 換成目標條目再查；不讀 /w/index.php?action=raw（robots.txt 禁止 /w/）。
"""
from __future__ import annotations

import hashlib
import json
import re
import urllib.parse

from common import download
from sources import qlever_wikidata
from zh_names import wikidata_zh


def resolve(title: str) -> str:
    """轉址的條目 → 目標條目（讀 /wiki/ 的頁面；快取在 .cache/wikipedia/）"""
    name = re.sub(r"[^A-Za-z0-9]+", "-", title)[:80]
    path = download(f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}", "wikipedia", f"page-{name}.html")
    m = re.search(r'"wgPageName":"((?:[^"\\]|\\.)*)"', path.read_text(encoding="utf-8"))
    return json.loads(f'"{m.group(1)}"').replace("_", " ") if m else title


def _quote(title: str) -> str:
    return urllib.parse.quote(title.replace(" ", "_"), safe="/:,()'!_-.~")


def coords(titles: list[str], key: str) -> dict[str, dict]:
    """{條目: {qid, lon, lat, zh}}；查不到的不放"""
    titles = sorted(set(t for t in titles if t))
    out: dict[str, dict] = {}

    def lookup(batch: list[str], tag: str) -> dict[str, dict]:
        found: dict[str, dict] = {}
        if not batch:
            return found
        values = " ".join(f"<https://en.wikipedia.org/wiki/{_quote(t)}>" for t in batch)
        digest = hashlib.sha1(values.encode()).hexdigest()[:10]
        rows = qlever_wikidata.cached(f"{key}-{tag}-{digest}", """SELECT ?a ?i ?c ?zhtw ?zhhant ?zh WHERE {
  VALUES ?a { %s }
  ?a schema:about ?i . ?i wdt:P625 ?c .
  OPTIONAL { ?i rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?i rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?i rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}""" % values)
        back = {f"https://en.wikipedia.org/wiki/{_quote(t)}": t for t in batch}
        for r in rows:
            t = back.get(r["a"]["value"])
            m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["c"]["value"], re.I)
            if not t or not m or t in found:
                continue
            v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
            found[t] = {"qid": r["i"]["value"].rsplit("/", 1)[1], "lon": float(m.group(1)), "lat": float(m.group(2)),
                        "zh": wikidata_zh(v("zhtw") or v("zhhant"), v("zh"), place=True, terms=False)}
        return found

    out.update(lookup(titles, "a"))
    missing = [t for t in titles if t not in out]
    targets = {t: resolve(t) for t in missing}
    more = lookup(sorted({v for k, v in targets.items() if v != k}), "b")
    for t, target in targets.items():
        if target in more:
            out[t] = more[target]
    return out
