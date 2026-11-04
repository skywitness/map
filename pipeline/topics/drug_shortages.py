"""藥品支出與取得：有沒有國家級的線上缺藥登錄（2026-11-04，製作手冊第二十批 329）。

- 歐盟與 EEA 30 國：EMA「Public information on medicine shortages」頁的各國登錄一覽（HTML 表格；EMA 的條款可轉載、
  商業與非商業都可，要註明 EMA）。人用藥寫「no online register」或「No online registers available」的是沒有，
  荷蘭寫「shortages of selected medicines」的是只收部分藥品，其他是有。
- 美國：openFDA drug/shortages 整批檔（CC0 1.0），有登錄；狀態 Current 的筆數與藥名數寫在滑過的說明。
- 台灣：食藥署開放資料「藥品供應通報（有替代藥品）」（匯出 104）、「無替代藥品」（105，目前回「沒有資料」）、「已解除」（106），
  政府資料開放授權條款第 1 版；2023 年起整合成衛福部藥品供應通報處理中心。
- 各國的品項數完全不能比（美國依包裝的 NDC、台灣依許可證、EMA 只收跨國短缺），所以地圖只畫「有沒有登錄」，數字只寫在說明裡。
"""
from __future__ import annotations

import csv
import html
import json
import re
import zipfile

from common import OUT_DIR, download, indicator_file, write_manifest_part, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "medicines"
EMA_URL = ("https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/"
           "medicine-shortages-availability-issues/public-information-medicine-shortages")
US_URL = "https://download.open.fda.gov/drug/shortages/drug-shortages-0001-of-0001.json.zip"
TW_URL = "https://data.fda.gov.tw/data/opendata/export/{n}/csv"
YEAR = 2026
YES, PARTIAL, NO = 1, 2, 3  # src/topics/medicines.ts 的 SHORTAGE_REGISTER


def _ema() -> dict[str, tuple[int, str]]:
    text = download(EMA_URL, "ema", "shortages-info.html").read_text(encoding="utf-8")
    table = text[text.index("<table"):text.index("</table>")]
    out = {}
    for row in re.findall(r"<tr.*?</tr>", table, re.S):
        cells = [" ".join(html.unescape(re.sub(r"<[^>]+>", " ", c)).split()) for c in re.findall(r"<t[dh].*?</t[dh]>", row, re.S)]
        if len(cells) != 2 or cells[0] in ("EU Member State",):
            continue
        name, register = cells
        iso3 = from_name(name)
        if not iso3:
            raise RuntimeError(f"EMA 的缺藥登錄一覽：對不到的國名 {name}")
        human = register.lower()
        if human.startswith("no online registers available") or "human medicines: no online register" in human:
            status = NO
        elif "selected medicines" in human:
            status = PARTIAL
        else:
            status = YES
        out[iso3] = (status, register)
    if len(out) != 30:
        raise RuntimeError(f"EMA 的缺藥登錄一覽應該是 30 國，讀到 {len(out)} 國")
    return out


def build() -> None:
    ema = _ema()
    values = {k: v[0] for k, v in ema.items()}
    hints = {k: "歐盟／EEA，EMA 的一覽：" + ("有國家級的線上缺藥登錄" if v[0] == YES else "只登錄部分藥品的短缺" if v[0] == PARTIAL else "沒有人用藥的線上缺藥登錄")
             for k, v in ema.items()}
    hints_en = {k: "EU/EEA, per EMA: " + ("national online shortage register" if v[0] == YES else "register of shortages of selected medicines only" if v[0] == PARTIAL else "no online register for human medicines")
                for k, v in ema.items()}
    with zipfile.ZipFile(download(US_URL, "shortages", "us.zip")) as z:
        us = json.load(z.open(z.namelist()[0]))
    current = [r for r in us["results"] if r.get("status") == "Current"]
    names = {r.get("generic_name", "").strip().lower() for r in current}
    updated = us["meta"]["last_updated"]
    values["USA"] = YES
    hints["USA"] = f"FDA 的缺藥資料庫：{updated} 有 {len(current):,} 筆短缺中（依包裝的 NDC 算，{len(names)} 種藥）"
    hints_en["USA"] = f"FDA drug shortage database: {len(current):,} current records on {updated} (by package NDC; {len(names)} drugs)"
    tw = {}
    for n in (104, 105, 106):
        with open(download(TW_URL.format(n=n), "shortages", f"tw-{n}.csv"), encoding="utf-8-sig", newline="") as f:
            rows = [r for r in csv.DictReader(f) if r.get("編號") and r["編號"] != "沒有資料"]
        tw[n] = rows
    values["TWN"] = YES
    hints["TWN"] = f"衛福部藥品供應通報處理中心（食藥署開放資料）：有替代藥品的缺藥 {len(tw[104])} 項、沒有替代的 {len(tw[105])} 項、已解除 {len(tw[106])} 項"
    hints_en["TWN"] = f"Ministry of Health and Welfare supply reporting centre (Taiwan FDA open data): {len(tw[104])} shortages with alternatives, {len(tw[105])} without, {len(tw[106])} resolved"
    write_json(OUT / "shortage-register.json", indicator_file(
        "shortage-register", "類別", [YEAR], {c: [v] for c, v in sorted(values.items())}, hints=hints, hintsEn=hints_en))
    write_manifest_part(OUT, "medicines", "shortage-register", {
        "source": "EMA public information on medicine shortages; openFDA drug/shortages (CC0 1.0); Taiwan FDA open data 104–106",
    })
    print(f"  缺藥登錄：{len(values)} 國；有 {sorted(k for k, v in values.items() if v == YES)}；部分 {sorted(k for k, v in values.items() if v == PARTIAL)}；沒有 {sorted(k for k, v in values.items() if v == NO)}")
    print(f"  美國 {len(current)} 筆、{len(names)} 種（{updated}）；台灣 有替代 {len(tw[104])}、無替代 {len(tw[105])}、已解除 {len(tw[106])}")
