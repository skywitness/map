"""環球影城的年人次與疫情恢復率（2026-11-08，製作手冊第二十八批 682，候選 1524；擴充「環球影城」；步驟 universal-visits，
輸出 topics/universal/）。

- **單園**：2009–2024 用景點地圖已經解析的 `attractions/park-visitors.json`（英文維基「List of amusement park rankings」，
  數字原本來自 TEA／AECOM，使用者 2026-10-30 決定走維基轉引；跟迪士尼的 677 同一份），依座標配對 0.3 公里內的主題樂園
  （好萊塢、佛羅里達、冒險島、日本、北京）；**維基的單園表沒有的**（新加坡、史詩宇宙、水上樂園 Volcano Bay）與 2025 年用
  Wikidata 的 P1174（年人次，P585 年份；CC0）。兩邊重疊的年份抽查一樣（好萊塢 2019 年都是 9,147,000）。
- **集團**：順序 631 的 `theme-parks/groups.json`（同一篇維基的集團表）裡環球那一列，2009–2024 年（沒有 2020、2021），只寫在說明。
- 各國：同一國有值的樂園加總，說明寫算了哪幾座；恢復率 2024 ÷ 2019 只算兩年都有值的樂園。
- 手冊的陷阱：史詩宇宙 2025 年的 400 萬是 5 月開幕的部分年度；不要拿 2020 當基期；恢復率混著新開園，不要說成「觀光復甦」。
"""
from __future__ import annotations

import json
from collections import defaultdict

from common import OUT_DIR, indicator_file, load_points_json, points_file, read_points_file, write_json
from sources import qlever_wikidata as wd
from topics.disney import _km

OUT = OUT_DIR / "topics" / "universal"
YEARS = list(range(2009, 2026))


def build() -> None:
    places = read_points_file(load_points_json(OUT / "places-area.json"))
    parks = [p for p in places if p["kind"] != 3 and p["status"] == 1]
    tea = read_points_file(load_points_json(OUT_DIR / "topics" / "attractions" / "park-visitors.json"))
    found = wd.cached("universal-visitors", """SELECT ?item ?n ?t WHERE { VALUES ?item { %s } ?item p:P1174 ?st . ?st ps:P1174 ?n . OPTIONAL { ?st pq:P585 ?t } }"""
                      % " ".join(f"wd:{p['qid']}" for p in places))
    wdv: dict[str, dict[int, int]] = defaultdict(dict)
    for b in found:
        t = b.get("t", {}).get("value", "")[:4]
        if t.isdigit():
            wdv[b["item"]["value"].rsplit("/", 1)[1]][int(t)] = int(float(b["n"]["value"]))
    rows = []
    for p in parks:
        row = {k: p[k] for k in ("lon", "lat", "qid", "en", "zh", "iso3", "resort", "kind")}
        near = min(tea, key=lambda t: _km((float(t["lon"]), float(t["lat"])), (p["lon"], p["lat"])))
        matched = p["kind"] == 1 and _km((float(near["lon"]), float(near["lat"])), (p["lon"], p["lat"])) < 0.3
        for y in YEARS:
            v = near.get(f"v{y}") if matched else None
            row[f"v{y}"] = v if v is not None else wdv[p["qid"]].get(y)
        row["src"] = 1 if matched else 2  # 1 維基的單園表（加 Wikidata 的 2025 年），2 只有 Wikidata
        rows.append(row)
    rows.sort(key=lambda r: -(r["v2025"] or r["v2024"] or 0))
    fields = ["lon", "lat", "qid", "en", "zh", "iso3", "resort", "kind", "src"] + [f"v{y}" for y in YEARS]
    scale = {"lon": 0.0001, "lat": 0.0001, "resort": 1, "kind": 1, "src": 1, **{f"v{y}": 1 for y in YEARS}}
    write_json(OUT / "park-visits.json", points_file(rows, fields, scale))

    names = lambda rs: "、".join(r["zh"] or r["en"] for r in rs)
    by_country: dict[str, list[int | None]] = {}
    hints, hints_en = {}, {}
    for c in sorted({r["iso3"] for r in rows}):
        mine = [r for r in rows if r["iso3"] == c]
        by_country[c] = [sum(r[f"v{y}"] for r in mine if r[f"v{y}"]) or None for y in YEARS]
        hints[c] = f"有人次的樂園加總（{names(mine)}）；各年有值的才算"
        hints_en[c] = f"Total of parks with figures ({', '.join(r['en'] for r in mine)}); only parks with a figure that year"
    lic = "英文維基百科 List of amusement park rankings（CC BY-SA 4.0；數字原本來自 TEA／AECOM）與 Wikidata P1174（CC0）"
    no_value = {"TWN": "台灣沒有環球的樂園", "GBR": "英國的環球樂園在建"}
    no_value_en = {"TWN": "Taiwan has no Universal park", "GBR": "The Universal park in England is under construction"}
    write_json(OUT / "visitors.json", indicator_file(
        "visitors", "人次", YEARS, by_country, hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en, license=lic))
    rec, rec_hints, rec_hints_en = {}, {}, {}
    for c in by_country:
        both = [r for r in rows if r["iso3"] == c and r["v2019"] and r["v2024"]]
        if both:
            rec[c] = [round(sum(r["v2024"] for r in both) / sum(r["v2019"] for r in both) * 100, 1)]
            rec_hints[c] = f"2019 與 2024 年都有人次的：{names(both)}"
            rec_hints_en[c] = f"Parks with both 2019 and 2024 figures: {', '.join(r['en'] for r in both)}"
    write_json(OUT / "recovery.json", indicator_file(
        "recovery", "%", [2024], rec, hints=rec_hints, hintsEn=rec_hints_en, noValue=no_value, noValueEn=no_value_en, license=lic))

    groups = json.loads((OUT_DIR / "topics" / "theme-parks" / "groups.json").read_text(encoding="utf-8"))
    uni = next(g for g in groups["groups"] if g[0].startswith("Universal"))
    gy = dict(zip(groups["years"], uni[2]))
    print(f"  環球的集團人次（千）：2009 {gy[2009]:,}、2019 {gy[2019]:,}、2024 {gy[2024]:,}（{gy[2024] / gy[2019] * 100:.1f}%）")
    print(f"  各國恢復率 {rec}")
    for r in rows:
        print(f"    {r['en']}（{'維基＋Wikidata' if r['src'] == 1 else '只有 Wikidata'}）：2019 {r['v2019']}、2020 {r['v2020']}、2024 {r['v2024']}、2025 {r['v2025']}")
