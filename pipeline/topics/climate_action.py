"""各國氣候目標與政策的評等（新主題，2026-11-07，製作手冊第二十五批 480，候選 1139；環境的新小類「碳與氣候政策」）。

Climate Action Tracker（Climate Analytics 與 NewClimate Institute）Data Explorer 的「Country ratings」頁
（https://climateactiontracker.org/cat-data-explorer/country-ratings/，robots.txt 只擋 /icons/ 與 /search/autocomplete/）：
評等嵌在頁面裡的 JSON（country_ratings），一次讀完 40 個經濟體（歐盟算一個，成員國只有德國另外評）。
授權：https://climateactiontracker.org/about/legal/「Any reproduction, in full or in part, must credit Climate Analytics and
NewClimate Institute and must include a copyright notice and must not be used for commercial purposes.」——只准非商業使用、
要署名與版權聲明，資料檔的 license 欄照寫（跟 GHE 的 CC BY-NC-SA 一樣處理）。
- 整體評等與三個分項（政策與行動、NDC 目標對照國內路徑、NDC 目標對照公平份額）同一套 5 級：
  極度不足、嚴重不足、不足、幾乎足夠、1.5°C 相容（1.5°C 全球最低成本、巴黎協定相容都算最後一級）。
- 淨零目標的完整性另一套（可接受、一般、差、資訊不完整、沒有淨零目標）；氣候資金只評已開發國家（其他是不適用）。
- 歐盟的評等也畫在德國以外的 26 個成員國（hint 寫是歐盟整體的評等）。
- 台灣不是 UNFCCC 締約方、CAT 不評（noValue 寫《氣候變遷因應法》第 4 條的 2050 淨零）。
"""

from __future__ import annotations

import json
import re

from common import OUT_DIR, download, indicator_file, now_iso, write_json

OUT = OUT_DIR / "topics" / "climate-action"
URL = "https://climateactiontracker.org/cat-data-explorer/country-ratings/"
SITE = "https://climateactiontracker.org"
LICENSE = "© Climate Analytics and NewClimate Institute; non-commercial use only"
RATING = {
    "critically-insufficient": 1, "highly-insufficient": 2, "insufficient": 3, "almost-sufficient": 4,
    "15c-compatible": 5, "15c-paris-agreement-compatible": 5, "15c-global-least-cost": 5,
}
NET_ZERO = {"acceptable": 3, "average": 2, "poor": 1, "information-incomplete": 0, "no-target": -1}
FINANCE_NA = {"not-applicable": "不是要提供氣候資金的已開發國家，不評", "not-assessed": "CAT 沒有評",
              "information-incomplete": "資訊不完整，CAT 不評"}
FINANCE_NA_EN = {"not-applicable": "Not a developed country expected to provide climate finance; not rated",
                 "not-assessed": "Not assessed by CAT", "information-incomplete": "Information incomplete; not rated by CAT"}
ITEMS = {
    "policies": "rating_policies_and_action", "domestic": "rating_domestic_target",
    "fairshare": "rating_fair_share_target", "finance": "rating_climate_finance", "netzero": "rating_net_zero_target",
}
EU_MEMBERS = ["AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", "GRC", "HUN", "IRL", "ITA", "LVA",
              "LTU", "LUX", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE"]
# 卡片上的字要短；《氣候變遷因應法》第 4 條的 2050 淨零寫在主題的附註
TW_NOTE = "CAT 不評（台灣不是氣候公約的締約方）"
TW_NOTE_EN = "Not rated (Taiwan is not a party to the UN climate convention)"


def _ratings() -> tuple[list[dict], str]:
    path = download(URL, "climate-action-tracker", "country-ratings.html")
    html = path.read_text(encoding="utf-8")
    block = next(b for b in re.findall(r"<script[^>]*>([\s\S]*?)</script>", html) if "country_ratings" in b)
    data = json.loads(block)
    return json.loads(data["country_ratings"]), data["last_update_date"]


def build() -> None:
    rows, updated = _ratings()
    year = int(updated.split()[-1])
    by: dict[str, dict] = {}
    for r in rows:
        iso3 = r["country"]["value"] or ("EU" if r["country"]["label"] == "EU" else None)
        if iso3:
            by[iso3] = r
    if len(by) < 35 or "EU" not in by:
        raise RuntimeError(f"CAT 的評等頁格式變了：{len(by)} 個經濟體")

    def targets(iso3: str) -> list[str]:
        return EU_MEMBERS if iso3 == "EU" else [iso3]

    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    detail: dict[str, dict] = {}
    for iso3, r in by.items():
        date = r["rating_overall"].get("last_update_date", "")
        nz = re.search(r"Year (\d{4})", r.get("rating_net_zero_target", {}).get("label", ""))
        info = {
            "url": SITE + r["country"]["url"], "date": date, "eu": iso3 == "EU",
            "ratings": {k: (r.get(v) or {}).get("value") for k, v in ITEMS.items()},
            "overall": r["rating_overall"]["value"], "netZeroYear": int(nz.group(1)) if nz else None,
            "land": (r.get("rating_land_use_and_forestry") or {}).get("value"),
        }
        for c in targets(iso3):
            detail[c] = info
            hints[c] = (f"歐盟整體的評等（{date}）" if iso3 == "EU" else f"評等日期 {date}")
            hints_en[c] = (f"Rating for the EU as a whole ({date})" if iso3 == "EU" else f"Rated {date}")

    def values(key: str, mapping: dict[str, int]) -> dict[str, list[float | None]]:
        out = {}
        for iso3, r in by.items():
            v = mapping.get((r.get(key) or {}).get("value"))
            if v is not None:
                for c in targets(iso3):
                    out[c] = [v]
        return out

    common = {"hints": hints, "hintsEn": hints_en, "noValue": {"TWN": TW_NOTE}, "noValueEn": {"TWN": TW_NOTE_EN},
              "license": LICENSE}
    write_json(OUT / "overall.json", indicator_file("overall", "類別", [year], values("rating_overall", RATING), **common))
    for item, key in ITEMS.items():
        mapping = NET_ZERO if item == "netzero" else RATING
        extra = dict(common)
        if item == "finance":
            no = dict(extra["noValue"])
            no_en = dict(extra["noValueEn"])
            for iso3, r in by.items():
                v = (r.get(key) or {}).get("value")
                if v in FINANCE_NA:
                    for c in targets(iso3):
                        no[c], no_en[c] = FINANCE_NA[v], FINANCE_NA_EN[v]
            extra["noValue"], extra["noValueEn"] = no, no_en
        write_json(OUT / "sub" / f"{item}.json", indicator_file("sub", "類別", [year], values(key, mapping), **extra))
    write_json(OUT / "detail.json", {"updated": updated, "countries": detail})
    write_json(OUT / "manifest.json", {"topic": "climate-action", "generatedAt": now_iso(),
                                       "sources": [f"Climate Action Tracker country ratings ({updated})"]})
    print(f"  {len(by)} 個經濟體（含歐盟，畫在 {len(EU_MEMBERS)} 個成員國），最新 {updated}")
