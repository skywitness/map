"""F1 賽道與冠軍（新主題，社會類，2026-10-30）：F1 世界錦標賽的賽道（點，大小是舉辦的分站數）、各國舉辦的分站數與車手冠軍數。

使用者決定（2026-10-30，製作手冊第一百零三節）：照做，Jolpica 只准非商業，頁尾寫明。

**資料**：Jolpica-F1（Ergast 的接手者）的資料庫匯出，延遲 14 天的版本不必登入
（https://api.jolpi.ca/data/dumps/download/delayed/?dump_type=csv ，轉到 S3 的 ZIP），條款 TERMS.md：「The API is freely
available for non-commercial use.」「The data is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0
International (CC BY-NC-SA 4.0)」：只准非商業、衍生的資料檔依同一授權分享（這個網站是非商業的，頁尾寫明）。
用到 formula_one_circuit.csv（賽道與經緯度、國家）、formula_one_round.csv（每一站的賽道、日期、是否取消）、
formula_one_driver.csv（車手與國籍）、formula_one_driverchampionship.csv（每一站之後的車手積分榜）。
- **分站**：沒有取消、日期不晚於匯出日的每一站算一次，算在賽道所在的國家（不是分站的名稱：在西班牙辦的歐洲大獎賽算西班牙）。
- **車手冠軍**：每一季最後一站之後的積分榜第 1 名，依車手登記的國籍（FIA 登記的，country_code）；還沒結束的這一季不算。
- **年份**：1950 年到匯出的那一年，都是累計到那一年年底。

**輸出**（public/data/topics/racing/，2026-10-30 起在「賽車」主題；之前跟奧運合成「運動」）：circuits.json（賽道的點：名稱、地點、國家、第一站與最後一站的年份、分站數）、
races.json（各國累計舉辦的分站數）、champions.json（各國籍累計的車手冠軍數）、champions-list.json（每年的冠軍，側欄用）。
"""
from __future__ import annotations

import csv
import io
import zipfile
from collections import Counter, defaultdict

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_manifest_part

OUT = OUT_DIR / "topics" / "racing"  # 賽車（2026-10-30 從「運動」搬過來）
DUMP_URL = "https://api.jolpi.ca/data/dumps/download/delayed/?dump_type=csv"
FIRST_YEAR = 1950


def _read(z: zipfile.ZipFile, name: str) -> list[dict[str, str]]:
    with z.open(f"formula_one_{name}.csv") as f:
        return list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")))


def build() -> None:
    z = zipfile.ZipFile(download(DUMP_URL, "jolpica", "dump.zip"))
    circuits = {r["id"]: r for r in _read(z, "circuit")}
    drivers = {r["id"]: r for r in _read(z, "driver")}
    standings = _read(z, "driverchampionship")
    # 匯出檔裡的日期都是 1999-01-01（固定的 ZIP 時間），比完的站以積分榜有的站為準（還沒比的站也在 round.csv 裡）
    done: dict[int, int] = {}
    for s in standings:
        done[int(s["year"])] = max(done.get(int(s["year"]), 0), int(s["round_number"] or 0))
    all_rounds = [r for r in _read(z, "round") if r["is_cancelled"] == "f" and r["date"]]
    season_rounds = Counter(int(r["date"][:4]) for r in all_rounds)
    rounds = [r for r in all_rounds if int(r["number"]) <= done.get(int(r["date"][:4]), 0)]
    last_date = max(r["date"] for r in rounds)
    last_year = max(int(r["date"][:4]) for r in rounds)
    years = list(range(FIRST_YEAR, last_year + 1))

    # ── 分站：依賽道的國家 ──
    per_circuit: dict[str, list[int]] = defaultdict(list)
    per_country: dict[str, Counter] = defaultdict(Counter)
    for r in rounds:
        y = int(r["date"][:4])
        c = circuits[r["circuit_id"]]
        per_circuit[r["circuit_id"]].append(y)
        per_country[c["country_code"]][y] += 1
    races = {iso3: [sum(n for k, n in c.items() if k <= y) for y in years] for iso3, c in per_country.items()}

    # ── 車手冠軍：每一季最後一站之後的第 1 名（還沒結束的這一季不算） ──
    champions: list[tuple[int, dict]] = []
    for s in standings:
        y = int(s["year"])
        if s["position"] == "1" and int(s["round_number"] or 0) == done[y] and done[y] >= season_rounds[y]:
            champions.append((y, drivers[s["driver_id"]]))
    champions.sort(key=lambda t: t[0])
    assert len({y for y, _ in champions}) == len(champions), "同一年有兩個冠軍"
    by_nat: dict[str, Counter] = defaultdict(Counter)
    for y, d in champions:
        by_nat[d["country_code"]][y] += 1
    champs = {iso3: [sum(n for k, n in c.items() if k <= y) for y in years] for iso3, c in by_nat.items()}

    rows = []
    for cid, ys in per_circuit.items():
        c = circuits[cid]
        rows.append({"lon": float(c["longitude"]), "lat": float(c["latitude"]), "name": c["name"], "loc": c["locality"],
                     "iso3": c["country_code"], "first": min(ys), "last": max(ys), "n": len(ys)})
    rows.sort(key=lambda r: r["first"])
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "circuits.json", points_file(rows, ["lon", "lat", "name", "loc", "iso3", "first", "last", "n"],
                                                  {"lon": 0.0001, "lat": 0.0001, "first": 1, "last": 1, "n": 1}))
    notes = {"TWN": "台灣沒有舉辦過 F1 分站，也沒有台灣籍的 F1 車手（Jolpica 的 881 位車手裡有 1 位中國籍）。"}
    notes_en = {"TWN": "Taiwan has never hosted a Formula One race and has had no Formula One driver (one of Jolpica’s 881 drivers is Chinese)."}
    write_json(OUT / "races.json", indicator_file("races", "站", years, races, notes=notes, notesEn=notes_en,
                                                  aggregates={"WLD": [sum(1 for r in rounds if int(r["date"][:4]) <= y) for y in years]}))
    write_json(OUT / "champions.json", indicator_file("champions", "次", years, champs, notes=notes, notesEn=notes_en))
    write_json(OUT / "champions-list.json", [[y, f"{d['forename']} {d['surname']}", d["country_code"]] for y, d in champions])
    write_manifest_part(OUT, "racing", "f1", {"lastRace": last_date, "lastChampionYear": champions[-1][0]})
    print(f"  比到 {last_date}：分站 {len(rounds)} 站（{years[0]}–{last_year}）、賽道 {len(rows)} 條、車手冠軍 {champions[0][0]}–{champions[-1][0]}（{len(champions)} 屆）")
    print(f"  分站最多：{sorted(((v[-1], c) for c, v in races.items()), reverse=True)[:6]}")
    print(f"  冠軍最多：{sorted(((v[-1], c) for c, v in champs.items()), reverse=True)[:6]}")
    print(f"  國籍 CHN 的車手：{sum(1 for d in drivers.values() if d['country_code'] == 'CHN')}；TWN：{sum(1 for d in drivers.values() if d['country_code'] == 'TWN')}；車手共 {len(drivers)}")


if __name__ == "__main__":
    build()
