"""血漿製劑能不能自給（2026-11-04，製作手冊第二十批 322，新主題）。

WHO《Global status report on blood safety and availability 2025》（CC BY-NC-SA 3.0 IGO，本站非商業；改作的資料檔也是
同一個授權）附錄 9：本國採集的血漿怎麼分餾（A 國內公立／非營利、B 國內營利、C 委託他國、D 賣給製造商）、用於分餾的血漿
每千人幾公升、血漿製劑（白蛋白、靜脈注射免疫球蛋白 IVIG、第八凝血因子）有幾成是用本國血漿做的。PDF 由 `sources.who_blood`
讀。資料年 2014–2023 年不連續，每國用有值的最近一年（滑過看年份），主題不分年份。附錄 8（血品用量）的單位不一致
（發出或輸注），這次不做。台灣不在 WHO 的血液資料庫裡。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import who_blood
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "plasma"
YEAR = 2023
NAMES = {"Netherlands (Kingdom of the)": "NLD", "Republic of Korea": "KOR", "Republic of Moldova": "MDA",
         "Iran (Islamic Republic of)": "IRN", "Venezuela (Bolivarian Republic of)": "VEN",
         "United States of America": "USA", "Russian Federation": "RUS"}
ARRANGEMENT = {"A": 1, "B": 2, "C": 3, "D": 4, "B, D": 5}
ARRANGEMENT_ZH = {"A": "國內公立或非營利機構分餾", "B": "國內營利機構分餾", "C": "委託他國分餾", "D": "賣給製造商"}
ARRANGEMENT_EN = {"A": "fractionated in-country by the public or not-for-profit sector", "B": "fractionated in-country by the for-profit sector",
                  "C": "contract fractionation abroad", "D": "sold to manufacturers"}
PRODUCTS = {"albumin": "sr_albumin", "ivig": "sr_ivig", "f8": "sr_f8"}
NO_TW = ({"TWN": "台灣不在 WHO 的血液安全資料庫裡"}, {"TWN": "Taiwan is not in WHO’s blood safety database"})


def _latest(rows: list[dict], field: str) -> tuple[str, str] | None:
    have = [r for r in rows if r[field] is not None]
    return (have[-1]["year"], have[-1][field]) if have else None


def build() -> None:
    data = who_blood.fetch()
    arrangement, hints, hints_en = {}, {}, {}
    volume, v_hints, v_hints_en = {}, {}, {}
    reliance = {k: ({}, {}, {}) for k in PRODUCTS}
    for name, rows in data.items():
        iso3 = NAMES.get(name) or from_name(name)
        if not iso3:
            raise RuntimeError(f"WHO 血液報告：對不到的國名 {name}")
        if a := _latest(rows, "arrangement"):
            year, code = a
            if code not in ARRANGEMENT:
                raise RuntimeError(f"WHO 血液報告：{name} 的分餾方式 {code} 沒有對應的類別")
            arrangement[iso3] = ARRANGEMENT[code]
            parts = code.split(", ")
            hints[iso3] = f"{year} 年：" + "、".join(ARRANGEMENT_ZH[p] for p in parts)
            hints_en[iso3] = f"{year}: " + "; ".join(ARRANGEMENT_EN[p] for p in parts)
        if v := _latest(rows, "per1000"):
            year, value = v
            row = next(r for r in rows if r["year"] == year)
            total = who_blood.number(row["total"])
            volume[iso3] = who_blood.number(value)
            v_hints[iso3] = f"{year} 年" + (f"，共 {total:,.0f} 公升" if total else "")
            v_hints_en[iso3] = f"{year}" + (f", {total:,.0f} litres in all" if total else "")
        for key, field in PRODUCTS.items():
            if r := _latest(rows, field):
                year, value = r
                n = who_blood.number(value)
                if n is None:
                    continue
                reliance[key][0][iso3] = min(n, 100)
                reliance[key][1][iso3] = f"{year} 年"
                reliance[key][2][iso3] = f"{year}"
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "fractionation.json", indicator_file(
        "fractionation", "類別", [YEAR], {c: [v] for c, v in sorted(arrangement.items())},
        hints=hints, hintsEn=hints_en, noValue=NO_TW[0], noValueEn=NO_TW[1]))
    write_json(OUT / "plasma-volume.json", indicator_file(
        "plasma-volume", "公升/千人", [YEAR], {c: [v] for c, v in sorted(volume.items())},
        hints=v_hints, hintsEn=v_hints_en, noValue=NO_TW[0], noValueEn=NO_TW[1]))
    for key, (values, h, h_en) in reliance.items():
        write_json(OUT / f"self-reliance-{key}.json", indicator_file(
            f"self-reliance-{key}", "%", [YEAR], {c: [v] for c, v in sorted(values.items())},
            hints=h, hintsEn=h_en, noValue=NO_TW[0], noValueEn=NO_TW[1]))
    write_json(OUT / "manifest.json", {
        "topic": "plasma", "generatedAt": now_iso(),
        "source": "WHO, Global status report on blood safety and availability 2025, annex 9 (2026)",
        "license": "CC BY-NC-SA 3.0 IGO",
    })
    print(f"  分餾方式：{len(arrangement)} 國 {sorted(arrangement.items(), key=lambda kv: kv[1])}")
    print(f"  每千人血漿：{len(volume)} 國；最高 {sorted(((v, c) for c, v in volume.items()), reverse=True)[:6]}；最低 {sorted((v, c) for c, v in volume.items())[:5]}")
    for key, (values, _, _) in reliance.items():
        print(f"  自給率 {key}：{len(values)} 國 {sorted(((v, c) for c, v in values.items()), reverse=True)}")
