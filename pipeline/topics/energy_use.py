"""各部門的最終能源消費（2026-11-07，製作手冊第二十五批 523，候選 1198；新主題，能源・能源的使用與政策）。

- 聯合國統計司（UNSD）Energy Balance 的 SDMX（data.un.org/legacy/ws，`format=csv`；UNdata 條款：可自由複製轉載，
  要註明 UNdata 是來源），1990–2023，單位 TJ（UNIT_MULT 都是 0）。商品 B09_TE（全部能源）與 B05_BW（生質能與廢棄物）；
  交易 B25_FEC（最終能源消費，不含非能源用）、B26_121 工業（製造、營建、非燃料採礦）、B40_122 運輸、B50_1231 家戶、
  B49_1235 商業與公共服務、B48_1232 農林漁、B51_1234 其他未分類（中國的服務業幾乎都記在這裡）、B24_NA 最終消費、
  B52_11 非能源用（石化原料等）。各部門占比的分母是 B25_FEC，六項加起來 100%；占比只畫 1 PJ（1,000 TJ）以上的。
- REF_AREA 是 M49 數字碼；251 法國－摩納哥、382 義大利－聖馬利諾、579 挪威－斯瓦巴、757 瑞士－列支敦斯登算本國。
- ESTIMATE 欄 Y（UNSD 估計）的國家，最新一年的總量是估計值的寫進附註。
- 台灣：UNSD 沒有；用經濟部能源署「國內能源消費年資料」（data.gov.tw 11158，set_id=21，政府資料開放授權條款第 1 版），
  2005–2025，千公噸油當量 × 41.868 換成 TJ；最終能源消費 ＝ 最終消費小計 − 非能源消費（能源署的非能源消費是石化原料，
  對應 UNSD 的 B52_11）；能源署的部門沒有「其他未分類」。台灣的家戶生質能沒有資料。
輸出 public/data/topics/energy-use/{sector-share/<部門>,final-energy,non-energy,household-biomass}.json。
"""

from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import from_numeric

OUT = OUT_DIR / "topics" / "energy-use"
KEY = ".B09_TE+B05_BW.B25_FEC+B26_121+B40_122+B47_123+B48_1232+B49_1235+B50_1231+B51_1234+B52_11+B24_NA.HSO"
URL = f"https://data.un.org/legacy/ws/rest/data/UNSD,DF_UNData_EnergyBalance,1.0/{KEY}?startPeriod=1990&format=csv"
TW_URL = "https://www.moeaea.gov.tw/ECW/populace/opendata/wHandOpenData_File.ashx?set_id=21"
AREA = {"251": "FRA", "382": "ITA", "579": "NOR", "757": "CHE"}
SECTORS = {"industry": "B26_121", "transport": "B40_122", "households": "B50_1231", "commerce": "B49_1235",
           "agriculture": "B48_1232", "other": "B51_1234"}
TW_COLS = {"industry": "按部門別_最終消費_工業部門(統計數值)", "transport": "按部門別_最終消費_運輸部門(統計數值)",
           "households": "按部門別_最終消費_住宅部門(統計數值)", "commerce": "按部門別_最終消費_服務業部門(統計數值)",
           "agriculture": "按部門別_最終消費_農業部門(統計數值)"}
KTOE_TJ = 41.868
# 占比只畫最終能源消費 1 PJ 以上的（吐瓦魯、托克勞這類小島的部門幾乎都是 0，排名表的「最低」會被它們占滿）
MIN_TJ = 1000
FIRST, LAST = 1990, 2025
UNDATA = {"license": "UNdata terms of use (free to copy and redistribute with citation)",
          "attribution": "UNdata, UN Statistics Division Energy Balances; Taiwan: Energy Administration, MOEA"}


