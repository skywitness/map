"""環境部（https://data.moenv.gov.tw，政府資料開放授權條款）：台灣的 PM2.5 年平均、國家溫室氣體排放清冊（ghg_inventory()）、
一般廢棄物與資源回收（municipal_waste()、recycled_plastics()，塑膠污染主題）。

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


# ── 國家溫室氣體排放清冊（氣候主題的台灣對照） ────────────────────────
GHG_INVENTORY = "GHG_P_02"
GHG_INVENTORY_REPORT = "https://www.cca.gov.tw/information-service/publications/national-ghg-inventory-report/34874.html"
# 開放資料的欄位 → 這裡的鍵（千公噸 CO₂ 當量；吸收量是負數）
GHG_FIELDS = {
    "co2_value": "co2",
    "ch4_value": "ch4",
    "n2o_value": "n2o",
    "hfcs_value": "hfc",
    "pfcs_value": "pfc",
    "sf6_value": "sf6",
    "nf3_value": "nf3",
    "total_ghg_emission_value": "total",
    "co2_absorption_value": "lulucf",
    "net_ghg_emission_value": "net",
}


def ghg_inventory() -> dict[int, dict[str, float]]:
    """環境部氣候變遷署「國家溫室氣體排放清冊報告」開放資料（GHG_P_02，政府資料開放授權條款）：
    {年: {co2、ch4、n2o、hfc、pfc、sf6、nf3、total（不含 LULUCF）、lulucf（二氧化碳吸收量，負數）、net: 千公噸 CO₂e}}。

    每年 6、7 月隨新版清冊報告更新，整個序列都換成新版的數字（2026 年 7 月是《2026 年中華民國國家溫室氣體排放清冊報告》，
    1990–2024 年，跟報告的表 ES2.1 逐年核對過一致）；ImportDate 是那一年第一次匯入的日期，不是資料的版本。
    溫室氣體用 IPCC AR5 的 GWP-100（甲烷 28、氧化亞氮 265）。NE（未估計）當成 0。
    """
    view = common.download(VIEW.format(name=GHG_INVENTORY), "moenv", f"{GHG_INVENTORY}.json")
    resources = json.loads(view.read_text(encoding="utf-8"))["payload"]["resources"]
    target = common.CACHE_DIR / "moenv" / GHG_INVENTORY / "records.json"
    if not target.exists() or common.REFRESH:
        print(f"  下載 {SEARCH}（{GHG_INVENTORY}）")
        request = urllib.request.Request(
            SEARCH,
            data=json.dumps({"resource_id": resources[0]["rid"], "limit": 1000, "offset": 0}).encode(),
            headers={"Content-Type": "application/json", "User-Agent": common.USER_AGENT},
        )
        with urllib.request.urlopen(request, timeout=120) as resp:
            payload = json.load(resp)
        if not payload.get("success"):
            raise RuntimeError(f"環境部開放資料平台回傳錯誤：{payload}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(payload["payload"]["records"], ensure_ascii=False), encoding="utf-8")
    out: dict[int, dict[str, float]] = {}
    for row in json.loads(target.read_text(encoding="utf-8")):
        values = {}
        for field, key in GHG_FIELDS.items():
            text = row[field].replace(",", "").strip()
            values[key] = 0.0 if text in ("NE", "NO", "") else float(text)
        out[int(row["year"])] = values
    if not out or min(out) != 1990:
        raise RuntimeError(f"{GHG_INVENTORY} 的年份不對，API 的格式可能變了")
    return dict(sorted(out.items()))


# ── 一般廢棄物與資源回收（塑膠污染主題的台灣） ──────────────────────
# 欄位的意思寫在 dataset.view 的 field_description（2026-10-26 查）
MUNICIPAL_WASTE = "STAT_P_45"  # 一般廢棄物清理情況資料：縣市別、年（民國 100 年起），公噸
COLLECTED_RECYCLABLES = "STAT_P_132"  # 執行機關資源回收量：縣市別、月與年（民國 110 年起），公噸
REGULATED_RECYCLABLES = "STAT_P_133"  # 公告應回收廢物品及容器回收量：全國、月與年（民國 110 年起），公斤
WASTE_FIELDS = {
    "garbagegenerated": "generated",  # 一般廢棄物產生量
    "garbageclearance": "garbage",  # 一般垃圾量（焚化、掩埋）
    "garbagerecycled": "recycled",  # 資源垃圾量（資源回收）
    "foodwastesrecycled": "food",  # 廚餘量（廚餘回收）
}


def _dataset(name: str) -> list[dict]:
    """一個資料集的全部紀錄（只有一個資源的資料集），分頁讀完存成快取。"""
    target = common.CACHE_DIR / "moenv" / name / "records.json"
    if not target.exists() or common.REFRESH:
        view = json.loads(common.download(VIEW.format(name=name), "moenv", f"{name}.json").read_text(encoding="utf-8"))
        resources = view["payload"]["resources"]
        records: list[dict] = []
        while True:
            print(f"  下載 {SEARCH}（{name}，第 {len(records) + 1} 筆起）")
            request = urllib.request.Request(
                SEARCH,
                data=json.dumps({"resource_id": resources[0]["rid"], "limit": 1000, "offset": len(records)}).encode(),
                headers={"Content-Type": "application/json", "User-Agent": common.USER_AGENT},
            )
            with urllib.request.urlopen(request, timeout=120) as resp:
                payload = json.load(resp)
            if not payload.get("success"):
                raise RuntimeError(f"環境部開放資料平台回傳錯誤：{payload}")
            records += payload["payload"]["records"]
            if len(records) >= payload["payload"]["total"] or not payload["payload"]["records"]:
                break
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    return json.loads(target.read_text(encoding="utf-8"))


def _roc_year(text: str) -> int | None:
    """「113年」「113」→ 2024；「113年 5月」（月資料）→ None"""
    match = re.fullmatch(r"\s*(\d{2,3})\s*年?\s*", text)
    return int(match.group(1)) + 1911 if match else None


def municipal_waste() -> dict[int, dict[str, float]]:
    """全國的一般廢棄物（縣市加總，公噸）：{年: {generated, garbage, recycled, food}}，2011 年起。

    一般廢棄物回收率（環境部的定義，STAT_P_46 各縣市的值跟這個算法一致）=（資源垃圾 + 廚餘）÷ 產生量。
    """
    out: dict[int, dict[str, float]] = {}
    for row in _dataset(MUNICIPAL_WASTE):
        year = _roc_year(row["year"])
        if year is None:
            raise RuntimeError(f"{MUNICIPAL_WASTE} 的年份格式不對：{row['year']}")
        sums = out.setdefault(year, dict.fromkeys(WASTE_FIELDS.values(), 0.0))
        for field, key in WASTE_FIELDS.items():
            sums[key] += float(row[field].replace(",", ""))
    if not out or min(out) > 2011:
        raise RuntimeError(f"{MUNICIPAL_WASTE} 的年份不對，API 的格式可能變了")
    for year, v in out.items():
        if abs(v["generated"] - v["garbage"] - v["recycled"] - v["food"]) > 10:
            raise RuntimeError(f"{MUNICIPAL_WASTE} {year} 年的產生量不等於垃圾、資源垃圾、廚餘的合計")
    return dict(sorted(out.items()))


def recycled_plastics() -> dict[int, dict[str, float]]:
    """台灣回收的塑膠（公噸，只有全年的年份）：{年: {plastics: 執行機關回收的塑膠及橡膠製品（縣市加總）,
    containers: 公告應回收的塑膠容器（含回收業、處理業的回收量）, recyclables: 執行機關的資源回收總量}}。"""
    out: dict[int, dict[str, float]] = {}
    for row in _dataset(COLLECTED_RECYCLABLES):
        year = _roc_year(row["item1"])
        if year is None:
            continue  # 月資料
        sums = out.setdefault(year, {"plastics": 0.0, "recyclables": 0.0})
        sums["recyclables"] += float(row["value1"])  # 總計
        sums["plastics"] += float(row["value4"])  # 塑膠及橡膠製品
    for row in _dataset(REGULATED_RECYCLABLES):
        year = _roc_year(row["item1"])
        if year is not None and year in out:
            out[year]["containers"] = float(row["value6"]) / 1000  # 塑膠容器（公斤）
    if not out:
        raise RuntimeError(f"{COLLECTED_RECYCLABLES} 讀不到年資料，API 的格式可能變了")
    return dict(sorted(out.items()))
