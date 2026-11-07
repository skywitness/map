"""核電機組：機型、型號與機齡（新主題，2026-11-07，製作手冊第二十七批 622，候選 1359、1360；步驟 nuclear-reactors，
輸出 topics/nuclear-reactors/）。

- **機型與型號**：GEM Global Nuclear Power Tracker（GNPT）的公開地圖檔（2026 年 8 月版，2.4 MB、1,825 個機組，CC BY 4.0
  同 sources/gem.py），欄位 reactor-type（反應爐型式）、model（型號）、operator。核融合裝置（2 個）不算（第二十七批 719 另做）。
  反應爐型式併成 7 類＋不明：壓水式、沸水式（含進步型）、重水式（加壓重水與其他重水）、氣冷式（含高溫氣冷）、
  輕水石墨式（RBMK）、快中子式、小型模組化與微型（含熔鹽式）。
- **機齡**：GNPT 沒有年份，用 GIPT（sources/gem.py，發電廠地圖已經下載）同一個 project-id 與 unit-name 的 start-year
  （併網年份，不是首次臨界）；機齡 ＝ 2026 − 併網年份，各國用容量加權平均（手冊的陷阱：不加權的話小國的 1 部會跟美國的 94 部等重）。
- 指標：運轉中容量最大的機型（類別圖）、各機型的運轉中容量（子項目，比例圓）、運轉中機組的平均機齡（容量加權）。
  點：運轉中、興建中、規劃中（pre-construction 與 announced）的機組各一個檔，同一座電廠同一狀態同一機型併成一點，顏色是機型。
- 台灣：沒有運轉中的機組；附註用核能安全委員會「核能電廠基本資料」（data.gov.tw 109454，政府資料開放授權條款第 1 版）的
  現有運轉執照期限（民國年換西元）。
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_points
from sources import gem
from sources.countries import from_name
from topics.power_plants import COUNTRY_ALIASES

OUT = OUT_DIR / "topics" / "nuclear-reactors"
YEAR = 2026
GNPT_URL = "https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/Current_maps/gnpt/gnpt_map_2026-08.geojson"
NUSC_URL = "https://www.nusc.gov.tw/dataopen/index.php?id=105"
GEM_LICENSE = {"license": "CC BY 4.0", "attribution": "Global Energy Monitor, Global Nuclear Power Tracker (August 2026) / Global Integrated Power Tracker (September 2026)"}
# 反應爐型式 → 類別代碼（前端 nuclear-reactors.ts 的 TYPES 要一致）
TYPE_CODE = {
    "pressurized water reactor": 1,
    "boiling water reactor": 2, "advanced boiling water reactor": 2,
    "pressurized heavy water reactor": 3, "heavy water light water reactor": 3, "steam-generating heavy water reactor": 3,
    "heavy water gas-cooled reactor": 4, "gas-cooled reactor": 4, "high temperature gas reactor": 4,
    "light water graphite reactor": 5,
    "fast breeder reactor": 6, "liquid-metal-cooled fast reactor": 6, "fast neutron reactor": 6,
    "small modular reactor": 7, "microreactor": 7, "molten salt reactor": 7,
    "unknown": 8,
}
TYPE_IDS = ["pwr", "bwr", "phwr", "gas", "lwgr", "fast", "smr", "unknown"]
STATUS = {"operating": 1, "construction": 2, "pre-construction": 3, "announced": 3}


def _roc(text: str) -> str:
    y, m, d = (int(x) for x in text.strip().split("."))
    return f"{y + 1911}-{m:02d}-{d:02d}"


def _taiwan_licenses() -> list[tuple[str, str, str]]:
    path = download(NUSC_URL, "nusc", "npp-basic.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        return [(r["核能電廠基本資料"].strip(), _roc(r["核定正式運轉日期"]), _roc(r["現有運轉執照期限"])) for r in csv.DictReader(f)]


def build() -> None:
    with open(download(GNPT_URL, "gem", "gnpt_map_2026-08.geojson"), encoding="utf-8") as f:
        features = [ft["properties"] for ft in json.load(f)["features"]]
    features = [p for p in features if p.get("reactor-type") != "fusion"]
    unknown_types = sorted({p.get("reactor-type") for p in features} - set(TYPE_CODE))
    if unknown_types:
        raise RuntimeError(f"GNPT 有新的反應爐型式：{unknown_types}")
    start = {(u.plant, u.unit): u.start for u in gem.units() if u.fuel == "nuclear"}
    cache: dict[str, str | None] = {}

    def iso(name: str) -> str | None:
        if name not in cache:
            cache[name] = COUNTRY_ALIASES.get(name) or from_name(name)
        return cache[name]

    cap: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    age_w: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])  # 機齡 × MW、MW
    no_start = 0
    groups: dict[tuple, list[dict]] = defaultdict(list)
    models: dict[str, int] = defaultdict(int)
    for p in features:
        st = STATUS.get(p["status"])
        c = iso(p["country-area1"])
        code = TYPE_CODE[p["reactor-type"]]
        model = (p.get("model") or "").strip()
        if model and model != "unknown":
            models[model] += 1
        if not st or not c:
            continue
        mw = float(p.get("capacity") or 0)
        if st == 1:
            cap[c][code] += mw
            y = start.get((p["project-id"], (p.get("unit-name") or "").strip()))
            if y:
                age_w[c][0] += (YEAR - y) * mw
                age_w[c][1] += mw
            else:
                no_start += 1
        groups[(p["project-id"], st, code)].append({**p, "_iso": c, "_mw": mw, "_model": model if model and model != "unknown" else ""})
    # 各機型的容量
    for i, tid in enumerate(TYPE_IDS, start=1):
        vals = {c: [round(v[i], 1)] for c, v in sorted(cap.items()) if v.get(i)}
        if not vals:  # 小型模組化與不明沒有運轉中的機組，只出現在點
            continue
        write_json(OUT / "type-capacity" / f"{tid}.json", indicator_file(
            f"type-capacity/{tid}", "MW", [YEAR], vals, aggregates={"WLD": [round(sum(v.get(i, 0) for v in cap.values()), 1)]}, **GEM_LICENSE))
    # 容量最大的機型（不明不算，除非全部不明）
    main = {}
    for c, v in cap.items():
        known = {k: m for k, m in v.items() if k != 8 and m > 0}
        if known or v.get(8):
            main[c] = [max(known, key=known.get) if known else 8]
    lic = _taiwan_licenses()
    last = max(lic, key=lambda x: x[2])
    tw_zh = (f"台灣沒有運轉中的核電機組：最後一部 {last[0]} 的運轉執照 {last[2]} 到期（核能安全委員會「核能電廠基本資料」；"
             + "、".join(f"{n} {e[:4]} 年" for n, _, e in lic) + "）。")
    tw_en = (f"Taiwan has no operating reactors: the licence of the last one, Maanshan unit 2, expired on {last[2]} "
             "(Nuclear Safety Commission, basic data on nuclear power plants).")
    end = last[2]
    no_value = {"noValue": {"TWN": f"{int(end[:4])} 年 {int(end[5:7])} 月起沒有運轉中的機組"},
                "noValueEn": {"TWN": f"No operating reactors since {end[:7]}"},
                "notes": {"TWN": tw_zh}, "notesEn": {"TWN": tw_en}}
    write_json(OUT / "main-type.json", indicator_file("main-type", "", [YEAR], dict(sorted(main.items())), **no_value, **GEM_LICENSE))
    # 容量加權的平均機齡
    ages = {c: [round(a / w, 1)] for c, (a, w) in sorted(age_w.items()) if w > 0}
    world = sum(a for a, _ in age_w.values()) / sum(w for _, w in age_w.values())
    write_json(OUT / "fleet-age.json", indicator_file("fleet-age", "年", [YEAR], ages, aggregates={"WLD": [round(world, 1)]},
                                                      **no_value, **GEM_LICENSE))
    # 點
    rows = []
    for (_pid, st, code), us in groups.items():
        m = max(us, key=lambda u: u["_mw"])
        ms = defaultdict(int)
        for u in us:
            if u["_model"]:
                ms[u["_model"]] += 1
        starts = [start.get((u["project-id"], (u.get("unit-name") or "").strip())) for u in us]
        starts = [s for s in starts if s]
        rows.append({
            "lon": m["Longitude"], "lat": m["Latitude"], "mw": round(sum(u["_mw"] for u in us), 1), "type": code, "st": st,
            "units": len(us), "start": min(starts) if starts and st == 1 else None, "iso3": m["_iso"], "name": m["name"],
            "model": "、".join(f"{k}{f' ×{n}' if n > 1 else ''}" for k, n in sorted(ms.items(), key=lambda x: -x[1])),
            "operator": (m.get("operator") or "").strip(),
        })
    rows.sort(key=lambda r: -r["mw"])
    for st, name in ((1, "operating"), (2, "construction"), (3, "planned")):
        part = [r for r in rows if r["st"] == st]
        data = points_file(part, ["lon", "lat", "mw", "type", "st", "units", "start", "iso3", "name", "model", "operator"],
                           {"lon": 0.001, "lat": 0.001, "mw": 0.1, "type": 1, "st": 1, "units": 1, "start": 1}, strings=("iso3",))
        write_points(OUT / f"reactors-{name}.json", {**data, **GEM_LICENSE}, text=("name", "model", "operator"))
    # 印出來核對手冊
    op = [p for p in features if p["status"] == "operating"]
    print(f"  GNPT（不含核融合）{len(features)} 部；運轉中 {len(op)} 部 {sum(float(p['capacity']) for p in op):,.0f} MW、"
          f"{len({iso(p['country-area1']) for p in op})} 國；GIPT 對不到併網年份的運轉中機組 {no_start} 部")
    t = defaultdict(int)
    for p in features:
        t[p["reactor-type"]] += 1
    print("    機型（全部狀態）：" + "、".join(f"{k} {n}" for k, n in sorted(t.items(), key=lambda x: -x[1])))
    print("    型號：" + "、".join(f"{k} {n}" for k, n in sorted(models.items(), key=lambda x: -x[1])[:14]))
    counts = defaultdict(int)
    for v in main.values():
        counts[TYPE_IDS[v[0] - 1]] += 1
    print(f"    主要機型（國數）：{dict(counts)}；非壓水式：" + "、".join(f"{c}={TYPE_IDS[v[0] - 1]}" for c, v in main.items() if v[0] != 1))
    print(f"  平均機齡（容量加權）世界 {world:.1f}：" + "、".join(f"{c} {v[0]}" for c, v in sorted(ages.items(), key=lambda x: -x[1][0])))
    print(f"  點 {len(rows)} 個；{tw_zh}")
