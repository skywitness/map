"""中國的海外貸款的擴充（第十四批順序 258，P23，2026-10-31）：Boston University Global Development Policy Center 的
「中國海外開發融資資料庫」（Chinese Overseas Development Finance，CODF）2025 Release。

**資料**：OSF 的 `CODF-Database-Dataset-2025-EN.xlsx`（https://osf.io/download/k6d28/ ，522 KB，不必登入）。
互動版的下載要填表、地理座標檔有密碼與 DUA，都不用。工作表 CODF_2025：1,304 筆貸款，2008–2024 年簽約，
國家開發銀行（CDB）與中國進出口銀行（CHEXIM）兩家政策性銀行對 99 個國家（加上「Regional」）的貸款承諾金額
（Loan Amount，百萬美元，當期）。
**授權**：OSF 專案「Geolocated Dataset of Chinese Overseas Development Finance」（https://osf.io/7wuxv/ ）與子專案
（https://osf.io/gfwhj/ ）標 CC BY 4.0（OSF API，2026-10-30 規劃 session 讀）。

**跟 AidData 的差別**（使用者 2026-10-31 決定並列成兩個指標、說明差別）：AidData 是 2000–2023 年所有中國官方機構
（政府、政策性銀行、國有商業銀行、國有企業）的贈款、貸款與其他融資，2023 年固定美元；CODF 只有兩家政策性銀行的貸款，
2008–2024 年，當期美元，不收贈款與商業銀行。

**輸出**（public/data/topics/china-lending/）：codf-cumulative.json（2008 年到那一年的累計，美元）、codf-annual.json。
「Regional」的貸款沒有借款國，只算進世界合計。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json, write_manifest_part
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "china-lending"
URL = "https://osf.io/download/k6d28/"
YEARS = list(range(2008, 2025))
# pycountry 對不到的國名
ALIASES = {
    "Congo, Republic of the": "COG", "Congo, Democratic Republic of the": "COD", "Iran, Islamic Republic": "IRN",
    "Kyrgyz Republic": "KGZ", "Lao People's Democratic Republic": "LAO", "Türkiye": "TUR", "Côte d’Ivoire": "CIV",
    "Côte d'Ivoire": "CIV", "Russian Federation": "RUS", "Venezuela": "VEN", "Bolivia": "BOL", "Tanzania": "TZA",
    "Vietnam": "VNM", "Micronesia": "FSM", "Gambia, The": "GMB", "Egypt": "EGY", "Kosovo": "XKX",
}
CITATION = ("Boston University Global Development Policy Center. 2025. Chinese Overseas Development Finance Database "
            "(2025 Release). OSF, https://osf.io/7wuxv/ (CC BY 4.0)")


def build() -> None:
    import openpyxl

    wb = openpyxl.load_workbook(download(URL, "codf", "CODF-Database-Dataset-2025-EN.xlsx"), read_only=True)
    rows = list(wb["CODF_2025"].iter_rows(values_only=True))
    head = rows[0]
    col = {h: i for i, h in enumerate(head) if h}
    annual: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    world: dict[int, float] = defaultdict(float)
    unmatched: dict[str, int] = defaultdict(int)
    n = 0
    for r in rows[1:]:
        if not r[col["BU ID"]]:
            continue
        year, amount, name = r[col["Loan Sign Year"]], r[col["Loan Amount (USD M)"]], str(r[col["Country"]] or "").strip()
        if not isinstance(year, int) or not isinstance(amount, (int, float)):
            continue
        n += 1
        usd = amount * 1e6
        world[year] += usd
        if name == "Regional":
            continue
        iso3 = ALIASES.get(name) or from_name(name)
        if not iso3:
            unmatched[name] += 1
            continue
        annual[iso3][year] += usd
    if unmatched:
        raise RuntimeError(f"CODF 對不到的國名：{dict(unmatched)}")
    if min(world) != YEARS[0] or max(world) != YEARS[-1]:
        raise RuntimeError(f"CODF 的年份不是 {YEARS[0]}–{YEARS[-1]}：{min(world)}–{max(world)}")

    def cumulative(series: dict[int, float]) -> list[float]:
        total, out = 0.0, []
        for y in YEARS:
            total += series.get(y, 0.0)
            out.append(round(total))
        return out

    ann = {c: [round(s.get(y, 0.0)) for y in YEARS] for c, s in sorted(annual.items())}
    cum = {c: cumulative(s) for c, s in sorted(annual.items())}
    write_json(OUT / "codf-annual.json", indicator_file(
        "codf-annual", "美元", YEARS, ann, aggregates={"WLD": [round(world.get(y, 0.0)) for y in YEARS]}))
    write_json(OUT / "codf-cumulative.json", indicator_file(
        "codf-cumulative", "美元", YEARS, cum, aggregates={"WLD": cumulative(world)}))
    write_manifest_part(OUT, "china-lending", "codf", {"source": CITATION, "loans": n})
    top = sorted(cum.items(), key=lambda kv: -kv[1][-1])[:6]
    print(f"  CODF：{n} 筆貸款、{len(cum)} 國，{YEARS[0]}–{YEARS[-1]} 年合計 {sum(world.values()) / 1e8:,.0f} 億美元；"
          "最多 " + "、".join(f"{c} {v[-1] / 1e8:,.0f} 億" for c, v in top))


if __name__ == "__main__":
    build()
