"""雲端機房的區域：AWS、Google Cloud、Microsoft Azure 已經開放給一般客戶的公有雲區域（手工整理，2026-10-29 查）。

每一列：(業者, 區域代碼, 業者的顯示名稱, 城市, 國家 ISO3, 緯度, 經度, 開放年份, 出處網址)。
- 業者："aws"、"google"、"azure"。
- 顯示名稱：AWS 用「Asia Pacific (Taipei)」這種名稱；Azure 用 Microsoft Learn 的 Region 欄（例如 Taiwan North）；
  Google 沒有另外的顯示名稱，用 Compute Engine 區域表的 Location 欄（去掉最後的 APAC、Europe 等大區）。
- 城市：業者寫的城市。業者只寫國家或州（例如 AWS 的 N. Virginia、Azure 的 Iowa）時，用常見報導的城市，該列的註解寫明。
- 座標：城市的大約座標（小數 2 位），不是機房的位置；業者都不公開機房位置。
- 開放年份：一般客戶可以用（GA）的年份，不是宣布的年份。
  AWS Osaka 用成為完整區域的 2021 年（2018 年起是限定用途的 Local Region）；AWS Beijing 用 2016 年（2013 年起是有限預覽）；
  Google us-central1、europe-west1 用 Compute Engine GA 的 2013 年（2012 年起是預覽），asia-east1 用 Compute Engine 開放台灣 zone 的 2014 年
  （英文維基百科的表寫 2013 年第 4 季，是機房啟用的時間）。
- 年份或城市沒能確認的，該列的註解以「待確認：」開頭，寫明哪裡不確定。

**出處**（都是 2026-10-29 讀的；用 curl 時 User-Agent 是 "skywitness-map/1.0 (+https://github.com/skywitness/map)"）：
- Google：區域清單與地點用 Compute Engine 的 Regions and zones 文件（https://cloud.google.com/compute/docs/regions-zones ，
  轉址到 docs.cloud.google.com，頁面寫 2026-10-28 更新；Google Cloud 文件依 CC BY 4.0），共 43 個區域。開放年份大多用同樣是 CC BY 4.0 的
  Cloud Storage release notes（每個新區域都有「… region launched」或「Cloud Storage is now available in …」，網址的錨點就是那一天），
  2016 年以前與 2024 年以後的用 Google 的部落格與新聞。https://www.gstatic.com/ipranges/cloud.json 有 48 個 scope，用來對照代碼。
- Azure：區域清單用 Microsoft Learn 的 Azure regions list（https://learn.microsoft.com/en-us/azure/reliability/regions-list ，2026-10-27 更新，
  只讀一次），59 列，其中 Taiwan North、Southeast Asia 3 標示「preview」。中國的區域用 Learn 的「Azure in China regions」與 docs.azure.cn 的
  區域清單（都沒寫地點，地點用 TechCrunch 與 azurespeed.com）。開放年份用 Azure Updates（https://azure.microsoft.com/en-us/updates?id=… ；
  頁面是用 JavaScript 載入的，內容從頁面背後的 www.microsoft.com/releasecommunications/api/v2/azure/<id> 讀）、news.microsoft.com 與新聞。
- AWS：AWS Site Terms 禁止資料探勘與機器人，所以沒有讀 aws.amazon.com、docs.aws.amazon.com（也沒有讀 press.aboutamazon.com、
  amazonaws.cn、ip-ranges.amazonaws.com）。清單與日期用 hidekazu-konishi.com 的「AWS History and Timeline - Global Infrastructure」
  （2026-09-22 更新，列出每個區域開放的日期），再用 TechCrunch、RCR Wireless、Converge Digest、InfoQ、W.Media 等新聞交叉核對 17 個區域，
  年份都一致。AWS 自己說沙烏地阿拉伯開放後會是第 40 個區域，也就是現在 39 個 = 這裡的 37 個 + GovCloud 2 個，對得上。
- 英文維基百科（Amazon Web Services、Google Cloud Platform、Microsoft Azure）只用來找線索；Google Cloud Platform 條目的區域表只在
  europe-west1 當作出處。

**範圍**：
- 收：2026-10-29 以前已經 GA 的公有雲區域。
- 中國境內由當地業者營運的也收，該列註解寫明：AWS Beijing（光環新網 Sinnet）、Ningxia（西云數據 NWCD）；Azure China East 2、North 2、
  North 3、East 3（世紀互聯 21Vianet）。Azure 第一代的 China North、China East（2014 年開放）已在 2026-07-01 退役
  （docs.azure.cn「compute-gallery-migrate-china-regions」2026-09-30 版），不收。
- AWS European Sovereign Cloud 的 eusc-de-east-1（Brandenburg）2026 年 1 月 GA，任何客戶都可以申請，收，註解寫明。
- 限制存取的區域：Microsoft Learn 有列出、標示 restricted 的收，註解寫「限制存取」（Australia Central 2、Brazil Southeast、France South、
  Germany North、Norway West、South Africa West、Switzerland West、UAE Central、China East 3）；Learn 沒有列成一列的
  （例如 Taiwan Northwest、Sweden South）不收。Google 的 Dammam（me-central2）只開放給透過 CNTXT 購買的沙烏地客戶，收，註解寫明。
- AWS 的 Middle East (UAE) 與 Middle East (Bahrain) 2026 年 3 月起因伊朗的無人機與飛彈攻擊受損，UAE 的 mec1-az2 到 2026-09-17 還沒恢復
  （W.Media 2026-09-17），但區域沒有關閉，收，註解寫明。
- 不收：美國政府專用（AWS GovCloud US-West 2011、US-East 2018，AWS Secret／Top Secret，Azure Government）；Edge locations、
  Local Zones、Wavelength；Google cloud.json 有、但 Compute Engine 區域表沒有的 scope（us-central2、us-east7、us-west8、europe-west15，
  不是公開開放的區域或只給特定服務）。

**已宣布、還沒開放**（不收）：
- AWS：沙烏地阿拉伯（2026-08-31 宣布預定 2026 年 12 月開放）；智利 Santiago（2025-05 宣布，當時說預定 2026 年下半年）。
- Google：奧地利 Vienna、希臘 Athens、挪威 Oslo、科威特、馬來西亞、紐西蘭 Auckland（2021–2022 年陸續宣布，沒有公布開放時間）。
- Azure：Taiwan North（台北；Learn 標示 preview，2026-09-01 中央社專訪 Microsoft 說「還沒 GA」、只開放挑選的早期客戶，沒有時間表；
  配對的 Taiwan Northwest 是限制存取）；Southeast Asia 3（馬來西亞 Johor Bahru，preview）；Thailand South（2026-02 宣布）；
  Saudi Arabia Central、Finland Central（開發中）；希臘（2020 宣布）；East US 3（美國 Georgia，2021 宣布）；科威特（2025-03 宣布）。
  都沒有公布開放年份。
"""
from __future__ import annotations

