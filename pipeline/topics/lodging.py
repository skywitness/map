"""新主題「旅館、民宿與旅行社」（2026-11-08，製作手冊第二十七批 670、671，候選 1473、1474；步驟 lodging，輸出 topics/lodging/）。

- 670 旅宿：OpenStreetMap（ODbL 1.0）經 QLever 的 `tourism=hotel`、`tourism=guest_house` 分國計數與每十萬人（只替 OSM 覆蓋良好的
  國家上色，`osm_density.density`）。全球 45 萬家旅館的點太多，不畫；台灣畫交通部觀光署「旅館民宿－觀光資訊資料庫」
  （data.gov.tw 7780，政府資料開放授權條款第 1 版）的每一家（都有座標），依類別上色、附房間數，不輸出電話、統一編號。
- 671 旅行社：OECD 觀光統計 Enterprises and employment in tourism（DSD_TOURISM_ENT_EMP@DF_ENT_EMP）的 ACTIVITY=TOUR_TRV
  （旅行社與旅遊業者）家數 ENT 與就業 EMP，各國最近一年差很多（中國 2012），latestWithin 15；家數的單位有的國家是企業、
  有的是場所（UNIT_MEASURE ENT／EST），hints 寫明。台灣用觀光署「旅行業基本資料」（data.gov.tw 72074，本機 session 下載到
  map-plan 的 data/tad/，重跑前複製到 .cache/tad/）的總公司家數（不含分公司），依類別寫在 hints；不輸出負責人、電話。
"""
from __future__ import annotations

import hashlib
import json
import re
import zipfile
from collections import Counter

from common import CACHE_DIR, OUT_DIR, download, indicator_file, points_file, write_json, write_points
from sources import oecd
from topics.osm_density import density

OUT = OUT_DIR / "topics" / "lodging"
HOTEL_URL = "https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/Hotel-json.zip"
TAD = CACHE_DIR / "tad" / "TravelAgent.xml"
TAD_SHA = "1a04ff42c55b3a9a330d0fec2cdb32daa3a83847197c0e8d4e4b6cf0a39de3a9"
ENT_EMP = "OECD.CFE.TOU,DSD_TOURISM_ENT_EMP@DF_ENT_EMP,"
FIRST = 2008
# 觀光署 HotelClasses：1 國際觀光旅館、2 一般觀光旅館、3 一般旅館、4 民宿
CLASSES = {1: "國際觀光旅館", 2: "一般觀光旅館", 3: "一般旅館", 4: "民宿"}


def osm() -> None:
    density(OUT, "tourism", "hotel", "hotels", "家/十萬人", 1e5, "旅館")
    density(OUT, "tourism", "guest_house", "guest-houses", "家/十萬人", 1e5, "民宿")


def taiwan() -> None:
    path = download(HOTEL_URL, "motc", "Hotel-json.zip")
    data = json.loads(zipfile.ZipFile(path).read("HotelList.json").decode("utf-8-sig"))
    rows = []
    for h in data["Hotels"]:
        if h.get("ServiceStatus") != 1 or not h.get("PositionLat") or not h.get("PositionLon"):
            continue
        k = (h.get("HotelClasses") or [4])[0]
        addr = h.get("PostalAddress") or {}
        rows.append({"lon": round(h["PositionLon"], 5), "lat": round(h["PositionLat"], 5), "k": k if k in CLASSES else 4,
                     "r": h.get("TotalRooms") or None, "n": h["HotelName"].strip(), "t": f"{addr.get('City') or ''}{addr.get('Town') or ''}" or None})
    rows.sort(key=lambda p: (p["k"], p["t"] or "", p["lon"]))
    write_points(OUT / "taiwan.json", points_file(rows, ["lon", "lat", "k", "r", "n", "t"], {"lon": 0.00001, "lat": 0.00001, "k": 1, "r": 1}),
                 ("n", "t"))
    by = Counter(p["k"] for p in rows)
    rooms = Counter()
    for p in rows:
        rooms[p["k"]] += p["r"] or 0
    print(f"  觀光署旅館民宿（更新 {data.get('UpdateTime')}）：{len(rows):,} 家、{sum(rooms.values()):,} 間房；"
          + "、".join(f"{CLASSES[k]} {by[k]:,} 家 {rooms[k]:,} 間" for k in sorted(by)))
    county = Counter((p["t"] or "")[:3] for p in rows)
    print(f"    縣市：{county.most_common(6)}")


