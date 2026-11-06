"""法律與制度：含糖飲料稅（2026-11-06，製作手冊第二十四批 416；步驟 sugar-tax，輸出 topics/laws/sugar-tax*.json）。

- 資料：世界銀行 Global SSB Tax Database（Data Catalog 0063310，CC BY 4.0），直連 CSV
  `SSB-Tax-Database-Aug23.csv`（入口網站 ssbtax.worldbank.org 從 cloud 回 403、資料目錄的 API 回 429，都不用）。
  2023 年 8 月的快照，說明頁寫「No further updates are currently planned.」。1,991 列裡只有 132 列有資料（level 非空），
  國家級 119 列（117 個國家與屬地；新喀里多尼亞、萬那杜各有兩種稅），州省級 6 列、市郡級 7 列只寫在說明。
- 稅率不能直接比（每公升固定金額、售價的百分比、依含糖量分級，還有不同幣別），所以只畫類別：依含糖量分級的另成一類
  （tiered 而且分級的依據有 SUGAR），其他依 structure 分成從量（Specific）、從價（Ad valorem）、混合（Mixed）。
  同一國有兩種稅時取依含糖量分級、從量、混合、從價的順序裡排前面的，兩種都寫在 hints。
- 資料庫沒有收錄的國家是「沒有全國的含糖飲料稅」（代碼 5），不留灰色：台灣在 CSV 裡找 TWN、Taiwan 都是 0 筆。
  資料庫只收到 2023 年 8 月，之後才開始課稅的國家仍算沒有，寫在說明。
"""
from __future__ import annotations

import csv
import json

from common import OUT_DIR, download, indicator_file, write_json

OUT = OUT_DIR / "topics" / "laws"
URL = "https://datacatalogfiles.worldbank.org/ddh-published/0063310/DR0092738/SSB-Tax-Database-Aug23.csv"
YEAR = 2023
SUGAR, SPECIFIC, MIXED, AD_VALOREM, NONE = 1, 2, 3, 4, 5
STRUCTURE = {"Specific": SPECIFIC, "Mixed": MIXED, "Ad valorem": AD_VALOREM}
# 課哪些飲料（CSV 的 0／1 欄位）
DRINKS = [
    ("carbonates", "碳酸飲料", "carbonated drinks"),
    ("concentrates", "濃縮液", "concentrates"),
    ("energy_drinks", "能量飲料", "energy drinks"),
    ("juice_sweetened", "加糖果汁", "sweetened juice"),
    ("juice_unsweetened", "無糖果汁", "unsweetened juice"),
    ("milk_drinks", "奶類飲料", "milk drinks"),
    ("lcsb", "低卡飲料", "low-calorie drinks"),
    ("water_unsweetened", "無糖的水", "unsweetened water"),
]
KIND_ZH = {SUGAR: "依含糖量分級", SPECIFIC: "從量（每公升固定金額）", MIXED: "從量加從價", AD_VALOREM: "從價（售價的百分比）"}
KIND_EN = {SUGAR: "tiered by sugar content", SPECIFIC: "specific (fixed amount per litre)", MIXED: "specific plus ad valorem",
           AD_VALOREM: "ad valorem (percentage of price)"}
# CSV 的代碼寫錯的（秘魯寫成 PERU）
FIX_CODES = {"PERU": "PER"}
INSTRUMENT_ZH = {"Excise": "貨物稅", "Import": "進口稅", "VAT/GST": "加值稅"}
INSTRUMENT_EN = {"Excise": "excise", "Import": "import duty", "VAT/GST": "VAT/GST"}


def _kind(r: dict) -> int:
    if r["tiered"].strip() == "1" and "SUGAR" in r["basis_tiers"]:
        return SUGAR
    return STRUCTURE[r["structure"].strip()]


