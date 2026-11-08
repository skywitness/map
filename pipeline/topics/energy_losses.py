"""能源用在哪裡的擴充：能源業自己吃掉多少（自用與損失）、電力用在哪個部門（2026-11-08，製作手冊第二十七批 626，
候選 1365、1366；步驟 energy-losses，輸出 topics/energy-use/）。

- 聯合國統計司（UNSD）Energy Balance 的 SDMX（同 energy_use.py，UNdata 條款），1990–2023，TJ。
- **自用與損失**：商品 B09_TE（全部能源）的 B22_09（能源業自用：煉油廠、油氣處理、煤礦、電廠自用電等）與
  B23_101（損失：輸配、運送、儲存的損失），平衡表裡是負值，取絕對值；占 B07_GA（一次能源總供給）的 %。
  子項目：合計、自用、損失。總供給至少 10 PJ 的國家才算。
- **電力的部門用途**：商品 B07_EL（電力）的最終能源消費 B25_FEC 為分母，工業 B26_121、家戶 B50_1231、商業與公共服務
  B49_1235、運輸 B40_122、農林漁 B48_1232，其餘（含其他未分類 B51_1234）歸「其他」。電力最終消費至少 1 PJ 的國家。
  手冊的陷阱：有些國家（中國）的商業與公共服務記在「其他未分類」，比較時要看「其他」。
- 台灣：UNSD 沒有；能源業自用用能源署「國內能源消費年資料」（set_id=21）的「能源部門自用」÷ 能源供給表（set_id=14）的
  能源總供給（都是千公噸油當量，網站已經在用），只有自用、沒有損失；電力的部門用途這兩個表沒有。
"""

from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import moeaea_fuels
from sources.countries import from_numeric
from topics.energy_use import AREA, TW_URL, UNDATA

OUT = OUT_DIR / "topics" / "energy-use"
BASE = "https://data.un.org/legacy/ws/rest/data/UNSD,DF_UNData_EnergyBalance,1.0/{key}?startPeriod=1990&format=csv"
LOSS_KEY = ".B09_TE.B07_GA+B22_09+B23_101.HSO"
ELEC = {"industry": "B26_121", "households": "B50_1231", "commerce": "B49_1235", "transport": "B40_122", "agriculture": "B48_1232"}
ELEC_KEY = ".B07_EL.B25_FEC+" + "+".join(ELEC.values()) + ".HSO"
MIN_SUPPLY_TJ = 10_000
MIN_ELEC_TJ = 1_000


