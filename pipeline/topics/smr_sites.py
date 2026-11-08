"""核能的擴充：小型模組化與微型反應爐的計畫地點（2026-11-08，製作手冊第二十七批 625，候選 1363；步驟 smr-sites，
輸出 topics/smr/，跟第二十五批 532 的 SMR 設計案放在一起）。

GEM Global Nuclear Power Tracker（2026 年 8 月版，CC BY 4.0，622 已經下載）的 reactor-type 是 small modular reactor 或
microreactor 的 208 個機組，沒有一部在運轉（手冊的陷阱：中國的 HTR-PM 與俄羅斯的浮動核電廠在 GEM 裡歸別的機型，不在這裡）。
- 指標：還在進行的機組數（興建中、施工前、已宣布），依國家；子項目分狀態。
- 點：還在進行的依狀態用不同樣式（興建中、施工前實心，已宣布淡色），擱置與取消的另一層預設關閉；同一個專案同一狀態併成一點。
  位置 173 個是大約的（GEM 的 location-accuracy）。
"""
from __future__ import annotations

import json
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_points
from sources.countries import from_name
from topics.nuclear_reactors import GNPT_URL
from topics.power_plants import COUNTRY_ALIASES

OUT = OUT_DIR / "topics" / "smr"
YEAR = 2026
TYPES = {"small modular reactor": 1, "microreactor": 2}
# 狀態代碼（前端 smr.ts 的 SITE_STATUS 要一致）
STATUS = {"construction": 1, "pre-construction": 2, "announced": 3, "shelved": 4, "cancelled": 5}
ACTIVE = {1, 2, 3}
GEM_LICENSE = {"license": "CC BY 4.0", "attribution": "Global Energy Monitor, Global Nuclear Power Tracker, August 2026 release"}


def build() -> None:
    with open(download(GNPT_URL, "gem", "gnpt_map_2026-08.geojson"), encoding="utf-8") as f:
        units = [p for p in (ft["properties"] for ft in json.load(f)["features"]) if p.get("reactor-type") in TYPES]
    cache: dict[str, str | None] = {}

    def iso(name: str) -> str | None:
        if name not in cache:
            cache[name] = COUNTRY_ALIASES.get(name) or from_name(name)
        return cache[name]

    other = sorted({p["status"] for p in units} - set(STATUS))
    if other:
        raise RuntimeError(f"SMR 有新的狀態：{other}")
    counts: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    groups: dict[tuple[str, int], list[dict]] = defaultdict(list)
    for p in units:
        c = iso(p["country-area1"])
        if not c:
            raise RuntimeError(f"國名對不到：{p['country-area1']}")
        st = STATUS[p["status"]]
        counts[c][st] += 1
        groups[(p["project-id"], st)].append({**p, "_iso": c})
    items = {"active": ACTIVE, "construction": {1}, "pre-construction": {2}, "announced": {3}}
    for k, sts in items.items():
        vals = {c: [sum(v.get(s, 0) for s in sts)] for c, v in sorted(counts.items()) if sum(v.get(s, 0) for s in sts)}
        world = sum(sum(v.get(s, 0) for s in sts) for v in counts.values())
        write_json(OUT / "projects" / f"{k}.json", indicator_file(f"projects/{k}", "部", [YEAR], vals, aggregates={"WLD": [world]}, **GEM_LICENSE))
    rows = []
    for (_pid, st), us in groups.items():
        m = max(us, key=lambda u: float(u.get("capacity") or 0))
        models = defaultdict(int)
        for u in us:
            mdl = (u.get("model") or "").strip()
            if mdl and mdl != "unknown":
                models[mdl] += 1
        rows.append({
            "lon": m["Longitude"], "lat": m["Latitude"], "mw": round(sum(float(u.get("capacity") or 0) for u in us), 1), "st": st,
            "type": TYPES[m["reactor-type"]], "units": len(us), "approx": int(m.get("location-accuracy") == "approximate"),
            "iso3": m["_iso"], "name": m["name"], "model": "、".join(f"{k}{f' ×{n}' if n > 1 else ''}" for k, n in models.items()),
        })
    rows.sort(key=lambda r: -r["mw"])
    for name, sts in (("active", ACTIVE), ("inactive", {4, 5})):
        part = [r for r in rows if r["st"] in sts]
        data = points_file(part, ["lon", "lat", "mw", "st", "type", "units", "approx", "iso3", "name", "model"],
                           {"lon": 0.001, "lat": 0.001, "mw": 0.1, "st": 1, "type": 1, "units": 1, "approx": 1}, strings=("iso3",))
        write_points(OUT / f"sites-{name}.json", {**data, **GEM_LICENSE}, text=("name", "model"))
    total = defaultdict(int)
    for v in counts.values():
        for s, n in v.items():
            total[s] += n
    print(f"  SMR／微型 {len(units)} 部 {sum(float(p['capacity']) for p in units):,.0f} MW；狀態 {dict(total)}；點 {len(rows)} 個")
    act = sorted(((c, sum(v.get(s, 0) for s in ACTIVE)) for c, v in counts.items()), key=lambda x: -x[1])
    print("    進行中：" + "、".join(f"{c} {n}" for c, n in act if n))
    print("    興建中：" + "、".join(f"{p['country-area1']} {p['name']} {p.get('model')} {p['capacity']}" for p in units if p["status"] == "construction"))
    print("    施工前：" + "、".join(f"{c} {v[2]}" for c, v in sorted(counts.items(), key=lambda x: -x[1].get(2, 0)) if v.get(2)))