# 常用的出處
_AWS_TL = "https://hidekazu-konishi.com/entry/aws_history_and_timeline_global_infrastructure.html"
_GCS = "https://docs.cloud.google.com/storage/docs/release-notes#"
_AZU = "https://azure.microsoft.com/en-us/updates?id="
_AZ_2010 = "https://www.techpartner.news/news/microsoft-outlines-strategy-for-azure-cloud-services-172130"
_AZ_2012 = "https://rcpmag.com/articles/2012/04/09/microsoft-expands-windows-azure-coverage.aspx"

REGIONS: list[tuple[str, str, str, str, str, float, float, int, str]] = [
    # ---------------- AWS（37 個） ----------------
    ("aws", "us-east-1", "US East (N. Virginia)", "Ashburn", "USA", 39.04, -77.49, 2006, _AWS_TL),  # 業者只寫 N. Virginia；Ashburn 是常見報導的位置
    ("aws", "us-east-2", "US East (Ohio)", "Columbus", "USA", 39.96, -83.00, 2016, "https://techcrunch.com/2016/10/17/aws-launches-region-in-ohio/"),  # 業者只寫 Ohio；Columbus 一帶是常見報導的位置
    ("aws", "us-west-1", "US West (N. California)", "San Francisco Bay Area", "USA", 37.35, -121.95, 2009, _AWS_TL),  # 業者只寫 N. California；舊金山灣區是常見報導的位置
    ("aws", "us-west-2", "US West (Oregon)", "Boardman", "USA", 45.84, -119.70, 2011, _AWS_TL),  # 業者只寫 Oregon；Boardman 一帶是常見報導的位置
    ("aws", "ca-central-1", "Canada (Central)", "Montréal", "CAN", 45.50, -73.57, 2016, "https://techcrunch.com/2016/12/08/amazon-debutes-first-aws-region-in-canada/"),  # 業者只寫 Central；出處寫在 Montreal
    ("aws", "ca-west-1", "Canada West (Calgary)", "Calgary", "CAN", 51.05, -114.07, 2023, _AWS_TL),
    ("aws", "mx-central-1", "Mexico (Central)", "Querétaro", "MEX", 20.59, -100.39, 2025, "https://convergedigest.com/aws-opens-mexico-cloud-region-with-5-billion-investment/"),  # 業者只寫 Central；Querétaro 是常見報導的位置
    ("aws", "sa-east-1", "South America (São Paulo)", "São Paulo", "BRA", -23.55, -46.63, 2011, _AWS_TL),
    ("aws", "eu-west-1", "Europe (Ireland)", "Dublin", "IRL", 53.35, -6.26, 2008, _AWS_TL),  # 業者只寫 Ireland；Dublin 是常見報導的位置
    ("aws", "eu-west-2", "Europe (London)", "London", "GBR", 51.51, -0.13, 2016, "https://techcrunch.com/2016/12/14/amazons-aws-opens-its-first-uk-region-in-london/"),
    ("aws", "eu-west-3", "Europe (Paris)", "Paris", "FRA", 48.86, 2.35, 2017, "https://techcrunch.com/2017/12/18/new-aws-paris-region-makes-it-easier-for-customers-to-follow-frances-data-privacy-rules/"),
    ("aws", "eu-central-1", "Europe (Frankfurt)", "Frankfurt", "DEU", 50.11, 8.68, 2014, "https://techcrunch.com/2014/10/23/aws-expands-its-european-footprint-with-frankfurt-data-center/"),
    ("aws", "eu-central-2", "Europe (Zurich)", "Zurich", "CHE", 47.38, 8.54, 2022, _AWS_TL),
    ("aws", "eu-north-1", "Europe (Stockholm)", "Stockholm", "SWE", 59.33, 18.07, 2018, _AWS_TL),
    ("aws", "eu-south-1", "Europe (Milan)", "Milan", "ITA", 45.46, 9.19, 2020, _AWS_TL),
    ("aws", "eu-south-2", "Europe (Spain)", "Zaragoza", "ESP", 41.65, -0.89, 2022, _AWS_TL),  # 業者只寫 Spain；Aragón 的 Zaragoza 一帶是常見報導的位置
    ("aws", "eusc-de-east-1", "AWS European Sovereign Cloud (Brandenburg)", "Brandenburg", "DEU", 52.40, 13.07, 2026, "https://w.media/aws-launches-european-sovereign-cloud/"),  # 歐洲主權雲（獨立的 aws-eusc partition），2026-01 GA。待確認：讀得到的來源都只寫代碼與 Brandenburg 邦，沒看到正式的顯示名稱；業者沒寫城市，座標暫用邦首府 Potsdam
    ("aws", "me-south-1", "Middle East (Bahrain)", "Manama", "BHR", 26.23, 50.59, 2019, "https://techcrunch.com/2019/07/30/aws-follows-microsoft-into-the-middle-east-opening-new-region-in-bahrain/"),  # 業者只寫 Bahrain，座標用首都 Manama；2026 年伊朗攻擊後有機房受損
    ("aws", "me-central-1", "Middle East (UAE)", "Abu Dhabi", "ARE", 24.45, 54.38, 2022, "https://www.infoq.com/news/2022/09/aws-azure-middle-east/"),  # 待確認：業者只寫 UAE，第三方資料庫寫 Abu Dhabi、也有報導寫 Dubai。2026-03-01 起 mec1-az2 毀損，到 2026-09 還沒恢復
    ("aws", "il-central-1", "Israel (Tel Aviv)", "Tel Aviv", "ISR", 32.09, 34.78, 2023, _AWS_TL),
    ("aws", "af-south-1", "Africa (Cape Town)", "Cape Town", "ZAF", -33.92, 18.42, 2020, _AWS_TL),
    ("aws", "ap-east-1", "Asia Pacific (Hong Kong)", "Hong Kong", "HKG", 22.32, 114.17, 2019, "https://techcrunch.com/2019/04/26/aws-hong-kong/"),
    ("aws", "ap-east-2", "Asia Pacific (Taipei)", "Taipei", "TWN", 25.03, 121.57, 2025, "https://www.crnasia.com/news/2025/data-center/aws-launches-aws-asia-pacific-taipei-region"),  # 2025-06-05 開放
    ("aws", "ap-south-1", "Asia Pacific (Mumbai)", "Mumbai", "IND", 19.08, 72.88, 2016, "https://techcrunch.com/2016/06/28/aws-comes-to-india/"),
    ("aws", "ap-south-2", "Asia Pacific (Hyderabad)", "Hyderabad", "IND", 17.39, 78.49, 2022, _AWS_TL),
    ("aws", "ap-southeast-1", "Asia Pacific (Singapore)", "Singapore", "SGP", 1.35, 103.82, 2010, _AWS_TL),
    ("aws", "ap-southeast-2", "Asia Pacific (Sydney)", "Sydney", "AUS", -33.87, 151.21, 2012, _AWS_TL),
    ("aws", "ap-southeast-3", "Asia Pacific (Jakarta)", "Jakarta", "IDN", -6.21, 106.85, 2021, _AWS_TL),
    ("aws", "ap-southeast-4", "Asia Pacific (Melbourne)", "Melbourne", "AUS", -37.81, 144.96, 2023, _AWS_TL),
    ("aws", "ap-southeast-5", "Asia Pacific (Malaysia)", "Kuala Lumpur", "MYS", 3.14, 101.69, 2024, "https://rcrwireless.com/20240823/telco-cloud/aws-launches-infrastructure-region-malaysia"),  # 待確認：業者只寫 Malaysia，讀過的來源沒寫城市；座標用 Kuala Lumpur（搜尋摘要提到 Cyberjaya 等大吉隆坡地區）
    ("aws", "ap-southeast-6", "Asia Pacific (New Zealand)", "Auckland", "NZL", -36.85, 174.76, 2025, "https://futurecio.tech/aws-opens-in-the-asia-pacific-new-zealand-region/"),  # 業者只寫 New Zealand；2021 年宣布時叫 Auckland Region
    ("aws", "ap-southeast-7", "Asia Pacific (Thailand)", "Bangkok", "THA", 13.76, 100.50, 2025, "https://rcrwireless.com/20250110/asia-pacific/aws-region-thailand"),  # 待確認：業者只寫 Thailand，沒找到機房所在城市的報導，座標用首都 Bangkok
    ("aws", "ap-northeast-1", "Asia Pacific (Tokyo)", "Tokyo", "JPN", 35.68, 139.69, 2011, _AWS_TL),
    ("aws", "ap-northeast-2", "Asia Pacific (Seoul)", "Seoul", "KOR", 37.57, 126.98, 2016, _AWS_TL),
    ("aws", "ap-northeast-3", "Asia Pacific (Osaka)", "Osaka", "JPN", 34.69, 135.50, 2021, _AWS_TL),  # 2018-02 起是只有一個可用區、限定用途的 Osaka Local Region；2021-03-01 才成為完整區域
    ("aws", "cn-north-1", "China (Beijing)", "Beijing", "CHN", 39.90, 116.41, 2016, _AWS_TL),  # 中國境內，由光環新網（Sinnet）營運；2013-12 起有限預覽，2016 年 GA
    ("aws", "cn-northwest-1", "China (Ningxia)", "Zhongwei", "CHN", 37.51, 105.19, 2017, "https://techcrunch.com/2017/12/11/one-month-after-denying-it-will-exit-china-aws-opens-its-second-region-there/"),  # 中國境內，由西云數據（NWCD）營運；業者只寫寧夏，出處引用中衛市委書記，中衛是常見報導的位置

    # ---------------- Google Cloud（43 個） ----------------
    ("google", "africa-south1", "Johannesburg, South Africa", "Johannesburg", "ZAF", -26.20, 28.05, 2024, "https://cloud.google.com/blog/products/infrastructure/heita-south-africa-new-cloud-region"),
    ("google", "asia-east1", "Changhua County, Taiwan", "Changhua County", "TWN", 24.08, 120.54, 2014, "https://techcrunch.com/2014/04/15/google-cloud-platform-expands-to-asia-pacific-with-2-new-compute-engine-zones/"),  # 業者寫彰化縣，座標用彰化市；2014-04 開放 asia-east1-a、-b
    ("google", "asia-east2", "Hong Kong", "Hong Kong", "HKG", 22.32, 114.17, 2018, _GCS + "October_22_2018"),
    ("google", "asia-northeast1", "Tokyo, Japan", "Tokyo", "JPN", 35.68, 139.69, 2016, _GCS + "November_07_2016"),
    ("google", "asia-northeast2", "Osaka, Japan", "Osaka", "JPN", 34.69, 135.50, 2019, _GCS + "April_18_2019"),
    ("google", "asia-northeast3", "Seoul, South Korea", "Seoul", "KOR", 37.57, 126.98, 2020, _GCS + "January_24_2020"),
    ("google", "asia-south1", "Mumbai, India", "Mumbai", "IND", 19.08, 72.88, 2017, _GCS + "October_31_2017"),
    ("google", "asia-south2", "Delhi, India", "Delhi", "IND", 28.61, 77.21, 2021, _GCS + "June_29_2021"),
    ("google", "asia-southeast1", "Jurong West, Singapore", "Jurong West", "SGP", 1.34, 103.71, 2017, _GCS + "April_11_2017"),
    ("google", "asia-southeast2", "Jakarta, Indonesia", "Jakarta", "IDN", -6.21, 106.85, 2020, _GCS + "June_08_2020"),
    ("google", "asia-southeast3", "Bangkok, Thailand", "Bangkok", "THA", 13.76, 100.50, 2026, "https://cloud.google.com/blog/products/infrastructure/google-cloud-launches-new-region-in-bangkok-thailand"),  # 2026-01-21
    ("google", "australia-southeast1", "Sydney, Australia", "Sydney", "AUS", -33.87, 151.21, 2017, _GCS + "June_20_2017"),
    ("google", "australia-southeast2", "Melbourne, Australia", "Melbourne", "AUS", -37.81, 144.96, 2021, _GCS + "June_21_2021"),
    ("google", "europe-central2", "Warsaw, Poland", "Warsaw", "POL", 52.23, 21.01, 2021, _GCS + "March_24_2021"),
    ("google", "europe-north1", "Hamina, Finland", "Hamina", "FIN", 60.57, 27.20, 2018, _GCS + "June_11_2018"),
    ("google", "europe-north2", "Stockholm, Sweden", "Stockholm", "SWE", 59.33, 18.07, 2025, "https://cloud.google.com/blog/products/infrastructure/google-cloud-launches-42nd-cloud-region-in-sweden"),  # 業者寫 Stockholm；有報導說機房在 Dalarna 省（沒有核對）
    ("google", "europe-southwest1", "Madrid, Spain", "Madrid", "ESP", 40.42, -3.70, 2022, _GCS + "May_10_2022"),
    ("google", "europe-west1", "St. Ghislain, Belgium", "St. Ghislain", "BEL", 50.47, 3.82, 2013, "https://en.wikipedia.org/wiki/Google_Cloud_Platform"),  # 待確認：沒找到 europe-west1 開放的官方公告；Compute Engine 2013-12-02 GA（公告沒寫區域名稱），維基百科的表寫 2013 年第 4 季
    ("google", "europe-west10", "Berlin, Germany", "Berlin", "DEU", 52.52, 13.40, 2023, _GCS + "August_22_2023"),
    ("google", "europe-west12", "Turin, Italy", "Turin", "ITA", 45.07, 7.69, 2023, _GCS + "March_23_2023"),
    ("google", "europe-west2", "London, England", "London", "GBR", 51.51, -0.13, 2017, _GCS + "June_06_2017"),
    ("google", "europe-west3", "Frankfurt, Germany", "Frankfurt", "DEU", 50.11, 8.68, 2017, _GCS + "August_01_2017"),
    ("google", "europe-west4", "Eemshaven, Netherlands", "Eemshaven", "NLD", 53.44, 6.83, 2018, _GCS + "January_10_2018"),
    ("google", "europe-west6", "Zurich, Switzerland", "Zurich", "CHE", 47.38, 8.54, 2019, _GCS + "March_11_2019"),
    ("google", "europe-west8", "Milan, Italy", "Milan", "ITA", 45.46, 9.19, 2022, _GCS + "April_20_2022"),
    ("google", "europe-west9", "Paris, France", "Paris", "FRA", 48.86, 2.35, 2022, _GCS + "May_02_2022"),
    ("google", "me-central1", "Doha, Qatar", "Doha", "QAT", 25.29, 51.53, 2023, _GCS + "March_30_2023"),
    ("google", "me-central2", "Dammam, Saudi Arabia", "Dammam", "SAU", 26.43, 50.10, 2023, _GCS + "September_19_2023"),  # 只開放給透過 CNTXT 購買的沙烏地客戶
    ("google", "me-west1", "Tel Aviv, Israel", "Tel Aviv", "ISR", 32.09, 34.78, 2022, _GCS + "September_13_2022"),
    ("google", "northamerica-northeast1", "Montréal, Québec", "Montréal", "CAN", 45.50, -73.57, 2018, _GCS + "January_10_2018"),
    ("google", "northamerica-northeast2", "Toronto, Ontario", "Toronto", "CAN", 43.65, -79.38, 2021, _GCS + "August_03_2021"),
    ("google", "northamerica-south1", "Queretaro, Mexico", "Querétaro", "MEX", 20.59, -100.39, 2024, _GCS + "November_18_2024"),
    ("google", "southamerica-east1", "Osasco, São Paulo, Brazil", "Osasco", "BRA", -23.53, -46.79, 2017, _GCS + "September_05_2017"),
    ("google", "southamerica-west1", "Santiago, Chile", "Santiago", "CHL", -33.45, -70.67, 2021, _GCS + "November_16_2021"),
    ("google", "us-central1", "Council Bluffs, Iowa", "Council Bluffs", "USA", 41.26, -95.86, 2013, "https://cloudplatform.googleblog.com/2013/12/google-compute-engine-is-now-generally-available.html"),  # 2012-06 起 Compute Engine 預覽，2013-12-02 GA（公告提到 US zones）；維基百科的表寫 2009 是機房的年份
    ("google", "us-east1", "Moncks Corner, South Carolina", "Moncks Corner", "USA", 33.20, -80.01, 2015, "https://www.silicon.co.uk/workspace/google-launches-useast1-cloud-region-178130"),
    ("google", "us-east4", "Ashburn, Virginia", "Ashburn", "USA", 39.04, -77.49, 2017, _GCS + "May_09_2017"),
    ("google", "us-east5", "Columbus, Ohio", "Columbus", "USA", 39.96, -83.00, 2022, _GCS + "May_24_2022"),
    ("google", "us-south1", "Dallas, Texas", "Dallas", "USA", 32.78, -96.80, 2022, _GCS + "June_06_2022"),
    ("google", "us-west1", "The Dalles, Oregon", "The Dalles", "USA", 45.59, -121.18, 2016, _GCS + "July_20_2016"),
    ("google", "us-west2", "Los Angeles, California", "Los Angeles", "USA", 34.05, -118.24, 2018, _GCS + "July_10_2018"),
    ("google", "us-west3", "Salt Lake City, Utah", "Salt Lake City", "USA", 40.76, -111.89, 2020, _GCS + "February_24_2020"),
    ("google", "us-west4", "Las Vegas, Nevada", "Las Vegas", "USA", 36.17, -115.14, 2020, _GCS + "April_20_2020"),

    # ---------------- Microsoft Azure（61 個：Learn 的 57 個 GA 區域 + 中國 4 個） ----------------
    ("azure", "australiacentral", "Australia Central", "Canberra", "AUS", -35.28, 149.13, 2018, "https://techcrunch.com/2018/04/02/microsoft-launches-2-new-azure-regions-in-australia/"),
    ("azure", "australiacentral2", "Australia Central 2", "Canberra", "AUS", -35.28, 149.13, 2018, "https://techcrunch.com/2018/04/02/microsoft-launches-2-new-azure-regions-in-australia/"),  # 限制存取（給 Australia Central 的客戶做境內災難復原）
    ("azure", "australiaeast", "Australia East", "Sydney", "AUS", -33.87, 151.21, 2014, _AZU + "general-availability-azure-australia-geo"),  # 業者只寫 New South Wales；Sydney 是常見報導的位置
    ("azure", "australiasoutheast", "Australia Southeast", "Melbourne", "AUS", -37.81, 144.96, 2014, _AZU + "general-availability-azure-australia-geo"),  # 業者只寫 Victoria；Melbourne 是常見報導的位置
    ("azure", "austriaeast", "Austria East", "Vienna", "AUT", 48.21, 16.37, 2025, _AZU + "500650"),
    ("azure", "belgiumcentral", "Belgium Central", "Brussels", "BEL", 50.85, 4.35, 2025, "https://news.microsoft.com/source/emea/2025/11/microsoft-ouvre-sa-premiere-region-cloud-en-belgique-accelerant-linnovation-et-la-croissance-economique/?lang=fr"),
    ("azure", "brazilsouth", "Brazil South", "São Paulo", "BRA", -23.55, -46.63, 2014, _AZU + "general-availability-brazil-south-region"),  # 業者只寫 Sao Paulo State，座標用 São Paulo 市
    ("azure", "brazilsoutheast", "Brazil Southeast", "Rio de Janeiro", "BRA", -22.91, -43.17, 2020, _AZU + "new-regions-in-brazil-southeast-for-azure-database-for-mysql"),  # 限制存取。待確認：沒找到區域本身開放的公告，最早看到的是 2020-09 MySQL 在這個區域 GA
    ("azure", "canadacentral", "Canada Central", "Toronto", "CAN", 43.65, -79.38, 2016, _AZU + "general-availability-azure-in-canada"),
    ("azure", "canadaeast", "Canada East", "Quebec City", "CAN", 46.81, -71.21, 2016, _AZU + "general-availability-azure-in-canada"),  # Learn 寫 Quebec，公告寫 Quebec City
    ("azure", "centralindia", "Central India", "Pune", "IND", 18.52, 73.86, 2015, _AZU + "azure-available-in-india-regions"),
    ("azure", "centralus", "Central US", "Des Moines", "USA", 41.59, -93.62, 2014, _AZU + "general-availability-microsoft-azure-us-central-and-us-east-2-regions"),  # 業者只寫 Iowa；Des Moines 一帶是常見報導的位置
    ("azure", "chilecentral", "Chile Central", "Santiago", "CHL", -33.45, -70.67, 2025, _AZU + "496642"),
    ("azure", "denmarkeast", "Denmark East", "Copenhagen", "DNK", 55.68, 12.57, 2026, _AZU + "559406"),
    ("azure", "eastasia", "East Asia", "Hong Kong", "HKG", 22.32, 114.17, 2010, _AZ_2010),  # Windows Azure 2010-02 商用時的六個機房之一
    ("azure", "eastus", "East US", "Boydton", "USA", 36.67, -78.39, 2012, _AZ_2012),  # 待確認：業者只寫 Virginia，2012 年開放時也沒公開地點；Boydton 是 Microsoft 在 Virginia 的大型園區，沒有找到把 East US 對到 Boydton 的可靠來源
    ("azure", "eastus2", "East US 2", "Boydton", "USA", 36.67, -78.39, 2014, _AZU + "general-availability-microsoft-azure-us-central-and-us-east-2-regions"),  # 待確認：業者只寫 Virginia，城市同 East US，沒有核對
    ("azure", "francecentral", "France Central", "Paris", "FRA", 48.86, 2.35, 2018, _AZU + "azure-france-central-and-france-south-regions-now-generally-available"),
    ("azure", "francesouth", "France South", "Marseille", "FRA", 43.30, 5.37, 2018, _AZU + "azure-france-central-and-france-south-regions-now-generally-available"),  # 限制存取
    ("azure", "germanynorth", "Germany North", "Berlin", "DEU", 52.52, 13.40, 2019, _AZU + "microsoft-azure-available-from-new-cloud-regions-in-germany"),  # 限制存取
    ("azure", "germanywestcentral", "Germany West Central", "Frankfurt", "DEU", 50.11, 8.68, 2019, _AZU + "microsoft-azure-available-from-new-cloud-regions-in-germany"),
    ("azure", "indiasouthcentral", "India South Central", "Hyderabad", "IND", 17.39, 78.49, 2026, "https://news.microsoft.com/source/asia/features/microsofts-newest-india-datacenter-region-goes-live-to-power-the-countrys-ai-economy-and-enable-frontier-firms/"),  # 2026-08-06
    ("azure", "indonesiacentral", "Indonesia Central", "Jakarta", "IDN", -6.21, 106.85, 2025, "https://news.microsoft.com/source/asia/2025/05/27/microsoft-opens-indonesia-central/"),  # Learn 寫 Jakarta；Microsoft 的公告寫在 West Java
    ("azure", "israelcentral", "Israel Central", "Modiin", "ISR", 31.90, 35.01, 2023, "https://en.globes.co.il/en/article-microsoft-launches-israel-cloud-region-1001462228"),  # 待確認：業者只寫 Israel；Modiin 是 2020 年宣布時報導的地點，沒有讀到原文核對
    ("azure", "italynorth", "Italy North", "Milan", "ITA", 45.46, 9.19, 2023, _AZU + "general-availability-microsoft-azure-now-available-from-new-cloud-region-in-italy"),
    ("azure", "japaneast", "Japan East", "Tokyo", "JPN", 35.68, 139.69, 2014, "https://blogs.microsoft.com/blog/2014/02/25/windows-azure-services-now-generally-available-in-new-japan-cloud-region/"),  # Learn 寫 Tokyo, Saitama；座標用東京
    ("azure", "japanwest", "Japan West", "Osaka", "JPN", 34.69, 135.50, 2014, "https://blogs.microsoft.com/blog/2014/02/25/windows-azure-services-now-generally-available-in-new-japan-cloud-region/"),
    ("azure", "koreacentral", "Korea Central", "Seoul", "KOR", 37.57, 126.98, 2017, "https://news.microsoft.com/apac/2017/02/21/microsoft-cloud-expands-in-asia-with-microsoft-azure-available-from-korea/"),
    ("azure", "koreasouth", "Korea South", "Busan", "KOR", 35.18, 129.08, 2017, "https://news.microsoft.com/apac/2017/02/21/microsoft-cloud-expands-in-asia-with-microsoft-azure-available-from-korea/"),
    ("azure", "malaysiawest", "Malaysia West", "Kuala Lumpur", "MYS", 3.14, 101.69, 2025, "https://news.microsoft.com/source/asia/features/microsoft-announces-its-first-cloud-region-in-malaysia-empowering-more-malaysian-organizations-to-accelerate-ai-innovation/"),
    ("azure", "mexicocentral", "Mexico Central", "Querétaro", "MEX", 20.59, -100.39, 2024, _AZU + "general-availability-microsoft-azure-now-available-from-new-cloud-region-in-mexico"),  # Learn 寫 Querétaro State，座標用 Querétaro 市
    ("azure", "newzealandnorth", "New Zealand North", "Auckland", "NZL", -36.85, 174.76, 2024, _AZU + "471035"),
    ("azure", "northcentralus", "North Central US", "Chicago", "USA", 41.88, -87.63, 2010, _AZ_2010),  # 業者只寫 Illinois；出處寫 Chicago
    ("azure", "northeurope", "North Europe", "Dublin", "IRL", 53.35, -6.26, 2010, _AZ_2010),  # 業者只寫 Ireland；出處寫 Dublin
    ("azure", "norwayeast", "Norway East", "Oslo", "NOR", 59.91, 10.75, 2019, _AZU + "microsoft-cloud-in-norway-opens-with-availability-of-microsoft-azure"),  # 業者只寫 Norway；Oslo 是常見報導的位置
    ("azure", "norwaywest", "Norway West", "Stavanger", "NOR", 58.97, 5.73, 2019, _AZU + "microsoft-cloud-in-norway-opens-with-availability-of-microsoft-azure"),  # 限制存取；業者只寫 Norway，Stavanger 是常見報導的位置
    ("azure", "polandcentral", "Poland Central", "Warsaw", "POL", 52.23, 21.01, 2023, _AZU + "general-availability-microsoft-azure-available-from-new-cloud-region-in-poland"),
    ("azure", "qatarcentral", "Qatar Central", "Doha", "QAT", 25.29, 51.53, 2022, "https://news.microsoft.com/en-xm/2022/08/31/microsoft-opens-first-global-datacenter-region-in-qatar-bringing-new-opportunities-for-a-cloud-first-economy/"),
    ("azure", "southafricanorth", "South Africa North", "Johannesburg", "ZAF", -26.20, 28.05, 2019, _AZU + "azure-south-africa-regions-are-now-available"),
    ("azure", "southafricawest", "South Africa West", "Cape Town", "ZAF", -33.92, 18.42, 2019, _AZU + "azure-south-africa-regions-are-now-available"),  # 限制存取
    ("azure", "southcentralus", "South Central US", "San Antonio", "USA", 29.42, -98.49, 2010, _AZ_2010),  # 業者只寫 Texas；出處寫 San Antonio
    ("azure", "southindia", "South India", "Chennai", "IND", 13.08, 80.27, 2015, _AZU + "azure-available-in-india-regions"),
    ("azure", "southeastasia", "Southeast Asia", "Singapore", "SGP", 1.35, 103.82, 2010, _AZ_2010),
    ("azure", "spaincentral", "Spain Central", "Madrid", "ESP", 40.42, -3.70, 2024, "https://news.microsoft.com/es-es/2024/06/11/microsoft-opens-its-first-cloud-region-in-spain-to-accelerate-the-development-of-the-ai-economy/"),
    ("azure", "swedencentral", "Sweden Central", "Gävle", "SWE", 60.67, 17.14, 2021, _AZU + "microsoft-azure-available-from-new-cloud-region-in-sweden"),
    ("azure", "switzerlandnorth", "Switzerland North", "Zurich", "CHE", 47.38, 8.54, 2019, _AZU + "microsoft-azure-available-from-new-cloud-regions-in-switzerland"),
    ("azure", "switzerlandwest", "Switzerland West", "Geneva", "CHE", 46.20, 6.14, 2019, _AZU + "microsoft-azure-available-from-new-cloud-regions-in-switzerland"),  # 限制存取
    ("azure", "uaecentral", "UAE Central", "Abu Dhabi", "ARE", 24.45, 54.38, 2019, "https://news.microsoft.com/en-xm/2019/06/19/microsoft-cloud-datacenter-regions-now-available-in-the-uae-to-help-fuel-the-middle-easts-future-economic-ambitions/"),  # 限制存取
    ("azure", "uaenorth", "UAE North", "Dubai", "ARE", 25.20, 55.27, 2019, "https://news.microsoft.com/en-xm/2019/06/19/microsoft-cloud-datacenter-regions-now-available-in-the-uae-to-help-fuel-the-middle-easts-future-economic-ambitions/"),
    ("azure", "uksouth", "UK South", "London", "GBR", 51.51, -0.13, 2016, "https://www.cambridgenetwork.co.uk/news/new-uk-datacenters-announced"),
    ("azure", "ukwest", "UK West", "Cardiff", "GBR", 51.48, -3.18, 2016, "https://www.cambridgenetwork.co.uk/news/new-uk-datacenters-announced"),
    ("azure", "westcentralus", "West Central US", "Cheyenne", "USA", 41.14, -104.82, 2016, _AZU + "general-availability-two-new-azure-regions"),  # 業者只寫 Wyoming；Cheyenne 是常見報導的位置
    ("azure", "westeurope", "West Europe", "Amsterdam", "NLD", 52.37, 4.90, 2010, _AZ_2010),  # 業者只寫 Netherlands；出處寫 Amsterdam
    ("azure", "westindia", "West India", "Mumbai", "IND", 19.08, 72.88, 2015, _AZU + "azure-available-in-india-regions"),
    ("azure", "westus", "West US", "San Francisco Bay Area", "USA", 37.35, -121.95, 2012, _AZ_2012),  # 待確認：業者只寫 California，2012 年開放時也沒公開地點；舊金山灣區是常見的說法，沒有核對
    ("azure", "westus2", "West US 2", "Quincy", "USA", 47.23, -119.85, 2016, _AZU + "general-availability-two-new-azure-regions"),  # 業者只寫 Washington；Quincy 是常見報導的位置
    ("azure", "westus3", "West US 3", "Phoenix", "USA", 33.45, -112.07, 2021, _AZU + "microsoft-azure-generally-available-from-new-cloud-regions-in-arizona"),
    ("azure", "chinaeast2", "China East 2", "Shanghai", "CHN", 31.23, 121.47, 2018, "https://techcrunch.com/2018/06/27/microsoft-launches-two-new-azure-regions-in-china/"),  # 中國境內，由世紀互聯（21Vianet）營運；Learn 沒寫地點，出處寫上海
    ("azure", "chinanorth2", "China North 2", "Beijing", "CHN", 39.90, 116.41, 2018, "https://techcrunch.com/2018/06/27/microsoft-launches-two-new-azure-regions-in-china/"),  # 中國境內，由世紀互聯（21Vianet）營運；Learn 沒寫地點，出處寫北京
    ("azure", "chinanorth3", "China North 3", "Zhangjiakou", "CHN", 40.77, 114.88, 2022, _AZU + "general-availability-azure-log-analytics-in-china-north-3-and-china-east-3"),  # 中國境內，由世紀互聯營運。待確認：沒找到區域本身開放的公告（2021-03 宣布），2022-08 已有服務 GA；Learn 沒寫地點，張家口是 azurespeed.com 寫的
    ("azure", "chinaeast3", "China East 3", "Nantong", "CHN", 31.98, 120.89, 2022, _AZU + "general-availability-azure-log-analytics-in-china-north-3-and-china-east-3"),  # 中國境內，由世紀互聯營運，限制存取（給 China North 3 的客戶做境內災難復原）。待確認：年份同 China North 3；南通是 azurespeed.com 寫的
]
