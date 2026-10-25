"""內政部戶政司的婚姻統計（政府資料開放授權條款第 1 版；內政部「政府網站資料開放宣告」）：台灣的結婚、離婚、初婚年齡、
婚姻狀況與非婚生子女。

- 戶政司全球資訊網「人口統計資料」的歷年統計表（https://www.ris.gov.tw/app/portal/346 → 「二. 各年人口資料」）：
  - 結婚對數及粗結婚率（按登記，民國 36 年起；108 年起分不同性別、相同性別）
  - 離婚/終止結婚對數及粗離婚率（按登記，36 年起）
  - 結婚年齡中位數及平均數（按發生，64 年起；含初婚、再婚的男女平均年齡）
  - 15 歲以上人口數按性別、婚姻狀況及婚姻類型分（63 年起，每年年底）
  - 出生數按婚生、非婚生及無依兒童（按登記，65 年起）
  下載是對 /info-popudata/app/awFastDownload/view 送表單（type=ods、m4c=表的代碼），要先打開首頁拿 cookie 與
  CSRF token（網頁的 <meta name="_csrf">），否則回 403。檔案只有一個版本，每年更新，不帶年份。
- 30–34 歲的未婚比例用內政部統計查詢網的「15 歲以上婚姻狀況─按區域別、年齡別分」（c0110301，85 年起）。
- 民國 62 年（含）以前不含金門、連江；出生 79 年以前也不含。這裡都只用 1975 年以後。
"""
from __future__ import annotations

import csv
import http.cookiejar
import re
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

import common
from sources.moe import _sheet_rows

BASE = "https://www.ris.gov.tw/info-popudata/app/awFastDownload/"
TABLES = {
    "marriages": "y4s1",  # 結婚對數及粗結婚率（按登記日期）
    "divorces": "y5s1",  # 離婚/終止結婚對數及粗離婚率（按登記日期）
    "age": "y4s5",  # 結婚年齡中位數及平均數（按發生日期）
    "status": "y1sb",  # 15 歲以上人口數按性別、婚姻狀況及婚姻類型分
    "births": "y2s2",  # 出生數按婚生、非婚生及無依兒童（按登記日期及按發生日期）
}
BY_AGE_URL = (
    "https://statis.moi.gov.tw/micst/webMain.aspx?sys=220&kind=21&type=1&funid=c0110301&cycle=4&outmode=12&utf=1"
    "&compmode=0&outkind=3&fldlst=111111111111111&codspc0=0,1,&codspc1=0,19,&ym=8500&ymt={ymt}"
)
FIRST_YEAR = 1975


def _download(table: str) -> Path:
    """戶政司的歷年統計表（ods），已下載就用快取。"""
    code = TABLES[table]
    target = common.CACHE_DIR / "ris-popudata" / f"{code}.ods"
    if target.exists() and not common.REFRESH:
        return target
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.addheaders = [("User-Agent", common.USER_AGENT)]
    page = opener.open(BASE + "toMain_panel").read().decode("utf-8")
    token = re.search(r'<meta name="_csrf" content="([^"]+)"', page)
    if not token:
        raise RuntimeError("戶政司人口統計資料的網頁沒有 CSRF token，格式可能變了")
    data = urllib.parse.urlencode({"type": "ods", "m4c": code, "d5c": "", "_csrf": token.group(1)}).encode()
    request = urllib.request.Request(BASE + "view", data=data, headers={
        "X-CSRF-TOKEN": token.group(1), "Referer": BASE + "toMain_panel",
        "Content-Type": "application/x-www-form-urlencoded",
    })
    print(f"  下載 戶政司人口統計資料 {code}")
    with opener.open(request) as resp:
        body = resp.read()
    if not body.startswith(b"PK"):
        raise RuntimeError(f"戶政司 {code} 下載到的不是 ods 檔")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    return target


def _year_rows(table: str) -> dict[int, list]:
    """第二欄是西元年的列：{西元年: 該列}。第一欄有儲存格註解的（「user62年以前資料係參考…民國62年」），
    註解的文字會接在前面，所以只找「民國…年」。"""
    out = {}
    for row in _sheet_rows(_download(table)):
        if len(row) > 2 and isinstance(row[0], str) and re.search(r"民國\d+年$", row[0]) and isinstance(row[1], float):
            if (year := int(row[1])) >= FIRST_YEAR:
                out[year] = row
    if len(out) < 40:
        raise RuntimeError(f"戶政司 {TABLES[table]} 只有 {len(out)} 年的資料，格式可能變了")
    return out


