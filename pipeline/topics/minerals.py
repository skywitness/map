"""關鍵礦產主題：USGS Mineral Commodity Summaries（MCS）的各國礦產產量、占全球比例與蘊藏量。

- 每版 MCS 只有前兩年的產量（後一年是估計值）與最新的蘊藏量，這裡合併 2020–2026 版：
  - 產量：每一年用「最新一版有那一年」的整張表（2024 年用 2026 版的修正值，2023 年用 2025 版），
    同一年不混用兩版，「其他國家」與世界總計才對得起來。2018–2025 年，2025 年是 2026 版的估計值。
    沒有用 projectionFrom 標示：那是給「推估」（未來預測）用的，時間軸會把之前的年份都標成「估計值」，
    最後一年又跟時間軸結尾的年份疊在一起；2025 年是初估寫在指標說明、頁尾與側欄。
  - 蘊藏量：每版一年（2026 版是 2025 年），2019–2025 年。各版會依公司與政府的報告修正，年份之間的變化
    多半是修正，不是開採或新發現。
- 占全球比例的分母是 USGS 表上的「World total (rounded)」（含「其他國家」），不是列出國家的加總；
  鋰、鋁土礦的世界總計不含美國（美國的產量保密，表上是 W）。
- 「W」（保密）、「NA」（沒有資料）當缺值，附註寫明；「—」是零。
- 鍺只到 2020 年：USGS 從 2023 年版起不再公布各國的鍺產量（2023 版的 2021、2022 年都是 NA，2024 版起只剩文字說明），
  所以只讀到 2023 版，指標檔的年份只留有資料的 2018–2020 年（時間軸會停在 2020 年）。
- 台灣：這些礦種 USGS 的表上都沒有台灣（台灣只出現在鋼鐵的產量表與美國的進口來源），前端用 noValue 說明。
"""
from __future__ import annotations

from collections import defaultdict
from typing import NamedTuple

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import usgs_mcs

EDITIONS = range(2020, 2027)
TOP_RANK = 5  # 側欄：全球前 5 名（而且占 1% 以上：鉑族金屬、鎵只列出 5、6 國，第 5 名不一定是主要生產國）
TOP_RANK_MIN_SHARE = 1.0
TOP_SHARE = 5.0  # 或占全球 5% 以上


class Mineral(NamedTuple):
    id: str
    slug: str  # MCS 的章名（PDF 檔名）
    group: str  # 產量那兩欄的欄位標題要含這個字（銅分礦場與精煉、鉑族金屬分鉑與鈀…）
    factor: float  # 表格單位 → 公噸
    reserves_factor: float | None  # 蘊藏量的單位 → 公噸；None 是沒有蘊藏量
    name: str
    name_en: str
    last_edition: int = max(EDITIONS)  # 最後一版有表格的 MCS（鍺 2024 版起沒有各國的數字）


MINERALS = [
    Mineral("rare-earths", "rare-earths", "Mine", 1, 1, "稀土", "Rare earths"),
    Mineral("lithium", "lithium", "Mine", 1, 1, "鋰", "Lithium"),
    Mineral("cobalt", "cobalt", "Mine", 1, 1, "鈷", "Cobalt"),
    Mineral("nickel", "nickel", "Mine", 1, 1, "鎳", "Nickel"),
    Mineral("graphite", "graphite", "Mine", 1, 1, "天然石墨", "Natural graphite"),
    Mineral("gallium", "gallium", "Primary", 0.001, None, "鎵", "Gallium"),  # 公斤；沒有蘊藏量
    Mineral("germanium", "germanium", "Refinery", 0.001, None, "鍺", "Germanium", 2023),  # 公斤；精煉產量，沒有蘊藏量
    Mineral("copper", "copper", "Mine", 1000, 1000, "銅", "Copper"),  # 千公噸
    Mineral("manganese", "manganese", "Mine", 1000, 1000, "錳", "Manganese"),  # 千公噸
    Mineral("tungsten", "tungsten", "Mine", 1, 1, "鎢", "Tungsten"),
    Mineral("antimony", "antimony", "Mine", 1, 1, "銻", "Antimony"),
    Mineral("vanadium", "vanadium", "Mine", 1, 1000, "釩", "Vanadium"),  # 蘊藏量是千公噸
    Mineral("tin", "tin", "Mine", 1, 1, "錫", "Tin"),
    Mineral("niobium", "niobium", "Mine", 1, 1, "鈮", "Niobium"),
    Mineral("platinum", "platinum-group", "Platinum", 0.001, 0.001, "鉑", "Platinum"),  # 公斤；蘊藏量是鉑族金屬合計
    Mineral("palladium", "platinum-group", "Palladium", 0.001, 0.001, "鈀", "Palladium"),
    Mineral("bauxite", "bauxite-alumina", "Bauxite", 1000, 1000, "鋁土礦", "Bauxite"),  # 千公噸（乾重）
]

