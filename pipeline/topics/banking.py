"""銀行與信貸（新主題，2026-11-07，製作手冊第二十五批 463，合併候選 1105、1106；步驟 banking，輸出 topics/banking/）。

- World Bank WDI（CC BY 4.0，sources/worldbank.py）：
  - private-credit.json：國內銀行對私部門的信貸占 GDP（FS.AST.PRVT.GD.ZS）。
  - broad-money.json：廣義貨幣占 GDP（FM.LBL.BMNY.GD.ZS）。
  - npl.json：不良貸款占總貸款（FB.AST.NPER.ZS，原始資料是 IMF Financial Soundness Indicators）。
  - capital.json：銀行資本占資產（FB.BNK.CAPA.ZS，同上）。
  缺漏多，前端用 latestWithin（信貸與貨幣 4：2025 年看 2021–2025；壞帳與資本 3，因為台灣的逾放比是 2026 年的）。
- 台灣（WDI 沒有）：
  - 私部門信貸：中央銀行「金融機構放款與投資及金融市場票債券發行餘額」（data.gov.tw 10748，政府資料開放授權條款，
    `LOAN-S.csv`）的「放款含催收及轉銷呆帳」年底餘額 ÷ 主計總處名目 GDP。口徑比 WDI 寬：含對政府與公營事業的放款、
    也含已經轉銷的呆帳，說明寫明。**這個 CSV 的數字有千分位逗號卻沒有加引號**（「209,517,170,641,…」），
    只讀前三欄：小計 = 放款 + 投資，用這個關係把千分位的組拆回三個數字。
  - 不良貸款：金管會銀行局「本國銀行逾放等財務資料」（data.gov.tw 10525，`banking12.csv`）各銀行的逾期放款總額 ÷
    放款總額，當月快照（檔尾寫「資料月份：115年08月」），放在 2026 年。不含外商銀行與農漁會信用部。
  - 廣義貨幣、銀行資本：留空。
"""
from __future__ import annotations

import csv
import io
import re

from common import OUT_DIR, download, indicator_file, now_iso, to_series, write_json
from sources import dgbas, worldbank

OUT = OUT_DIR / "topics" / "banking"
CODES = {
    "private-credit": ("FS.AST.PRVT.GD.ZS", 4),
    "broad-money": ("FM.LBL.BMNY.GD.ZS", 4),
    "npl": ("FB.AST.NPER.ZS", 3),
    "capital": ("FB.BNK.CAPA.ZS", 3),
}
LOAN_S = "https://www.cbc.gov.tw/public/data/OpenData/%E7%B6%93%E7%A0%94%E8%99%95/LOAN-S.csv"
BANKING12 = "https://www.banking.gov.tw/webdowndoc?file=/stat/itopendata/banking12.csv"
# WDI 明顯錯的值（2026-11-07 逐年比對：前後一年差 3 倍以上的都看過）：科威特私部門信貸 2019 年 92.0% → 2020 年 6.0%
# 之後都在 3.5–6%（同年廣義貨幣 102.7%，是序列斷點）、格瑞那達廣義貨幣 2024 年 7.6%（前後 89.0、92.0）；
# 獅子山 2014 年以前的廣義貨幣上萬 %、約旦 2015 年以前的資本占資產 266.6% 這類超過上限的整段不用
DROP = {"private-credit": {"KWT": lambda y: y >= 2020}, "broad-money": {"GRD": lambda y: y == 2024}}
CAP = {"broad-money": 1000, "capital": 100}
NO_TW = {
    "broad-money": ({"TWN": "世界銀行沒有台灣的廣義貨幣"}, {"TWN": "The World Bank has no broad money figure for Taiwan"}),
    "capital": ({"TWN": "世界銀行沒有台灣的銀行資本比率"}, {"TWN": "The World Bank has no bank capital ratio for Taiwan"}),
}


def _numbers(tokens: list[str], count: int) -> list[list[int]]:
    """把沒加引號的千分位逗號拆開的欄位，組回 count 個數字的所有可能（第一組 1–3 位數，後面每組正好 3 位數）"""
    if count == 0:
        return [[]]
    out = []
    for n in range(1, min(len(tokens), 5) + 1):
        head, rest = tokens[:n], tokens[n:]
        if not (1 <= len(head[0]) <= 3 and (len(head[0]) == 1 or not head[0].startswith("0"))):
            continue
        if any(len(t) != 3 for t in head[1:]):
            continue
        for tail in _numbers(rest, count - 1):
            out.append([int("".join(head))] + tail)
    return out


