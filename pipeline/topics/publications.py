"""學術論文主題：OpenAlex（CC0 1.0）的各國論文數、國際合著、開放取用、高被引論文與合著對象。

資料（sources/openalex.py，只用 API 的 group_by，約 300 次查詢、存在 .cache/openalex/）：
- 論文：期刊論文、回顧論文、會議論文（OpenAlex 的 article、review、conference-paper），不含撤回的；
  **只算 CWTS 核心來源**（`primary_location.source.is_core`：國際性的學術期刊與會議論文集，Leiden Ranking
  Open Edition 用的那一份，約 3.6 萬個來源）。全部來源的論文數另外放在側欄對照。
- **整數計數**（full counting）：一篇論文有台灣與美國的作者，台灣、美國各算一篇，所以各國加總比全世界多。
  作者的國家是作者所屬機構的國家（同一位作者有兩個國家的機構時兩國都算）。
- 2000–2025 年（依出版年；2026 年還沒結束，不收）。高被引論文只到 2024 年（2025 年的論文被引用的時間太短）。

人均用 UN WPP 2024 的年中人口（2024 年起是中推估）。

輸出（public/data/topics/publications/）：
- per-million/{item}.json（每百萬人論文數，預設）、papers/{item}.json（論文數）、international/{item}.json（國際合著比例）、
  open-access/{item}.json（開放取用比例）、top10/{item}.json（高被引論文比例）；item 是 all 與 4 個領域
- coauthors.json（國際合著論文數，流向指標的數值）與 flows/<年>.json（每個國家前 15 個合著國家）
- countries/<ISO3>.json（側欄：歷年的論文數、全部來源、國際合著、開放取用、高被引、26 個學科）、world.json、manifest.json
"""
from __future__ import annotations

import re

from common import OUT_DIR, ROOT, indicator_file, now_iso, write_json
from sources import openalex as oa
from sources import wpp

OUT = OUT_DIR / "topics" / "publications"
YEARS = (2000, 2025)
TOP10_LAST = 2024  # 高被引論文只到這一年：最新一年的論文被引用的時間太短
# 高被引論文的比例在 2017 年所有國家一起下降（全世界 2016 年 25.5%、2017 年 21.3%，美國 36% → 30%、德國 36% → 30%），
# 不是真的變化，是 OpenAlex 的 citation_normalized_percentile 在那一年前後的基準不同：指標檔標 methodBreak，側欄畫垂直虛線
TOP10_BREAK = 2017
# 子項目：OpenAlex 的 4 個領域（domain）。論文的領域是它的主要主題（primary_topic，依標題與摘要分類）所屬的領域
DOMAINS = {"physical": 3, "life": 1, "health": 4, "social": 2}
ITEMS = ["all", *DOMAINS]
# 26 個學科（field）→ 領域（OpenAlex 的 /fields，2026-10-27 查）
FIELDS = {
    11: 1, 13: 1, 24: 1, 28: 1, 30: 1,
    12: 2, 14: 2, 18: 2, 20: 2, 32: 2, 33: 2,
    15: 3, 16: 3, 17: 3, 19: 3, 21: 3, 22: 3, 23: 3, 25: 3, 26: 3, 31: 3,
    27: 4, 29: 4, 34: 4, 35: 4, 36: 4,
}
METRICS = {
    "international": "countries_distinct_count:>1",
    "open-access": "open_access.is_oa:true",
    "top10": "citation_normalized_percentile.is_in_top_10_percent:true",
}
# 2025 年人口不到 10 萬的地方不算人均（摩納哥、列支敦斯登、聖馬利諾、格陵蘭…幾個研究機構就讓人均很高），
# 清單寫在 src/topics/publications.ts 的 SMALL（會檢查）
MIN_POPULATION = 100_000
MIN_PAPERS = 100  # 比例要那一年（那個領域）有 100 篇以上才算
TOP_N = 15  # 流向檔每個國家存的合著國家數

