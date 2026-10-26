"""政府治理主題：世界銀行 Worldwide Governance Indicators（WGI）2026 年版的六個面向，1996–2025 年。

資料：World Bank API 的 source 3（sources/wgi.py，跟治安與司法主題的法治分數同一個來源，CC BY 4.0，含台灣）。
六個面向：發聲與課責（VA）、政治穩定（PV）、政府效能（GE）、法規品質（RQ）、法治（RL）、貪腐控制（CC）。

- 地圖：0–100 的治理分數（`.SC`）。2025 年改版後 WGI 只發布兩種結果：估計值（約 −2.5 到 2.5 的標準常態單位）
  與由它線性換算的 0–100 絕對分數（以假想的「每個來源都最好」「每個來源都最差」的國家定錨，越高越好）。
  舊版的百分位排名（PER.RNK）不再發布（World Bank API 裡的 RL.PER.RNK 等移到 WDI Database Archives，是舊方法），
  所以地圖用官方的分數，不自己算百分位；名次寫在側欄。法治的檔跟治安與司法主題的 rule-of-law.json 數值相同。
- 側欄：各國一個檔（countries/<ISO3>.json）放六個面向的 90% 信賴區間（`.SC_LB`、`.SC_UB`）、估計值（`.EST`）、
  估計值的標準誤（`.SE`）與資料來源數（`.SR`）；世界中位數放在各指標檔的 aggregates.MEDIAN
  （當年有資料的經濟體的中位數，每個經濟體一樣重；不叫 WLD，前端的「世界」是合計或平均的意思）。
- 1996、1998、2000 年，2002 年起每年。荷屬安地列斯（已經不存在）不收（sources/wgi.py）。

WGI 網站的整包 Excel（wgidataset_with_sourcedata-2026.xlsx）跟 API 的數值完全一樣（2026-10-26 逐筆比對）；
Excel 裡各資料來源的欄位（「EIU mean」等）有五個是第三方的專有資料，WGI 的 Usage Advisory 不准轉載，這裡只用彙總的指標。
"""
from __future__ import annotations

import statistics

from common import OUT_DIR, compact_indicator, indicator_file, now_iso, to_series, write_json
from sources import wgi

OUT = OUT_DIR / "topics" / "governance"

# 指標 id → (WGI 代碼, 中文, 英文)；順序是 WGI 自己的順序
DIMENSIONS = {
    "voice": ("VA", "發聲與課責", "Voice and accountability"),
    "stability": ("PV", "政治穩定", "Political stability"),
    "effectiveness": ("GE", "政府效能", "Government effectiveness"),
    "regulatory": ("RQ", "法規品質", "Regulatory quality"),
    "rule-of-law": ("RL", "法治", "Rule of law"),
    "corruption": ("CC", "貪腐控制", "Control of corruption"),
}
# 側欄用的序列：(檔裡的鍵, WGI 代碼的後綴, 小數位數)
DETAILS = (("lb", "SC_LB", 1), ("ub", "SC_UB", 1), ("est", "EST", 2), ("se", "SE", 2), ("n", "SR", 0))


def build() -> None:
    scores = {dim: wgi.fetch(f"GOV_WGI_{code}.SC") for dim, (code, _, _) in DIMENSIONS.items()}
    years = sorted({y for series in scores.values() for s in series.values() for y in s})
    for dim, series in scores.items():
        own = sorted({y for s in series.values() for y in s})
        if own != years:
            raise RuntimeError(f"WGI {dim} 的年份跟其他面向不同：{own}")

    for dim, (code, zh, _) in DIMENSIONS.items():
        series = scores[dim]
        values = {iso3: to_series(s, years, 1) for iso3, s in series.items()}
        median = [
            round(statistics.median(vals), 1) if (vals := [s[y] for s in series.values() if y in s]) else None
            for y in years
        ]
        write_json(OUT / f"{dim}.json", indicator_file(dim, "分", years, values, aggregates={"MEDIAN": median}))
        last = years[-1]
        n_last = sum(1 for s in series.values() if last in s)
        print(
            f"  {zh}（{code}）：{years[0]}–{last}，{len(values)} 個經濟體（{last} 年 {n_last} 個）；"
            f"台灣 {series['TWN'][last]:.1f}、世界中位數 {median[-1]}"
        )

    # 側欄的明細：每個經濟體一個檔
    details = {
        (dim, key): wgi.fetch(f"GOV_WGI_{code}.{suffix}")
        for dim, (code, _, _) in DIMENSIONS.items()
        for key, suffix, _ in DETAILS
    }
    economies = sorted({iso3 for series in scores.values() for iso3 in series})
    for iso3 in economies:
        values: dict[str, list[float | None]] = {}
        for dim in DIMENSIONS:
            for key, _, digits in DETAILS:
                s = details[(dim, key)].get(iso3)
                if s:
                    values[f"{dim}.{key}"] = to_series(s, years, digits)
        write_json(
            OUT / "countries" / f"{iso3}.json",
            compact_indicator({"iso3": iso3, "years": years, "values": values}),
            quiet=True,
        )
    print(f"  側欄明細：{len(economies)} 個檔（countries/）")

    write_json(
        OUT / "manifest.json",
        {
            "topic": "governance",
            "generatedAt": now_iso(),
            "sources": [
                "World Bank, Worldwide Governance Indicators, 2026 Update (www.govindicators.org), World Bank API source 3: "
                + ", ".join(f"GOV_WGI_{code}.{{SC,SC_LB,SC_UB,EST,SE,SR}}" for code, _, _ in DIMENSIONS.values()),
                "World Bank (2026). The Worldwide Governance Indicators: Methodology for Measuring Governance Using Perception Data.",
            ],
            "license": "CC BY 4.0 (https://datacatalog.worldbank.org/search/dataset/0038026)",
            "indicators": {dim: {"code": code, "zh": zh, "en": en} for dim, (code, zh, en) in DIMENSIONS.items()},
        },
    )
