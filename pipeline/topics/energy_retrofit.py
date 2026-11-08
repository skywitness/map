"""能源貧窮的擴充：家裡做過哪些節能改造（2026-11-08，製作手冊第二十七批 628，候選 1369；步驟 energy-retrofit，
輸出 topics/energy-poverty/retrofit/）。

Eurostat `ilc_enevh_01`（EU-SILC：過去五年住的房子做過節能改善的人口比例，CC BY 4.0；36 個 geo 不含英國），
yes_no=YES、age=TOTAL、unit=PC，只有 2023 與 2025 兩期。子項目：全部、自住、租屋、獨棟、公寓、貧窮或社會排除風險、沒有風險。
手冊的陷阱：「節能改善」是受訪者自己認定（換窗、加保溫、換鍋爐都算），各國差很多（荷蘭 60.5%、義大利 2.6%），可能有問卷執行差異。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "energy-poverty" / "retrofit"
ITEMS = {
    "all": {"tenure": "TOTAL", "building": "TOTAL", "yn_arope": "TOTAL"},
    "owners": {"tenure": "OWN", "building": "TOTAL", "yn_arope": "TOTAL"},
    "renters": {"tenure": "RENT", "building": "TOTAL", "yn_arope": "TOTAL"},
    "houses": {"tenure": "TOTAL", "building": "HOUSE", "yn_arope": "TOTAL"},
    "flats": {"tenure": "TOTAL", "building": "FLAT", "yn_arope": "TOTAL"},
    "at-risk": {"tenure": "TOTAL", "building": "TOTAL", "yn_arope": "YES_AROPE"},
    "not-at-risk": {"tenure": "TOTAL", "building": "TOTAL", "yn_arope": "NO_AROPE"},
}


def build() -> None:
    for k, f in ITEMS.items():
        s = eurostat.series("ilc_enevh_01", yes_no="YES", age="TOTAL", unit="PC", **f)
        s = {c: x for c, x in s.items() if x}
        years = sorted({y for x in s.values() for y in x})
        write_json(OUT / f"{k}.json", indicator_file(
            f"retrofit/{k}", "%", years, {c: [x.get(y) for y in years] for c, x in sorted(s.items())},
            license="CC BY 4.0", attribution="Eurostat"))
        y = years[-1]
        r = sorted(((c, x[y]) for c, x in s.items() if y in x), key=lambda t: -t[1])
        print(f"  {k} {years}（{len(r)} 國）{y}：" + "、".join(f"{c} {v}" for c, v in r[:8]) + " … " + "、".join(f"{c} {v}" for c, v in r[-6:]))
