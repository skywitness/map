"""環境部（https://data.moenv.gov.tw，政府資料開放授權條款）：台灣的 PM2.5 年平均。

- 資料集「全國細懸浮微粒手動監測資料」（AQX_P_10）：各手動監測站每 3 天一次的 24 小時採樣，
  2012 年 12 月起，每個月一個資源（resource）。環境部公布的全國 PM2.5 年平均就是用手動監測（標準方法）。
- 開放資料平台文件上的 API（/api/v2/aqx_p_10）要帶 api_key，這裡改用平台網頁本身預覽資料用的 API（不用金鑰）：
  dataset.view.withLanguage 列出各月的資源代碼，datastore.search 讀一個月的資料。不是公開文件化的 API，格式可能改變。
- 2022 年起部分月份多一份英文站名的重複資料（Banqiao、Keelung…），只收中文站名。
- 2013、2014 年開放資料只有 8 站，2015 年起才是完整的 31 站（30 個一般測站加陽明國家公園測站）。
"""
from __future__ import annotations

import json
import re
import urllib.request

import common

VIEW = "https://data.moenv.gov.tw/api/frontstage/dataset.view.withLanguage?name={name}&language=zh"
SEARCH = "https://data.moenv.gov.tw/api/frontstage/datastore.search"
MANUAL_PM25 = "AQX_P_10"
CJK = re.compile(r"[一-鿿]")


def _records(resource_id: str, cache_name: str) -> list[dict]:
    target = common.CACHE_DIR / "moenv" / MANUAL_PM25 / cache_name
    if not target.exists() or common.REFRESH:
        print(f"  下載 {SEARCH}（{MANUAL_PM25} {cache_name}）")
        request = urllib.request.Request(
            SEARCH,
            data=json.dumps({"resource_id": resource_id, "limit": 10000, "offset": 0}).encode(),
            headers={"Content-Type": "application/json", "User-Agent": common.USER_AGENT},
        )
        with urllib.request.urlopen(request, timeout=120) as resp:
            payload = json.load(resp)
        if not payload.get("success"):
            raise RuntimeError(f"環境部開放資料平台回傳錯誤：{payload}")
        if payload["payload"]["total"] > len(payload["payload"]["records"]):
            raise RuntimeError(f"{MANUAL_PM25} {cache_name} 超過一頁，需要分頁下載")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(payload["payload"]["records"], ensure_ascii=False), encoding="utf-8")
    return json.loads(target.read_text(encoding="utf-8"))


def manual_pm25_samples() -> dict[int, dict[str, list[float]]]:
    """手動監測的每一筆採樣：{西元年: {測站: [μg/m³, …]}}，只含 12 個月都有資源的完整年份。"""
    view = common.download(VIEW.format(name=MANUAL_PM25), "moenv", f"{MANUAL_PM25}.json")
    resources = json.loads(view.read_text(encoding="utf-8"))["payload"]["resources"]
    months: dict[int, list[tuple[int, str]]] = {}
    for resource in resources:
        # 資源名稱「全國細懸浮微粒手動監測資料 (2023/05)」；沒有年月的是最近幾個月的合集，不用
        if match := re.search(r"\((\d{4})/(\d{2})\)", resource["name"]):
            months.setdefault(int(match.group(1)), []).append((int(match.group(2)), resource["rid"]))
    out: dict[int, dict[str, list[float]]] = {}
    for year, items in sorted(months.items()):
        if len({month for month, _ in items}) < 12:
            continue  # 還沒過完的年份（或資料集開始的 2012 年只有 12 月）
        # 每個月的資源快取後不再重抓；剛過完年就跑的話，12 月可能還沒收齊，要用 --refresh 重抓
        for month, rid in items:
            for row in _records(rid, f"{year}{month:02d}.json"):
                if not CJK.search(row["sitename"]):
                    continue
                try:
                    value = float(row["concentration"])
                except ValueError:  # 無效樣本（空白、x 等）
                    continue
                if int(row["monitordate"][:4]) == year:
                    out.setdefault(year, {}).setdefault(row["sitename"], []).append(value)
    if not out:
        raise RuntimeError(f"{MANUAL_PM25} 讀不到資料，API 的格式可能變了")
    return out
