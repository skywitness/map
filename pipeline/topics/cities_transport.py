"""城市：歐洲城市的通勤方式與時間、市民覺得大眾運輸好不好（2026-11-05，製作手冊第二十三批 408〔候選 1015、1020〕；
步驟 cities-transport，輸出 topics/cities/，擴充「城市」）。

- **通勤**：Eurostat Urban Audit `urb_ctran`（CC BY 4.0，sources/urban_audit.py）：搭大眾運輸 TT1010V、開車 TT1003V、走路
  TT1008V、機車 TT1006V、自行車 TT1007V 上班的比例，平均單程通勤時間 TT1019V（分鐘）。五種運具加總只在 95–105% 之間的
  城市年才用（手冊：加總從 79 到 143 都有），每個城市取最近一個合格的年份；通勤時間另外取最近一年。
- **市民的評價**：`urb_percep` 2004–2023 的城市問卷：大眾運輸便宜（PS3547V＋PS3548V，「非常同意」加「有點同意」）、安全
  （3552＋3553）、容易搭到（3557＋3558）、班次夠密（3562＋3563）、準時（3567＋3568），取最近一次（多半是 2023 年）。
  單看「非常同意」會被各國答題習慣影響（手冊），所以合併兩級。常用運具（PS3505V 至 PS3513V）是多選題、加總 140–160%，不用。
- **城市的位置**：沿用「自行車」主題的 `urban_audit.locate()`（依名稱查 Wikidata、一國一個快取）；這次的城市都在快取裡，
  沒有新的查詢（query.wikidata.org 的 robots.txt 不准 /sparql，快取沒有的城市就不畫）。
- 英國、科索沃的城市照網站的 Eurostat 規則不收。
- 台灣沒有可以比的城市統計（交通部的「民眾日常使用運具狀況調查」在 www.motc.gov.tw，使用者沒有要求本機下載）。
"""
from __future__ import annotations

from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json
from sources import urban_audit

OUT = OUT_DIR / "topics" / "cities"
YEAR = 2026
MODES = {"pt": "TT1010V", "car": "TT1003V", "walk": "TT1008V", "moto": "TT1006V", "bike": "TT1007V"}
ASPECTS = {"cheap": 3547, "safe": 3552, "easy": 3557, "frequent": 3562, "reliable": 3567}
EXCLUDED = ("UK", "XK")  # 網站的 Eurostat 規則：歐盟、EFTA、候選國以外只准非商業


def _clean(label: str) -> tuple[str, int]:
    return label.replace(" (greater city)", ""), 1 if "(greater city)" in label else 0


def build() -> None:
    labels: dict[str, str] = {}
    modes: dict[str, dict[str, dict[int, float]]] = {}
    for key, code in MODES.items():
        lab, data = urban_audit.series("urb_ctran", code)
        labels.update(lab)
        modes[key] = data
    lab, time = urban_audit.series("urb_ctran", "TT1019V")
    labels.update(lab)
    opinion: dict[str, dict[str, tuple[int, float]]] = defaultdict(dict)
    for aspect, base in ASPECTS.items():
        lab_a, strong = urban_audit.series("urb_percep", f"PS{base}V")
        _, some = urban_audit.series("urb_percep", f"PS{base + 1}V")
        labels.update(lab_a)
        for c, s in strong.items():
            years = [y for y in s if y in some.get(c, {})]
            if years:
                y = max(years)
                opinion[aspect][c] = (y, round(s[y] + some[c][y], 1))
    labels = {c: l for c, l in labels.items() if not c.startswith(EXCLUDED)}
    for d in modes.values():
        for c in [c for c in d if c.startswith(EXCLUDED)]:
            del d[c]
    for c in [c for c in time if c.startswith(EXCLUDED)]:
        del time[c]
    for d in opinion.values():
        for c in [c for c in d if c.startswith(EXCLUDED)]:
            del d[c]
    loc = urban_audit.locate(labels)

    rows, bad = [], 0
    cities = set(modes["pt"]) | set(time)
    for c in sorted(cities):
        if not loc.get(c):
            continue
        ok = [y for y in modes["pt"].get(c, {}) if all(y in modes[k].get(c, {}) for k in MODES)
              and 95 <= sum(modes[k][c][y] for k in MODES) <= 105]
        bad += sum(1 for y in modes["pt"].get(c, {}) if y not in ok)
        t = time.get(c, {})
        if not ok and not t:
            continue
        lon, lat, _ = loc[c]
        name, greater = _clean(labels[c])
        row = {"lon": lon, "lat": lat, "n": name, "g": greater, "iso3": urban_audit.iso3(c) or ""}
        if ok:
            y = max(ok)
            row.update({k: round(modes[k][c][y], 1) for k in MODES} | {"y": y})
        if t:
            ty = max(t)
            row.update({"t": round(t[ty], 1), "ty": ty})
        rows.append(row)
    fields = ["lon", "lat", "n", "g", "iso3", *MODES, "y", "t", "ty"]
    scale = {"lon": 0.0001, "lat": 0.0001, "g": 1, "y": 1, "ty": 1, "t": 0.1, **{k: 0.1 for k in MODES}}
    write_json(OUT / "commute.json", points_file(rows, fields, scale, strings=("iso3",)))
    for ind, field in (("commute-transit", "pt"), ("commute-time", "t")):
        n = Counter(r["iso3"] for r in rows if r.get(field) is not None and r["iso3"])
        write_json(OUT / f"{ind}.json", indicator_file(ind, "個", [YEAR], {c: [v] for c, v in sorted(n.items())}, license="CC BY 4.0"))
    for aspect, by_city in opinion.items():
        pts = []
        for c, (y, v) in sorted(by_city.items()):
            if not loc.get(c):
                continue
            lon, lat, _ = loc[c]
            name, greater = _clean(labels[c])
            pts.append({"lon": lon, "lat": lat, "n": name, "g": greater, "iso3": urban_audit.iso3(c) or "", "v": v, "y": y})
        write_json(OUT / "transit-opinion" / f"{aspect}.json", points_file(
            pts, ["lon", "lat", "n", "g", "iso3", "v", "y"], {"lon": 0.0001, "lat": 0.0001, "g": 1, "v": 0.1, "y": 1}, strings=("iso3",)))
        n = Counter(p["iso3"] for p in pts if p["iso3"])
        write_json(OUT / "transit-opinion-count" / f"{aspect}.json", indicator_file(
            "transit-opinion", "個", [YEAR], {c: [v] for c, v in sorted(n.items())}, license="CC BY 4.0"))
        top = sorted(((p["v"], p["n"], p["y"]) for p in pts), reverse=True)
        print(f"  {aspect}：{len(pts)} 城（{Counter(p['y'] for p in pts).most_common(3)}）；最高 {top[:6]}；最低 {top[-4:]}")
    with_mode = [r for r in rows if "pt" in r]
    with_time = [r for r in rows if "t" in r]
    print(f"  運具 {len(with_mode)} 城（加總不在 95–105% 不用的城市年 {bad}）；年份 {Counter(r['y'] for r in with_mode).most_common(5)}")
    print(f"  大眾運輸最高 {sorted(((r['pt'], r['n'], r['y']) for r in with_mode), reverse=True)[:8]}")
    print(f"  通勤時間 {len(with_time)} 城；最長 {sorted(((r['t'], r['n'], r['ty']) for r in with_time), reverse=True)[:8]}；最短 {sorted((r['t'], r['n'], r['ty']) for r in with_time)[:4]}")