def _num(cell: object) -> float | None:
    return cell if isinstance(cell, float) else None


def marriages_divorces() -> dict[str, dict[int, dict[str, float]]]:
    """{'marriages'/'divorces': {年: {'total': 對數, 'same_sex': 相同性別對數（2019 年起）, 'rate': 每千人}}}"""
    out: dict[str, dict[int, dict[str, float]]] = {}
    for kind in ("marriages", "divorces"):
        # 欄位：民國年、西元年、總計、不同性別、相同性別（計、男、女）、粗結婚率（粗離婚率）
        out[kind] = {}
        for year, row in _year_rows(kind).items():
            total, same, rate = _num(row[2]), _num(row[4]), _num(row[7])
            if total is None or rate is None:
                continue
            out[kind][year] = {"total": total, "rate": rate}
            if same is not None and year >= 2019:
                out[kind][year]["same_sex"] = same
    return out


def first_marriage_age() -> dict[str, dict[int, float]]:
    """初婚者的平均年齡（按發生日期）：{'male'/'female': {年: 歲}}。

    欄位：民國年、西元年、中位數（男、女、初婚男、初婚女、再婚男、再婚女）、平均數（同樣 6 欄）。
    """
    out: dict[str, dict[int, float]] = {"male": {}, "female": {}}
    for year, row in _year_rows("age").items():
        if (male := _num(row[10])) is not None and (female := _num(row[11])) is not None:
            out["male"][year], out["female"][year] = male, female
    return out


def married_share() -> dict[int, float]:
    """15 歲以上人口的有偶比例（%，每年年底，含相同性別的配偶）。

    每年三列：「計」在最前面（年份寫在下一列「男」那一列），欄位是總計、未婚、有偶（合計、不同性別、相同性別）、
    離婚、喪偶。
    """
    out: dict[int, float] = {}
    pending = None
    for row in _sheet_rows(_download("status")):
        if len(row) < 6:
            continue
        if row[2] == "計":
            pending = row
        elif row[2] == "男" and isinstance(row[1], float) and pending is not None:
            total, married = _num(pending[3]), _num(pending[5])
            if total and married is not None and int(row[1]) >= FIRST_YEAR:
                out[int(row[1])] = married / total * 100
            pending = None
    if len(out) < 40:
        raise RuntimeError(f"戶政司 y1sb 只讀到 {len(out)} 年的婚姻狀況，格式可能變了")
    return out


def births_outside_marriage() -> dict[int, float]:
    """非婚生子女占出生數的比例（%，按登記）。欄位：民國年、西元年、總計、婚生（人數、%）、非婚生（人數、%）、無依兒童。"""
    out = {}
    for year, row in _year_rows("births").items():
        total, outside = _num(row[2]), _num(row[5])
        if total and outside is not None:
            out[year] = outside / total * 100
    return out


def never_married_30_34() -> dict[int, float]:
    """30–34 歲的未婚比例（%，男女合計，每年年底），1996 年起。內政部統計查詢網 c0110301。"""
    ymt = (date.today().year - 1911) * 100
    path = common.download(BY_AGE_URL.format(ymt=ymt), "moi", "marital-status-by-age.csv")
    out: dict[int, float] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.reader(f):
            # 「113年/ 區域別總計/ 30-34歲」，接著是總計、未婚、有偶、離婚、喪偶、男（同樣 5 欄）、女
            parts = [p.strip() for p in row[0].split("/")] if row else []
            if len(parts) == 3 and parts[1] == "區域別總計" and parts[2] == "30-34歲" and parts[0].endswith("年"):
                total, single = float(row[1]), float(row[2])
                out[int(parts[0][:-1]) + 1911] = single / total * 100
    if len(out) < 20:
        raise RuntimeError("內政部統計查詢網的婚姻狀況讀不到資料，查詢網址的格式可能變了")
    return out
