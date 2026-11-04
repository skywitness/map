"""OSM 覆蓋度名單（製作手冊第二十一批：342、363、364、367、368、369、370 共用；2026-11-04 第一個做的 342 訂的）。

OSM 的店家密度同時在量「OSM 畫得多完整」：每十萬人的餐廳，印度、奈及利亞只有個位數，不是現實。所以 OSM 的密度圖
只替覆蓋良好的國家上色，其他國家寫「OSM 在這裡畫得不完整」不畫。

判準（跟要畫的東西無關的外部對照，不是拿 OSM 自己的密度判斷）：
  OSM 上的餐飲店（amenity = restaurant、fast_food、cafe、bar、pub）÷ 住宿及餐飲業的就業人數（千人），
  **每千名就業者 20 家以上**算覆蓋良好。實際上一家店大約對 10–20 名就業者（每千人 50–100 家），
  20 家大約是畫到三成以上。2026-11-04 的結果：歐洲多在 50–130、台灣 55、美國 45、日本 41、南韓 42；
  墨西哥 9、巴西 11、泰國 11、土耳其 19、印度 5、奈及利亞 0。
就業人數（取最近一年）：
- ILO 的 EMP_TEMP_SEX_ECO_NB（ISIC Rev.4 的 I 類「住宿及餐飲業」，2015 年起；CC BY 4.0），標為不可靠（U）的不用；
  沒有的國家用 ISIC Rev.3 的 H 類「旅館及餐廳」（2010 年起）。
- 加拿大：加拿大統計局勞動力調查 14-10-0023-01 的「Accommodation and food services」（加拿大開放政府授權）。
- 台灣：主計總處人力資源調查的「住宿及餐飲業」（dgbas.py 的 A040103050，最近一個完整年）。
- 都沒有的（中國、香港、古巴、巴拉圭等）判斷不了，當成不完整，寫「沒有可以對照的餐飲業就業人數」。
就業人數不到 5 千人的小國（諾魯、吐瓦魯、紐埃…）比值跳動太大，也當成判斷不了。
"""
from __future__ import annotations

import csv
import json
import time
import urllib.error
import urllib.request
from datetime import date

from common import CACHE_DIR, USER_AGENT, download
from sources import dgbas, osm_qlever

THRESHOLD = 20  # 每千名住宿及餐飲業就業者的 OSM 餐飲店
MIN_WORKERS = 5  # 千人
FOOD_TAGS = ("restaurant", "fast_food", "cafe", "bar", "pub")
ILO_URL = "https://sdmx.ilo.org/rest/data/ILO,DF_EMP_TEMP_SEX_ECO_NB,1.0/.A..SEX_T.{eco}?format=csv&startPeriod={start}"
STATCAN_URL = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods"
# 14-10-0023-01：加拿大、就業、Accommodation and food services、全部性別、15 歲以上
STATCAN_BODY = [{"productId": 14100023, "coordinate": "1.2.26.1.1.0.0.0.0.0", "latestN": 3}]


def _ilo(eco: str, start: int) -> dict[str, tuple[int, float]]:
    for attempt in range(4):
        try:
            path = download(ILO_URL.format(eco=eco, start=start), "ilostat", f"EMP_TEMP_SEX_ECO_NB-{eco}.csv")
            break
        except urllib.error.HTTPError as e:
            # sdmx.ilo.org 偶爾回 403（同一個網址過一陣子再試就好，見 ilostat.py）
            if e.code != 403 or attempt == 3:
                raise
            time.sleep(15 * (attempt + 1))
    out: dict[str, tuple[int, float]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["OBS_STATUS"] == "U" or not r["OBS_VALUE"] or len(r["REF_AREA"]) != 3 or r["REF_AREA"].startswith("X"):
                continue
            y = int(r["TIME_PERIOD"])
            if r["REF_AREA"] not in out or y > out[r["REF_AREA"]][0]:
                out[r["REF_AREA"]] = (y, float(r["OBS_VALUE"]))
    return out


def _canada() -> tuple[int, float]:
    path = CACHE_DIR / "statcan" / "14100023-food.json"
    if not path.exists():
        req = urllib.request.Request(STATCAN_URL, data=json.dumps(STATCAN_BODY).encode(),
                                     headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    points = json.loads(path.read_text(encoding="utf-8"))[0]["object"]["vectorDataPoint"]
    last = max(points, key=lambda p: p["refPer"])
    return int(last["refPer"][:4]), float(last["value"])


def _taiwan() -> tuple[int, float]:
    header, data = dgbas._table("A040103050", 106, "0,20", "0,1")
    year = max(y for y in data if y < date.today().year)
    return year, float(dgbas._num(dict(zip(header, data[year]))["住宿及餐飲業"]))


def workers() -> dict[str, tuple[int, float, str]]:
    """住宿及餐飲業的就業人數：{iso3: (年, 千人, 來源代號)}"""
    out = {c: (y, v, "ilo4") for c, (y, v) in _ilo("ECO_ISIC4_I", 2015).items()}
    for c, (y, v) in _ilo("ECO_ISIC3_H", 2010).items():
        out.setdefault(c, (y, v, "ilo3"))
    out["CAN"] = (*_canada(), "statcan")
    out["TWN"] = (*_taiwan(), "dgbas")
    return out


def food_places() -> dict[str, int]:
    total: dict[str, int] = {}
    for tag in FOOD_TAGS:
        for c, n in osm_qlever.counts("amenity", tag).items():
            total[c] = total.get(c, 0) + n
    return total


def coverage() -> dict[str, float | None]:
    """{iso3: 每千名住宿及餐飲業就業者的 OSM 餐飲店}；判斷不了的是 None（OSM 有東西、但沒有就業人數或太小）"""
    places = food_places()
    emp = workers()
    out: dict[str, float | None] = {}
    for c in set(places) | set(emp):
        if c in emp and emp[c][1] >= MIN_WORKERS:
            out[c] = places.get(c, 0) / emp[c][1]
        else:
            out[c] = None
    return out


def well_covered() -> set[str]:
    return {c for c, r in coverage().items() if r is not None and r >= THRESHOLD}


def reason(iso3: str, ratio: float | None) -> tuple[str, str]:
    """不畫的原因（noValue 用）"""
    if ratio is None:
        return ("沒有可以對照的餐飲業就業人數，判斷不了 OpenStreetMap 在這裡畫得多完整，不畫",
                "No food-service employment figure to check how complete OpenStreetMap is here, so not shown")
    return (f"OpenStreetMap 在這裡畫得不完整（每千名餐飲業就業者只有 {ratio:.0f} 家餐飲店，門檻 {THRESHOLD}），不畫",
            f"OpenStreetMap is incomplete here ({ratio:.0f} food and drink places per 1,000 food-service workers, below {THRESHOLD}), so not shown")
