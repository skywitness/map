"""台灣的中醫（新主題，2026-11-08，製作手冊第二十九批 689，候選 866、1575；步驟 taiwan-tcm，輸出 topics/taiwan-tcm/）。

衛生福利部統計處的統計表（政府資料開放授權條款第 1 版；下載見 sources/mohw_tables.py）：
- 表 1.6「醫療院所家數」工作表「院所數」：民國 78 年起每年底的中醫醫院（G 欄）、中醫診所（Q 欄），對照西醫醫院（D 欄）、西醫診所（N 欄）。
- 表 1.7「機構執業醫事人員數」：最新一年底各縣市的中醫師（D 欄）、西醫師（C 欄）；第二張工作表是每萬人口。
- 表 2.2.2「藥商家數按鄉鎮市區別分」：每個縣市一張工作表，第 13 列「總計」是那個縣市；中藥販賣業＝藥事法第 28 條二項小計（O 欄）
  ＋第 103 條小計（T 欄）。
- 表 3.3.8「中醫總額門診醫療費用申報狀況」：每年一張工作表，民國 105 年起有人數（B 欄）、件數（C 欄，千件），男在 F、G 欄，
  女在 J、K 欄；104 年以前的欄位不同，不用。
- 表 3.2.8、3.2.6：最新一年的中醫、西醫門診件數（總計列的男、女），算女性是男性的幾倍。
縣市的位置用 divisions 步驟輸出的台灣縣市標籤點（public/data/divisions/TWN.json 的 u1）。
"""
from __future__ import annotations

import json

import openpyxl

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import mohw_tables

OUT = OUT_DIR / "topics" / "taiwan-tcm"


def _num(x) -> float | None:
    return float(x) if isinstance(x, (int, float)) else None


def institutions() -> dict[int, dict[str, int]]:
    path, _, _ = mohw_tables.table("5301", "1.6", "醫療院所家數")
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True)["院所數"]
    head = next(ws.iter_rows(min_row=4, max_row=4, values_only=True))
    assert "中" in (head[6] or "") and "中" in (head[16] or "") and "西" in (head[3] or "") and "西" in (head[13] or ""), head
    out = {}
    for r in ws.iter_rows(min_row=6, values_only=True):
        if isinstance(r[0], str) and r[0].strip().endswith("年") and _num(r[1]) is not None:
            y = mohw_tables.roc(r[0].strip().rstrip("年").strip())
            out[y] = {"tcm_h": int(r[6]), "tcm_c": int(r[16]), "west_h": int(r[3]), "west_c": int(r[13])}
    return out


def physicians() -> tuple[int, dict[str, dict]]:
    path, _, _ = mohw_tables.table("5301", "1.7", "醫事人員")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws, ws2 = wb.worksheets[0], wb.worksheets[1]
    year = mohw_tables.roc(str(next(ws.iter_rows(min_row=2, max_row=2, values_only=True))[0]).strip("民國年底"))
    head = next(ws.iter_rows(min_row=4, max_row=4, values_only=True))
    assert head[2] == "西醫師" and head[3] == "中醫師", head
    per = {}
    head2 = next(ws2.iter_rows(min_row=4, max_row=4, values_only=True))
    assert head2[3] == "西醫師" and head2[4] == "中醫師", head2
    for r in ws2.iter_rows(min_row=9, values_only=True):
        if isinstance(r[0], str) and _num(r[1]):
            per[r[0].replace("　", "").strip()] = (float(r[4]), float(r[3]), int(r[1]))
    out = {}
    for r in ws.iter_rows(min_row=9, values_only=True):
        if not isinstance(r[0], str) or _num(r[3]) is None:
            continue
        name = r[0].replace("　", "").strip()
        out[name] = {"tcm": int(r[3]), "west": int(r[2]), "tcm_per": per[name][0], "west_per": per[name][1], "pop": per[name][2]}
    return year, out


def herb_dealers() -> dict[str, int]:
    path, _, _ = mohw_tables.table("5301", "2.2.2", "藥商")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out = {}
    for ws in wb.worksheets:
        r = next(ws.iter_rows(min_row=13, max_row=13, values_only=True))
        assert r[0] == "總計", (ws.title, r[0])
        out[ws.title.strip()] = int(r[14]) + int(r[19])
    return out


def outpatients() -> dict[int, dict[str, float]]:
    path, _, _ = mohw_tables.table("5223", "3.3.8", "中醫總額")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out = {}
    for name in wb.sheetnames:
        if not name.strip().isdigit() or int(name) < 105:
            continue
        ws = wb[name]
        rows = list(ws.iter_rows(min_row=1, max_row=12, values_only=True))
        assert "人數" in str(rows[6][1]) and "件數" in str(rows[6][2]), (name, rows[6][:3])
        tot = next(r for r in rows if r[0] and str(r[0]).replace(" ", "").startswith("總計"))
        out[mohw_tables.roc(name)] = {"persons": int(tot[1]), "cases": round(float(tot[2]) * 1000), "m": int(tot[5]), "f": int(tot[9])}
    return out


