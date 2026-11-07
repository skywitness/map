"""半導體的擴充：電腦手機螢幕是誰做的、半導體貿易的三十年重新排隊（2026-11-07，製作手冊第二十七批 593，候選 1316、1320；
步驟 electronics-hs92，輸出 topics/semiconductors/）。

- Harvard Growth Lab Atlas 的 hs92_country_product_year_4（CC0 1.0；sources/atlas.py 的 hs92_4digit()，原檔 452 MB，
  快取篩過的四欄），1995–2024。七個 HS92 四位碼：8542 積體電路、8471 電腦、8473 電腦零件、8525 無線傳輸設備（HS92 把
  手機放在這裡，不是 8517）、8528 螢幕與電視、8479 其他專用機械（HS92 沒有 8486，半導體設備在這一類裡）、9031 量測與檢測儀器。
- 出口額（美元，名目）與占全世界的比例（世界總額是那一年那一類所有列的合計，含 Atlas 的非國家代碼）。
- 手冊的陷阱：跟主題原本的 CEPII BACI（HS 2017，2017–2024）是不同的資料與分類，兩條線不接；出口含轉口（香港、新加坡、
  荷蘭）；1995 年的美元沒有平減；1995 年有些國家還用舊的 HS 申報。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import atlas
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "semiconductors"
ITEMS = {"ic": "8542", "computers": "8471", "computer-parts": "8473", "radio": "8525", "monitors": "8528",
         "machinery": "8479", "instruments": "9031"}


def build() -> None:
    data = atlas.hs92_4digit()
    years = sorted(data)
    detail = {"years": years, "items": list(ITEMS), "countries": {}, "world": {}}
    for item, code in ITEMS.items():
        world = {y: sum(data[y].get(code, {}).values()) for y in years}
        exports: dict[str, dict[int, float]] = {}
        for y in years:
            for c, v in data[y].get(code, {}).items():
                if (iso3 := to_iso3(c)):
                    exports.setdefault(iso3, {})[y] = v
        write_json(OUT / "hs92" / f"{item}.json", indicator_file(
            f"hs92-{item}", "美元", years, {c: [round(s[y]) if y in s else None for y in years] for c, s in sorted(exports.items())},
            license="CC0 1.0"))
        write_json(OUT / "hs92-share" / f"{item}.json", indicator_file(
            f"hs92-share-{item}", "%", years,
            {c: [round(s[y] / world[y] * 100, 3) if y in s and world[y] else None for y in years] for c, s in sorted(exports.items())},
            license="CC0 1.0"))
        detail["world"][item] = [round(world[y]) for y in years]
        for c, s in exports.items():
            detail["countries"].setdefault(c, {})[item] = [round(s[y]) if y in s else None for y in years]
        top = sorted(((round(s.get(2024, 0) / 1e8), c) for c, s in exports.items()), reverse=True)[:5]
        print(f"  {code} {item} 2024 全世界 {world[2024] / 1e8:,.0f} 億美元：{top}；台灣 {exports.get('TWN', {}).get(2024, 0) / 1e8:,.1f} 億")
    # 側欄：每一國一個小檔（七類的出口與全世界合計），不要一個 380 KB 的大檔
    for c, items in detail["countries"].items():
        write_json(OUT / "hs92-countries" / f"{c}.json", {"years": years, "items": items, "world": detail["world"], "license": "CC0 1.0"})
