"""半導體主題：各國的晶片與半導體設備貿易（CEPII BACI HS17，2017–2024），金額、流向與占全球比例。

商品（子項目），都是 HS 2017 的六位碼：
- 積體電路 IC：8542 全部（處理器、記憶體、放大器、其他 IC 與零件）。預設。
- 分離式半導體：8541，但不含 854140 與 854160：
  - 854140 是「光敏半導體裝置，含太陽能電池與模組、LED」。2024 年全球 780 億美元，中國大陸占 47%，
    幾乎都是太陽能板；併進來的話「分離式半導體」（不含它只有 497 億）就變成太陽能板的地圖。另列成「光電元件」。
  - 854160 是裝好的壓電晶體（石英振盪器），不是半導體。
- 晶片合計：積體電路＋分離式半導體。
- 半導體設備：8486（晶圓、晶片製造與封裝設備及零件），不含 848630（平面顯示器製造設備）；
  加上 903082（晶圓、晶片的量測檢驗儀器）與 903141（晶圓、光罩的光學檢查儀器），這兩項 HS 不放在 8486。
- 光電元件（太陽能電池、LED 等）：854140，另列，不計入晶片合計。

輸出（格式跟貿易主題相同，重用 trade.py 的 _from_pairs、_write_item）：
- flows/<商品>/<年>.json：每個國家前 15 大出口對象與進口來源（千美元）。
- export/<商品>.json、import/<商品>.json：各國出口、進口總額（美元）。
- export_share/<商品>.json、import_share/<商品>.json：占全球出口、進口的比例（%），分母是同一個檔的世界合計。

BACI 沒有台灣自己的申報（聯合國不發布台灣的貿易統計），台灣的出口是各進口國依原產地申報的數字、進口是各出口國的申報。
用財政部的海關統計（sources/mof_trade.py）對照，差異寫進台灣的附註；香港的轉口 BACI 不計，香港、中國大陸也加附註。
"""
from __future__ import annotations

import json
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import baci, mof_trade
from topics.trade import _from_pairs, _write_item

PREFIXES = ("8541", "8542", "8486", "903082", "903141")
COMPARE_YEARS = (2024, 2023)  # 台灣附註對照的年份（新的在前）


@dataclass(frozen=True)
class Item:
    id: str
    name: str  # 附註裡的名稱
    name_en: str
    hs17: Callable[[str], bool]  # BACI（HS 2017）的六位碼
    mof: Callable[[str], bool]  # 財政部的六位碼（2023 年起是 HS 2022：854141–854149、854151、854159）


PHOTO_HS22 = {"854141", "854142", "854143", "854149"}


def _ic(k: str) -> bool:
    return k.startswith("8542")


def _discrete(k: str) -> bool:
    return k.startswith("8541") and k not in {"854140", "854160"}


def _discrete_mof(k: str) -> bool:
    # 854151（半導體感測器）是 HS 2022 才從其他章節移進 8541 的，HS 2017 沒有
    return _discrete(k) and k not in PHOTO_HS22 and k != "854151"


def _equipment(k: str) -> bool:
    return (k.startswith("8486") and k != "848630") or k in {"903082", "903141"}


ITEMS = [
    Item("ic", "積體電路", "IC", _ic, _ic),
    Item("discrete", "分離式半導體", "discrete semiconductor", _discrete, _discrete_mof),
    Item("chips", "晶片（積體電路＋分離式半導體）", "chip (IC and discrete)",
         lambda k: _ic(k) or _discrete(k), lambda k: _ic(k) or _discrete_mof(k)),
    Item("equipment", "半導體設備", "semiconductor equipment", _equipment, _equipment),
    Item("photo", "光電元件（太陽能電池、LED 等）", "photosensitive device (solar cells, LEDs, etc.)",
         lambda k: k == "854140", lambda k: k == "854140" or k in PHOTO_HS22),
]

DIRECTIONS = {"export": "出口", "import": "進口"}


