"""關鍵礦產：全世界的礦場（2026-11-05，製作手冊第二十二批 382 的後半〔候選 968〕；步驟 minerals-mines，輸出 topics/minerals/）。

- 資料：USGS Mineral Resources Data System（MRDS）的 CSV 版 `mrds-csv.zip`（公有領域；`mrds.met` 寫 Use_Constraints: none）。
  mrdata.usgs.gov 的 robots.txt 不准程式抓，使用者用瀏覽器下載，本機 session 放進 map-plan 的 `data/usgs-mrds/`
  （README 有 SHA-256）；重跑前複製到 `pipeline/.cache/usgs-mrds/`，從 zip 直接讀 `mrds.csv`（解開 137 MB）。
- 只收有座標、開發狀態是生產中（Producer）、曾生產（Past Producer）、加工廠（Plant）的；礦產地、探礦、不詳不收。
  2011 年起 USGS 不再有系統地更新 MRDS，「生產中」是當時的紀錄，不代表現在還在生產（金瓜石 1987 年就停了）。
- 不收煤（「石油、天然氣與煤」已有 GEM 的煤礦）、地熱、沒有礦種的，以及砂石、碎石、石材這類建築材料（多半是美國的小採石場）。
- 主要礦種是 commod1 的第一個，歸成七類（GROUPS，src/topics/minerals.ts 的 MINE_GROUPS 要一致）。
- 美國占八成以上（USGS 自己的建檔比較完整），不做「各國礦場數」的面量圖，只畫點；地圖縮小時只畫生產中、加工廠與美國以外的
  曾生產，其餘在 mines-more.json。
"""
from __future__ import annotations

import csv
import hashlib
import io
import zipfile
from collections import Counter

from common import CACHE_DIR, OUT_DIR, write_layered_points
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "minerals"
ZIP = CACHE_DIR / "usgs-mrds" / "mrds-csv.zip"
ZIP_SHA256 = "31be4baaa86b082787bc74989146183db21badf7157db39b3f0a6fe0b38a5477"
STATUS = {"Producer": 1, "Past Producer": 2, "Plant": 3}
SKIP = {
    "", "Coal", "Geothermal", "Sand and Gravel", "Stone", "Granite", "Flagstone", "Marble", "Pumice", "Volcanic Materials",
    "Slate", "Sandstone", "Basalt", "Quartzite", "Dolomite", "Limestone", "Peat", "Shale", "Common Clay", "Clay",
    "Fire Clay (Refractory)", "Diatomite", "Perlite", "Gemstone",
}
# 類別：1 貴金屬、2 基本金屬、3 鐵與鋼鐵合金、4 電池與科技礦產、5 鈾、6 其他金屬、7 工業礦物
GROUPS = {
    1: {"Gold", "Silver", "Platinum", "PGE", "Palladium", "Rhodium", "Iridium", "Osmium", "Ruthenium"},
    2: {"Copper", "Lead", "Zinc", "Tin", "Aluminum", "Bauxite"},
    3: {"Iron", "Manganese", "Chromium", "Tungsten", "Molybdenum", "Vanadium", "Titanium"},
    4: {"Lithium", "Cobalt", "Nickel", "Graphite", "REE", "Rare Earths", "Tantalum", "Niobium", "Beryllium", "Gallium",
        "Germanium", "Indium", "Columbium (Niobium)", "Niobium (Columbium)", "Thorium", "Zirconium", "Hafnium"},
    5: {"Uranium"},
}
METALLIC = {"M", "B"}
ALIASES = {"Russia": "RUS", "Congo (Kinshasa)": "COD", "Congo (Brazzaville)": "COG", "Burma": "MMR", "Ivory Coast": "CIV",
           "Korea, North": "PRK", "Korea, South": "KOR", "Taiwan": "TWN", "Bolivia": "BOL", "Iran": "IRN", "Laos": "LAO",
           "Tanzania": "TZA", "Vietnam": "VNM", "Venezuela": "VEN", "Syria": "SYR", "Moldova": "MDA", "Macedonia": "MKD",
           "Czech Republic": "CZE", "Swaziland": "SWZ", "Turkey": "TUR", "East Timor": "TLS"}


def _group(primary: str, com_type: str) -> int:
    for g, names in GROUPS.items():
        if primary in names or primary.split("-")[0] in names:
            return g
    return 6 if com_type in METALLIC else 7


def _year(text: str) -> int | None:
    text = text.strip()
    return int(text) if text.isdigit() and 1000 < int(text) <= 2026 else None


def build() -> None:
    if not ZIP.exists():
        raise RuntimeError(f"沒有 {ZIP}：請把 map-plan 的 data/usgs-mrds/mrds-csv.zip 複製到這裡")
    if hashlib.sha256(ZIP.read_bytes()).hexdigest() != ZIP_SHA256:
        raise RuntimeError(f"{ZIP} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改")
    with zipfile.ZipFile(ZIP) as z, z.open("mrds.csv") as raw:
        reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8"))
        rows, unknown, skipped = [], Counter(), Counter()
        for r in reader:
            status = STATUS.get(r["dev_stat"])
            if not status or not r["latitude"] or not r["longitude"]:
                continue
            primary = r["commod1"].split(",")[0].strip()
            if primary in SKIP:
                skipped[primary or "（沒有）"] += 1
                continue
            iso3 = ALIASES.get(r["country"]) or from_name(r["country"])
            if not iso3:
                unknown[r["country"]] += 1
                continue
            rows.append({
                "lon": float(r["longitude"]), "lat": float(r["latitude"]), "n": r["site_name"].strip(),
                "c": r["commod1"].strip(), "g": _group(primary, r["com_type"]), "s": status, "iso3": iso3,
                "y0": _year(r["yr_fst_prd"]), "y1": _year(r["yr_lst_prd"]),
            })
    rows.sort(key=lambda r: r["lon"])
    fields = ["lon", "lat", "n", "c", "g", "s", "iso3", "y0", "y1"]
    important = lambda r: r["s"] != 2 or r["iso3"] != "USA"  # noqa: E731
    write_layered_points(OUT / "mines.json", rows, important, fields,
                         {"lon": 0.001, "lat": 0.001, "g": 1, "s": 1, "y0": 1, "y1": 1}, delta=["lon"], strings=["c", "iso3"],
                         text=["n"])  # 名稱另外放（2026-11-06，城6）
    by_country = Counter(r["iso3"] for r in rows)
    print(f"  MRDS：收 {len(rows)} 個（生產中 {sum(r['s'] == 1 for r in rows)}、曾生產 {sum(r['s'] == 2 for r in rows)}、加工廠 {sum(r['s'] == 3 for r in rows)}）")
    print(f"  類別 {sorted(Counter(r['g'] for r in rows).items())}；國家最多 {by_country.most_common(10)}")
    print(f"  不收的礦種 {skipped.most_common(8)}；對不到國家 {unknown.most_common(12)}")
    print(f"  台灣 {[(r['n'], r['c'], r['s']) for r in rows if r['iso3'] == 'TWN']}")
