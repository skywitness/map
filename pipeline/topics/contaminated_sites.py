"""土壤與地下水的污染場址（新主題，2026-11-07，製作手冊第二十五批 486，候選 1149；環境的「污染」）。

環境部環境管理署「土壤及地下水污染場址基本資料」（EMS_S_07，data.gov.tw 6351，政府資料開放授權條款第 1 版，每日更新）。
使用者 2026-11-07 決定「先查免金鑰下載，沒有就跳過台灣」：開放資料平台文件上的 API 要帶 api_key，這裡跟 sources/moenv.py
一樣用平台網頁預覽資料用的 frontstage API（不用金鑰）：dataset.view.withLanguage 列出資源（依公告月份分成 271 個
「(YYYY/MM)」資源加一個最近的），datastore.search 一個一個讀，快取在 .cache/moenv/EMS_S_07/（第一次約 10 分鐘，間隔 1 秒）。
合計 8,261 筆（site_id 8,259 個，2 個重複的取後公告的那一筆）。座標用 wgs84_lng／wgs84_lat（dtmx／dtmy 是 TWD97）。
地號（landno）不收。

歐洲的 EIONET 問卷（EEA）沒有用：各管理階段（1a、1b…6）的定義 metadata 裡沒有寫、各國「疑似」的門檻不同。

輸出 public/data/topics/contaminated-sites/：sites.json（點：lon、lat、y 公告年、e 解除年、t 類型、k 列管狀態、a 面積；
n 名稱與 p 污染物另外放在 sites-text.json）、summary.json（側欄：類型、縣市、污染物的件數）、sites-ind.json（空的指標檔）。
"""

from __future__ import annotations

import json
import re
import time
import urllib.request
from collections import Counter

import common
from common import OUT_DIR, indicator_file, points_file, write_json, write_points

OUT = OUT_DIR / "topics" / "contaminated-sites"
VIEW = "https://data.moenv.gov.tw/api/frontstage/dataset.view.withLanguage?name=EMS_S_07&language=zh"
SEARCH = "https://data.moenv.gov.tw/api/frontstage/datastore.search"
TYPES = ["農地", "工廠", "加油站", "儲槽", "非法棄置場址", "其他"]
# 列管狀態：0 整治場址、1 控制場址、2 地下水受污染使用限制地區、3 已解除
STATUS = {"公告為整治場址": 0, "公告為控制場址": 1, "公告地下水受污染使用限制地區及限制事項": 2}
# 側欄英文版用的名稱（縣市與常見的污染物；沒有對照的照中文）
EN = {
    "彰化縣": "Changhua County", "桃園市": "Taoyuan", "臺中市": "Taichung", "新竹市": "Hsinchu City", "臺南市": "Tainan",
    "高雄市": "Kaohsiung", "新北市": "New Taipei", "苗栗縣": "Miaoli County", "雲林縣": "Yunlin County", "臺北市": "Taipei",
    "嘉義市": "Chiayi City", "嘉義縣": "Chiayi County", "南投縣": "Nantou County", "新竹縣": "Hsinchu County",
    "屏東縣": "Pingtung County", "基隆市": "Keelung", "宜蘭縣": "Yilan County", "澎湖縣": "Penghu County",
    "花蓮縣": "Hualien County", "金門縣": "Kinmen County", "臺東縣": "Taitung County", "連江縣": "Lienchiang County",
    "銅": "copper", "鎳": "nickel", "鋅": "zinc", "鉻": "chromium", "鎘": "cadmium", "鉛": "lead", "砷": "arsenic", "汞": "mercury",
    "總石油碳氫化合物": "total petroleum hydrocarbons", "苯": "benzene", "三氯乙烯": "trichloroethylene", "氯乙烯": "vinyl chloride",
    "順-1,2-二氯乙烯": "cis-1,2-dichloroethylene", "萘": "naphthalene", "四氯乙烯": "tetrachloroethylene", "甲苯": "toluene",
    "二甲苯": "xylene", "1,1-二氯乙烯": "1,1-dichloroethylene", "1,2-二氯乙烷": "1,2-dichloroethane", "氟鹽": "fluoride",
    "柴油總碳氫化合物": "diesel range organics", "總酚": "total phenols", "甲基第三丁基醚": "MTBE", "乙苯": "ethylbenzene",
}


