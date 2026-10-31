"""側欄的資料依國家分檔（2026-10-31，使用者選的第四輪 三、2；DESIGN.md 第 13 節）。

點國家時只下載那一國的部分，不必先下載整份側欄資料（航海日誌原本 544 KB、gzip 136 KB，多半的國家只要 1–5 KB）。
每份資料寫成 <資料夾>/<ISO3>.json，另外 index.json 列出有檔的國家（countries）與各國共用的欄位；
前端用 src/lib/data.ts 的 useCountryPart 讀（index.json 沒列的國家就是沒有資料，不去要一個不存在的檔）。

這裡只有純粹的資料轉換（不依賴 shapely 等），主題的 build() 呼叫它，也可以直接把舊的整份檔轉成分檔。
"""
from __future__ import annotations

from pathlib import Path

from common import ROOT, write_json


def write_country_parts(directory: Path, parts: dict[str, object], shared: dict | None = None) -> None:
    """一國一個檔加上 index.json；資料夾裡舊的 .json 先刪掉（國家可能變少）"""
    if directory.exists():
        for old in directory.glob("*.json"):
            old.unlink()
    directory.mkdir(parents=True, exist_ok=True)
    for iso3, part in sorted(parts.items()):
        write_json(directory / f"{iso3}.json", part, quiet=True)
    write_json(directory / "index.json", {"countries": sorted(parts), **(shared or {})}, quiet=True)
    total = sum(p.stat().st_size for p in directory.glob("*.json"))
    print(f"  輸出 {directory.relative_to(ROOT)}/：{len(parts)} 國（共 {total / 1024:.0f} KB）")


def logbook_parts(voyages: list, near: dict, own: dict) -> dict[str, dict]:
    """航海日誌：每國經過附近的航程、自己的船的航程（依年份），加上用到的航程資料（鍵是航程的索引，跟 tracks.json 的 v 一樣）"""
    parts = {}
    for iso3 in sorted(set(near) | set(own)):
        ids = sorted({v for by_year in (near.get(iso3, {}), own.get(iso3, {})) for vs in by_year.values() for v in vs})
        parts[iso3] = {
            "voyages": {str(v): voyages[v] for v in ids},
            "near": near.get(iso3, {}),
            "own": own.get(iso3, {}),
        }
    return parts


def river_parts(countries: dict, systems: dict) -> dict[str, dict]:
    """河流：每國的流域統計（country），加上前幾大河流系統的資料（systems，鍵是系統的代碼）"""
    return {
        iso3: {"country": c, "systems": {str(g): systems[str(g)] for g, _area in c["top"]}}
        for iso3, c in countries.items()
    }
