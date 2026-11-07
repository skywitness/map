"""交通基礎建設的投資與養護：錢花在鐵路還是公路（新主題，2026-11-07，製作手冊第二十七批 584，候選 1303；
步驟 transport-investment，輸出 topics/transport-investment/）。

- OECD／ITF「Transport infrastructure investment and maintenance spending」（`OECD.ITF,DSD_INFRINV@DF_INFRINV,1.0`，
  sdmx.oecd.org，CC BY 4.0），52 國、1995–2024。MEASURE：INV 投資、MNT 養護（CV 資本存量不用）；TRANSPORT_MODE：
  ROAD 公路、RAIL 鐵路、IWW 內河、MAR 海運（港口）、AIR 航空（機場）、TOT_INL 內陸合計（公路＋鐵路＋內河），
  MOTORWAYS 是公路的一部分，不另外畫。UNIT_MEASURE：EUR、XDC（本國幣）；PRICE_BASE：V 當年價格、Q 2015 年價格（歐元）。
- 地圖用當年價格的歐元（跟手冊的數字一致）；側欄的長序列用 2015 年價格的歐元（ITF 用本國的物價指數與 2015 年的匯率換算，
  不受匯率波動影響，手冊的陷阱）。占 GDP 用本國幣相除（世界銀行 NY.GDP.MKTP.CN），也不受匯率影響。
- 鐵路比例 = 鐵路 ÷（公路＋鐵路），同一年兩個都有值才算。各國最近一年差很多（latestWithin 5）。
- 烏茲別克的金額差了好幾個數量級，不收；0 當成沒有資料。
- 手冊的陷阱：各國「投資」涵蓋的範圍不同（有的含私人投資或地方政府，有的只有中央政府），說明寫明；中國只有公路與鐵路。
- 台灣：ITF 沒有台灣（灰色加 tooltip）。手冊提到的公共建設預算等替代來源口徑不同，這一版不做。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import oecd, worldbank

OUT = OUT_DIR / "topics" / "transport-investment"
FLOW = "OECD.ITF,DSD_INFRINV@DF_INFRINV,1.0"
MODES = ["ROAD", "RAIL", "IWW", "MAR", "AIR"]
NO_TW = ({"TWN": "ITF 沒有台灣的資料"}, {"TWN": "No data for Taiwan in the ITF database"})
LATEST = 5
EXCLUDE = {"UZB"}


def _series(measure: str, mode: str, unit: str = "EUR", price: str = "V") -> dict[str, dict[int, float]]:
    data, _ = oecd.series(FLOW, MEASURE=measure, TRANSPORT_MODE=mode, UNIT_MEASURE=unit, PRICE_BASE=price)
    # 烏茲別克的金額差了好幾個數量級（2021 年內陸投資 12 萬歐元），不收；
    # 0 當成沒有資料（亞塞拜然 2021–2024 年的鐵路投資是 0，多半是鐵路公司的投資不在申報範圍裡，不是真的沒投資）
    return {c: {y: v for y, v in s.items() if v > 0} for c, s in data.items() if c not in EXCLUDE and any(v > 0 for v in s.values())}


def _write(name: str, unit: str, data: dict[str, dict[int, float]], digits: int) -> list[int]:
    years = sorted({y for s in data.values() for y in s})
    write_json(OUT / f"{name}.json", indicator_file(
        name, unit, years, {c: [round(s[y], digits) if y in s else None for y in years] for c, s in sorted(data.items())},
        latestWithin=LATEST, noValue=NO_TW[0], noValueEn=NO_TW[1], license="CC BY 4.0"))
    return years


def build() -> None:
    inland = _series("INV", "TOT_INL")
    _write("inland-investment", "歐元", inland, 0)
    road, rail = _series("INV", "ROAD"), _series("INV", "RAIL")
    share = {c: {y: rail[c][y] / (rail[c][y] + road[c][y]) * 100 for y in rail[c] if y in road.get(c, {}) and rail[c][y] + road[c][y] > 0}
             for c in rail}
    _write("rail-share", "%", {c: s for c, s in share.items() if s}, 1)
    gdp, _ = worldbank.fetch("NY.GDP.MKTP.CN", 1995)
    local = _series("INV", "TOT_INL", unit="XDC")
    ratio = {c: {y: v / gdp[c][y] * 100 for y, v in s.items() if gdp.get(c, {}).get(y)} for c, s in local.items()}
    _write("investment-gdp", "%", {c: s for c, s in ratio.items() if s}, 2)
    road_mnt = _series("MNT", "ROAD")
    _write("road-maintenance", "歐元", road_mnt, 0)

    # 側欄：各運具的投資與養護（2015 年價格的歐元，百萬）
    years = sorted({y for s in inland.values() for y in s})
    detail: dict[str, dict] = {}
    for measure, key in (("INV", "inv"), ("MNT", "mnt")):
        for mode in MODES:
            for c, s in _series(measure, mode, price="Q").items():
                detail.setdefault(c, {}).setdefault(key, {})[mode.lower()] = [round(s[y] / 1e6, 1) if y in s else None for y in years]
    write_json(OUT / "detail.json", {"years": years, "modes": [m.lower() for m in MODES], "countries": detail, "license": "CC BY 4.0"})

    def at(d, c, y):
        return d.get(c, {}).get(y)
    print(f"  內陸投資 {len(inland)} 國；2023 年十億歐元：" + "、".join(
        f"{c} 公路 {at(road, c, 2023) and round(at(road, c, 2023) / 1e9, 2)} 鐵路 {at(rail, c, 2023) and round(at(rail, c, 2023) / 1e9, 2)}"
        for c in ("CHN", "DEU", "AUS", "FRA", "ITA", "JPN", "CHE")))
    latest = {c: s[max(s)] for c, s in share.items() if s and max(s) >= 2019}
    print(f"  鐵路比例 {len(latest)} 國（2019 年以後）：最高 {sorted(((round(v, 1), c) for c, v in latest.items()), reverse=True)[:10]}")
    print(f"  最低 {sorted((round(v, 1), c) for c, v in latest.items())[:8]}")
    lr = {c: (max(s), round(s[max(s)], 2)) for c, s in ratio.items() if s and max(s) >= 2019}
    print(f"  占 GDP：{sorted(((v, c, y) for c, (y, v) in lr.items()), reverse=True)[:10]}；低 {sorted((v, c, y) for c, (y, v) in lr.items())[:6]}")
    print(f"  公路養護 {len(road_mnt)} 國：{sorted(((round(s[max(s)] / 1e9, 2), c, max(s)) for c, s in road_mnt.items() if max(s) >= 2019), reverse=True)[:8]}")
