"""鐵路：歐洲鐵路的準點率、速度分級與單雙線、員工與開放競爭（2026-11-05，製作手冊第二十三批 407〔候選 1000、1004、1005〕；
步驟 rail-europe，輸出 topics/transport/，擴充「鐵路」）。使用者 2026-11-05 決定先只做歐洲，台灣放側欄附註。

- **準點率、員工、市占**：歐盟執委會第 9 次鐵路市場監測報告（RMMS，2025-07-30）的資料與圖表檔（CC BY 4.0，執委會法律聲明）。
  工作表 115（區域與近郊客運）、116（長途與高鐵）是 2018–2022 年的準點率（0–1 的小數，缺值寫成 FALSE）；89 是鐵路業的員工
  （基礎設施管理者加鐵路業者，2018、2022 年）；80、81 是競爭業者在貨運（延噸公里）、商業客運（延人公里）的市占（2022 年）。
  每張表找「Member state」那一列當表頭，往下讀到不是兩個字母的國家代碼為止。
  2026-11-06 加：工作表 57（區域與近郊客運列車）、61（1,000 總噸貨運列車）的軌道使用費（不含加價 mark-ups，每列車公里
  歐元，2018、2022 年），119 的貨運準點率（2022 年，國內、國際各一欄；之前以為四捨五入到 10% 一級，其實是精確值）。
  德國、法國這類主要靠加價收費的國家，「不含加價」的使用費看起來很低，說明寫明。
  「準點」的定義各國自己訂（誤點門檻 5、10、15 分鐘，取消的班次算不算也不清楚），說明寫明。
- **單雙線、速度分級**：Eurostat rail_if_line_tr（軌道數：單線 1、雙線以上 GE2）、rail_if_line_sp（常規、專用高速 RL_DHSPD、
  升級為高速 RL_UHSPD），CC BY 4.0。雙線以上 ÷ 合計、高速（專用＋升級）÷ 合計；合計跟分項加總差超過 2% 的年份不用。
  照網站的 Eurostat 規則，英國與科索沃不收。
- **台灣**：臺鐵「車種及線別準點率統計資料」（data.gov.tw 146628，政府資料開放授權條款第 1 版），只有 2021-06 到 2022-10，
  定義（誤點 5 分鐘以內）跟歐洲不同，不上色，最近一個月的各車種、線別放側欄。
"""
from __future__ import annotations

import csv
import re

import openpyxl

from common import OUT_DIR, download, indicator_file, write_json
from sources import eurostat
from sources.eurostat import _iso3 as eurostat_iso3

OUT = OUT_DIR / "topics" / "transport"
RMMS_URL = ("https://transport.ec.europa.eu/document/download/0eb4541a-96f8-469d-a5ce-e0802a7f5bc1_en"
            "?filename=9th%20RMMS%20package%20data%20and%20figures.xlsx")
TRA_URL = "https://ods.railway.gov.tw/tra-ods-web/ods/download/dataResource/8ae4cac27d4c47e7017d50b45f1300d2"
EXCLUDED = {"GBR", "XKX"}
TOLERANCE = 0.02


def _rmms_sheet(wb, name: str) -> tuple[list[int], dict[str, list[float | None]]]:
    """表頭那一列的年份（「… 2018 [%]」）與 {ISO3: [值…]}"""
    rows = list(wb[name].iter_rows(values_only=True))
    head_i = next(i for i, r in enumerate(rows) if len(r) > 1 and r[1] == "Member state")
    head = rows[head_i]
    cols = [(j, int(m.group(1))) for j, h in enumerate(head) if isinstance(h, str) and (m := re.search(r"(\d{4}) \[", h))]
    out = {}
    for r in rows[head_i + 1:]:
        code = r[1] if len(r) > 1 else None
        if not isinstance(code, str) or not re.fullmatch(r"[A-Z]{2}", code):
            break
        iso3 = eurostat_iso3(code)
        if not iso3 or iso3 in EXCLUDED:
            continue
        out[iso3] = [r[j] if isinstance(r[j], (int, float)) and not isinstance(r[j], bool) else None for j, _ in cols]
    return [y for _, y in cols], out


def _share(total: dict, part: dict, years: list[int]) -> dict[str, list[float | None]]:
    out = {}
    for c, s in total.items():
        if c in EXCLUDED:
            continue
        row = [round(part[c][y] / s[y] * 100, 1) if s.get(y) and y in part.get(c, {}) else None for y in years]
        if any(v is not None for v in row):
            out[c] = row
    return out