def _unsd(key: str, name: str) -> dict[tuple[str, int], dict[str, float]]:
    v: dict[tuple[str, int], dict[str, float]] = defaultdict(dict)
    with open(download(BASE.format(key=key), "unsd", name), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["UNIT_MULT"] != "0":
                raise RuntimeError(f"UNSD 的 UNIT_MULT 不是 0：{r}")
            c = AREA.get(r["REF_AREA"]) or from_numeric(r["REF_AREA"])
            if c:
                v[(c, int(r["TIME_PERIOD"]))][r["TRANSACTION"]] = abs(float(r["OBS_VALUE"]))
    return v


def _taiwan_own_use() -> dict[int, float]:
    path = download(TW_URL, "moeaea", "domestic-energy-consumption-set21.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        own = {int(r["西元年"]): float(r["按部門別_能源部門自用(統計數值)"]) for r in csv.DictReader(f) if r["西元年"].strip().isdigit()}
    supply = {y: r["能源總供給"] for y, r in moeaea_fuels.supply().items() if r.get("能源總供給")}
    return {y: own[y] / supply[y] * 100 for y in own if supply.get(y)}


def build() -> None:
    v = _unsd(LOSS_KEY, "energy-balance-own-use-losses-1990.csv")
    years = sorted({y for _, y in v})
    shares: dict[str, dict[str, list]] = {"total": {}, "own-use": {}, "losses": {}}
    for c in sorted({c for c, _ in v}):
        rows = {k: [] for k in shares}
        for y in years:
            t = v.get((c, y), {})
            sup = t.get("B07_GA", 0)
            ok = sup >= MIN_SUPPLY_TJ
            own, loss = t.get("B22_09", 0), t.get("B23_101", 0)
            rows["own-use"].append(round(own / sup * 100, 3) if ok else None)
            rows["losses"].append(round(loss / sup * 100, 3) if ok else None)
            rows["total"].append(round((own + loss) / sup * 100, 3) if ok else None)
        for k in shares:
            if any(x is not None for x in rows[k]):
                shares[k][c] = rows[k]
    tw = _taiwan_own_use()
    tw_years = sorted(y for y in tw if y in years)
    if tw_years:
        shares["own-use"]["TWN"] = [round(tw[y], 3) if y in tw else None for y in years]
    tw_note = ("能源署「國內能源消費」的能源部門自用 ÷ 能源供給表的能源總供給；能源署的表沒有「損失」，所以只有自用。",
               "Energy sector own use from the Energy Administration’s domestic energy consumption table divided by total energy supply; the table has no losses row, so only own use is shown.")
    for k, vals in shares.items():
        extra = ({"notes": {"TWN": tw_note[0]}, "notesEn": {"TWN": tw_note[1]}} if k == "own-use" else
                 {"noValue": {"TWN": "能源署沒有損失的數字，請看「能源業自用」"}, "noValueEn": {"TWN": "No losses figure; see energy industry own use"}})
        write_json(OUT / "own-use-losses" / f"{k}.json", indicator_file(f"own-use-losses/{k}", "%", years, vals, latestWithin=3, **extra, **UNDATA))
    y = years[-1]
    r = sorted(((c, s[-1]) for c, s in shares["total"].items() if s[-1] is not None), key=lambda x: -x[1])
    print(f"  自用＋損失 {years[0]}–{y}（{len(r)} 國）：" + "、".join(f"{c} {x:.1f}（{shares['own-use'][c][-1]:.1f}／{shares['losses'][c][-1]:.1f}）" for c, x in r[:12]))
    print("    " + "、".join(f"{c} {shares['total'][c][-1]:.1f}（{shares['own-use'][c][-1]:.1f}／{shares['losses'][c][-1]:.1f}）"
                            for c in ("USA", "CHN", "JPN", "DEU", "IND", "RUS", "KOR", "AUS", "SAU", "BRA") if c in shares["total"]))
    print(f"    台灣自用：" + "、".join(f"{yy} {tw[yy]:.1f}" for yy in (2005, 2015, 2022, 2023) if yy in tw))

    e = _unsd(ELEC_KEY, "energy-balance-electricity-uses-1990.csv")
    eyears = sorted({y for _, y in e})
    eshares: dict[str, dict[str, list]] = {k: {} for k in [*ELEC, "other"]}
    for c in sorted({c for c, _ in e}):
        rows = {k: [] for k in eshares}
        for y in eyears:
            t = e.get((c, y), {})
            fec = t.get("B25_FEC", 0)
            ok = fec >= MIN_ELEC_TJ
            parts = {k: t.get(code, 0) for k, code in ELEC.items()}
            for k in ELEC:
                rows[k].append(round(parts[k] / fec * 100, 3) if ok else None)
            rows["other"].append(round(max(0.0, fec - sum(parts.values())) / fec * 100, 3) if ok else None)
        for k in eshares:
            if any(x is not None for x in rows[k]):
                eshares[k][c] = rows[k]
    for k, vals in eshares.items():
        write_json(OUT / "electricity-use" / f"{k}.json", indicator_file(f"electricity-use/{k}", "%", eyears, vals, latestWithin=3, **UNDATA))
    y = eyears[-1]
    for c in ("CHN", "USA", "IND", "JPN", "KOR", "DEU", "SAU", "RUS", "BRA", "FRA", "NOR"):
        t = e.get((c, y), {})
        fec = t.get("B25_FEC", 0)
        if fec:
            print(f"    電力 {c} {y} {fec:,.0f} TJ：" + "、".join(f"{k} {t.get(code, 0) / fec:.0%}" for k, code in ELEC.items())
                  + f"、other {eshares['other'][c][-1]:.0f}%")
