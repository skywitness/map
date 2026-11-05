"""航運與港口的擴充：商船隊的船齡與艘數、港口的效率（2026-11-05，製作手冊第二十三批 401〔候選 997、996〕；
步驟 shipping-efficiency，輸出 topics/shipping/）。

- **船齡與艘數**：UNCTADstat US.MerchantFleet（CC BY 3.0 IGO，「航運與港口」已經在下載，只用了載重噸）沒用過的
  「Number of ships」「Average age of vessels (years)」，2011–2026（每年 1 月 1 日）。平均船齡是**依艘數的簡單平均**，
  幾艘老拖船、渡輪就能拉高小國，所以地圖只畫那一年 100 艘以上的經濟體（手冊的建議），艘數寫在 hint。100 總噸以上的
  商船，不含漁船、軍艦、遊艇。
- **貨櫃港效率指數（CPPI）**：世界銀行 The Container Port Performance Index 2025 的資料附件（CC BY-NC 3.0 IGO，
  **只准非商業使用**；使用者 2026-11-05 決定照 WHO 死因資料的方式標示後使用）。426 個貨櫃港，分數是標準化後的值、
  不是小時數，只能跟同年的其他港比；國家的值是那一國分數最高的港。港口座標用 World Port Index（UN/LOCODE、
  shipping.py 的對照表、名稱，同 PLSCI 的做法）。
- **船舶在港時間**：UNCTADstat US.PortCalls 的「Median time in port (days)」全船型，2018–2023，只有 18 個經濟體
  （沒有台灣）。原始資料是 AIS，UNCTAD 只公布彙總值，這裡也只用彙總值。
"""
from __future__ import annotations

import urllib.error
from collections import defaultdict

import openpyxl

from common import OUT_DIR, download, indicator_file, points_file, to_series, write_json
from sources import unctadstat, wpi
from sources.countries import from_alpha2
from topics.shipping import PLSCI_TO_WPI, _norm

OUT = OUT_DIR / "topics" / "shipping"
CPPI_URL = "https://openknowledge.worldbank.org/bitstreams/9cf20807-7dcd-4de7-9de2-fdb2d0589a73/download"
CPPI_YEAR = 2025
MIN_SHIPS = 100
SHIP_TYPES = {"1": "oil", "2": "bulk", "3": "general", "4": "container", "5": "other"}
# CPPI 的港口 UN/LOCODE 跟 World Port Index 對不上的（WPI 用舊代碼或沒有代碼）：補在 PLSCI 的對照表上
CPPI_TO_WPI: dict[str, int] = {}


def _fleet() -> tuple[dict, dict, list[int]]:
    rows = unctadstat.rows("US.MerchantFleet")
    age_col, ships_col = "Average age of vessels (years)", "Number of ships"
    age: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    ships: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for r in rows:
        code = r["Economy"]
        key = "WLD" if code == unctadstat.WORLD else unctadstat.iso3(code)
        if not key:
            continue
        t = "all" if r["ShipType"] == "0" else SHIP_TYPES.get(r["ShipType"])
        if not t:
            continue
        y = int(r["Year"])
        a, n = unctadstat.number(r[age_col]), unctadstat.number(r[ships_col])
        if a is not None:
            age[key][t][y] = a
        if n is not None:
            ships[key][t][y] = n
    years = sorted({y for s in age.values() for y in s.get("all", {})})
    return age, ships, years


