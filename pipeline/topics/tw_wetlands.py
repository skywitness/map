"""台灣的國家重要濕地（第十批順序 181 的補齊，2026-10-31）：世界遺產主題的拉姆薩濕地圖層，台灣不是《拉姆薩公約》的締約方，
另外用一個顏色畫內政部國家公園署公告的國家重要濕地。

**資料**：政府資料開放平臺 25659「國家重要濕地」的第一個圖層「重要濕地範圍圖」（TGOS 的 SHP，民國 115 年 1 月 9 日版），
政府資料開放授權條款第 1 版。TGOS 從 cloud 回 HTTP 403，本機 session 2026-10-31 下載，放在 skywitness/map-plan 的
data/nlma/（README 寫了座標系統、編碼與欄位）；重跑前把 `important-wetlands-range.zip` 複製到 pipeline/.cache/nlma/。

**讀法**（照 map-plan 的 README）：
- 壓縮檔裡的主檔名本身帶著 `.cpg`（`重要濕地1150109(更新龍鑾潭).cpg.shp`），屬性表照 `.cpg` 用 Big5 讀。
- 座標是 TWD97 二度分帶（TM2，中央經線 121°；金門的 x 是負的），當成 EPSG:3826 轉經緯度。
- 89 筆不是 89 處：淡水河流域、嘉南埤圳的子濕地各一筆（名稱在 SUB_TITLE），依 TITLE 合併成 61 處，
  點放在合併後範圍的中心（中心落在範圍外的改用範圍內的代表點），面積是 AREA（公頃）的合計，子濕地數寫在 n。

**輸出**：public/data/topics/world-heritage/tw-wetlands.json（點：經緯度、名稱、等級 lv、面積 ha、縣市 city、子濕地數 n）。
"""
from __future__ import annotations

import zipfile
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, points_file, write_json, write_manifest_part

OUT = OUT_DIR / "topics" / "world-heritage"
ZIP = CACHE_DIR / "nlma" / "important-wetlands-range.zip"
# 等級（前端 heritage-extra.ts 的 TW_WETLAND_LEVELS）
LEVELS = {"國際級": 1, "國家級": 2, "地方級": 3, "暫定地方級": 4}


def build() -> None:
    import shapefile
    from rasterio.warp import transform
    from shapely.geometry import Polygon
    from shapely.ops import unary_union

    if not ZIP.exists():
        raise RuntimeError(f"沒有 {ZIP}：請把 map-plan 的 data/nlma/important-wetlands-range.zip 複製到這裡")
    folder = ZIP.with_suffix("")
    with zipfile.ZipFile(ZIP) as z:
        z.extractall(folder)
    shp = next(folder.rglob("*.shp"))
    # 主檔名帶著 .cpg，給 pyshp 檔名它會把 .cpg 當副檔名去掉，所以三個檔各自打開
    base = str(shp)[: -len(".shp")]
    reader = shapefile.Reader(shp=open(base + ".shp", "rb"), shx=open(base + ".shx", "rb"), dbf=open(base + ".dbf", "rb"),
                              encoding="big5")
    if len(reader) != 89:
        raise RuntimeError(f"重要濕地範圍圖應該有 89 筆，讀到 {len(reader)} 筆，版本可能換了")
    groups: dict[str, dict] = defaultdict(lambda: {"polys": [], "ha": 0.0, "levels": set(), "cities": [], "n": 0})
    for rec, shape in zip(reader.records(), reader.shapes()):
        title = rec["TITLE"].strip()
        g = groups[title]
        parts = list(shape.parts) + [len(shape.points)]
        rings = [shape.points[parts[i]:parts[i + 1]] for i in range(len(parts) - 1)]
        # 外環與洞：pyshp 的環依順時針是外環、逆時針是洞（ESRI 慣例）；這裡只算中心，洞忽略不影響太多，全部當外環合併
        g["polys"].extend(Polygon([(x, y) for x, y, *_ in r]) for r in rings if len(r) >= 4)
        g["ha"] += float(rec["AREA"] or 0)
        g["levels"].add(rec["LEVEL_1"].strip())
        for c in (rec["CITY_1"], rec["CITY_2"]):
            c = (c or "").strip()
            if c and c not in g["cities"]:
                g["cities"].append(c)
        g["n"] += 1
    rows = []
    for title, g in groups.items():
        union = unary_union([p.buffer(0) for p in g["polys"]])
        pt = union.centroid if union.contains(union.centroid) else union.representative_point()
        lon, lat = transform("EPSG:3826", "EPSG:4326", [pt.x], [pt.y])
        levels = sorted(g["levels"], key=lambda l: LEVELS.get(l, 9))
        if len(levels) > 1:
            print(f"    {title} 有不同等級 {levels}，取最高的")
        rows.append({"lon": round(lon[0], 4), "lat": round(lat[0], 4), "name": title, "lv": LEVELS.get(levels[0], 3),
                     "ha": round(g["ha"], 1), "city": "、".join(g["cities"]), "n": g["n"]})
    rows.sort(key=lambda r: -r["ha"])
    write_json(OUT / "tw-wetlands.json", points_file(
        rows, ["lon", "lat", "name", "lv", "ha", "city", "n"], {"lon": 0.0001, "lat": 0.0001, "lv": 1, "ha": 0.1, "n": 1}))
    write_manifest_part(OUT, "world-heritage", "tw-wetlands", {
        "source": "內政部國家公園署 國家重要濕地 重要濕地範圍圖（data.gov.tw 25659，TGOS，115 年 1 月 9 日版）",
        "license": "政府資料開放授權條款第 1 版",
    })
    from collections import Counter
    print(f"  國家重要濕地 {len(rows)} 處（{reader.numRecords} 筆），合計 {sum(r['ha'] for r in rows):,.1f} 公頃；"
          f"等級 {dict(Counter(r['lv'] for r in rows))}；最大 {[(r['name'], r['ha']) for r in rows[:3]]}")
    lons = [r["lon"] for r in rows]
    lats = [r["lat"] for r in rows]
    print(f"  範圍 經度 {min(lons)}–{max(lons)}、緯度 {min(lats)}–{max(lats)}")


if __name__ == "__main__":
    build()
