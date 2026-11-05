"""大型哺乳類還剩下幾種（2026-11-05，製作手冊第二十二批 398；使用者決定只做國家指標；步驟 megafauna，
輸出 topics/megafauna/）。

- 資料：PHYLACINE 1.2（Faurby 等 2018，Zenodo 紀錄 4954990，CC0 1.0）：Trait_data.csv（5,831 種，體重、IUCN 狀態、
  陸生或海生）與每一種一張的分布圖：Current.zip（現在）、Present_natural.zip（「如果沒有人類影響，現在應該在哪裡」，
  是模型推估、不是觀測）。網格是 EPSG:6933 等面積，約 96.5 km 一格（360 × 142）。
  Zenodo 的 robots.txt 允許 /api/records/*/files（crawl-delay 10 秒），三個檔間隔 10 秒下載。
- 大型哺乳類：陸生（Terrestrial = 1）、不是海生（Marine = 0，海獅、海象這類鰭足類不收）、體重 44 公斤以上
  （巨型動物 megafauna 常用的門檻）；海生哺乳類的範圍是海域格，用國界取交集會落空。
- 各國：國界（topics/population_grid.country_shapes()；跨 180 度經線的先切開）轉到 EPSG:6933，格子中心落在國內的格子
  （國家太窄、一個中心都沒有時改成碰到就算），一種動物的範圍跟這些格子有交集就算有。格子很粗，邊界附近的國家可能
  多算或少算鄰國的動物；面積不到 1 萬平方公里的國家不畫。人屬（智人、尼安德塔人、丹尼索瓦人）不算。
- 版本是 2019 年的 1.2，分類與 IUCN 狀態停在那時。EP（史前滅絕）包括猛瑪象、大地懶這類更新世末滅絕的物種，
  原因（氣候或人類）有爭議，說明只寫「曾經在、現在不在」。
"""
from __future__ import annotations

import csv
import time
import zipfile

import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.warp import transform_geom
from shapely.affinity import translate
from shapely.geometry import box, mapping, shape

from common import CACHE_DIR, OUT_DIR, download, indicator_file, write_json
from topics.population_grid import country_shapes

OUT = OUT_DIR / "topics" / "megafauna"
FILES = "https://zenodo.org/api/records/4954990/files/{name}/content"
YEAR = 2026
MIN_KG = 44
MIN_AREA_KM2 = 10_000
STATUS = {"EP": "prehistoric", "EX": "extinct", "EW": "wild-extinct"}


def _file(name: str):
    cached = (CACHE_DIR / "phylacine" / name).exists()
    path = download(FILES.format(name=name), "phylacine", name)
    if not cached:
        time.sleep(10)
    return path


def _split_antimeridian(polygon: list) -> list[dict]:
    """跨 180 度經線的多邊形（斐濟、俄羅斯楚科奇…）切成東西兩塊，不然轉到等面積投影會橫跨整個網格"""
    geom = shape({"type": "Polygon", "coordinates": polygon})
    minx, _, maxx, _ = geom.bounds
    if maxx - minx <= 180:
        return [mapping(geom)]
    shifted = shape({"type": "Polygon", "coordinates": [[(x + 360 if x < 0 else x, y) for x, y in ring] for ring in polygon]}).buffer(0)
    east = shifted.intersection(box(0, -90, 180, 90))
    west = translate(shifted.intersection(box(180, -90, 360, 90)), xoff=-360)
    return [mapping(g) for g in (east, west) if not g.is_empty]


def _ranges(zip_path, folder: str, species: list[str]) -> dict[str, np.ndarray]:
    out = {}
    names = set(zipfile.ZipFile(zip_path).namelist())
    for sp in species:
        member = f"{folder}/{sp}.tif"
        if member not in names:
            continue
        with rasterio.open(f"/vsizip/{zip_path}/{member}") as r:
            out[sp] = r.read(1) > 0
    return out


