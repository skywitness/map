"""機隊的規模與年齡（2026-11-05，製作手冊第二十三批 400；步驟 air-fleet，輸出 topics/aviation/，擴充「航線與航空公司」）。

- **民航機隊架數與航空公司家數**：CIA World Factbook 2022-12-29 那一版（sources/factbook_2022.py，公有領域）的
  「National air transport system」：inventory of registered aircraft operated by air carriers（188 檔）、number of
  registered air carriers（191 檔），多數是 2020 年。之後的版本把整節刪了。同一節的旅客與貨運跟現有的指標重複，不用。
- **20 年以上的老飛機占機隊的比例**：Eurostat avia_eq_arc_age（依營運國，CC BY 4.0）2000–2025 年，age=Y_GE20 ÷ TOTAL；
  機隊不到 10 架的年份不算（蒙特內哥羅 4 架、北馬其頓與波士尼亞 0 架）。照網站的 Eurostat 規則，英國（只到 2019 年）與
  科索沃不收。全球的平均機齡沒有可用的來源（Planespotters 是商業網站自己算的，ch-aviation、Cirium 要付費，OpenSky 的
  條款待確認），所以只有歐洲。
- **台灣**：民航局「國籍航空器登記架數及機型」（data.gov.tw 19797，政府資料開放授權條款第 1 版）索引 CSV 指到的最新
  一個月的 ODS：每家公司的機型與架數，放側欄。Factbook 的台灣是 216 架、7 家（2020 年），地圖照 Factbook 畫。

輸出：fleet-aircraft.json、old-aircraft.json、fleet-detail.json（側欄：各國 Eurostat 最近一年的五個機齡層架數，
與台灣民航局的逐家公司機型）。
"""
from __future__ import annotations

import csv
import re
import zipfile
import xml.etree.ElementTree as ET

from common import OUT_DIR, download, indicator_file, write_json
from sources import eurostat, factbook_2022

OUT = OUT_DIR / "topics" / "aviation"
CAA_INDEX = "https://www.caa.gov.tw/FileAtt.ashx?lang=1&id=41639"
FLEET_YEAR = 2020
AGES = ["Y_LT5", "Y5-9", "Y10-14", "Y15-19", "Y_GE20"]
MIN_FLEET = 10
EXCLUDE = {"GBR", "XKX"}  # 網站的 Eurostat 規則
_T = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
_P = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}p"


def _factbook() -> tuple[dict[str, float], dict[str, float], dict[str, int]]:
    """機隊架數、航空公司家數、資料年份"""
    fleet, carriers, years = {}, {}, {}
    for iso3, t in factbook_2022.transportation().items():
        nats = t.get("National air transport system", {})
        a, ay = factbook_2022.number((nats.get("inventory of registered aircraft operated by air carriers") or {}).get("text"))
        c, cy = factbook_2022.number((nats.get("number of registered air carriers") or {}).get("text"))
        if a is not None:
            fleet[iso3] = a
            years[iso3] = ay or cy or FLEET_YEAR
        if c is not None:
            carriers[iso3] = c
    return fleet, carriers, years


def _ods_rows(path) -> list[list[str]]:
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("content.xml"))
    rows = []
    for row in next(root.iter(_T + "table")).iter(_T + "table-row"):
        cells: list[str] = []
        for cell in row:
            n = min(int(cell.get(_T + "number-columns-repeated", "1")), 32)
            cells.extend([" ".join("".join(p.itertext()) for p in cell.iter(_P)).strip()] * n)
        rows.append(cells)
    return rows


