"""空氣品質主題的二氧化氮衛星影像（製作手冊第十七批 282，2026-11-03）。

地圖是 NASA GIBS 的 OMI 對流層二氧化氮（Aura，2004-10-01 起每天），在瀏覽器裡直接讀圖磚（map/satelliteDay.ts 的 no2），
使用者決定畫那一年 1 月中旬前兩週的合成（冬天的二氧化氮最明顯）。影像只有圖、沒有數值，國家不上色。
這一步只寫時間軸的年份（no2-years.json，跟帝國與疆界的 polities-years.json 一樣沒有國家的值），
加上台灣的附註：環境部「空氣品質監測月值」（AQX_P_08，data.gov.tw 28202，政府資料開放授權條款第 1 版）
各一般測站 NO₂ 月平均的年平均（ppb，只算 12 個月都有值的測站），最近一個完整的年份。
"""
from __future__ import annotations

import json
import re
import statistics
import urllib.request
from datetime import date

import common
from common import OUT_DIR, indicator_file, write_json
from sources import moenv

OUT = OUT_DIR / "topics" / "air-quality"
FIRST = 2005  # OMI 2004-10-01 起，第一個 1 月中旬是 2005 年
MONTHLY = "AQX_P_08"
CJK = re.compile(r"[一-鿿]")


def _month(rid: str, ym: str) -> list[dict]:
    target = common.CACHE_DIR / "moenv" / MONTHLY / f"{ym}.json"
    if not target.exists() or common.REFRESH:
        req = urllib.request.Request(moenv.SEARCH, data=json.dumps({"resource_id": rid, "limit": 20000, "offset": 0}).encode(),
                                     headers={"Content-Type": "application/json", "User-Agent": common.USER_AGENT})
        with urllib.request.urlopen(req, timeout=120, context=common._ssl_context(moenv.SEARCH)) as resp:
            payload = json.load(resp)["payload"]
        if payload["total"] > len(payload["records"]):
            raise RuntimeError(f"{MONTHLY} {ym} 超過一頁")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(payload["records"], ensure_ascii=False), encoding="utf-8")
    return json.loads(target.read_text(encoding="utf-8"))


def taiwan_no2() -> tuple[int, float, int]:
    """(年, 各測站 NO₂ 年平均的平均 ppb, 測站數)：最近一個 12 個月都有資源的年份"""
    view = common.download(moenv.VIEW.format(name=MONTHLY), "moenv", f"{MONTHLY}.json")
    months: dict[int, dict[int, str]] = {}
    for r in json.loads(view.read_text(encoding="utf-8"))["payload"]["resources"]:
        if m := re.search(r"\((\d{4})/(\d{2})\)", r["name"]):
            months.setdefault(int(m.group(1)), {})[int(m.group(2))] = r["rid"]
    year = max(y for y, ms in months.items() if len(ms) == 12)
    by_site: dict[str, dict[int, float]] = {}
    for mo, rid in months[year].items():
        for x in _month(rid, f"{year}{mo:02d}"):
            if x["itemengname"] != "NO2":
                continue
            try:
                v = float(x["concentration"])
            except ValueError:
                continue
            by_site.setdefault(x["siteid"], {})[mo] = v
    means = [statistics.mean(v.values()) for v in by_site.values() if len(v) == 12]
    return year, statistics.mean(means), len(means)


def build() -> None:
    last = date.today().year if date.today() >= date(date.today().year, 1, 20) else date.today().year - 1
    years = list(range(FIRST, last + 1))
    year, ppb, n = taiwan_no2()
    note = (f"影像沒有數值。環境部空品測站 {year} 年的二氧化氮：{n} 個測站月平均的年平均 {ppb:.1f} ppb"
            f"（約 {ppb * 1.88:.0f} μg/m³；WHO 2021 年指引值是年平均 10 μg/m³）。")
    note_en = (f"The image has no values. Taiwan's Ministry of Environment monitoring stations, {year}: average annual NO₂ "
               f"{ppb:.1f} ppb (about {ppb * 1.88:.0f} μg/m³) across {n} stations; the WHO 2021 guideline is 10 μg/m³.")
    write_json(OUT / "no2-years.json", indicator_file("no2", "", years, {}, notes={"TWN": note}, notesEn={"TWN": note_en}))
    print(f"  二氧化氮衛星影像 {years[0]}–{years[-1]}；台灣 {year} 年 {n} 站平均 {ppb:.2f} ppb")


if __name__ == "__main__":
    build()
