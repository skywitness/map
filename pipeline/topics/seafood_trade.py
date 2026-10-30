"""海鮮的貿易（海洋與漁業主題的擴充，2026-10-30，製作手冊第六批 100）：魚、蝦、貝類（HS 第 03 章）的出口、進口流向。

使用者 2026-10-30 決定用跟其他商品一樣的 CEPII BACI（HS92 版，1995 年起），不用 FishStat 的貿易。
HS 2012、2017 大幅重編第 03 章（HS92 87 個六位碼、HS22 225 個），只用章的合計；不含罐頭與調製品（1604、1605）、
魚粉（2301）、魚油（1504）。

輸出到 topics/oceans/（格式同貿易主題，trade._write_item）：flows/seafood/<年>.json、export/seafood.json、import/seafood.json。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR
from sources import baci
from topics.trade import _from_pairs, _write_item

OUT = OUT_DIR / "topics" / "oceans"
CHAPTER = ("03",)


def build() -> None:
    print("  讀取 BACI HS92（約 2.4 GB，第 03 章，幾分鐘）…")
    by_year = {
        year: _from_pairs({pair: cell[0] for pair, cell in pairs.items()})
        for year, pairs in baci.yearly_product_flows(CHAPTER, hs="HS92")
    }
    _write_item(OUT, "seafood", by_year)

    last = max(by_year)
    exports: dict[str, float] = defaultdict(float)
    imports: dict[str, float] = defaultdict(float)
    for c, partners in by_year[last]["export"].items():
        exports[c] += sum(partners.values())
    for c, partners in by_year[last]["import"].items():
        imports[c] += sum(partners.values())
    world = sum(exports.values())
    top = lambda d: [(c, round(v / world * 100, 1)) for c, v in sorted(d.items(), key=lambda kv: -kv[1])[:8]]  # noqa: E731
    print(f"  海鮮 {last} 年：全球 {world / 1e5:,.0f} 億美元；出口 {top(exports)}；進口 {top(imports)}；"
          f"台灣出口 {exports.get('TWN', 0) / 1e5:.1f} 億、進口 {imports.get('TWN', 0) / 1e5:.1f} 億美元")