# MCS 表上的註腳（PDF 的註腳沒有解析，重要的手動抄在這裡）：{(礦種, 國家): (中文, 英文)}
NOTES = {
    ("rare-earths", "CHN"): (
        "中國的數字是開採配額，不含未申報的產量（USGS 的註腳）",
        "China's figure is the mining quota and excludes undocumented production (USGS footnote)",
    ),
    **{
        ("rare-earths", a): (
            "2024、2025 年的產量是 USGS 依中國的進口資料估計的",
            "Production in 2024 and 2025 is a USGS estimate based on China's import data",
        )
        for a in ("MMR", "MDG", "MYS", "THA", "VNM")
    },
    ("gallium", "CHN"): (
        "鎵是初級（低純度）產量，主要是煉鋁的副產品；中國的數字來自 Asian Metal",
        "Gallium is primary (low-purity) production, mostly a by-product of alumina refining; China's figure is from Asian Metal",
    ),
    ("nickel", "NCL"): ("新喀里多尼亞是法國的海外屬地，USGS 單獨列出", "New Caledonia is an overseas territory of France, listed separately by USGS"),
    **{
        ("germanium", a): (
            "USGS 從 2023 年版起不再公布各國的鍺產量（大多數廠商不公開），所以只到 2020 年",
            "USGS stopped publishing germanium output by country from the 2023 edition (most producers do not report it), so data end in 2020",
        )
        for a in ("CHN", "RUS")
    },
}
WITHHELD = (
    "{years} 年 USGS 為了不洩漏個別公司的資料沒有公布（W），世界總計也不含",
    "Withheld by USGS in {years} to avoid disclosing company proprietary data (W); also excluded from the world total",
)
NOT_AVAILABLE_RESERVES = ("USGS 沒有這個國家的蘊藏量數字（NA）", "No reserves figure from USGS for this country (NA)")
PGM_RESERVES = (
    "蘊藏量是鉑族金屬（鉑、鈀、銠、釕、銥、鋨）合計，USGS 沒有分開",
    "Reserves are for all platinum-group metals combined (platinum, palladium, rhodium, ruthenium, iridium, osmium); USGS does not split them",
)


class YearTable(NamedTuple):
    edition: int
    values: dict[str, float | None]  # 國家（ISO3）→ 公噸；None 是 W／NA
    flags: dict[str, str]
    world: float | None
    world_flag: str


def _tables(m: Mineral) -> tuple[dict[int, YearTable], dict[int, YearTable]]:
    """{年: 那一年的產量表}、{年: 蘊藏量表}；每一年取最新一版。"""
    production: dict[int, YearTable] = {}
    reserves: dict[int, YearTable] = {}
    for edition in range(min(EDITIONS), m.last_edition + 1):
        table = usgs_mcs.world_table(edition, m.slug)
        cols = {i: c for i, c in enumerate(table.columns) if not c.reserves and m.group.lower() in c.group.lower()}
        years = sorted({c.year for c in cols.values()})
        if years != [edition - 2, edition - 1]:
            raise ValueError(f"MCS {edition} {m.slug}：{m.group} 的年份是 {years}，應該是 {edition - 2}、{edition - 1}")
        res_cols = [i for i, c in enumerate(table.columns) if c.reserves]
        targets = [(i, cols[i].year, production, m.factor) for i in cols]
        if m.reserves_factor is not None:
            if len(res_cols) != 1:
                raise ValueError(f"MCS {edition} {m.slug}：找不到蘊藏量那一欄")
            targets.append((res_cols[0], edition - 1, reserves, m.reserves_factor))
        for col, year, out, factor in targets:
            values: dict[str, float | None] = {}
            flags: dict[str, str] = {}
            world = None
            world_flag = ""
            for label, row in table.rows:
                code = usgs_mcs.area_code(label)
                if code is None:
                    raise ValueError(f"MCS {edition} {m.slug}：認不得的國名「{label}」")
                v = row.get(col)
                if v is None or code == usgs_mcs.OTHER:
                    continue
                value = None if v.value is None else v.value * factor
                if code == usgs_mcs.WORLD:
                    world, world_flag = value, v.flag
                    continue
                values[code] = value
                if v.flag:
                    flags[code] = v.flag
            out[year] = YearTable(edition, values, flags, world, world_flag)
    return production, reserves


def _share(table: YearTable, world: float | None) -> dict[str, float]:
    if not world:
        return {}
    return {a: v / world * 100 for a, v in table.values.items() if v is not None}


