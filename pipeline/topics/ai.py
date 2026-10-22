"""AI 主題：數據中心、算力、重要 AI 模型、AI 使用程度。

沒有任何 AI 公司按國家公布 token 用量，所以「使用量」用兩個公開、授權清楚的替代指標：
- Anthropic Economic Index：各國 Claude 使用量占比與人均使用指數（CC BY）
- Microsoft AI Diffusion：各國工作年齡人口中使用生成式 AI 的比例（MIT）
"""
from __future__ import annotations

import csv
from collections import Counter, defaultdict
from datetime import date

from common import OUT_DIR, download, indicator_file, now_iso, to_series, write_json
from geoindex import country_at
from sources import epoch, osm
from sources.countries import ISO3, from_name, to_iso3

OUT = OUT_DIR / "topics" / "ai"

AEI_BASE = "https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/"
AEI_2025 = "release_2025_09_15/data/output/aei_enriched_claude_ai_2025-08-04_to_2025-08-11.csv"
AEI_2026 = "release_2026_06_26/data/aei_claude_ai_2026-06-26.csv"
AEI_2026_MONTH = "2026-05-01"  # 這一版有 2026 年 4、5 月，取最新的 5 月
MS_URL = "https://raw.githubusercontent.com/microsoft/ai-diffusion-report/main/data/AI_Diffusion_Q22026_Update.csv"
# 每年取最後一期：2025 用下半年、2026 用第二季
MS_COLUMNS = {2025: "H2 2025 AI Diffusion", 2026: "Q2 2026 AI Diffusion"}

USE_CASES = ["use_case_work", "use_case_personal", "use_case_coursework"]
TOP_CLUSTERS = 10
TOP_MODELS = 12


def compute(clusters: list[epoch.Cluster]) -> None:
    """各國年底運作中的 AI 叢集算力（H100 等效數）。"""
    first = min(c.start.year for c in clusters)
    last = max(c.start.year for c in clusters)
    years = list(range(max(first, 2015), last + 1))
    by_country: dict[str, dict[int, float]] = defaultdict(dict)
    world: dict[int, float] = {}
    for year in years:
        live = epoch.operational_at(clusters, date(year, 12, 31))
        world[year] = sum(c.h100e for c in live)
        for c in live:
            by_country[c.country][year] = by_country[c.country].get(year, 0) + c.h100e
    # 已知叢集的加總：沒有列入的國家是 0，不是「無資料」
    write_json(OUT / "compute.json", indicator_file(
        "compute", "H100 等效", years,
        {a: [round(by_country.get(a, {}).get(y, 0)) for y in years] for a in ISO3},
        aggregates={"WLD": to_series(world, years, 0)},
    ))


def models(all_models: list[epoch.Model]) -> None:
    """各國每年發表的重要 AI 模型數（多國合作的模型，每個參與國各算一次）。"""
    this_year = date.today().year
    years = list(range(2010, this_year))  # 今年還沒結束，不收
    counts: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    world: dict[int, float] = defaultdict(float)
    for m in all_models:
        if m.published.year in years:
            world[m.published.year] += 1
            for iso3 in m.countries:
                counts[iso3][m.published.year] += 1
    write_json(OUT / "models.json", indicator_file(
        "models", "個", years,
        {a: [counts.get(a, {}).get(y, 0) for y in years] for a in ISO3},
        aggregates={"WLD": to_series(world, years, 0)},
    ))


def claude_usage() -> dict[str, dict[str, float]]:
    """Claude 使用量占比與人均使用指數；回傳各國 2026 年 5 月的用途比例（給側欄用）。"""
    share: dict[str, dict[int, float]] = defaultdict(dict)
    index: dict[str, dict[int, float]] = defaultdict(dict)

    path = download(AEI_BASE + AEI_2025, "anthropic", AEI_2025.rsplit("/", 1)[1])
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if row["geography"] != "country" or row["facet"] != "country":
                continue
            iso3 = to_iso3(row["geo_id"])
            if iso3 and row["variable"] == "usage_pct":
                share[iso3][2025] = float(row["value"])
            elif iso3 and row["variable"] == "usage_per_capita_index":
                index[iso3][2025] = float(row["value"])

    details: dict[str, dict[str, float]] = defaultdict(dict)
    path = download(AEI_BASE + AEI_2026, "anthropic", AEI_2026.rsplit("/", 1)[1])
    with open(path, encoding="utf-8", newline="") as f:  # 約 220 MB，逐列過濾
        for row in csv.DictReader(f):
            if row["geo_level"] != "country" or row["category_name"] != "overall" or row["date_start"] != AEI_2026_MONTH:
                continue
            iso3 = to_iso3(row["geo_id"])
            if not iso3:
                continue
            metric, value = row["metric_id"], float(row["value"])
            if metric == "usage_pct":
                share[iso3][2026] = value
            elif metric == "usage_per_capita_index":
                index[iso3][2026] = value
            elif metric.startswith(("use_case_", "artifact_")) and metric.endswith("_pct"):
                details[iso3][metric.removesuffix("_pct")] = value

    years = [2025, 2026]
    note = "2025 年為 8 月 4–11 日一週、2026 年為 5 月整月的 Claude.ai 對話抽樣（不含 API 與 Claude Code）"
    write_json(OUT / "claude-share.json", indicator_file(
        "claude-share", "%", years, {a: to_series(s, years, 3) for a, s in share.items()}, period=note))
    write_json(OUT / "claude-index.json", indicator_file(
        "claude-index", "倍", years, {a: to_series(s, years, 2) for a, s in index.items()}, period=note))
    return details


