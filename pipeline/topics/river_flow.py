"""河流與流域的擴充：大河一年中的流量（2026-11-03，製作手冊第十七批 277）。

**資料**：Open-Meteo Flood API（https://flood-api.open-meteo.com/v1/flood ，資料來自 Copernicus 緊急管理服務的 GloFAS v4，
0.05° 網格的模式模擬流量，不是實測）。`models=consolidated_v4` 是 GloFAS 的再分析（預設的 seamless 在近年改接預報，
2024 年的值跟再分析不同），抓 2015–2024 年的每日流量，算每個月的平均（使用者 2026-11-03 決定）。
**授權**：
- Open-Meteo：API 資料 CC BY 4.0（https://open-meteo.com/en/licence ，要在顯示資料的地方放連結）；免費 API 只准非商業使用
  （https://open-meteo.com/en/terms ），網站非商業。
- GloFAS：CEMS-FLOODS datasets licence（https://ecds.ecmwf.int/licences/cems-floods ）准許重製、散布、改作，
  改作過的要標「Contains modified Copernicus Emergency Management Service information [年份]」。
**用量**：免費 API 每天 1 萬次、每小時 5,000 次、每分鐘 600 次；超過兩週的請求依天數折算成多次（10 年約 261 次），
所以一天抓不完。每條河的結果存在 pipeline/.cache/open-meteo-flood/，遇到每天的上限就停，隔天再跑會從快取接著抓；
cloud 的容器被回收、快取不見時，已經在 flow.json（同樣的年份）的河沿用它的值，不重抓。
**挑哪些河**：河流主題（topics/rivers.py 已經輸出的 rivers.json）裡 HydroRIVERS 長期平均流量前 40 名、有名稱的河流系統，
加上流域大或有名但流量排不進前 40 的 10 條（EXTRA），再加台灣流域面積前 10 大的河（rivers.TAIWAN 的前 10 條）。
**位置**：河口附近 GloFAS 的格點不一定落在主流上（文件建議把座標挪 0.1° 試試；高屏溪河口那一格只有 6 m³/s，
主流在西邊約 4 公里）：河口周圍 ±0.1° 每 0.05° 一點（25 點）與河口往上游 50 km 內的幾個點各抓兩週，
取平均流量最大、離河口（或往上游的點）0.06° 以內的格點（API 會挑 5 km 內最大的河，烏溪河口北邊的點會跳到大甲溪），
再抓那一格的 10 年。兩條河用到同一個格點時停下來。
"""
from __future__ import annotations

import calendar
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

import geoindex
from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, now_iso, points_file, write_json
from topics.rivers import TAIWAN, YEAR

OUT = OUT_DIR / "topics" / "rivers"
CACHE = CACHE_DIR / "open-meteo-flood"
API = "https://flood-api.open-meteo.com/v1/flood"
MODEL = "consolidated_v4"
FIRST, LAST = 2015, 2024
PROBE = ("2020-07-01", "2020-07-14")  # 找格點用的兩週（一次算 1 次）
TOP = 40
# 流量排不進前 40，但流域大或有名的河（rivers.json 的英文名）
EXTRA = ["Nile", "Yellow", "Shatt al-Arab", "Murray", "Colorado", "Grande", "Orange", "Rhine", "Dnieper", "Chao Phraya"]
TAIWAN_N = 10
PAUSE = 200  # 每抓一條河（約 261 次）停幾秒：每小時 5,000 次以內


class DailyLimit(Exception):
    """今天的免費額度用完了"""


def _get(params: dict) -> dict | list:
    url = f"{API}?{urllib.parse.urlencode(params, safe=',')}"
    for attempt in range(6):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", "replace")
            if error.code == 429 or "limit" in body.lower():
                print(f"  Open-Meteo 限流（{error.code}）：{body[:200]}")
                if "daily" in body.lower():
                    raise DailyLimit(body) from error
                time.sleep(600)  # 每分鐘或每小時的上限：等 10 分鐘
                continue
            raise RuntimeError(f"Open-Meteo {error.code}：{body[:300]}") from error
        except (urllib.error.URLError, TimeoutError) as error:
            print(f"  連線失敗（{error}），{30 * (attempt + 1)} 秒後重試")
            time.sleep(30 * (attempt + 1))
    raise RuntimeError(f"Open-Meteo 一直連不上：{url}")