# 國科會《科學技術統計要覽》2025 年版表 II-9「SCIE 各國論文發表篇數及名次」（國研院科政中心依 InCites 整理，更新日期 2025-11；
# 國科會統計資料庫 https://wsts.nstc.gov.tw/stsweb/technology/TechnologyDataIndex.aspx?language=C ，2026-10-30 查）：
# SCIE 加 SSCI，文獻類型是論文與評論，中國含香港、澳門。只拿來對照數量級，寫在台灣的附註
# （製作手冊第八批 157；原本用 2019 年版的 2014–2018 年，教育部統計處 OVERVIEW_N09 轉載）
TW_SCI = {2020: (32_870, 21), 2021: (37_825, 22), 2022: (36_782, 21), 2023: (31_177, 22), 2024: (31_029, 22)}
TW_SCI_YEARS = (2020, 2024)  # 附註寫的頭尾兩年


def check_topic(small: list[str]) -> None:
    """主題設定（src/topics/publications.ts）裡寫的門檻與小地方清單要跟這裡一樣"""
    text = (ROOT / "src" / "topics" / "publications.ts").read_text(encoding="utf-8")
    for name, value in (("MIN_PAPERS", MIN_PAPERS), ("TOP10_LAST", TOP10_LAST)):
        found = re.search(rf"export const {name} = ([\d_]+);", text)
        if not found or int(found.group(1).replace("_", "")) != value:
            raise ValueError(f"src/topics/publications.ts 的 {name} 跟 pipeline 的 {value} 不同")
    found = re.search(r"const SMALL = \[([^\]]*)\]", text)
    listed = sorted(re.findall(r"'([A-Z]{3})'", found.group(1))) if found else None
    if listed != sorted(small):
        raise ValueError(f"src/topics/publications.ts 的 SMALL 要改成 {sorted(small)}（現在是 {listed}）")


