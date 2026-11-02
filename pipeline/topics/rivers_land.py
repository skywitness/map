"""河流與流域的國土面積（2026-11-02，新17）：rivers 步驟的 write_land 單獨跑一次（不必重算 HydroSHEDS 的河道），
國家照已經輸出的 main-ocean.json，tooltip 的流向比例照 length.json 的 hints。rivers 重跑時會一起寫，不必再跑這一步。"""
from __future__ import annotations

import json

from topics.rivers import OUT, write_land


def build() -> None:
    length = json.loads((OUT / "length.json").read_text(encoding="utf-8"))
    keep = sorted(json.loads((OUT / "main-ocean.json").read_text(encoding="utf-8"))["values"])
    write_land(keep, length.get("hints"), length.get("hintsEn"))