def _fetch() -> list[dict]:
    cache = common.CACHE_DIR / "moenv" / "EMS_S_07"
    cache.mkdir(parents=True, exist_ok=True)
    view_path = cache / "view.json"
    if not view_path.exists() or common.REFRESH:
        print(f"  下載 {VIEW}")
        with urllib.request.urlopen(urllib.request.Request(VIEW, headers={"User-Agent": common.USER_AGENT}), timeout=120,
                                    context=common._ssl_context(VIEW)) as resp:
            view_path.write_bytes(resp.read())
    resources = json.loads(view_path.read_text(encoding="utf-8"))["payload"]["resources"]
    records: list[dict] = []
    for r in resources:
        target = cache / f"res-{r['rid']}.json"
        # 有年月的資源公告後不會再變；沒有年月的（最近的）每次都重抓
        if not target.exists() or common.REFRESH or not re.search(r"\(\d{4}/\d{2}\)", r["name"]):
            request = urllib.request.Request(SEARCH, data=json.dumps({"resource_id": r["rid"], "limit": 10000, "offset": 0}).encode(),
                                             headers={"Content-Type": "application/json", "User-Agent": common.USER_AGENT})
            with urllib.request.urlopen(request, timeout=120, context=common._ssl_context(SEARCH)) as resp:
                payload = json.load(resp)
            if not payload.get("success"):
                raise RuntimeError(f"環境部開放資料平台回傳錯誤：{payload}")
            if payload["payload"]["total"] > len(payload["payload"]["records"]):
                raise RuntimeError(f"EMS_S_07 {r['name']} 超過一頁")
            target.write_text(json.dumps({"name": r["name"], "records": payload["payload"]["records"]}, ensure_ascii=False), encoding="utf-8")
            time.sleep(1)
        records += json.loads(target.read_text(encoding="utf-8"))["records"]
    return records


def _pollutants(text: str) -> tuple[list[str], list[str]]:
    """「土壤污染物：銅:229(mg/Kg);鋅:739(mg/Kg)；地下水污染物：無」→ (['銅', '鋅'], [])"""
    soil: list[str] = []
    water: list[str] = []
    for part in (text or "").split("；"):
        m = re.match(r"\s*(土壤|地下水)污染物[：:](.*)", part)
        if not m:
            continue
        names = []
        for item in m.group(2).split(";"):
            name = re.sub(r":[^:]*$", "", item.strip()).strip()  # 去掉最後一個冒號之後的濃度
            if name and name != "無":
                names.append(name)
        (soil if m.group(1) == "土壤" else water).extend(names)
    return soil, water


def build() -> None:
    by_id: dict[str, dict] = {}
    for r in _fetch():
        old = by_id.get(r["site_id"])
        if old is None or r["anno_date"] >= old["anno_date"]:
            by_id[r["site_id"]] = r
    rows = []
    types, status, counties, soil_c, water_c = Counter(), Counter(), Counter(), Counter(), Counter()
    for r in by_id.values():
        if not r["wgs84_lng"] or not r["wgs84_lat"]:
            continue
        t = TYPES.index(r["site_type"]) if r["site_type"] in TYPES else TYPES.index("其他")
        released = bool(r["deanno_date"])
        k = 3 if released else STATUS.get(r["controltype"], 1)
        soil, water = _pollutants(r["pollutant"])
        rows.append({
            "lon": float(r["wgs84_lng"]), "lat": float(r["wgs84_lat"]), "y": int(r["anno_date"][:4]),
            "e": int(r["deanno_date"][:4]) if released else None, "t": t, "k": k,
            "a": round(float(r["sitearea"])) if r["sitearea"] else None,
            "n": (r["site_name"] or "").strip(), "p": "、".join(dict.fromkeys(soil + water)),
        })
        types[TYPES[t]] += 1
        status[k] += 1
        counties[r["county"]] += 1
        soil_c.update(set(soil))
        water_c.update(set(water))
    rows.sort(key=lambda x: (x["y"], x["lon"]))
    write_points(OUT / "sites.json",
                 points_file(rows, ["lon", "lat", "y", "e", "t", "k", "a", "n", "p"], {"lon": 1e-5, "lat": 1e-5}, delta=("y",)),
                 text=("n", "p"))
    years = list(range(min(r["y"] for r in rows), max(r["y"] for r in rows) + 1))
    write_json(OUT / "sites-ind.json", indicator_file("sites", "", years, {}, license="政府資料開放授權條款第 1 版"), quiet=True)
    now = [r for r in rows if r["e"] is None]
    write_json(OUT / "summary.json", {
        "total": len(rows), "now": len(now),
        "status": [status[i] for i in range(4)],
        "types": [[k, v, sum(1 for r in now if TYPES[r["t"]] == k)] for k, v in types.most_common()],
        "counties": [[k, EN.get(k, k), v] for k, v in counties.most_common()],
        "soil": [[k, EN.get(k, k), v] for k, v in soil_c.most_common(10)],
        "water": [[k, EN.get(k, k), v] for k, v in water_c.most_common(10)],
    })
    print(f"  污染場址 {len(rows):,} 處（{years[0]}–{years[-1]}），現在仍列管 {len(now)}；類型 {dict(types)}；"
          f"土壤污染物 {soil_c.most_common(6)}；地下水 {water_c.most_common(6)}")