def _taiwan_loans() -> dict[int, float]:
    """{西元年: 年底放款含催收及轉銷呆帳（億元）}，只讀年資料（「91年」這種列）"""
    path = download(LOAN_S, "cbc", "LOAN-S.csv")
    out: dict[int, float] = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        m = re.match(r"^(\d{2,3})年,(.*)$", line.strip())
        if not m:
            continue
        tokens = [t for t in m.group(2).split(",") if t != ""]
        fits = {c[1] for c in _numbers(tokens[:12], 3) if c[0] == c[1] + c[2]}
        if len(fits) != 1:
            raise RuntimeError(f"央行 LOAN-S 這一列拆不出唯一的放款金額：{line[:80]}")
        out[int(m.group(1)) + 1911] = fits.pop()
    if len(out) < 20:
        raise RuntimeError(f"央行 LOAN-S 的年資料只有 {len(out)} 列，格式可能變了")
    return out


def _taiwan_npl() -> tuple[int, float, int]:
    """(西元年, 本國銀行逾放比 %, 家數)"""
    path = download(BANKING12, "fsc", "banking12.csv")
    text = path.read_text(encoding="utf-8-sig")
    m = re.search(r"資料月份：(\d{2,3})年(\d{1,2})月", text)
    if not m:
        raise RuntimeError("金管會 banking12.csv 找不到「資料月份」")
    loans = overdue = banks = 0
    for r in csv.DictReader(io.StringIO(text)):
        try:
            loans += float(r["放款總額"])
            overdue += float(r["逾期放款總額"])
            banks += 1
        except (KeyError, TypeError, ValueError):
            continue
    if banks < 30:
        raise RuntimeError(f"金管會 banking12.csv 只讀到 {banks} 家銀行")
    return int(m.group(1)) + 1911, overdue / loans * 100, banks


def _latest(series: dict[str, dict[int, float]], last: int, within: int) -> list[tuple[float, str, int]]:
    out = []
    for c, s in series.items():
        ys = [y for y in s if last - within <= y <= last]
        if ys:
            y = max(ys)
            out.append((round(s[y], 1), c, y))
    return sorted(out, reverse=True)


def build() -> None:
    gdp = {y: v["GDP"] for y, v in dgbas.gdp_by_industry().items() if "GDP" in v}  # 百萬元
    loans = _taiwan_loans()  # 億元
    tw_credit = {y: v * 100 / gdp[y] * 100 for y, v in loans.items() if y in gdp}
    npl_year, npl_tw, banks = _taiwan_npl()
    print(f"  台灣：放款占 GDP {[(y, round(v, 1)) for y, v in sorted(tw_credit.items())[-4:]]}；"
          f"本國銀行逾放比 {npl_year} 年 {npl_tw:.3f}%（{banks} 家）")
    for name, (code, within) in CODES.items():
        series, world = worldbank.fetch(code, 1960, 2030)
        for c, bad in DROP.get(name, {}).items():
            series[c] = {y: v for y, v in series.get(c, {}).items() if not bad(y)}
        if name in CAP:
            series = {c: {y: v for y, v in s.items() if abs(v) <= CAP[name]} for c, s in series.items()}
        series = {c: s for c, s in series.items() if s}
        if name == "private-credit":
            series["TWN"] = tw_credit
        if name == "npl":
            series["TWN"] = {npl_year: npl_tw}
        first = min(y for s in series.values() for y in s)
        last = max(y for s in series.values() for y in s)
        years = list(range(first, last + 1))
        values = {c: to_series(s, years, 3 if name == "npl" and c == "TWN" else 1) for c, s in sorted(series.items())}
        no_zh, no_en = NO_TW.get(name, (None, None))
        extra = {"noValue": no_zh, "noValueEn": no_en} if no_zh else {}
        if world:
            extra["aggregates"] = {"WLD": to_series(world, years, 1)}
        write_json(OUT / f"{name}.json", indicator_file(name, "%", years, values, latestWithin=within, license="CC BY 4.0", **extra),
                   quiet=True)
        top = _latest(series, 2025, within)
        print(f"  {name} 2025（{within + 1} 年內）{len(top)} 國：最高 {top[:8]}；最低 {top[-8:]}")
        for c in ("USA", "JPN", "CHN", "KOR", "DEU", "GBR", "HKG", "SGP", "TWN"):
            print(f"    {c} {_latest({c: series.get(c, {})}, last, within)}")
    write_json(OUT / "manifest.json", {"topic": "banking", "generatedAt": now_iso(),
                                       "sources": ["World Bank WDI", "中央銀行 LOAN-S", "金管會銀行局 banking12"]})