def build() -> None:
    years = list(range(YEARS[0], YEARS[1] + 1))
    population = wpp.demographic(["TPopulation1July"], last_year=YEARS[1])["TPopulation1July"]  # 千人

    # ── 查詢（有快取） ──
    papers: dict[str, oa.Counts] = {}
    totals: dict[str, dict[int, int]] = {}
    unknown: dict[str, dict[int, int]] = {}
    metric: dict[tuple[str, str], oa.Counts] = {}
    metric_totals: dict[tuple[str, str], dict[int, int]] = {}
    for item in ITEMS:
        dom = f"primary_topic.domain.id:{DOMAINS[item]}" if item in DOMAINS else ""
        papers[item], totals[item], unknown[item] = oa.by_year_country(f"{item}-papers", YEARS, dom)
        for m, flt in METRICS.items():
            extra = ",".join(x for x in (dom, flt) if x)
            metric[item, m], metric_totals[item, m], _ = oa.by_year_country(f"{item}-{m}", YEARS, extra)
    all_sources, all_sources_total, all_sources_unknown = oa.by_year_country("allsources-papers", YEARS, base=oa.BASE_ALL)
    fields: dict[int, oa.Counts] = {}
    field_totals: dict[int, dict[int, int]] = {}
    for fid in FIELDS:
        fields[fid], field_totals[fid], _ = oa.by_year_country(f"field-{fid}", YEARS, f"primary_topic.field.id:{fid}")
    _check_domains(papers, fields, totals, field_totals)

    world_unknown_share = {y: unknown["all"].get(y, 0) / totals["all"][y] for y in years}
    print("  沒有國家資料的論文：" + "、".join(f"{y} {world_unknown_share[y]:.1%}" for y in (2000, 2010, 2020, 2024, 2025)))

    # ── 人口（最新一年）不到 10 萬的地方不算人均（所有年份一起，同一個地方不會有的年份有、有的沒有） ──
    small = sorted(c for c in papers["all"] if c in population and population[c][YEARS[1]] * 1000 < MIN_POPULATION)
    check_topic(small)

    notes, notes_en = _taiwan_notes(papers["all"])

    def series(counts: dict[int, int] | None, last: int = YEARS[1]) -> list[float | None]:
        return [None if y > last else (counts or {}).get(y) for y in years]

    for item in ITEMS:
        # 論文數
        values = {c: series(s) for c, s in papers[item].items()}
        tw_notes = (notes, notes_en) if item == "all" else ({}, {})  # 台灣的 SCI 對照只放全部領域的論文數與人均
        _write(f"papers/{item}", "篇", years, values, [totals[item][y] for y in years], *tw_notes)
        # 每百萬人
        per_million: dict[str, list[float | None]] = {}
        for c, s in papers[item].items():
            pop = population.get(c)
            if not pop or c in small:
                continue
            row = [round(s[y] / (pop[y] * 1000) * 1e6, 2) if s.get(y) else None for y in years]
            if any(v is not None for v in row):
                per_million[c] = row
        world_pm = [round(totals[item][y] / (population["WLD"][y] * 1000) * 1e6, 2) for y in years]
        _write(f"per-million/{item}", "篇／百萬人", years, per_million, world_pm, *tw_notes)
        # 比例
        for m in METRICS:
            last = TOP10_LAST if m == "top10" else YEARS[1]
            m_years = [y for y in years if y <= last]
            share: dict[str, list[float | None]] = {}
            for c, s in papers[item].items():
                got = metric[item, m].get(c, {})
                row = [round(got.get(y, 0) / s[y] * 100, 3) if s.get(y, 0) >= MIN_PAPERS else None for y in m_years]
                if any(v is not None for v in row):
                    share[c] = row
            mt = metric_totals[item, m]
            if m == "international":
                # 分母是有國家資料的論文（沒有國家資料的論文不知道是不是國際合著）
                world = [round(mt.get(y, 0) / (totals[item][y] - unknown[item].get(y, 0)) * 100, 3) for y in m_years]
            else:
                world = [round(mt.get(y, 0) / totals[item][y] * 100, 3) for y in m_years]
            # 高被引：2017 年起所有國家一起降約 4 個百分點（全世界 25.5% → 21.3%），是 OpenAlex 比較基準的變化
            extra = {"methodBreak": TOP10_BREAK} if m == "top10" else {}
            if m == "top10" and item == "all":
                drop = world[m_years.index(TOP10_BREAK - 1)] - world[m_years.index(TOP10_BREAK)]
                if drop < 2.5:
                    raise ValueError(f"高被引論文的全世界比例在 {TOP10_BREAK} 年只差 {drop:.1f} 個百分點，OpenAlex 可能修正了，檢查後拿掉 TOP10_BREAK")
            _write(f"{m}/{item}", "%", m_years, share, world, {}, {}, **extra)

    # ── 合著：流向檔與國際合著論文數 ──
    intl = metric["all", "international"]
    _write("coauthors", "篇", years, {c: series(s) for c, s in intl.items()},
           [metric_totals["all", "international"][y] for y in years], {}, {})
    flows: dict[int, dict[str, list]] = {y: {} for y in years}
    mismatch = []
    for c in sorted(intl):
        if c not in oa.ALPHA2:
            continue
        by_year = oa.partners(oa.ALPHA2[c], YEARS)
        for y, counts in by_year.items():
            own = counts.pop(c, None)
            expected = papers["all"].get(c, {}).get(y)
            if own != expected:
                mismatch.append(f"{c} {y} {own}/{expected}")
            total = intl[c].get(y)
            if not total or not counts:
                continue
            ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP_N]
            flows[y][c] = [total, [[p, v] for p, v in ranked]]
    if mismatch:
        print(f"  合著查詢的本國篇數跟論文數不同（查詢時間不同，資料有更新）：{len(mismatch)} 筆，例如 {mismatch[:5]}")
        if len(mismatch) > 50:
            raise ValueError("合著查詢跟論文數差太多，可能要 --refresh 全部重抓")
    flow_bytes = 0
    for y in years:
        path = OUT / "flows" / f"{y}.json"
        write_json(path, {"item": "coauthors", "year": y, "unit": "篇", "scale": 1, "export": flows[y], "import": {}}, quiet=True)
        flow_bytes += path.stat().st_size
    print(f"  流向檔 {len(years)} 個，共 {flow_bytes / 1024:.0f} KB")

    # ── 側欄：各國的歷年數字與學科 ──
    written = 0
    size = 0
    for c in sorted(papers["all"]):
        detail = {
            "first": years[0],
            "papers": series(papers["all"][c]),
            "allSources": series(all_sources.get(c)),
            "international": series(intl.get(c)),
            "openAccess": series(metric["all", "open-access"].get(c)),
            "top10": series(metric["all", "top10"].get(c), TOP10_LAST),
            "fields": {str(f): series(fields[f].get(c)) for f in FIELDS if fields[f].get(c)},
        }
        path = OUT / "countries" / f"{c}.json"
        write_json(path, detail, quiet=True)
        size += path.stat().st_size
        written += 1
    print(f"  countries/：{written} 個檔，共 {size / 1024:.0f} KB")
    world_detail = {
        "first": years[0],
        "papers": [totals["all"][y] for y in years],
        "allSources": [all_sources_total[y] for y in years],
        "unknown": [unknown["all"].get(y, 0) for y in years],
        "allSourcesUnknown": [all_sources_unknown.get(y, 0) for y in years],
        "international": [metric_totals["all", "international"].get(y, 0) for y in years],
        "openAccess": [metric_totals["all", "open-access"].get(y, 0) for y in years],
        "top10": [metric_totals["all", "top10"].get(y, 0) if y <= TOP10_LAST else None for y in years],
        "fields": {str(f): [field_totals[f].get(y, 0) for y in years] for f in FIELDS},
    }
    write_json(OUT / "world.json", world_detail)

    _report(years, papers, metric, population, small, all_sources, fields)
    write_json(
        OUT / "manifest.json",
        {
            "topic": "publications",
            "generatedAt": now_iso(),
            "source": "OpenAlex (api.openalex.org, group_by queries); population: UN World Population Prospects 2024",
            "sourceUrl": [oa.SITE, oa.HELP, oa.CORE_LIST, wpp.URL],
            "license": "CC0 1.0 (OpenAlex); CC BY 3.0 IGO (UN WPP 2024)",
            "citation": "Priem, J., Piwowar, H., & Orr, R. (2022). OpenAlex: A fully-open index of scholarly works, authors, "
            "venues, institutions, and concepts. arXiv:2205.01833",
            "method": f"Works of type article, review or conference-paper, not retracted, whose primary location is a CWTS core "
            f"source (primary_location.source.is_core), by publication year {YEARS[0]}–{YEARS[1]}. Full counting by the "
            "countries of the authors' institutions (a paper with authors in two countries counts once for each). "
            "International co-authorship: countries_distinct_count > 1. Open access: open_access.is_oa. Highly cited: "
            f"citation_normalized_percentile.is_in_top_10_percent (to {TOP10_LAST}). Fields: primary_topic. Shares need at "
            f"least {MIN_PAPERS} papers; per-capita needs a population of {MIN_POPULATION:,}.",
        },
    )


