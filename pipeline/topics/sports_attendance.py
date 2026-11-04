"""運動：去現場看運動比賽的比例（2026-11-04，製作手冊第二十一批 361）。

- Eurostat `ilc_scp04`（EU-SILC 的文化與運動參與，CC BY 4.0）：16 歲以上、過去 12 個月至少去現場看過一次運動比賽
  （acl00 = AC525 Sports events、frequenc = GE1），全部地區、家戶、所得，2015 與 2022 年。用統計 API 的 JSON 篩選
  （維度名是 quant_inc 不是 quantile）。只取運動比賽，同一個資料集的電影、表演、古蹟不用。
- 英國只有 2015 年，而且非 EU／EFTA／候選國的部分只准非商業使用，不收。台灣沒有同一題的調查。
"""
from __future__ import annotations

import json

from common import OUT_DIR, download, indicator_file, to_series, write_json
from sources.eurostat import _iso3

OUT = OUT_DIR / "topics" / "sports"
URL = ("https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/ilc_scp04?format=JSON&lang=en"
       "&acl00=AC525&frequenc=GE1&deg_urb=TOTAL&hhcomp=TOTAL&quant_inc=TOTAL")
EXCLUDE = {"GBR"}  # 只准非商業使用


def build() -> None:
    data = json.loads(download(URL, "eurostat", "ilc_scp04-sport.json").read_text(encoding="utf-8"))
    dims = data["id"]
    sizes = data["size"]
    geo = data["dimension"]["geo"]["category"]["index"]
    time = data["dimension"]["time"]["category"]["index"]
    if any(s != 1 for d, s in zip(dims, sizes) if d not in ("geo", "time")):
        raise RuntimeError(f"ilc_scp04 的篩選沒有收斂到單一序列：{dict(zip(dims, sizes))}")
    n_time = len(time)
    series: dict[str, dict[int, float]] = {}
    for code, gi in geo.items():
        iso3 = _iso3(code)
        if not iso3 or iso3 in EXCLUDE:
            continue
        for year, ti in time.items():
            v = data["value"].get(str(gi * n_time + ti))
            if v is not None:
                series.setdefault(iso3, {})[int(year)] = float(v)
    years = sorted({int(y) for y in time})
    eu = {int(y): data["value"].get(str(geo["EU27_2020"] * n_time + ti)) for y, ti in time.items()} if "EU27_2020" in geo else {}
    extra = {"aggregates": {"EU27_2020": to_series({y: v for y, v in eu.items() if v is not None}, years, 1)}} if eu else {}
    write_json(OUT / "attend-sports.json", indicator_file(
        "attend-sports", "%", years, {c: to_series(s, years, 1) for c, s in sorted(series.items())}, **extra,
        noValue={"TWN": "台灣沒有同一題的調查（運動部的運動現況調查問的是自己運動）"},
        noValueEn={"TWN": "Taiwan has no matching survey question (the sports survey asks about doing sport)"}))
    last = years[-1]
    ranked = sorted(((s[last], c) for c, s in series.items() if last in s), reverse=True)
    print(f"  看比賽：{len(series)} 國，{years}；{last} 年 {len(ranked)} 國：{ranked[:8]}…{ranked[-5:]}；歐盟 {eu}")
