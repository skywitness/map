"""IEA Global EV Data Explorer（Global EV Outlook 的資料，CC BY 4.0）：電動車銷售、保有量、公共充電樁。

- 資料頁 https://www.iea.org/data-and-statistics/data-tools/global-ev-data-explorer 標示 Licence: CC BY 4.0
  （2026 年 5 月 20 日更新，Global EV Outlook 2026，歷史資料 2010–2025 年）。
  同一份資料的 .Stat Suite 下載檔（data product 頁面）標示的是 Terms of Use for Non-CC Material，而且要登入，不用。
- www.iea.org 有 Cloudflare 驗證，程式打不開；資料頁背後的 API（api.iea.org/electric-vehicles）可以直接讀，
  回傳 JSON。查詢一定要指定 region 或 year，這裡一年查一次。
- 數值是 IEA 四捨五入到兩位有效數字的（2025 年世界銷售 21,000,000 輛），以 float32 存，讀進來時去掉雜訊。
- 「電動車」= 純電（BEV）＋插電式混合（PHEV，含增程式 EREV），不含燃料電池車（FCEV）。
- 公共充電樁分慢充（≤ 22 kW）、快充（22–150 kW）、超快充（≥ 150 kW）三類，互不重疊；
  合計就是公共充電樁總數（2025 年世界「超過 700 萬」，報告第 6 章）。
"""
from __future__ import annotations

import json
from datetime import date

from common import download

URL = (
    "https://api.iea.org/electric-vehicles?year={year}&category=Historical&mode=Cars%2CEVSE%2CEV"
    "&parameter=EV+sales%2CEV+sales+share%2CEV+stock%2CEV+stock+share%2CEV+charging+points"
    "%2CElectric+LDVs+per+charging+point"
)
FIRST_YEAR = 2010

# IEA 的地區名稱 → ISO alpha-3。新版多了國家時，資料管線會報錯，要在這裡補上
REGIONS = {
    "Argentina": "ARG", "Australia": "AUS", "Austria": "AUT", "Belgium": "BEL", "Brazil": "BRA",
    "Bulgaria": "BGR", "Cambodia": "KHM", "Canada": "CAN", "Chile": "CHL", "China": "CHN",
    "Colombia": "COL", "Costa Rica": "CRI", "Croatia": "HRV", "Cyprus": "CYP", "Czech Republic": "CZE",
    "Denmark": "DNK", "Estonia": "EST", "Finland": "FIN", "France": "FRA", "Germany": "DEU",
    "Greece": "GRC", "Hungary": "HUN", "Iceland": "ISL", "India": "IND", "Indonesia": "IDN",
    "Ireland": "IRL", "Israel": "ISR", "Italy": "ITA", "Japan": "JPN", "Jordan": "JOR",
    "Korea": "KOR", "Lao PDR": "LAO", "Latvia": "LVA", "Lithuania": "LTU", "Luxembourg": "LUX",
    "Malaysia": "MYS", "Mexico": "MEX", "Nepal": "NPL", "Netherlands": "NLD", "New Zealand": "NZL",
    "Norway": "NOR", "Philippines": "PHL", "Poland": "POL", "Portugal": "PRT", "Romania": "ROU",
    "Russia": "RUS", "Seychelles": "SYC", "Singapore": "SGP", "Slovakia": "SVK", "Slovenia": "SVN",
    "South Africa": "ZAF", "Spain": "ESP", "Sweden": "SWE", "Switzerland": "CHE", "Thailand": "THA",
    "Turkiye": "TUR", "Ukraine": "UKR", "United Arab Emirates": "ARE", "United Kingdom": "GBR",
    "Uruguay": "URY", "USA": "USA", "Uzbekistan": "UZB", "Viet Nam": "VNM",
    "World": "WLD",
}
# 區域合計：不當成國家（歐盟、歐洲等）
AGGREGATES = {
    "Advanced Economies", "Africa", "Asia Pacific", "Developing Economies excl. China", "Europe",
    "European Union", "Latin America", "Middle East and Caspian", "Rest of the world", "Southeast Asia",
}

# (parameter, mode, powertrain) → 序列名稱
SERIES = {
    ("EV sales share", "Cars", "EV"): "sales-share",  # %
    ("EV sales", "Cars", "EV"): "sales",
    ("EV sales", "Cars", "BEV"): "sales-bev",
    ("EV sales", "Cars", "PHEV"): "sales-phev",
    ("EV stock", "Cars", "EV"): "stock",
    ("EV stock", "Cars", "BEV"): "stock-bev",
    ("EV stock", "Cars", "PHEV"): "stock-phev",
    ("EV stock share", "Cars", "EV"): "stock-share",  # %
    ("EV charging points", "EVSE", "Publicly available slow"): "chargers-slow",
    ("EV charging points", "EVSE", "Publicly available fast"): "chargers-fast",
    ("EV charging points", "EVSE", "Publicly available ultra-fast"): "chargers-ultrafast",
    # 電動輕型車（小客車＋輕型商用車）÷ 公共充電樁
    ("Electric LDVs per charging point", "EV", "EV"): "ldvs-per-charger",
}


def _clean(value: float) -> float:
    """float32 的雜訊（0.012000000104）→ 0.012；IEA 本身只有兩位有效數字，留三位不會損失。"""
    return float(f"{value:.3g}")


def ev_data() -> dict[str, dict[str, dict[int, float]]]:
    """{序列名稱: {iso3 或 'WLD': {年: 值}}}，序列見 SERIES。"""
    out: dict[str, dict[str, dict[int, float]]] = {name: {} for name in SERIES.values()}
    unknown: set[str] = set()
    # IEA 每年 5 月公布前一年的資料；還沒公布的年份回傳空陣列
    for year in range(FIRST_YEAR, date.today().year):
        path = download(URL.format(year=year), "iea", f"ev-{year}.json")
        with open(path, encoding="utf-8") as f:
            rows = json.load(f)
        for row in rows:
            name = SERIES.get((row["parameter"], row["mode"], row["powertrain"]))
            if name is None or row["value"] is None or row["category"] != "Historical":
                continue
            region = row["region"]
            if region in AGGREGATES:
                continue
            iso3 = REGIONS.get(region)
            if iso3 is None:
                unknown.add(region)
                continue
            out[name].setdefault(iso3, {})[int(row["year"])] = _clean(row["value"])
    if unknown:
        raise RuntimeError(f"IEA 有不認得的地區，請加進 iea_ev.REGIONS 或 AGGREGATES：{sorted(unknown)}")
    return out
