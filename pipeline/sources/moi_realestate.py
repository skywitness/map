"""內政部不動產資訊平台（https://pip.moi.gov.tw，政府資料開放授權條款）：台灣的住宅類型、房價與房價負擔能力。

住宅類型（dwellings_by_floors）：
- 「統計資訊主題項目下載區」的「房屋稅籍住宅類數量依總樓層區分」（CSV，UTF-8 含 BOM），
  每季一筆，98 年第 1 季（2009）起，全國、縣市、鄉鎮市區都有。
- 欄位：資料期別（「114Q4」）、縣市/地區、總數、1~3 層、4~5 層、6~10 層、11~15 層、16 層以上（單位：宅，有千分位逗號）。
- 這是房屋稅籍的住宅（含空屋），依「整棟建築的總樓層數」分，不是依透天、公寓分。
  台灣官方統計（人口及住宅普查、家庭收支調查）也都只按樓層分類，見 DESIGN.md 第 8 節。

房價（price_indicator）：「價格指標」頁面（E2010）的查詢 API `E2010Data`（GET，回傳 JSON 的 resultTable：
第一列是欄名「年度季別、全國、新北市…」，之後每季一列、由新到舊，數值是字串）。
- group03 房價所得比（倍）、group04 貸款負擔率（%）：內政部地政司，91 年第 1 季（2002）起，全國（不含金門、連江）與 20 縣市。
  中位數住宅價格 ÷ 中位數家戶年可支配所得；101 年第 2 季以前的房價是聯合徵信中心的擔保品估價，
  101 年第 3 季起是實價登錄的成交價，兩段不能直接接起來。
- group11 住宅價格指數：內政部地政司（原營建署），105 年 = 100，101 年第 3 季（2012）起，全國與六都，
  實價登錄屋齡 0.5–60 年的住宅（特徵價格法）。
- 同一頁的國泰房地產指數、房價趨勢分數是民間的指數（國泰建設、政治大學），不是開放授權，沒有用。
- 地區參數：group03、group04 是「代碼|名稱」（TAIWAN|全國、A|台北市…），group11 只有名稱（臺北市…）；
  欄名的「台」與「臺」也不一致，一律換成「臺」。
"""
from __future__ import annotations

import csv
import json
import urllib.parse
from datetime import date

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


PRICE_URL = "https://pip.moi.gov.tw/Publicize/Info/E2010Data?"
# 房價所得比、貸款負擔率的地區（代碼|名稱），順序是平台上的順序：全國、六都、其他縣市
AFFORDABILITY_AREAS = [
    "TAIWAN|全國", "F|新北市", "A|台北市", "H|桃園市", "B|台中市", "D|台南市", "E|高雄市", "G|宜蘭縣", "J|新竹縣",
    "K|苗栗縣", "N|彰化縣", "M|南投縣", "P|雲林縣", "Q|嘉義縣", "T|屏東縣", "V|台東縣", "U|花蓮縣", "X|澎湖縣",
    "C|基隆市", "O|新竹市", "I|嘉義市",
]
INDEX_AREAS = ["全國", "新北市", "臺北市", "桃園市", "臺中市", "臺南市", "高雄市"]
PRICE_GROUPS = {
    "price-income": ("group03", AFFORDABILITY_AREAS),
    "burden": ("group04", AFFORDABILITY_AREAS),
    "hpi": ("group11", INDEX_AREAS),
}


def price_indicator(key: str) -> dict[str, dict[str, float]]:
    """價格指標的季資料：{地區名稱（臺）: {"2026Q1": 值, …}}。key 是 price-income、burden 或 hpi。"""
    group, areas = PRICE_GROUPS[key]
    last_roc = date.today().year - ROC_OFFSET
    query = urllib.parse.urlencode(
        {"dataGroup": group, "f01": "089Q1", "f02": f"{last_roc:03d}Q4", "f03": ",".join(areas) + ","}
    )
    path = download(PRICE_URL + query, "moi-realestate", f"price-{group}.json")
    with open(path, encoding="utf-8") as f:
        table = json.load(f).get("resultTable") or []
    if len(table) < 2 or table[0][0] != "年度季別" or len(table[0]) != len(areas) + 1:
        raise RuntimeError(f"內政部價格指標 {group} 的格式變了：{table[:2]}")
    names = [name.replace("台", "臺") for name in table[0][1:]]
    out: dict[str, dict[str, float]] = {name: {} for name in names}
    for row in table[1:]:
        roc, quarter = row[0].split("Q")
        period = f"{int(roc) + ROC_OFFSET}Q{quarter}"
        for name, cell in zip(names, row[1:]):
            if cell not in ("", "-", None):
                out[name][period] = float(cell.replace(",", ""))
    return out
