"""台灣陸域保護區占國土的比例（製作手冊第七批 134；DESIGN.md 第 216 點）。

- 分子：林業保育署「臺灣國家保護區系統面積統計表」（https://www.forest.gov.tw/total ）的
  「扣除範圍重複部分後之總面積」的陸域面積（公頃）。頁面原始碼還留著 HTML 註解掉的舊版（95 處），先去掉註解再找。
  只有現況、沒有逐年表（2026-04-13 的版本：97 處，陸域 694,449.05 公頃）。
  林業保育署網站的資料「以無償、非專屬，得再授權之方式提供公眾使用……應註明出處」（https://www.forest.gov.tw/opendata ）。
- 分母：內政部統計查詢網 c0110101「土地面積、戶數與人口數」的區域別總計（平方公里，含金門、連江；政府資料開放授權條款）。
台灣的數字已扣掉重複範圍，但不含其他有效保育措施（OECM）；WDI 是 UNEP-WCMC 用 WDPA 的範圍重新計算的，兩者不完全可比。
"""
from __future__ import annotations

import csv
import re

from common import download

TOTAL_URL = "https://www.forest.gov.tw/total"
LAND_URL = (
    "https://statis.moi.gov.tw/micst/webMain.aspx?sys=220&kind=21&type=1&funid=c0110101&cycle=4&outmode=12&utf=1"
    "&compmode=0&outkind=3&fldspc=0,30,&codspc0=0,2,&ym=11300&ymt=11400"
)


def _protected_land_ha() -> tuple[float, int, str]:
    """（扣掉重複範圍後的陸域面積 公頃, 處數, 頁面的最後修改日期）"""
    page = download(TOTAL_URL, "forest", "total.html").read_text(encoding="utf-8")
    page = re.sub(r"<!--.*?-->", "", page, flags=re.S)
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", page))
    m = re.search(r"總計 (\d+) 扣除範圍重複部分後之總面積：[\d,.]+ 陸域：([\d,.]+)", text)
    if not m:
        raise RuntimeError("林業保育署保護區面積統計表的版面變了：找不到「扣除範圍重複部分後之總面積」的陸域面積")
    updated = re.search(r"最後修改時間：(\d{4}-\d{2}-\d{2})", text)
    if not updated:
        raise RuntimeError("林業保育署保護區面積統計表找不到「最後修改時間」")
    return float(m.group(2).replace(",", "")), int(m.group(1)), updated.group(1)


def _land_km2() -> float:
    """最新一年的全國土地面積（平方公里）"""
    with open(download(LAND_URL, "moi", "land-area.csv"), encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.reader(f) if r and r[0].endswith("/ 區域別總計")]
    return float(rows[-1][1])


def protected_land_share() -> dict:
    """{share: 陸域保護區占國土 %, count: 處數, ha: 陸域面積 公頃, km2: 土地面積 平方公里, updated: 統計表的日期}"""
    ha, count, updated = _protected_land_ha()
    km2 = _land_km2()
    return {"share": ha / 100 / km2 * 100, "count": count, "ha": ha, "km2": km2, "updated": updated}
