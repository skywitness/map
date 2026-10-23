"""板塊邊界：Peter Bird（2003）的 PB2002 板塊模型，Hugo Ahlenius（Nordpil）整理的版本。

https://github.com/fraxen/tectonicplates （Open Data Commons Attribution License 1.0，要註明
Hugo Ahlenius、Nordpil 與 Peter Bird）；原始論文 Bird, P. (2003), An updated digital model of plate
boundaries, Geochem. Geophys. Geosyst., 4(3), 1027, doi:10.1029/2001GC000252。

用 PB2002_steps（5,824 段，每段幾十公里）而不是 PB2002_boundaries：每一段有 STEPCLASS，
可以分出聚合（隱沒帶）、張裂（洋脊、裂谷）與轉形斷層三類；邊界檔只有「subduction」與空白。
每段只取起點與終點（steps 檔裡中間的點是沿大圓內插的，幾十公里內跟直線差不到 1 公里）。
"""
from __future__ import annotations

import json

from common import download

# 固定在這個 commit，資料不會在背後改變（版本庫 2014 年之後沒有更新）
URL = "https://raw.githubusercontent.com/fraxen/tectonicplates/339b0c56563c118307b1f4542703047f5f698fae/GeoJSON/PB2002_steps.json"

# STEPCLASS → 地圖上的三類（跟 src/topics/earthquakes.ts 的 PLATE_TYPES 一致）
CONVERGENT, DIVERGENT, TRANSFORM = 1, 2, 3
CLASSES = {
    "SUB": CONVERGENT,  # 隱沒帶
    "OCB": CONVERGENT,  # 海洋聚合邊界
    "CCB": CONVERGENT,  # 大陸聚合邊界（碰撞）
    "OSR": DIVERGENT,  # 中洋脊
    "CRB": DIVERGENT,  # 大陸裂谷
    "OTF": TRANSFORM,  # 海洋轉形斷層
    "CTF": TRANSFORM,  # 大陸轉形斷層
}


def boundaries() -> tuple[list[list[tuple[float, float]]], list[int]]:
    """把同一條邊界上相連、同一類的段接成一條線；經度展開成連續的（跨 180° 經線時可以超過 ±180）。"""
    with open(download(URL, "plates", "PB2002_steps.json"), encoding="utf-8") as f:
        features = json.load(f)["features"]
    steps = sorted((f["properties"] for f in features), key=lambda p: p["SEQNUM"])
    lines: list[list[tuple[float, float]]] = []
    types: list[int] = []
    prev = None
    for p in steps:
        kind = CLASSES[p["STEPCLASS"]]
        x0, y0, x1, y1 = p["STARTLONG"], p["STARTLAT"], p["FINALLONG"], p["FINALLAT"]
        joined = (
            prev is not None
            and prev["PLATEBOUND"] == p["PLATEBOUND"]
            and types[-1] == kind
            and abs(((prev["FINALLONG"] - x0 + 180) % 360) - 180) < 1e-6
            and abs(prev["FINALLAT"] - y0) < 1e-6
        )
        if joined:
            line = lines[-1]
        else:
            line = [(x0, y0)]
            lines.append(line)
            types.append(kind)
        # 跟前一個點的經度差超過 180° 時改成另一側的寫法，線才不會橫越整個地圖
        px = line[-1][0]
        line.append((x1 + 360 * round((px - x1) / 360), y1))
        prev = p
    return lines, types
