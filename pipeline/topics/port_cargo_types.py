"""航運與港口的擴充：港口裝的是什麼——散裝、貨櫃、滾裝（2026-11-07，製作手冊第二十七批 580，候選 1298；步驟 port-cargo-types，
輸出 topics/shipping/）。

- Eurostat `mar_mg_am_cwhc`（主要港口的海運貨物依貨型，千公噸與占全部的 %，1997 年起，CC BY 4.0）：液體散貨 LBK、
  乾散貨 DBK、大型貨櫃 LCNT（貨櫃裡的貨重，不是 TEU，不跟 UNCTAD 的 TEU 混用）、自走滾裝 RO_MSP、非自走滾裝 RO_MNSP、
  其他 OTH、不明 UNK。維度是 rep_mar（申報國）不是 geo，所以自己讀檔。英國照網站的規則不收。
- 台灣：臺灣港務公司「國際商港貨物裝卸量」（政府資料開放平臺 8367，`fapi/opendata?id=13877`，政府資料開放授權條款）的
  國際貨櫃貨、散雜貨、管道貨，每月，2001 年起。三分類跟 Eurostat 的六分類對不起來（散雜貨含乾散貨與雜貨），只放側欄。
- 貨類（2026-11-08 補）：`mar_mg_am_cwhg` 的 NST 2007 貨類群，各國最近一年的第一大貨類（不算不明 GT19 與其他 GT20），
  不明貨物超過四成的國家不畫（愛爾蘭 89%、比利時 48% 等）。
- 候選 1301（World Port Index 多讀設施欄位）：NGA 網站 2026-11-07 仍是 HTTP 503，這個 cloud 的快取也沒有那個檔，
  請本機 session 提供，之後再做。
"""
from __future__ import annotations

import csv
import gzip
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "shipping"
CARGO = {"LBK": "liquid-bulk", "DBK": "dry-bulk", "LCNT": "containers", "RO_MSP": "roro-self", "RO_MNSP": "roro-other", "OTH": "other"}
TWPORT = "https://www.twport.com.tw/fapi/opendata?id=13877&format=csv"


def _load() -> tuple[dict, list[int]]:
    path = download(eurostat.URL.format(dataset="mar_mg_am_cwhc"), "eurostat", "mar_mg_am_cwhc.tsv.gz")
    out: dict[tuple[str, str, str], dict[int, float]] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        dims = header[0].split("\\")[0].split(",")
        years = [int(h) for h in header[1:]]
        for line in f:
            cells = line.rstrip("\n").split("\t")
            key = dict(zip(dims, cells[0].split(",")))
            geo = key["rep_mar"]
            iso3 = None if eurostat.noncommercial(geo) else eurostat._iso3(geo)
            if not iso3 and geo != "EU27_2020":
                continue
            values = {}
            for y, cell in zip(years, cells[1:]):
                number = cell.strip().split(" ")[0]
                if number not in (":", ""):
                    values[y] = float(number)
            out[(key["cargo"], key["unit"], iso3 or geo)] = values
    return out, years


# NST 2007 的貨類群（mar_mg_am_cwhg）→ 類別圖的代碼；GT19（不明，多半是貨櫃裡的貨）與 GT20（其他）不當「第一大貨類」
NST = {"GT02": 1, "GT07": 2, "GT03": 3, "GT01": 4, "GT06": 5, "GT18": 6}
NST_ZH = {"GT01": "農林漁產品", "GT02": "煤、原油與天然氣", "GT03": "金屬礦與其他礦產", "GT04": "食品", "GT06": "木材與紙",
          "GT07": "焦炭與石油製品", "GT08": "化學品", "GT09": "非金屬礦物製品", "GT10": "基本金屬", "GT18": "併裝的雜貨"}
MAX_UNKNOWN = 40  # 不明貨物超過四成的國家不畫


