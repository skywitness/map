"""ICT 貨品與服務占出口的比例（2026-11-07，製作手冊第二十五批 506，候選 1177；擴充「半導體」）。

World Bank WDI（CC BY 4.0）：TX.VAL.ICTG.ZS.UN（ICT 貨品占貨品出口，來源 UNCTADstat）與 BX.GSR.CCIS.ZS
（ICT 服務占服務出口，來源 IMF 國際收支）。WDI 不收台灣。分母很小的國家比例會亂跳（手冊的陷阱：幾內亞、馬利的 ICT 服務），
服務出口不到 10 億美元（BX.GSR.NFSV.CD）的那一年不畫。
輸出 public/data/topics/semiconductors/ict/{goods,services}.json（%），latestWithin 2。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import worldbank

OUT = OUT_DIR / "topics" / "semiconductors" / "ict"
FIRST = 2000
MIN_SERVICES = 1e9  # 服務出口不到 10 億美元的不畫


def _write(name: str, data: dict[str, dict[int, float]], world: dict[int, float]) -> None:
    years = list(range(FIRST, max(y for s in data.values() for y in s) + 1))
    values = {k: [round(s[y], 2) if y in s else None for y in years] for k, s in sorted(data.items()) if any(y in s for y in years)}
    agg = {"WLD": [round(world[y], 2) if y in world else None for y in years]}
    write_json(OUT / f"{name}.json", indicator_file(name, "%", years, values, latestWithin=2, aggregates=agg, license="CC BY 4.0"))
    print(f"  ICT {name}：{len(values)} 國（{years[0]}–{years[-1]}）")


def build() -> None:
    goods, goods_world = worldbank.fetch("TX.VAL.ICTG.ZS.UN", FIRST)
    services, services_world = worldbank.fetch("BX.GSR.CCIS.ZS", FIRST)
    total, _ = worldbank.fetch("BX.GSR.NFSV.CD", FIRST)
    services = {k: {y: v for y, v in s.items() if total.get(k, {}).get(y, 0) >= MIN_SERVICES} for k, s in services.items()}
    _write("goods", goods, goods_world)
    _write("services", {k: s for k, s in services.items() if s}, services_world)
