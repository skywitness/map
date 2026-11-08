"""台灣的中醫：健保特約的中醫院所，依鄉鎮市區（2026-11-08，使用者要求「更詳細的中醫診所和中醫醫院清單與位置」；步驟 taiwan-tcm-clinics）。

- 資料：健保署資料開放平台（info.nhi.gov.tw）的「健保特約醫事機構」診所、醫學中心、區域醫院、地區醫院四份資料集，
  本機 session 用平台的 datastore API 取出、篩成中醫的（型態別是中醫，或診療科別有中醫一般科），只留醫事機構代碼、名稱、
  地址、型態別、特約類別、終止合約或歇業日期六欄（不留電話、負責醫師、看診時段），放在 map-plan 的 data/nhi-tcm/clinics.csv
  （cloud 連不上健保署的平台）；重跑前把它複製到 .cache/nhi-tcm/clinics.csv。授權：政府資料開放授權條款第 1 版。
- 只算現在特約的：「終止合約或歇業日期」早於資料產生當天的不算（本機 session 查過：那些列的科別與服務項目都是空的）。
- 三類：中醫醫院（型態別「中醫醫院」）、中醫診所（型態別是中醫的診所）、醫院的中醫科（西醫醫院的診療科別有中醫一般科）。
- **位置只到鄉鎮市區**：清單沒有座標；地址比對內政部的鄉鎮市區名稱（divisions 步驟的 TWN.json 的 u2），每一家放在那個鄉鎮市區
  的標籤點。逐家的座標要地理編碼（TGOS 要金鑰、條款還沒讀到），等有結果再換成逐家的點。
"""
from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date

from common import CACHE_DIR, OUT_DIR, indicator_file, points_file, write_json, write_points