def build() -> None:
    out = OUT_DIR / "topics" / "semiconductors"

    print("  讀取 BACI 的 HS 8541、8542、8486 等（zip 約 800 MB，需要兩分鐘）…")
    by_item: dict[str, dict[int, dict]] = {item.id: {} for item in ITEMS}
    for year, products in baci.yearly_products(PREFIXES):
        for item in ITEMS:
            pairs: baci.Pairs = defaultdict(float)
            for code, flows in products.items():
                if item.hs17(code):
                    for key, v in flows.items():
                        pairs[key] += v
            by_item[item.id][year] = _from_pairs(pairs)
    years = sorted(by_item["ic"])

    print("  讀取財政部的海關進出口統計（台灣的對照）…")
    codes = sorted({c for c in _all_mof_codes() if any(item.mof(c) for item in ITEMS)})
    mof = mof_trade.hs6(codes, years[0], years[-1])

    for item in ITEMS:
        _write_item(out, item.id, by_item[item.id])
        totals = {d: _totals(by_item[item.id], d) for d in DIRECTIONS}
        mof_twn = {
            d: {y: sum(s.get(y, 0) for code, s in mof[d].items() if item.mof(code)) for y in years}
            for d in DIRECTIONS
        }
        for direction, series in totals.items():
            world = {y: sum(s.get(y, 0) for s in series.values()) for y in years}
            notes = _notes(item, direction, series, world, mof_twn[direction], totals)
            share_notes = _notes(item, direction, series, world, mof_twn[direction], totals, share=True)
            _add_notes(out / direction / f"{item.id}.json", notes)
            shares = {
                c: {y: v / world[y] * 100 for y, v in s.items() if world.get(y)}
                for c, s in series.items()
            }
            write_json(
                out / f"{direction}_share" / f"{item.id}.json",
                indicator_file(
                    f"{direction}_share/{item.id}", "%", years,
                    # 不先四捨五入：很小的占比（0.00001%）四捨五入會變成 0，排名表會寫「0.00%」
                    {c: to_series(s, years) for c, s in shares.items()},
                    notes={c: zh for c, (zh, _) in share_notes.items()},
                    notesEn={c: en for c, (_, en) in share_notes.items()},
                ),
                quiet=True,
            )
        _print_check(item, totals, mof_twn, years)

    write_json(
        out / "manifest.json",
        {
            "topic": "semiconductors",
            "generatedAt": now_iso(),
            "source": "CEPII BACI (HS17 V202601); 財政部統計資料庫（進出口貿易統計，台灣的對照）",
            "items": [{"id": item.id, "label": item.name} for item in ITEMS],
        },
    )


def _all_mof_codes() -> list[str]:
    """財政部查詢頁上可能用到的六位碼（HS 2017 與 2022 兩版都列，頁面上沒有的會略過）。"""
    return [
        *(f"8486{s}" for s in ("10", "20", "30", "40", "90")),
        *(f"8541{s}" for s in ("10", "21", "29", "30", "40", "41", "42", "43", "49", "50", "51", "59", "60", "90")),
        *(f"8542{s}" for s in ("31", "32", "33", "39", "90")),
        "903082", "903141",
    ]


def _totals(by_year: dict[int, dict], direction: str) -> dict[str, dict[int, float]]:
    """各國每年的總額（美元），跟 trade._write_item() 寫進指標檔的一樣（不到 500 美元的不算）。"""
    series: dict[str, dict[int, float]] = defaultdict(dict)
    for year, flows in by_year.items():
        for country, partners in flows[direction].items():
            total = sum(partners.values())
            if total >= 0.5:
                series[country][year] = total * 1000
    return series


def _zh_usd(v: float) -> str:
    """1,650 億美元、33.4 億美元、4,500 萬美元"""
    if v >= 1e10:
        return f"{v / 1e8:,.0f} 億美元"
    if v >= 1e8:
        return f"{v / 1e8:,.1f} 億美元"
    return f"{v / 1e4:,.0f} 萬美元"


def _en_usd(v: float) -> str:
    return f"US${v / 1e9:,.1f} billion" if v >= 1e9 else f"US${v / 1e6:,.0f} million"


def _diff(mof: float, baci_value: float) -> tuple[str, str]:
    """財政部比 BACI 多或少幾 %"""
    pct = round((mof / baci_value - 1) * 100)
    if pct == 0:
        return "跟 BACI 差不多", "about the same as BACI"
    return (f"比 BACI {'多' if pct > 0 else '少'} {abs(pct)}%", f"{abs(pct)}% {'more' if pct > 0 else 'less'} than BACI")