def build() -> None:
    wb = openpyxl.load_workbook(download(RMMS_URL, "rmms", "rmms-9.xlsx"), data_only=True, read_only=True)
    for sheet, key in (("115", "rail-punctual-regional"), ("116", "rail-punctual-long")):
        years, vals = _rmms_sheet(wb, sheet)
        values = {c: [round(v * 100, 1) if v is not None else None for v in row] for c, row in vals.items()}
        write_json(OUT / f"{key}.json", indicator_file(key, "%", years, values, license="CC BY 4.0"))
        print(f"  {key} {years[0]}–{years[-1]}：{sorted(((v[-1], c) for c, v in values.items() if v[-1] is not None), reverse=True)}")
    years, vals = _rmms_sheet(wb, "89")
    write_json(OUT / "rail-employees.json", indicator_file("rail-employees", "人", years, vals))
    print(f"  員工 {years}：{sorted(((v[-1], c) for c, v in vals.items() if v[-1] is not None), reverse=True)[:8]}")
    for sheet, key in (("80", "rail-competition-freight"), ("81", "rail-competition-passenger")):
        years, vals = _rmms_sheet(wb, sheet)
        values = {c: [round(v * 100, 1) if v is not None else None for v in row] for c, row in vals.items()}
        write_json(OUT / f"{key}.json", indicator_file(key, "%", years, values))
        print(f"  {key} {years}：{sorted(((v[-1], c) for c, v in values.items() if v[-1] is not None), reverse=True)}")

    for sheet, key in (("57", "rail-access-regional"), ("61", "rail-access-freight")):
        years, vals = _rmms_sheet(wb, sheet)
        vals = {c: [round(v, 2) if v else None for v in row] for c, row in vals.items()}
        vals = {c: row for c, row in vals.items() if any(v is not None for v in row)}
        write_json(OUT / f"{key}.json", indicator_file(key, "歐元/列車公里", years, vals, license="CC BY 4.0"))
        print(f"  {key} {years}：{sorted(((v[-1], c) for c, v in vals.items() if v[-1] is not None), reverse=True)}")
    _, vals = _rmms_sheet(wb, "119")
    domestic = {c: [round(row[0] * 100, 1)] for c, row in vals.items() if row[0] is not None}
    hints = {c: f"國際貨運 {row[1] * 100:.1f}%" for c, row in vals.items() if row[1] is not None}
    hints_en = {c: f"International freight {row[1] * 100:.1f}%" for c, row in vals.items() if row[1] is not None}
    write_json(OUT / "rail-punctual-freight.json", indicator_file(
        "rail-punctual-freight", "%", [2022], domestic, license="CC BY 4.0", hints=hints, hintsEn=hints_en))
    print(f"  貨運準點（國內）2022：{sorted(((v[0], c) for c, v in domestic.items()), reverse=True)}")
    print(f"  國際：{sorted(((round(row[1] * 100, 1), c) for c, row in vals.items() if row[1] is not None), reverse=True)}")

    tr_total = eurostat.series("rail_if_line_tr", freq="A", unit="KM", tra_infr="TOTAL", n_tracks="TOTAL")
    tr_one = eurostat.series("rail_if_line_tr", freq="A", unit="KM", tra_infr="TOTAL", n_tracks="1")
    tr_two = eurostat.series("rail_if_line_tr", freq="A", unit="KM", tra_infr="TOTAL", n_tracks="GE2")
    for c in list(tr_two):  # 合計跟單線＋雙線差太多的年份不用
        for y in list(tr_two[c]):
            t, a = tr_total.get(c, {}).get(y), tr_one.get(c, {}).get(y)
            if not t or a is None or abs(a + tr_two[c][y] - t) > TOLERANCE * t:
                del tr_two[c][y]
    years = sorted({y for s in tr_total.values() for y in s if y >= 1990})
    double = _share(tr_total, tr_two, years)
    write_json(OUT / "rail-double-track.json", indicator_file("rail-double-track", "%", years, double, latestWithin=5))
    sp_total = eurostat.series("rail_if_line_sp", freq="A", unit="KM", tra_infr="TOTAL")
    sp_parts = {k: eurostat.series("rail_if_line_sp", freq="A", unit="KM", tra_infr=k) for k in ("RL_CV", "RL_DHSPD", "RL_UHSPD")}
    hs: dict[str, dict[int, float]] = {}
    for c, s in sp_total.items():
        for y, t in s.items():
            parts = [sp_parts[k].get(c, {}).get(y) for k in sp_parts]
            if any(p is None for p in parts) or abs(sum(parts) - t) > TOLERANCE * t:
                continue
            hs.setdefault(c, {})[y] = parts[1] + parts[2]
    sp_years = sorted({y for s in sp_total.values() for y in s})
    high = _share(sp_total, hs, sp_years)
    write_json(OUT / "rail-highspeed-share.json", indicator_file("rail-highspeed-share", "%", sp_years, high, latestWithin=5))
    last = lambda v: next((x for x in reversed(v) if x is not None), None)  # noqa: E731
    print(f"  雙線以上 {len(double)} 國：{sorted(((last(v), c) for c, v in double.items()), reverse=True)}")
    print(f"  高速 {len(high)} 國：{sorted(((last(v), c) for c, v in high.items()), reverse=True)[:12]}")

    with open(download(TRA_URL, "tra", "punctuality-146628.csv"), encoding="utf-8-sig", newline="") as f:
        tra = list(csv.DictReader(f))
    month = max((int(r["年別"]), int(r["月份"])) for r in tra)
    latest = [[r["車種"], r["線別"], float(r["準點率"].rstrip("%"))] for r in tra if (int(r["年別"]), int(r["月份"])) == month]
    write_json(OUT / "rail-punctual-tw.json", {"month": f"{month[0]}-{month[1]:02d}", "first": "2021-06", "rows": latest})
    print(f"  臺鐵 {month}：{latest}")