OUT = OUT_DIR / "topics" / "taiwan-tcm"
SRC = CACHE_DIR / "nhi-tcm" / "clinics.csv"
HOSPITAL, CLINIC, DEPARTMENT = 1, 2, 3  # src/topics/taiwan-tcm.ts 的 KINDS
# 清單的縣市順序（直轄市、省轄市、縣，最後是金門、連江）
COUNTY_ORDER = ["臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", "基隆市", "新竹市", "嘉義市", "新竹縣", "苗栗縣", "彰化縣", "南投縣",
                "雲林縣", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣"]
OLD_COUNTIES = {"臺北縣": "新北市", "桃園縣": "桃園市", "臺中縣": "臺中市", "臺南縣": "臺南市", "高雄縣": "高雄市"}
TCM_TYPES = {"中醫醫院": HOSPITAL, "中醫綜合醫院": HOSPITAL, "中醫一般診所": CLINIC, "中醫診所": CLINIC, "中醫專科診所": CLINIC,
             "中醫醫務室": CLINIC}


def _kind(row: dict) -> int:
    t = row["醫事機構種類"]
    if t in TCM_TYPES:
        return TCM_TYPES[t]
    if row["特約類別"] in ("1", "2", "3"):
        return DEPARTMENT
    if "中醫" in row["醫事機構名稱"]:  # 型態別是一般診所、名稱是中醫診所的（農會附設）
        return CLINIC
    raise ValueError(f"分不出類別：{row['醫事機構代碼']} {row['醫事機構種類']}")


def build() -> None:
    if not SRC.exists():
        raise RuntimeError(f"沒有 {SRC}：請把 map-plan 的 data/nhi-tcm/clinics.csv 複製到這裡")
    OUT.mkdir(parents=True, exist_ok=True)
    div = json.loads((OUT_DIR / "divisions" / "TWN.json").read_text(encoding="utf-8"))
    counties = {u[0]: u for u in div["u1"]}
    towns = defaultdict(list)  # 縣市名稱 → [(鄉鎮市區名稱, u2)]
    for u in div["u2"]:
        towns[counties[u[8]][1]].append((u[1], u))
    today = date.today().strftime("%Y%m%d")
    rows, skipped, unmatched, county_only = [], 0, [], []
    with SRC.open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            if r["終止合約或歇業日期"] and r["終止合約或歇業日期"] < today:
                skipped += 1
                continue
            addr_show = unicodedata.normalize("NFKC", r["地址"])  # 全形數字改半形（顯示用，其他照原樣）
            addr = addr_show.replace("台", "臺").replace(" ", "")
            legacy = False
            for old, new in OLD_COUNTIES.items():  # 2010、2014 年改制前的縣名（「桃園縣桃園市」→ 桃園市桃園區）
                if addr.startswith(old):
                    addr, legacy = new + addr[len(old):], True
            county = next((c for c in towns if addr.startswith(c)), None)
            rest = addr[len(county):] if county else ""
            # 最長的鄉鎮市區名稱優先（「東區」與「東勢區」）；改制前的地址把「市、鎮、鄉」當成「區」再比一次
            cands = sorted(towns.get(county, []), key=lambda x: -len(x[0]))
            town = next((u for name, u in cands if rest.startswith(name)), None)
            if not town and legacy:
                town = next((u for name, u in cands if name.endswith("區") and any(rest.startswith(name[:-1] + x) for x in "市鎮鄉")), None)
            if not town:
                cu = next((u for u in div["u1"] if u[1] == county), None)
                if not cu:
                    unmatched.append(r["地址"])
                    continue
                # 地址沒寫鄉鎮市區（「新竹市西門街…」）：放在縣市的標籤點，鄉鎮市區留白
                county_only.append(r["地址"])
                rows.append({"lon": cu[7][0], "lat": cu[7][1], "iso3": "TWN", "k": _kind(r), "t": cu[0], "name": r["醫事機構名稱"],
                             "addr": addr_show, "area": county, "areaEn": cu[2], "o": COUNTY_ORDER.index(county)})
                continue
            rows.append({"lon": town[7][0], "lat": town[7][1], "iso3": "TWN", "k": _kind(r), "t": town[0],
                         "name": r["醫事機構名稱"], "addr": addr_show, "area": f"{county}{town[1]}", "areaEn": f"{town[2]}, {counties[town[8]][2]}",
                         "o": COUNTY_ORDER.index(county)})
    if unmatched:
        raise RuntimeError(f"有 {len(unmatched)} 個地址對不到鄉鎮市區：{unmatched[:10]}")
    rows.sort(key=lambda r: (r["o"], r["t"], r["k"], r["name"]))
    write_points(OUT / "nhi-clinics.json", points_file(rows, ["lon", "lat", "iso3", "k", "name", "addr", "area", "areaEn"],
                                                       {"lon": 0.001, "lat": 0.001, "k": 1}, strings=("iso3",)),
                 ("name", "addr", "area", "areaEn"))
    # 各鄉鎮市區的家數（地圖上的圓）
    per: dict[str, Counter] = defaultdict(Counter)
    for r in rows:
        if r["t"].count("-") == 2:  # 只放在縣市標籤點的（沒寫鄉鎮市區）不畫圓，只在清單
            per[r["t"]][r["k"]] += 1
    u2 = {u[0]: u for u in div["u2"]}
    town_rows = [{"lon": u2[t][7][0], "lat": u2[t][7][1], "n": sum(c.values()), "h": c[HOSPITAL] + c[DEPARTMENT], "cl": c[CLINIC],
                  "c": f"{counties[u2[t][8]][1]}{u2[t][1]}", "en": f"{u2[t][2]}, {counties[u2[t][8]][2]}"} for t, c in per.items()]
    town_rows.sort(key=lambda r: -r["n"])
    write_points(OUT / "nhi-townships.json", points_file(town_rows, ["lon", "lat", "n", "h", "cl", "c", "en"],
                                                         {"lon": 0.001, "lat": 0.001, "n": 1, "h": 1, "cl": 1}), ("c", "en"))
    kinds = Counter(r["k"] for r in rows)
    write_json(OUT / "nhi-clinics-total.json", indicator_file(
        "nhi-clinics", "家", [int(today[:4])], {"TWN": [len(rows)]},
        hints={"TWN": f"中醫醫院 {kinds[HOSPITAL]}、中醫診所 {kinds[CLINIC]}、設有中醫科的醫院 {kinds[DEPARTMENT]}"},
        hintsEn={"TWN": f"{kinds[HOSPITAL]} Chinese medicine hospitals, {kinds[CLINIC]} clinics, {kinds[DEPARTMENT]} hospitals with a Chinese medicine department"},
        license="政府資料開放授權條款第 1 版（衛生福利部中央健康保險署）"))
    print(f"  健保特約的中醫院所 {len(rows)} 家（不算已終止合約的 {skipped} 列）：中醫醫院 {kinds[HOSPITAL]}、中醫診所 {kinds[CLINIC]}、"
          f"醫院的中醫科 {kinds[DEPARTMENT]}；地址沒寫鄉鎮市區、放在縣市的 {len(county_only)}：{county_only}")
    print(f"    {len(town_rows)} 個鄉鎮市區有：" + "、".join(f"{r['c']} {r['n']}" for r in town_rows[:12]))
    zero = [f"{counties[u[8]][1]}{u[1]}" for u in div["u2"] if u[0] not in per]
    print(f"    沒有的 {len(zero)} 個：" + "、".join(zero[:30]))
    by_county = Counter()
    for r in rows:
        by_county[r["area"][:3]] += 1
    print("    依縣市：" + "、".join(f"{c} {n}" for c, n in by_county.most_common()))
    print("    中醫醫院：" + "、".join(f"{r['name']}（{r['area']}）" for r in rows if r["k"] == HOSPITAL))