def _tad() -> tuple[int, Counter]:
    if not TAD.exists():
        raise RuntimeError(f"沒有 {TAD}：請把 map-plan 的 data/tad/TravelAgent.xml 複製到這裡")
    if hashlib.sha256(TAD.read_bytes()).hexdigest() != TAD_SHA:
        raise RuntimeError(f"{TAD} 的 SHA-256 跟 map-plan 的 README 不一樣，先看過再改")
    text = TAD.read_text(encoding="utf-8")
    kinds = Counter(re.findall(r"<TRASIKEY_I>([^<]*)</TRASIKEY_I>", text))
    return text.count("<gryTRAVEL>"), kinds


def agencies() -> None:
    rows = [r for r in oecd.rows(ENT_EMP) if r["ACTIVITY"] == "TOUR_TRV" and r["OBS_VALUE"]]
    from sources.countries import to_iso3

    for measure, name, unit in (("ENT", "travel-agencies", "家"), ("EMP", "travel-agency-jobs", "人")):
        series: dict[str, dict[int, float]] = {}
        units: dict[str, str] = {}
        for r in rows:
            iso = to_iso3(r["REF_AREA"])
            if r["MEASURE"] != measure or not iso:
                continue
            y = int(r["TIME_PERIOD"][:4])
            series.setdefault(iso, {})[y] = float(r["OBS_VALUE"]) * 10 ** int(r["UNIT_MULT"] or 0)
            if y == max(series[iso]):
                units[iso] = r["UNIT_MEASURE"]
        hints, hints_en, nv, nv_en = {}, {}, {}, {}
        if measure == "ENT":
            n, kinds = _tad()
            series["TWN"] = {2026: float(n)}
            hints["TWN"] = "觀光署旅行業名錄的總公司（不含分公司）：" + "、".join(f"{k} {v:,}" for k, v in kinds.most_common())
            hints_en["TWN"] = (f"Head offices in the Tourism Administration register (excluding branches): {kinds.get('綜合', 0):,} consolidated, "
                               f"{kinds.get('甲種', 0):,} class A, {kinds.get('乙種', 0):,} class B")
            for c, u in units.items():
                if u == "EST" and c not in hints:
                    hints[c], hints_en[c] = "算的是營業場所（含分店）", "Counts establishments (including branches)"
        else:
            nv["TWN"], nv_en["TWN"] = "OECD 沒有台灣旅行業的就業人數", "No OECD figure for Taiwan"
        years = list(range(FIRST, max(y for s in series.values() for y in s) + 1))
        values = {c: [round(s[y]) if y in s else None for y in years] for c, s in sorted(series.items()) if any(y in s for y in years)}
        write_json(OUT / f"{name}.json", indicator_file(name, unit, years, values, latestWithin=15, hints=hints, hintsEn=hints_en,
                                                        noValue=nv, noValueEn=nv_en, license="OECD 資料條款（可轉載、改作）；台灣：觀光署"))
        latest = sorted(((s[max(s)], c, max(s)) for c, s in series.items() if s), reverse=True)
        print(f"  旅行社 {measure}：{len(values)} 國；{[(c, int(v), y) for v, c, y in latest[:10]]}；最少 {[(c, int(v), y) for v, c, y in latest[-4:]]}")


def build() -> None:
    taiwan()
    agencies()
    osm()