def _sex_ratio(number: str, must: str) -> tuple[int, int, int, int]:
    """最新一年的門診件數（總計、男、女），回傳（西元年、總計、男、女）"""
    path, _, _ = mohw_tables.table("5223", number, must)
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    title = str(next(ws.iter_rows(min_row=1, max_row=1, values_only=True))[0])
    year = mohw_tables.roc(title.split("民國")[1].split("年")[0])
    for r in ws.iter_rows(min_row=5, max_row=20, values_only=True):
        if r[0] and str(r[0]).startswith("總計"):
            return year, int(r[7]), int(r[8]), int(r[9])
    raise RuntimeError(f"表 {number} 找不到總計列")


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    inst = institutions()
    years = sorted(inst)
    first, last = years[0], years[-1]
    write_json(OUT / "hospitals.json", indicator_file("hospitals", "家", years, {"TWN": [inst[y]["tcm_h"] for y in years]}))
    write_json(OUT / "clinics.json", indicator_file("clinics", "家", years, {"TWN": [inst[y]["tcm_c"] for y in years]}))

    py, phys = physicians()
    herb = herb_dealers()
    divisions = json.loads((OUT_DIR / "divisions" / "TWN.json").read_text(encoding="utf-8"))["u1"]
    where = {u[1]: (u[7][0], u[7][1], u[2]) for u in divisions}
    rows = []
    for name, p in phys.items():
        if name == "總計":
            continue
        lon, lat, en = where[name]
        rows.append({"lon": lon, "lat": lat, "c": name, "en": en, "dr": p["tcm"], "drp": round(p["tcm_per"], 2), "wd": p["west"],
                     "herb": herb[name]})
    assert len(rows) == 22 and set(herb) == {r["c"] for r in rows}, (len(rows), set(herb) ^ {r["c"] for r in rows})
    rows.sort(key=lambda r: -r["dr"])
    write_points(OUT / "counties.json", points_file(rows, ["lon", "lat", "dr", "drp", "wd", "herb", "c", "en"],
                                                    {"lon": 0.001, "lat": 0.001, "dr": 1, "drp": 0.01, "wd": 1, "herb": 1}), ("c", "en"))
    tot = phys["總計"]
    write_json(OUT / "physicians.json", indicator_file("physicians", "人", [py], {"TWN": [tot["tcm"]]}))
    write_json(OUT / "herb-dealers.json", indicator_file("herb-dealers", "家", [py], {"TWN": [sum(herb.values())]}))

    op = outpatients()
    oy = sorted(op)
    write_json(OUT / "patients.json", indicator_file("patients", "人", oy, {"TWN": [op[y]["persons"] for y in oy]}))
    write_json(OUT / "visits.json", indicator_file("visits", "件", oy, {"TWN": [op[y]["cases"] for y in oy]}))

    ty, tt, tm, tf = _sex_ratio("3.2.8", "中醫")
    wy, wt, wm, wf = _sex_ratio("3.2.6", "西醫")
    print(f"  中醫醫院 {first} {inst[first]['tcm_h']} → {last} {inst[last]['tcm_h']}；中醫診所 {inst[first]['tcm_c']:,} → {inst[last]['tcm_c']:,}；"
          f"西醫醫院 {inst[first]['west_h']} → {inst[last]['west_h']}、西醫診所 {inst[first]['west_c']:,} → {inst[last]['west_c']:,}")
    peak = max(years, key=lambda y: inst[y]["tcm_h"])
    print(f"    中醫醫院最多 {peak} 年 {inst[peak]['tcm_h']} 家；" + "、".join(f"{y} {inst[y]['tcm_h']}" for y in years if y % 5 == 0 or y >= 2020))
    print(f"  {py} 年底中醫師 {tot['tcm']:,}（每萬人 {tot['tcm_per']:.2f}）、西醫師 {tot['west']:,}（{tot['tcm'] / tot['west']:.1%}）；"
          + "、".join(f"{r['c']} {r['dr']:,}" for r in rows[:6]) + "；每萬人最高 "
          + "、".join(f"{r['c']} {r['drp']}" for r in sorted(rows, key=lambda r: -r['drp'])[:4]) + "；最低 "
          + "、".join(f"{r['c']} {r['drp']}" for r in sorted(rows, key=lambda r: r['drp'])[:3]))
    print(f"  中藥販賣業 {sum(herb.values()):,}：" + "、".join(f"{c} {v:,}" for c, v in sorted(herb.items(), key=lambda kv: -kv[1])[:6]))
    print("  中醫門診（3.3.8）：" + "、".join(f"{y} {op[y]['persons']:,} 人 {op[y]['cases']:,} 件" for y in oy))
    o = op[oy[-1]]
    print(f"    {oy[-1]} 每人平均 {o['cases'] / o['persons']:.2f} 件；女性人數占 {o['f'] / o['persons']:.1%}")
    print(f"  門診件數（3.2.8／3.2.6）：中醫 {ty} {tt:,}（男 {tm:,}、女 {tf:,}，女是男的 {tf / tm:.2f} 倍）；西醫 {wy} {wt:,}（女是男的 {wf / wm:.2f} 倍）；"
          f"中醫是西醫的 {tt / wt:.1%}")