def build() -> None:
    traits = _file("Trait_data.csv")
    current_zip, natural_zip = _file("Current.zip"), _file("Present_natural.zip")
    with open(traits, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    big = {
        r["Binomial.1.2"]: (float(r["Mass.g"]) / 1000, r["IUCN.Status.1.2"], r["Order.1.2"])
        for r in rows
        if r["Terrestrial"] == "1" and r["Mass.g"] not in ("", "NA") and float(r["Mass.g"]) >= MIN_KG * 1000
        and r["Marine"] != "1"  # 海獅、海象這類也在陸上活動的鰭足類不算
        and r["Genus.1.2"] != "Homo"  # 人屬（智人、尼安德塔人、丹尼索瓦人）不算
    }
    gone = sum(1 for _, s, _ in big.values() if s in STATUS)
    print(f"  PHYLACINE {len(rows)} 種；陸生 {MIN_KG} kg 以上 {len(big)} 種，其中已經沒有野生族群（EP、EX、EW）{gone} 種")
    now = _ranges(current_zip, "Current", sorted(big))
    natural = _ranges(natural_zip, "Present_natural", sorted(big))

    with rasterio.open(f"/vsizip/{current_zip}/Current/{next(iter(now))}.tif") as r:
        crs, transform, shape_ = r.crs, r.transform, r.shape
    values_now, values_nat, values_lost, detail = {}, {}, {}, {}
    small = []
    for iso3, polygons in sorted(country_shapes().items()):
        if iso3 == "ATA":
            continue  # 南極洲沒有陸生大型哺乳類，多邊形又繞地球一圈
        geoms = [transform_geom("EPSG:4326", crs, part) for p in polygons for part in _split_antimeridian(p)]
        area = sum(shape(g).area for g in geoms) / 1e6
        if area < MIN_AREA_KM2:
            small.append(iso3)
            continue
        # 格子中心落在國內的格子；國家太窄、一個中心都沒有時才改成碰到就算
        mask = rasterize([(g, 1) for g in geoms], out_shape=shape_, transform=transform, fill=0, dtype="uint8") > 0
        if not mask.any():
            mask = rasterize([(g, 1) for g in geoms], out_shape=shape_, transform=transform, fill=0, all_touched=True, dtype="uint8") > 0
        here_now = {sp for sp, a in now.items() if a[mask].any()}
        here_nat = {sp for sp, a in natural.items() if a[mask].any()}
        if not here_nat:
            continue
        lost = sorted(here_nat - here_now, key=lambda sp: -big[sp][0])
        values_now[iso3] = [len(here_now)]
        values_nat[iso3] = [len(here_nat)]
        values_lost[iso3] = [round(len(lost) / len(here_nat) * 100, 1)]
        detail[iso3] = {
            "now": len(here_now), "natural": len(here_nat),
            "lost": [[sp.replace("_", " "), round(big[sp][0]), big[sp][1], big[sp][2]] for sp in lost],
        }
    note = ("面積不到 1 萬平方公里，PHYLACINE 的網格（約 96.5 公里一格）太粗", "Smaller than 10,000 km²; PHYLACINE’s ~96.5 km grid is too coarse")
    nv = {"noValue": {c: note[0] for c in small}, "noValueEn": {c: note[1] for c in small}}
    write_json(OUT / "now.json", indicator_file("now", "種", [YEAR], values_now, **nv))
    write_json(OUT / "natural.json", indicator_file("natural", "種", [YEAR], values_nat, **nv))
    write_json(OUT / "lost-share.json", indicator_file("lost-share", "%", [YEAR], values_lost, **nv))
    write_json(OUT / "detail.json", detail)

    def top(values, n=6, rev=True):
        return [(c, v[0]) for c, v in sorted(values.items(), key=lambda kv: -kv[1][0] if rev else kv[1][0])[:n]]
    print(f"  {len(detail)} 國（太小不畫 {len(small)} 個）；現在最多 {top(values_now)}；應有最多 {top(values_nat)}")
    print(f"  少最多成 {top(values_lost, 10)}；最少 {top(values_lost, 6, False)}")
    for c in ("TWN", "USA", "AUS", "JPN", "CHN", "GBR", "BRA", "KEN", "IND", "MDG", "NZL"):
        d = detail.get(c)
        if d:
            print(f"  {c} 現在 {d['now']}、應有 {d['natural']}、少了 {[x[0] for x in d['lost']][:8]}")
