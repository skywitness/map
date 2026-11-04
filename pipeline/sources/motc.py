"""交通部統計查詢網（https://statis.motc.gov.tw/motc/）的統計表。

網頁本身用 `Statistics/Display.json?Seq=<表號>` 取資料（JSON，每個時期一列，`date` 是「民國年-月-00」，
年資料的月是 00；數字是有千分位的字串，「-」是 0 或無資料）。

**pipeline 不從網站下載**（2026-11-04 起，DESIGN.md 第 8 節第 368 點）：網站的 robots.txt 是 `User-agent: *` /
`Disallow: /`，防火牆也會擋程式的 User-Agent；以前這裡偽裝成瀏覽器的 User-Agent 下載，違反使用者的規則，拿掉了。
改由使用者用瀏覽器打開上面的 JSON 網址存檔，本機 session 放在 skywitness/map-plan 的 `data/motc/display-<表號>.json`
（README 寫網址與下載日期）；重跑前複製到 `pipeline/.cache/motc/`。資料會逐月更新，所以不鎖 SHA-256，只檢查是 JSON、
有這裡要的欄位。

交通部的開放資料（data.gov.tw）採政府資料開放授權條款第 1 版；交通部網站適用交通部的「政府網站資料開放宣告」
（無償、非專屬、註明出處即可利用），統計查詢網是交通部網站的一部分。

用到的表：
- 127「道路交通事故(30日內)─按駕乘車種分」：30 日內死亡人數，依死者的駕乘車種（機車、行人、自行車、乘客…），2008 年起。
- 100「機動車輛登記數─按縣市別分(101年8月以前)」、101「機動車輛登記數─按車齡分(101年9月起)」：年底登記的機動車輛數。
"""
from __future__ import annotations

import json

import common

DISPLAY_URL = "https://statis.motc.gov.tw/motc/Statistics/Display.json?Seq={seq}"
PAGE_URL = "https://statis.motc.gov.tw/motc/Statistics/Display?Seq={seq}"

DEATHS_BY_USER = 127
VEHICLES_TO_2012 = 100
VEHICLES_FROM_2012 = 101


def _load(seq: int) -> dict:
    target = common.CACHE_DIR / "motc" / f"display-{seq}.json"
    if not target.exists():
        raise RuntimeError(
            f"沒有 {target}：交通部統計查詢網不准程式抓（robots.txt 是 Disallow: /），請把 map-plan 的 "
            f"data/motc/display-{seq}.json（用瀏覽器存的 {DISPLAY_URL.format(seq=seq)}）複製到這裡")
    try:
        data = json.loads(target.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        raise RuntimeError(f"{target} 不是 JSON（可能存成了驗證頁或網頁），請重新用瀏覽器存 JSON 網址") from e
    if not all(k in data for k in ("nameMapping", "columns", "data")):
        raise RuntimeError(f"{target} 沒有 nameMapping、columns、data，格式可能改了")
    return data


def _num(s: str | None) -> float | None:
    if s is None:
        return None
    s = s.replace(",", "").strip()
    if s in ("", "-"):
        return None
    return float(s)


def annual(seq: int, column_name: str, code_name: str | None = None) -> dict[int, float]:
    """某張表的年資料：{西元年: 值}。column_name 是欄名（例如「死亡人數(人)」或「總計」），
    code_name 是分類（例如「機車」「行人」，表裡的代碼表）；沒有分類的表 code_name 是 None。
    今年（還沒過完的年份）的「年資料」其實是到最近一個月的累計或月底值，呼叫的人自己決定要不要用。"""
    data = _load(seq)
    names = data["nameMapping"]
    columns = {v: k for k, v in names["columnNameMappings"].items()}
    if column_name not in columns:
        raise RuntimeError(f"交通部統計表 {seq} 沒有欄位「{column_name}」：{list(columns)}")
    col = columns[column_name]
    key_prefix = f"Column_{col}_"
    if code_name is not None:
        codes = {}
        for code_list, mapping in names["codeListMappings"].items():
            for code, name in mapping["nameMappings"].items():
                codes[name] = f"{code_list}.{code}"
        if code_name not in codes:
            raise RuntimeError(f"交通部統計表 {seq} 沒有分類「{code_name}」")
        key = key_prefix + codes[code_name]
    else:
        keys = [k["key"] for k in data["columns"] if k["key"].startswith(key_prefix)]
        key = keys[0]
    out: dict[int, float] = {}
    for row in data["data"]:
        roc, month, _ = row["date"].split("-")
        if month != "00":
            continue
        v = _num(row.get(key))
        if v is not None:
            out[int(roc) + 1911] = v
    return out


def table_url(seq: int) -> str:
    return PAGE_URL.format(seq=seq)