def build() -> None:
    out = OUT_DIR / "topics" / "minerals"
    top: dict[int, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    summary = []
    for m in MINERALS:
        production, reserves = _tables(m)
        # 年份只留有資料的範圍（鍺 2021 年起是 NA）
        with_data = [y for y, t in production.items() if any(v is not None for v in t.values.values())]
        production = {y: t for y, t in production.items() if min(with_data) <= y <= max(with_data)}
        years = sorted(production)
        notes: dict[str, tuple[str, str]] = {}
        for (mid, area), note in NOTES.items():
            if mid == m.id:
                notes[area] = note
        withheld: dict[str, list[int]] = defaultdict(list)
        for year, t in sorted(production.items()):
            for a, f in t.flags.items():
                if f == "W":
                    withheld[a].append(year)
        for a, ys in withheld.items():
            span = str(ys[0]) if len(ys) == 1 else f"{ys[0]}–{ys[-1]}"
            notes[a] = (WITHHELD[0].format(years=span), WITHHELD[1].format(years=span))

        series: dict[str, dict[int, float]] = defaultdict(dict)
        shares: dict[str, dict[int, float]] = defaultdict(dict)
        world: dict[int, float] = {}
        for year, t in production.items():
            for a, v in t.values.items():
                if v is not None:
                    series[a][year] = v
            if t.world is not None:
                world[year] = t.world
            for a, s in _share(t, t.world).items():
                shares[a][year] = round(s, 3)
            # 側欄：占全球 5% 以上，或全球前 5 名而且占 1% 以上
            ranked = sorted(((v, a) for a, v in t.values.items() if v), reverse=True)
            for v, a in ranked:
                rank = 1 + sum(1 for w, _ in ranked if w > v)  # 同值同名次
                share = shares[a].get(year)
                if share is not None and (share >= TOP_SHARE or (rank <= TOP_RANK and share >= TOP_RANK_MIN_SHARE)):
                    top[year][a].append([m.id, rank, round(share, 2), round(v, 3)])

        def note_dicts(extra: dict[str, tuple[str, str]] | None = None):
            merged = {**notes, **(extra or {})}
            return {a: zh for a, (zh, _) in sorted(merged.items())}, {a: en for a, (_, en) in sorted(merged.items())}

        zh, en = note_dicts()
        write_json(
            out / "production" / f"{m.id}.json",
            indicator_file(
                f"production/{m.id}", "公噸", years,
                {a: to_series(s, years) for a, s in sorted(series.items())},
                aggregates={"WLD": to_series(world, years)},
                notes=zh, notesEn=en,
            ),
            quiet=True,
        )
        write_json(
            out / "share" / f"{m.id}.json",
            indicator_file(
                f"share/{m.id}", "%", years,
                {a: to_series(s, years) for a, s in sorted(shares.items())},
                notes=zh, notesEn=en,
            ),
            quiet=True,
        )

        # 蘊藏量：世界總計有「>」（下限）時，分母用它跟列出國家加總的較大值
        r_years = sorted(reserves)
        r_series: dict[str, dict[int, float]] = defaultdict(dict)
        r_shares: dict[str, dict[int, float]] = defaultdict(dict)
        r_world: dict[int, float] = {}
        r_na: set[str] = set()
        for year, t in reserves.items():
            listed = sum(v for v in t.values.values() if v)
            total = max(t.world or 0, listed) if t.world_flag == ">" else t.world
            for a, v in t.values.items():
                if v is None:
                    r_na.add(a)
                else:
                    r_series[a][year] = v
            if total:
                r_world[year] = total
            for a, s in _share(t, total).items():
                r_shares[a][year] = round(s, 3)
        r_extra = {a: NOT_AVAILABLE_RESERVES for a in r_na if not r_series.get(a)}
        if m.slug == "platinum-group":
            r_extra.update({a: PGM_RESERVES for a in r_series})
        rzh, ren = note_dicts(r_extra)
        for key, data, unit in (("reserves", r_series, "公噸"), ("reserves-share", r_shares, "%")):
            write_json(
                out / key / f"{m.id}.json",
                indicator_file(
                    f"{key}/{m.id}", unit, r_years or years,
                    {a: to_series(s, r_years) for a, s in sorted(data.items())},
                    **({"aggregates": {"WLD": to_series(r_world, r_years)}} if key == "reserves" and r_years else {}),
                    notes=rzh, notesEn=ren,
                ),
                quiet=True,
            )

        latest = years[-2] if years[-1] == 2025 else years[-1]
        lead = max(production[latest].values.items(), key=lambda kv: kv[1] or 0)
        summary.append(
            f"{m.name} {latest} 年 {len(series)} 國，世界 {world.get(latest, 0):,.0f} 公噸，"
            f"最多 {lead[0]} {shares[lead[0]].get(latest, 0):.1f}%"
        )

    # 側欄的彙整：{年: {國家: [[礦種, 名次, 占比, 產量（公噸）], …]}}，依占比由大到小
    by_year = {
        str(y): {a: sorted(rows, key=lambda r: -r[2]) for a, rows in sorted(countries.items())}
        for y, countries in sorted(top.items())
    }
    write_json(
        out / "top-producers.json",
        {
            "minRank": TOP_RANK,
            "minRankShare": TOP_RANK_MIN_SHARE,
            "minShare": TOP_SHARE,
            "years": sorted(top),
            "byYear": by_year,
        },
    )
    write_json(
        out / "manifest.json",
        {
            "topic": "minerals",
            "generatedAt": now_iso(),
            "source": "USGS Mineral Commodity Summaries 2020–2026",
            "minerals": [{"id": m.id, "label": m.name, "labelEn": m.name_en} for m in MINERALS],
        },
    )
    for line in summary:
        print("  " + line)
