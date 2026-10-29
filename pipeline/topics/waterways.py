"""運河與海峽（航運與港口主題的疊加圖層，2026-10-29，製作手冊第五批 55）。

使用者 2026-10-29 決定：畫 IMF PortWatch 的 28 個航運咽喉加年度通過數；運河、海峽只畫有英文維基百科條目的；
不做每天通過數的時間軸。

- 航運咽喉（chokepoints.json）：sources/portwatch.py。每天的通過船數加總成整年的（2019 年起，只收整年都有資料的年份），
  點的大小是最近一整年的通過數，tooltip 另外寫 2019 年與各類船的數量。IMF 條款（註明來源即可轉載、改作）。
- 運河與海峽（waterways.json）：Wikidata（CC0）直接標成運河（Q12284）、通航運河（Q949819）或海峽（Q37901）、
  有座標也有英文維基百科條目的。直接標成運河的有 4 萬多筆，多半是美國、印度、泰國的灌溉渠與排水溝，
  有英文條目的才畫（約 1,000 筆）。Wikidata 只有一個點，運河畫不出線。英文名用英文維基條目的標題。
"""
from __future__ import annotations

import json
import re

from common import CACHE_DIR, OUT_DIR, points_file, write_json
from geoindex import countries_at
from sources import portwatch
from sources.wikidata_attractions import _sparql

OUT = OUT_DIR / "topics" / "shipping"
CANAL, STRAIT = 1, 2
CLASSES = {"Q12284": CANAL, "Q949819": CANAL, "Q37901": STRAIT}
QUERY = """SELECT ?item ?cls ?coord ?sl ?title ?open ?inc ?len ?width ?zhtw ?zhhant ?zh WHERE {{
  VALUES ?cls {{ {classes} }}
  ?item wdt:P31 ?cls ; wdt:P625 ?coord ; wikibase:sitelinks ?sl .
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  OPTIONAL {{ ?item wdt:P1619 ?open }}
  OPTIONAL {{ ?item wdt:P571 ?inc }}
  OPTIONAL {{ ?item p:P2043/psn:P2043/wikibase:quantityAmount ?len }}
  OPTIONAL {{ ?item p:P2049/psn:P2049/wikibase:quantityAmount ?width }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
}}"""
# PortWatch 咽喉的中文名（依編號）
CHOKEPOINT_ZH = {
    "chokepoint1": "蘇伊士運河", "chokepoint2": "巴拿馬運河", "chokepoint3": "博斯普魯斯海峽", "chokepoint4": "曼德海峽",
    "chokepoint5": "麻六甲海峽", "chokepoint6": "荷莫茲海峽", "chokepoint7": "好望角", "chokepoint8": "直布羅陀海峽",
    "chokepoint9": "多佛海峽", "chokepoint10": "松德海峽", "chokepoint11": "台灣海峽", "chokepoint12": "朝鮮海峽",
    "chokepoint13": "津輕海峽", "chokepoint14": "呂宋海峽", "chokepoint15": "龍目海峽", "chokepoint16": "翁拜海峽",
    "chokepoint17": "渤海海峽", "chokepoint18": "托雷斯海峽", "chokepoint19": "巽他海峽", "chokepoint20": "望加錫海峽",
    "chokepoint21": "麥哲倫海峽", "chokepoint22": "猶加敦海峽", "chokepoint23": "向風海峽", "chokepoint24": "莫納海峽",
    "chokepoint25": "巴拉巴克海峽", "chokepoint26": "白令海峽", "chokepoint27": "民都洛海峽", "chokepoint28": "刻赤海峽",
}


def _year(v: str | None) -> int | None:
    m = re.match(r"(-?\d{4})-", v or "")
    return int(m.group(1)) if m else None


