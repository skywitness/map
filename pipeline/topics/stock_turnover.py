"""股市規模：周轉率與成交值占 GDP（2026-11-07，製作手冊第二十五批 464，合併候選 1110、1126；步驟 stock-market-turnover，
輸出 topics/stock-market/turnover.json、traded-gdp.json）。

- 各國：世界銀行 WDI 轉載的世界交易所聯合會（WFE）資料（CC BY 4.0，跟 stock_market.py 同一個來源）：
  - turnover.json：本國股票的周轉率 CM.MKT.TRNR（全年成交值 ÷ 市值，%），到 2024 年。
  - traded-gdp.json：股票成交值占 GDP CM.MKT.TRAD.GD.ZS，到 2025 年。
  印度 2018 年的市值是兩個交易所的重複加總（stock_market.py 的 DROP），那一年的周轉率被壓低（30.4%，前後年 47、56），不收。
  latestWithin 4（2021–2025）。
- 台灣（WDI 沒有）：金管會證期局「證券暨期貨市場重要指標」最新一期 12 月份（sources/sfb.py 的 LATEST_DECEMBER_URL，
  政府資料開放授權條款），有最近 11 年：
  - 周轉率：表 35「世界主要證券市場成交值周轉率比較」的臺灣（證期局依 WFE 的月報推計，**只有證交所**、不含櫃買與 TDR）。
  - 成交值占 GDP：表 12 證交所股票總成交值（十億元）＋表 13 櫃買中心上櫃股票總成交值（百萬元，不含興櫃）÷ 主計總處
    名目 GDP。
"""
from __future__ import annotations

import io
import zipfile

from common import OUT_DIR, download, indicator_file, to_series, write_json, write_manifest_part
from sources import dgbas, sfb, worldbank

OUT = OUT_DIR / "topics" / "stock-market"
CODES = {"turnover": "CM.MKT.TRNR", "traded-gdp": "CM.MKT.TRAD.GD.ZS"}
DROP = {"turnover": {"IND": {2018}}}
WITHIN = 4


def _tables() -> dict[str, list[list]]:
    path = download(sfb.LATEST_DECEMBER_URL, "sfb", sfb.LATEST_DECEMBER_URL.rsplit("/", 1)[-1])
    with zipfile.ZipFile(path) as outer:
        inner = zipfile.ZipFile(io.BytesIO(outer.read(sfb._member(outer, r"odf\.zip$"))))
    return {t: sfb._ods_rows(inner.read(sfb._member(inner, rf"^{t}[^0-9-].*\.ods$"))) for t in ("t12", "t13", "t35")}


def _annual(rows: list[list], col: int) -> dict[int, float]:
    """表裡「年」那幾列（第一格是 1990–2100 的數字）的第 col 格"""
    out = {}
    for r in rows:
        r = [c for c in r if c is not None]
        if r and isinstance(r[0], float) and 1990 < r[0] < 2100 and len(r) > col and isinstance(r[col], float):
            out[int(r[0])] = r[col]
    return out


def taiwan() -> dict[str, dict[int, float]]:
    t = _tables()
    turnover = _annual(t["t35"], 1)  # 臺灣是第一欄
    twse = _annual(t["t12"], 1)  # 十億元
    tpex = _annual(t["t13"], 1)  # 上櫃，百萬元
    gdp = {y: v["GDP"] for y, v in dgbas.gdp_by_industry().items() if "GDP" in v}  # 百萬元
    traded = {y: (twse[y] * 1e3 + tpex[y]) / gdp[y] * 100 for y in twse if y in tpex and y in gdp}
    if len(turnover) < 8 or len(traded) < 8:
        raise RuntimeError(f"證期局重要指標的表 12、13、35 格式可能變了：{len(turnover)}、{len(traded)} 年")
    print(f"  台灣周轉率（證交所）{ {y: round(v, 1) for y, v in turnover.items()} }")
    print(f"  台灣成交值占 GDP（上市＋上櫃）{ {y: round(v, 1) for y, v in traded.items()} }")
    return {"turnover": turnover, "traded-gdp": traded}


def build() -> None:
    tw = taiwan()
    for key, code in CODES.items():
        series, world = worldbank.fetch(code, 1975)
        for c, years in DROP.get(key, {}).items():
            series[c] = {y: v for y, v in series.get(c, {}).items() if y not in years}
        series["TWN"] = tw[key]
        first = min(y for s in series.values() for y in s)
        last = max(y for s in series.values() for y in s)
        years = list(range(first, last + 1))
        values = {c: to_series(s, years, 1) for c, s in sorted(series.items()) if s}
        extra = {"aggregates": {"WLD": to_series(world, years, 1)}} if world else {}
        write_json(OUT / f"{key}.json", indicator_file(key, "%", years, values, latestWithin=WITHIN, license="CC BY 4.0", **extra),
                   quiet=True)
        top = sorted(((round(s[max(y for y in s if y >= last - WITHIN)], 1), c) for c, s in series.items()
                      if any(y >= last - WITHIN for y in s)), reverse=True)
        print(f"  {key}（到 {last} 年）{len(top)} 國：最高 {top[:10]}；最低 {top[-8:]}")
    write_manifest_part(OUT, "stock-market", "stock-market-turnover",
                        {"sources": ["World Bank WDI (WFE)", "金管會證期局 證券暨期貨市場重要指標 表 12、13、35"]})