def build() -> None:
    path = download(URL, "worldbank-ssb", "SSB-Tax-Database-Aug23.csv")
    rows = [r for r in csv.DictReader(open(path, encoding="utf-8-sig")) if (r["level"] or "").strip()]
    national = [r for r in rows if r["level"].strip() == "National"]
    if not 100 < len(national) < 200:
        raise RuntimeError(f"含糖飲料稅：國家級 {len(national)} 列，跟 2023 年 8 月版的 119 列差太多")
    if any(r["country_code"].strip() == "TWN" or "Taiwan" in r["jurisdiction"] for r in rows):
        raise RuntimeError("含糖飲料稅：資料庫有台灣了，sugar_tax.py 與 laws.ts 的說明要改")

    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        countries = set(json.load(f))
    by_country: dict[str, list[dict]] = {}
    for r in national:
        iso3 = FIX_CODES.get(r["country_code"].strip(), r["country_code"].strip())
        if iso3 not in countries:
            raise RuntimeError(f"含糖飲料稅：不認得的國家代碼 {r['country_code']}（{r['jurisdiction']}）")
        by_country.setdefault(iso3, []).append(r)

    kind: dict[str, list[int]] = {}
    year: dict[str, list[int]] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    for iso3, rs in sorted(by_country.items()):
        rs.sort(key=lambda r: (_kind(r), r["year_imp"]))
        kind[iso3] = [_kind(rs[0])]
        year[iso3] = [min(int(r["year_imp"]) for r in rs)]
        zh, en = [], []
        for r in rs:
            k = _kind(r)
            on = [d for d in DRINKS if r[d[0]].strip() == "1"]
            ins = r["instrument"].strip()
            zh.append(f"{r['year_imp']} 年起，{INSTRUMENT_ZH[ins]}，{KIND_ZH[k]}；課{'、'.join(d[1] for d in on) or '（沒寫）'}"
                      + ("；以健康為目的" if r["health_obj"].strip() == "1" else "")
                      + ("；稅收專款專用" if r["earmarked"].strip() == "1" else ""))
            en.append(f"Since {r['year_imp']}, {INSTRUMENT_EN[ins]}, {KIND_EN[k]}; covers {', '.join(d[2] for d in on) or '(not stated)'}"
                      + ("; health objective" if r["health_obj"].strip() == "1" else "")
                      + ("; revenue earmarked" if r["earmarked"].strip() == "1" else ""))
        hints[iso3] = "。".join(zh)
        hints_en[iso3] = ". ".join(en)
    for iso3 in sorted(countries - set(kind)):
        kind[iso3] = [NONE]

    write_json(OUT / "sugar-tax.json", indicator_file(
        "sugar-tax", "類別", [YEAR], dict(sorted(kind.items())), hints=hints, hintsEn=hints_en, license="CC BY 4.0"))
    write_json(OUT / "sugar-tax-year.json", indicator_file(
        "sugar-tax-year", "年", [YEAR], year, hints=hints, hintsEn=hints_en, license="CC BY 4.0"))

    from collections import Counter
    taxed = {k: v for k, v in kind.items() if v[0] != NONE}
    print(f"  國家級 {len(national)} 列、{len(taxed)} 個國家與屬地：{Counter(v[0] for v in taxed.values())}")
    print(f"  依含糖量分級：{sorted(k for k, v in taxed.items() if v[0] == SUGAR)}")
    print(f"  最早：{sorted((v[0], k) for k, v in year.items())[:8]}；2018 年以後 {sum(v[0] >= 2018 for v in year.values())} 國")
    for iso3 in ("GBR", "MEX", "FRA", "THA", "PHL", "SAU", "ZAF", "JPN", "KOR", "CHN", "USA"):
        print(f"    {iso3}：{kind.get(iso3)} {year.get(iso3)} {hints.get(iso3, '')[:80]}")
    print(f"  州省、市郡級：{[(r['jurisdiction'], r['year_imp']) for r in rows if r['level'].strip() != 'National']}")
