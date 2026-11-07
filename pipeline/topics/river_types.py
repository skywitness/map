"""河流的 127 種河段（2026-11-07，製作手冊第二十七批 548，候選 1237；擴充「河流與流域」；步驟 river-types，
輸出到 topics/rivers/）。

資料：GloRiC v1.0（sources/gloric.py）。每一段河道依出口（線的最後一點）落在哪一國算那一國，跟 topics/rivers.py 一樣。
GloRiC 有 38 萬段（288.7 萬公里，全球的 8%）沒有分類（乾旱或冰河地區缺氣候濕度、或平均流量是 0），比例的分母只算
有分類的河段；有分類的河段不到一半（埃及、利比亞、格陵蘭、卡達、科威特、巴林）或不到 100 公里的地方不放。

- reach-types.json：國內有幾種河段類型（127 種裡，國內合計 10 公里以上的才算，國界附近零星一兩段不算）。
- reach-steep.json：水流力中到強的河段占河道長度的比例（127 種的第 3 位是 2；水流力＝水的密度×重力×流量×坡度，
  有水量又陡的山區河段）。
- 第 3 位是 3 的「受湖泊或濕地影響」不另外做成地圖：GloRiC 的這個旗標來自 2004 年的 GLWD，芬蘭只有 0.6%、
  孟加拉 70.5%，抓到的多半是氾濫平原與沼澤、不是湖，當成「湖泊」會誤導；側欄的類型名稱照樣寫。
- reach-top.json（側欄）：國內最長的 5 種河段類型與比例、有幾種。
"""
from __future__ import annotations

import numpy as np

import geoindex
from common import indicator_file, write_json
from sources import gloric
from topics.rivers import OUT, YEAR

MIN_TYPE_KM = 10  # 國內合計這麼長的河段類型才算「有」
MIN_KM = 100  # 有分類的河段少於這個長度不放
MIN_CLASSIFIED = 0.5  # 有分類的河段至少要占這一國河道長度的一半
TOP = 5
STEEP = 2  # 河段類型的最後一位（地形）：1 水流力弱、2 中到強、3 受湖泊或濕地影響、0 很大的河（不分）


def build() -> None:
    r = gloric.reaches()
    iso = np.array(geoindex.countries_at(r["lon"], r["lat"]), dtype=object)
    length = r["length"].astype(np.float64)
    rtype = r["type"].astype(np.int64)
    codes = sorted({c for c in set(iso.tolist()) if c})
    idx = {c: i for i, c in enumerate(codes)}
    ci = np.array([idx[c] if c else -1 for c in iso], dtype=np.int64)
    types = sorted(set(rtype.tolist()) - {0})
    ti = np.full(int(rtype.max()) + 1, -1, np.int64)
    ti[types] = np.arange(len(types))
    tt = ti[rtype]
    total = np.bincount(ci[ci >= 0], weights=length[ci >= 0], minlength=len(codes))
    ok = (ci >= 0) & (tt >= 0)
    by_type = np.zeros((len(codes), len(types)))
    np.add.at(by_type, (ci[ok], tt[ok]), length[ok])
    classified = by_type.sum(axis=1)
    geom = np.array([t % 10 for t in types])
    print(f"  {len(types)} 種河段類型；沒有分類的河段 {int((rtype == 0).sum()):,} 段、{length[rtype == 0].sum():,.0f} 公里；"
          f"找不到國家 {int((ci < 0).sum())} 段")

    counts: dict[str, list[float]] = {}
    steep: dict[str, list[float]] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    top: dict[str, dict] = {}
    skipped = []
    for c, i in idx.items():
        if classified[i] < MIN_KM or classified[i] < MIN_CLASSIFIED * total[i]:
            skipped.append(c)
            continue
        row = by_type[i]
        n = int((row >= MIN_TYPE_KM).sum())
        counts[c] = [n]
        steep[c] = [round(float(100 * row[geom == STEEP].sum() / classified[i]), 1)]
        km = f"{classified[i]:,.0f}"
        hints[c] = f"有分類的河道 {km} 公里"
        hints_en[c] = f"{km} km of classified rivers"
        order = np.argsort(-row)[:TOP]
        top[c] = {"n": n, "km": round(float(classified[i])),
                  "top": [[int(types[j]), round(float(100 * row[j] / classified[i]), 1)] for j in order if row[j] > 0]}
    world = by_type.sum(axis=0)
    common = {"hints": hints, "hintsEn": hints_en}
    write_json(OUT / "reach-types.json", indicator_file("reach-types", "types", [YEAR], counts, **common))
    write_json(OUT / "reach-steep.json", indicator_file(
        "reach-steep", "%", [YEAR], steep, aggregates={"WLD": [round(float(100 * world[geom == STEEP].sum() / world.sum()), 1)]}, **common))
    write_json(OUT / "reach-top.json", {"countries": top})

    print(f"  有值 {len(counts)} 國或地區；不放 {len(skipped)}：{sorted(skipped)}")
    for name, d in (("類型數", counts), ("水流力強", steep)):
        best = sorted(d.items(), key=lambda kv: -kv[1][0])[:14]
        print(f"  {name}：" + "、".join(f"{c} {v[0]}" for c, v in best))
    print(f"  世界：水流力強 {100 * world[geom == STEEP].sum() / world.sum():.1f}%")
    for c in ("TWN", "JPN", "CHN", "USA", "NLD", "CHE", "NPL", "FIN", "CAN", "BGD", "BRA"):
        print(f"  {c}：{counts.get(c)} 種、水流力強 {steep.get(c)}、{top.get(c)}")