def _check_domains(papers, fields, totals, field_totals) -> None:
    """一篇論文只有一個主要主題，所以每個領域的論文數 = 它底下學科的加總（全世界與台灣都核對）"""
    for item, dom in DOMAINS.items():
        fids = [f for f, d in FIELDS.items() if d == dom]
        for y, n in totals[item].items():
            s = sum(field_totals[f].get(y, 0) for f in fids)
            if abs(s - n) > max(5, n * 0.001):
                raise ValueError(f"{item} {y}：領域 {n:,} 篇，學科加總 {s:,} 篇")
        tw = papers[item].get("TWN", {})
        for y, n in tw.items():
            s = sum(fields[f].get("TWN", {}).get(y, 0) for f in fids)
            if abs(s - n) > max(5, n * 0.002):
                raise ValueError(f"台灣 {item} {y}：領域 {n:,} 篇，學科加總 {s:,} 篇")


def _rank(values: dict[str, dict[int, int]] | dict[str, float], c: str, y: int | None = None) -> tuple[int, int]:
    """(名次, 有值的國家數)；values 是 {國家: {年: 值}}（給 y）或 {國家: 值}"""
    flat = {k: (v.get(y) if isinstance(v, dict) else v) for k, v in values.items()}
    ranked = sorted((v for v in flat.values() if v is not None), reverse=True)
    return (ranked.index(flat[c]) + 1 if flat.get(c) is not None else 0), len(ranked)


