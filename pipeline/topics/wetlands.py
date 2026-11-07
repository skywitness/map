"""內陸水域與濕地的 33 類（新主題，2026-11-07，製作手冊第二十七批 549，候選 1236；步驟 wetlands，輸出 topics/wetlands/）。

資料：GLWD v2.0（Lehner 等 2025，figshare 28519994，CC BY 4.0；技術文件 4.1 另請勿把整份資料用原始格式轉載到別的網站，
這裡只輸出各國的統計）。用 GLWD_v2_0_combined_classes_tif.zip 裡 15 角秒的兩個網格：
- GLWD_v2_0_area_pct：每格裡濕地（33 類合計）占的面積百分比；
- GLWD_v2_0_main_class：每格裡面積最大的那一類（0 是沒有濕地的陸地，255 是海與 NoData）。
GLWD 合計 1,820 萬 km²，是南極洲以外陸地的 13.4%（技術文件第 1 節）。

每一格的濕地面積＝格子面積（依緯度）× area_pct；這些面積全部算給那一格的主要類別（GLWD 只給每格的主要類別與合計，
沒有每格各類的比例：33 類各自的面積網格在另外兩個 1.5 GB 的 zip，這裡不用），所以各類的面積是近似值，說明寫明。
國界跟人口網格一樣（population_grid.country_shapes、OVERRIDES），像素中心在國界內才算；海岸邊落在國界外的格子往外長 24 格
（15 角秒，約 11 公里）歸給最先碰到的國家（ghsl.fill_gaps），裏海這類離岸很遠的水面不算任何國家。
2026-11-07 本機 session 另外做了 30 角秒的主要類別（map-plan 的 data/glwd/），只有主要類別、沒有面積比例，算不出濕地占比，
所以 cloud 自己下載原始 zip（925 MB），只解出這兩個檔（共 431 MB），zip 刪掉。

類別分成 7 組（地圖的類別色最多 8 種）：1 湖泊與水庫（1、2、3、6）、2 河流（4、5、7）、3 湖濱與河濱濕地（8–15）、
4 沼澤與短暫性濕地（16–21）、5 泥炭地（22–27）、6 海岸濕地（28–32：紅樹林、鹽沼、大河三角洲、其他海岸濕地、鹽灘）、7 水稻田（33）。
輸出 share.json（濕地占陸地 %）、main.json（面積最大的一組）、group/<組>.json（各組占陸地 %）、classes.json（側欄：各類的 km²）。
"""
from __future__ import annotations

import numpy as np
import rasterio
from rasterio.windows import Window

from common import CACHE_DIR, OUT_DIR, indicator_file, write_json
from sources.ghsl import GAP_FILL_PIXELS, country_codes, fill_gaps
from topics.population_grid import OVERRIDES, bbox, country_shapes

OUT = OUT_DIR / "topics" / "wetlands"
DIR = CACHE_DIR / "glwd"
URL = "https://ndownloader.figshare.com/files/54001814"  # GLWD_v2_0_combined_classes_tif.zip，925,253,756 bytes
YEAR = 2025
ROWS = 512
KM_PER_DEG = 111.19508
GROUPS = {1: (1, 2, 3, 6), 2: (4, 5, 7), 3: tuple(range(8, 16)), 4: tuple(range(16, 22)), 5: tuple(range(22, 28)),
          6: tuple(range(28, 33)), 7: (33,)}
GROUP_OF = np.zeros(256, np.int64)
for g, classes in GROUPS.items():
    GROUP_OF[list(classes)] = g
MIN_LAND_KM2 = 100
TOP_CLASSES = 10


def _paths():
    pct, main = DIR / "GLWD_v2_0_area_pct.tif", DIR / "GLWD_v2_0_main_class.tif"
    if not (pct.exists() and main.exists()):
        import zipfile

        from common import download

        archive = download(URL, "glwd", "GLWD_v2_0_combined_classes_tif.zip")
        with zipfile.ZipFile(archive) as z:
            for p in (pct, main):
                with z.open(f"GLWD_v2_0_combined_classes/{p.name}") as src, open(p, "wb") as dst:
                    while chunk := src.read(1 << 24):
                        dst.write(chunk)
        archive.unlink()  # 925 MB，用完就刪
    return pct, main


