"""經濟部能源署的能源供給與化石燃料進口來源（政府資料開放授權條款第 1 版），石油、天然氣與煤主題的台灣對照用。

| 資料集 | data.gov.tw | set_id | 單位 |
|---|---|---|---|
| 能源供給年資料（能源統計年報的能源供給表：總供給、自產、進口） | 8309 | 14 | 千公噸油當量 |
| 原油進口來源年資料 | 163714 | 242 | 千桶 |
| 液化天然氣進口來源年資料 | 163715 | 243 | 千公噸 |
| 煤炭進口來源年資料 | 163716 | 244 | 千公噸 |
| 能源指標年資料（初級能源密集度、進口能源依存度等 35 欄；2026-10-31 加，第十批 163 的台灣附註） | 8308 | 13 | 各欄不同 |

- 都是 2005 年起的年資料（2026-09-23 更新到 2025 年）。進口來源只有幾個主要來源國的欄位，其餘併進「其他」
  （原油 2005 年的「其他」占 27.6%，2024 年 0.4%）。
- 能源署的網站在 cloud 下載會拿到 Cloudflare 的驗證頁（HTTP 403）。2026-10-28 由本機 session 以一般的 HTTP GET
  （User-Agent 同 common.USER_AGENT）代為下載，放進 skywitness/map-plan 的 data/moeaea/（檔案沒有改過）；
  在 cloud 重跑時把那幾個檔複製到 pipeline/.cache/moeaea/，download() 就直接用快取。不要繞過驗證頁。
"""
from __future__ import annotations

import csv
import io

from common import download

BASE = "https://www.moeaea.gov.tw/ECW/populace/opendata/wHandOpenData_File.ashx?set_id="
FILES = {
    "supply": (14, "energy-supply-annual.csv", "https://data.gov.tw/dataset/8309"),
    "oil": (242, "crude-oil-import-sources-annual.csv", "https://data.gov.tw/dataset/163714"),
    "lng": (243, "lng-import-sources-annual.csv", "https://data.gov.tw/dataset/163715"),
    "coal": (244, "coal-import-sources-annual.csv", "https://data.gov.tw/dataset/163716"),
    "indicators": (13, "energy-indicators-annual.csv", "https://data.gov.tw/dataset/8308"),
}
# 進口來源的國名 → ISO alpha-3（「其他」是 None）
COUNTRIES = {
    "沙烏地阿拉伯": "SAU", "科威特": "KWT", "美國": "USA", "阿聯大公國": "ARE", "伊拉克": "IRQ", "安哥拉": "AGO",
    "阿曼": "OMN", "查德": "TCD", "卡達": "QAT", "奈及利亞": "NGA", "澳大利亞": "AUS", "俄羅斯": "RUS",
    "巴布亞紐幾內亞": "PNG", "印尼": "IDN", "馬來西亞": "MYS", "汶萊": "BRN", "加拿大": "CAN", "南非": "ZAF",
    "哥倫比亞": "COL", "中國大陸": "CHN", "其他": None,
}


def _rows(key: str) -> list[dict[str, str]]:
    set_id, filename, _ = FILES[key]
    path = download(f"{BASE}{set_id}", "moeaea", filename)
    text = path.read_bytes().decode("utf-8-sig")
    rows = [{k.replace("(統計數值)", "").strip(): v for k, v in r.items()} for r in csv.DictReader(io.StringIO(text))]
    return [r for r in rows if r.get("西元年", "").strip().isdigit()]


def _number(text: str | None) -> float:
    try:
        return float((text or "").replace(",", "").strip())
    except ValueError:
        return 0.0


def supply() -> dict[int, dict[str, float]]:
    """能源供給表：{年: {欄位: 千公噸油當量}}，欄位名稱去掉「(統計數值)」，例如「自產能源_原油」「進口能源_液化天然氣」。"""
    return {int(r["西元年"]): {k: _number(v) for k, v in r.items() if k not in ("西元年", "單位")} for r in _rows("supply")}


def indicators() -> dict[int, dict[str, float]]:
    """能源指標年資料：{年: {欄位: 值}}，欄位名稱去掉「(數值)」，例如「初級能源密集度(公升油當量/千元)」「進口能源依存度(%)」。"""
    return {int(r["西元年"]): {k.replace("(數值)", "").strip(): _number(v) for k, v in r.items() if k != "西元年"}
            for r in _rows("indicators")}


def import_sources(fuel: str) -> dict[int, dict[str | None, float]]:
    """進口來源：fuel 是 'oil'（千桶）、'lng'、'coal'（千公噸）；回傳 {年: {ISO3 或 None（其他）: 進口量}}，
    另外 'total' 是合計。煤炭只取全部煤種的國家欄（「煤炭_澳大利亞」），不取各煤種的細項。"""
    out: dict[int, dict[str | None, float]] = {}
    for r in _rows(fuel):
        year = int(r["西元年"])
        by: dict[str | None, float] = {}
        for k, v in r.items():
            if k in ("西元年", "單位"):
                continue
            if "合計" in k or "總計" in k:
                if k in ("原油進口量合計", "液化天然氣進口量合計", "煤炭進口量_總計"):
                    by["total"] = _number(v)  # type: ignore[index]
                continue
            name = k.removeprefix("煤炭_") if fuel == "coal" else k
            if fuel == "coal" and "_" in name:
                continue  # 各煤種的細項
            if name not in COUNTRIES:
                raise ValueError(f"能源署 {FILES[fuel][1]} 有沒見過的國家欄：{k}")
            by[COUNTRIES[name]] = by.get(COUNTRIES[name], 0.0) + _number(v)
        if "total" not in by:
            raise ValueError(f"能源署 {FILES[fuel][1]} {year} 年沒有合計欄")
        out[year] = by
    return out
