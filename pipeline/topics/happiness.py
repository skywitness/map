"""幸福感主題：《世界幸福報告》（World Happiness Report，WHR）的生活評價分數與排名。

資料：WHR 2026 的「Data for Figure 2.1」（https://worldhappiness.report/data-sharing/ ，
https://files.worldhappiness.report/WHR26_Data_Figure_2.1.xlsx），一個檔就有 2011–2025 年：
- 生活評價（Cantril 階梯，0–10 分）：蓋洛普世界民調（Gallup World Poll）每國每年約 1,000 人，
  回答「把最好的生活想成 10 分、最壞的是 0 分，你現在在第幾階」；WHR 的排名用近三年的平均。
  檔案的「Year」是三年的最後一年，例如 2025 = 2023–2025 年的調查（WHR 2026 公布），這裡照用。
- 排名（WHR 公布的名次）、95% 信賴區間、六個解釋因素（人均 GDP、社會支持、健康平均壽命、人生選擇的自由、
  慷慨、貪腐觀感）各自「解釋」了多少分，加上反烏托邦基準與殘差（2019 年起才有）。
- 排名表、側欄的名次由數值算（同值同名次）。WHR 用沒有四捨五入的數值排名，檔案只給到小數 3 位，
  同分的少數國家（約 2,200 筆裡 40 筆）會跟 WHR 公布的名次差 1，所以側欄另外列出 WHR 公布的名次（rank.json）。

國家名稱：台灣是「Taiwan Province of China」、香港「Hong Kong SAR of China」，對照到 TWN、HKG；
北賽普勒斯、索馬利蘭在 WHR 的排名裡，地圖上也有形狀（_CYN、_SOL），一起收，名次總數才跟 WHR 一樣。
Swaziland 與 Eswatini 是同一國的新舊名稱（2021 年起改名）。

授權：WHR 沒有用 CC 之類的授權條款。報告寫明「This publication may be reproduced using the following reference」
（附引用格式），資料分享頁寫「The data we present in Figure 2.1 are available to download for free」，
沒有限制轉載；Our World in Data 也依這個「Data sharing policy」轉載。這裡照報告要求的格式引用，
只用公開的 Figure 2.1 資料，沒有用要訂閱的蓋洛普原始資料。見 DESIGN.md 第 8 節。
"""
from __future__ import annotations

import openpyxl

from common import OUT_DIR, download, indicator_file, now_iso, to_series, write_json
from sources.countries import from_name

URL = "https://files.worldhappiness.report/WHR26_Data_Figure_2.1.xlsx"
OUT = OUT_DIR / "topics" / "happiness"

NAMES = {
    "Taiwan Province of China": "TWN",
    "Hong Kong SAR of China": "HKG",
    "Lao PDR": "LAO",
    "Côte d’Ivoire": "CIV",
    "North Cyprus": "_CYN",
    "Somaliland Region": "_SOL",
    "Swaziland": "SWZ",
}

HEADER = (
    "Year", "Rank", "Country name", "Life evaluation (3-year average)", "Lower whisker", "Upper whisker",
    "Explained by: Log GDP per capita", "Explained by: Social support", "Explained by: Healthy life expectancy",
    "Explained by: Freedom to make life choices", "Explained by: Generosity", "Explained by: Perceptions of corruption",
    "Dystopia + residual",
)
# 側欄的分數組成：輸出檔名 → 欄位位置（跟前端 HappinessPanel 的順序一致）
FACTORS = {
    "gdp": 6, "social-support": 7, "healthy-life": 8, "freedom": 9, "generosity": 10, "corruption": 11, "dystopia": 12,
}


def build() -> None:
    path = download(URL, "whr", "WHR26_Data_Figure_2.1.xlsx")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = wb.worksheets[0].iter_rows(values_only=True)
    header = next(rows)
    if tuple(header[: len(HEADER)]) != HEADER:
        raise RuntimeError(f"WHR Figure 2.1 的欄位變了：{header}")

    score: dict[str, dict[int, float]] = {}
    rank: dict[str, dict[int, float]] = {}
    low: dict[str, dict[int, float]] = {}
    high: dict[str, dict[int, float]] = {}
    factors: dict[str, dict[str, dict[int, float]]] = {k: {} for k in FACTORS}
    for row in rows:
        if not row or row[0] is None:
            continue
        name = str(row[2]).strip()
        iso3 = NAMES.get(name) or from_name(name)
        if not iso3:
            raise RuntimeError(f"WHR 的國名對不到代碼：{name}")
        year = int(row[0])
        if year in score.get(iso3, {}):
            raise RuntimeError(f"WHR {year} 年的 {iso3} 出現兩次")
        score.setdefault(iso3, {})[year] = round(float(row[3]), 3)
        rank.setdefault(iso3, {})[year] = int(row[1])
        if row[4] is not None:
            low.setdefault(iso3, {})[year] = round(float(row[4]), 3)
            high.setdefault(iso3, {})[year] = round(float(row[5]), 3)
        for key, col in FACTORS.items():
            if row[col] is not None:
                factors[key].setdefault(iso3, {})[year] = round(float(row[col]), 3)

    years = sorted({y for s in score.values() for y in s})

    def write(name: str, unit: str, series: dict[str, dict[int, float]], digits: int) -> None:
        values = {iso3: to_series(s, years, digits) for iso3, s in series.items()}
        write_json(OUT / name, indicator_file(name.removesuffix(".json").split("/")[-1], unit, years, values), quiet=True)

    write("life-evaluation.json", "分", score, 3)
    write("rank.json", "名", rank, 0)
    write("ci-low.json", "分", low, 3)
    write("ci-high.json", "分", high, 3)
    for key, series in factors.items():
        write(f"factors/{key}.json", "分", series, 3)
    write_json(
        OUT / "manifest.json",
        {
            "topic": "happiness",
            "generatedAt": now_iso(),
            "source": "World Happiness Report 2026, Data for Figure 2.1",
            "sourceUrl": URL,
            "years": [years[0], years[-1]],
        },
    )

    tw = years[-1]
    counts = {y: sum(1 for s in score.values() if y in s) for y in years}
    print(f"  {years[0]}–{years[-1]}，{len(score)} 國；{tw} 年 {counts[tw]} 國")
    print(f"  台灣 {tw} 年 {score['TWN'][tw]:.3f}，WHR 排名第 {rank['TWN'][tw]} 名")
