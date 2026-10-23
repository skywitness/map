"""財政部 統計資料庫的進出口貿易統計：台灣依 HS 六位碼的出口、進口值，用來對照 BACI 的台灣數字。

https://web02.mof.gov.tw/njswww/WebMain.aspx?sys=100&funid=defjsptgl（財政部網站「進出口統計 → 貿易統計查詢」）
- 跟財政統計（sources/mof.py）同一套查詢系統，表 i8142「貨品別貿易值－HS 分類 6 碼」，一般貿易制度、海關的統計。
- 查詢頁（sys=210&funid=i8142）依序列出所有勾選框，網址用勾選框的順序選項目：fldspc（幣別）、codspc0（出口、進口）、
  codspc1（貨品，約 6,100 項）。格式是「起點,個數,」的連續區段；改用全部寫成 0/1 的 codlst1 網址太長，
  會被防火牆擋下（回「使用者網路連線異常」的網頁）。
- outkind=1：每列一個年份（「113年」），每欄一個「幣別／進出口／貨品」，千美元；「－」是沒有。
- 出口依目的地、進口依原產地（生產國）統計。台灣在 2023 年間改用 HS 2022 版（854140 拆成 854141–854149 等，2023 年新舊代碼都有數字）。
- 關務署的「海關進出口貿易統計資料查詢」（portal.sw.nat.gov.tw/APGA/GA30）要輸入驗證碼，不能用程式查。
"""
from __future__ import annotations

import csv
import hashlib
import re

from common import download

SELECT = "https://web02.mof.gov.tw/njswww/webMain.aspx?sys=210&kind=21&type=1&funid=i8142"
QUERY = (
    "https://web02.mof.gov.tw/njswww/webMain.aspx?sys=220&ym={ym}&ymt={ymt}&kind=21&type=1&funid=i8142"
    "&cycle=4&outmode=12&compmode=00&outkind=1&utf=1&fldspc=0,1,&codspc0=0,2,&codspc1={codes}"
)
ROC_OFFSET = 1911
DIRECTIONS = {"出口": "export", "進口": "import"}


def _checkboxes(page: str, name: str) -> list[str]:
    """查詢頁某一組勾選框的項目名稱，依頁面上的順序（網址的索引）。"""
    names = []
    chunks = page.split("insertTree(lattr,ltree[lparidx[lpar]],")
    for before, after in zip(chunks, chunks[1:]):
        html = re.findall(r'lcheckhtml="(.*?)";', before)
        if html and f"name={name} " in html[-1]:
            names.append(re.match(r'"([^"]*)"', after).group(1).strip())
    return names


def _spans(indices: list[int]) -> str:
    """[3, 4, 5, 9] → '3,3,9,1,'"""
    out, start, prev = [], None, None
    for i in sorted(indices) + [None]:
        if start is not None and (i is None or i != prev + 1):
            out.append(f"{start},{prev - start + 1},")
            start = None
        if i is not None and start is None:
            start = i
        prev = i
    return "".join(out)


def hs6(codes: list[str], first: int, last: int) -> dict[str, dict[str, dict[int, float]]]:
    """{'export' | 'import': {HS 六位碼: {西元年: 美元}}}。查詢頁沒有的代碼（例如舊版才有的）直接略過。"""
    with open(download(SELECT, "mof_trade", "i8142_select.html"), encoding="utf-8", errors="replace") as f:
        page = f.read()
    goods = _checkboxes(page, "codchk1")
    if len(goods) < 5000:
        raise RuntimeError(f"財政部 i8142 的查詢頁只找到 {len(goods)} 個貨品，頁面格式可能變了")
    index = {code: i for i, code in enumerate(goods) if code in codes}
    key = hashlib.sha1(",".join(sorted(index)).encode()).hexdigest()[:8]
    url = QUERY.format(ym=(first - ROC_OFFSET) * 100, ymt=(last - ROC_OFFSET) * 100, codes=_spans(list(index.values())))
    path = download(url, "mof_trade", f"i8142_{first}_{last}_{key}.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.reader(f) if r]
    if not rows or not rows[0][0] == "幣別":
        raise RuntimeError(f"財政部 i8142 沒有回傳 CSV，網址格式可能變了：{rows[:1]}")
    out: dict[str, dict[str, dict[int, float]]] = {d: {} for d in DIRECTIONS.values()}
    columns = []
    for header in rows[0][1:]:
        _, direction, code = (part.strip() for part in header.split("/"))
        columns.append((DIRECTIONS[direction], code))
    for row in rows[1:]:
        year = int(re.fullmatch(r"(\d+)年", row[0].strip()).group(1)) + ROC_OFFSET
        for (direction, code), cell in zip(columns, row[1:]):
            try:
                value = float(cell.replace(",", "")) * 1000
            except ValueError:
                continue  # 「－」：沒有
            out[direction].setdefault(code, {})[year] = value
    return out
