"""藥品支出與取得：歐洲的傳統草藥藥品註冊（2026-11-08，製作手冊第二十九批 706，候選 1553；步驟 herbal-tur）。

- 來源：EMA《Uptake of the traditional use registration scheme and implementation of the provisions of Directive 2004/24/EC in
  EU Member States》EMA/HMPC/322570/2011 Rev. 7（2017-04-18，截至 2016-12-31；EMA 沒有再出新版）。www.ema.europa.eu 的
  robots.txt 只擋 /core/、/profiles/、/admin/、/search/ 等，沒有擋 /en/documents/。
- Table 1：各國依 Directive 2004/24/EC 收到、審查中、核准、駁回、撤回的傳統使用登記（TUR）件數，歐盟 28 國（含當時的英國）
  與挪威、冰島、列支敦斯登。程式檢查各國加總等於表上的 Total（2,730／574／1,719／240／197）。
  盧森堡的註腳是「No response received」→ 沒有值（不是 0）；列支敦斯登與奧地利有互認協議，0 件。
  Table 2 的完善醫學使用上市許可（WEU MA）是另一條路，不相加，只寫在說明。
- 授權：EMA 網站 Legal notice 原文「Information and documents made available on EMA's webpages are public and may be reproduced
  and / or distributed, totally or in part, irrespective of the means and / or the formats used, for non-commercial and commercial
  purposes, provided that EMA is always acknowledged as the source of the material.」（要註明 EMA；可商用）。
"""
from __future__ import annotations

import re
import subprocess

from common import OUT_DIR, download, indicator_file, write_json
from sources import countries

OUT = OUT_DIR / "topics" / "medicines"
URL = ("https://www.ema.europa.eu/en/documents/report/uptake-traditional-use-registration-scheme-and-implementation-provisions-"
       "directive-200424ec-european-union-member-states_en.pdf")
YEAR = 2016
TOTAL = (2730, 574, 1719, 240, 197)  # 表上的 Total 列（received、under assessment、granted、refused、withdrawn）
NO_RESPONSE = {"Luxembourg"}  # 註腳「No response received」
NAMES = {"Czech Republic": "CZE", "United Kingdom": "GBR"}


def _table1() -> dict[str, tuple[int, ...]]:
    path = download(URL, "ema", "tur-uptake-rev7.pdf")
    txt = path.with_suffix(".txt")
    if not txt.exists() or txt.stat().st_mtime < path.stat().st_mtime:
        subprocess.run(["pdftotext", "-layout", str(path), str(txt)], check=True)
    text = txt.read_text(encoding="utf-8")
    if "EMA/HMPC/322570/2011 Rev. 7" not in text or "until 31 December 2016" not in text:
        raise RuntimeError("EMA 的 TUR 報告版本換了（應該是 Rev. 7、截至 2016-12-31）")
    block = text[text.index("Table 1"): text.index("Table 2")]
    rows: dict[str, tuple[int, ...]] = {}
    for line in block.split("\n"):
        m = re.match(r"^\s*\(?([A-Z][A-Za-z ]+?)\)?\s*\d?\s{2,}(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$", line)
        if m:
            rows[m.group(1).strip()] = tuple(int(m.group(k)) for k in range(2, 7))
    total = rows.pop("Total")
    sums = tuple(sum(v[k] for v in rows.values()) for k in range(5))
    if total != TOTAL or sums != TOTAL or len(rows) != 31:
        raise RuntimeError(f"EMA Table 1 對不上：{len(rows)} 國，各國加總 {sums}，Total 列 {total}（應該是 31 國、{TOTAL}）")
    return rows


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = _table1()
    values, hints, hints_en, nv, nv_en = {}, {}, {}, {}, {}
    for name, (received, assessing, granted, refused, withdrawn) in rows.items():
        code = NAMES.get(name) or countries.from_name(name)
        if not code:
            raise ValueError(f"EMA 的國名對不到代碼：{name}")
        if name in NO_RESPONSE:
            nv[code] = "EMA 的表註明沒有回覆（No response received），不是 0 件"
            nv_en[code] = "EMA’s table notes no response was received, which is not the same as zero"
            continue
        values[code] = [granted]
        hints[code] = f"申請 {received} 件：核准 {granted}、審查中 {assessing}、駁回 {refused}、撤回 {withdrawn}"
        hints_en[code] = f"{received} applications: {granted} granted, {assessing} under assessment, {refused} refused, {withdrawn} withdrawn"
        if name == "Liechtenstein":
            hints[code] += "；列支敦斯登與奧地利有互認協議，承認奧地利核准的登記"
            hints_en[code] += "; Liechtenstein recognises registrations issued by Austria under an agreement"
        if name == "United Kingdom":
            hints[code] += "（2016 年英國還是歐盟會員國）"
            hints_en[code] += " (the UK was an EU member in 2016)"
    nv["TWN"] = "這是歐盟的註冊制度；台灣的中藥要向衛福部辦理查驗登記"
    nv_en["TWN"] = "This is an EU registration scheme; in Taiwan, Chinese medicinal products are registered with the Ministry of Health and Welfare"
    write_json(OUT / "herbal-tur.json", indicator_file("herbal-tur", "件", [YEAR], values, hints=hints, hintsEn=hints_en, noValue=nv,
                                                       noValueEn=nv_en, license="EMA（註明出處，可商用）"))
    top = sorted(values.items(), key=lambda kv: -kv[1][0])
    print(f"  EMA 傳統使用登記（截至 2016-12-31）：{len(values)} 國；" + "、".join(f"{c} {v[0]}" for c, v in top[:12])
          + "；0 件：" + "、".join(c for c, v in values.items() if v[0] == 0))