def _unpack(pf: dict) -> list[dict]:
    """還原 points_file() 的欄位（rivers.json 的 records 與 groups）"""
    fields, cols = pf["fields"], pf["columns"]
    scale, delta = pf.get("scale", {}), set(pf.get("delta", []))
    strings = pf.get("strings") or {}
    string_fields = set(strings.get("fields", []))
    out = [{} for _ in cols[0]]
    for k, name in enumerate(fields):
        acc = 0
        for i, v in enumerate(cols[k]):
            if name in delta and v is not None:
                acc += v
                v = acc
            if name in string_fields and isinstance(v, int):
                v = strings["table"][v]
            elif isinstance(v, (int, float)) and name in scale:
                v = v * scale[name]
            out[i][name] = v
    return out


def _lines(data: dict) -> list[list[tuple[float, float]]]:
    q = data["quantum"]
    out = []
    for flat in data["lines"]:
        x, y = flat[0], flat[1]
        pts = [(x * q, y * q)]
        for i in range(2, len(flat), 2):
            x += flat[i]
            y += flat[i + 1]
            pts.append((x * q, y * q))
        out.append(pts)
    return out


def _km(a: tuple[float, float], b: tuple[float, float]) -> float:
    dx = (a[0] - b[0]) * math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot(dx, a[1] - b[1]) * 111.2


def rivers() -> list[dict]:
    """要抓的河：{g, zh, en, Q（HydroRIVERS 的長期平均流量）, mouth, near（河口往上游的點）, tw}"""
    data = json.loads((OUT / "rivers.json").read_text(encoding="utf-8"))
    groups = {g["g"]: g for g in _unpack(data["groups"]["records"])}
    records = _unpack(data["records"])
    lines = _lines(data)
    by_group: dict[int, list[int]] = {}
    for i, r in enumerate(records):
        by_group.setdefault(r["g"], []).append(i)

    def mouth(g: int) -> tuple[tuple[float, float], list[tuple[float, float]]]:
        """集水面積最大的那條線（主流最下游）的下游端：不跟同一個水系其他線的端點相接的那一端"""
        ids = by_group[g]
        main = max(ids, key=lambda i: records[i]["u"])
        pts = lines[main]
        ends = [p for i in ids if i != main for p in (lines[i][0], lines[i][-1])]
        near_first = min((_km(pts[0], e) for e in ends), default=1e9)
        near_last = min((_km(pts[-1], e) for e in ends), default=1e9)
        if near_last < near_first:  # 最後一點接著上游的支流：線是從河口往上游畫的
            pts = pts[::-1]
        m = pts[-1]
        return m, [p for p in pts[::-1][1:] if _km(p, m) <= 50][:4]

    named = [g for g in groups.values() if g.get("se")]
    top = sorted(named, key=lambda g: -g["Q"])[:TOP]
    by_en: dict[str, dict] = {}
    for g in sorted(named, key=lambda g: g["A"]):  # 同名的河（德州也有 Colorado）用流域最大的
        by_en[g["se"]] = g
    chosen = top + [by_en[e] for e in EXTRA if by_en[e] not in top]
    out = []
    by_zh = {g["sz"]: g for g in sorted(named, key=lambda g: g["A"])}
    for zh, en, _qid, lon, lat, _area in TAIWAN[:TAIWAN_N]:
        g = by_zh.get(zh)
        if g is None:
            raise RuntimeError(f"rivers.json 沒有台灣的 {zh}")
        out.append({"g": g["g"], "zh": zh, "en": en, "Q": g["Q"], "mouth": (lon, lat), "near": [], "tw": True})
    for g in chosen:
        m, near = mouth(g["g"])
        out.append({"g": g["g"], "zh": g["sz"], "en": g["se"], "Q": g["Q"], "mouth": m, "near": near, "tw": False})
    return out


def _slug(river: dict) -> str:
    return f"{river['g']}-{''.join(c if c.isalnum() else '-' for c in river['en']).strip('-').lower()}"