def main_goods() -> None:
    """Eurostat mar_mg_am_cwhg（主要港口的貨物依 NST 2007 貨類群，千公噸，2008 年起）：各國最近一年的第一大貨類"""
    path = download(eurostat.URL.format(dataset="mar_mg_am_cwhg"), "eurostat", "mar_mg_am_cwhg.tsv.gz")
    data: dict[tuple[str, str], dict[int, float]] = defaultdict(dict)
    with gzip.open(path, "rt", encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        dims = header[0].split("\\")[0].split(",")
        years = [int(h) for h in header[1:]]
        for line in f:
            cells = line.rstrip("\n").split("\t")
            key = dict(zip(dims, cells[0].split(",")))
            geo = key["rep_mar"]
            iso3 = None if eurostat.noncommercial(geo) else eurostat._iso3(geo)
            if key["unit"] != "THS_T" or not iso3:
                continue
            for y, cell in zip(years, cells[1:]):
                number = cell.strip().split(" ")[0]
                if number not in (":", ""):
                    data[(iso3, key["nst07"])][y] = float(number)
    values, hints, hints_en, nv, nv_en = {}, {}, {}, {}, {}
    last = max(y for s in data.values() for y in s)
    for c in sorted({c for c, _ in data}):
        y = max(y for (cc, _), s in data.items() if cc == c for y in s)
        allv = {g: s.get(y, 0) for (cc, g), s in data.items() if cc == c}
        total = sum(allv.values())
        unknown = allv.get("GT19", 0) / total * 100 if total else 100
        known = {g: v for g, v in allv.items() if g not in ("GT19", "GT20") and v > 0}
        if not known or unknown > MAX_UNKNOWN:
            nv[c] = f"不明貨物占 {unknown:.0f}%，看不出第一大貨類"
            nv_en[c] = f"{unknown:.0f}% of goods unidentified, so no main group is shown"
            continue
        g = max(known, key=known.get)
        if g not in NST:
            raise RuntimeError(f"{c} 的第一大貨類 {g} 不在 NST 對照表裡，先加類別")
        values[c] = [NST[g]]
        yr = "" if y == last else f"（{y} 年）"
        hints[c] = f"{NST_ZH.get(g, g)}占 {known[g] / total * 100:.0f}%，不明貨物 {unknown:.0f}%{yr}"
        hints_en[c] = f"{known[g] / total * 100:.0f}% of tonnage, {unknown:.0f}% unidentified" + (f" ({y})" if y != last else "")
    write_json(OUT / "port-main-goods.json", indicator_file("port-main-goods", "類別", [last], values, hints=hints, hintsEn=hints_en,
                                                            noValue=nv, noValueEn=nv_en, license="CC BY 4.0"))
    print(f"  第一大貨類（{last}）：{len(values)} 國；" + "、".join(f"{c} {v[0]}" for c, v in values.items()) + f"；不畫 {sorted(nv)}")


def build() -> None:
    main_goods()
    data, years = _load()
    countries = sorted({c for _, _, c in data if c != "EU27_2020"})
    for code, item in CARGO.items():
        values = {}
        for c in countries:
            s = data.get((code, "PC_TOT", c), {})
            if s:
                values[c] = [round(s[y], 1) if y in s else None for y in years]
        write_json(OUT / "port-cargo-type" / f"{item}.json", indicator_file(
            f"port-cargo-{item}", "%", years, values, noValue={"TWN": "台灣港務公司的分類對不起來，見側欄"},
            noValueEn={"TWN": "Taiwan’s port statistics use different classes; see the side panel"}, license="CC BY 4.0"))
    detail = {c: {item: [data.get((code, "THS_T", c), {}).get(y) for y in years] for code, item in CARGO.items()}
              for c in countries + ["EU27_2020"]}

    # 台灣：國際商港合計，每年（只收全年的）
    rows = list(csv.DictReader(open(download(TWPORT, "twport", "cargo-handling.csv"), encoding="utf-8-sig")))
    tw: dict[int, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
    months: dict[int, set] = defaultdict(set)
    for r in rows:
        if r["港口別"] != "國際商港":
            continue
        y = int(r["年月"][:4])
        months[y].add(r["年月"][4:])
        for i, k in enumerate(("國際貨櫃貨", "散雜貨", "管道貨")):
            tw[y][i] += float(r[k] or 0)
    tw_years = sorted(y for y in tw if len(months[y]) == 12)
    write_json(OUT / "port-cargo-detail.json", {
        "years": years, "countries": detail,
        "tw": {"years": tw_years, "values": [[round(v / 1000) for v in tw[y]] for y in tw_years]},  # 千公噸
        "license": "CC BY 4.0"})

    eu = {item: data.get((code, "THS_T", "EU27_2020"), {}).get(2024) for code, item in CARGO.items()}
    print(f"  EU27 2024 千公噸：{eu}；合計 {data.get(('TOTAL', 'THS_T', 'EU27_2020'), {}).get(2024)}")
    lb = sorted(((data.get(('LBK', 'PC_TOT', c), {}).get(2024) or 0, c) for c in countries), reverse=True)[:10]
    print(f"  液體散貨比例 2024：{lb}")
    print(f"  台灣 {tw_years[0]}–{tw_years[-1]}：2025 {[round(v / 1000) for v in tw[2025]]}")
