"""美國腎臟資料系統（USRDS）Annual Data Report 第 11 章 International Comparisons（2026 年版，2024 年的資料；
2025 年版用來補 2026 年版沒有 2024 年值的國家）。

- 網頁（https://usrds-adr.niddk.nih.gov/2026/end-stage-renal-disease/11-international-comparisons）是 React 應用，
  資料來自 GraphQL https://usrds-adr-api.niddk.nih.gov/graphql/<版本年> （POST、不必金鑰）；第 11 章是 chapterId 20。
- 授權：ADR 頁尾的 Copyright 連到 https://www.niddk.nih.gov/copyright ：「The majority of information on this site is
  copyright free and can be freely downloaded and reproduced. Content reproduced without changes should acknowledge
  the National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK) as the source.」國際的數字是各國的
  腎臟登錄系統提供給 USRDS 的（致謝有列）。
- 2026 年版圖 11.13「Rate of dialysis by country/region, 2024」：51 個國家或地區的每百萬人透析人數（年底的盛行率，
  沒有年齡調整）。2026 年版的趨勢圖 11.14 改成「2014–2024 年平均每年增加多少」的長條圖，不能拿來補缺值。
- 2025 年版圖 11.15「Rate of dialysis by country or region, 2023」（49 個）與 11.16a（10 個增加最多的國家加上美國的
  2013–2023 年）：補 2026 年版沒有的南韓、巴西、奈及利亞（使用者 2026-10-30 決定沿用上一版的值）。
"""
from __future__ import annotations

import json
import urllib.request

from common import CACHE_DIR, REFRESH, USER_AGENT, _ssl_context

URL = "https://usrds-adr-api.niddk.nih.gov/graphql/{edition}"
EDITION = 2026
QUERY = (
    "{sections(chapterId:20){figureNumber figure{figureNumber shortTitle yAxisLabel "
    "none{xAxis values{series{... on StandardSeriesType{name data}}}}}}}"
)


def _chapter(edition: int = EDITION) -> dict[str, dict]:
    target = CACHE_DIR / "usrds" / f"chapter11-{edition}.json"
    url = URL.format(edition=edition)
    if not target.exists() or REFRESH:
        target.parent.mkdir(parents=True, exist_ok=True)
        print(f"  下載 {url}（第 11 章）")
        request = urllib.request.Request(
            url, data=json.dumps({"query": QUERY}).encode(), method="POST",
            headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, context=_ssl_context(url)) as resp:
            target.write_bytes(resp.read())
    with open(target, encoding="utf-8") as f:
        sections = json.load(f)["data"]["sections"]
    return {s["figureNumber"]: s["figure"] for s in sections if s.get("figure")}


def by_place(figure: str, edition: int = EDITION) -> dict[str, float]:
    """依國家或地區排的長條圖（例如圖 11.13）：{USRDS 的名稱: 值}"""
    fig = _chapter(edition)[figure]
    series = fig["none"]["values"]["series"]
    if len(series) != 1:
        raise RuntimeError(f"USRDS {figure} 應該只有一個序列，實際 {len(series)}")
    return {name: v for name, v in zip(fig["none"]["xAxis"], series[0]["data"]) if v is not None}


def trends(figure: str, edition: int = EDITION) -> dict[str, dict[int, float]]:
    """歷年的折線圖（例如 2025 年版的圖 11.16a）：{USRDS 的名稱: {年: 值}}"""
    fig = _chapter(edition)[figure]
    years = [int(y) for y in fig["none"]["xAxis"]]
    return {
        s["name"]: {y: v for y, v in zip(years, s["data"]) if v is not None}
        for s in fig["none"]["values"]["series"]
    }