def _notes(
    item: Item,
    direction: str,
    series: dict[str, dict[int, float]],
    world: dict[int, float],
    mof_twn: dict[int, float],
    totals: dict[str, dict[str, dict[int, float]]],
    share: bool = False,
) -> dict[str, tuple[str, str]]:
    """{ISO3: (中文附註, 英文附註)}：台灣（對照財政部）、香港與中國大陸（香港的轉口）。"""
    notes: dict[str, tuple[str, str]] = {}
    twn = series.get("TWN", {})
    compare = [y for y in COMPARE_YEARS if twn.get(y) and mof_twn.get(y)]
    if compare:
        if direction == "export":
            zh = (
                "BACI 沒有台灣自己的申報（聯合國不發布台灣的貿易統計），台灣的出口是各進口國申報「原產地是台灣」的進口，"
                "在台灣製造、從其他地方出貨的也會算進來。"
            )
            en = (
                "BACI has no reports from Taiwan itself (the UN does not publish Taiwan's trade statistics): Taiwan's exports "
                "are what importing countries recorded as originating in Taiwan, which can include goods made in Taiwan but "
                "shipped from elsewhere. "
            )
            source_zh, source_en = "財政部的海關統計（依出口目的地）", "Taiwan's Ministry of Finance customs statistics (by destination)"
        else:
            zh = (
                "BACI 沒有台灣自己的申報（聯合國不發布台灣的貿易統計），台灣的進口是各出口國申報出口到台灣的數字，"
                "經香港等地轉運的貨，出口國常記成出口到轉運地（BACI 也不計香港的轉口）。"
            )
            en = (
                "BACI has no reports from Taiwan itself (the UN does not publish Taiwan's trade statistics): Taiwan's imports "
                "are what exporting countries recorded as shipped to Taiwan, and goods sent via Hong Kong or other hubs are "
                "often recorded as going to the hub (BACI also leaves out Hong Kong's re-exports). "
            )
            source_zh, source_en = "財政部的海關統計（依原產地）", "Taiwan's Ministry of Finance customs statistics (by origin)"
        verb_zh, verb_en = DIRECTIONS[direction], direction + "s"
        parts_zh = [f"{y} 年 {_zh_usd(mof_twn[y])}（{_diff(mof_twn[y], twn[y])[0]}）" for y in compare]
        parts_en = [f"{_en_usd(mof_twn[y])} in {y} ({_diff(mof_twn[y], twn[y])[1]})" for y in compare]
        zh += f"{source_zh}的{item.name}{verb_zh}：{'、'.join(parts_zh)}"
        en += f"{source_en} show {item.name_en} {verb_en} of {' and '.join(parts_en)}"
        if share:
            y = compare[0]
            mof_share = mof_twn[y] / (world[y] - twn[y] + mof_twn[y]) * 100
            zh += f"；用財政部的數字算，{y} 年約占全球 {mof_share:.1f}%"
            en += f"; using the Ministry's figure, Taiwan's share of the world in {y} would be about {mof_share:.1f}%"
        notes["TWN"] = (zh, en)

    if direction == "import":
        latest = max(world)
        hkg_import = series.get("HKG", {}).get(latest, 0)
        hkg_export = totals["export"].get("HKG", {}).get(latest, 0)
        chn_import = series.get("CHN", {}).get(latest, 0)
        if hkg_import:
            notes["HKG"] = (
                f"香港是轉口港，BACI 不計香港的轉口（{latest} 年香港的{item.name}出口只有 {_zh_usd(hkg_export)}），"
                "經香港轉往中國大陸等地的貨都記在香港的進口",
                f"Hong Kong is an entrepôt, and BACI leaves out its re-exports (Hong Kong's {item.name_en} exports in {latest} "
                f"were only {_en_usd(hkg_export)}), so goods passing through Hong Kong to mainland China and elsewhere are "
                "counted as Hong Kong's imports",
            )
        if hkg_import and chn_import:
            notes["CHN"] = (
                f"經香港轉進來的貨記在香港的進口；{latest} 年中國大陸加香港是 {_zh_usd(chn_import + hkg_import)}",
                f"Goods arriving via Hong Kong are counted as Hong Kong's imports; mainland China and Hong Kong together "
                f"imported {_en_usd(chn_import + hkg_import)} in {latest}",
            )
    return notes


def _add_notes(path, notes: dict[str, tuple[str, str]]) -> None:
    """trade._write_item() 寫好的總額指標檔加上附註。"""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if notes:
        data["notes"] = {c: zh for c, (zh, _) in notes.items()}
        data["notesEn"] = {c: en for c, (_, en) in notes.items()}
    write_json(path, data, quiet=True)


def _print_check(item: Item, totals: dict, mof_twn: dict, years: list[int]) -> None:
    """印出台灣的 BACI 與財政部數字（億美元），方便抽查。"""
    for direction, label in DIRECTIONS.items():
        twn = totals[direction].get("TWN", {})
        row = "  ".join(
            f"{y} {twn.get(y, 0) / 1e8:,.0f}/{mof_twn[direction].get(y, 0) / 1e8:,.0f}" for y in years[-3:]
        )
        print(f"    台灣{item.name}{label}（BACI/財政部，億美元）：{row}")
