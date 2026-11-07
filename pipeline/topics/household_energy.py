"""家裡的能源花在哪：暖氣、熱水、冷氣、炊事，以及暖氣燒什麼（2026-11-07，製作手冊第二十五批 524，候選 1199、1200；
新主題，能源・能源的使用與政策）。

Eurostat `nrg_d_hhq`（Disaggregated final energy consumption in households - quantities，CC BY 4.0；資料集的 geo 含英國、
科索沃，照 sources/eurostat.py 的規則不收），2010–2024，單位 TJ。
- 用途（1199）：FC_OTH_HH_E_SH 空間暖氣、_SC 空間冷氣、_WH 熱水、_CK 炊事、_LE 照明與家電、_OE 其他，除以 FC_OTH_HH_E（家戶合計），
  燃料都是 TOTAL。
- 暖氣燒什麼（1200）：FC_OTH_HH_E_SH 依燃料除以 TOTAL：G3000 天然氣、E7000 電、H8000 熱能（區域供熱）、O4000 石油產品、
  SFF_P1000_S2000 固體化石燃料（煤）、R5110-5150_W6000RI 木柴等固體生質燃料；RA000（再生能源合計）**含**木柴，所以
  「其他再生能源」（熱泵取的環境熱、太陽熱能、地熱、沼氣等）＝RA000 − 木柴，不能直接相加。
台灣沒有家戶能源的用途統計（台電只有用電量），而且幾乎不需要空間暖氣，寫在 noValue。
輸出 public/data/topics/household-energy/{end-use,heating-fuel}/<子項目>.json。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "household-energy"
USES = {"heating": "FC_OTH_HH_E_SH", "cooling": "FC_OTH_HH_E_SC", "water": "FC_OTH_HH_E_WH", "cooking": "FC_OTH_HH_E_CK",
        "lighting": "FC_OTH_HH_E_LE", "other": "FC_OTH_HH_E_OE"}
FUELS = {"gas": "G3000", "electricity": "E7000", "district-heat": "H8000", "oil": "O4000", "coal": "SFF_P1000_S2000",
         "wood": "R5110-5150_W6000RI"}
EXTRA = {"license": "CC BY 4.0", "attribution": "Eurostat (nrg_d_hhq)"}


def _q(bal: str, siec: str = "TOTAL") -> dict[str, dict[int, float]]:
    return eurostat.series("nrg_d_hhq", nrg_bal=bal, siec=siec, unit="TJ", freq="A")


def _share(part: dict[str, dict[int, float]], total: dict[str, dict[int, float]], years: list[int]) -> dict[str, list[float | None]]:
    out = {}
    for k, t in sorted(total.items()):
        p = part.get(k, {})
        s = [round(p.get(y, 0) / t[y] * 100, 2) if t.get(y) and y in p else None for y in years]
        if any(v is not None for v in s):
            out[k] = s
    return out


def _print(name: str, data: dict[str, list[float | None]], years: list[int], y: int) -> None:
    i = years.index(y)
    top = sorted(((v[i], k) for k, v in data.items() if v[i] is not None), reverse=True)
    print(f"  {name} {y}：{len(top)} 國；高 {top[:6]}；低 {top[-4:]}")


def build() -> None:
    years = list(range(2010, 2025))
    total = _q("FC_OTH_HH_E")
    for item, bal in USES.items():
        data = _share(_q(bal), total, years)
        write_json(OUT / "end-use" / f"{item}.json", indicator_file(f"end-use/{item}", "%", years, data, latestWithin=1, **EXTRA))
        _print(f"用途 {item}", data, years, 2024)
        if item == "cooling":
            print(f"    賽普勒斯 {[data.get('CYP', [None] * 15)[years.index(y)] for y in (2021, 2022, 2023, 2024)]}")
    heat = _q("FC_OTH_HH_E_SH")
    parts = {item: _q("FC_OTH_HH_E_SH", siec) for item, siec in FUELS.items()}
    ren = _q("FC_OTH_HH_E_SH", "RA000")
    wood = parts["wood"]
    parts["other-renewables"] = {k: {y: v - wood.get(k, {}).get(y, 0) for y, v in s.items()} for k, s in ren.items()}
    for item, part in parts.items():
        data = _share(part, heat, years)
        write_json(OUT / "heating-fuel" / f"{item}.json", indicator_file(f"heating-fuel/{item}", "%", years, data, latestWithin=1, **EXTRA))
        _print(f"暖氣 {item}", data, years, 2023)
    for k in ("NLD", "DEU", "SWE", "NOR", "POL", "ROU", "FIN"):
        print(f"    {k} 2023：" + "、".join(f"{item} {round(part.get(k, {}).get(2023, 0) / heat[k][2023] * 100, 1)}" for item, part in parts.items() if heat.get(k, {}).get(2023)))
