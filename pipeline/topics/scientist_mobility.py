"""科學家往哪裡去：科研人力的國際流動（新主題，2026-11-07，製作手冊第二十七批 600，候選 1325；步驟 scientist-mobility，
輸出 topics/scientist-mobility/）。

- OECD Bibliometric indicators of implied bilateral mobility flows（`OECD.STI.STP,DSD_BIBLIO_F@DF_BIBLIO_F,1.0`，
  sdmx.oecd.org，OECD 資料條款／CC BY 4.0；OECD 用 Elsevier 的 Scopus Custom Data 算的）。
- 資料流的說明（DSD 的 Description）：2010–2024 年在 Scopus 至少有兩篇論文的作者，比較第一篇與最後一篇的主要掛名國家，
  不同就算一次流動；中間待過的國家不算；一個人最多算一次，所以單位是人（PS）。不到 10 人的雙邊流動不公布。
  沒有 TIME_PERIOD，只有這一期，所以沒有時間軸（年份標 2024，指標都是 timeless）。
- 流入、流出是所有雙邊流動的加總（含已經不存在的塞爾維亞與蒙特內哥羅 SCG_F、荷屬安地列斯 ANT_F，這兩個地圖畫不出來，
  不放進流向的夥伴）；淨流入＝流入 − 流出；淨流入的比例＝淨流入 ÷（流入＋流出），進出至少 1,000 人的國家才算。
"""
from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "scientist-mobility"
URL = "https://sdmx.oecd.org/public/rest/data/OECD.STI.STP,DSD_BIBLIO_F@DF_BIBLIO_F,1.0/all?format=csvfilewithlabels"
YEAR = 2024
MIN_MOVES = 1000
TOP = 15
LICENSE = "CC BY 4.0"


def build() -> None:
    path = download(URL, "oecd", "biblio_mobility_flows.csv")
    flows: dict[tuple[str, str], float] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            assert r["MEASURE"] == "BILAT_AUT" and r["UNIT_MEASURE"] == "PS", r
            if r["ORIGIN"] != r["DESTINATION"] and r["OBS_VALUE"]:
                flows[(r["ORIGIN"], r["DESTINATION"])] = float(r["OBS_VALUE"])
    out: dict[str, float] = defaultdict(float)
    inn: dict[str, float] = defaultdict(float)
    for (o, d), v in flows.items():
        out[o] += v
        inn[d] += v
    codes = {c for c in set(out) | set(inn) if to_iso3(c) == c}
    dropped = sorted((set(out) | set(inn)) - codes)
    print(f"  {len(flows):,} 條雙邊流動、{len(codes)} 個國家；畫不出來的代碼 {dropped}")

    def file(name: str, unit: str, values: dict[str, float]) -> dict:
        return indicator_file(name, unit, [YEAR], {c: [v] for c, v in sorted(values.items())}, license=LICENSE)

    net = {c: inn[c] - out[c] for c in codes}
    write_json(OUT / "net.json", file("scientists-net", "人", net))
    write_json(OUT / "inflow.json", file("scientists-in", "人", {c: inn[c] for c in codes if inn[c]}))
    write_json(OUT / "outflow.json", file("scientists-out", "人", {c: out[c] for c in codes if out[c]}))
    balance = {c: round(net[c] / (inn[c] + out[c]) * 100, 3) for c in codes if inn[c] + out[c] >= MIN_MOVES}
    write_json(OUT / "balance.json", file("scientists-balance", "%", balance))

    by_origin: dict[str, list] = defaultdict(list)
    by_dest: dict[str, list] = defaultdict(list)
    for (o, d), v in flows.items():
        if o in codes and d in codes:
            by_origin[o].append([d, int(v)])
            by_dest[d].append([o, int(v)])

    def top(rows: list) -> list:
        return sorted(rows, key=lambda x: (-x[1], x[0]))[:TOP]

    write_json(OUT / "flows.json", {
        "item": "scientists", "year": YEAR, "unit": "人", "scale": 1,
        "export": {c: [int(out[c]), top(by_origin[c])] for c in sorted(by_origin)},
        "import": {c: [int(inn[c]), top(by_dest[c])] for c in sorted(by_dest)},
    })

    rank = sorted(net.items(), key=lambda x: -x[1])
    print("  淨流入最多：" + "、".join(f"{c} {v:+,.0f}" for c, v in rank[:8]))
    print("  淨流出最多：" + "、".join(f"{c} {v:+,.0f}" for c, v in rank[-8:][::-1]))
    print(f"  台灣：流入 {inn['TWN']:,.0f}、流出 {out['TWN']:,.0f}、淨 {net['TWN']:+,.0f}（{balance['TWN']:+.2f}%）")
    b = sorted(balance.items(), key=lambda x: -x[1])
    print(f"  淨流入比例（進出 ≥ {MIN_MOVES:,} 人，{len(b)} 國）最高：" + "、".join(f"{c} {v:+.1f}%" for c, v in b[:6])
          + "；最低：" + "、".join(f"{c} {v:+.1f}%" for c, v in b[-6:][::-1]))