def _unsd():
    v: dict[tuple[str, str, int], dict[str, float]] = defaultdict(dict)
    est: dict[tuple[str, int], bool] = {}
    with open(download(URL, "unsd", "energy-balance-sectors-1990.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["UNIT_MULT"] != "0":
                raise RuntimeError(f"UNSD 能源平衡表的 UNIT_MULT 不是 0：{r}")
            iso3 = AREA.get(r["REF_AREA"]) or from_numeric(r["REF_AREA"])
            if not iso3:
                continue
            y = int(r["TIME_PERIOD"])
            v[(iso3, r["COMMODITY"], y)][r["TRANSACTION"]] = float(r["OBS_VALUE"])
            if r["COMMODITY"] == "B09_TE" and r["TRANSACTION"] == "B25_FEC":
                est[(iso3, y)] = r["ESTIMATE"] == "Y"
    return v, est


def _taiwan() -> dict[int, dict[str, float]]:
    out = {}
    with open(download(TW_URL, "moeaea", "domestic-energy-consumption-set21.csv"), encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["單位"] != "千公噸油當量":
                raise RuntimeError(f"能源署 set_id=21 的單位不是千公噸油當量：{r['單位']}")
            y = int(r["西元年"])
            d = {k: float(r[c]) * KTOE_TJ for k, c in TW_COLS.items()}
            d["non-energy"] = float(r["按部門別_最終消費_非能源消費(統計數值)"]) * KTOE_TJ
            d["final"] = float(r["按部門別_最終消費_小計(統計數值)"]) * KTOE_TJ
            d["fec"] = d["final"] - d["non-energy"]
            if abs(sum(d[k] for k in TW_COLS) - d["fec"]) > 1:
                raise RuntimeError(f"能源署 {y} 年各部門加起來不等於最終能源消費")
            out[y] = d
    return out


def build() -> None:
    v, est = _unsd()
    tw = _taiwan()
    years = list(range(FIRST, LAST + 1))
    countries = sorted({k[0] for k in v})
    total = lambda iso3, y: v.get((iso3, "B09_TE", y), {})  # noqa: E731
    notes, notes_en = {}, {}
    for iso3 in countries:
        last = max((y for (i, c, y) in v if i == iso3 and c == "B09_TE"), default=None)
        if last and est.get((iso3, last)):
            notes[iso3] = f"UNSD 的 {last} 年數字是估計值。"
            notes_en[iso3] = f"UNSD figures for {last} are estimates."
    notes["TWN"] = "台灣不在 UNSD 的能源平衡表裡，用經濟部能源署的國內能源消費（2005 年起，千公噸油當量換成 TJ）；能源署的部門分類沒有「其他未分類」。"
    notes_en["TWN"] = "Taiwan is not in the UNSD energy balances; figures are from the Energy Administration (MOEA) from 2005, converted from ktoe to TJ. Its sector breakdown has no \"not elsewhere specified\" category."
    extra = {"latestWithin": 2, "notes": notes, "notesEn": notes_en, **UNDATA}

    for item, code in SECTORS.items():
        data = {}
        for iso3 in countries:
            vals = []
            for y in years:
                d = total(iso3, y)
                vals.append(round(d.get(code, 0) / d["B25_FEC"] * 100, 2) if d.get("B25_FEC", 0) >= MIN_TJ else None)
            if any(x is not None for x in vals):
                data[iso3] = vals
        if item in TW_COLS:
            data["TWN"] = [round(tw[y][item] / tw[y]["fec"] * 100, 2) if y in tw else None for y in years]
        write_json(OUT / "sector-share" / f"{item}.json", indicator_file(f"sector-share/{item}", "%", years, data, **extra))
        big = [k for k in data if total(k, 2023).get("B25_FEC", 0) >= 100_000]
        top = sorted(((data[k][years.index(2023)], k) for k in big), reverse=True)
        print(f"  {item} 2023（100 PJ 以上 {len(top)} 國）：高 {top[:7]}；低 {top[-3:]}；台灣 2025 {data.get('TWN', [None])[-1]}")

    fec = {k: [round(total(k, y)["B25_FEC"] / 1000, 2) if total(k, y).get("B25_FEC") else None for y in years] for k in countries}
    fec = {k: s for k, s in fec.items() if any(x is not None for x in s)}
    fec["TWN"] = [round(tw[y]["fec"] / 1000, 2) if y in tw else None for y in years]
    write_json(OUT / "final-energy.json", indicator_file("final-energy", "PJ", years, fec, **extra))
    i = years.index(2023)
    top = sorted(((s[i], k) for k, s in fec.items() if s[i]), reverse=True)
    print(f"  最終能源消費 2023：{len(top)} 國，高 {top[:8]}；台灣 2023 {fec['TWN'][i]}、2025 {fec['TWN'][-1]}")

    ne = {}
    for k in countries:
        s = [round(total(k, y).get("B52_11", 0) / total(k, y)["B24_NA"] * 100, 2) if total(k, y).get("B24_NA", 0) >= MIN_TJ else None for y in years]
        if any(x is not None for x in s):
            ne[k] = s
    ne["TWN"] = [round(tw[y]["non-energy"] / tw[y]["final"] * 100, 2) if y in tw else None for y in years]
    write_json(OUT / "non-energy.json", indicator_file("non-energy", "%", years, ne, **extra))
    big = [k for k in ne if total(k, 2023).get("B25_FEC", 0) >= 100_000]
    top = sorted(((ne[k][i], k) for k in big), reverse=True)
    print(f"  非能源用 2023：高 {top[:8]}；台灣 2025 {ne['TWN'][-1]}")

    bio = {}
    for k in countries:
        s = []
        for y in years:
            hh = total(k, y).get("B50_1231", 0)
            s.append(round(v.get((k, "B05_BW", y), {}).get("B50_1231", 0) / hh * 100, 2) if hh >= 100 else None)
        if any(x is not None for x in s):
            bio[k] = s
    bnotes = {k: t for k, t in notes.items() if k != "TWN"}
    write_json(OUT / "household-biomass.json", indicator_file(
        "household-biomass", "%", years, bio, latestWithin=2, notes=bnotes, notesEn={k: notes_en[k] for k in bnotes}, **UNDATA))
    top = sorted(((bio[k][i], k) for k in bio if bio[k][i] is not None and total(k, 2023).get("B25_FEC", 0) >= 100_000), reverse=True)
    print(f"  家戶生質能 2023：高 {top[:8]}；低 {top[-5:]}")
