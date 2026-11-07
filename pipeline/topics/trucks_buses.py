"""汽機車的擴充：卡車、貨車與公車（含電動卡車）（2026-11-07，製作手冊第二十七批 577，候選 1293；步驟 trucks-buses，
輸出 topics/road-safety/，汽機車的 dataTopic）。

- Eurostat `road_eqs_lormot`（貨車依載重與動力：LOR_GT3P5 3.5 公噸以上的重型卡車、VG_LE3P5 3.5 公噸以下的輕型貨車，
  2013 年起）與 `road_eqs_busveh`（大客車、遊覽車與無軌電車合計 TOTAL，1970 年起），CC BY 4.0；英國照 sources/eurostat.py
  不收。各國最近一年不一定一樣（法國到 2024 年），指標檔 latestWithin 1。
- 側欄：這一國那一年依動力的組成（柴油、汽油、CNG、LNG、電等）。
- 台灣：交通部統計查詢網的機動車輛登記數（表 100：1988–2012 年 8 月、表 101：2012 年 9 月起；map-plan 的 data/motc/，
  sources/motc.py）的小貨車、大貨車、大客車（年底的登記數）。台灣的大小貨車以總重 3.5 公噸分界（道路交通安全規則），
  跟 Eurostat 接近，但車種分類不完全相同（特種車另計），說明寫明。手冊說要請本機下載公路局 14208（stat.thb.gov.tw 403），
  其實 map-plan 已有交通部的表，不必再下載。台灣沒有依動力的統計（電動卡車）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat, motc

OUT = OUT_DIR / "topics" / "road-safety"
# 動力（代碼表 MOT_NRG）：DIE、PET 含油電混合，DIE_X_HYB、PET_X_HYB 不含；ALT 是替代能源的合計。互不重疊的分法：
# 柴油（不含混合）、汽油（不含混合）、電、油電混合（ELC_DIE_HYB＋ELC_PET_HYB）、天然氣（GAS，沒有時 CNG＋LNG）、LPG、其他；
# 德國 2025 年重型卡車加起來剛好等於 TOTAL 514,582。不含混合的沒有申報時用含混合的
ENERGY = {"diesel": (["DIE_X_HYB"], ["DIE"]), "petrol": (["PET_X_HYB"], ["PET"]), "electric": (["ELC"], []),
          "hybrid": (["ELC_DIE_HYB", "ELC_PET_HYB"], []), "gas": (["GAS"], ["CNG", "LNG"]), "lpg": (["LPG"], []),
          "other": (["OTH"], [])}
TWN_LAST = 2025


def _tw(column: str) -> dict[int, float]:
    old = motc.annual(motc.VEHICLES_TO_2012, column, "總計")
    new = motc.annual(motc.VEHICLES_FROM_2012, column, "車齡別總計")
    out = {y: v for y, v in old.items() if y < 2012}
    out.update({y: v for y, v in new.items() if y <= TWN_LAST})
    return out


def build() -> None:
    files = {
        "light-vans": eurostat.series("road_eqs_lormot", unit="NR", vehicle="VG_LE3P5", mot_nrg="TOTAL"),
        "heavy-trucks": eurostat.series("road_eqs_lormot", unit="NR", vehicle="LOR_GT3P5", mot_nrg="TOTAL"),
        "electric-trucks": eurostat.series("road_eqs_lormot", unit="NR", vehicle="LOR_GT3P5", mot_nrg="ELC"),
        "buses": eurostat.series("road_eqs_busveh", unit="NR", vehicle="TOTAL"),
    }
    tw = {"light-vans": _tw("小貨車"), "heavy-trucks": _tw("大貨車"), "buses": _tw("大客車")}
    note = ("交通部的機動車輛登記數（年底）；台灣的大小貨車以總重 3.5 公噸分界，車種分類跟 Eurostat 不完全相同",
            "Taiwan’s MOTC motor vehicle registrations (year end); Taiwan also splits lorries at 3.5 tonnes gross weight, but its vehicle classes differ somewhat from Eurostat’s")
    for name, data in files.items():
        if name in tw:
            data["TWN"] = tw[name]
        years = sorted({y for s in data.values() for y in s})
        extra = {"hints": {"TWN": note[0]}, "hintsEn": {"TWN": note[1]}} if name in tw else {
            "noValue": {"TWN": "台灣沒有依動力的貨車統計"}, "noValueEn": {"TWN": "Taiwan has no lorry statistics by motor energy"}}
        write_json(OUT / f"{name}.json", indicator_file(
            name, "輛", years, {c: [s.get(y) for y in years] for c, s in sorted(data.items())}, latestWithin=1,
            license="CC BY 4.0", **extra))

    # 側欄：依動力的組成
    energy = {}
    for veh, key in (("VG_LE3P5", "l"), ("LOR_GT3P5", "h")):
        raw = {code: eurostat.series("road_eqs_lormot", unit="NR", vehicle=veh, mot_nrg=code)
               for codes in ENERGY.values() for group in codes for code in group}
        for name, (main, fallback) in ENERGY.items():
            for c in {c for code in main + fallback for c in raw[code]}:
                use = main if any(c in raw[code] for code in main) else fallback
                s: dict[int, float] = {}
                for code in use:
                    for y, v in raw[code].get(c, {}).items():
                        s[y] = s.get(y, 0) + v
                energy.setdefault(c, {}).setdefault(key, {})[name] = s
    years = list(range(2013, 2026))
    detail = {c: {k: {e: [s.get(y) for y in years] for e, s in d.items() if any(v for v in s.values())} for k, d in by.items()}
              for c, by in sorted(energy.items())}
    write_json(OUT / "trucks-energy.json", {"years": years, "countries": detail, "license": "CC BY 4.0"})

    eu = {k: eurostat.series("road_eqs_lormot", extra_geos=("EU27_2020",), unit="NR", vehicle=v, mot_nrg=m).get("EU27_2020", {})
          for k, v, m in (("heavy", "LOR_GT3P5", "TOTAL"), ("light", "VG_LE3P5", "TOTAL"), ("elc", "LOR_GT3P5", "ELC"))}
    print(f"  EU27 重型 {eu['heavy'].get(2013)} → {eu['heavy'].get(2024)}；輕型 {eu['light'].get(2013)} → {eu['light'].get(2024)}；"
          f"電動重卡 {eu['elc'].get(2013)} → {eu['elc'].get(2024)}")
    for name in files:
        last = sorted(((max(s.items())[1], c, max(s)) for c, s in files[name].items() if s), reverse=True)[:6]
        print(f"  {name}：{last}")
    print(f"  台灣：{ {k: (min(v), v[min(v)], max(v), v[max(v)]) for k, v in tw.items()} }")
