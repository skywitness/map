"""企業與品牌：世界最大的企業、最有價值的品牌、獨角獸新創（2026-11-07，製作手冊第二十五批 465，合併候選 1111、1117、1118；
步驟 companies-rankings，輸出 topics/companies/）。

上游的 Forbes、Fortune、Kantar、Brand Finance、CB Insights 的條款都不准轉載，**只用英文維基百科的轉引表**
（CC BY-SA 4.0，資料檔同樣授權），用 sources/wikipedia_html.py 讀固定版本的 HTML（/wiki/<條目>?oldid=，
robots.txt 允許；手冊寫的 index.php?action=raw 在 robots.txt 的 /w/ 底下，不用）。
- forbes-2000.json：「Forbes Global 2000」第一張表，2026 年各國的家數與最高名次的公司（hints）。
- largest-50.json：「List of largest companies by revenue」前 50 大營收企業的總部國家家數，hints 列公司、營收、是否國營。
- top-brands/<kantar|brand-finance>.json：「List of most valuable brands」的 Kantar BrandZ 2026（前 100）與
  Brand Finance 2026（前 50）各國有幾個品牌，hints 列品牌。Interbrand 2025 的表沒有國家欄，不做。
- unicorns/<count|per-million>.json：「List of unicorn startup companies」的 Countries 表（截至 2026 年 3 月，含已上市或
  被併購的前獨角獸）。每百萬人用表裡的數字，但人口不到 50 萬的不畫（人口用表裡的家數 ÷ 每百萬人反推）：一家就變成每百萬人幾十家。
都放在 2026 年（單一快照）。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, write_json, write_manifest_part
from sources import wikipedia_html as wiki
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "companies"
YEAR = 2026
PAGES = {
    "forbes": ("Forbes Global 2000", 1383885674),
    "revenue": ("List of largest companies by revenue", 1383411664),
    "brands": ("List of most valuable brands", 1378647641),
    "unicorns": ("List of unicorn startup companies", 1383886104),
}
SMALL = 500_000  # 人口不到這個數的國家不畫每百萬人
LICENSE = "CC BY-SA 4.0"


def _iso(cell: tuple[str, list[str], bool]) -> str | None:
    for name in [*cell[1], cell[0]]:
        if iso := from_name(name):
            return iso
    return None


def _num(text: str) -> float | None:
    return wiki.number(text)


def _write(path, indicator: str, unit: str, values: dict[str, float], hints: dict[str, str] | None = None,
           hints_en: dict[str, str] | None = None, **extra) -> None:
    data = indicator_file(indicator, unit, [YEAR], {c: [v] for c, v in sorted(values.items())}, license=LICENSE, **extra)
    if hints:
        data["hints"] = hints
    if hints_en:
        data["hintsEn"] = hints_en
    write_json(path, data, quiet=True)


def _forbes() -> None:
    table = wiki.tables(wiki.page(*PAGES["forbes"]))[0]
    counts, hints, hints_en, missing = {}, {}, {}, []
    for row in table[1:]:
        if len(row) < 4 or not (n := _num(row[2][0])):
            continue
        iso = _iso(row[1])
        if not iso:
            missing.append(row[1][0])
            continue
        counts[iso] = counts.get(iso, 0) + n
        hints[iso] = f"最高名次：{row[3][0]}"
        hints_en[iso] = f"Highest ranked: {row[3][0]}"
    if missing:
        print(f"  Forbes 對不到國家：{missing}")
    print(f"  Forbes Global 2000：{len(counts)} 國、{sum(counts.values()):.0f} 家；"
          f"{sorted(((v, c) for c, v in counts.items()), reverse=True)[:12]}；台灣 {counts.get('TWN')}")
    _write(OUT / "forbes-2000.json", "forbes-2000", "家", counts, hints, hints_en)


def _revenue() -> None:
    table = wiki.tables(wiki.page(*PAGES["revenue"]))[0]
    header = [c[0] for c in table[0]]
    col = {k: header.index(k) for k in ("Name", "Revenue", "Headquarters", "State-owned")}
    by: dict[str, list[str]] = defaultdict(list)
    by_en: dict[str, list[str]] = defaultdict(list)
    missing = []
    for row in table[1:]:
        if len(row) <= col["State-owned"] or not row[0][0].strip().isdigit():
            continue
        iso = _iso(row[col["Headquarters"]])
        if not iso:
            missing.append(row[col["Headquarters"]][0])
            continue
        name, revenue = row[col["Name"]][0], row[col["Revenue"]][0]
        state = row[col["State-owned"]][0].strip().lower().startswith("yes")
        rev = _num(revenue)
        rev_zh = f"{rev * 10:,.0f} 億美元" if rev else revenue
        by[iso].append(f"{row[0][0]}. {name}（{rev_zh}{'，國營' if state else ''}）")
        by_en[iso].append(f"{row[0][0]}. {name} (US${revenue} bn{', state-owned' if state else ''})")
    if missing:
        print(f"  前 50 大對不到國家：{missing}")
    counts = {c: len(v) for c, v in by.items()}
    print(f"  前 50 大營收企業：{sum(counts.values())} 家；{sorted(((v, c) for c, v in counts.items()), reverse=True)}")
    _write(OUT / "largest-50.json", "largest-50", "家", counts, {c: "、".join(v) for c, v in by.items()},
           {c: "; ".join(v) for c, v in by_en.items()})


def _brands() -> None:
    tables = wiki.tables(wiki.page(*PAGES["brands"]))
    for key, idx, size in (("kantar", 0, 100), ("brand-finance", 1, 50)):
        table = tables[idx]
        header = [c[0] for c in table[0]]
        ci, bi = header.index("Country"), header.index("Brand")
        by: dict[str, list[str]] = defaultdict(list)
        missing = []
        for row in table[1:]:
            if len(row) <= ci:
                continue
            iso = _iso(row[ci])
            if not iso:
                missing.append(row[ci][0])
                continue
            by[iso].append(f"{row[0][0]}. {row[bi][0]}")
        n = sum(len(v) for v in by.values())
        if n < size - 2:
            raise RuntimeError(f"品牌表 {key} 只讀到 {n} 個（應有 {size}）")
        if missing:
            print(f"  品牌 {key} 對不到國家：{missing}")
        counts = {c: len(v) for c, v in by.items()}
        print(f"  品牌 {key}：{n} 個；{sorted(((v, c) for c, v in counts.items()), reverse=True)}")
        lists = {c: "、".join(v) for c, v in by.items()}
        _write(OUT / "top-brands" / f"{key}.json", "top-brands", "個", counts, lists, {c: "; ".join(v) for c, v in by.items()})


def _unicorns() -> None:
    table = next(t for t in wiki.tables(wiki.page(*PAGES["unicorns"])) if t and t[0][0][0] == "Country")
    counts, per, missing, small = {}, {}, [], []
    for row in table[1:]:
        if len(row) < 3 or (n := _num(row[1][0])) is None:
            continue
        iso = _iso(row[0])
        if not iso:
            missing.append(row[0][0])
            continue
        counts[iso] = n
        v = _num(row[2][0])
        if v and n / v * 1e6 < SMALL:  # 表裡的家數 ÷ 每百萬人 = 表用的人口（安圭拉不在 WDI，這樣也算得到）
            small.append(iso)
        elif v is not None:
            per[iso] = v
    if missing:
        print(f"  獨角獸對不到國家：{missing}")
    print(f"  獨角獸：{len(counts)} 國、{sum(counts.values()):.0f} 家；人口不到 50 萬不畫每百萬人：{small}")
    print(f"    每百萬人：{sorted(((v, c) for c, v in per.items()), reverse=True)[:10]}；台灣 {counts.get('TWN')}、{per.get('TWN')}")
    note = {c: "人口不到 50 萬，每百萬人的數字不穩定，不畫" for c in small}
    note_en = {c: "Population under 500,000: the per-million figure is unstable and not shown" for c in small}
    _write(OUT / "unicorns" / "count.json", "unicorns", "家", counts)
    _write(OUT / "unicorns" / "per-million.json", "unicorns", "家/百萬人", per, noValue=note, noValueEn=note_en)


def build() -> None:
    _forbes()
    _revenue()
    _brands()
    _unicorns()
    write_manifest_part(OUT, "companies", "companies-rankings",
                        {"sources": [f"English Wikipedia: {t} (oldid {r})" for t, r in PAGES.values()], "generatedAt": now_iso()})