def taiwan_registry() -> dict:
    """民航局最新一個月：{month: '2026-08', total, companies: [[公司, 架數, [[機型, 架數], …]], …]}"""
    index = download(CAA_INDEX, "caa", "aircraft-registry-index.csv").read_text(encoding="utf-8-sig")
    rows = [r for r in csv.DictReader(index.splitlines()) if r.get("路徑")]
    latest = rows[-1]
    m = re.match(r"(\d+)年(\d+)月", latest["版本"])
    year, month = int(m.group(1)) + 1911, int(m.group(2))
    path = download(latest["路徑"], "caa", f"aircraft-registry-{year}-{month:02d}.ods")
    companies, cur, typ = [], None, None
    for r in _ods_rows(path)[3:]:
        r = (r + [""] * 12)[:12]
        regs = [c for c in r[2:6] if re.fullmatch(r"B-\d+", c)]
        if r[0] and not r[0].startswith(("合計", "總計", "註", "說明")):
            cur = [r[0], 0, []]
            companies.append(cur)
            subtotal = next((c for c in reversed(r) if re.fullmatch(r"\d+", c)), None)
            cur[1] = int(subtotal) if subtotal else 0
        elif r[0]:
            break
        if cur is None:
            continue
        if r[1]:
            typ = [r[1], 0]
            cur[2].append(typ)
        if typ is not None:
            typ[1] += len(regs)
    for c in companies:
        counted = sum(n for _, n in c[2])
        if c[1] != counted:
            raise RuntimeError(f"民航局 {latest['版本']} 的 {c[0]}：小計 {c[1]} 跟數出來的編號 {counted} 不一樣，表的格式可能變了")
    return {"month": f"{year}-{month:02d}", "total": sum(c[1] for c in companies), "companies": companies, "source": latest["路徑"]}


def build() -> None:
    fleet, carriers, fyears = _factbook()
    hints = {c: f"{carriers[c]:.0f} 家航空公司" for c in fleet if c in carriers}
    hints_en = {c: f"{carriers[c]:.0f} airline{'s' if carriers[c] != 1 else ''}" for c in fleet if c in carriers}
    for c, y in fyears.items():
        if y != FLEET_YEAR:
            hints[c] = f"{hints.get(c, '')}（{y} 年）".lstrip()
            hints_en[c] = f"{hints_en.get(c, '')} ({y})".lstrip()
    write_json(OUT / "fleet-aircraft.json", indicator_file(
        "fleet-aircraft", "架", [FLEET_YEAR], {c: [v] for c, v in fleet.items()}, hints=hints, hintsEn=hints_en))

    bands = {a: eurostat.series("avia_eq_arc_age", freq="A", age=a, unit="NR") for a in AGES}
    total = eurostat.series("avia_eq_arc_age", freq="A", age="TOTAL", unit="NR")
    years = sorted({y for s in total.values() for y in s})
    share, detail = {}, {}
    for c, s in total.items():
        if c in EXCLUDE:
            continue
        row = [round(bands["Y_GE20"][c][y] / t * 100, 1) if t >= MIN_FLEET and y in bands["Y_GE20"].get(c, {}) else None
               for y in years for t in [s.get(y, 0)]]
        if any(v is not None for v in row):
            share[c] = row
            last = max(y for y in s if s[y] >= MIN_FLEET)
            detail[c] = {"year": last, "ages": [bands[a].get(c, {}).get(last) for a in AGES], "total": s[last]}
    write_json(OUT / "old-aircraft.json", indicator_file("old-aircraft", "%", years, share))
    tw = taiwan_registry()
    write_json(OUT / "fleet-detail.json", {"ages": AGES, "eurostat": detail, "taiwan": tw})

    top = sorted(fleet.items(), key=lambda kv: -kv[1])
    print(f"  Factbook 機隊 {len(fleet)} 國、航空公司 {len(carriers)} 國；最多 {[(c, int(v)) for c, v in top[:16]]}")
    print(f"  台灣 {fleet.get('TWN')} 架、{carriers.get('TWN')} 家；不是 {FLEET_YEAR} 年的 {[(c, y) for c, y in fyears.items() if y != FLEET_YEAR][:20]}")
    latest = {c: v[-1] for c, v in share.items() if v[-1] is not None}
    print(f"  老飛機 {len(share)} 國，{years[0]}–{years[-1]}；{years[-1]} 年 {sorted(latest.items(), key=lambda kv: -kv[1])}")
    print(f"  民航局 {tw['month']}：{tw['total']} 架，{[(c[0], c[1]) for c in tw['companies']]}")
