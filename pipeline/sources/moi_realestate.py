"""內政部不動產資訊平台（https://pip.moi.gov.tw，政府資料開放授權條款）：台灣的住宅類型。

- 「統計資訊主題項目下載區」的「房屋稅籍住宅類數量依總樓層區分」（CSV，UTF-8 含 BOM），
  每季一筆，98 年第 1 季（2009）起，全國、縣市、鄉鎮市區都有。
- 欄位：資料期別（「114Q4」）、縣市/地區、總數、1~3 層、4~5 層、6~10 層、11~15 層、16 層以上（單位：宅，有千分位逗號）。
- 這是房屋稅籍的住宅（含空屋），依「整棟建築的總樓層數」分，不是依透天、公寓分。
  台灣官方統計（人口及住宅普查、家庭收支調查）也都只按樓層分類，見 DESIGN.md 第 8 節。
"""
from __future__ import annotations

import csv

from common import download

URL = "https://pip.moi.gov.tw/Publicize/Info/E4041?m=csv&k=K02&n=T16"
COLUMNS = {  # CSV 欄名 → 這裡用的鍵
    "1~3層(宅)": "1-3",
    "4~5層(宅)": "4-5",
    "6~10層(宅)": "6-10",
    "11~15層(宅)": "11-15",
    "16層以上(宅)": "16+",
}
TOTAL = "房屋稅籍住宅類數量(宅)"
ROC_OFFSET = 1911


def dwellings_by_floors() -> dict[int, dict[str, float]]:
    """全國每年第 4 季的住宅數，依建築總樓層分：{西元年: {"1-3": 宅數, …, "total": 宅數}}。"""
    path = download(URL, "moi-realestate", "dwellings-by-floors.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows or TOTAL not in rows[0] or any(c not in rows[0] for c in COLUMNS):
        raise RuntimeError(f"住宅數依總樓層的 CSV 欄位變了：{list(rows[0]) if rows else '空檔'}")
    out: dict[int, dict[str, float]] = {}
    for row in rows:
        period = row["資料期別"]
        if row["縣市/地區"] != "全國" or not period.endswith("Q4"):
            continue
        counts = {key: float(row[column].replace(",", "")) for column, key in COLUMNS.items()}
        counts["total"] = float(row[TOTAL].replace(",", ""))
        if abs(sum(v for k, v in counts.items() if k != "total") - counts["total"]) > 1:
            raise RuntimeError(f"{period} 各樓層加起來不等於總數")
        out[int(period[:3]) + ROC_OFFSET] = counts
    return out
