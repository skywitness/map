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
    # WHO GHO 的 WUENIC、世界銀行、OWID 的 COVID-19 資料（約 180 MB）、The Economist 的超額死亡（約 11 MB）、
    # 衛福部死因統計（疾病主題的同一個檔，約 9 MB）
    "vaccination": "topics.vaccination",
    "diet": "topics.diet",  # 第一次會下載約 130 MB（FAOSTAT 糧食平衡表新舊兩版、糧食安全指標）
    "education": "topics.education",
    "pisa": "topics.pisa",  # OECD PISA 2025 Volume I 的兩個 Excel（約 2.8 MB）
    # NCD-RisC 的成人身高（2.4 MB）與兒童青少年身高（4.6 MB 的 zip），伺服器常斷線，用 curl 續傳；WPP 的年齡別人口
    "height": "topics.height",
    "blood-types": "topics.blood_types",
    "tourism": "topics.tourism",
    "housing": "topics.housing",
    "trade": "topics.trade",  # 第一次會下載約 1.2 GB（BACI、FAOSTAT 詳細貿易矩陣）
    "language": "topics.language",
    "elevation": "topics.elevation",  # 要先有 geo 的國界；第一次會下載約 760 MB（GMTED2010）
    "migration": "topics.migration",  # 第一次會向 UNHCR 查 36 年的難民資料（約 2 分鐘）
    # OECD DAC 的 DAC1 與 DAC2A（約 75 MB 的 CSV，一兩分鐘）、世界銀行的僑匯、中央銀行的國際收支；
    # 台灣的 GDP 用 reserves 主題的主計總處與央行匯率
    "aid": "topics.aid",
    # AidData GCDF 3.0 的 zip（28.6 MB，xlsx 讀一次約 15 秒，之後用 .pkl 快取）；也讀人均收入的 GDP、人口主題的總人口
    "china-lending": "topics.china_lending",
    "religion": "topics.religion",
    "inequality": "topics.inequality",  # 第一次會下載 WID 整包（約 890 MB），抽出變數要幾分鐘
    "gender": "topics.gender",
    "wages": "topics.wages",
    "fiscal": "topics.fiscal",
    # OECD 的公司稅、個人所得稅最高稅率、勞動稅負（SDMX，約 16 MB）；VAT 與台灣的稅率寫在 sources/oecd_tax.py、tw_tax_law.py
    "taxes": "topics.taxes",
    # 要先有 geo 的國界；第一次會向 Overpass 發 27 個查詢（9 個品牌、6 種店型的名稱比對、便利商店 12 個經度帶，
    # 約 72 MB，公用伺服器忙的時候要兩三個小時）
    "chain-stores": "topics.chain_stores",
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
    "governance": "topics.governance",  # World Bank API 的 WGI，六個面向各 6 個序列（36 次查詢，約 1 分鐘）
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
    # UN World Marriage Data（約 26 MB）、UNdata 的結婚與離婚對數（第一次約 220 頁網頁，每頁間隔 0.3 秒，約 4 分鐘）、
    # Eurostat、OECD Family Database、內政部戶政司、主計總處
    "marriage": "topics.marriage",
    "laws": "topics.laws",  # 自行整理的表，不必下載
    # GHSL Urban Centre Database 2025 與各國城鄉人口（約 43 MB）、Wikidata 的地點（兩次查詢約 1 分鐘）與中文名稱
    # （約 130 次查詢）、內政部戶政司的縣市人口；之後用快取約 30 秒
    "cities": "topics.cities",
    "crime": "topics.crime",
    "tobacco-alcohol": "topics.tobacco_alcohol",
    "happiness": "topics.happiness",
    # 第一次會向 TeleGeography 一條一條抓 713 條電纜的明細（每次間隔 0.4 秒，約 18 分鐘）
    "submarine-cables": "topics.submarine_cables",
    "road-safety": "topics.road_safety",  # WHO（GHO、GSRRS 2023）與交通部統計查詢網
    # UNCTAD Data Hub 的 6 個整包下載（7z 的 CSV，共約 2.5 MB）、NGA World Port Index（3.5 MB）、臺灣港務公司的貨櫃裝卸量
    "shipping": "topics.shipping",
    # 航運密度的網格圖磚（不進版本控制，部署時產生）；第一次會下載世界銀行的 Global Shipping Traffic Density（535 MB）
    "shipping-density-tiles": "topics.shipping_density_tiles",
    # Marine Regions 的 WFS（EEZ 的屬性與界線，界線約 25 MB、2 分鐘）、FAO FishStat（約 6 MB）、FAOSTAT 土地利用（約 3 MB）、
    # 漁業署《漁業統計年報》的生產量報表（約 4 MB）
    "oceans": "topics.oceans",
    # Cottom et al. 的 SPOT 輸出（OWID 快照的 Dryad 檔，4 MB）、Meijer et al. 的河口（figshare，0.7 MB）、
    # BACI HS92 版（2.4 GB，讀 HS 3915 約 5 分鐘）、環境部的一般廢棄物與資源回收、財政部的 HS 3915
    "plastic": "topics.plastic",
    "fossil-fuels": "topics.fossil_fuels",  # 第一次會下載 EIA（24 MB）、BACI HS92（2.4 GB，跟塑膠污染共用）、GEM 四個 tracker（約 430 MB）
    # 要先有 geo 的國界；Ookla Open Data 每年第 3 季的固網與行動各一個 parquet（2019–2026 年，pyarrow 只讀需要的欄位，
    # 共約 1.4 GB、3 分鐘），約 2,000 萬個圖塊第一次歸國要十幾分鐘（之後用快取）；數位發展部的 5G 量測（CC0，幾 KB）
    "internet-speed": "topics.internet_speed",
    # 網路速度的約 5 km 網格圖磚（不進版本控制，部署時產生）：最新一季的固網與行動各一組，只讀需要的欄位（約 180 MB）
    "internet-speed-tiles": "topics.internet_speed_tiles",
    # GitHub Innovation Graph 的 7 個 CSV 與 2 個補充資料（raw.githubusercontent.com，約 8 MB，不經 API）、WPP 的人口
    "developers": "topics.developers",
    # OpenAlex API 的 group_by（約 300 次查詢，沒有金鑰時一天約 1,000 次的匿名額度，第一次約 3 分鐘）、WPP 的人口
    "publications": "topics.publications",
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
    # Wikidata 的 6 個 SPARQL 查詢（每個 2–5 秒）與約 40 批名稱（wbgetentities）、FAOSTAT 土地利用（陸地面積）；
    # 要先有 geo 的國界，也讀人口、旅行實用、語言、民主與自由、城市、海拔、國際組織、台灣的外交已經產生的資料檔
    "profiles": "topics.profiles",
    # Wikidata：7 個 SPARQL 查詢（150 m 以上的候選、所在行政區往上 4 層、城市類別、國家代碼）與約 50 批 wbgetentities
    # （第一次約 1 分鐘，之後用快取不到 1 秒）；要先有 geo 的國界，也讀城市主題的 cities.json（P131 找不到城市時用）。
    # 跑完要重跑 profiles（小檔案的「最高的大樓」讀這裡的 buildings.json）
    "skyscrapers": "topics.skyscrapers",
    # Wikidata 的 2 個 SPARQL 查詢、Commons API 的檔案資訊（約 5 批）與約 230 個國旗 SVG（共約 3.8 MB，第一次約 2 分鐘，
    # 之後約 1 分鐘）；要先有 geo 的國界，SVG 用 node 的 svgo（devDependency，要先 npm install）最佳化。
    # 國家小檔案的國旗是前端直接讀這裡的 flags.json，不必重跑 profiles
    "flags": "topics.flags",
    # 要先有 geo 的國界；第一次會下載 HydroRIVERS v1.0 的全球 shapefile（544 MB，解壓 2.2 GB）、Marine Regions 的 IHO 海域與
    # Global Oceans and Seas（WFS，共約 460 MB，伺服器要先產生好幾分鐘）、Natural Earth 的河流中心線（約 20 MB）與
    # 約 80 批 Wikidata 的中文名稱；第一次約 15 分鐘（海域畫成網格約 10 分鐘），之後用快取約 40 秒
    "rivers": "topics.rivers",
    # 水壩與水庫（併進河流主題，輸出到 topics/rivers/）：Global Dam Watch v1.0（figshare，70 MB）、水利署的水庫基本資料
    # 與 Wikidata 的台灣水庫座標；要先有 geo 的國界，不必先跑 rivers；第一次約 1 分鐘，之後約 20 秒
    "dams": "topics.dams",
    # 不下載新的東西：讀國家小檔案的首都（要先跑 profiles）、Natural Earth populated places（旅行實用的快取）與 tzdata 套件，
    # 不到 1 秒；白天長度等指標在瀏覽器裡算（src/lib/solar.ts）
    "daylight": "topics.daylight",
    # 要先有 geo 的國界（與河流主題的海域網格，名稱用）；第一次會向 NASA 日食網站一頁一頁抓約 300 次日食的貝塞爾根數
    # （五千年日食典與路徑表兩組，每頁間隔 0.3 秒，共約 600 頁、5 MB），算路徑與經過的國家第一次約 10 分鐘，之後用快取約 5 分鐘
    "eclipses": "topics.eclipses",
    # 月食（併進日食與月食主題，輸出到 topics/eclipses/）：NASA 五千年月食目錄 3 頁（約 240 KB）；以首都計算，要先跑
    # daylight（capitals.json），不必先跑 eclipses；不到 10 秒
    "lunar": "topics.lunar",
    # 要先有 geo 的國界與晝夜與季節的首都（daylight）；第一次會下載 Marine Regions 的 IHO 海域與 Global Oceans and Seas
    # （河流主題的同一份快取，畫成網格約 5 分鐘）與 Natural Earth 的 populated places（旅行實用的同一份）；
    # 之後約 30 秒（全球每 3 km 一點的取樣網格約 5,700 萬點，判斷國家與海約 15 秒）
    "antipodes": "topics.antipodes",
    # 要先有晝夜與季節的首都（daylight）
    "magnetic": "topics.magnetic",
    # 此刻的極光：OVATION 在瀏覽器裡即時讀，這裡只算各國碰到哪些格點（要先跑 daylight 的 capitals.json）；不到 10 秒
    "aurora": "topics.aurora",
    # 大航海時代的航海日誌：CLIWOC 2.1（第一次下載 29 MB）；約 1 分鐘
    "logbooks": "topics.logbooks",
    # 氣候分區（柯本）：Beck 2023 的 0.1° 網格（第一次下載 130 MB）；約 1 分鐘
    "koppen": "topics.koppen",
    # 冰河、海冰與海平面：WGMS AMCE（54 MB）、NSIDC 海冰邊緣（約 200 個小檔）、NOAA STAR 海平面網格；
    # 沿海的平均用颱風主題的 NearIndex、內陸國用海洋主題的 Marine Regions 清單；約 1 分鐘
    "ice": "topics.ice",
    # 各國在讀什麼：Wikimedia 的差分隱私每日瀏覽量，邊下載邊彙整成每月每國的前幾名（第一次約 30 分鐘、約 13 GB，
    # 原始檔不留，月份的彙整快取在 .cache/wikimedia/months/）；中文、英文名稱用 Wikidata 的 SPARQL（約 5 分鐘），快取在 labels.json
    "reads": "topics.reads",
    # 帝國與疆界：Cliopatria（Zenodo 299 MB）取樣 119 個年份的政體範圍、台灣依史實修正，加上 COLDAT 的殖民年份；
    # 政體的中文名稱跟各國在讀什麼共用 Wikidata 的快取（labels.json）；約 2 分鐘
    "empires": "topics.empires",
    # 板塊漂移：Merdith 等 2021 的板塊模型（Zenodo），用 pyGPlates（只在建置時用）把今天的國界帶回 0–250 百萬年前，
    # 加上那時的板塊邊界；約 1 分鐘
    "plates": "topics.plates",
    # 風與季風：NOAA PSL 的 NCEP/NCAR 再分析，離地 10 m 的風 1991–2020 年每月的長期平均（THREDDS，3 個約 1 MB 的 netCDF）；
    # 風場內插成 2° 給粒子動畫、風速分級的 1° PNG、各國國土的平均；約 20 秒
    "wind": "topics.wind",
    # 鐵路軌距（交通主題）：CIA 世界概況的各軌距公里數（factbook.json 鏡像，最新版只有總長的國家用 2022-12-29 的版本），
    # 兩版都沒有的用英文維基百科；約 1 分鐘（第一次逐檔下載約 170 個小 JSON）
    "rail-gauge": "topics.rail_gauge",
    # 山脈（海拔主題）：GMBA Mountain Inventory v2 的 291 個主要山系（EarthEnv，約 32 MB 的 zip），範圍、名稱、
    # 各國國土在山區的比例（0.025° 網格）；要先跑 geo 步驟；約 2 分鐘
    "mountains": "topics.mountains",
    # 出生的季節：UNdata 表 55 的逐月出生數（一國一頁，第一次約 156 頁）、內政部按登記的月份；約 1 分鐘
    "birth-season": "topics.birth_season",
    # 健康平均餘命（健康主題）：WHO 的 HALE 與平均壽命（data.who.int 的整檔 CSV，GHO API 壞了），台灣手抄衛福部的數字；幾秒
    "hale": "topics.hale",
    # 學制與開學月份（教育主題）：UIS 的開學月份（CC BY-SA 4.0）、世界銀行的義務教育年數與入學年齡，台灣依法規；幾秒
    "school-calendar": "topics.school_calendar",
    "long-run": "topics.long_run",  # Gapminder 1800 年起的人口、人均 GDP、平均壽命（人口、人均收入、健康主題）
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
