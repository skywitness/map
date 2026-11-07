"""電廠機組的年齡、業主的母公司（2026-11-07，製作手冊第二十五批 530，候選 1208、1211；擴充「發電廠地圖」）。

GEM Global Integrated Power Tracker 2026-09（發電廠地圖同一個檔，CC BY 4.0；sources/gem.py）。運轉中的機組依 unit-id 去重
（實測沒有重複，128,100 個、8,718,912 MW）。
- 機組年齡（1208）：容量加權的平均年齡＝2026 − 啟用年（start-year 在 1900–2026 的才算；改建過的機組 GEM 記原始啟用年）。
  子項目燃煤與全部能源；運轉中容量至少 300 MW 的國家才畫（一兩座小電廠的平均沒有意義）。說明裡的排名用手冊的門檻
  （燃煤 3 GW、全部 5 GW 以上）。
- 最大母公司的占比（1211）：`parent` 欄「公司 [持股%]; 公司 [持股%]」依持股比例分容量（沒寫比例的平分），國內運轉中容量
  最多的母公司占全國的幾成。運轉中容量有 47.3% 的 parent 是空的（中國、印度、美國尤其缺），只畫 parent 有填的容量
  達 9 成以上、總容量 1 GW 以上的國家，母公司的名稱寫在附註。
輸出 public/data/topics/power-plants/{fleet-age/{coal,all},largest-parent}.json。
"""

from __future__ import annotations

import csv
import re
import sys
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import gem
from sources.countries import from_name
from topics.power_plants import COUNTRY_ALIASES

OUT = OUT_DIR / "topics" / "power-plants"
YEAR = 2026
MIN_AGE_MW = 300
MIN_COVERAGE, MIN_PARENT_MW = 0.9, 1000
EXTRA = {"license": "CC BY 4.0", "attribution": f"Global Energy Monitor, Global Integrated Power Tracker ({gem.RELEASE})"}


def _parents(text: str) -> list[tuple[str, float]]:
    parts = []
    for part in text.split(";"):
        part = part.strip()
        if not part:
            continue
        m = re.search(r"\[(\d+(?:\.\d+)?)%\]\s*$", part)
        parts.append((re.sub(r"\s*\[[^\]]*\]\s*$", "", part).strip(), float(m.group(1)) / 100 if m else None))
    if parts and all(w is None for _, w in parts):
        parts = [(n, 1 / len(parts)) for n, _ in parts]
    return [(n, w or 0.0) for n, w in parts if n.lower() not in ("unknown", "n/a", "-", "")]


def build() -> None:
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))
    path = download(gem.CSV_URL, "gem", f"integrated_map_{gem.RELEASE}.csv")
    units: dict[object, dict[str, str]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["status"].strip().lower() == "operating":
                units[r["unit-id"] or (r["project-id"], r["unit-name"])] = r
    iso: dict[str, str | None] = {}

    def iso3(name: str) -> str | None:
        if name not in iso:
            iso[name] = COUNTRY_ALIASES.get(name) or from_name(name)
        return iso[name]

    for item, pick in (("coal", lambda r: r["asset-type"] == "coal"), ("all", lambda r: True)):
        acc: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])  # 年齡×容量、有年份的容量、全部容量
        for r in units.values():
            c = iso3(r["country-area1"].strip())
            if not c or not pick(r):
                continue
            mw = float(r["capacity"] or 0)
            acc[c][2] += mw
            m = re.match(r"(\d{4})", r["start-year"] or "")
            if m and 1900 <= int(m.group(1)) <= YEAR:
                acc[c][0] += mw * (YEAR - int(m.group(1)))
                acc[c][1] += mw
        data = {c: [round(a / w, 1)] for c, (a, w, t) in sorted(acc.items()) if t >= MIN_AGE_MW and w}
        write_json(OUT / "fleet-age" / f"{item}.json", indicator_file(f"fleet-age/{item}", "years", [YEAR], data, **EXTRA))
        big = 3000 if item == "coal" else 5000
        top = sorted(((round(a / w, 1), c) for c, (a, w, t) in acc.items() if t >= big and w), reverse=True)
        print(f"  {item}：畫 {len(data)} 國；{big} MW 以上 {len(top)} 國，最老 {top[:8]}，最新 {top[-8:]}；台灣 {data.get('TWN')}")

    have: dict[str, float] = defaultdict(float)
    total: dict[str, float] = defaultdict(float)
    by: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for r in units.values():
        c = iso3(r["country-area1"].strip())
        if not c:
            continue
        mw = float(r["capacity"] or 0)
        total[c] += mw
        parents = _parents(r.get("parent", ""))
        if parents:
            have[c] += mw
            for name, w in parents:
                by[c][name] += mw * w
    data, notes, notes_en = {}, {}, {}
    for c in sorted(total):
        if total[c] < MIN_PARENT_MW or have[c] / total[c] < MIN_COVERAGE or not by[c]:
            continue
        name, mw = max(by[c].items(), key=lambda kv: kv[1])
        data[c] = [round(mw / total[c] * 100, 1)]
        notes[c] = f"最大的母公司：{name}（約 {mw:,.0f} MW）；母公司有填的容量占 {have[c] / total[c] * 100:.0f}%。"
        notes_en[c] = f"Largest parent company: {name} (about {mw:,.0f} MW); parent companies are recorded for {have[c] / total[c] * 100:.0f}% of capacity."
    write_json(OUT / "largest-parent.json", indicator_file("largest-parent", "%", [YEAR], data, notes=notes, notesEn=notes_en, **EXTRA))
    miss = 1 - sum(have.values()) / sum(total.values())
    print(f"  母公司：parent 空白 {miss:.1%}；畫 {len(data)} 國 {sorted(((v[0], k) for k, v in data.items()), reverse=True)}；台灣涵蓋 {have['TWN'] / total['TWN']:.0%}")
