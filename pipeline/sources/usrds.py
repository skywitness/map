"""美國腎臟資料系統（USRDS）Annual Data Report 第 11 章 International Comparisons（2025 年版，2023 年的資料）。

- 網頁（https://usrds-adr.niddk.nih.gov/2025/end-stage-renal-disease/11-international-comparisons）是 React 應用，
  資料來自 GraphQL https://usrds-adr-api.niddk.nih.gov/graphql/2025 （POST、不必金鑰）；第 11 章是 chapterId 20。
- 授權：ADR 頁尾的 Copyright 連到 https://www.niddk.nih.gov/copyright ：「The majority of information on this site is
  copyright free and can be freely downloaded and reproduced. Content reproduced without changes should acknowledge
  the National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK) as the source.」國際的數字是各國的
  腎臟登錄系統提供給 USRDS 的（致謝有列）。
- 圖 11.15「Rate of dialysis by country or region, 2023」：49 個國家或地區的每百萬人透析人數（年底的盛行率，
  沒有年齡調整）；圖 11.16a 是 10 個增加最多的國家加上美國的 2013–2023 年，補 2023 年沒有值的韓國、印尼。
"""
from __future__ import annotations

import json
import urllib.request

from common import CACHE_DIR, REFRESH, USER_AGENT, _ssl_context

URL = "https://usrds-adr-api.niddk.nih.gov/graphql/2025"
QUERY = (
    "{sections(chapterId:20){figureNumber figure{figureNumber shortTitle yAxisLabel "
    "none{xAxis values{series{... on StandardSeriesType{name data}}}}}}}"
)


def _chapter() -> dict[str, dict]:
    target = CACHE_DIR / "usrds" / "chapter11-2025.json"
    if not target.exists() or REFRESH:
        target.parent.mkdir(parents=True, exist_ok=True)
        print(f"  下載 {URL}（第 11 章）")
        request = urllib.request.Request(
            URL, data=json.dumps({"query": QUERY}).encode(), method="POST",
            headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, context=_ssl_context(URL)) as resp:
            target.write_bytes(resp.read())
    with open(target, encoding="utf-8") as f:
        sections = json.load(f)["data"]["sections"]
    return {s["figureNumber"]: s["figure"] for s in sections if s.get("figure")}


def by_place(figure: str) -> dict[str, float]:
    """依國家或地區排的長條圖（例如圖 11.15）：{USRDS 的名稱: 值}"""
    fig = _chapter()[figure]
    series = fig["none"]["values"]["series"]
    if len(series) != 1:
        raise RuntimeError(f"USRDS {figure} 應該只有一個序列，實際 {len(series)}")
    return {name: v for name, v in zip(fig["none"]["xAxis"], series[0]["data"]) if v is not None}


def trends(figure: str) -> dict[str, dict[int, float]]:
    """歷年的折線圖（例如圖 11.16a）：{USRDS 的名稱: {年: 值}}"""
    fig = _chapter()[figure]
    years = [int(y) for y in fig["none"]["xAxis"]]
    return {
        s["name"]: {y: v for y, v in zip(years, s["data"]) if v is not None}
        for s in fig["none"]["values"]["series"]
    }
