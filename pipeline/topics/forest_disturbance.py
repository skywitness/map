"""歐洲森林的擾動是誰造成的：樹皮甲蟲與風倒、火、其他（多半是採伐）（2026-11-07，製作手冊第二十五批 497，候選 1164；
擴充「森林」）。

Senf & Seidl「Attributing European forest disturbances to storm and fire」（Zenodo 8202241，v1.2，CC BY 4.0；要引用
Senf, C. and Seidl, R. (2021) Mapping the forest disturbance regimes of Europe. Nature Sustainability）：34 國各一個 30 公尺
GeoTIFF（EPSG 3035，float32），值 1＝樹皮甲蟲或風倒（技術原因分不開）、2＝火、3＝其他（多半是採伐，也含搶救性伐木與
小規模的自然擾動），沒有年份（1986–2020 年合計）。
使用者 2026-11-07 決定「一國一檔下載、算完就刪」：一國一國下載到 .cache/forest-disturbance/、逐塊（block window）數像素、
把結果寫進 counts.json 後刪掉 GeoTIFF；counts.json 有的國家不再下載。合計約 1.08 GB。
輸出 public/data/topics/forest/disturbance-cause/{natural,fire,other}.json（%）與 disturbance-area.json（公頃，一格 0.09 公頃）。
"""

from __future__ import annotations

import json
import urllib.request

import common
from common import OUT_DIR, indicator_file, write_json

OUT = OUT_DIR / "topics" / "forest"
RECORD = "https://zenodo.org/api/records/8202241"
FILE_URL = "https://zenodo.org/api/records/8202241/files/{}/content"
COUNTRIES = {
    "albania": "ALB", "austria": "AUT", "belarus": "BLR", "belgium": "BEL", "bosniaherzegovina": "BIH", "bulgaria": "BGR",
    "croatia": "HRV", "czechia": "CZE", "denmark": "DNK", "estonia": "EST", "finland": "FIN", "france": "FRA", "germany": "DEU",
    "greece": "GRC", "hungary": "HUN", "ireland": "IRL", "italy": "ITA", "latvia": "LVA", "lithuania": "LTU", "macedonia": "MKD",
    "moldova": "MDA", "montenegro": "MNE", "netherlands": "NLD", "norway": "NOR", "poland": "POL", "portugal": "PRT",
    "romania": "ROU", "serbia": "SRB", "slovakia": "SVK", "slovenia": "SVN", "spain": "ESP", "sweden": "SWE",
    "switzerland": "CHE", "unitedkingdom": "GBR",
}
PIXEL_HA = 0.09
YEAR = 2020  # 1986–2020 年合計，標在最後一年


def _count(path) -> dict[str, int]:
    import numpy as np
    import rasterio

    counts = {"1": 0, "2": 0, "3": 0}
    with rasterio.open(path) as ds:
        for _, window in ds.block_windows(1):
            a = ds.read(1, window=window)
            for v in (1, 2, 3):
                counts[str(v)] += int(np.count_nonzero(a == v))
    return counts


def build() -> None:
    folder = common.CACHE_DIR / "forest-disturbance"
    folder.mkdir(parents=True, exist_ok=True)
    counts_path = folder / "counts.json"
    counts = json.loads(counts_path.read_text()) if counts_path.exists() else {}
    for name in COUNTRIES:
        if name in counts:
            continue
        key = f"fire_wind_barkbeetle_{name}.tif"
        target = folder / key
        if not target.exists():
            print(f"  下載 {FILE_URL.format(key)}")
            request = urllib.request.Request(FILE_URL.format(key), headers={"User-Agent": common.USER_AGENT})
            with urllib.request.urlopen(request, timeout=1800, context=common._ssl_context(RECORD)) as resp, open(target, "wb") as out:
                while chunk := resp.read(1 << 20):
                    out.write(chunk)
        counts[name] = _count(target)
        counts_path.write_text(json.dumps(counts, indent=1))
        target.unlink()  # 算完就刪（使用者 2026-11-07）
        print(f"  {name}：{counts[name]}")
    years = [YEAR]
    lic = "CC BY 4.0"
    shares = {"natural": {}, "fire": {}, "other": {}}
    area = {}
    for name, iso3 in COUNTRIES.items():
        c = counts[name]
        total = c["1"] + c["2"] + c["3"]
        if not total:
            continue
        shares["natural"][iso3] = [round(c["1"] / total * 100, 1)]
        shares["fire"][iso3] = [round(c["2"] / total * 100, 1)]
        shares["other"][iso3] = [round(c["3"] / total * 100, 1)]
        area[iso3] = [round(total * PIXEL_HA)]
    for item, values in shares.items():
        write_json(OUT / "disturbance-cause" / f"{item}.json", indicator_file("disturbance-cause", "%", years, values, license=lic))
    write_json(OUT / "disturbance-area.json", indicator_file("disturbance-area", "公頃", years, area, license=lic))
    total = sum(v[0] for v in area.values())
    print(f"  歐洲 {len(area)} 國森林擾動 1986–2020 合計 {total:,.0f} 公頃")
