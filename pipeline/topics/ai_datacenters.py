"""各國 AI 發展：前沿 AI 資料中心（2026-11-13，使用者要求把 AI 產業鏈全景的資料用到地圖上、採用建議「直接用 Epoch 的原始檔」；
步驟 ai-datacenters，輸出 topics/ai/ 的 ai-campuses.json、ai-campus-power.json）。

- 資料：Epoch AI「Frontier Data Centers」（CC BY 4.0，sources/epoch.py 的 data_centers()）：96 個大型 AI 資料中心，
  每一個有逐期的 IT 電力（衛星影像、許可文件與公告的估計；今天以後的是依許可與公告推估的規劃）。
- 位置：Epoch 只有地址、沒有座標。依序：
  1. 美國的地址用美國人口普查局的地理編碼服務（Census Geocoder，公有領域；geocoding.geo.census.gov 的 robots.txt 是 404，
     每筆間隔 1 秒，結果存在 .cache/census-geocoder/）；
  2. AI 產業鏈全景（skywitness/ai-chain）的 campuses.yaml 有同名的（35 個）：用它的座標（它用 OpenStreetMap Nominatim
     轉的，ODbL 1.0；精度寫在它的 note「座標為…層級」）；
  3. 其餘用 Wikidata 的城鎮、郡的座標（PLACES，依 Epoch 的地址或名稱手寫地名）。
  Nominatim 的 robots.txt 不准 /search，所以 map 自己不查 Nominatim。
- 每年底的 IT 電力（MW）：那一年 12 月 31 日以前最後一期的值，2019–2030 年；國家的值是加總（只算這 96 個）。
"""
from __future__ import annotations

import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
from collections import Counter, defaultdict
from datetime import date

import pycountry

from common import CACHE_DIR, OUT_DIR, download, indicator_file, points_file, write_json, write_points
from sources import ai_chain as A
from sources import epoch
from topics.wafer_fabs import _geocode, _pick

OUT = OUT_DIR / "topics" / "ai"
YEARS = list(range(2019, 2031))
CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?"
ON_ADDRESS, ON_AICHAIN, ON_TOWN = 1, 2, 3  # src/topics/ai-datacenters.ts 的 PLACE
# Epoch 沒寫地址、AI 產業鏈全景也沒有的：地址或名稱裡的城鎮（Wikidata 名稱、ISO3、上一層的名稱）
PLACES = {
    "Google Mesa": ("Mesa", "USA", ["Arizona", "Maricopa County"]),
    "Google Kansas City East": ("Kansas City", "USA", ["Missouri"]),
    "Google Storey County": ("Storey County", "USA", ["Nevada"]),
    "Anthropic Barber Lake": ("Colorado City", "USA", ["Texas", "Mitchell County"]),
    "Oracle Batam": ("Batam", "IDN", []),
    "Envision Galaxy Ulanqab": ("Ulanqab", "CHN", []),
    "Southgate Melbourne": ("Melbourne", "AUS", ["Victoria"]),
    "Bridge Data Centres MY06": ("Kulai", "MYS", ["Johor"]),  # Sedenak Tech Park 在 Kulai 縣
    "YTL Johor": ("Kulai", "MYS", ["Johor"]),
    "CoreWeave Norway": ("Vennesla", "NOR", []),  # 地址的 Øvrebø 屬於 Vennesla
    "Nscale Keflavik": ("Reykjanesbær", "ISL", []),
    # Census 對不到的美國地址（沒寫郵遞區號、只有路名或區段）
    "AWS New Albany": ("New Albany", "USA", ["Ohio"]),
    "Google The Dalles": ("The Dalles", "USA", ["Oregon"]),
    "Meta Cheyenne": ("Cheyenne", "USA", ["Wyoming"]),
    "Meta Huntsville": ("Huntsville", "USA", ["Alabama"]),  # 地址寫 Toney（Huntsville 北邊）
    "Google Papillion": ("Papillion", "USA", ["Nebraska"]),
}


def _census(address: str) -> tuple[float, float, str] | None:
    url = CENSUS + urllib.parse.urlencode({"address": address, "benchmark": "Public_AR_Current", "format": "json"})
    name = hashlib.sha1(address.encode()).hexdigest()[:16] + ".json"
    cached = (CACHE_DIR / "census-geocoder" / name).exists()
    try:
        path = download(url, "census-geocoder", name)
    except urllib.error.HTTPError as e:  # 地址寫成說明文字的（「Madison Mega Site …」）回 400
        if e.code != 400:
            raise
        time.sleep(1)
        return None
    if not cached:
        time.sleep(1)
    try:
        matches = json.loads(path.read_text(encoding="utf-8"))["result"]["addressMatches"]
    except json.JSONDecodeError:  # 網站防火牆回的「Request Rejected」頁（不繞過，當作對不到）
        print(f"  Census 拒絕這個地址：{address}")
        return None
    if not matches:
        return None
    c = matches[0]["coordinates"]
    return c["x"], c["y"], matches[0]["matchedAddress"]


def _us_town(address: str) -> tuple[str, str, list[str]] | None:
    """Census 對不到的美國地址：「…, Columbus, OH 43207」→ (Columbus, USA, [Ohio])"""
    m = re.search(r",\s*([^,]+?),\s*([A-Z]{2})\s*\d{5}", address or "")
    if not m:
        return None
    state = pycountry.subdivisions.get(code=f"US-{m.group(2)}")
    return m.group(1).strip(), "USA", [state.name] if state else []


