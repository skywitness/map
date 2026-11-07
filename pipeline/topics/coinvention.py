"""研發與創新的擴充：發明是自己做的還是跟外國人一起做的、有在創新的企業拿了多少補助（2026-11-07，製作手冊第二十七批 601，
候選 1326、1327；步驟 coinvention，輸出 topics/innovation/）。

- OECD Patents with foreign co-inventors（`OECD.STI.PIE,DSD_PATENTS@DF_PATENTS_COINVENTOR,1.0`，OECD 資料條款／CC BY 4.0）。
  整檔超過 700 MB，一定要用維度篩選（11 個維度給滿）。照手冊固定：美國專利商標局（US50）、優先權年（PRIORITY）、
  專利申請（AP）、合作型態 CO、技術領域不分（WIPO、OECD_TECHNOLOGY_PATENT 都是 _Z）。PARTNER_AREA 的 W 是這國發明人
  參與的全部專利、WXD 是有外國共同發明人的、逐國是跟那一國合作的件數（一件可以有好幾國）。
  - 占比＝WXD ÷ W；手冊的陷阱：小國只有一兩件，比例極不穩，W 至少 MIN_PATENTS 件才上色。
  - 流向（2010 年起每年一個檔）：每一國前 15 個共同發明的夥伴。
  - 優先權年最近 2–3 年的件數會被低估（還在審），說明寫明。
- OECD Business Innovation Indicators（Innostat，`OECD.STI.STP,DSD_INNOSTAT@DF_INNOENT` 與 `@DF_INNOSUPP`）：
  CIS 規範的產業（BTE_G46_H_J_K_M71T73）、全部規模（10 人以上）、不分研發，占全部企業的 %（PT_ENT）。
  - 創新活躍企業（INN，含還在做、沒做成的），不跟「創新企業」（INNOSLO）混用。
  - 拿到政府資金或研發／創新租稅優惠的企業（ENT_SUPP）。
  - 兩三年一次的調查，年份對不齊，前端用各國最近一年（latestWithin）。台灣不在 46 個經濟體裡。
"""
from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "innovation"
BASE = "https://sdmx.oecd.org/public/rest/data/"
TOTALS_URL = BASE + "OECD.STI.PIE,DSD_PATENTS@DF_PATENTS_COINVENTOR,1.0/US50.A.AP.PATN.PRIORITY..W+WXD._Z.CO._Z._Z?format=csvfile"
FLOW_START = 2010
PARTNERS_URL = BASE + f"OECD.STI.PIE,DSD_PATENTS@DF_PATENTS_COINVENTOR,1.0/US50.A.AP.PATN.PRIORITY..._Z.CO._Z._Z?startPeriod={FLOW_START}&format=csvfile"
INNOENT_URL = BASE + "OECD.STI.STP,DSD_INNOSTAT@DF_INNOENT,1.0/all?format=csvfile"
INNOSUPP_URL = BASE + "OECD.STI.STP,DSD_INNOSTAT@DF_INNOSUPP,1.0/all?format=csvfile"
MIN_PATENTS = 20
TOP = 15
LICENSE = "CC BY 4.0"
CIS = "BTE_G46_H_J_K_M71T73"
NO_TW_PAT = ({}, {})
NO_TW_CIS = ({"TWN": "OECD 的企業創新調查（Innostat）沒有台灣"}, {"TWN": "Taiwan is not in the OECD business innovation statistics (Innostat)"})


def _rows(url: str, name: str):
    with open(download(url, "oecd", name), encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)


