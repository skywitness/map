"""台灣官方的行動上網速率定點量測：網路速度主題的台灣對照（只在附註與側欄，地圖上的值一律是 Ookla）。

- NCC（國家通訊傳播委員會）委託財團法人電信技術中心（TTC）的 4G 定點量測：專業人員在村里辦公室外、郵局、派出所、
  車站等地點用測試手機量各家業者。只有新聞稿的全國平均（數字是事實，照新聞稿抄，NCC 網站有 Cloudflare，
  程式讀不到，2026-10-27 從 Wayback Machine 的存檔讀）：
  110 年（2021）「4G全國平均下載與上傳速率分別為122.53Mbps與24.92Mbps」（7,851 個量測點，第 50 分位 118.58、24.89），
  同一篇寫「較前期109年度量測結果119Mbps提升2.96%」（109 年只有下載）。
  https://www.ncc.gov.tw/chinese/news_detail.aspx?site_content_sn=8&sn_f=47460 （111/04/27 發布）
- 數位發展部 2022 年起接手，只量 5G：政府資料開放平臺 161791「行動通訊速率量測」（公眾領域貢獻宣告 CC0），
  111、112 年各業者各縣市的定點量測平均（下載、上傳 Mbps，四家業者 × 22 縣市）。沒有全國平均，
  這裡把 22 縣市簡單平均（沒有依量測點數加權；數位部 113 年度預算書寫的「全國 22 縣市量測平均上網速率為 410Mbps」
  是另一種平均，對不上任何一種簡單平均）。113 年以後沒有再上傳。
"""
from __future__ import annotations

import csv
import io

from common import download

DATASET_URL = "https://data.gov.tw/dataset/161791"
NCC_URL = "https://www.ncc.gov.tw/chinese/news_detail.aspx?site_content_sn=8&sn_f=47460"
# 定點量測各業者各縣市速率結果（111 年、112 年）
MODA_FILES = {
    2022: "https://www-api.moda.gov.tw/OpenData/Files/4461",
    2023: "https://www-api.moda.gov.tw/OpenData/Files/14108",
}
OPERATORS = {"cht": "中華電信", "fet": "遠傳電信", "twm": "台灣大哥大", "tstar": "台灣之星"}
COUNTIES = 22

# NCC 新聞稿的全國平均（Mbps）：年 → (下載, 上傳)
NCC_4G = {2020: (119.0, None), 2021: (122.53, 24.92)}


def moda_5g() -> dict[int, list[tuple[str, float, float]]]:
    """{年: [(業者代碼, 22 縣市平均下載, 平均上傳), …]}（中華、遠傳、台灣大、台灣之星的順序）"""
    out: dict[int, list[tuple[str, float, float]]] = {}
    for year, url in MODA_FILES.items():
        path = download(url, "moda-speed", f"{year}.csv")
        text = path.read_text(encoding="utf-8-sig")
        rows = list(csv.DictReader(io.StringIO(text)))
        if len(rows) != COUNTIES:
            raise ValueError(f"數位發展部 {year} 年的量測應有 {COUNTIES} 個縣市，讀到 {len(rows)} 個")
        ops = []
        for code, name in OPERATORS.items():
            down = [float(r[f"{name}下載速率(Mbps)"]) for r in rows]
            up = [float(r[f"{name}上傳速率(Mbps)"]) for r in rows]
            ops.append((code, sum(down) / len(down), sum(up) / len(up)))
        out[year] = ops
    return out


def official() -> list[dict[str, object]]:
    """側欄用的列表，依年份"""
    rows: list[dict[str, object]] = [
        {"year": y, "agency": "ncc", "tech": "4G", "down": d, "up": u} for y, (d, u) in sorted(NCC_4G.items())
    ]
    for year, ops in sorted(moda_5g().items()):
        rows.append(
            {"year": year, "agency": "moda", "tech": "5G", "operators": [[c, round(d, 1), round(u, 1)] for c, d, u in ops]}
        )
    return rows
