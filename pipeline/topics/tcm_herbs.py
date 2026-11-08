"""中藥材從哪裡來（新主題，2026-11-08，製作手冊第二十九批 692，候選 1583、1584；步驟 tcm-herbs，輸出 topics/tcm-herbs/）。

- 藥材清單：臺灣中藥典第四版英文版每一篇的基原說明裡的學名（sources/thp.py），對 Kew WCVP 的接受種（sources/wcvp.py）；
  動物、真菌、礦物與對不上的學名不算。
- 原生地：WCVP 的 TDWG 第三級地區（只算原生，introduced、Doubtful 不算）→ 國家（台灣只算 TAI，CHS「中國東南」不算台灣與澳門）。
  **原生地不是產地**：不是現在在哪裡種、從哪裡出口。
- 指標：各國原生幾種藥典基原植物、只原生在這一國的有幾種；清單是這一國原生的種，依「原生在幾國」排，越獨特越前面。
- 清單的點：每一國一個代表點（geoindex 的國界最大一塊的頂點平均），點了移到那一國。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import thp, wcvp

OUT = OUT_DIR / "topics" / "tcm-herbs"
YEAR = 2026


def _country_points() -> dict[str, tuple[float, float]]:
    from geoindex import _countries
    out = {}
    for iso3, polygons in _countries():
        best = None
        for poly in polygons:
            ring = poly[0]
            xs = [p[0] for p in ring]
            ys = [p[1] for p in ring]
            area = (max(xs) - min(xs)) * (max(ys) - min(ys))
            if best is None or area > best[0]:
                best = (area, sum(xs) / len(xs), sum(ys) / len(ys))
        if best and iso3 not in out:
            out[iso3] = (round(best[1], 3), round(best[2], 3))
    return out


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    mono = thp.monographs()
    names = {c for m in mono for c in m["candidates"]}
    authors: dict[str, list[str]] = {}
    for m in mono:
        for c, texts in m["authors"].items():
            authors.setdefault(c, []).extend(texts)
    acc = wcvp.accepted_species(names, authors)
    species: dict[str, dict] = {}  # 接受種的 id → {name, zh: [中文名], drugs}
    for m in mono:
        for c in m["candidates"]:
            if c in acc:
                tid, tname = acc[c]
                s = species.setdefault(tid, {"name": tname, "zh": []})
                if m["zh"] not in s["zh"]:
                    s["zh"].append(m["zh"])
    regions = wcvp.native_regions(set(species))
    l3iso = wcvp.region_iso3()
    native: dict[str, set[str]] = {}
    for tid in species:
        native[tid] = {c for r in regions.get(tid, ()) for c in l3iso.get(r, [])}
    no_dist = [species[t]["name"] for t in species if not native[t]]
    by_country: dict[str, list[str]] = defaultdict(list)
    for tid, cs in native.items():
        for c in cs:
            by_country[c].append(tid)
    endemic = defaultdict(int)
    for tid, cs in native.items():
        if len(cs) == 1:
            endemic[next(iter(cs))] += 1
    lic = "CC BY 3.0（WCVP）；臺灣中藥典：政府資料開放授權條款第 1 版"
    write_json(OUT / "native.json", indicator_file("native", "種", [YEAR], {c: [len(v)] for c, v in sorted(by_country.items())}, license=lic))
    write_json(OUT / "endemic.json", indicator_file("endemic", "種", [YEAR], {c: [endemic.get(c, 0)] for c in sorted(by_country)}, license=lic))
    pts = _country_points()
    rows = []
    for c, tids in by_country.items():
        if c not in pts:
            continue
        for tid in tids:
            rows.append({"lon": pts[c][0], "lat": pts[c][1], "iso3": c, "n": len(native[tid]), "sci": species[tid]["name"],
                         "zh": "、".join(species[tid]["zh"])})
    rows.sort(key=lambda r: (r["iso3"], r["n"], r["sci"]))
    write_points(OUT / "species.json", points_file(rows, ["lon", "lat", "n", "iso3", "sci", "zh"], {"lon": 0.001, "lat": 0.001, "n": 1},
                                                   strings=("iso3",)), ("sci", "zh"))
    top = sorted(by_country.items(), key=lambda kv: -len(kv[1]))
    print(f"  藥典的篇數 {len(mono)}；學名候選 {len(names)}，對上 WCVP {len(acc)}，接受的種 {len(species)}；沒有原生分布的 {len(no_dist)}：{no_dist[:8]}")
    print(f"  WCVP 授權：{wcvp.license_text()}")
    print(f"  有原生種的國家 {len(by_country)}：" + "、".join(f"{c} {len(v)}" for c, v in top[:20]) + f"；台灣 {len(by_country.get('TWN', []))}")
    single = sorted(((species[t]["name"], "、".join(species[t]["zh"]), next(iter(cs))) for t, cs in native.items() if len(cs) == 1))
    print(f"  只原生在一國的 {len(single)} 種：" + "；".join(f"{z} {n}（{c}）" for n, z, c in single[:40]))
    print("    依國家：" + "、".join(f"{c} {v}" for c, v in sorted(endemic.items(), key=lambda kv: -kv[1])))
    wide = sorted(((len(cs), species[t]["name"], "、".join(species[t]["zh"])) for t, cs in native.items()), reverse=True)[:8]
    print("  分布最廣：" + "；".join(f"{z} {n} {k} 國" for k, n, z in wide))
    tw = sorted((species[t]["name"], "、".join(species[t]["zh"])) for t in by_country.get("TWN", []))
    print(f"  台灣原生 {len(tw)} 種；只在台灣 {endemic.get('TWN', 0)}")