def diffusion() -> None:
    """工作年齡人口中使用生成式 AI 的比例（Microsoft AI Diffusion）。"""
    path = download(MS_URL, "microsoft", "AI_Diffusion_Q22026_Update.csv")
    with open(path, encoding="mac_roman", newline="") as f:  # 原檔是 Mac Roman 編碼（Türkiye 的 ü 是 0x9F）
        rows = list(csv.DictReader(f))
    years = list(MS_COLUMNS)
    values: dict[str, list] = {}
    unmatched = []
    for row in rows:
        iso3 = from_name(row["Economy"])
        if not iso3:
            unmatched.append(row["Economy"])
            continue
        values[iso3] = [
            round(float(row[col].strip().rstrip("%")), 1) if row.get(col, "").strip() else None
            for col in MS_COLUMNS.values()
        ]
    if unmatched:
        print(f"  Microsoft 資料有 {len(unmatched)} 個國名對不到：{unmatched}")
    write_json(OUT / "ai-adoption.json", indicator_file("ai-adoption", "%", years, values))


def country_details(
    clusters: list[epoch.Cluster], all_models: list[epoch.Model], usage: dict, centers: dict[str, dict]
) -> None:
    latest = epoch.operational_at(clusters, date.today())
    details: dict[str, dict] = defaultdict(dict)
    for iso3, info in centers.items():
        details[iso3]["datacenters"] = info
    for iso3 in {c.country for c in latest}:
        top = sorted((c for c in latest if c.country == iso3), key=lambda c: -c.h100e)[:TOP_CLUSTERS]
        details[iso3]["clusters"] = [
            {"name": c.name, "owner": c.owner, "h100e": round(c.h100e), "year": c.start.year, "sector": c.sector}
            for c in top
        ]
    by_country: dict[str, list[epoch.Model]] = defaultdict(list)
    for m in all_models:
        for iso3 in m.countries:
            by_country[iso3].append(m)
    for iso3, ms in by_country.items():
        recent = sorted(ms, key=lambda m: m.published, reverse=True)[:TOP_MODELS]
        details[iso3]["models"] = [
            {"name": m.name, "organization": m.organization, "date": m.published.isoformat()} for m in recent
        ]
        details[iso3]["modelCount"] = len(ms)
    for iso3, metrics in usage.items():
        details[iso3]["claude"] = {"period": AEI_2026_MONTH[:7], **{k: round(v, 2) for k, v in metrics.items()}}
    for iso3, data in details.items():
        write_json(OUT / "countries" / f"{iso3}.json", data, quiet=True)
    print(f"  {len(details)} 個國家的側欄資料")


def build() -> None:
    clusters = epoch.clusters()
    all_models = epoch.models()
    compute(clusters)
    models(all_models)
    usage = claude_usage()
    diffusion()
    centers, osm_timestamp = datacenters()
    country_details(clusters, all_models, usage, centers)
    write_json(OUT / "manifest.json", {
        "topic": "ai",
        "generatedAt": now_iso(),
        "source": "OpenStreetMap; Epoch AI; Anthropic Economic Index; Microsoft AI Economy Institute",
        "osmTimestamp": osm_timestamp,
    })


def datacenters() -> tuple[dict[str, dict], str]:
    """OpenStreetMap 上標示為數據中心的地點數。只有目前的快照，沒有歷年資料。

    各國標示的完整度差很多（例如中國明顯偏少），也包含小型機房，只能當作參考。
    """
    places, timestamp = osm.datacenters()
    by_country: dict[str, list[osm.Place]] = defaultdict(list)
    unassigned = 0
    for p in places:
        iso3 = country_at(p.lon, p.lat)
        if iso3 and not iso3.startswith("_"):
            by_country[iso3].append(p)
        else:
            unassigned += 1
    year = int(timestamp[:4]) if timestamp else date.today().year
    write_json(OUT / "datacenters.json", indicator_file(
        "datacenters", "座", [year], {a: [len(by_country.get(a, []))] for a in ISO3},
        aggregates={"WLD": [len(places)]}, snapshot=timestamp,
    ))
    print(f"  數據中心 {len(places)} 處（OSM {timestamp}），{unassigned} 處無法對應國家")
    details = {}
    for iso3, ps in by_country.items():
        operators = Counter(p.operator.strip() for p in ps if p.operator.strip())
        details[iso3] = {
            "count": len(ps),
            "snapshot": timestamp[:10],
            "operators": operators.most_common(8),
            "unnamed": sum(1 for p in ps if not p.operator.strip()),
        }
    return details, timestamp