def chokepoints() -> None:
    points = portwatch.chokepoints()
    annual, last_day = portwatch.annual()
    years = sorted({y for s in annual.values() for y in s})
    last = years[-1]
    rows = []
    for p in points:
        s = annual.get(p["id"], {})
        if p["id"] not in CHOKEPOINT_ZH:
            raise RuntimeError(f"PortWatch 多了一個咽喉，要補中文名：{p}")
        latest = s.get(last, {})
        rows.append({
            "lon": round(p["lon"], 3), "lat": round(p["lat"], 3), "yr": last, "n": latest.get("total"),
            "y0": years[0], "n0": s.get(years[0], {}).get("total"),
            **{k: latest.get(t) for k, t in (("c", "container"), ("b", "dry_bulk"), ("g", "general_cargo"),
                                               ("r", "roro"), ("t", "tanker"))},
            "en": p["name"], "zh": CHOKEPOINT_ZH[p["id"]],
        })
    rows.sort(key=lambda r: -(r["n"] or 0))
    fields = ["lon", "lat", "yr", "n", "y0", "n0", "c", "b", "g", "r", "t", "en", "zh"]
    scale = {"lon": 0.001, "lat": 0.001, **{k: 1 for k in ("yr", "n", "y0", "n0", "c", "b", "g", "r", "t")}}
    write_json(OUT / "chokepoints.json", points_file(rows, fields, scale))
    print(f"  航運咽喉 {len(rows)} 個，{years[0]}–{last} 年（資料到 {last_day}）；{last} 年通過最多："
          f"{[(r['zh'], r['n']) for r in rows[:6]]}")


def waterways() -> None:
    from opencc import OpenCC

    s2tw, s2twp = OpenCC("s2tw"), OpenCC("s2twp")
    path = CACHE_DIR / "wikidata" / "waterways.json"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(_sparql(QUERY.format(classes=" ".join(f"wd:{q}" for q in CLASSES)))), encoding="utf-8")
    items: dict[str, dict] = {}
    for r in json.loads(path.read_text(encoding="utf-8")):
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("item").rsplit("/", 1)[1]
        d = items.setdefault(q, {"kinds": set(), "open": set(), "inc": set(), "sl": int(v("sl")), "en": v("title")})
        d["kinds"].add(CLASSES[v("cls").rsplit("/", 1)[1]])
        if "coord" not in d and (c := v("coord") or "").startswith("Point("):
            lon, lat = c[6:-1].split()
            d["coord"] = (float(lon), float(lat))
        for k in ("open", "inc"):
            if (y := _year(v(k))) is not None:
                d[k].add(y)
        for k in ("len", "width"):
            if v(k) and k not in d:
                d[k] = float(v(k))
        for k in ("zhtw", "zhhant", "zh"):
            if v(k) and k not in d:
                d[k] = v(k)
    rows = []
    for q, d in items.items():
        if "coord" not in d:
            continue
        zh = d.get("zhtw") or d.get("zhhant")
        zh = s2tw.convert(zh) if zh else (s2twp.convert(d["zh"]) if d.get("zh") else None)
        kind = STRAIT if STRAIT in d["kinds"] and CANAL not in d["kinds"] else (CANAL if CANAL in d["kinds"] else STRAIT)
        opened = min(d["open"]) if d["open"] else (min(d["inc"]) if d["inc"] else None)
        rows.append({
            "lon": round(d["coord"][0], 4), "lat": round(d["coord"][1], 4), "k": kind, "sl": d["sl"],
            "y": opened if kind == CANAL and opened and 0 < opened <= 2026 else None,
            "l": round(d["len"]) if d.get("len") and d["len"] >= 10 else None,
            "w": round(d["width"]) if kind == STRAIT and d.get("width") else None,
            "en": d["en"], "zh": zh if zh and zh != d["en"] else None, "q": q,
        })
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3
    rows.sort(key=lambda r: r["sl"])  # 條目多的畫在上面
    fields = ["lon", "lat", "k", "sl", "y", "l", "w", "iso3", "en", "zh"]
    scale = {"lon": 0.0001, "lat": 0.0001, "k": 1, "sl": 1, "y": 1, "l": 1, "w": 1}
    write_json(OUT / "waterways.json", points_file(rows, fields, scale, strings=("iso3",)))
    canals = [r for r in rows if r["k"] == CANAL]
    straits = [r for r in rows if r["k"] == STRAIT]
    print(f"  運河 {len(canals)} 條、海峽 {len(straits)} 個（Wikidata，有英文維基條目）")
    print(f"  運河條目最多：{[(r['zh'] or r['en'], r['sl']) for r in sorted(canals, key=lambda r: -r['sl'])[:8]]}")
    print(f"  海峽條目最多：{[(r['zh'] or r['en'], r['sl']) for r in sorted(straits, key=lambda r: -r['sl'])[:8]]}")
    print(f"  台灣：{[(r['zh'] or r['en'], r['k']) for r in rows if r['iso3'] == 'TWN' or '臺灣' in (r['zh'] or '') or 'Taiwan' in r['en']]}")


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    chokepoints()
    waterways()


if __name__ == "__main__":
    build()
