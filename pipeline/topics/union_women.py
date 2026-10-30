"""15–49 歲女性有偶或同居的比例（婚姻與家庭的擴充，2026-10-30，製作手冊第七批 132，DESIGN.md 第 8 節第 214 點）。

聯合國人口司的模型估計與推估（sources/undesa_union.py，CC BY 3.0 IGO），1970–2050 年，225 個國家或地區，含台灣。
是另加的指標，不取代「15 歲以上有偶比例」（World Marriage Data 2019，topics/marriage.py）：
這裡只算 15–49 歲的女性，而且同居（consensual union）也算。
- 每個國家最後一次調查以後是推估，分界各國不同；指標檔的 projectionFrom 用 PROJECTION_FROM（2024 年起
  除了 2 國都是推估），更早就開始推估的國家附註寫「YYYY 年起是推估」。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import undesa_union

OUT = OUT_DIR / "topics" / "marriage"
PROJECTION_FROM = 2024


def build() -> None:
    values, world, projected = undesa_union.married_or_in_union()
    years = sorted({y for s in values.values() for y in s})
    notes, notes_en = {}, {}
    for iso3, first in projected.items():
        if first < PROJECTION_FROM:
            notes[iso3] = f"最後一筆普查或調查資料在 {first - 1} 年，{first} 年起是推估"
            notes_en[iso3] = f"Latest census or survey data from {first - 1}; projections from {first}"
    write_json(OUT / "union-women.json", indicator_file(
        "union-women", "%", years, {iso3: to_series(s, years, 1) for iso3, s in sorted(values.items())},
        projectionFrom=PROJECTION_FROM,
        aggregates={"WLD": to_series(world, years, 1)},
        notes=notes, notesEn=notes_en,
    ))
    print(f"  {len(values)} 國，{years[0]}–{years[-1]}；{len(notes)} 國在 {PROJECTION_FROM} 年以前就開始推估；"
          f"台灣 {values['TWN'].get(2023)}（2023）、推估從 {projected.get('TWN')}；世界 {world.get(2023):.1f}")


if __name__ == "__main__":
    build()