def _patents() -> None:
    total: dict[str, dict[int, float]] = defaultdict(dict)
    foreign: dict[str, dict[int, float]] = defaultdict(dict)
    for r in _rows(TOTALS_URL, "patents_coinventor_totals.csv"):
        c = to_iso3(r["REF_AREA"])
        if not c or r["OBS_VALUE"] == "":
            continue
        (total if r["PARTNER_AREA"] == "W" else foreign)[c][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    years = sorted({y for v in total.values() for y in v})
    share = {c: [round(foreign[c].get(y, 0) / t[y] * 100, 3) if t.get(y, 0) >= MIN_PATENTS else None for y in years]
             for c, t in sorted(total.items())}
    share = {c: s for c, s in share.items() if any(v is not None for v in s)}
    write_json(OUT / "coinvention-share.json", indicator_file("coinvention-share", "%", years, share, license=LICENSE))

    partners: dict[int, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for r in _rows(PARTNERS_URL, f"patents_coinventor_partners_{FLOW_START}.csv"):
        c, p = to_iso3(r["REF_AREA"]), r["PARTNER_AREA"]
        if not c or p in ("W", "WXD") or to_iso3(p) != p or p == c or r["OBS_VALUE"] == "":
            continue
        partners[int(r["TIME_PERIOD"])][c].append([p, int(round(float(r["OBS_VALUE"])))])
    fyears = sorted(partners)
    counts = {c: [foreign[c].get(y) for y in fyears] for c in sorted(foreign) if any(foreign[c].get(y) for y in fyears)}
    write_json(OUT / "coinvented.json", indicator_file("coinvention-partners", "件", fyears, counts, license=LICENSE))
    for y in fyears:
        flows = {c: [int(foreign[c].get(y, 0)), sorted(rows, key=lambda x: (-x[1], x[0]))[:TOP]]
                 for c, rows in sorted(partners[y].items()) if foreign[c].get(y)}
        write_json(OUT / "coinvention-flows" / f"{y}.json",
                   {"item": "coinvention", "year": y, "unit": "件", "scale": 1, "export": flows, "import": {}}, quiet=True)

    last = years[-1]
    rank = sorted(((c, s[-1], total[c][last]) for c, s in share.items() if s[-1] is not None), key=lambda x: -x[1])
    print(f"  有外國共同發明人的專利占比 {last}（{len(rank)} 國，W ≥ {MIN_PATENTS}）：" + "、".join(f"{c} {v:.1f}%" for c, v, _ in rank[:8]))
    for c in ("IRL", "SGP", "CHE", "IND", "GBR", "USA", "CHN", "TWN", "JPN", "KOR"):
        print(f"    {c} {share[c][-1]:.2f}%（{total[c][last]:,.0f} 件）")
    print(f"  流向 {fyears[0]}–{fyears[-1]}；台灣 {last} 的夥伴：{partners[last]['TWN'] and sorted(partners[last]['TWN'], key=lambda x: -x[1])[:5]}")


def _innostat(url: str, name: str, measure: str, unit: str) -> dict[str, dict[int, float]]:
    out: dict[str, dict[int, float]] = defaultdict(dict)
    for r in _rows(url, name):
        if (r["MEASURE"], r["UNIT_MEASURE"], r["ACTIVITY"], r["SIZE_CLASS"], r["RD"]) != (measure, unit, CIS, "_T", "_T"):
            continue
        c = to_iso3(r["REF_AREA"])
        if c and r["OBS_VALUE"] != "":
            out[c][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    return out


def _innovation() -> None:
    for key, url, name, measure in (
        ("innovation-active", INNOENT_URL, "innostat_innoent.csv", "INN"),
        ("innovation-support", INNOSUPP_URL, "innostat_innosupp.csv", "ENT_SUPP"),
    ):
        data = _innostat(url, name, measure, "PT_ENT")
        years = sorted({y for v in data.values() for y in v})
        write_json(OUT / f"{key}.json", indicator_file(
            key, "%", years, {c: [round(v[y], 3) if y in v else None for y in years] for c, v in sorted(data.items())},
            latestWithin=5, noValue=NO_TW_CIS[0], noValueEn=NO_TW_CIS[1], license=LICENSE))
        latest = sorted(((c, max(v), v[max(v)]) for c, v in data.items()), key=lambda x: -x[2])
        print(f"  {key}（{len(latest)} 國）：" + "、".join(f"{c} {v:.1f}%（{y}）" for c, y, v in latest))


def build() -> None:
    _patents()
    _innovation()
