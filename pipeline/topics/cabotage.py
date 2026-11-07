"""新主題「歐洲路上的外國卡車：cabotage」（2026-11-07，製作手冊第二十七批 578，候選 1294；步驟 cabotage，
輸出 topics/cabotage/）。

cabotage 是外國的卡車在另一國境內做的國內運輸（例如波蘭的卡車在德國境內從漢堡運到慕尼黑）。
- Eurostat `road_go_ca_c`（在哪一國境內做的 cabotage，千延噸公里，1999 年起）與 `road_go_ca_hac`（申報國＝卡車的國籍
  geo × 做 cabotage 的國家 c_cabot），CC BY 4.0。輸出成百萬延噸公里。手冊的陷阱：cabotage 只含「外國卡車在他國境內的
  國內運輸」，跨國運輸是另一組資料集（road_go_ia_*），這裡不混；申報國只有 35 個。
- 流向圖：一年一個流向檔，export 是卡車的國籍 → 在哪些國家做（申報國的 WORLD 是總量），import 是做 cabotage 的國家 →
  哪些國籍的卡車。英國、科索沃照 sources/eurostat.py 一律不收（英國境內 2025 年 1,469 百萬延噸公里只寫在說明）；
  EU15、EU27 這類合計與 WORLD、UNK 不當國家；歐洲以外、公路到不了的零星申報（北非、中東、代碼不明的 CG、CR）不畫。
- 台灣沒有（台灣沒有陸路跨國運輸）。
"""
from __future__ import annotations

import gzip

from common import OUT_DIR, download, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "cabotage"
TOP_PARTNERS = 15
# 公路連得到的歐洲與周邊國家（ISO alpha-2，Eurostat 的 EL 是希臘）；其他的零星申報不畫
REACHABLE = set("""AD AL AM AT AZ BA BE BG BY CH CY CZ DE DK EE EL ES FI FR GE GI HR HU IE IT KG KZ LI LT LU LV MC MD ME MK MT
NL NO PL PT RO RS RU SE SI SK SM TR UA UZ""".split())


def _load(dataset: str) -> dict[tuple[str, ...], dict[int, float]]:
    path = download(eurostat.URL.format(dataset=dataset), "eurostat", f"{dataset}.tsv.gz")
    rows = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        dims = header[0].split("\\")[0].split(",")
        years = [int(h) for h in header[1:]]
        for line in f:
            cells = line.rstrip("\n").split("\t")
            key = dict(zip(dims, cells[0].split(",")))
            if key["unit"] != "THS_TKM":
                continue
            values = {}
            for y, cell in zip(years, cells[1:]):
                number = cell.strip().split(" ")[0]
                if number not in (":", ""):
                    values[y] = float(number) / 1000  # 千延噸公里 → 百萬延噸公里
            rows[tuple(key[d] for d in dims if d not in ("freq", "unit"))] = values
    return rows


def _iso3(code: str) -> str | None:
    return None if eurostat.noncommercial(code) else eurostat._iso3(code)


def build() -> None:
    done_in = {}  # 在這國境內做的 cabotage
    for (cc,), s in _load("road_go_ca_c").items():
        if (iso3 := _iso3(cc)) and cc in REACHABLE:
            done_in[iso3] = s
    hac = _load("road_go_ca_hac")
    by_haulier = {}  # 這國的卡車在外國做的 cabotage（WORLD）
    flows: dict[int, dict[str, dict[str, float]]] = {}
    for (cc, geo), s in hac.items():
        origin = _iso3(geo)
        if not origin:
            continue
        if cc == "WORLD":
            by_haulier[origin] = s
            continue
        dest = _iso3(cc) if cc in REACHABLE else None
        if not dest or dest == origin:
            continue
        for y, v in s.items():
            if v > 0:
                flows.setdefault(y, {}).setdefault(origin, {})[dest] = v
    years = sorted({y for s in done_in.values() for y in s})
    write_json(OUT / "cabotage-in.json", indicator_file(
        "cabotage-in", "百萬延噸公里", years, {c: [round(s[y], 1) if y in s else None for y in years] for c, s in sorted(done_in.items())},
        noValue={"TWN": "台灣沒有陸路的跨國運輸"}, noValueEn={"TWN": "Taiwan has no cross-border road transport"}, license="CC BY 4.0"))
    years_out = sorted({y for s in by_haulier.values() for y in s})
    write_json(OUT / "cabotage-out.json", indicator_file(
        "cabotage-out", "百萬延噸公里", years_out, {c: [round(s[y], 1) if y in s else None for y in years_out] for c, s in sorted(by_haulier.items())},
        noValue={"TWN": "台灣沒有陸路的跨國運輸"}, noValueEn={"TWN": "Taiwan has no cross-border road transport"}, license="CC BY 4.0"))
    for y, by_origin in sorted(flows.items()):
        exp, imp = {}, {}
        for o, dests in by_origin.items():
            partners = sorted(([d, round(v, 1)] for d, v in dests.items() if round(v, 1) > 0), key=lambda p: -p[1])
            if partners:
                total = by_haulier.get(o, {}).get(y) or sum(p[1] for p in partners)
                exp[o] = [round(total, 1), partners[:TOP_PARTNERS]]
            for d, v in dests.items():
                if round(v, 1) > 0:
                    imp.setdefault(d, []).append([o, round(v, 1)])
        imp = {d: [round(done_in.get(d, {}).get(y) or sum(p[1] for p in ps), 1), sorted(ps, key=lambda p: -p[1])[:TOP_PARTNERS]]
               for d, ps in imp.items()}
        write_json(OUT / "flows" / f"{y}.json", {"item": "cabotage", "year": y, "unit": "百萬延噸公里", "scale": 1,
                                                 "export": dict(sorted(exp.items())), "import": dict(sorted(imp.items()))})
    write_json(OUT / "manifest.json", {"years": years, "flowYears": sorted(flows)})

    for c in ("DEU", "FRA", "ITA", "ESP", "BEL", "SWE", "NLD", "AUT", "NOR"):
        s = done_in.get(c, {})
        print(f"  {c} 境內 {s.get(1999)} → {s.get(2025)}")
    print(f"  2025 德國境內的卡車國籍：{sorted(flows[2025] and ((v, o) for o, d in flows[2025].items() for k, v in d.items() if k == 'DEU'), reverse=True)[:8]}")
    out = sorted(((s.get(2025, 0), c) for c, s in by_haulier.items()), reverse=True)[:8]
    print(f"  2025 在外國做最多的卡車國籍：{out}")