def _aichain() -> dict[str, dict]:
    """AI 產業鏈全景的園區：英文名 → {lon, lat, prec（地址、道路、鄉鎮、郡縣或城市）}"""
    out = {}
    for c in A.load("src/data/campuses.yaml")["campuses"]:
        m = re.search(r"座標為(.{1,6}?)層級", c.get("note") or "")
        out[c["nameEn"]] = {"lon": c["lon"], "lat": c["lat"], "prec": m.group(1) if m else ""}
    return out


def _power(timeline: list, year: int) -> float:
    """那一年底的 IT 電力（MW）：12 月 31 日以前最後一期"""
    last = [mw for when, mw, _total in timeline if when <= date(year, 12, 31)]
    return last[-1] if last else 0.0


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    centers = epoch.data_centers()
    aichain = _aichain()
    names = {c["name"] for c in centers}
    missing = sorted(set(PLACES) - names)
    if missing:
        raise RuntimeError(f"PLACES 裡的名稱 Epoch 沒有了：{missing}")
    rows, how, failed, want, lost = [], Counter(), [], {}, []
    for c in centers:
        got = None
        if c["country"] == "USA" and c["address"]:
            hit = _census(c["address"])
            if hit:
                got = (hit[0], hit[1], ON_ADDRESS, "")
            else:
                failed.append(c["address"])
        if not got and c["name"] in aichain:
            a = aichain[c["name"]]
            got = (a["lon"], a["lat"], ON_AICHAIN, a["prec"])
        if not got:
            want[c["name"]] = PLACES.get(c["name"]) or _us_town(c["address"])
            if not want[c["name"]]:
                lost.append(f"{c['name']}（{c['country']}，{c['address'] or '沒有地址'}）")
        c["_got"] = got
    if lost:
        raise RuntimeError("找不到位置，加進 PLACES：" + "；".join(lost))
    towns = _geocode({(n, iso) for n, iso, _h in want.values()})
    for c in centers:
        got = c.pop("_got")
        if not got:
            n, iso, hint = want[c["name"]]
            pick = _pick(towns.get((n, iso), []), hint, settlement=False)
            if not pick:
                raise RuntimeError(f"{c['name']}：Wikidata 找不到 {n}（{iso}）")
            got = (pick["lon"], pick["lat"], ON_TOWN, n)
        how[got[2]] += 1
        row = {"lon": round(got[0], 5), "lat": round(got[1], 5), "iso3": c["country"], "q": got[2], "pl": got[3] or None,
               "name": c["name"], "owner": c["owner"] or None, "users": c["users"] or None}
        for y in YEARS:
            mw = _power(c["timeline"], y)
            row[f"p{y}"] = round(mw) if mw > 0 else None
        today = [mw for when, mw, _t in c["timeline"] if when <= date.today()]
        row["now"] = round(today[-1]) if today and today[-1] > 0 else None
        row["max"] = round(max((mw for _w, mw, _t in c["timeline"]), default=0)) or None
        first = next((when for when, mw, _t in c["timeline"] if mw > 0), None)
        row["y0"] = first.year if first else None
        rows.append(row)
    print(f"  位置：Census 地址 {how[ON_ADDRESS]}、AI 產業鏈全景 {how[ON_AICHAIN]}、Wikidata 城鎮 {how[ON_TOWN]}；Census 對不到 {len(failed)}：{failed}")
    rows.sort(key=lambda r: -(r["max"] or 0))
    fields = ["lon", "lat", "iso3", "q", "now", "max", "y0", *[f"p{y}" for y in YEARS], "pl", "name", "owner", "users"]
    data = points_file(rows, fields, {"lon": 0.00001, "lat": 0.00001, "q": 1, "now": 1, "max": 1, "y0": 1, **{f"p{y}": 1 for y in YEARS}},
                       strings=("iso3",))
    data["license"] = ("CC BY 4.0（Epoch AI, Frontier Data Centers）；位置：美國人口普查局 Census Geocoder（公有領域）、"
                       "AI 產業鏈全景（OpenStreetMap Nominatim，ODbL 1.0）、Wikidata（CC0）")
    write_points(OUT / "ai-campuses.json", data, ("pl", "name", "owner", "users"))
    # 各國每年底的 IT 電力合計
    total: dict[str, list[float]] = defaultdict(lambda: [0.0] * len(YEARS))
    count: dict[str, list[int]] = defaultdict(lambda: [0] * len(YEARS))
    for r in rows:
        for i, y in enumerate(YEARS):
            if r[f"p{y}"]:
                total[r["iso3"]][i] += r[f"p{y}"]
                count[r["iso3"]][i] += 1
    values = {iso: [round(v) if v else None for v in vals] for iso, vals in sorted(total.items())}
    write_json(OUT / "ai-campus-power.json", indicator_file(
        "ai-campus-power", "MW", YEARS, values, license="CC BY 4.0（Epoch AI, Frontier Data Centers）"))
    for y in (2022, 2024, 2025, 2026, 2028, 2030):
        i = YEARS.index(y)
        world = sum(v[i] for v in total.values())
        top = sorted(((v[i], k) for k, v in total.items() if v[i]), reverse=True)
        print(f"  {y}：{sum(c[i] for c in count.values())} 個、{world:,.0f} MW；" + "、".join(f"{k} {v:,.0f}" for v, k in top[:6]))
    print("  最大（規劃完成）：" + "、".join(f"{r['name']} {r['max']:,}" for r in rows[:8]))
    print("  今天：" + "、".join(f"{r['name']} {r['now']:,}" for r in sorted(rows, key=lambda r: -(r['now'] or 0))[:6]))
    print("  國家：" + str(Counter(r["iso3"] for r in rows).most_common()))