def locate(river: dict) -> dict:
    """候選點各抓兩週，回傳平均流量最大的格點 {lat, lon, probe}"""
    path = CACHE / f"cell-{_slug(river)}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    lon, lat = river["mouth"]
    # 河口周圍 ±0.1° 每 0.05° 一點（5×5，GloFAS 的高屏溪在河口西邊約 4 公里那一列）與往上游的幾個點
    grid = [(lon + dx * 0.05, lat + dy * 0.05) for dy in range(-2, 3) for dx in range(-2, 3)]
    cands = [*grid, *river["near"]]
    result = _get({
        "latitude": ",".join(f"{c[1]:.3f}" for c in cands), "longitude": ",".join(f"{c[0]:.3f}" for c in cands),
        "daily": "river_discharge", "models": MODEL, "start_date": PROBE[0], "end_date": PROBE[1],
    })
    # 回傳的格點要離河口（或往上游的點）0.06° 以內：API 會挑 5 km 內最大的河，烏溪河口北邊那幾點會跳到大甲溪的出海口
    centres = [(lon, lat), *river["near"]]
    best = None
    for res in result if isinstance(result, list) else [result]:
        values = [v for v in res["daily"]["river_discharge"] if v is not None]
        cell = (res["longitude"], res["latitude"])
        if values and min(_km(cell, c) for c in centres) <= 0.06 * 111.2:
            mean = sum(values) / len(values)
            if best is None or mean > best["probe"]:
                best = {"lat": res["latitude"], "lon": res["longitude"], "probe": round(mean, 1)}
    if best is None:
        raise RuntimeError(f"{river['zh']} 的候選格點都沒有流量")
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(best), encoding="utf-8")
    return best


def series(river: dict, cell: dict) -> tuple[dict[str, float | None], bool]:
    """那一格 FIRST–LAST 年的每日流量 {日期: m³/s}；第二個值是有沒有真的打 API（要不要停一下）"""
    path = CACHE / f"daily-{_slug(river)}-{cell['lat']:.3f}-{cell['lon']:.3f}.json"  # 換了格點就重抓
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8")), False
    result = _get({
        "latitude": f"{cell['lat']:.4f}", "longitude": f"{cell['lon']:.4f}", "daily": "river_discharge", "models": MODEL,
        "start_date": f"{FIRST}-01-01", "end_date": f"{LAST}-12-31",
    })
    daily = dict(zip(result["daily"]["time"], result["daily"]["river_discharge"]))
    path.write_text(json.dumps(daily), encoding="utf-8")
    return daily, True


def monthly(daily: dict[str, float | None]) -> list[float]:
    """12 個月的平均流量（每個月所有日子的平均；缺值超過 5% 的月份當作錯誤）"""
    sums, counts = [0.0] * 12, [0] * 12
    for day, v in daily.items():
        if v is not None:
            m = int(day[5:7]) - 1
            sums[m] += v
            counts[m] += 1
    for m in range(12):
        days = sum(calendar.monthrange(y, m + 1)[1] for y in range(FIRST, LAST + 1))
        if counts[m] < days * 0.95:
            raise RuntimeError(f"{m + 1} 月只有 {counts[m]}／{days} 天有值")
    return [sums[m] / counts[m] for m in range(12)]


