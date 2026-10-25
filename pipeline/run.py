"""資料管線入口。

    python pipeline/run.py               # 全部重建
    python pipeline/run.py geo population # 只跑指定步驟
    python pipeline/run.py --refresh ...  # 忽略下載快取，重新抓原始資料

新增主題：在 topics/ 放一支有 build() 的模組，並加進 STEPS。
"""
from __future__ import annotations

import argparse
import importlib
import time

import common

STEPS = {
    "geo": "build_geo",
    "population": "topics.population",
    "population-grid": "topics.population_grid",  # 要先有 geo 的國界；第一次會下載 460 MB
    # 人口密度的 1 km 網格圖磚（不進版本控制，部署時產生）；第一次會下載 12 期、共 5.8 GB
    "population-density-tiles": "topics.population_density_tiles",
    "income": "topics.income",
    "sectors": "topics.sectors",
    "agriculture": "topics.agriculture",
    "electricity": "topics.electricity",
    "industry": "topics.industry",
    "ai": "topics.ai",
    "transport": "topics.transport",
    "climate": "topics.climate",
    "military": "topics.military",
    "digital": "topics.digital",
    "health": "topics.health",
    "disease": "topics.disease",  # 第一次會向 WHO 查 24 年的死因資料（約 15 分鐘、40 MB）
    "diet": "topics.diet",  # 第一次會下載約 130 MB（FAOSTAT 糧食平衡表新舊兩版、糧食安全指標）
    "education": "topics.education",
    "tourism": "topics.tourism",
    "housing": "topics.housing",
    "trade": "topics.trade",  # 第一次會下載約 1.2 GB（BACI、FAOSTAT 詳細貿易矩陣）
    "language": "topics.language",
    "elevation": "topics.elevation",  # 要先有 geo 的國界；第一次會下載約 760 MB（GMTED2010）
    "migration": "topics.migration",  # 第一次會向 UNHCR 查 36 年的難民資料（約 2 分鐘）
    "religion": "topics.religion",
    "inequality": "topics.inequality",  # 第一次會下載 WID 整包（約 890 MB），抽出變數要幾分鐘
    "gender": "topics.gender",
    "wages": "topics.wages",
    "fiscal": "topics.fiscal",
    "innovation": "topics.innovation",
    "wealth": "topics.wealth",
    "temperature": "topics.temperature",  # 第一次會下載 CRU TS 的月平均氣溫與降雨網格
    # 暖化（近 10 年平均與 1951–1980 年的差）的網格圖磚（不進版本控制，部署時產生）
    "temperature-grid-tiles": "topics.temperature_grid_tiles",
    "air-quality": "topics.air_quality",
    "water-forest": "topics.water_forest",
    "ev": "topics.ev",
    "earthquakes": "topics.earthquakes",  # 要先有 geo 的國界
    "democracy": "topics.democracy",  # 第一次會下載約 34 MB（V-Dem v16 的 RData）
    "taiwan-diplomacy": "topics.taiwan_diplomacy",
    # 要先有 geo 的國界；第一次會下載 IBTrACS v04r01（333 MB，NCEI 單一連線很慢，見 DESIGN.md 第 8 節）
    "typhoons": "topics.typhoons",
    "power-plants": "topics.power_plants",  # 第一次會下載 GEM 公開地圖的資料檔（約 62 MB）
    # 要先有 geo 的國界；第一次會下載 Global Solar Atlas 的 PVOUT（345 MB）與 Global Wind Atlas 的 0.02° 縮小版（182 MB）
    "renewables": "topics.renewables",
    # 太陽能、風能潛力的約 2 km 網格圖磚（不進版本控制，部署時產生）；下載同上，約 3 分鐘
    "renewables-grid-tiles": "topics.renewables_grid_tiles",
    # 第一次會下載 GWIS 的整包（約 12 MB），並向 GWIS API 查各國面積約 230 次（約 6 分鐘）
    "wildfires": "topics.wildfires",
    "passport": "topics.passport",
    "organizations": "topics.organizations",
    "un-votes": "topics.un_votes",
    "conflict": "topics.conflict",
    "nobel": "topics.nobel",  # 約 25 次 API 與 Wikidata 查詢；每年 10 月公布新得主後要加 --refresh
    "fertility": "topics.fertility",
    # GHSL Urban Centre Database 2025 與各國城鄉人口（約 43 MB）、Wikidata 的地點（兩次查詢約 1 分鐘）與中文名稱
    # （約 130 次查詢）、內政部戶政司的縣市人口；之後用快取約 30 秒
    "cities": "topics.cities",
    "crime": "topics.crime",
    "tobacco-alcohol": "topics.tobacco_alcohol",
    "happiness": "topics.happiness",
    # 第一次會向 TeleGeography 一條一條抓 713 條電纜的明細（每次間隔 0.4 秒，約 18 分鐘）
    "submarine-cables": "topics.submarine_cables",
    "road-safety": "topics.road_safety",  # WHO（GHO、GSRRS 2023）與交通部統計查詢網
    "semiconductors": "topics.semiconductors",  # 讀貿易主題已下載的 BACI（約 800 MB），一兩分鐘；另外查財政部兩個小檔
    "minerals": "topics.minerals",  # 第一次會下載 MCS 2020–2026 各礦種章節的 PDF（約 110 個、36 MB）
    "employment": "topics.employment",
    "reserves": "topics.reserves",
    "stock-market": "topics.stock_market",
    # OECD 的房價指標（約 17 MB）、BIS 的住宅價格、內政部不動產資訊平台、主計總處的消費者物價（約 27 MB）
    "house-prices": "topics.house_prices",
    "travel": "topics.travel",  # IANA 時區（tzdata 套件）、Wikidata、維基百科
    "world-heritage": "topics.world_heritage",  # UNESCO DataHub、Wikidata 的中文名稱（約 30 次查詢）
    "space": "topics.space",  # 第一次會下載 GCAT 的 satcat 與 launch（約 33 MB）
    "olympics": "topics.olympics",  # 第一次會向維基百科查 56 屆的獎牌榜（約 1 分鐘）
    # 要先有 geo 的國界；第一次會從 Zenodo 下載 2013–2024 年的 VIIRS 夜間燈光（12 個檔、共約 800 MB，
    # Zenodo 每條連線很慢，平行下載約 20 分鐘），GHS-POP 用人口網格的快取（2015、2020、2025 三期）
    "night-lights": "topics.night_lights",
    # 夜間燈光的約 500 m 網格圖磚（不進版本控制，部署時產生）；4 期，每期約 31 MB、5 千張
    "night-lights-tiles": "topics.night_lights_tiles",
    "compact": "compact",  # 把還沒壓縮的舊指標檔改成差分編碼（各主題輸出時已經會壓縮）
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("steps", nargs="*", help=f"要執行的步驟（{', '.join(STEPS)}），預設全部")
    parser.add_argument("--refresh", action="store_true", help="重新下載原始資料")
    args = parser.parse_args()
    unknown = [s for s in args.steps if s not in STEPS]
    if unknown:
        parser.error(f"未知的步驟：{', '.join(unknown)}")
    common.REFRESH = args.refresh

    for step in args.steps or STEPS:
        print(f"[{step}]")
        started = time.perf_counter()
        importlib.import_module(STEPS[step]).build()
        print(f"  完成，{time.perf_counter() - started:.1f} 秒")


if __name__ == "__main__":
    main()