def _taiwan_notes(papers_all: dict[str, dict[int, int]]) -> tuple[dict[str, str], dict[str, str]]:
    tw = papers_all["TWN"]
    parts_zh, parts_en = [], []
    for y in TW_SCI_YEARS:
        sci, sci_rank = TW_SCI[y]
        rank, n = _rank(papers_all, "TWN", y)
        parts_zh.append(f"{y} 年 SCIE 論文 {sci:,} 篇（第 {sci_rank} 名），這裡是 {tw[y]:,} 篇（第 {rank} 名）")
        parts_en.append(f"{sci:,} SCIE papers in {y} (rank {sci_rank}), against {tw[y]:,} here (rank {rank})")
    zh = (
        "國科會《科學技術統計要覽》2025 年版依 Web of Science 的 SCIE 與 SSCI（論文與評論，國研院科政中心整理）："
        + "；".join(parts_zh)
        + "。SCIE、SSCI 只收 Web of Science 選的期刊，這裡另外含人文的期刊與會議論文，資料庫與收錄範圍都不同。"
    )
    en = (
        "The Indicators of Science and Technology, 2025 edition, by the National Science and Technology Council, "
        "based on Web of Science's SCIE and SSCI (articles and reviews, compiled by STPI), gives "
        + "; ".join(parts_en)
        + ". SCIE and SSCI cover only the journals selected by Web of Science, while this map also includes "
        "humanities journals and conference papers, so the databases and coverage differ."
    )
    return {"TWN": zh}, {"TWN": en}


def _write(name, unit, years, values, world, notes, notes_en, **extra) -> None:
    keep = lambda d: {c: n for c, n in d.items() if c in values}  # noqa: E731
    write_json(
        OUT / f"{name}.json",
        indicator_file(name.split("/")[0], unit, years, values, aggregates={"WLD": world},
                       notes=keep(notes), notesEn=keep(notes_en), **extra),
    )


def _report(years, papers, metric, population, small, all_sources, fields) -> None:
    y = years[-1]
    tw = "TWN"
    p = papers["all"]
    print(f"  人口不到 {MIN_POPULATION:,}、不算人均：{small}")
    rank, n = _rank(p, tw, y)
    pm = {c: s[y] / (population[c][y] * 1000) * 1e6 for c, s in p.items() if c in population and c not in small and s.get(y)}
    pm_rank, pm_n = _rank(pm, tw)
    print(f"  台灣 {y} 年：論文 {p[tw][y]:,} 篇（第 {rank}／{n}），每百萬人 {pm[tw]:.0f}（第 {pm_rank}／{pm_n}），"
          f"全部來源 {all_sources[tw][y]:,} 篇（核心占 {p[tw][y] / all_sources[tw][y]:.0%}）")
    top_pm = sorted(pm.items(), key=lambda kv: -kv[1])[:12]
    print("  每百萬人前 12：" + "、".join(f"{c} {v:.0f}" for c, v in top_pm))
    for m in METRICS:
        yy = TOP10_LAST if m == "top10" else y
        share = {c: metric["all", m].get(c, {}).get(yy, 0) / s[yy] * 100 for c, s in p.items() if s.get(yy, 0) >= MIN_PAPERS}
        r, n2 = _rank(share, tw)
        print(f"  台灣 {yy} 年 {m}：{share[tw]:.1f}%（第 {r}／{n2}）")
    for item in DOMAINS:
        print(f"  台灣 {y} 年 {item}：{papers[item][tw][y]:,} 篇")
    tw_fields = sorted(((fields[f].get(tw, {}).get(y, 0), f) for f in FIELDS), reverse=True)[:6]
    print(f"  台灣 {y} 年學科前 6：{tw_fields}")
    for yy in (2000, 2010):
        print(f"  台灣 {yy} 年：{p[tw][yy]:,} 篇（第 {_rank(p, tw, yy)[0]}）")
