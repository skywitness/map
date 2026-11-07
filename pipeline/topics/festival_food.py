"""節慶：美食、啤酒與葡萄酒節分色（2026-11-07，製作手冊第二十四批 436 合併的候選 1053；步驟 festival-food）。

美食節（Q1435951）是節慶的直接子類別，原本已經在節慶圖上；但啤酒節（Q2919327）、葡萄酒節（Q462100）是美食節的子類別，
「節慶加直接子類別」那一層查不到，同時標成節慶與美食節的也被歸在「傳統、宗教與民俗」。這一步用 QLever 查 P31 是美食節
或它的子類別（P279*）、有座標的，在現有的 festivals.json、festivals-undated.json 裡：
- 同一個位置（0.001°）的點改成種類 6（美食與飲酒節；音樂節不動）；
- 沒有的補上（月份不詳的圖層；有「每年發生的日子」的照 festivals.py 的方式放進有月份的圖層）。
重複跑結果一樣（已經是 6 的不變、已經補過的不會再補）。不整個重跑 festivals：目前的快取跟產生現有輸出時的不同，
重跑會少掉 30 個點（2026-11-07 查過），所以只改這一部分。count.json（各國節慶數）照新增的點加上去。
"""
from __future__ import annotations

import json
from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json
from geoindex import countries_at
from sources import qlever_wikidata
from topics import festivals as F
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "festivals"
MUSIC, FOOD = 2, 6


def _read(path) -> tuple[list[dict], dict]:
    d = json.loads(path.read_text(encoding="utf-8"))
    fields, cols = d["fields"], d["columns"]
    table = d.get("strings", {}).get("table") if isinstance(d.get("strings"), dict) else None
    rows = []
    for i in range(len(cols[0])):
        r = {}
        for f, col in zip(fields, cols):
            v = col[i]
            r[f] = v
        rows.append(r)
    return rows, d


def _decode(rows: list[dict], d: dict) -> list[dict]:
    """points_file 的格式還原成原本的值（scale、字串表）"""
    scale = d.get("scale", {})
    strings = d.get("strings") or {}
    table = strings.get("table", []) if isinstance(strings, dict) else []
    sfields = set(strings.get("fields", [])) if isinstance(strings, dict) else set()
    out = []
    for r in rows:
        o = {}
        for f, v in r.items():
            if f in sfields:
                o[f] = table[v] if v else None
            elif f in scale and v is not None:
                o[f] = round(v * scale[f], 6)
            else:
                o[f] = v
        out.append(o)
    return out


def build() -> None:
    food = qlever_wikidata.cached("festivals-food", F.QUERY.format(where=F.WHERE_FOOD.format(food=F.FOOD_FESTIVAL)))
    items: dict[str, dict] = {}
    for r in food:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("item").rsplit("/", 1)[1]
        d = items.setdefault(q, {"q": q, "months": set(), "sl": int(v("sl"))})
        if "coord" not in d and (p := F._point(v("coord"))):
            d["coord"] = p
        if (m := F._month(v("whenLabel"))) is not None:
            d["months"].add(m)
            d.setdefault("whens", set()).add(v("whenLabel"))
        for k in ("en", "mul", "zhtw", "zhhant", "zh"):
            if v(k) and not d.get(k):
                d[k] = v(k)
    names = qlever_wikidata.fallback_names(sorted(q for q, d in items.items() if not (d.get("en") or d.get("mul"))), "festivals-food")

    files = {name: _read(OUT / name) for name in ("festivals.json", "festivals-undated.json")}
    decoded = {name: _decode(rows, d) for name, (rows, d) in files.items()}
    where = {(round(r["lon"], 3), round(r["lat"], 3)): (name, i) for name, rows in decoded.items() for i, r in enumerate(rows)}
    recolored, added = 0, []
    for q, d in items.items():
        if "coord" not in d:
            continue
        key = (round(d["coord"][0], 3), round(d["coord"][1], 3))
        if key in where:
            name, i = where[key]
            r = decoded[name][i]
            if r["k"] not in (MUSIC, FOOD):
                r["k"] = FOOD
                recolored += 1
            continue
        en = d.get("en") or d.get("mul") or names.get(q)
        zh = wikidata_zh(d.get("zhtw") or d.get("zhhant"), d.get("zh"), place=True)
        if not (en or zh):
            continue
        month = min(d["months"]) if d["months"] else None
        day, dz, de = F.wikidata_date(d.get("whens", set()), month) if month else (None, None, None)
        added.append({"lon": key[0], "lat": key[1], "k": FOOD, "m": month, "sl": d["sl"], "src": 1, "imp": None,
                      "en": en, "zh": zh if zh and zh != en else None, "d": day, "dz": dz, "de": de, "pz": None, "pe": None})
    for r, iso3 in zip(added, countries_at([r["lon"] for r in added], [r["lat"] for r in added])):
        r["iso3"] = iso3
    fields = ["lon", "lat", "k", "m", "sl", "src", "imp", "iso3", "en", "zh", "d", "dz", "de", "pz", "pe"]
    scale = {"lon": 0.001, "lat": 0.001, "k": 1, "m": 1, "sl": 1, "src": 1, "imp": 1, "d": 1}
    dated = decoded["festivals.json"] + [r for r in added if r["m"]]
    undated = decoded["festivals-undated.json"] + [r for r in added if not r["m"]]
    dated.sort(key=lambda r: (r["m"], r["sl"]))
    undated.sort(key=lambda r: r["sl"])
    write_json(OUT / "festivals.json", points_file(dated, fields, scale, strings=("iso3", "pz", "pe")))
    write_json(OUT / "festivals-undated.json", points_file(undated, fields, scale, strings=("iso3", "pz", "pe")))
    totals: Counter = Counter(r["iso3"] for r in dated + undated if r["iso3"])
    write_json(OUT / "count.json", indicator_file("count", "個", list(range(1, 13)), {k: [n] * 12 for k, n in sorted(totals.items())}))
    kinds = Counter(r["k"] for r in dated + undated)
    print(f"  美食節與子類別：Wikidata {len(items)} 個（有座標 {sum(1 for d in items.values() if 'coord' in d)}）；"
          f"改成美食與飲酒節 {recolored}、補上 {len(added)}；種類 {sorted(kinds.items())}；節慶共 {len(dated) + len(undated)}")
    print(f"    補上的：{[(r['zh'] or r['en'], r['iso3']) for r in added][:20]}")
