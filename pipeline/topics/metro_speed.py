"""網路速度的擴充：都會區之間的網速差距（2026-11-07，製作手冊第二十七批 591，候選 1312；步驟 metro-speed，
輸出 topics/internet-speed/）。

- OECD Internet speed - Cities and FUAs（`OECD.CFE.EDS,DSD_FUA_DIGI@DF_INTERNET_SPEED,1.2`，sdmx.oecd.org，OECD 資料條款／
  CC BY 4.0；原始資料是 Ookla），2019–2025。**數值是「相對全國平均的百分比」（UNIT_MEASURE=PT_NAT，例如 +31.4 是比全國平均快
  31.4%），不是 Mbps**，所以只能比同一國的都會區。TERRITORIAL_LEVEL 有 CITY 與 FUA（功能性都會區）兩套，重疊，只用 FUA。
- 指標：這一國最快的都會區比最慢的快幾倍 =（100＋最高）÷（100＋最低），固網、行動的下載，至少 5 個都會區的國家才算。
- 側欄：這一國最快與最慢各 5 個都會區。都會區沒有座標（OECD 另有 FUA 的邊界檔），沒有做點圖層。
- 國碼：歐洲用兩碼加數字（AT0、DE1、EL0＝希臘、UK0／UK5＝英國），其他用 ISO3（AUS、USA…）。
- 台灣：OECD 的分區不含台灣。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import oecd
from sources.countries import from_alpha2, to_iso3

OUT = OUT_DIR / "topics" / "internet-speed"
FLOW = "OECD.CFE.EDS,DSD_FUA_DIGI@DF_INTERNET_SPEED,1.2"
MIN_AREAS = 5
SHOWN = 5
NETWORKS = {"FBB": "fixed", "MBB": "mobile"}


def _iso3(code: str) -> str | None:
    head = code[:3]
    if to_iso3(head):
        return to_iso3(head)
    two = {"EL": "GR", "UK": "GB"}.get(code[:2], code[:2])
    return from_alpha2(two)


def build() -> None:
    data: dict[str, dict[str, dict[str, dict[int, float]]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    names: dict[str, str] = {}
    for r in oecd.rows(FLOW):
        if r["TERRITORIAL_LEVEL"] != "FUA" or r["MEASURE"] != "DOWN_SPEED" or not r["OBS_VALUE"]:
            continue
        c = _iso3(r["REF_AREA"])
        if not c:
            continue
        net = NETWORKS[r["NETWORK_TYPE"]]
        data[net][c][r["REF_AREA"]][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
        names[r["REF_AREA"]] = r["Reference area"]
    years = sorted({y for net in data.values() for areas in net.values() for s in areas.values() for y in s})
    no_tw = ({"TWN": "OECD 的都會區分區不含台灣"}, {"TWN": "OECD’s metropolitan areas do not include Taiwan"})
    detail: dict = {"years": years, "names": names, "countries": {}}
    for net, by_country in data.items():
        ratio = {}
        for c, areas in by_country.items():
            row = []
            for y in years:
                vals = [s[y] for s in areas.values() if y in s]
                row.append(round((100 + max(vals)) / (100 + min(vals)), 3) if len(vals) >= MIN_AREAS else None)
            if any(v is not None for v in row):
                ratio[c] = row
            for i, y in enumerate(years):
                ranked = sorted(((s[y], a) for a, s in areas.items() if y in s), reverse=True)
                if len(ranked) < MIN_AREAS:
                    continue
                top = ranked[:SHOWN] + (ranked[-SHOWN:] if len(ranked) > SHOWN else [])
                detail["countries"].setdefault(c, {}).setdefault(net, {})[str(y)] = [[a, v] for v, a in top]
        write_json(OUT / "metro-gap" / f"{net}.json", indicator_file(
            f"metro-gap-{net}", "倍", years, {c: r for c, r in sorted(ratio.items())}, noValue=no_tw[0], noValueEn=no_tw[1],
            license="CC BY 4.0"))
        last = years[-1]
        v = sorted(((r[-1], c) for c, r in ratio.items() if r[-1] is not None), reverse=True)
        print(f"  {net} {last}：{len(v)} 國；{v[:8]} … {v[-6:]}")
        for c in ("USA", "JPN", "KOR", "DEU", "FRA", "GBR", "MEX"):
            if c in by_country:
                ranked = sorted(((s[last], names[a]) for a, s in by_country[c].items() if last in s), reverse=True)
                print(f"    {c} {len(ranked)} 個：最快 {ranked[:2]} 最慢 {ranked[-2:]}")
    write_json(OUT / "metro-gap" / "areas.json", detail)
