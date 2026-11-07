"""氣候資金：綠色氣候基金撥給誰（新主題，2026-11-07，製作手冊第二十五批 481，候選 1140；環境的「碳與氣候政策」）。

Green Climate Fund 公開 API https://api.gcfund.org/v1/projects（JSON，不必金鑰；api.gcfund.org 沒有 robots.txt，回 404），
每個計畫有核定日、主題（調適、減緩、跨領域）、狀態、各國分到的 GCF 金額（Countries[].Financing[].GCF，美元）。
多國計畫照手冊用分國金額，不用計畫層的 TotalGCFFunding（有 50 個計畫的分國金額加起來跟計畫總額不一樣）。
授權：https://www.greenclimate.fund/terms-and-conditions「…for non-commercial purposes」，轉載要附
「First published by the Green Climate Fund」與可以點的 https://greenclimate.fund 連結——只准非商業使用。

輸出 public/data/topics/climate-finance/：
- approved/{all,adaptation,mitigation,crosscutting}.json：到這一年為止核定給這一國的 GCF 金額（美元，依核定年累計）；
- projects.json：到這一年為止的計畫數；
- country-projects.json：側欄的計畫清單（編號、名稱、核定年、這一國分到的金額、主題、狀態）。
"""

from __future__ import annotations

from collections import defaultdict

import json

from common import OUT_DIR, download, indicator_file, now_iso, write_json

OUT = OUT_DIR / "topics" / "climate-finance"
URL = "https://api.gcfund.org/v1/projects"
LICENSE = "First published by the Green Climate Fund (https://greenclimate.fund); non-commercial use only"
THEMES = {"Adaptation": "adaptation", "Mitigation": "mitigation", "Cross-cutting": "crosscutting"}
STATUS = {"Under Implementation": "implementing", "Approved": "approved", "Completed": "completed",
          "Lapsed": "lapsed", "Discontinued": "discontinued"}
TW_NOTE = "台灣不是氣候公約的締約方，不是綠色氣候基金的受援國"
TW_NOTE_EN = "Taiwan is not a party to the UN climate convention and does not receive Green Climate Fund money"


def build() -> None:
    projects = json.loads(download(URL, "gcf", "projects.json").read_text(encoding="utf-8"))
    by: dict[str, dict[str, dict[int, float]]] = {k: defaultdict(lambda: defaultdict(float)) for k in ["all", *THEMES.values()]}
    count: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    rows: dict[str, list] = defaultdict(list)
    first = last = None
    for p in projects:
        year = int(p["ApprovalDate"][:4])
        first = year if first is None else min(first, year)
        last = year if last is None else max(last, year)
        theme = THEMES[p["Theme"]]
        for c in p["Countries"]:
            iso3 = c["ISO3"]
            amount = sum(f["GCF"] or 0 for f in c["Financing"] if f["Currency"] == "USD")
            by["all"][iso3][year] += amount
            by[theme][iso3][year] += amount
            count[iso3][year] += 1
            rows[iso3].append([p["ApprovedRef"], p["ProjectName"], year, round(amount), theme,
                               STATUS.get(p["Status"], p["Status"]), len(p["Countries"])])
    years = list(range(first, last + 1))

    def cumulative(series: dict[int, float]) -> list[float]:
        out, run = [], 0.0
        for y in years:
            run += series.get(y, 0.0)
            out.append(round(run))
        return out

    common = {"noValue": {"TWN": TW_NOTE}, "noValueEn": {"TWN": TW_NOTE_EN}, "license": LICENSE}
    for key, data in by.items():
        write_json(OUT / "approved" / f"{key}.json", indicator_file(
            "approved", "美元", years, {k: cumulative(v) for k, v in data.items() if sum(v.values()) > 0}, **common))
    write_json(OUT / "projects.json", indicator_file(
        "projects", "件", years, {k: cumulative(v) for k, v in count.items()}, **common))
    write_json(OUT / "country-projects.json", {
        "fields": ["ref", "name", "year", "gcf", "theme", "status", "countries"],
        "countries": {k: sorted(v, key=lambda r: (-r[2], -r[3])) for k, v in rows.items()},
    })
    write_json(OUT / "manifest.json", {"topic": "climate-finance", "generatedAt": now_iso(),
                                       "sources": [f"Green Climate Fund API ({len(projects)} projects)"]})
    total = sum(sum(v.values()) for v in by["all"].values())
    print(f"  {len(projects)} 個計畫、{len(by['all'])} 國、分國金額合計 {total / 1e8:.1f} 億美元，{first}–{last}")