def build() -> None:
    todo = rivers()
    print(f"  要抓 {len(todo)} 條河（台灣 {sum(r['tw'] for r in todo)} 條）；{FIRST}–{LAST} 年、{MODEL}")
    # 已經在 flow.json 的河（同樣的年份）：快取不見時（cloud 的容器被回收）沿用，不重抓
    previous: dict[int, dict] = {}
    old_file = OUT / "flow.json"
    if old_file.exists():
        old = json.loads(old_file.read_text(encoding="utf-8"))
        if old.get("years") == [FIRST, LAST]:
            previous = {int(r["g"]): r for r in _unpack(old)}
    rows, missing = [], []
    for river in todo:
        if not (CACHE / f"cell-{_slug(river)}.json").exists() and river["g"] in previous:
            rows.append(previous[river["g"]])
            print(f"  {river['zh']}：快取沒有，沿用 flow.json 的值")
            continue
        try:
            cell = locate(river)
            daily, fetched = series(river, cell)
        except DailyLimit:
            missing.append(river)
            continue
        months = monthly(daily)
        mean = sum(m * calendar.monthrange(2023, i + 1)[1] for i, m in enumerate(months)) / 365
        peak = max(range(12), key=lambda i: months[i])
        low = min(range(12), key=lambda i: months[i])
        iso3 = geoindex.countries_at([river["mouth"][0]], [river["mouth"][1]], nearest=True)[0]
        rows.append({
            "lon": cell["lon"], "lat": cell["lat"], "z": river["zh"], "e": river["en"], "g": river["g"], "c": iso3,
            # s：流量最大的月份落在哪三個月（1 是 12–2 月、2 是 3–5 月、3 是 6–8 月、4 是 9–11 月），地圖的顏色
            "q": mean, "pk": peak + 1, "lo": low + 1, "s": (peak + 1) % 12 // 3 + 1, "r": months[peak] / max(months[low], 0.01),
            "t": 1 if river["tw"] else 0, "hq": river["Q"],
            **{f"m{i + 1}": v for i, v in enumerate(months)},
        })
        ratio = mean / river["Q"]
        if not 0.4 <= ratio <= 2.5:
            print(f"  注意：{river['zh']} 跟 HydroRIVERS 的長期平均差很多（比 {ratio:.2f}），格點可能不在主流，或是取水、水庫調節多的河")
        print(f"  {river['zh']}（{river['en']}）：格點 {cell['lat']:.3f}, {cell['lon']:.3f}，年平均 {mean:,.0f} m³/s"
              f"（HydroRIVERS {river['Q']:,.0f}，比 {mean / river['Q']:.2f}），最大 {peak + 1} 月、最小 {low + 1} 月，"
              f"差 {months[peak] / max(months[low], 0.01):.1f} 倍")
        if fetched and river is not todo[-1]:
            time.sleep(PAUSE)
    cells: dict[tuple[float, float], str] = {}
    for r in rows:
        other = cells.setdefault((round(r["lat"], 3), round(r["lon"], 3)), r["z"])
        if other != r["z"]:
            raise RuntimeError(f"{r['z']} 跟 {other} 用了同一個格點 {r['lat']}, {r['lon']}")
    if missing:
        print(f"  今天的 Open-Meteo 額度用完了，還有 {len(missing)} 條沒抓：{'、'.join(r['zh'] for r in missing)}；明天（UTC）再跑一次")
    if not rows:
        return
    rows.sort(key=lambda r: -r["q"])
    fields = ["lon", "lat", "z", "e", "g", "c", "q", "pk", "lo", "s", "r", "t", "hq"] + [f"m{i}" for i in range(1, 13)]
    scale = {"lon": 0.001, "lat": 0.001, "g": 1, "q": 0.1, "pk": 1, "lo": 1, "s": 1, "r": 0.1, "t": 1, "hq": 0.1,
             **{f"m{i}": 0.1 for i in range(1, 13)}}
    write_json(OUT / "flow.json", {
        "generatedAt": now_iso(), "years": [FIRST, LAST], "model": f"GloFAS v4 consolidated reanalysis（Open-Meteo {MODEL}）",
        "complete": not missing, **points_file(rows, fields, scale, strings=("z", "e", "c")),
    })
    # 指標檔：國家不上色，只放附註（河口在這一國的河）
    notes, notes_en = {}, {}
    for r in sorted(rows, key=lambda r: -r["q"]):
        zh = (f"{r['z']}年平均每秒 {r['q']:,.0f} 立方公尺，{r['pk']} 月最多、{r['lo']} 月最少"
              f"（{r['m' + str(r['pk'])]:,.0f} 對 {r['m' + str(r['lo'])]:,.0f}，差 {r['r']:.1f} 倍）")
        en = (f"{r['e']}: {r['q']:,.0f} m³/s a year on average, highest in {calendar.month_name[r['pk']]} and lowest in "
              f"{calendar.month_name[r['lo']]} ({r['m' + str(r['pk'])]:,.0f} against {r['m' + str(r['lo'])]:,.0f}, {r['r']:.1f} times)")
        notes.setdefault(r["c"], []).append(zh)
        notes_en.setdefault(r["c"], []).append(en)
    head = f"河口附近的月平均流量（GloFAS 模式模擬，{FIRST}–{LAST} 年）："
    head_en = f"Monthly mean flow near the mouth (GloFAS model simulation, {FIRST}–{LAST}): "
    write_json(OUT / "flow-years.json", indicator_file(
        "flow", "", [YEAR], {},
        notes={c: head + "；".join(v) + "。" for c, v in notes.items()},
        notesEn={c: head_en + "; ".join(v) + "." for c, v in notes_en.items()},
    ))
    print(f"  輸出 {len(rows)} 條河{'' if not missing else f'（還缺 {len(missing)} 條）'}；季節差最大："
          + "、".join(f"{r['z']} {r['r']:.0f} 倍" for r in sorted(rows, key=lambda r: -r["r"])[:5]))


if __name__ == "__main__":
    build()
