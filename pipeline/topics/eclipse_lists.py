"""日食與月食的左側欄（第十二批順序 189，L1，2026-10-31）：從日食、月食主題已經算好的 panel.json、lunar-panel.json
整理成清單用的點檔（不重算路徑）。

- eclipse-list.json：1900–2100 年每一次日全食、日環食、混合食：日期 d、類型 k、食甚時中心線上的持續時間 D（秒）、路徑寬 w、
  路徑範圍 bw、bs、be、bn（清單點了框住整條路徑）、組別 e（paths.json 的組別，滑過時標出那一條）、經過的國家 c（依那一國最長的
  持續時間，最多 4 個）、台灣看到的 tw（0 沒經過、1 環食、2 全食、3 都有）。
- lunar-list.json：1900–2100 年的月全食：日期 d、全食與偏食的分鐘 T、P、食甚的 UTC 分鐘 t、組別 e（lunar.json）、
  台北看到的 tw（3 整個全食、2 一部分，0 看不到）、月亮在天頂的點 lon、lat（點了移過去：看得到的那一半地球的中心）。
  天頂點用近似：太陽直射點的經度 = −15 ×（世界時 − 12 小時），緯度用太陽赤緯的近似公式，月亮在它的對面（誤差幾度，只用來移地圖）。
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone

from common import OUT_DIR, points_file, write_json

OUT = OUT_DIR / "topics" / "eclipses"
LUNAR_TOTAL = 1


def build() -> None:
    panel = json.loads((OUT / "panel.json").read_text(encoding="utf-8"))
    by_eclipse: dict[int, list[tuple[float, str]]] = {}
    for iso3, rows in panel["countries"].items():
        for e, _kind, dur in rows:
            by_eclipse.setdefault(e, []).append((dur or 0, iso3))
    taiwan = {e: kind for e, kind, _ in panel["countries"].get("TWN", [])}
    solar = []
    for e, (d, k, saros, dur, width, box) in enumerate(panel["eclipses"]):
        countries = [c for _, c in sorted(by_eclipse.get(e, []), reverse=True)[:4]]
        w, s, ea, n = box or (None, None, None, None)
        solar.append({"e": e, "d": d, "k": k, "s": saros, "D": dur, "w": width, "bw": w, "bs": s, "be": ea, "bn": n,
                      "lon": (w + ea) / 2 if box else None, "lat": (s + n) / 2 if box else None, "c": ",".join(countries) or None,
                      "tw": taiwan.get(e, 0)})
    write_json(OUT / "eclipse-list.json", points_file(
        solar, ["e", "d", "k", "s", "D", "w", "bw", "bs", "be", "bn", "lon", "lat", "c", "tw"],
        {"e": 1, "d": 1, "k": 1, "s": 1, "D": 0.1, "w": 1, "bw": 0.1, "bs": 0.1, "be": 0.1, "bn": 0.1, "lon": 0.1, "lat": 0.1, "tw": 1},
        ("e",), ("c",)))

    lunar = json.loads((OUT / "lunar-panel.json").read_text(encoding="utf-8"))
    seen = {e: see for e, see in lunar["countries"].get("TWN", {}).get("seen", [])}
    out = []
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    for e, (d, k, total_min, partial_min, mag, minutes, saros) in enumerate(lunar["eclipses"]):
        if k != LUNAR_TOTAL:
            continue
        t = epoch + timedelta(minutes=minutes)
        hours = t.hour + t.minute / 60
        day = t.timetuple().tm_yday
        dec = 23.44 * math.sin(2 * math.pi * (284 + day) / 365)
        sun_lon = -15 * (hours - 12)
        lon = (sun_lon + 360) % 360 - 180  # 月亮在太陽的對面
        out.append({"e": e, "d": d, "T": total_min, "P": partial_min, "t": minutes, "s": saros, "lon": round(lon, 1),
                    "lat": round(-dec, 1), "tw": seen.get(e, 0) if seen.get(e, 0) >= 2 else 0})
    write_json(OUT / "lunar-list.json", points_file(
        out, ["e", "d", "T", "P", "t", "s", "lon", "lat", "tw"], {"e": 1, "d": 1, "T": 0.1, "P": 0.1, "t": 1, "s": 1, "lon": 0.1, "lat": 0.1, "tw": 1},
        ("e",)))
    print(f"  日食 {len(solar)} 次（台灣經過 {sum(1 for x in solar if x['tw'])}）；月全食 {len(out)} 次（台北看得到 {sum(1 for x in out if x['tw'])}）")
