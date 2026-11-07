"""農田的養分流失：氮磷盈餘與氮肥效率（新主題，2026-11-07，製作手冊第二十五批 484，候選 1147；環境的「污染」）。

FAOSTAT「Cropland Nutrient Balance」（ESB，CC BY 4.0）：每一國耕地的氮、磷、鉀輸入（化肥、糞肥、生物固氮、
大氣沉降、種子）減掉輸出（作物收穫帶走），剩下的是盈餘；氮另外推估淋溶與揮發。1961–2023 年。
- element：7275／7276 氮（公噸、公斤/公頃），7280／7281 磷（P，元素量），7290 氮肥利用效率（%，輸出÷輸入）。
- item：5081 盈餘（Nutrient balance）、5079 輸入、5087 化肥、5089 糞肥、5078 固氮、5076 沉降、5086 種子、
  5077 作物收穫、5088 殘體移除（不算進輸出）、5082 淋溶、5083 揮發。
- 耕地面積＝輸入總量÷每公頃輸入。耕地不到 2 萬公頃的地區（法羅群島、新加坡、香港、汶萊、科威特等）每公頃的值
  會爆掉，每公頃與效率兩個指標那一年不畫（手冊的陷阱）；氮肥效率是 0 的（瓜德羅普）也不畫。
- **Flag X（外部機構提供）不用**：只出現在 1961–2000 年部分國家的化肥氮，側欄那一年不畫收支。

輸出 public/data/topics/nutrients/：n-surplus.json、n-efficiency.json、p-surplus.json（每公頃、%），
n-flows/{surplus,leaching,volatilisation}.json（公噸，含全世界），budget/{iso3}.json（側欄：每公頃的氮收支）。
"""

from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import faostat

OUT = OUT_DIR / "topics" / "nutrients"
N_T, N_HA, P_HA, NUE = "7275", "7276", "7281", "7290"
BALANCE, INPUT = "5081", "5079"
# 側欄的氮收支（每公頃），順序固定：輸入 5 項、輸出 2 項、盈餘的去向 2 項
BUDGET = ["5087", "5089", "5078", "5076", "5086", "5077", "5088", "5082", "5083"]
FLOWS = {"5081": "surplus", "5082": "leaching", "5083": "volatilisation"}
MIN_CROPLAND_HA = 20000
FIRST = 1961


def build() -> None:
    reader = faostat._csv("ESB")
    col = {k: i for i, k in enumerate(next(reader))}
    cache: dict[str, str | None] = {}
    # {(item, element): {iso3: {年: 值}}}
    data: dict[tuple[str, str], dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    flagged_x: set[tuple[str, int]] = set()
    for r in reader:
        value = r[col["Value"]]
        if not value:
            continue
        area = faostat._area(r[col["Area Code"]], r[col["Area Code (M49)"]].lstrip("'"), cache)
        if not area:
            continue
        year = int(r[col["Year"]])
        if r[col["Flag"]] == "X":
            flagged_x.add((area, year))
            continue
        data[(r[col["Item Code"]], r[col["Element Code"]])][area][year] = float(value)

    last = max(y for s in data[(BALANCE, N_HA)].values() for y in s)
    years = list(range(FIRST, last + 1))

    def cropland(iso3: str, y: int) -> float | None:
        total = data[(INPUT, N_T)].get(iso3, {}).get(y)
        per_ha = data[(INPUT, N_HA)].get(iso3, {}).get(y)
        return total / per_ha * 1000 if total and per_ha else None

    small: set[str] = set()

    def per_area(key: tuple[str, str], digits: int, keep=lambda v: True) -> dict[str, list[float | None]]:
        out = {}
        for iso3, s in data[key].items():
            if iso3 == "WLD":
                continue
            row = []
            for y in years:
                v, ha = s.get(y), cropland(iso3, y)
                if v is None or not keep(v):
                    row.append(None)
                elif ha is None or ha < MIN_CROPLAND_HA:
                    small.add(iso3)
                    row.append(None)
                else:
                    row.append(round(v, digits))
            if any(x is not None for x in row):
                out[iso3] = row
        return out

    def world(key: tuple[str, str], digits: int) -> list[float | None]:
        s = data[key].get("WLD", {})
        return [round(s[y], digits) if y in s else None for y in years]

    lic = "CC BY 4.0"
    write_json(OUT / "n-surplus.json", indicator_file("n-surplus", "公斤/公頃", years, per_area((BALANCE, N_HA), 1),
                                                      aggregates={"WLD": world((BALANCE, N_HA), 1)}, license=lic))
    write_json(OUT / "n-efficiency.json", indicator_file("n-efficiency", "%", years, per_area((BALANCE, NUE), 1, lambda v: v > 0),
                                                         aggregates={"WLD": world((BALANCE, NUE), 1)}, license=lic))
    write_json(OUT / "p-surplus.json", indicator_file("p-surplus", "公斤/公頃", years, per_area((BALANCE, P_HA), 1),
                                                      aggregates={"WLD": world((BALANCE, P_HA), 1)}, license=lic))
    for item, name in FLOWS.items():
        series = data[(item, N_T)]
        values = {k: [round(s[y]) if y in s else None for y in years] for k, s in series.items() if k != "WLD"}
        write_json(OUT / "n-flows" / f"{name}.json", indicator_file(
            "n-flows", "公噸", years, values, aggregates={"WLD": world((item, N_T), 0)}, license=lic))

    count = 0
    for iso3 in data[(BALANCE, N_HA)]:
        if iso3 == "WLD":
            continue
        rows = {}
        for y in years:
            if (iso3, y) in flagged_x:
                continue
            row = [data[(item, N_HA)].get(iso3, {}).get(y) for item in BUDGET]
            if any(v is None for v in row[:7]):
                continue
            rows[str(y)] = [round(v, 1) if v is not None else None for v in row]
        if rows:
            write_json(OUT / "budget" / f"{iso3}.json", {"items": BUDGET, "years": rows}, quiet=True)
            count += 1
    tw = data[(BALANCE, N_HA)]["TWN"][last]
    print(f"  FAOSTAT ESB {FIRST}–{last}；台灣 {last} 年每公頃氮盈餘 {tw:.1f} 公斤；"
          f"耕地不到 2 萬公頃不畫的地區 {len(small)} 個；側欄 {count} 國；Flag X 的國家年 {len(flagged_x)} 個")
