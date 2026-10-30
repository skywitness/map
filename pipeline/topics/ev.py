"""電動車主題：電動車占新車銷售比例、保有量、占小客車保有量比例、公共充電樁、每個充電樁對應的電動車數。

各國用 IEA Global EV Data Explorer（Global EV Outlook 2026，CC BY 4.0，約 60 國，2010–2025 年），
只放歷史資料，不放 IEA 的推估情境。「電動車」跟 IEA 一樣是純電（BEV）＋插電式混合（PHEV），
只算小客車（IEA 的 Cars）。世界值用 IEA 自己的 World（比率也是），歐盟、歐洲等區域合計不收。

IEA 沒有台灣，改用交通部公路局統計查詢網的小客車新車領牌數與年底登記數（sources/thb.py）。
台灣沒有官方的逐年（年底）公共充電樁統計，充電樁與車樁比從缺，附註寫交通部公布的數字。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import iea_ev, thb

# 交通部新聞稿公布的公共充電樁數（台灣附註用；沒有逐年統計）
# 113-10-25「交通部持續建置公共充電樁，營造電動汽車使用環境」、114-09-12「國內公共充電樁突破1.2萬槍…」
TW_CHARGERS = {
    "zh": "交通部公布的數字：2024 年 9 月底 9,597 槍（慢充 7,348、快充 2,249），2025 年 7 月底 12,334 槍；"
    "行政院 2026-09-15 的新聞（資料來源交通部路政及道安司）：2026 年 7 月底 16,280 槍。交通部 TDX 的充電樁 API 要註冊拿金鑰，沒有用",
    "en": "Figures published by the Ministry of Transportation and Communications: 9,597 at the end of September 2024 "
    "(7,348 slow, 2,249 fast) and 12,334 at the end of July 2025; an Executive Yuan press release of 2026-09-15 (data from "
    "the ministry's Department of Railways and Highways) gives 16,280 at the end of July 2026. The ministry's TDX charger "
    "API requires registering for a key, so it is not used",
}
TW_RATIO = {
    "zh": "交通部公布 2025 年 7 月底的車樁比是 9.0（純電小客車 110,768 輛 ÷ 公共充電樁 12,334 槍）；"
    "行政院 2026-09-15 的新聞：2026 年 7 月底 9.2（電動小客車 149,322 輛 ÷ 16,280 槍，快充 35.7）。"
    "IEA 的算法另含插電式混合車與輕型商用車，而且是年底的數字",
    "en": "The Ministry of Transportation and Communications reported 9.0 at the end of July 2025 "
    "(110,768 battery-electric cars ÷ 12,334 public charging points); an Executive Yuan press release of 2026-09-15 gives "
    "9.2 at the end of July 2026 (149,322 electric cars ÷ 16,280 charging points; 35.7 for fast chargers). The IEA's ratio "
    "also counts plug-in hybrids and vans, and is for the end of the year",
}
NO_IEA = ("IEA 沒有台灣", "The IEA does not cover Taiwan")

# 側欄的組成（純電／插電式、慢充／快充／超快充）
PANEL_SERIES = ["sales-bev", "sales-phev", "stock-bev", "stock-phev", "chargers-slow", "chargers-fast", "chargers-ultrafast"]


def taiwan() -> tuple[dict[str, dict[int, float]], dict[str, tuple[str, str]]]:
    """台灣各指標的 {年: 值} 與附註（中、英）。"""
    tw = thb.passenger_cars()
    years = sorted(tw["sales"])
    ev_sales = {y: tw["sales_bev"][y] + tw["sales_phev"][y] for y in years}
    ev_stock = {y: tw["stock_bev"][y] + tw["stock_phev"][y] for y in tw["stock"]}
    last, last_stock = years[-1], max(tw["stock"])
    definition = (
        "純電（電能）加插電式混合（電能/汽油、電能/柴油、電能〔增程〕），不含只加油的油電混合車，"
        "也不含以引擎為主的「汽油/電能」（2020 年以前多半是油電混合車）",
        "battery-electric (fuel type “electric”) plus plug-in hybrids (“electric/petrol”, “electric/diesel” and "
        "“electric, range-extended”), excluding conventional hybrids and the engine-driven “petrol/electric” category "
        "(mostly conventional hybrids before 2021)",
    )
    notes = {
        "sales-share": (
            f"{NO_IEA[0]}，改用交通部公路局的小客車（自用＋營業）新車領牌數計算：{definition[0]}。"
            f"{last} 年純電 {tw['sales_bev'][last]:,} 輛、插電式混合 {tw['sales_phev'][last]:,} 輛，"
            f"新領牌小客車共 {tw['sales'][last]:,} 輛",
            f"{NO_IEA[1]}; calculated from new passenger car registrations (private and commercial) published by the "
            f"Highway Bureau, Ministry of Transportation and Communications: {definition[1]}. In {last}, "
            f"{tw['sales_bev'][last]:,} battery-electric and {tw['sales_phev'][last]:,} plug-in hybrid cars out of "
            f"{tw['sales'][last]:,} new cars",
        ),
        "stock": (
            f"{NO_IEA[0]}，改用交通部公路局的小客車年底登記數：{definition[0]}。"
            f"{last_stock} 年底純電 {tw['stock_bev'][last_stock]:,} 輛、插電式混合 {tw['stock_phev'][last_stock]:,} 輛",
            f"{NO_IEA[1]}; passenger cars registered at year end, from the Highway Bureau, Ministry of Transportation and "
            f"Communications: {definition[1]}. At the end of {last_stock}, {tw['stock_bev'][last_stock]:,} "
            f"battery-electric and {tw['stock_phev'][last_stock]:,} plug-in hybrid cars",
        ),
        "stock-share": (
            f"{NO_IEA[0]}，改用交通部公路局的小客車年底登記數計算（{last_stock} 年底共 {tw['stock'][last_stock]:,} 輛）："
            f"{definition[0]}",
            f"{NO_IEA[1]}; calculated from passenger cars registered at year end, from the Highway Bureau, Ministry of "
            f"Transportation and Communications ({tw['stock'][last_stock]:,} at the end of {last_stock}): {definition[1]}",
        ),
        "chargers": (
            f"{NO_IEA[0]}，台灣也沒有官方的逐年（年底）公共充電樁統計，所以從缺。{TW_CHARGERS['zh']}",
            f"{NO_IEA[1]}, and Taiwan has no official year-end series of public charging points, so it is left blank. "
            f"{TW_CHARGERS['en']}",
        ),
        "evs-per-charger": (
            f"{NO_IEA[0]}，台灣也沒有逐年的公共充電樁統計，所以從缺。{TW_RATIO['zh']}",
            f"{NO_IEA[1]}, and Taiwan has no yearly series of public charging points, so it is left blank. {TW_RATIO['en']}",
        ),
    }
    series = {
        "sales-share": {y: ev_sales[y] / tw["sales"][y] * 100 for y in years},
        "stock": ev_stock,
        "stock-share": {y: ev_stock[y] / tw["stock"][y] * 100 for y in ev_stock},
        "sales-bev": tw["sales_bev"],
        "sales-phev": tw["sales_phev"],
        "stock-bev": tw["stock_bev"],
        "stock-phev": tw["stock_phev"],
    }
    return series, notes


def chargers_total(iea: dict[str, dict[str, dict[int, float]]]) -> dict[str, dict[int, float]]:
    """公共充電樁總數 = 慢充 + 快充 + 超快充（三類不重疊）；有一類有資料就算。"""
    out: dict[str, dict[int, float]] = {}
    for key in ("chargers-slow", "chargers-fast", "chargers-ultrafast"):
        for iso3, by_year in iea[key].items():
            for year, value in by_year.items():
                out.setdefault(iso3, {})[year] = out.get(iso3, {}).get(year, 0) + value
    return out


# 輸出檔名 -> (IEA 序列, 單位, 小數位數)
INDICATORS = {
    "sales-share": ("sales-share", "%", 2),
    "stock": ("stock", "輛", 0),
    "stock-share": ("stock-share", "%", 3),
    "chargers": ("chargers", "個", 0),
    "evs-per-charger": ("ldvs-per-charger", "輛/樁", 1),
}


def build() -> None:
    out = OUT_DIR / "topics" / "ev"
    iea = iea_ev.ev_data()
    iea["chargers"] = chargers_total(iea)
    tw_series, tw_notes = taiwan()

    for key, (source, unit, digits) in INDICATORS.items():
        data = {iso3: dict(s) for iso3, s in iea[source].items()}
        world = data.pop("WLD", {})
        if key in tw_series:
            data["TWN"] = tw_series[key]
        years = year_span(data)
        values = {iso3: to_series(s, years, digits) for iso3, s in data.items()}
        values = {iso3: v for iso3, v in values.items() if any(x is not None for x in v)}
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, values,
                aggregates={"WLD": to_series(world, years, digits)},
                notes={"TWN": tw_notes[key][0]},
                notesEn={"TWN": tw_notes[key][1]},
            ),
        )
        latest = years[-1]
        print(
            f"  {key}: {years[0]}–{latest}，{len(values)} 國；{latest} 年世界 {world.get(latest)}、"
            f"台灣 {data.get('TWN', {}).get(latest)}"
        )

    # 側欄：各國每年的純電／插電式（新車、保有量）與慢充／快充／超快充，從有資料的第一年開始
    panel: dict[str, dict[str, dict[int, float]]] = {}
    for key in PANEL_SERIES:
        for iso3, by_year in iea[key].items():
            panel.setdefault(iso3, {})[key] = by_year
    panel["TWN"] = {key: tw_series[key] for key in PANEL_SERIES if key in tw_series}
    for iso3, groups in panel.items():
        observed = [y for s in groups.values() for y in s]
        years = list(range(min(observed), max(observed) + 1))
        write_json(
            out / "countries" / f"{iso3}.json",
            {"years": years, "values": {k: to_series(groups[k], years, 0) for k in PANEL_SERIES if k in groups}},
            quiet=True,
        )
    print(f"  {len(panel)} 個國家/地區的組成（含世界）")
    write_json(
        out / "manifest.json",
        {
            "topic": "ev",
            "generatedAt": now_iso(),
            "source": "IEA Global EV Data Explorer (Global EV Outlook 2026); 交通部公路局統計查詢網",
        },
    )
