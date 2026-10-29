"""各國的特色食物（新主題，社會類，2026-10-29，製作手冊第五批 60）：Wikidata（CC0）的乳酪、麵包、甜點，依原產國（P495）。

使用者 2026-10-29 決定：候選 309（乳酪與麵包）、310（甜點）合成一個主題，三個子項目；不做國家排名，重點放在側欄的清單。

- 收哪些：分別是乳酪（Q10943）、麵包（Q7802）、甜點（Q182940）的實例或（間接）子類別，而且有原產國的。Wikidata 的乳酪、
  麵包有兩種寫法（「是一種乳酪」或「是乳酪的子類別」），兩種都收、去重。同一個項目可以同時是麵包與甜點（台灣的兩相好）。
- 原產國用 P495 的國家；國家項目沒有 ISO 代碼的（荷蘭 Q55 2026-10 沒有）手動對（COUNTRY_FIX）；蘇聯、奧匈帝國這類
  已經不存在的國家不收。
- 數量反映的是 Wikidata 編者收錄的多寡（義大利的甜點、法國的乳酪特別多），不是真的種類多少，所以地圖上的比例圓不排名。
- EXCLUDE：分類錯的（台灣的筒仔米糕被標成甜點）。
"""
from __future__ import annotations

import json
import re
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, indicator_file, now_iso, write_json
from sources import wikidata_attractions
from sources.countries import from_alpha2
from sources.wikidata_attractions import _sparql

OUT = OUT_DIR / "topics" / "foods"
YEAR = 2026
KINDS = {"cheese": "Q10943", "bread": "Q7802", "dessert": "Q182940"}
COUNTRY_FIX = {"Q55": "NL", "Q29999": "NL"}
EXCLUDE = {"Q7215544"}  # 筒仔米糕（英文標籤 tube rice pudding）：是鹹的米食，不是甜點
QUERY = """SELECT ?item ?country ?cc ?sl ?en ?mul ?zhtw ?zhhant ?zh WHERE {{
  {{ ?item wdt:P31 wd:{cls} }} UNION {{ ?item wdt:P279+ wd:{cls} }}
  ?item wdt:P495 ?country ; wikibase:sitelinks ?sl .
  OPTIONAL {{ ?country wdt:P297 ?cc }}
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
}}"""


def fetch(kind: str) -> list[dict]:
    path = CACHE_DIR / "wikidata" / f"foods-{kind}.json"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(_sparql(QUERY.format(cls=KINDS[kind]))), encoding="utf-8")
    return json.loads(path.read_text(encoding="utf-8"))


def build() -> None:
    from opencc import OpenCC

    s2tw, s2twp = OpenCC("s2tw"), OpenCC("s2twp")
    items: dict[str, dict[str, dict]] = {}
    for kind in KINDS:
        found: dict[str, dict] = {}
        for r in fetch(kind):
            v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
            q = v("item").rsplit("/", 1)[1]
            if q in EXCLUDE:
                continue
            d = found.setdefault(q, {"q": q, "cc": set(), "sl": int(v("sl"))})
            cc = v("cc") or COUNTRY_FIX.get(v("country").rsplit("/", 1)[1])
            if cc:
                d["cc"].add(cc)
            for k in ("en", "mul", "zhtw", "zhhant", "zh"):
                if v(k) and not d.get(k):
                    d[k] = v(k)
        items[kind] = found
    missing = sorted({q for found in items.values() for q, d in found.items() if not (d.get("en") or d.get("mul"))})
    names = wikidata_attractions.fallback_names(missing)

    by_country: dict[str, dict[str, list]] = defaultdict(lambda: {k: [] for k in KINDS})
    counts: dict[str, dict[str, int]] = {k: defaultdict(int) for k in KINDS}
    for kind, found in items.items():
        for d in found.values():
            countries = sorted({iso for cc in d["cc"] if (iso := from_alpha2(cc))})
            if not countries:
                continue
            zh = s2tw.convert(d.get("zhtw") or d.get("zhhant")) if d.get("zhtw") or d.get("zhhant") else (
                s2twp.convert(d["zh"]) if d.get("zh") else None)
            en = d.get("en") or d.get("mul") or names.get(d["q"]) or d["q"]
            # 中文標籤後面的括號說明（「切達乳酪（英國）」）拿掉
            zh = re.sub(r"\s*[（(][^）)]*[）)]$", "", zh) if zh else None
            for iso in countries:
                by_country[iso][kind].append([zh if zh and zh != en else None, en, d["sl"], d["q"]])
                counts[kind][iso] += 1

    OUT.mkdir(parents=True, exist_ok=True)
    for kind in KINDS:
        write_json(OUT / "count" / f"{kind}.json", indicator_file(
            f"count/{kind}", "種", [YEAR], {iso: [n] for iso, n in sorted(counts[kind].items())}))
    for iso, lists in by_country.items():
        for rows in lists.values():
            rows.sort(key=lambda r: (-r[2], r[1]))
        write_json(OUT / "countries" / f"{iso}.json", {"fields": ["zh", "en", "sitelinks", "qid"], **lists}, quiet=True)
    write_json(OUT / "manifest.json", {"topic": "foods", "generatedAt": now_iso(), "sources": ["Wikidata (CC0)"]})
    for kind in KINDS:
        top = sorted(((n, iso) for iso, n in counts[kind].items()), reverse=True)
        total = sum(1 for d in items[kind].values() if d["cc"])
        print(f"  {kind}：{total} 種有原產國、{len(counts[kind])} 國；最多 {top[:8]}；台灣 "
              f"{[r[0] or r[1] for r in by_country.get('TWN', {}).get(kind, [])]}")


if __name__ == "__main__":
    build()
