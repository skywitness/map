"""研發與創新：各國登記的臨床試驗（2026-11-03，製作手冊第十九批 294；輸出到 topics/innovation/）。

**資料**：ClinicalTrials.gov API v2 的統計端點 `/api/v2/stats/field/values?fields=LocationCountry`：每個國家
「至少有一個試驗地點的研究數」（全部年份、全部狀態，累計；多國試驗在每個國家各算一次）。處理日期用
`/api/v2/version` 的 `dataTimestamp`。每百萬人用聯合國《世界人口展望 2024》同一年的年中人口自己算。
**授權（有條件）**：ClinicalTrials.gov 的 Terms and Conditions 要求散布時註明來源是 ClinicalTrials.gov、寫出處理日期、
說明怎麼改動（這裡：依國家數研究、換算每百萬人），並盡量保持最新。處理日期寫在 `src/topics/innovation.ts` 的說明與
資料來源，重跑後日期變了要改那裡（這一步會檢查，沒改就報錯）。
**陷阱**：只算 ClinicalTrials.gov 的登記；日本（jRCT、UMIN）、中國（ChiCTR）、印度（CTRI）主要登記在本國平台，
在這裡偏少。
"""
from __future__ import annotations

import json
from pathlib import Path

from common import OUT_DIR, download, indicator_file, write_json, write_manifest_part
from sources import countries, wpp

OUT = OUT_DIR / "topics" / "innovation"
STATS = "https://clinicaltrials.gov/api/v2/stats/field/values?fields=LocationCountry"
VERSION = "https://clinicaltrials.gov/api/v2/version"
MIN_POP = 1000  # 千人
TOPIC_TS = Path(__file__).resolve().parents[2] / "src" / "topics" / "innovation.ts"
# ClinicalTrials.gov 的國名，pycountry 對不到或會對錯的
NAMES = {
    "Turkey (Türkiye)": "TUR", "South Korea": "KOR", "North Korea": "PRK", "Russian Federation": "RUS",
    "Iran, Islamic Republic of": "IRN", "Korea, Republic of": "KOR", "Taiwan": "TWN", "Macedonia, The Former Yugoslav Republic of": "MKD",
    "North Macedonia": "MKD", "Moldova, Republic of": "MDA", "Congo, The Democratic Republic of the": "COD",
    "Congo": "COG", "Côte D'Ivoire": "CIV", "Lao People's Democratic Republic": "LAO", "Syrian Arab Republic": "SYR",
    "Tanzania": "TZA", "Libyan Arab Jamahiriya": "LBY", "Palestinian Territory, occupied": "PSE",
    "Palestinian Territories, Occupied": "PSE", "Holy See (Vatican City State)": "VAT", "Kosovo": "XKX",
    "Virgin Islands (U.S.)": "VIR", "Micronesia, Federated States of": "FSM", "Bolivia": "BOL", "Venezuela": "VEN",
    "Vietnam": "VNM", "Czechia": "CZE", "Czech Republic": "CZE", "Swaziland": "SWZ", "Eswatini": "SWZ",
    "Cape Verde": "CPV", "Brunei Darussalam": "BRN", "Côte d’Ivoire": "CIV",
    "Bonaire, Saint Eustatius and Saba": "BES", "French Southern and Antarctic Lands": "ATF",
}
# 已經不存在的國家、合計或附屬地區太小的，不畫（印出來確認）
# 「Virgin Islands」分不出是美屬還是英屬
SKIP = {"Former Serbia and Montenegro", "Former Yugoslavia", "Netherlands Antilles", "Czechoslovakia",
        "United States Minor Outlying Islands", "Serbia and Montenegro", "Federal Republic of Yugoslavia", "Virgin Islands"}


def build() -> None:
    stats = json.loads(download(STATS, "clinicaltrials", "location-country.json").read_text(encoding="utf-8"))
    version = json.loads(download(VERSION, "clinicaltrials", "version.json").read_text(encoding="utf-8"))
    processed = version["dataTimestamp"][:10]
    year = int(processed[:4])
    if processed not in TOPIC_TS.read_text(encoding="utf-8"):
        raise RuntimeError(f"ClinicalTrials.gov 的處理日期變成 {processed}，請改 src/topics/innovation.ts 的說明與資料來源")
    field = stats[0]
    counts: dict[str, int] = {}
    skipped, unknown = [], []
    for v in field["topValues"]:
        name, n = v["value"].strip(), v["studiesCount"]
        if name in SKIP:
            skipped.append((name, n))
            continue
        iso3 = NAMES.get(name) or countries.from_name(name)
        if not iso3:
            unknown.append((name, n))
            continue
        counts[iso3] = counts.get(iso3, 0) + n
    if unknown:
        raise RuntimeError(f"ClinicalTrials.gov 的國名對不到國家代碼：{unknown}")
    pop = wpp.demographic(["TPopulation1July"], last_year=year)["TPopulation1July"]
    # 人口不到 100 萬的不算每百萬人（梵蒂岡、摩納哥、紐埃幾個試驗就排第一）
    per_million = {c: n / (pop[c][year] * 1000) * 1e6 for c, n in counts.items() if pop.get(c, {}).get(year, 0) >= MIN_POP}
    extra = {"processed": processed}
    write_json(OUT / "clinical-trials.json", indicator_file(
        "clinical-trials", "件", [year], {c: [n] for c, n in sorted(counts.items())}, **extra))
    write_json(OUT / "clinical-trials-per-million.json", indicator_file(
        "clinical-trials-per-million", "件/百萬人", [year],
        {c: [round(v, 1)] for c, v in sorted(per_million.items())}, **extra))
    write_manifest_part(OUT, "innovation", "clinical-trials", {
        "source": f"ClinicalTrials.gov API v2 (stats/field/values?fields=LocationCountry), data processed {processed}; UN WPP 2024",
        "license": "ClinicalTrials.gov Terms and Conditions (attribution, processing date, modifications stated)",
    })
    top = sorted(counts.items(), key=lambda kv: -kv[1])[:8]
    big = sorted(((v, c) for c, v in per_million.items()), reverse=True)[:8]
    print(f"  臨床試驗：{len(counts)} 國，處理日期 {processed}；最多 {top}；沒填地點 {field['missingStudiesCount']:,} 件；不畫 {skipped}")
    print(f"  每百萬人（{len(per_million)} 國，人口 100 萬以上）：{[(c, round(v)) for v, c in big]}")
    print(f"  台灣 {counts.get('TWN')}（每百萬人 {per_million.get('TWN', 0):.0f}）、日本 {counts.get('JPN')}（{per_million.get('JPN', 0):.0f}）、"
          f"南韓 {counts.get('KOR')}（{per_million.get('KOR', 0):.0f}）、美國 {counts.get('USA')}（{per_million.get('USA', 0):.0f}）、"
          f"中國 {counts.get('CHN')}（{per_million.get('CHN', 0):.0f}）、印度 {counts.get('IND')}（{per_million.get('IND', 0):.1f}）")


if __name__ == "__main__":
    build()
