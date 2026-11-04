"""國際組織：WHO 的會員與六大區域（2026-11-04，製作手冊第二十批 305）。

使用者 2026-11-04 決定：只在 GHO 的指標不用，WHO 的會員與區域當事實自行整理（同國際組織主題 PIC/S 的做法）。
- **會員國**：WHO 官網「Countries」頁（https://www.who.int/countries）列的 194 個會員國（連結是 /countries/<ISO3>）。
- **區域與會員身分**：WHO 官網每個國家頁顯示的「WHO region」與會員身分，頁面是從 WHO 的國家參照資料
  （`https://xmart-api-public.who.int/refmart/ref_country`，欄位 GRP_WHO_REGION、WHO_LEGAL_STATUS）讀的，這裡一次讀那份
  參照資料，只取這兩個事實；會員國的清單跟 Countries 頁核對，不一樣就報錯。
- 地圖畫會員國（M）、準會員（A：波多黎各、托克勞、法羅群島）與屬地（T：參照資料寫了它歸哪個區域辦事處，例如格陵蘭在歐洲區）
  的區域；不是會員的列支敦斯登、教廷，與台灣、西撒哈拉（參照資料寫「不列入 WHO 出版品」）不畫，寫原因。
"""
from __future__ import annotations

import json
import re
from datetime import date

from common import OUT_DIR, download, indicator_file, write_manifest_part, write_json

OUT = OUT_DIR / "topics" / "organizations"
COUNTRIES_URL = "https://www.who.int/countries"
REF_URL = "https://xmart-api-public.who.int/refmart/ref_country"
# src/topics/organizations.ts 的 WHO_REGIONS
REGIONS = {"AFR": 1, "AMR": 2, "SEAR": 3, "EUR": 4, "EMR": 5, "WPR": 6}
EXPECTED = {"AFR": 47, "AMR": 35, "SEAR": 10, "EUR": 53, "EMR": 21, "WPR": 28}  # 2026-11-04 的會員國數
STATUS_ZH = {"A": "WHO 的準會員（不是會員國）", "T": "屬地，由這個區域辦事處涵蓋（不是會員國）"}
STATUS_EN = {"A": "Associate Member of WHO (not a Member State)", "T": "Territory covered by this regional office (not a Member State)"}
NOT_MEMBER = {
    "LIE": ("列支敦斯登是聯合國會員國，但不是 WHO 會員國", "Liechtenstein is a UN member but not a WHO Member State"),
    "VAT": ("教廷不是 WHO 會員國", "The Holy See is not a WHO Member State"),
    "TWN": ("台灣不是 WHO 會員國，不屬於任何 WHO 區域辦事處；WHO 的資料把台灣寫成「Taiwan, China」並排除在出版品之外",
            "Taiwan is not a WHO Member State and belongs to no WHO regional office; WHO lists it as “Taiwan, China” and excludes it from its publications"),
    "ESH": ("西撒哈拉不是 WHO 會員國（WHO 的參照資料寫不列入出版品）", "Western Sahara is not a WHO Member State (excluded from WHO publications)"),
}


def build() -> None:
    year = date.today().year
    html = download(COUNTRIES_URL, "who", "countries.html").read_text(encoding="utf-8")
    members = {c.upper() for c in re.findall(r'href="/countries/([a-z]{3})"', html)}
    ref = json.loads(download(REF_URL, "who", "ref_country.json").read_text(encoding="utf-8"))["value"]
    ref_members = {r["CODE_ISO_3"] for r in ref if r["WHO_LEGAL_STATUS"] == "M"}
    if members != ref_members or len(members) != 194:
        raise RuntimeError(f"WHO 會員國：Countries 頁 {len(members)} 個、參照資料 {len(ref_members)} 個，"
                           f"差 {sorted(members ^ ref_members)}")
    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        ids = set(json.load(f))
    values, notes, notes_en = {}, {}, {}
    counts = {k: 0 for k in REGIONS}
    for r in ref:
        iso3, status, region = r["CODE_ISO_3"], r["WHO_LEGAL_STATUS"], r["GRP_WHO_REGION"]
        if iso3 not in ids:
            continue
        if status in ("M", "A", "T") and region in REGIONS:
            values[iso3] = [REGIONS[region]]
            if status == "M":
                counts[region] += 1
            else:
                notes[iso3], notes_en[iso3] = STATUS_ZH[status] + "。", STATUS_EN[status] + "."
    # 沒有區域的原因寫在前端指標的 noValue（src/topics/organizations.ts 的 WHO_NO_VALUE；主題的 noValue 排在檔案的前面）
    for iso3 in NOT_MEMBER:
        if iso3 in values:
            raise RuntimeError(f"{iso3} 應該不畫")
    if counts != EXPECTED:
        raise RuntimeError(f"WHO 各區域的會員國數跟 2026-11-04 不同：{counts}（預期 {EXPECTED}）")
    # 常被誤會的幾個（區域不是地理區域）
    expect = {"PAK": "EMR", "AFG": "EMR", "MAR": "EMR", "SOM": "EMR", "ISR": "EUR", "GRL": "EUR", "PRK": "SEAR",
              "IDN": "WPR", "MYS": "WPR", "PHL": "WPR", "SGP": "WPR", "CHN": "WPR", "IND": "SEAR"}
    got = {k: next(r for r in ref if r["CODE_ISO_3"] == k)["GRP_WHO_REGION"] for k in expect}
    if got != expect:
        raise RuntimeError(f"WHO 區域跟預期不同：{ {k: v for k, v in got.items() if v != expect[k]} }")
    write_json(OUT / "who-region.json", indicator_file(
        "who-region", "", [year], dict(sorted(values.items())), notes=notes, notesEn=notes_en))
    write_manifest_part(OUT, "organizations", "who-region", {
        "source": "WHO, Countries (https://www.who.int/countries) and the WHO country reference data shown on each country page "
                  "(refmart/ref_country: GRP_WHO_REGION, WHO_LEGAL_STATUS); facts compiled by hand",
        "accessed": date.today().isoformat(),
    })
    print(f"  WHO：會員國 194，各區域 {counts}；畫 {len(values)} 個地方（含準會員與屬地 {len(notes)}）")