def build() -> None:
    pct_path, main_path = _paths()
    shapes_by_unit = country_shapes()
    codes = sorted(shapes_by_unit.keys() | {target for _s, target, _a in OVERRIDES})
    index = {iso3: i + 1 for i, iso3 in enumerate(codes)}
    shapes = [({"type": "Polygon", "coordinates": polygon}, index[iso3], bbox(polygon))
              for iso3, polygons in shapes_by_unit.items() for polygon in polygons]
    overrides = [(index[s] if s else 0, index[t_], a) for s, t_, a in OVERRIDES]
    n = len(codes) + 1
    land = np.zeros(n)
    by_class = np.zeros(n * 34)
    with rasterio.open(pct_path) as pct_src, rasterio.open(main_path) as main_src:
        t, width = main_src.transform, main_src.width
        if pct_src.transform != t:
            raise ValueError("GLWD 的兩個網格不一樣")
        lon = t.c + (np.arange(width) + 0.5) * t.a
        cell_km = abs(t.a) * KM_PER_DEG
        for row_off in range(0, main_src.height, ROWS):
            h = min(ROWS, main_src.height - row_off)
            window = Window(0, row_off, width, h)
            main = main_src.read(1, window=window)
            ok = main != 255
            if not ok.any():
                continue
            pct = pct_src.read(1, window=window).astype(np.float64)
            # 海岸邊落在國界外的格子（紅樹林、三角洲）往外長 GAP_FILL_PIXELS 格，歸給最先碰到的國家（跟人口網格一樣）
            top = max(0, row_off - GAP_FILL_PIXELS)
            bottom = min(main_src.height, row_off + h + GAP_FILL_PIXELS)
            code = country_codes(shapes, Window(0, top, width, bottom - top), t)
            fill_gaps(code, row_off - top, ok.astype(np.float32))
            code = code[row_off - top: row_off - top + h].astype(np.int64)
            lat = t.f + (row_off + np.arange(h) + 0.5) * t.e
            for source, target, (lon0, lat0, lon1, lat1) in overrides:
                rr = (lat >= lat0) & (lat <= lat1)
                cc = (lon >= lon0) & (lon <= lon1)
                if rr.any() and cc.any():
                    block = code[np.ix_(rr, cc)]
                    block[block == source] = target
                    code[np.ix_(rr, cc)] = block
            area = np.broadcast_to((np.cos(np.radians(lat)) * cell_km * cell_km)[:, None], (h, width))
            c, a, m = code[ok], area[ok], main[ok].astype(np.int64)
            land += np.bincount(c, weights=a, minlength=n)
            wet = m > 0
            p = np.where(pct[ok] == 255, 0, pct[ok]) / 100
            by_class += np.bincount(c[wet] * 34 + m[wet], weights=a[wet] * p[wet], minlength=n * 34)
    by_class = by_class.reshape(n, 34)
    wet_total = by_class[:, 1:].sum(axis=1)
    groups = np.stack([by_class[:, list(GROUPS[g])].sum(axis=1) for g in sorted(GROUPS)], axis=1)  # n × 7

    share, main_group, group_share, panel = {}, {}, {g: {} for g in GROUPS}, {}
    for iso3, k in index.items():
        if iso3.startswith("_") or land[k] < MIN_LAND_KM2:
            continue
        share[iso3] = [round(float(wet_total[k] / land[k] * 100), 1)]
        if wet_total[k] > 0:
            main_group[iso3] = [int(np.argmax(groups[k]) + 1)]
        for g in GROUPS:
            group_share[g][iso3] = [round(float(groups[k, g - 1] / land[k] * 100), 2)]
        top = [(int(i), float(by_class[k, i])) for i in np.argsort(-by_class[k, 1:])[:TOP_CLASSES] + 1 if by_class[k, i] >= 1]
        if top:
            panel[iso3] = {"land": round(float(land[k])), "wet": round(float(wet_total[k])), "top": [[i, round(a)] for i, a in top]}
    world_land, world_wet = float(land[1:].sum()), float(wet_total[1:].sum())
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "share.json", indicator_file("share", "%", [YEAR], share,
                                                  aggregates={"WLD": [round(world_wet / world_land * 100, 1)]}, license="CC BY 4.0"))
    write_json(OUT / "main.json", indicator_file("main", "category", [YEAR], main_group, license="CC BY 4.0"))
    for g in GROUPS:
        write_json(OUT / "group" / f"{g}.json", indicator_file(
            f"group/{g}", "%", [YEAR], group_share[g],
            aggregates={"WLD": [round(float(groups[1:, g - 1].sum()) / world_land * 100, 2)]}, license="CC BY 4.0"), quiet=True)
    write_json(OUT / "classes.json", {"countries": panel})

    print(f"  陸地 {world_land / 1e6:.2f} 百萬 km²、濕地 {world_wet / 1e6:.2f} 百萬 km²（{world_wet / world_land:.1%}；"
          f"技術文件 18.2 百萬 km²、13.4%）")
    print("  各組（全世界）：" + "、".join(f"{g} {groups[1:, g - 1].sum() / 1e6:.2f}M" for g in GROUPS))
    big = {c: v for c, v in share.items() if land[index[c]] >= 1e4}
    print("  占比最高（陸地 1 萬 km² 以上）：" + "、".join(f"{c} {v[0]}" for c, v in sorted(big.items(), key=lambda kv: -kv[1][0])[:16]))
    print("  最主要的一組：" + str({g: sum(1 for v in main_group.values() if v[0] == g) for g in GROUPS}))
    for c in ("TWN", "CAN", "RUS", "FIN", "BGD", "IDN", "BRA", "USA", "CHN", "JPN", "NLD", "VNM", "EGY", "SAU", "COD"):
        top = "、".join(f"{i}:{a:,}" for i, a in panel.get(c, {}).get("top", [])[:4])
        print(f"  {c}：{share.get(c)}%、主要 {main_group.get(c)}；{top}")
