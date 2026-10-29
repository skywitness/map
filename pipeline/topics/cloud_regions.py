"""雲端機房的區域（新主題，科技與交通類，2026-10-29，製作手冊第五批 59）：AWS、Google Cloud、Microsoft Azure 的公有雲區域。

使用者 2026-10-29 決定：只做這三家，區域清單手工整理成事實表（sources/cloud_regions.py，不爬 AWS 的網站）。

- 點：每個區域一個點，在業者寫的城市（業者不公開機房位置），依開放（GA）的年份累積出現，顏色是業者。
  同一個城市有兩三家的（東京、新加坡…）依業者稍微錯開，才看得到每一家。
- 預覽中的區域（PREVIEW：Azure Taiwan North、Southeast Asia 3）另外一個圖層，只在最後一年出現，不算進國家的區域數。
- 國家的值：這一年開放的區域數（三家合計）。區域的大小（可用區數）三家不同，數量只能大概比較。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, points_file, write_json
from sources import cloud_regions

OUT = OUT_DIR / "topics" / "cloud-regions"
LAST_YEAR = 2026
PROVIDERS = {"aws": 1, "google": 2, "azure": 3}
OFFSET = {"aws": -0.12, "google": 0.0, "azure": 0.12}  # 經度錯開（度）
# 中國境內由當地業者營運的區域、限制存取的區域（sources/cloud_regions.py 的註解）
CHINA_PARTNER = {"cn-north-1": "光環新網", "cn-northwest-1": "西云數據", "chinaeast2": "世紀互聯", "chinanorth2": "世紀互聯",
                 "chinanorth3": "世紀互聯", "chinaeast3": "世紀互聯"}
CHINA_PARTNER_EN = {"光環新網": "Sinnet", "西云數據": "NWCD", "世紀互聯": "21Vianet"}
RESTRICTED = {"australiacentral2", "brazilsoutheast", "francesouth", "germanynorth", "norwaywest", "southafricawest",
              "switzerlandwest", "uaecentral", "chinaeast3", "me-central2"}
# 預覽中（Microsoft Learn 標示 preview，2026-10-27）
PREVIEW = [
    ("azure", "taiwannorth", "Taiwan North", "Taipei", "TWN", 25.03, 121.57),
    ("azure", "southeastasia3", "Southeast Asia 3", "Johor Bahru", "MYS", 1.49, 103.74),
]


def build() -> None:
    years = list(range(min(r[7] for r in cloud_regions.REGIONS), LAST_YEAR + 1))
    counts: dict[str, list[int]] = defaultdict(lambda: [0] * len(years))
    rows = []
    for provider, code, name, city, iso3, lat, lon, year, _src in cloud_regions.REGIONS:
        for i in range(year - years[0], len(years)):
            counts[iso3][i] += 1
        partner = CHINA_PARTNER.get(code)
        rows.append({
            "lon": round(lon + OFFSET[provider], 3), "lat": round(lat, 3), "p": PROVIDERS[provider], "y": year,
            "r": 1 if code in RESTRICTED else 0, "code": code, "name": name, "city": city, "iso3": iso3,
            "op": partner, "opEn": CHINA_PARTNER_EN.get(partner) if partner else None,
        })
    preview = [{"lon": round(lon + OFFSET[p], 3), "lat": round(lat, 3), "p": PROVIDERS[p], "code": code, "name": name,
                "city": city, "iso3": iso3} for p, code, name, city, iso3, lat, lon in PREVIEW]
    rows.sort(key=lambda r: (r["y"], r["p"], r["code"]))
    fields = ["lon", "lat", "p", "y", "r", "code", "name", "city", "iso3", "op", "opEn"]
    scale = {"lon": 0.001, "lat": 0.001, "p": 1, "y": 1, "r": 1}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "regions.json", points_file(rows, fields, scale, strings=("iso3", "city")))
    write_json(OUT / "preview.json", points_file(preview, ["lon", "lat", "p", "code", "name", "city", "iso3"],
                                                 {"lon": 0.001, "lat": 0.001, "p": 1}))
    world = [sum(c[i] for c in counts.values()) for i in range(len(years))]
    write_json(OUT / "regions-count.json", indicator_file(
        "regions-count", "個", years, dict(sorted(counts.items())), aggregates={"WLD": world}))
    write_json(OUT / "manifest.json", {"topic": "cloud-regions", "generatedAt": now_iso(),
                                       "sources": ["AWS, Google Cloud and Microsoft Azure region lists and launch announcements, "
                                                   "compiled by hand (pipeline/sources/cloud_regions.py)"]})
    by_provider = defaultdict(int)
    for r in cloud_regions.REGIONS:
        by_provider[r[0]] += 1
    top = sorted(((c[-1], k) for k, c in counts.items()), reverse=True)
    print(f"  雲端區域 {len(rows)} 個（{dict(by_provider)}），{len(counts)} 國；{years[0]}–{LAST_YEAR}；最多 {top[:10]}；"
          f"台灣 {counts.get('TWN', [0])[-1]}；預覽 {len(preview)} 個")


if __name__ == "__main__":
    build()