def _cppi(ports: list) -> tuple[list[dict], dict[str, tuple[float, str]]]:
    path = download(CPPI_URL, "worldbank", "cppi-2025.xlsx")
    ws = openpyxl.load_workbook(path, data_only=True, read_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    head = list(rows[0])
    col = {name: head.index(name) for name in head if name}
    by_locode = {p.locode: p for p in ports if p.locode}
    by_name: dict[tuple[str, str], list] = defaultdict(list)
    for p in ports:
        for n in [p.name, *p.alternate.split(";")]:
            if k := _norm(n):
                by_name[(p.iso3, k)].append(p)
    points, best, missed = [], {}, []
    for r in rows[1:]:
        score = r[col[f"CPPI {CPPI_YEAR}"]]
        if score is None or not r[col["Port"]]:
            continue
        code = str(r[col["UN/LOCODE"]] or "")
        iso3 = from_alpha2(code[:2]) if code else None
        port = None
        if code in CPPI_TO_WPI or code in PLSCI_TO_WPI:
            num = CPPI_TO_WPI.get(code) or PLSCI_TO_WPI[code]
            port = next((p for p in ports if p.number == num), None)
        if port is None:
            port = by_locode.get(code)
        if port is None and iso3:
            cands = {p.number: p for p in by_name.get((iso3, _norm(str(r[col["Port"]]))), [])}
            port = next(iter(cands.values())) if len(cands) == 1 else None
        if port is None or not iso3:
            missed.append((round(score), r[col["Port"]], code))
            continue
        name = str(r[col["Port"]])
        rank = r[col[f"Rank {CPPI_YEAR}"]]
        calls = r[col["Number of calls in sample"]]
        points.append({
            "lon": port.lon, "lat": port.lat, "name": name, "code": code, "iso3": iso3,
            "cppi": round(score, 1), "rank": int(rank) if rank else None, "calls": int(calls) if calls else None,
        })
        if iso3 not in best or best[iso3][0] < score:
            best[iso3] = (round(score, 1), name)
    points.sort(key=lambda p: p["rank"] or 9999)
    print(f"  CPPI {CPPI_YEAR}：{len(points) + len(missed)} 個港有分數，對到 WPI {len(points)} 個；對不到 {missed[:12]}")
    return points, best


def _port_time() -> tuple[dict[str, list], list[int]]:
    rows = unctadstat.rows("US.PortCalls")
    col = "Median time in port (days)"
    out: dict[str, dict[int, float]] = defaultdict(dict)
    for r in rows:
        if r["CommercialMarket"] != "00" or not r[col].strip():
            continue
        key = "WLD" if r["Economy"] == unctadstat.WORLD else unctadstat.iso3(r["Economy"])
        if key:
            out[key][int(r["Year"])] = float(r[col])
    years = sorted({y for s in out.values() for y in s})
    return {k: to_series(v, years, 4) for k, v in out.items()}, years


def build() -> None:
    age, ships, years = _fleet()
    values, hints, hints_en = {}, {}, {}
    for c, s in age.items():
        if c == "WLD":
            continue
        n = ships[c].get("all", {})
        row = [s["all"].get(y) if n.get(y, 0) >= MIN_SHIPS else None for y in years]
        if any(v is not None for v in row):
            values[c] = row
            last = max(y for y in years if n.get(y, 0) >= MIN_SHIPS)
            hints[c] = f"{n[last]:,.0f} 艘（{last} 年）"
            hints_en[c] = f"{n[last]:,.0f} ships ({last})"
    nv = (f"那一年船隊不到 {MIN_SHIPS} 艘（平均船齡容易被幾艘老船拉高）", f"Fewer than {MIN_SHIPS} ships that year (a few old vessels can skew the average)")
    small = {c for c in age if c != "WLD" and c not in values and age[c].get("all")}
    write_json(OUT / "ship-age.json", indicator_file(
        "ship-age", "年", years, values, aggregates={"WLD": [age["WLD"]["all"].get(y) for y in years]},
        hints=hints, hintsEn=hints_en, noValue={c: nv[0] for c in small}, noValueEn={c: nv[1] for c in small}))
    detail = {}
    last = years[-1]
    for c in age:
        if c == "WLD" or not ships[c].get("all", {}).get(last):
            continue
        detail[c] = {
            "year": last,
            "types": {t: [ships[c].get(t, {}).get(last), age[c].get(t, {}).get(last)] for t in ["all", *SHIP_TYPES.values()]},
            "age": [age[c]["all"].get(y) for y in years],
        }
    detail["WLD"] = {"year": last, "types": {t: [ships["WLD"].get(t, {}).get(last), age["WLD"].get(t, {}).get(last)] for t in ["all", *SHIP_TYPES.values()]},
                     "age": [age["WLD"]["all"].get(y) for y in years]}

    port_time, pt_years = _port_time()
    world = port_time.pop("WLD", None)
    write_json(OUT / "port-time.json", indicator_file(
        "port-time", "天", pt_years, port_time, **({"aggregates": {"WLD": world}} if world else {})))
    write_json(OUT / "fleet-age-detail.json", {"years": years, "countries": detail})

    latest = {c: v[-1] for c, v in values.items() if v[-1] is not None}
    rk = sorted(latest.items(), key=lambda kv: kv[1])
    print(f"  船齡 {years[0]}–{years[-1]}：{len(values)} 個經濟體有 {MIN_SHIPS} 艘以上；世界 {age['WLD']['all'].get(last)} 年、{ships['WLD']['all'].get(last):,.0f} 艘")
    print(f"  最新 {rk[:8]}；最老 {rk[-8:]}")
    print(f"  台灣 {detail.get('TWN')}")
    print(f"  在港時間 {pt_years}：{len(port_time)} 國；{sorted(((v[-1], c) for c, v in port_time.items() if v[-1] is not None))}；世界 {world}")

    # CPPI 要 World Port Index 的港口座標；NGA 的網站 2026-11-05 一整天回 503，下載不到時先不做 CPPI（其他照常輸出）
    try:
        ports = wpi.load()
    except (urllib.error.URLError, ConnectionError, TimeoutError) as err:
        print(f"  World Port Index 下載不到（{err}），CPPI 這次沒有輸出")
        return
    points, best = _cppi(ports)
    write_json(OUT / "cppi-ports.json", points_file(
        points, ["lon", "lat", "name", "code", "iso3", "cppi", "rank", "calls"], {"lon": 0.001, "lat": 0.001, "cppi": 0.1},
        strings=["iso3"]))
    write_json(OUT / "cppi.json", indicator_file(
        "cppi", "", [CPPI_YEAR], {c: [v] for c, (v, _) in best.items()},
        hints={c: n for c, (_, n) in best.items()}, hintsEn={c: n for c, (_, n) in best.items()}, license="CC BY-NC 3.0 IGO"))
    print(f"  CPPI 國家最高分 {sorted(best.items(), key=lambda kv: -kv[1][0])[:8]}；台灣 {best.get('TWN')}")
