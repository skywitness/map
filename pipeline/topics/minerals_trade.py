"""關鍵礦產主題的貿易流向（2026-10-30 加，製作手冊第六批 73）：稀土、永久磁鐵、鈾的雙邊貿易，CEPII BACI HS92 版（Etalab 2.0）。

商品（流向指標自己的子項目），HS 1992 的六位碼：
- 稀土：280530（稀土金屬、鈧、釔）＋ 2846 全部（稀土金屬、釔、鈧的化合物，284610 鈰化合物、284690 其他）。
  2805 的其他六位碼是鈉、鈣、鹼金屬與汞，不收。稀土精礦沒有專屬的六位碼（USGS MCS 2026 稀土章的稅則也只列 2805.30、
  2846.10、2846.90），各國報在不同的代碼，所以這裡看不到礦砂的貿易；緬甸、寮國賣給中國大陸的多半報在 2846。
- 永久磁鐵：850511（金屬的永久磁鐵），使用者決定另列。含釤鈷、鋁鎳鈷等，不全是釹鐵硼。
- 鈾：261210（鈾礦砂及其精礦）＋ 284410（天然鈾及其化合物）。濃縮鈾（284420）是核燃料，不收。
  鈾的產量（OECD NEA／IAEA 的 Red Book）授權還沒確認，使用者決定先做貿易。

輸出格式跟貿易、半導體主題相同（重用 trade.py 的 _from_pairs、_write_item），寫在 topics/minerals/ 底下：
- flows/<商品>/<年>.json：每個國家前 15 大出口對象與進口來源（千美元）
- export/<商品>.json、import/<商品>.json：各國出口、進口總額（美元）
年份 2000–2024（BACI 2027 年 1 月才有 2025 年）。台灣是 BACI 的 490，沒有自己的申報，數字來自貿易夥伴。
讀 2.4 GB 的 zip 約 5 分鐘（塑膠污染主題的同一份快取）。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR
from sources import baci
from topics.trade import _from_pairs, _write_item

OUT = OUT_DIR / "topics" / "minerals"
FIRST_YEAR = 2000
ITEMS = {
    "rare-earths": ("280530", "2846"),
    "magnets": ("850511",),
    "uranium": ("261210", "284410"),
}


def item_of(code: str) -> str | None:
    for item, prefixes in ITEMS.items():
        if code.startswith(prefixes):
            return item
    return None


def build() -> None:
    codes = tuple(p for prefixes in ITEMS.values() for p in prefixes)
    by_item: dict[str, dict[int, dict]] = defaultdict(dict)
    print("  讀取 BACI HS92（約 2.4 GB，幾分鐘）…")
    for year, rows in baci.yearly_hs6_rows(codes, hs="HS92"):
        if year < FIRST_YEAR:
            continue
        pairs: dict[str, dict[tuple[str | None, str | None], float]] = defaultdict(lambda: defaultdict(float))
        for code, exporter, importer, value, _q in rows:
            item = item_of(code)
            if item:
                pairs[item][(exporter, importer)] += value
        for item in ITEMS:
            by_item[item][year] = _from_pairs(pairs[item])
    for item in ITEMS:
        _write_item(OUT, item, by_item[item])
        latest = max(by_item[item])
        exports = by_item[item][latest]["export"]
        top = sorted(((sum(p.values()), c) for c, p in exports.items()), reverse=True)[:6]
        world = sum(sum(p.values()) for p in exports.values())
        tw_in = sum(by_item[item][latest]["import"].get("TWN", {}).values())
        print(f"    {item} {latest}：世界 {world / 1e6:.2f} 十億美元，出口前幾名 "
              + "、".join(f"{c} {v / 1e3:.0f}" for v, c in top) + f"（百萬美元）；台灣進口 {tw_in / 1e3:.1f} 百萬美元")


if __name__ == "__main__":
    build()
