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
    # 放大後的國界：Natural Earth 1:10m 切成 PMTiles（public/pmtiles/countries-10m-<雜湊>.pmtiles，約 6 秒＋切圖）；
    # 要先有 geo 的國界，切圖要 tippecanoe（cloud 編譯不了，在本機 session 跑，pipeline/pmtiles.py）
    "borders-10m": "borders_10m",
    # 世界地圖主題的行政區（製作手冊第十六批 265）：Natural Earth 第一級、geoBoundaries 第二級（第一次下載約 420 MB）、
    # 內政部的縣市與鄉鎮市區（map-plan data/nlsc/ 複製到 .cache/nlsc/）裁切到 1:10m 國界，輸出 public/data/divisions/；
    # 約 15 分鐘。divisions-tiles 把它切成 PMTiles（tippecanoe，本機 session 跑）
    "divisions": "divisions",
    "divisions-tiles": "divisions_tiles",
    # 世界視角（0–3 級）的地形陰影圖磚，轉成 WebP 跟網站一起部署（src/map/style.ts 的 localRelief）
    "relief-tiles": "relief_tiles",
    "population": "topics.population",
    # 台灣的最小統計區人口（第十七批 285）：map-plan data/segis/ 的 22 個 XML 先複製到 .cache/segis/，SHP 的中心點從 data.gov.tw 25128 下載
    "segis-population": "topics.segis_population",
    "population-grid": "topics.population_grid",  # 要先有 geo 的國界；第一次會下載 460 MB
    # 人口密度的 1 km 網格圖磚（不進版本控制，部署時產生）；第一次會下載 12 期、共 5.8 GB
    "population-density-tiles": "topics.population_density_tiles",
    "income": "topics.income",
    "sectors": "topics.sectors",
    "agriculture": "topics.agriculture",
    "agriculture-land": "topics.agriculture_land",
    "calorie-self-sufficiency": "topics.calorie_self_sufficiency",
    "warming-projection": "topics.warming_projection",
    "agriculture-support": "topics.agriculture_support",
    "agriculture-prices": "topics.agriculture_prices",
    "crop-yield": "topics.crop_yield",  # 農業主題的每公頃產量（FAOSTAT QCL 的 Yield，只讀產量那個檔）
    # 油棕園：Zenodo 13379129 的範圍圖（156 MB）與種植年份圖（146 MB），各 609 個圖磚；第一次讀約 15 分鐘，
    # 之後用 .cache/oilpalm/aggregate.npz 幾秒；要先有 geo 的國界
    "oil-palm": "topics.oil_palm",
    # 人工林：FAOSTAT 土地利用（3 MB）、SDPT 的 6 級向量圖磚（約 1,000 張、1 小時，sources/sdpt_tiles.py）、
    # 農業部的林型分布圖（420 MB 的 zip，shapefile 1.4 GB，第一次讀約 5 分鐘）；要先有 geo 的國界
    "planted-forests": "topics.planted_forests",
    "electricity": "topics.electricity",
    "industry": "topics.industry",
    # 化肥的產量與自給率（第二十二批 384）：FAOSTAT 的 Fertilizers by Nutrient，Flag X 不用
    "industry-fertilizer": "topics.industry_fertilizer",
    # 企業的機器人使用率（第二十二批 386）：Eurostat isoc_eb_p3d
    "industry-robots": "topics.industry_robots",
    # 工業主題的鋼鐵與水泥：USGS 年鑑的各國產量、GEM 公開地圖的鋼鐵廠與水泥廠（約 9 MB）
    "steel-cement": "topics.steel_cement",
    "ai": "topics.ai",
    "transport": "topics.transport",
    "climate": "topics.climate",
    "climate-transport": "topics.climate_transport",
    # 排放達峰了嗎：讀 climate 步驟輸出的 co2.json 算最高的那一年（要在 climate 之後跑）
    "climate-peak": "topics.climate_peak",
    # 農糧系統的溫室氣體（FAOSTAT Emissions Totals，20 MB）與碳排放的經濟損害（WDI）
    "climate-agrifood": "topics.climate_agrifood",
    # 各國氣候目標與政策的評等（新主題，碳與氣候政策）：Climate Action Tracker 的評等頁（嵌在頁面的 JSON，只准非商業）
    "climate-action": "topics.climate_action",
    # 氣候資金：綠色氣候基金的公開 API（3 MB，只准非商業、要附署名句與連結）
    "climate-finance": "topics.climate_finance",
    # 碳邊境調整機制（CBAM）會課到誰：Eurostat Comext DS-045409 歐盟從各國進口的 CBAM 產品（HS 近似）
    "cbam": "topics.cbam",
    # Climate TRACE 5.12.0（Zenodo，用 HTTP Range 只讀需要的檔，第一次約 400 MB、10 分鐘）
    "climate-trace": "topics.climate_trace",
    "military": "topics.military",
    "digital": "topics.digital",
    # 離不開現金的人（第二十二批 381）：Findex 2025 的現金題組，台灣側欄用數位部的各場域行動支付滲透率
    "digital-cash": "topics.digital_cash",
    "health": "topics.health",
    "disease": "topics.disease",  # 第一次會向 WHO 查 24 年的死因資料（約 15 分鐘、40 MB）
    # WHO 的 WUENIC（xmart）、世界銀行、OWID 的 COVID-19 資料（約 180 MB）、The Economist 的超額死亡（約 11 MB）、
    # 衛福部死因統計（疾病主題的同一個檔，約 9 MB）
    "vaccination": "topics.vaccination",
    "vaccination-pcv3": "topics.vaccination_pcv3",  # WHO 的 PCV3（data.who.int，CC BY 4.0），台灣用疾管署的縣市完成率加權
    "diet": "topics.diet",  # 第一次會下載約 130 MB（FAOSTAT 糧食平衡表新舊兩版、糧食安全指標）
    "education": "topics.education",
    "education-projection": "topics.education_projection",  # 大專以上的成人比例推估到 2100 年（Wittgenstein Centre，Zenodo 約 130 MB）
    "pisa": "topics.pisa",  # OECD PISA 2025 Volume I 的兩個 Excel（約 2.8 MB）
    "university-entrance": "topics.university_entrance",  # 依英文維基百科整理的表（sources/admission_tests.py），不必下載
    # NCD-RisC 的成人身高（2.4 MB）與兒童青少年身高（4.6 MB 的 zip），伺服器常斷線，用 curl 續傳；WPP 的年齡別人口
    "height": "topics.height",
    "blood-types": "topics.blood_types",
    "tourism": "topics.tourism",
    # 觀光的追加（第二十一批 349–357）：Eurostat 的觀光統計（CC BY 4.0）與交通部觀光署的開放資料
    "tourism-flows": "topics.tourism_flows",
    "tourism-season": "topics.tourism_season",
    "tourism-demand": "topics.tourism_demand",
    "tourism-jobs": "topics.tourism_jobs",
    "housing": "topics.housing",
    # 住宅與房價的平均每戶人數（housing 的一部分）：內政部不動產資訊平台從 cloud 被擋時單獨更新這一項
    "housing-household-size": "topics.housing_household_size",
    "trade": "topics.trade",  # 第一次會下載約 1.2 GB（BACI、FAOSTAT 詳細貿易矩陣）
    # 貿易依存度（併進貿易主題）：世界銀行 WDI（約 3.6 MB）、主計總處支出面 GDP 的兩個 XML（約 1.5 MB），幾秒
    "trade-dependence": "topics.trade_dependence",
    # 貿易的商品流向（併進貿易主題）：BACI HS92（2.4 GB）與 HS17（0.8 GB）各讀一次，25 種商品，約 20 分鐘
    "trade-goods": "topics.trade_goods",
    # 工業機器人（HS 847950）的流向（第二十二批 386）：只讀 BACI HS17
    "trade-robots": "topics.trade_robots",
    "trade-leisure": "topics.trade_leisure",
    "chain-bubble-tea": "topics.chain_bubble_tea",
    "sugar-tax": "topics.sugar_tax",
    "huts": "topics.huts",
    "forest-recreation": "topics.forest_recreation",
    "phenology-jp": "topics.phenology_jp",
    "travel-advisories": "topics.travel_advisories",
    "working-holiday": "topics.working_holiday",
    "eating-out-share": "topics.eating_out_share",
    "language-school": "topics.language_school",
    "news-dnr": "topics.news_dnr",
    "gaming-eu": "topics.gaming_eu",
    "sports-economy": "topics.sports_economy",
    "sports-leagues": "topics.sports_leagues",
    "sports-venues": "topics.sports_venues",
    "horses": "topics.horses",
    "leisure-venues": "topics.leisure_venues",
    "alcohol-makers": "topics.alcohol_makers",
    "wine-pdo": "topics.wine_pdo",
    "origin-names": "topics.origin_names",
    "cuisines": "topics.cuisines",
    "attractions-visitors": "topics.attractions_visitors",
    "departure-tax": "topics.departure_tax",
    "tax-refund": "topics.tax_refund",
    "travel-health": "topics.travel_health",
    "trade-medicinal-plants": "topics.trade_medicinal_plants",  # 只更新藥用植物（HS 1211，BACI HS92 約 2.4 GB，幾分鐘）
    # 1962 年起的長期貿易流向與出口組成：Harvard Atlas 的 SITC（約 55 MB，貿易與工業兩個主題）
    "atlas-sitc": "topics.atlas_sitc",
    "services-trade": "topics.services_trade",  # 服務出口的組成（WDI、央行國際收支），輸出到 topics/trade/
    "language": "topics.language",
    # 官方語言有幾種（第二十二批 393）：CLDR territoryInfo 與 Wikidata P37（經 QLever；query.wikidata.org 的 /sparql robots 不允許）
    "language-official": "topics.language_official",
    "elevation": "topics.elevation",  # 要先有 geo 的國界；第一次會下載約 760 MB（GMTED2010）
    "ruggedness": "topics.ruggedness",  # Nunn & Puga 的地形崎嶇指數（Harvard Dataverse，CC0）
    "migration": "topics.migration",  # 第一次會向 UNHCR 查 36 年的難民資料（約 2 分鐘）
    "missing-migrants": "topics.missing_migrants",  # IOM Missing Migrants Project 的事件（一個 8 MB 的 CSV），輸出到 topics/migration/
    # OECD DAC 的 DAC1 與 DAC2A（約 75 MB 的 CSV，一兩分鐘）、世界銀行的僑匯、中央銀行的國際收支；
    # 台灣的 GDP 用 reserves 主題的主計總處與央行匯率
    "aid": "topics.aid",
    # AidData GCDF 3.0 的 zip（28.6 MB，xlsx 讀一次約 15 秒，之後用 .pkl 快取）；也讀人均收入的 GDP、人口主題的總人口
    "china-lending": "topics.china_lending",
    "china-lending-codf": "topics.china_lending_codf",  # BU 的 CODF（OSF，CC BY 4.0）
    "religion": "topics.religion",
    "religion-extra": "topics.religion_extra",
    "oldest-universities": "topics.oldest_universities",
    "inequality": "topics.inequality",  # 第一次會下載 WID 整包（約 890 MB），抽出變數要幾分鐘
    "gender": "topics.gender",
    "wages": "topics.wages",
    "annual-leave": "topics.annual_leave",  # 法定最低年假（英文維基，CC BY-SA 4.0；台灣依勞基法第 38 條）
    "fiscal": "topics.fiscal",
    # 政府的利息負擔（第二十二批 380）：WDI 的利息占收入、占支出，台灣用財政部的各級政府債務支出
    "fiscal-interest": "topics.fiscal_interest",
    # 物價與財政的擴充：政府支出的用途（IMF COFOG）、稅收的組成（OECD）、公共債務兩百年（IMF HPD）
    "fiscal-structure": "topics.fiscal_structure",
    # OECD 的公司稅、個人所得稅最高稅率、勞動稅負（SDMX，約 16 MB）；VAT 與台灣的稅率寫在 sources/oecd_tax.py、tw_tax_law.py
    "taxes": "topics.taxes",
    # 要先有 geo 的國界；第一次會向 Overpass 發 27 個查詢（9 個品牌、6 種店型的名稱比對、便利商店 12 個經度帶，
    # 約 72 MB，公用伺服器忙的時候要兩三個小時）
    "chain-stores": "topics.chain_stores",
    "innovation": "topics.innovation",
    # 專利的技術領域與受理局（WIPO 批次檔）、創業投資（OECD）：第二十二批 383
    "innovation-fields": "topics.innovation_fields",
    "wealth": "topics.wealth",
    "temperature": "topics.temperature",  # 第一次會下載 CRU TS 的月平均氣溫與降雨網格
    # 暖化（近 10 年平均與 1951–1980 年的差）的網格圖磚（不進版本控制，部署時產生）
    "temperature-grid-tiles": "topics.temperature_grid_tiles",
    # 一年下雨幾天（氣溫與降雨主題）：CRU TS 的 wet（第一次下載約 233 MB）＋中央氣象署測站的降雨日數（台灣附註）
    "wet-days": "topics.wet_days",
    # 日照時數（氣溫與降雨主題）：CRU CL v2.0 的日照百分比（1961–1990 年平均，約 12 MB）換算成小時＋中央氣象署測站（台灣附註）
    "sunshine": "topics.sunshine",
    # 全球二氧化碳觀測站：NOAA GML 合作採樣網的瓶採樣月平均 CO2（約 6.7 MB）；幾秒
    "co2-stations": "topics.co2_stations",
    # 城市熱島：Yang 等人的 Global UHII Dataset（figshare，RAR 約 1.4 GB，要有 bsdtar），要先有 cities 的點；第一次約 1 分鐘
    "urban-heat": "topics.urban_heat",
    # 臭氧洞：NASA Ozone Watch 的年表與每年臭氧洞最大那一天的 1° 網格（46 個檔，約 9 MB）；約 1 分鐘
    "ozone-hole": "topics.ozone_hole",
    "air-quality": "topics.air_quality",
    "air-quality-no2": "topics.air_quality_no2",  # 二氧化氮衛星影像的時間軸與台灣附註（環境部空氣品質監測月值，第十七批 282）
    # 七種空氣污染物的排放量：CEDS 的同一個 zip（sources/ceds.py 的快取），國家總量與部門組成
    "air-emissions": "topics.air_emissions",
    # 台灣的空氣污染物排放清冊 1 公里網格（環境部 AQX_P_24，平台預覽用的免金鑰查詢，分 4 頁）
    "air-teds": "topics.air_teds",
    "nutrients": "topics.nutrients",
    "noise": "topics.noise",
    "plastic-microplastics": "topics.plastic_microplastics",
    "industrial-releases": "topics.industrial_releases",
    "contaminated-sites": "topics.contaminated_sites",
    "materials": "topics.materials",
    "land-use": "topics.land_use",
    "land-use-tw": "topics.land_use_tw",
    "water-transboundary": "topics.water_transboundary",
    "water-irrigation": "topics.water_irrigation",
    "water-tw-utility": "topics.water_tw_utility",
    "forest-disturbance": "topics.forest_disturbance",
    "forest-tw-loss": "topics.forest_tw_loss",
    "wildfire-emissions": "topics.wildfire_emissions",
    "env-taxes": "topics.env_taxes",
    "digital-skills": "topics.digital_skills",
    "broadband-oecd": "topics.broadband_oecd",
    "ict-prices": "topics.ict_prices",
    "ict-exports": "topics.ict_exports",
    "electronic-components": "topics.electronic_components",
    "digital-gov": "topics.digital_gov",
    "cctld": "topics.cctld",
    "rd-structure": "topics.rd_structure",
    "rd-policy": "topics.rd_policy",
    "gci-pillars": "topics.gci_pillars",
    "top500": "topics.top500",
    "printers3d": "topics.printers3d",
    "sequencing": "topics.sequencing",
    "quantum": "topics.quantum",
    "space-more": "topics.space_more",
    "electricity-capacity": "topics.electricity_capacity",
    "electricity-renewables-extra": "topics.electricity_renewables_extra",
    "renewables-final": "topics.renewables_final",
    "energy-use": "topics.energy_use",
    "household-energy": "topics.household_energy",
    "energy-poverty": "topics.energy_poverty",
    "energy-wholesale": "topics.energy_wholesale",
    "energy-market": "topics.energy_policy_tools",
    "energy-taxes": "topics.energy_taxes",
    "oil-stocks": "topics.oil_stocks",
    "power-fleet": "topics.power_fleet",
    "taiwan-peak": "topics.taiwan_peak",
    "smr": "topics.smr",
    "water-forest": "topics.water_forest",
    # 取水量的用途、海水淡化（第二十二批 387）：WDI 轉載 AQUASTAT、AQUASTAT 批次檔
    "water-use": "topics.water_use",
    # 都市汙水處理與汙水處理廠（第二十二批 388）：Eurostat、AQUASTAT、OSM（QLever，一支查詢約 2 分鐘）、國土管理署
    "water-wastewater": "topics.water_wastewater",
    # 缺水壓力的推估（水資源與森林主題）：WRI Aqueduct 4.0 的各國排名（約 13 MB）；幾秒
    "aqueduct": "topics.aqueduct",
    "ev": "topics.ev",
    # 電動車主題的燃油車禁售年份與狀態（英文維基百科的表；要先有 profiles 的 government.json）
    "ev-phaseout": "topics.ev_phaseout",
    "earthquakes": "topics.earthquakes",  # 要先有 geo 的國界
    "volcano-extra": "topics.volcano_extra",  # 火山的類型、岩性、噴發史、更新世的火山（製作手冊 538）
    "volcano-people": "topics.volcano_people",  # 住在活火山旁邊的人（GHS-POP 2020，製作手冊 539）
    "quake-extra": "topics.quake_extra",  # 地震的損失、房屋、受傷，史上最大的規模與地震密度（製作手冊 540）
    "eew": "topics.eew",  # 哪些國家收得到地震預警（英文維基，製作手冊 541）
    "plates-today": "topics.plates_today",  # 國土的板塊與造山帶、板塊現在的速度（製作手冊 542）
    "plates-past": "topics.plates_past",  # 兩億年前的鄰居、5 億年前屬於哪個古大陸（製作手冊 543）
    # 板塊（PB2002）：邊界加上相對速度與地質圖的符號、52 塊板塊的面、各板塊的人口（要先有 population-grid 的 grid.json）
    "plates-pb2002": "topics.plates_pb2002",
    "landslides": "topics.landslides",  # NASA 全球山崩目錄（GLC），分 8 頁下載
    "democracy": "topics.democracy",  # 第一次會下載約 34 MB（V-Dem v16 的 RData）
    # V-Dem 的其他指數（第二十二批 377、378，共用 democracy 的下載與國家對照）：政府治理的行政權制衡、性別平等的女性政治賦權
    "governance-vdem": "topics.governance_vdem",
    "religion-vdem": "topics.religion_vdem",
    "funeral": "topics.funeral",
    "culture-spending": "topics.culture_spending",
    "temples-tw": "topics.temples_tw",
    "reads-languages": "topics.reads_languages",
    "holiday-calendars": "topics.holiday_calendars",
    "independence": "topics.independence",
    "happiness-eu": "topics.happiness_eu",
    "diet-security": "topics.diet_security",
    "birth-registration": "topics.birth_registration",
    "rail-power": "topics.rail_power",
    "rail-stations": "topics.rail_stations",
    "rail-abandoned": "topics.rail_abandoned",
    "rail-accidents": "topics.rail_accidents",
    "rail-goods": "topics.rail_goods",
    "gender-vdem": "topics.gender_vdem",
    # 國家小檔案的國會幾院（V-Dem）、席次與每席人口（英文維基固定版本，要先有 population 的 total.json）
    "profiles-legislature": "topics.profiles_legislature",
    # 國家小檔案的貨幣怎麼寫（第二十二批 392）：CLDR 49 的貨幣格式與符號，讀現有的 profiles/<ISO3>.json 的貨幣代碼
    "profiles-currency": "topics.profiles_currency",
    # 國歌哪一年採用、唱多久（第二十二批 394）：英文維基「List of national anthems」固定版本的網頁（CC BY-SA 4.0）
    "profiles-anthems": "topics.profiles_anthems",
    # 付現金時湊整到多少（第二十二批 395）：英文維基「Cash rounding」固定版本的網頁，散文逐國整理（CC BY-SA 4.0），輸出 fiscal/
    "prices-cash-rounding": "topics.prices_cash_rounding",
    # 鈔票上是誰（第二十二批 397）：英文維基「List of people on banknotes」固定版本的網頁（CC BY-SA 4.0），新主題 banknotes
    "banknote-people": "topics.banknote_people",
    # 最大面額的鈔票（候選 681）：約 166 篇英文維基貨幣條目的資訊框（每篇間隔 2 秒），世界銀行官方匯率換成美元
    "banknote-largest": "topics.banknote_largest",
    # 大型哺乳類還剩下幾種（第二十二批 398）：PHYLACINE 1.2（Zenodo，CC0），國界柵格化到 96.5 km 網格
    "megafauna": "topics.megafauna",
    # 跑道（第二十三批 399）：OurAirports 的 runways.csv、Factbook 2022 年版的鋪面機場、民航局的機場設施表，擴充機場與旅客
    "airport-runways": "topics.airport_runways",
    "airport-navaids": "topics.airport_navaids",
    "airport-facilities": "topics.airport_facilities",
    "airport-flights": "topics.airport_flights",
    "air-distance": "topics.air_distance",
    "airport-names": "topics.airport_names",
    "road-features": "topics.road_features",
    "road-injuries": "topics.road_injuries",
    "trucks-buses": "topics.trucks_buses",
    "cabotage": "topics.cabotage",
    "bus-stations": "topics.bus_stations",
    "port-calls": "topics.port_calls",
    "port-cargo-types": "topics.port_cargo_types",
    "sea-passengers": "topics.sea_passengers",
    "shipyards": "topics.shipyards",
    "inland-fleet": "topics.inland_fleet",
    # 交通基礎建設的投資與養護（第二十七批 584）：OECD／ITF 的 DF_INFRINV、世界銀行的本國幣 GDP
    "transport-investment": "topics.transport_investment",
    # 家庭花在交通上的錢、運輸與倉儲業的就業（第二十七批 585）：Eurostat nama_10_co3_p3、主計總處 6588；ILOSTAT、主計總處
    "household-transport": "topics.household_transport",
    "transport-jobs": "topics.transport_jobs",
    # 資料能不能出國：數位貿易的壁壘（第二十七批 586）：OECD Digital STRI
    "digital-trade": "topics.digital_trade",
    # 網路位址分給了誰（第二十七批 588）：APNIC 的 delegated-apnic-latest（只做 APNIC 區）
    "ip-addresses": "topics.ip_addresses",
    # 通訊塔與行動基地台的密度（第二十七批 589）：OSM 經 QLever，三支查詢
    "cell-towers": "topics.cell_towers",
    # 網路自由度（第二十七批 590）：Freedom House 的分數頁與 72 國的國家頁（間隔 3 秒）
    "internet-freedom": "topics.internet_freedom",
    # 網路速度的擴充：都會區之間的網速差距（第二十七批 591）：OECD 的 FUA 網速（相對全國平均）
    "metro-speed": "topics.metro_speed",
    # 機隊的規模與年齡（第二十三批 400）：Factbook 2022 年版的機隊與航空公司、Eurostat 的機齡、民航局的國籍航空器登記
    "air-fleet": "topics.air_fleet",
    # 商船隊的船齡與艘數、港口的效率（第二十三批 401）：UNCTADstat 的 MerchantFleet 與 PortCalls、世界銀行 CPPI 2025（CC BY-NC 3.0 IGO）
    "shipping-efficiency": "topics.shipping_efficiency",
    # 運河與海峽每月通過幾艘船（第二十三批 402）：IMF PortWatch 每天的通過數（用咽喉圖層的快取）加總成每個月
    "chokepoints-monthly": "topics.chokepoints_monthly",
    # 小客車的車齡（第二十三批 403）：Eurostat road_eqs_carage，輸出到 road-safety 的資料夾（汽機車主題）
    "car-age": "topics.car_age",
    # 全世界的礦場（第二十二批 382 的後半）：USGS MRDS（使用者用瀏覽器下載，map-plan 的 data/usgs-mrds/，先複製到 .cache/usgs-mrds/）
    "minerals-mines": "topics.minerals_mines",
    # 燃料稅占油價的比例（第二十三批 404）：Weekly Oil Bulletin 的含稅、未稅價（同電價與油價的 xlsx），輸出到 energy-prices
    "fuel-tax": "topics.fuel_tax",
    # 死亡車禍發生在哪一種道路（第二十三批 405）：Eurostat tran_sf_roadro 與 road_tf_vehmov，台灣用高速公路局的國道 30 日內死亡
    "road-type": "topics.road_type",
    # 服務區與休息區（第二十三批 406）：OSM highway=services、rest_area 經 QLever，台灣加高速公路局的國道服務區
    "travel-rest-areas": "topics.travel_rest_areas",
    # 歐洲鐵路（第二十三批 407）：RMMS 第 9 次報告的 xlsx（準點率、員工、市占）與 Eurostat 的單雙線、速度分級，臺鐵準點率放側欄
    "rail-europe": "topics.rail_europe",
    # 歐洲城市的通勤與市民對大眾運輸的評價（第二十三批 408）：Eurostat Urban Audit urb_ctran、urb_percep，城市位置用自行車主題的快取
    "cities-transport": "topics.cities_transport",
    # 大眾運輸的月票與計程車車資（第二十三批 409）：Eurostat Urban Audit TT1080V、TT1081V，分別輸出到地鐵與叫車服務的資料夾
    "transit-fares": "topics.transit_fares",
    # 全國通用的月票或免費大眾運輸（第二十三批 409 的後半，使用者 2026-11-06 決定）：逐國查官網的小表
    "national-passes": "topics.national_passes",
    # 城市的低排放區與塞車費（第二十三批 410）：QLever 查 OSM 的 boundary=low_emission_zone、英文維基 Congestion pricing 的固定版本、桃園市 CSV
    "city-traffic": "topics.city_traffic",
    # 關鍵礦產的台灣側欄：地礦中心的現存礦業權清冊（data.gov.tw 126847）
    "minerals-rights-tw": "topics.minerals_rights_tw",
    # 河流與流域的內河航道（第二十三批 411）：CIA 世界概況 2022 版的 Waterways、Eurostat iww_if_infrastr、iww_go_atygo、GDW 的船閘
    # （topics/waterways.py 是航運與港口的運河與海峽，由 shipping 步驟呼叫，跟這個無關）
    "inland-waterways": "topics.inland_waterways",
    "governance": "topics.governance",  # World Bank API 的 WGI，六個面向各 6 個序列（36 次查詢，約 1 分鐘）
    "taiwan-diplomacy": "topics.taiwan_diplomacy",
    "diplomacy-lists": "topics.diplomacy_lists",  # 台灣的外交的左側欄
    # 要先有 geo 的國界；第一次會下載 IBTrACS v04r01（333 MB，NCEI 單一連線很慢，見 DESIGN.md 第 8 節）
    "typhoons": "topics.typhoons",
    # 熱帶氣旋的累積氣旋能量（ACE）：重讀 IBTrACS 快取的原始 CSV，沿用 typhoons 的篩選與「經過這一國」的規則
    "typhoon-ace": "topics.typhoon_ace",
    "typhoon-list": "topics.typhoon_list",
    "power-plants": "topics.power_plants",  # 第一次會下載 GEM 公開地圖的資料檔（約 62 MB）
    # 要先有 geo 的國界；第一次會下載 Global Solar Atlas 的 PVOUT（345 MB）與 Global Wind Atlas 的 0.02° 縮小版（182 MB）
    "renewables": "topics.renewables",
    # 太陽能、風能潛力的約 2 km 網格圖磚（不進版本控制，部署時產生）；下載同上，約 3 分鐘
    "renewables-grid-tiles": "topics.renewables_grid_tiles",
    # 第一次會下載 GWIS 的整包（約 12 MB），並向 GWIS API 查各國面積約 230 次（約 6 分鐘）
    "wildfires": "topics.wildfires",
    "passport": "topics.passport",
    "organizations": "topics.organizations",
    "who-regions": "topics.who_regions",  # 國際組織的 WHO 區域（WHO 官網的會員國名單與國家參照資料，第二十批 305）
    "who-wla": "topics.who_wla",  # 國際組織的 WHO 藥政成熟度 ML3／ML4 與過渡期認可機關（WHO 的兩份 PDF，名單寫在程式裡，第二十批 328）
    "un-votes": "topics.un_votes",
    "conflict": "topics.conflict",
    "nobel": "topics.nobel",  # 約 25 次 API 與 Wikidata 查詢；每年 10 月公布新得主後要加 --refresh
    "fertility": "topics.fertility",
    # 避孕需求被現代方法滿足的比例（併進生育率與高齡化，第二十批 335）：data.who.int 的 8074BD9（CC BY 4.0）
    "fertility-family-planning": "topics.fertility_family_planning",
    "holidays": "topics.holidays",  # Python 套件 holidays（MIT），離線計算
    # OSM 經 QLever（一個標籤一支查詢、不併發，結果存在 .cache/osm-qlever/）；覆蓋度名單見 sources/osm_coverage.py
    "dining": "topics.dining",
    "michelin": "topics.michelin",  # 外食的米其林三星（英文維基 CC BY-SA 4.0、Wikidata 座標）
    "diving": "topics.diving",  # OSM 經 QLever：潛水中心與潛水場域
    "box-office-tw": "topics.box_office_tw",  # 國家影視聽中心的全國電影票房（政府資料開放授權條款）
    "esports": "topics.esports",  # Esports Earnings 的國家頁（只抓一頁）
    "culture": "topics.culture",  # UNESCO UIS 的電影院、文化工作者、遺產保存支出（CC BY-SA 4.0）；WIPO 的法定送存（CC BY 4.0）與 ISBN 中心
    "retirement": "topics.retirement",  # OECD Pensions at a Glance（CC BY 4.0）；台灣依勞工保險條例
    "time-use": "topics.time_use",  # OECD 時間運用、How's Life 與 Eurostat HETUS 2020（CC BY 4.0）
    # UN World Marriage Data（約 26 MB）、UNdata 的結婚與離婚對數（第一次約 220 頁網頁，每頁間隔 0.3 秒，約 4 分鐘）、
    # Eurostat、OECD Family Database、內政部戶政司、主計總處
    "marriage": "topics.marriage",
    # 15–49 歲女性有偶或同居的比例（婚姻與家庭）：聯合國人口司的 xlsx（約 10 MB），讀一次約 5 秒
    "union-women": "topics.union_women",
    "laws": "topics.laws",  # 自行整理的表，不必下載
    # GHSL Urban Centre Database 2025 與各國城鄉人口（約 43 MB）、Wikidata 的地點（兩次查詢約 1 分鐘）與中文名稱
    # （約 130 次查詢）、內政部戶政司的縣市人口；之後用快取約 30 秒
    "cities": "topics.cities",
    # 城市的都市化率（各國自己的定義，聯合國 WUP 2025 的 File 15），對照 GHS-WUP 的統一定義
    "urban-definitions": "topics.urban_definitions",
    "crime": "topics.crime",
    # 警察、法官與監所管理員（第二十二批 390）：Eurostat crim_just_job（英國各地區、科索沃不收）
    "crime-staff": "topics.crime_staff",
    "tobacco-alcohol": "topics.tobacco_alcohol",
    "breweries": "topics.breweries",  # 菸酒的啤酒廠：OSM craft=brewery（經 QLever，ODbL）與 Open Brewery DB（MIT）
    # 啤酒產量（第二十二批 385）：FAOSTAT QCL Item 51，Flag X（外部機構提供）不畫，使用者決定
    "beer-production": "topics.beer_production",
    "gambling": "topics.gambling",  # 博弈：賭場、彩券行、投注站（OSM 經 QLever，ODbL）
    "happiness": "topics.happiness",
    # 2026-11-04 主題盤點的擴3：留學生的流向（UIS），教育程度主題讀 ../student-mobility/
    "student-mobility": "topics.student_mobility",
    # 2026-11-04 主題盤點的擴4：都市垃圾（世界銀行 What a Waste 3.0，CC BY 4.0），廢棄物與回收主題讀 ../waste/
    "waste": "topics.waste",
    # 都市垃圾的去處（第二十二批 389）：Eurostat env_wasmun（科索沃不收）、環境部、OSM 掩埋場（QLever），輸出 ../waste/
    "waste-europe": "topics.waste_europe",
    # 第一次會向 TeleGeography 一條一條抓 713 條電纜的明細（每次間隔 0.4 秒，約 18 分鐘）
    "submarine-cables": "topics.submarine_cables",
    "road-safety": "topics.road_safety",  # WHO（RS_198、GSRRS 2023）與交通部統計查詢網
    # 洗腎大國（併進疾病主題，輸出到 topics/disease/）：USRDS 年報第 11 章（GraphQL 一次 30 KB）；幾秒
    "dialysis": "topics.dialysis",
    # 野生型小兒麻痺的病例數（併進疾病主題，第二十批 327）：WHO 資料平臺 data.who.int 的整份 CSV；幾秒
    "disease-polio": "topics.disease_polio",
    # 糖尿病盛行率（併進疾病主題，2026-11-04 補回）：NCD-RisC 2024 的各國估計（map-plan 的 data/ncdrisc/，ncdrisc.org 從 cloud 回 421）
    "disease-diabetes": "topics.disease_diabetes",
    # 可避免的死亡（併進疾病與死因，第二十批 318）：OECD DF_AM（6 MB）
    "disease-avoidable": "topics.disease_avoidable",
    # 長期照顧（併進健康主題，輸出到 topics/health/）：OECD 長照床數與使用者（約 7 MB）、衛福部兩個 xlsx、WPP 年齡別人口
    "long-term-care": "topics.long_term_care",
    # 菸酒的擴充（輸出到 topics/tobacco-alcohol/）：英文維基「Regulation of electronic cigarettes」固定版本（230 KB）；幾秒
    "tobacco-policy": "topics.tobacco_policy",
    # 各國的健保制度（併進健康主題，輸出到 topics/health/）：OECD HSCS 2023 的 Q2（SDMX-JSON，32 KB）、英文維基兩個固定版本的表；幾秒
    "health-systems": "topics.health_systems",
    # 每十萬人手術量（併進健康主題，第二十批 306）：世界銀行 WDI 兩個指標、衛福部醫療服務量年報 xlsx（1.7 MB）
    "health-surgery": "topics.health_surgery",
    # 加護病床（併進健康主題，第二十批 314）：OECD DF_BEDS_ICU（1 MB）、衛福部醫療服務量年報表 3
    "health-icu": "topics.health_icu",
    # 腹腔鏡手術的比例（併進健康主題，第二十批 316）：OECD DF_SURG_PROC 只抓 6 個手術代碼（17 MB）
    "health-laparoscopy": "topics.health_laparoscopy",
    # 產道嚴重撕裂傷（併進健康主題，第二十批 319）：OECD 病人安全 DF_PS（0.5 MB）
    "health-obstetric": "topics.health_obstetric",
    # 遠距醫療（併進健康主題，第二十批 321）：OECD DF_CONSULT（1.4 MB）
    "health-telehealth": "topics.health_telehealth",
    # 醫學影像與放射治療設備（新主題，第二十批 315）：OECD DF_MED_TECH（7.8 MB）與 DF_DIAG_EXAM（6.1 MB）、衛福部年報表 14、15
    "medical-imaging": "topics.medical_imaging",
    # 醫院的表現（新主題，第二十批 317）：OECD 急性照護品質 DF_AC（12 MB）與等待時間 DF_WAITING（3.7 MB）
    "hospital-quality": "topics.hospital_quality",
    # 血漿製劑能不能自給（新主題，第二十批 322）：WHO 血液安全報告 2025 的 PDF（3.9 MB）附錄 9
    "plasma": "topics.plasma",
    # 被美國 FDA 回收的藥品（併進藥品支出與取得，第二十批 308）：openFDA 整批檔（3.8 MB）、食藥署的藥品回收與許可證
    "drug-recalls": "topics.drug_recalls",
    # 有沒有國家級的線上缺藥登錄（併進藥品支出與取得，第二十批 329）：EMA 的一覽頁、openFDA drug/shortages（0.4 MB）、食藥署開放資料 104–106
    "drug-shortages": "topics.drug_shortages",
    # 每年核准幾個新藥、孤兒藥（併進藥品支出與取得，第二十批 330、331）：FDA 的新藥整檔、EMA 的 medicines 與 orphan designations 表
    "new-drugs": "topics.new_drugs",
    # 同一個新藥在美國與歐盟上市的時間差（藥品支出與取得的左側欄，第二十批 332）：同上兩個檔依成分名比對
    "approval-lag": "topics.approval_lag",
    # 藥品專利池（MPP）的授權涵蓋哪些國家（併進藥品支出與取得，第二十批 334）：MPP 的 sitemap 與 49 個授權頁（約 8 MB，間隔 2 秒）
    "mpp-licences": "topics.mpp_licences",
    # COVID-19 超額死亡與官方少報倍數（併進疫苗與防疫，第二十批 311）：World Mortality Dataset（1.1 MB）、OWID 與 JHU 的通報死亡
    "excess-wmd": "topics.excess_wmd",
    # 65 歲以上的流感疫苗接種率（併進疫苗與防疫，第二十批 325）：OECD DF_IMMUN（2.9 MB）
    "vaccination-flu": "topics.vaccination_flu",
    # COVID-19 疫苗的總劑次與加強劑（併進疫苗與防疫，第二十批 326）：OWID 的 compact.csv（已快取）
    "vaccination-doses": "topics.vaccination_doses",
    # WHO 預認證的疫苗與品管實驗室、mRNA 技術移轉的夥伴國（併進疫苗與防疫，第二十批 333）：WHO 預認證站的 CSV 匯出與計畫頁
    "vaccine-production": "topics.vaccine_production",
    # 人工生殖（新主題，第二十批 312）：ESHRE EIM 2019 與 HROpen 2026 兩篇 PMC 全文 XML（CC BY 4.0）
    "ivf": "topics.ivf",
    # 疫情期間的防疫管制（新主題，第二十批 313）：OxCGRT 的 compact national CSV（43.8 MB），每 7 天取一天
    "covid-policy": "topics.covid_policy",
    # UNCTAD Data Hub 的 6 個整包下載（7z 的 CSV，共約 2.5 MB）、NGA World Port Index（3.5 MB）、臺灣港務公司的貨櫃裝卸量
    "shipping": "topics.shipping",
    "ferry-routes": "topics.ferry_routes",
    # 航運密度的網格圖磚（不進版本控制，部署時產生）；第一次會下載世界銀行的 Global Shipping Traffic Density（535 MB）
    "shipping-density-tiles": "topics.shipping_density_tiles",
    # Marine Regions 的 WFS（EEZ 的屬性與界線，界線約 25 MB、2 分鐘）、FAO FishStat（約 6 MB）、FAOSTAT 土地利用（約 3 MB）、
    # 漁業署《漁業統計年報》的生產量報表（約 4 MB）
    "oceans": "topics.oceans",
    # 海鮮的貿易（併進海洋與漁業主題）：BACI HS92（2.4 GB，跟貿易主題同一個檔）的第 03 章，幾分鐘
    "seafood-trade": "topics.seafood_trade",
    # Cottom et al. 的 SPOT 輸出（OWID 快照的 Dryad 檔，4 MB）、Meijer et al. 的河口（figshare，0.7 MB）、
    # BACI HS92 版（2.4 GB，讀 HS 3915 約 5 分鐘）、環境部的一般廢棄物與資源回收、財政部的 HS 3915
    "plastic": "topics.plastic",
    "fossil-fuels": "topics.fossil_fuels",  # 第一次會下載 EIA（24 MB）、BACI HS92（2.4 GB，跟塑膠污染共用）、GEM 四個 tracker（約 430 MB）
    # 一次能源組成、能源強度、能源進口依存度（第十批 163；fossil-fuels 最後也會跑）；約 30 秒
    "energy-mix": "topics.energy_mix",
    # 煉油廠（英文維基的清單＋Wikidata 座標，第十批 163；fossil-fuels 最後也會跑）
    "refineries": "topics.refineries",
    # 電價與油價（Eurostat、歐盟 Weekly Oil Bulletin、EIA、台電、世界銀行，加上逐筆查的其他國家；第十批 164）
    "energy-prices": "topics.energy_prices",
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
    # 太陽能板（併進半導體主題）：BACI HS22 版（約 300 MB，2022–2024），幾十秒；財政部的 854142、854143 對照
    "solar-panels": "topics.solar_panels",
    "minerals": "topics.minerals",  # 第一次會下載 MCS 2020–2026 各礦種章節的 PDF（約 110 個、36 MB）
    # 關鍵礦產的貿易流向（稀土、永久磁鐵、鈾）：BACI HS92（2.4 GB，塑膠污染的同一份快取）；約 5 分鐘
    "minerals-trade": "topics.minerals_trade",
    # 關鍵礦產（二）：礦石與金屬出口占比（WDI＋Atlas 自算台灣；Atlas 四位碼 547 MB 邊下載邊篩）、資源租金、循環物料、台灣的礦產
    "minerals-economy": "topics.minerals_economy",
    # 產業與工業：台灣是世界第幾、各國稱霸幾項產品（Atlas HS92 四位碼 452 MB 邊下載邊篩，快取約 98 MB；約 1 分鐘）
    "industry-products": "topics.industry_products",
    # 產業與工業：產能利用率（Eurostat 季資料）、工業與服務業的勞動生產力（WDI）、GDP 的十大產業（Eurostat＋主計總處）
    "industry-productivity": "topics.industry_productivity",
    # 人均收入：勞動報酬占 GDP（ILOSTAT SDG 10.4.1，ILO 模型估計，含台灣）
    "income-labour-share": "topics.labour_share",
    # 重分配與貧窮（新主題）：OECD IDD 的市場與可支配所得吉尼、相對貧窮率，TaxBEN 的低收入給付與脫貧工時
    "redistribution": "topics.redistribution",
    # 社會保障覆蓋率（新主題）：ILOSTAT SDG 1.3.1 的 9 項，含台灣
    "social-protection": "topics.social_protection",
    # 政府財政：公共社會支出占 GDP（OECD SOCX，加 key 只下載公共、占 GDP 的部分）
    "fiscal-social-spending": "topics.social_spending",
    # 薪資與工時：十分位差距、低薪比例、最低工資占薪資（OECD Earnings Distribution，台灣自算最低工資占平均薪資）
    "wages-distribution": "topics.wages_distribution",
    # 就業失業與退休：尼特族（ILO，含台灣）、年金所得替代率（OECD PAG）、工作貧窮（ILO SDG 1.1.1）
    "employment-extra": "topics.employment_extra",
    # 存款與財產：有負債的家庭比例、財富撐不過半年貧窮線的人（OECD Wealth Distribution Database）
    "wealth-debt": "topics.wealth_debt",
    # 勞動權利與解僱保護（新主題）：OECD EPL（VERSION1）、ILOSTAT SDG 8.8.2
    "labour-rights": "topics.labour_rights",
    # 稅率：企業新投資的有效平均稅率（OECD ETR）、遺產及贈與稅占 GDP（OECD 全球稅收統計＋財政部稅目別）
    "taxes-effective": "topics.taxes_effective",
    # 外匯存底與外債：外債的幣別組成（World Bank IDS，source 6 的 series 網址）
    "reserves-debt-currency": "topics.debt_currency",
    # 外匯存底與外債：OECD 國家風險等級（0–7 級；PDF 由使用者用瀏覽器下載到 map-plan 的 data/oecd/，先複製到 .cache/oecd/）
    "reserves-country-risk": "topics.country_risk",
    # 光害（新主題）：Falchi 等人 2016 的人工夜空亮度（本機在原始 30 角秒網格上分成 6 級，map-plan data/gfz/ 複製到 .cache/gfz/）
    # ＋ GHS-POP 2015 年 30 角秒人口（第一次會下載 480 MB）
    "light-pollution": "topics.light_pollution",
    # 物價與消費：實質利率（WDI FR.INR.RINR）、食物價格通膨（FAOSTAT CP 月資料＋主計總處食物類），輸出 fiscal/
    "prices-food-rates": "topics.prices_food_rates",
    # 保險（新主題，金融服務）：OECD Global Insurance Statistics（含台灣，15 個維度的 key 要補滿）、保發中心的投保率
    "insurance": "topics.insurance",
    # 銀行與信貸（新主題，金融服務）：WDI 私部門信貸、廣義貨幣、不良貸款、銀行資本；台灣用央行 LOAN-S 與金管會 banking12
    "banking": "topics.banking",
    # 股市規模：周轉率、成交值占 GDP（WDI 轉載 WFE；台灣用證期局重要指標的表 12、13、35）
    "stock-market-turnover": "topics.stock_turnover",
    # 企業與品牌：Forbes Global 2000、前 50 大營收企業、最有價值的品牌、獨角獸（英文維基固定版本的表，CC BY-SA 4.0）
    "companies-rankings": "topics.company_rankings",
    # 便利商店與連鎖品牌：超市、藥妝店與藥局（OSM 經 QLever 的 brand:wikidata，兩支 TSV 匯出）
    "chain-retail": "topics.chain_retail",
    # 企業的誕生、死亡與存活（新主題）：Eurostat bd_size（20 MB），台灣用商業發展署的公司登記統計
    "business-demography": "topics.business_demography",
    # 開公司有多麻煩、國家持股有多深（新主題）：OECD 產品市場管制指標 PMR（2018、2023，含台灣）
    "market-regulation": "topics.market_regulation",
    # 房價與房租（新主題，不動產）：Eurostat 派駐地城市的房租、台灣六都的實價登錄租金，輸出 housing/rents.json
    "real-estate-rents": "topics.real_estate_rents",
    # 沒人住的房子與買賣量（新主題，不動產）：Eurostat 2011、2021 年普查與住宅買賣件數，台灣用 2020 年普查與實價登錄
    # 2021–2026 年各季的成屋買賣（一季一個 8–16 MB 的 zip，抽出要用的欄位後刪掉，第一次跑約 10 分鐘）
    "housing-market": "topics.housing_market",
    # 營建成本、地價與房屋稅（新主題，不動產）：Eurostat sts_copi_a、WDI 消費者物價、OECD 地方政府的經常性財產稅，
    # 台灣用財政部的稅目別實徵淨額與內政部的公告地價統計
    "property-costs": "topics.property_costs",
    # 零售業的規模與電子商務（新主題，消費與零售）：Eurostat isoc_ec_evaln2（1.2 MB）、sbs_ovw_act（篩選後的 JSON），
    # 台灣用主計總處 110 年工商普查的零售業
    "retail": "topics.retail",
    "employment": "topics.employment",
    "reserves": "topics.reserves",
    "stock-market": "topics.stock_market",
    # OECD 的房價指標（約 17 MB）、BIS 的住宅價格、內政部不動產資訊平台、主計總處的消費者物價（約 27 MB）
    "house-prices": "topics.house_prices",
    "travel": "topics.travel",  # IANA 時區（tzdata 套件）、Wikidata、維基百科
    "travel-emergency": "topics.travel_emergency",  # 旅行實用的緊急電話（維基百科固定版本的網頁），補進現有的 details.json
    "travel-units": "topics.travel_units",  # 旅行實用的單位偏好（第二十二批 391，CLDR units.xml），補進現有的 details.json
    "travel-address-phone": "topics.travel_address_phone",  # 地址與電話的寫法（候選 679、680，Google libaddressinput、libphonenumber），補進 details.json
    # 樓層怎麼數（第二十二批 396）：維基共享資源的地圖（本機 session 下載，map-plan 的 data/wikimedia/，先複製到 .cache/wikimedia/）
    "travel-floors": "topics.travel_floors",
    "world-heritage": "topics.world_heritage",  # UNESCO DataHub（map-plan 的 data/unesco/）；中文名稱沿用現有的檔，不再查 Wikidata
    "world-heritage-photos": "topics.world_heritage_photos",  # 現有的 sites.json 補照片（Wikidata P18、Commons 的攝影者）
    "space": "topics.space",  # 第一次會下載 GCAT 的 satcat 與 launch（約 33 MB）
    "olympics": "topics.olympics",  # 第一次會向維基百科查 56 屆的獎牌榜（約 1 分鐘）
    "sports-attendance": "topics.sports_attendance",  # 去現場看運動比賽（Eurostat ilc_scp04，CC BY 4.0）
    "road-races": "topics.road_races",  # 馬拉松、超馬與鐵人賽事（Wikidata，CC0）
    "climbing": "topics.climbing",  # 攀岩場（OpenStreetMap 經 QLever，ODbL）
    "cycling": "topics.cycling",  # 自行車路線（OSM 經 QLever，ODbL）與歐洲城市的騎車通勤（Eurostat，CC BY 4.0）
    # 要先有 geo 的國界；第一次會從 Zenodo 下載 2013–2024 年的 VIIRS 夜間燈光（12 個檔、共約 800 MB，
    # Zenodo 每條連線很慢，平行下載約 20 分鐘），GHS-POP 用人口網格的快取（2015、2020、2025 三期）
    "night-lights": "topics.night_lights",
    # 夜間燈光的約 500 m 網格圖磚（不進版本控制，部署時產生）；4 期，每期約 31 MB、5 千張
    "night-lights-tiles": "topics.night_lights_tiles",
    # Wikidata 的 6 個 SPARQL 查詢（每個 2–5 秒）與約 40 批名稱（wbgetentities）、FAOSTAT 土地利用（陸地面積）；
    # 要先有 geo 的國界，也讀人口、旅行實用、語言、民主與自由、城市、海拔、國際組織、台灣的外交已經產生的資料檔
    "profiles": "topics.profiles",
    # 國家小檔案的匯率制度（英文維基百科照 IMF AREAER 2023 整理的表）
    "exchange-regime": "topics.exchange_regime",
    # Wikidata：7 個 SPARQL 查詢（150 m 以上的候選、所在行政區往上 4 層、城市類別、國家代碼）與約 50 批 wbgetentities
    # （第一次約 1 分鐘，之後用快取不到 1 秒）；要先有 geo 的國界，也讀城市主題的 cities.json（P131 找不到城市時用）。
    # 跑完要重跑 profiles（小檔案的「最高的大樓」讀這裡的 buildings.json）
    "skyscrapers": "topics.skyscrapers",
    "towers": "topics.towers",
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
    # 晝夜與季節的夜半邊燈光：夜間燈光的 VIIRS 最新一年（Zenodo 約 60 MB，跟 night-lights 共用快取）縮成 0.1° 的灰階 PNG；約 1 分鐘
    "daylight-lights": "topics.daylight_lights",
    # 要先有 geo 的國界（與河流主題的海域網格，名稱用）；第一次會向 NASA 日食網站一頁一頁抓約 300 次日食的貝塞爾根數
    # （五千年日食典與路徑表兩組，每頁間隔 0.3 秒，共約 600 頁、5 MB），算路徑與經過的國家第一次約 10 分鐘，之後用快取約 5 分鐘
    "eclipses": "topics.eclipses",
    # 月食（併進日食與月食主題，輸出到 topics/eclipses/）：NASA 五千年月食目錄 3 頁（約 240 KB）；以首都計算，要先跑
    # daylight（capitals.json），不必先跑 eclipses；不到 10 秒
    "lunar": "topics.lunar",
    "eclipse-lists": "topics.eclipse_lists",
    # 日食的貝塞爾根數（新14，瀏覽器算任一刻的本影）：跟 eclipses 同一份快取，沒有快取時一樣向 NASA 一頁一頁抓（約 600 頁）
    "eclipse-elements": "topics.eclipse_elements",
    # 河流與流域的國土面積（新17 的圓餅）：讀 rivers 已經輸出的檔與 FAOSTAT 的陸地面積（海洋與漁業同一份快取），不重算河道
    "rivers-land": "topics.rivers_land",
    "inland-water": "topics.inland_water",
    "river-types": "topics.river_types",
    "gssp": "topics.gssp",
    "artificial-islands": "topics.artificial_islands",
    "mountain-passes": "topics.mountain_passes",
    "mountain-people": "topics.mountain_people",
    "wetlands": "topics.wetlands",
    "fish-jobs": "topics.fish_jobs",
    "language-wals": "topics.language_wals",
    "worship": "topics.worship",
    # 大河一年中的流量（製作手冊第十七批 277）：Open-Meteo Flood API（GloFAS 再分析）2015–2024 年的每日流量算月平均；
    # 讀 rivers 已經輸出的 rivers.json 挑河。免費額度每天 1 萬次，60 條河要分兩天抓（快取在 .cache/open-meteo-flood/，
    # 額度用完就停，隔天再跑接著抓）；每條河之間停 200 秒，一天約 2–3 小時
    "river-flow": "topics.river_flow",
    # 新生兒篩檢（製作手冊第十九批 288）：Therrell 等 2024 的全文 XML（Europe PMC，CC BY 4.0）的七張表
    "newborn-screening": "topics.newborn_screening",
    # 紅血球的遺傳性狀（製作手冊第十九批 289）：Howes 2012、Piel 2013 的國家表（PDF）與 Malaria Atlas Project 的網格（約 32 MB）
    "red-cell-traits": "topics.red_cell_traits",
    # 乳糖不耐（製作手冊第十九批 290）：Itan 等 2010 的附件 1（Europe PMC 的附件 zip，讀 .xls 要 xlrd）
    "lactase": "topics.lactase",
    # 藥物過敏與藥效的基因（製作手冊第十九批 291）：CPIC API 的 population_frequency_view（CC0，依 9 個生物地理群）
    "drug-genes": "topics.drug_genes",
    # 抗藥性（製作手冊第十九批 293）：WHO GHO 的 GLASS 指標（xmart）、data.who.int 的抗藥性結核（RELAY_TB）、UN WPP 的人口
    "antimicrobial-resistance": "topics.antimicrobial_resistance",
    # 醫療照護相關感染與住院病人用抗生素（併進抗藥性，第二十批 320）：ECDC 點盛行率調查 2022–2023 的國家摘要表（35.9 MB）
    "amr-hai": "topics.amr_hai",
    "medicines": "topics.medicines",
    "drug-consumption": "topics.drug_consumption",
    "taiwan-medicines": "topics.taiwan_medicines",
    "clinical-trials": "topics.clinical_trials",
    "pharma-companies": "topics.pharma_companies",
    "aldh2": "topics.aldh2",
    # 航運與港口的商船隊（新27 的圓餅）：只跑 shipping 的 merchant_fleet（UNCTADstat），不下載港口與航港局的資料
    "shipping-fleet": "topics.shipping_fleet",
    "cruise": "topics.cruise",  # 郵輪的船籍與母港（Wikidata 經 QLever，CC0；台灣用臺灣港務的國際商港旅客）
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
    # 一國有幾種氣候類型：讀 koppen 步驟輸出的 panel.json 數類型（要在 koppen 之後跑）
    "koppen-diversity": "topics.koppen_diversity",
    # 地表的岩石種類：GLiM 0.5° 網格（PANGAEA，38 KB 的 zip）；幾秒
    "lithology": "topics.lithology",
    # 特殊地形：Wikidata 的綠洲、峽灣、天然拱門與奇岩、環礁、泥火山、滲穴、間歇泉（一次 SPARQL）；幾秒（第一次查要等查詢服務）
    "special-landforms": "topics.special_landforms",
    # 填海造陸：Sengupta 等 2023 的 135 個沿海城市（Zenodo，22 KB 的 xlsx）＋ Natural Earth 的城市位置與中文名稱；幾秒
    "reclamation": "topics.reclamation",
    # 核子事故：手工整理的事件表（英文維基百科三篇的固定版本，sources/nuclear_accidents.py）＋ Wikidata 的座標；幾秒
    "nuclear-accidents": "topics.nuclear_accidents",
    "nuclear-waste": "topics.nuclear_waste",
    "energy-policy": "topics.energy_policy",
    "science-facilities": "topics.science_facilities",
    "starlink": "topics.starlink",
    "wafer-fabs": "topics.wafer_fabs",
    "rd-companies": "topics.rd_companies",
    # 航空的擴充（第十批 175）：最繁忙的航線、航空貨運、貨運機場、聯盟、廉價航空
    "aviation-extra": "topics.aviation_extra",
    # 交通的擴充（第十批 176）：高鐵、地鐵系統、跨國鐵路、磁浮與單軌、貨運量
    "rail-extra": "topics.rail_extra",
    # 冰河、海冰與海平面：WGMS AMCE（54 MB）、NSIDC 海冰邊緣（約 200 個小檔）、NOAA STAR 海平面網格；
    # 沿海的平均用颱風主題的 NearIndex、內陸國用海洋主題的 Marine Regions 清單；約 1 分鐘
    "ice": "topics.ice",
    "sea-level-rise": "topics.sea_level_rise",  # IPCC AR6 的海平面上升推估：從 9.2 GB 的 zip 用 HTTP Range 讀三個情境（各約 72 MB），要 h5py
    # 北極航道能通航幾天（併進冰河、海冰與海平面，輸出到 topics/ice/）：NOAA/NSIDC 海冰濃度 CDR G02202 第 6 版的每日檔，
    # 1979–2025 年每年一個（約 70–100 MB，共約 4 GB，第一次下載約 10 分鐘），之後約 1 分鐘
    "arctic-routes": "topics.arctic_routes",
    # 各國在讀什麼：Wikimedia 的差分隱私每日瀏覽量，邊下載邊彙整成每月每國的前幾名（第一次約 30 分鐘、約 13 GB，
    # 原始檔不留，月份的彙整快取在 .cache/wikimedia/months/）；中文、英文名稱用 Wikidata 的 SPARQL（約 5 分鐘），快取在 labels.json
    "reads": "topics.reads",
    # 帝國與疆界：Cliopatria（Zenodo 299 MB）取樣 119 個年份的政體範圍、台灣依史實修正，加上 COLDAT 的殖民年份；
    # 政體的中文名稱跟各國在讀什麼共用 Wikidata 的快取（labels.json）；約 2 分鐘
    "empires": "topics.empires",
    # 帝國與疆界的依日期殖民地疆界（第十七批 279）：OpenHistoricalMap 的 Overpass，約 700 個時段分批拿形狀（第一次約 5–10 分鐘），快取在 .cache/ohm/
    "ohm-borders": "topics.ohm_borders",
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
    "landforms": "topics.landforms",  # 要先有 elevation 的 profiles.json
    # 出生的季節：UNdata 表 55 的逐月出生數（一國一頁，第一次約 156 頁）、內政部按登記的月份；約 1 分鐘
    "birth-season": "topics.birth_season",
    # 健康平均餘命（健康主題）：WHO 的 HALE 與平均壽命（data.who.int 的整檔 CSV，GHO API 壞了），台灣手抄衛福部的數字；幾秒
    "hale": "topics.hale",
    # 學制與開學月份（教育主題）：UIS 的開學月份（CC BY-SA 4.0）、世界銀行的義務教育年數與入學年齡，台灣依法規；幾秒
    "school-calendar": "topics.school_calendar",
    # 生物圈保護區（世界遺產主題）：Wikidata 的項目去重後畫點（要先跑 world-heritage，用它的最新年份）；幾秒
    "biosphere": "topics.biosphere",
    "heritage-extra": "topics.heritage_extra",
    "tw-wetlands": "topics.tw_wetlands",  # 台灣的國家重要濕地（map-plan data/nlma/ 的 zip 複製到 .cache/nlma/）
    # 從台北看世界：各國首都離台北的距離、方位、距離圈與大圓航線（要先跑 daylight，用它的首都檔）；不到 1 秒
    "taipei-view": "topics.taipei_view",
    # 熊貓外交：手工整理的表（sources/panda_diplomacy.py，英文維基固定版本），動物園的座標與中文名稱查 Wikidata；幾秒
    "pandas": "topics.pandas",
    # 景點地圖：Wikidata 的博物館、動物園與水族館、樂園與雲霄飛車（第一次查約 40 分鐘，之後用快取）＋文化部的博物館
    "attractions": "topics.attractions",
    "attractions-extra": "topics.attractions_extra",
    # 植物園（景點地圖的第四個圖層，輸出到 topics/attractions/gardens.json）：Wikidata 一個 SPARQL 查詢；不必重跑 attractions，幾秒
    "botanical-gardens": "topics.botanical_gardens",
    # 南極研究站：Wikidata 的研究站，跟 COMNAP 2024 的名單核對（只用核對結果）；幾秒
    "antarctic-stations": "topics.antarctic_stations",
    "antarctic-tourism": "topics.antarctic_tourism",
    "show-caves": "topics.show_caves",
    "hunting-fishing": "topics.hunting_fishing",
    # MAPPPD v5.0 的全部普查 CSV（2.1 MB，不必登入），不到 1 秒
    "penguins": "topics.penguins",
    # 南極的冰下湖：Wilson 等 2025 的 Zenodo 資料（560 KB，不必登入）；不到 1 秒
    "subglacial-lakes": "topics.subglacial_lakes",
    "subglacial-lakes-all": "topics.subglacial_lakes_all",  # Livingstone 2022 的 773 個（xlsx 從 map-plan 複製到 .cache/livingstone/）
    # 國家公園：Wikidata 的國家公園點、WDI 的陸域保護區占國土；幾秒（Wikidata 第一次查要等查詢服務）
    "national-parks": "topics.national_parks",
    # 纜車與索道：Wikidata 的空中纜車、吊廂纜車、纜索鐵道（不含吊椅）；幾秒
    "cable-cars": "topics.cable_cars",
    # 各國的特色食物：Wikidata 的起司、麵包、甜點（依原產國）；幾秒（第一次查要等查詢服務）
    "foods": "topics.foods",
    # 節慶：Wikidata 的節慶（依月份與種類）＋文化資產局登錄的台灣民俗；幾秒（第一次查 Wikidata 約 5 分鐘）
    "festivals": "topics.festivals",
    "festival-food": "topics.festival_food",  # 跑在 festivals 之後
    "festival-conventions": "topics.festival_conventions",
    "concert-tours": "topics.concert_tours",
    "chinatowns": "topics.chinatowns",  # Wikidata 的唐人街（一次 SPARQL）加上依維基分區條目補的表
    # 雲端機房的區域：AWS、Google Cloud、Azure 的區域（手工整理的事實表 sources/cloud_regions.py）；不到 1 秒
    "cloud-regions": "topics.cloud_regions",
    # 最古老的公司：英文維基「List of oldest companies」（固定版本）＋ Wikidata 的座標；幾秒
    "oldest-companies": "topics.oldest_companies",
    # 品牌的發源地：Wikidata 的時尚品牌與汽車品牌（SPARQL 兩次）
    "brands": "topics.brands",
    # 大企業的據點：12 家公司官方公開的據點（手工整理的 pipeline/data/company-sites/sites.csv）＋ AWS、Azure 的雲端區域；不下載
    "company-sites": "topics.company_sites",
    # 各國的航空公司：Wikidata 的客運航空公司（依總部所在國，含已停業的）；幾秒
    "airlines": "topics.airlines",
    # 叫車服務在哪些國家：Uber、Grab、滴滴（手工整理的表，Uber 的國家照使用者用瀏覽器存的城市頁）
    "ride-hailing": "topics.ride_hailing",
    "robotaxi": "topics.robotaxi",
    # 海外軍事基地（軍事主題）：英文維基「List of countries with overseas military bases」（固定版本），國家層級的流向；不到 1 秒
    "overseas-bases": "topics.overseas_bases",
    # 最新的兵力（軍事主題）：英文維基「List of countries by number of military and paramilitary personnel」（固定版本）；不到 1 秒
    "military-personnel": "topics.military_personnel",
    # 此刻世界的新聞熱點：只輸出 FIPS 10-4 → ISO 的對照表（GeoNames）；事件由瀏覽器直接讀 GDELT；不到 1 秒
    "news": "topics.news",
    # 長途步道：OSM 的國際級、國家級步道（本機執行 map-plan 的 scripts/osm_hiking_routes.py 下載，放進 .cache/osm/）＋觀光署的國家步道；約 1 分鐘
    "trails": "topics.trails",
    # 電子垃圾：Global E-waste Monitor 2024 的 PDF 附錄表（CC BY-NC-SA 3.0 IGO）；讀 PDF 約 30 秒
    "ewaste": "topics.ewaste",
    # 最長的直飛航線：英文維基「Longest flights」（固定版本）的現行與停飛前 30 名，機場座標用 OurAirports；不到 1 秒
    "longest-flights": "topics.longest_flights",
    # 最繁忙的機場（交通主題）：英文維基「List of busiest airports by passenger traffic」（固定版本）2020–2025 每年前 50 名；不到 1 秒
    "busiest-airports": "topics.busiest_airports",
    # 觀光鐵道與登山鐵路：Wikidata（用 QLever 查，含子類別）的保存、齒軌、登山、森林鐵路；第一次查約 1 分鐘
    "heritage-railways": "topics.heritage_railways",
    # 月球與火星的登陸：英文維基「List of landings on extraterrestrial bodies」（固定版本）的月球、火星兩張表；不到 1 秒
    "landings": "topics.landings",
    # 太空的擴充（第十批 171）：OECD 的政府太空研發預算、英文維基的太陽系探測器清單
    "space-extra": "topics.space_extra",
    "space-launches": "topics.space_launches",  # 太空的左側欄：GCAT 逐次的入軌發射
    # F1 賽道與冠軍：Jolpica-F1 的資料庫匯出（延遲 14 天的版本，不必登入，ZIP 約 15 MB；CC BY-NC-SA 4.0）；幾秒
    "f1": "topics.f1",
    # 賽車：英文維基百科 12 個賽季條目與 5 個歷年列表（固定版本）、Wikidata 的座標；F1 的歷年讀 f1 這一步的 circuits.json（要先跑 f1）；
    # 第一次下載約 2 分鐘（維基百科常回 429，照 Retry-After 等）
    "racing": "topics.racing",
    # 奧運場館：英文維基百科 58 屆的場館條目（固定版本）、Wikidata 的座標；第一次下載約 3 分鐘（維基百科常回 429）
    "olympic-venues": "topics.olympic_venues",
    # 飛航情報區：VATSpy 的範圍（CC BY-SA 4.0，依 FIR 合併扇區）、OurAirports 的代碼字首對國家；約 1 分鐘（聯集面積）
    "airspace": "topics.airspace",
    "long-run": "topics.long_run",  # Gapminder 1800 年起的人口、人均 GDP、平均壽命（人口、人均收入、健康主題）
    # 隕石撞擊坑（特殊地形的圖層）與海溝（海洋與漁業的圖層）：Wikidata（CC0），兩支 SPARQL；幾秒
    "craters-trenches": "topics.craters_trenches",
    "castles": "topics.castles",
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
