"""政府花多少錢在文化、公共廣播與宗教（2026-11-07，製作手冊第二十七批 556，候選 1252、1261；步驟 culture-spending）。

- Eurostat `gov_10a_exp`（一般政府 S13、支出合計 TE、百萬歐元 MIO_EUR），COFOG 08「遊憩、文化與宗教」的六個分項：
  08.1 遊憩與運動服務、08.2 文化服務、08.3 廣播與出版服務、08.4 宗教與其他社區服務、08.5 研發、08.6 其他。
  占 GDP 自己用 `nama_10_gdp`（B1GQ、CP_MEUR）換算：Eurostat 的 PC_GDP 只給一位小數（手冊的陷阱），宗教那一項大多是 0.0–0.4。
  批次的 TSV 檔沒有 `lastTimePeriod` 的問題（手冊寫 JSON API 的 lastTimePeriod=1 只回盧森堡）。
- 輸出：休閒的「文化」主題（topics/culture/）gov-culture.json（08.2）、gov-broadcasting.json（08.3）、側欄的
  cofog08.json（每國每年六個分項的占 GDP 與百萬歐元，加 EU27 合計）；「宗教」主題（topics/religion/）gov-religion.json（08.4）。
  手冊建議 08.2、08.3 擴充「各國在讀什麼」；文化主題已經有遺產保存的公共支出，放在一起比較好找（DESIGN.md 寫明）。
- 08.4 的正式名稱是「Religious and other community services」，不是純宗教支出（也含社區活動中心、兄弟會等），標題與說明寫明。
  08.3 只含政府部門的支出：靠執照費的公共廣播（德國的 Rundfunkbeitrag 等）不一定算在裡面，會低估，說明寫明。
- 台灣沒有：Eurostat 只有歐洲；台灣的歲出政事別沒有單獨的宗教科目，文化部預算與公視的政府捐贈要從總預算自己整理，這裡沒有做（noValue 寫明）。
- CC BY 4.0（Eurostat）；英國、科索沃由 sources/eurostat.py 統一排除。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

CULTURE = OUT_DIR / "topics" / "culture"
RELIGION = OUT_DIR / "topics" / "religion"
FIRST_YEAR = 1995
GROUPS = ["GF0801", "GF0802", "GF0803", "GF0804", "GF0805", "GF0806"]
EU = "EU27_2020"
TAIWAN = {
    # 側欄的格子會把這段字放大顯示，寫短；完整的原因在指標說明
    "gov-religion": ("台灣的歲出沒有宗教科目", "Taiwan’s budget has no item for religion"),
    "culture": ("Eurostat 只有歐洲", "Eurostat covers Europe only"),
}


def build() -> None:
    amounts = {g: eurostat.series("gov_10a_exp", extra_geos=(EU,), unit="MIO_EUR", sector="S13", cofog99=g, na_item="TE")
               for g in GROUPS}
    gdp = eurostat.series("nama_10_gdp", extra_geos=(EU,), unit="CP_MEUR", na_item="B1GQ")
    last = max(y for s in amounts["GF0802"].values() for y in s)
    years = list(range(FIRST_YEAR, last + 1))

    def pct(g: str, c: str, y: int) -> float | None:
        a, d = amounts[g].get(c, {}).get(y), gdp.get(c, {}).get(y)
        return round(a / d * 100, 3) if a is not None and d else None

    countries = sorted({c for g in GROUPS for c in amounts[g]} - {EU})
    detail = {"years": years, "groups": GROUPS, "values": {}, "amounts": {}}
    for c in countries + [EU]:
        detail["values"][c] = {g: [pct(g, c, y) for y in years] for g in GROUPS}
        detail["amounts"][c] = {g: [amounts[g].get(c, {}).get(y) for y in years] for g in GROUPS}
    write_json(CULTURE / "cofog08.json", {**detail, "license": "CC BY 4.0", "source": "Eurostat gov_10a_exp, nama_10_gdp"})

    for out, key, g, tw in ((CULTURE, "gov-culture", "GF0802", "culture"), (CULTURE, "gov-broadcasting", "GF0803", "culture"),
                            (RELIGION, "gov-religion", "GF0804", "gov-religion")):
        values = {c: [pct(g, c, y) for y in years] for c in countries}
        values = {c: s for c, s in values.items() if any(v is not None for v in s)}
        hints, hints_en = {}, {}
        for c in values:
            y = max((y for y in amounts[g][c] if amounts[g][c][y] is not None), default=None)
            if y is not None:
                hints[c] = f"{y} 年 {amounts[g][c][y] / 100:,.2f} 億歐元"
                hints_en[c] = f"€{amounts[g][c][y]:,.1f} million in {y}"
        write_json(out / f"{key}.json", indicator_file(
            key, "% of GDP", years, values, hints=hints, hintsEn=hints_en,
            noValue={"TWN": TAIWAN[tw][0]}, noValueEn={"TWN": TAIWAN[tw][1]}, license="CC BY 4.0"))
        y24 = years.index(2024)
        top = sorted(((s[y24], c) for c, s in values.items() if s[y24] is not None), reverse=True)
        eu = pct(g, EU, 2024)
        print(f"  {key}（{g}）2024 年 {len(top)} 國：{[(c, round(v, 2)) for v, c in top[:10]]} … {[(c, round(v, 2)) for v, c in top[-6:]]}；"
              f"EU27 {eu}（{amounts[g][EU].get(2024)} 百萬歐元）")
        big = sorted(((amounts[g][c].get(2024) or 0, c) for c in values), reverse=True)[:6]
        print(f"    金額 2024：{big}")
        latest = {c: max(y for y in amounts[g][c]) for c in values}
        print(f"    最新年：2025 年有 {sum(1 for v in latest.values() if v == 2025)} 國；{sorted(set(latest.values()))}")
