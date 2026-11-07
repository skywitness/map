"""外匯存底與外債：外債是用誰的貨幣計價的（2026-11-07，製作手冊第二十五批 460，候選 1109；步驟 reserves-debt-currency，
輸出 topics/reserves/debt-currency/<幣別>.json）。

- World Bank International Debt Statistics（sources/worldbank_ids.py，CC BY 4.0）：公共與公共保證長期外債（PPG）裡各種貨幣
  計價的比例，DT.CUR.USDL/EURO/JYEN/UKPS/SWFR/SDRW/MULC/OTHC.ZS，1970 年起（歐元 2001 年起），約 120 個中低所得、向世界銀行
  報告債務的國家。不含民間外債與短期債；高所得國家（含台灣、日本、美國）不在 IDS。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import worldbank_ids

OUT = OUT_DIR / "topics" / "reserves" / "debt-currency"
FIRST = 1970
CURRENCIES = {"usd": "DT.CUR.USDL.ZS", "eur": "DT.CUR.EURO.ZS", "jpy": "DT.CUR.JYEN.ZS", "gbp": "DT.CUR.UKPS.ZS",
              "chf": "DT.CUR.SWFR.ZS", "sdr": "DT.CUR.SDRW.ZS", "multi": "DT.CUR.MULC.ZS", "other": "DT.CUR.OTHC.ZS"}


def build() -> None:
    no = {"TWN": "只有向世界銀行報告債務的中低所得國家"}
    no_en = {"TWN": "Only low- and middle-income countries that report debt to the World Bank"}
    for key, code in CURRENCIES.items():
        s = worldbank_ids.series(code)
        last = max(y for v in s.values() for y in v)
        years = list(range(FIRST, last + 1))
        values = {c: to_series(v, years, 1) for c, v in sorted(s.items())}
        write_json(OUT / f"{key}.json", indicator_file("debt-currency", "%", years, values, noValue=no, noValueEn=no_en,
                                                       license="CC BY 4.0"), quiet=True)
        for y in (2024, last):
            top = sorted(((round(v[y], 1), c) for c, v in s.items() if y in v), reverse=True)
            print(f"  {key} {y}：{len(top)} 國；最高 {top[:8]}；最低 {top[-6:]}")
