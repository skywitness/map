"""電子垃圾（新主題，能源與環境類，2026-10-29）：各國 2022 年每人產生的電子垃圾、產生量、正式收集回收量與比例。

使用者 2026-10-29 決定：照做（Global E-waste Monitor 2024，CC BY-NC-SA 3.0 IGO，資料檔用同一種授權、頁尾寫明），
只做 2022 年，從 PDF 附錄抽表（sources/ewaste_monitor.py）。產生量多是模型估計，回收量才是各國申報的；
報告的台灣寫成「Taiwan (Province of China)」，這裡照網站的慣例用 ISO 代碼（地圖上寫台灣）。
報告裡各國有沒有電子垃圾法規、生產者延伸責任的欄位沒有用（台灣的資源回收四合一制度寫成沒有，跟事實不符）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import ewaste_monitor

OUT = OUT_DIR / "topics" / "ewaste"
LICENSE = "CC BY-NC-SA 3.0 IGO"


def build() -> None:
    rows = ewaste_monitor.rows()
    year = ewaste_monitor.YEAR
    tonnes = lambda million_kg: round(million_kg * 1000)  # noqa: E731  百萬公斤 = 千公噸
    series = {
        "per-capita": ("公斤/人", {r.iso3: [r.per_capita] for r in rows}),
        "generated": ("公噸", {r.iso3: [tonnes(r.generated)] for r in rows}),
        "recycled": ("公噸", {r.iso3: [tonnes(r.recycled)] for r in rows if r.recycled is not None}),
        "recycling-rate": ("%", {r.iso3: [round(min(r.recycled / r.generated * 100, 100), 1)]
                                 for r in rows if r.recycled is not None and r.generated}),
    }
    world_generated = sum(r.generated for r in rows)
    world_recycled = sum(r.recycled or 0 for r in rows)
    world = {
        "generated": tonnes(world_generated),
        "recycled": tonnes(world_recycled),
        "recycling-rate": round(world_recycled / world_generated * 100, 1),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (unit, values) in series.items():
        extra = {"aggregates": {"WLD": [world[key]]}} if key in world else {}
        write_json(OUT / f"{key}.json", indicator_file(key, unit, [year], values, license=LICENSE, **extra))
    write_json(OUT / "manifest.json", {
        "topic": "ewaste", "generatedAt": now_iso(), "license": LICENSE,
        "sources": [ewaste_monitor.URL], "countries": len(rows),
    })
    over = [r.iso3 for r in rows if r.recycled and r.recycled > r.generated]
    ranked = sorted((r.per_capita, r.iso3) for r in rows)
    rate = sorted((v[0], c) for c, v in series["recycling-rate"][1].items())
    print(f"  {len(rows)} 國；世界產生 {world_generated:,.0f} 百萬公斤、正式回收 {world_recycled:,.0f}（{world['recycling-rate']}%）")
    print(f"  每人最多 {ranked[-4:]}，最少 {ranked[:3]}；回收率有資料 {len(rate)} 國，最高 {rate[-4:]}；回收量大於產生量（設為 100%）：{over}")


if __name__ == "__main__":
    build()
