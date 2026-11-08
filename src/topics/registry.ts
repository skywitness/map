import type { Text } from '../i18n/lang';
import type { TopicDefinition } from './types';

export interface TopicSection {
  /** 下拉選單、主題總覽裡的小標題；沒有小標題的分類是 null（2026-10-30 第十一批 187 起每一類都有小標題） */
  label: Text | null;
  /** 主題的 id，順序就是選單裡的順序 */
  topics: string[];
}

export interface TopicGroupSpec {
  id: string;
  label: Text;
  /** 依小標題分段的主題（2026-10-30 起，第七批 124） */
  sections: TopicSection[];
  /**
   * 下拉選單每一欄放幾段（依 sections 的順序，由左往右），例如 [2, 2, 2]：使用者指定的排法（2026-10-30）。
   * 沒有寫的分類由 TopicNav.tsx 的 packColumns 自動分欄（左邊的欄最滿）；手機上照樣是一欄
   */
  columns?: number[];
}

/**
 * 頂列的主題分類，每一類是一個下拉選單；順序就是畫面上的順序。2026-10-30（第七批 124）起 8 類，選單依小標題分段；
 * 同一天第十一批 187 把能源併進科技，變成 7 類；2026-11-03（第十九批）加醫藥，又是 8 類；同一天景點與獎項與運動獨立成「休閒」，9 類；
 * 2026-11-07 第二十五批 439 能源從科技分出來，10 類；同一天第二十七批 536 休閒拆出「旅遊」，11 類。
 * 新增主題時加進最接近的分類與小標題，也在下面的 TOPIC_MODULES 加一行，再跑 npm run catalog（dev、build 會自動跑）。
 * 分類名稱要短，中文 1024px、英文 1280px 寬的螢幕要放得下整列（DESIGN.md 第 11 節）。
 */
export const TOPIC_GROUP_SPECS: TopicGroupSpec[] = [
  {
    id: 'society',
    label: { zh: '社會', en: 'People' },
    sections: [
      // 夜間燈光 2026-11-03 從地理的「景點」搬過來（使用者要求）
      { label: { zh: '人口與家庭', en: 'Population & family' }, topics: ['population', 'fertility', 'marriage', 'cities', 'housing', 'night-lights'] },
      // 飲食 2026-11-03 從「健康」搬過來（健康那一組搬到醫藥分類）；菜系走到哪裡、鈔票、原產地名稱、地下觀光、狩獵與釣魚
      // 2026-11-07 使用者指定搬到休閒（製作手冊第二十六批 534）
      { label: { zh: '生活與文化', en: 'Life & culture' }, topics: ['religion', 'funeral', 'festivals', 'independence', 'reads', 'happiness', 'diet'] },
      { label: { zh: '平等與法律', en: 'Equality & law' }, topics: ['inequality', 'gender', 'crime', 'laws'] },
      // 2026-11-05 使用者要求每個小類各占一欄、教育放最右邊
      { label: { zh: '教育', en: 'Education' }, topics: ['education', 'pisa'] },
    ],
    // 每個小類各占一欄（2026-11-05 使用者要求）：人口與家庭；生活與文化；平等與法律；教育
    columns: [1, 1, 1, 1],
  },
  {
    // 2026-11-03（製作手冊第十九批，使用者選 A）：社會分類原本的「健康」那一組與血型搬過來，加上基因與藥物的主題
    id: 'medicine',
    label: { zh: '醫藥', en: 'Health' },
    sections: [
      { label: { zh: '健康與疾病', en: 'Health & disease' }, topics: ['health', 'health-spending', 'health-care', 'disease', 'vaccination', 'covid', 'height', 'tobacco-alcohol'] },
      { label: { zh: '基因', en: 'Genes' }, topics: ['blood-types', 'newborn-screening', 'red-cell-traits', 'lactase', 'drug-genes'] },
      { label: { zh: '藥物', en: 'Medicines' }, topics: ['medicines', 'drug-consumption', 'taiwan-medicines', 'antimicrobial-resistance'] },
      // 2026-11-08（製作手冊第二十九批 687，使用者決定現在就開）：中醫相關的五個主題（688–692）做好時依序加進來
      { label: { zh: '傳統醫學', en: 'Traditional medicine' }, topics: ['alt-medicine', 'taiwan-tcm', 'tcm-research', 'tcm-systems', 'tcm-herbs'] },
    ],
    // 一欄一個小類：健康與疾病；基因；藥物；傳統醫學
    columns: [1, 1, 1, 1],
  },
  {
    id: 'economy',
    label: { zh: '經濟', en: 'Economy' },
    // 2026-11-07（製作手冊第二十五批 439，使用者 2026-11-05 核准）：新開農業與糧食、稅（「稅率」拆回自己的主題）、金融服務、
    // 消費與零售四個小類，「財政與金融」剩下財政；「不動產」小類在第一個主題「房價與房租」（第二十五批 470）做好時加上
    sections: [
      { label: { zh: '企業', en: 'Companies' }, topics: ['companies', 'business-demography', 'market-regulation'] },
      { label: { zh: '產業', en: 'Industries' }, topics: ['industry', 'minerals'] },
      { label: { zh: '農業與糧食', en: 'Agriculture & food' }, topics: ['agriculture'] },
      { label: { zh: '所得與財富', en: 'Income & wealth' }, topics: ['income', 'wages', 'employment', 'wealth', 'redistribution', 'social-protection', 'labour-rights'] },
      { label: { zh: '財政', en: 'Public finance' }, topics: ['fiscal', 'reserves'] },
      { label: { zh: '稅', en: 'Taxes' }, topics: ['taxes'] },
      { label: { zh: '金融服務', en: 'Financial services' }, topics: ['banking', 'stock-market', 'insurance'] },
      { label: { zh: '消費與零售', en: 'Consumption & retail' }, topics: ['prices', 'chain-stores', 'retail'] },
      { label: { zh: '不動產', en: 'Real estate' }, topics: ['real-estate', 'housing-market', 'property-costs'] },
    ],
    // 四欄（2026-11-07 使用者要求企業放最左邊（11-05 原本是最右邊），製作手冊第二十六批 533；一欄放幾個小類）：
    // 企業、產業、農業與糧食；所得與財富；財政、稅、金融服務；消費與零售、不動產
    columns: [3, 1, 3, 2],
  },
  {
    id: 'global',
    label: { zh: '國際', en: 'Global' },
    sections: [
      // 觀光、護照與簽證 2026-11-07 搬到旅遊（製作手冊第二十七批 536）
      { label: { zh: '往來', en: 'Flows' }, topics: ['trade', 'migration', 'aid', 'china-lending'] },
      { label: { zh: '政治', en: 'Politics' }, topics: ['empires', 'democracy', 'governance'] },
      { label: { zh: '外交', en: 'Diplomacy' }, topics: ['organizations', 'un-votes', 'taiwan-diplomacy'] },
      // 旅遊警示 2026-11-07 搬到旅遊（製作手冊第二十七批 536）
      { label: { zh: '安全', en: 'Security' }, topics: ['military', 'conflict', 'news'] },
    ],
    // 每個小類各占一欄（2026-11-05 使用者要求，外交在政治右邊、安全左邊）：往來；政治；外交；安全
    columns: [1, 1, 1, 1],
  },
  {
    id: 'environment',
    // 英文 2026-10-30（第十一批 187）由 Climate 改成 Environment
    label: { zh: '環境', en: 'Environment' },
    sections: [
      { label: { zh: '氣候', en: 'Climate' }, topics: ['climate', 'temperature', 'koppen', 'ice', 'wind', 'typhoons'] },
      // 2026-11-07（製作手冊第二十五批 490）「污染」改名「污染與廢棄物」
      { label: { zh: '污染與廢棄物', en: 'Pollution & waste' }, topics: ['air-quality', 'ozone-hole', 'plastic', 'nutrients', 'noise', 'light-pollution', 'industrial-releases', 'contaminated-sites', 'materials'] },
      // 2026-11-07（製作手冊第二十五批 491）「土地與水」拆成「土地」與「水」，兩個小類疊在同一欄
      { label: { zh: '土地', en: 'Land' }, topics: ['land-use', 'forest', 'wildfires', 'megafauna'] },
      { label: { zh: '水', en: 'Water' }, topics: ['water-forest'] },
      // 2026-11-07（製作手冊第二十五批 480）新開
      { label: { zh: '碳與氣候政策', en: 'Climate policy' }, topics: ['climate-action', 'climate-finance', 'cbam'] },
      // 2026-11-07（製作手冊第二十五批 500）新開
      { label: { zh: '環境治理', en: 'Environmental governance' }, topics: ['env-taxes'] },
    ],
    // 每個小類各占一欄（2026-11-05 使用者要求）：氣候；污染與廢棄物；土地＋水（2026-11-07 拆開後疊在同一欄）；碳與氣候政策＋環境治理
    columns: [1, 1, 2, 2],
  },
  {
    id: 'tech',
    label: { zh: '科技', en: 'Tech' },
    // 2026-10-30（第十一批 187）「能源」分類併進科技的右欄；第十批的晶圓廠地圖、Starlink、研發投入最多的公司、大型科學設施、
    // 電價與油價、能源政策、核廢料做好時照手冊的表放進對應的欄
    // 2026-11-07（第二十五批 439）：能源升成自己的大類；「研發與太空」拆出太空（太空、Starlink），原小類改名「研發與創新」
    sections: [
      // 2026-11-07（製作手冊第二十五批 502）「數位」拆成「網路與連線」與「運算與晶片」
      { label: { zh: '運算與晶片', en: 'Computing & chips' }, topics: ['ai', 'semiconductors', 'wafer-fabs', 'developers', 'chip-materials'] },
      { label: { zh: '研發與創新', en: 'Research & innovation' }, topics: ['innovation', 'rd-companies', 'publications', 'science-facilities', 'research-orgs', 'eu-research', 'oa-journals', 'scientist-mobility'] },
      { label: { zh: '太空', en: 'Space' }, topics: ['space', 'starlink'] },
      // 2026-11-08 使用者要求：網路與連線從 9 個主題併成 4 個（網速、基地台併進網路普及；IP 位址、國家網域併進海底電纜；
      // 數位貿易併進上網用什麼），放到太空下面。併進來的主題 id 由 redirects.ts 轉到新的位置
      { label: { zh: '網路與連線', en: 'Internet & connectivity' }, topics: ['digital', 'submarine-cables', 'web-platforms', 'internet-freedom'] },
    ],
    // 左：運算與晶片；中：研發與創新；右：太空、網路與連線
    columns: [1, 1, 2],
  },
  {
    // 2026-11-07（製作手冊第二十五批 439，使用者 2026-11-05 核准）：能源從科技分出來成為大類。手冊的五個小類裡核能只有一個主題，
    // 先跟電力併在一起（補到兩個再分開）；「能源的使用與政策」等第一個主題（523–528）做好時再加
    id: 'energy',
    label: { zh: '能源', en: 'Energy' },
    sections: [
      { label: { zh: '電力', en: 'Electricity' }, topics: ['electricity', 'power-plants', 'energy-prices', 'hvdc', 'power-reliability', 'district-heating'] },
      // 2026-11-07（第二十七批 622）：核電機組做好，核能有兩個主題，從電力獨立出來（核融合 719 做好時加進來）
      { label: { zh: '核能', en: 'Nuclear' }, topics: ['nuclear', 'nuclear-reactors'] },
      { label: { zh: '化石燃料', en: 'Fossil fuels' }, topics: ['fossil-fuels', 'fossil-infrastructure'] },
      { label: { zh: '再生能源', en: 'Renewables' }, topics: ['renewables', 'renewable-heat', 'biofuels-hydrogen'] },
      // 2026-11-07（第二十五批 523）：第一個主題「各部門的最終能源消費」做好，開這個小類
      { label: { zh: '能源的使用與政策', en: 'Energy use & policy' }, topics: ['energy-use', 'household-energy', 'energy-poverty', 'energy-market', 'energy-taxes', 'energy-jobs'] },
    ],
    // 左：電力、核能；中：化石燃料、再生能源；右：能源的使用與政策
    columns: [2, 2, 1],
  },
  {
    id: 'transport',
    label: { zh: '交通', en: 'Transport' },
    // 2026-10-30（第十一批 186）交通拆成鐵路（id 照舊 transport）、高鐵、地鐵與城市軌道，航空拆成機場與旅客（id 照舊 aviation）、
    // 航線與航空公司，交通安全拆出汽機車，電動車從能源搬過來；187 排成三欄（使用者要水運放中欄）
    sections: [
      { label: { zh: '鐵道', en: 'Rail' }, topics: ['transport', 'high-speed-rail', 'metro', 'heritage-railways'] },
      { label: { zh: '航空', en: 'Air' }, topics: ['aviation', 'air-routes', 'airspace'] },
      // 2026-11-08 使用者要求：水運放到航空下面（同一欄）
      { label: { zh: '水運', en: 'Sea' }, topics: ['shipping', 'logbooks'] },
      { label: { zh: '道路', en: 'Road' }, topics: ['road-safety', 'ev', 'bus-stations', 'cabotage', 'ride-hailing'] },
      // 2026-11-07（第二十七批 585）：交通基礎建設投資、家庭交通支出、運輸業就業三個新主題，加上從電價與油價搬來的燃料稅、
      // 從城市搬來的低排放區與塞車費
      {
        label: { zh: '交通政策與投資', en: 'Policy and investment' },
        topics: ['transport-investment', 'household-transport', 'transport-jobs', 'fuel-tax', 'city-traffic'],
      },
    ],
    // 鐵道｜航空、水運｜道路｜交通政策與投資（2026-11-08 使用者要求水運放到航空下面；之前每個小類各占一欄）
    columns: [1, 2, 1, 1],
  },
  {
    id: 'geo',
    label: { zh: '地理', en: 'Geography' },
    sections: [
      // 旅行實用 2026-11-07 搬到旅遊（製作手冊第二十七批 536）
      { label: { zh: '國家', en: 'Countries' }, topics: ['profiles', 'flags', 'language', 'taipei-view'] },
      // 2026-11-07 製作手冊第二十七批 535：原本的「地形與地質」（9 個主題）拆成地形、地質與地震、水與冰三個小類，主題 id 都沒改。
      // 「水與冰」不是使用者 2026-11-05 否決的「海洋」小類：主軸是河川與內陸水域，海洋與漁業仍留在地理類，南極是因為冰才放這裡
      { label: { zh: '地形', en: 'Landforms' }, topics: ['elevation', 'special-landforms', 'mountain-passes', 'reclamation'] },
      { label: { zh: '地質與地震', en: 'Geology & earthquakes' }, topics: ['lithology', 'plates', 'earthquakes', 'gssp'] },
      { label: { zh: '水與冰', en: 'Water & ice' }, topics: ['rivers', 'wetlands', 'oceans', 'antarctica'] },
      { label: { zh: '天空', en: 'Sky' }, topics: ['daylight', 'eclipses', 'aurora', 'magnetic', 'antipodes'] },
    ],
    // 國家、地形｜地質與地震｜水與冰｜天空（2026-11-08 使用者要求：地形放到最左欄國家下面，天空自己一欄排第四；
    // 2026-11-03 天空從左欄搬到右欄，原本右欄的景點搬到「休閒」）
    columns: [2, 1, 1, 1],
  },
  {
    // 2026-11-07 製作手冊第二十七批 536：休閒（24 個主題、只有 3 個小類）拆成旅遊與休閒兩類，旅遊排在地理與休閒之間。
    // 景點整組搬過來；觀光從國際・往來、旅行實用從地理・國家、旅遊警示從國際・安全、護照與簽證從國際・往來、
    // 鈔票從休閒・日常休閒搬過來（主題 id 都沒改）。樂園小類在順序 637 開（2026-11-08）
    id: 'trips',
    label: { zh: '旅遊', en: 'Travel' },
    sections: [
      // 地下觀光 2026-11-07 從社會的「生活與文化」搬過來（製作手冊第二十六批 534），跟景點地圖一組
      { label: { zh: '景點', en: 'Places to see' }, topics: ['world-heritage', 'castles', 'national-parks', 'trails', 'attractions', 'museums', 'show-caves', 'oldest-universities', 'skyscrapers'] },
      // 2026-11-08 製作手冊第二十七批 637：樂園小類（使用者 2026-11-07 核准），四個樂園主題從景點搬過來，主題 id 不變
      // 2026-11-08 第二十八批 673：迪士尼（使用者決定等樂園小類建好再上線，放樂園）
      { label: { zh: '樂園', en: 'Theme parks' }, topics: ['theme-parks', 'amusement-industry', 'roller-coasters', 'water-parks', 'disney', 'universal'] },
      // 2026-11-08 第二十七批 670、671：旅館、民宿與旅行社（新主題）
      { label: { zh: '觀光', en: 'Tourism' }, topics: ['tourism', 'travel-habits', 'lodging'] },
      // 鈔票：使用者 2026-11-07 指定放這裡（跟插頭、電壓、紙張大小同一類「出國會遇到的東西」）
      { label: { zh: '旅行實用', en: 'Travel basics' }, topics: ['travel', 'travel-advisories', 'passport', 'banknotes'] },
    ],
    // 左：景點；中：樂園；右：觀光、旅行實用
    columns: [1, 1, 2],
  },
  {
    // 2026-11-03 使用者要求：地理的「景點」與社會的「獎項與運動」獨立成一類（景點原本的夜間燈光搬到社會的人口與家庭）；
    // 2026-11-07 景點、觀光、旅行實用拆到旅遊（製作手冊第二十七批 536），id、名稱、顏色、圖示不變
    id: 'leisure',
    label: { zh: '休閒', en: 'Leisure' },
    sections: [
      { label: { zh: '獎項與運動', en: 'Prizes & sports' }, topics: ['nobel', 'sports', 'racing', 'horses'] },
      // 2026-11-08 使用者要求：假期與時間放到第一欄獎項與運動的下面
      { label: { zh: '假期與時間', en: 'Holidays & time' }, topics: ['holidays', 'time-use'] },
      // 2026-11-08 製作手冊第二十七批 652 開「遊戲與動漫」小類，653 把電競搬進來，654–655 加動畫、漫畫
      // （656 電視劇同一天依使用者要求搬到影音與文化）；同一天使用者要求拆成遊戲、動漫兩個小類
      { label: { zh: '遊戲', en: 'Games' }, topics: ['esports', 'game-companies'] },
      { label: { zh: '動漫', en: 'Anime & comics' }, topics: ['anime', 'comics'] },
      // 2026-11-04 製作手冊第二十一批（休閒的追加主題；社會已經有「生活與文化」，這裡叫日常休閒）。
      // 2026-11-07 從社會的「生活與文化」搬過來的菜系走到哪裡、原產地名稱接在外食後面（製作手冊第二十六批 534）；
      // 同一天第二十七批 536：狩獵與釣魚併進休閒運動場地（diving）、旅遊習慣搬到旅遊・觀光、鈔票搬到旅遊・旅行實用
      // 2026-11-08 第二十七批 664：唱片公司與錄音室接在上網看影片後面
      // 2026-11-08 使用者要求：日常休閒（10 個主題）拆成影音與文化、飲食、休閒場所、假期與時間四個小類，主題 id 都沒改；
      // 電視劇從遊戲與動漫搬到影音與文化
      { label: { zh: '影音與文化', en: 'Media & culture' }, topics: ['online-video', 'tv-series', 'record-labels', 'culture'] },
      { label: { zh: '飲食', en: 'Food & drink' }, topics: ['dining', 'cuisines', 'origin-names'] },
      { label: { zh: '休閒場所', en: 'Leisure venues' }, topics: ['diving', 'gambling'] },
    ],
    // 獎項與運動、假期與時間｜遊戲、動漫｜影音與文化｜飲食、休閒場所（2026-11-08 使用者要求排成四欄，
    // 再要假期與時間放到第一欄、遊戲與動漫拆成兩個小類）
    columns: [2, 2, 1, 2],
  },
];

/** 分類裡的所有主題（依小標題的順序） */
export const groupTopics = (g: TopicGroupSpec): string[] => g.sections.flatMap((s) => s.topics);

/**
 * 每個主題的定義各自一個 chunk，換到那個主題才下載（全部放在首頁的程式裡約 220 KB，gzip 後）。
 * 人口（預設主題）與純地圖直接放在首頁（index.ts），不在這裡
 */
export const TOPIC_MODULES: Record<string, () => Promise<Record<string, unknown>>> = {
  fertility: () => import('./fertility'),
  holidays: () => import('./holidays'),
  dining: () => import('./dining'),
  culture: () => import('./culture'),
  esports: () => import('./esports'),
  horses: () => import('./horses'),
  'origin-names': () => import('./origin-names'),
  cuisines: () => import('./cuisines'),
  'show-caves': () => import('./show-caves'),
  gssp: () => import('./gssp'),
  'mountain-passes': () => import('./mountain-passes'),
  wetlands: () => import('./wetlands'),
  diving: () => import('./diving'),
  gambling: () => import('./gambling'),
  funeral: () => import('./funeral'),
  independence: () => import('./independence'),
  cabotage: () => import('./cabotage'),
  'web-platforms': () => import('./web-platforms'),
  'internet-freedom': () => import('./internet-freedom'),
  'chip-materials': () => import('./chip-materials'),
  'research-orgs': () => import('./research-orgs'),
  'eu-research': () => import('./eu-research'),
  'oa-journals': () => import('./oa-journals'),
  'scientist-mobility': () => import('./scientist-mobility'),
  hvdc: () => import('./hvdc'),
  'power-reliability': () => import('./power-reliability'),
  'district-heating': () => import('./district-heating'),
  'transport-investment': () => import('./transport-investment'),
  'household-transport': () => import('./household-transport'),
  'transport-jobs': () => import('./transport-jobs'),
  'fuel-tax': () => import('./fuel-tax'),
  'city-traffic': () => import('./cities-traffic'),
  'bus-stations': () => import('./bus-stations'),
  'time-use': () => import('./time-use'),
  marriage: () => import('./marriage'),
  cities: () => import('./cities'),
  health: () => import('./health'),
  disease: () => import('./disease'),
  vaccination: () => import('./vaccination'),
  height: () => import('./height'),
  'blood-types': () => import('./blood-types'),
  'newborn-screening': () => import('./newborn-screening'),
  'red-cell-traits': () => import('./red-cell-traits'),
  lactase: () => import('./lactase'),
  'drug-genes': () => import('./drug-genes'),
  medicines: () => import('./medicines'),
  'drug-consumption': () => import('./drug-consumption'),
  'taiwan-medicines': () => import('./taiwan-medicines'),
  'alt-medicine': () => import('./alt-medicine'),
  'taiwan-tcm': () => import('./taiwan-tcm'),
  'tcm-systems': () => import('./tcm-systems'),
  'tcm-herbs': () => import('./tcm-herbs'),
  'tcm-research': () => import('./tcm-research'),
  'antimicrobial-resistance': () => import('./antimicrobial-resistance'),
  'tobacco-alcohol': () => import('./tobacco-alcohol'),
  education: () => import('./education'),
  pisa: () => import('./pisa'),
  diet: () => import('./diet'),
  // 2026-11-05 第二十二批 397（加上候選 681）：鈔票上是誰、最大面額
  banknotes: () => import('./banknotes'),
  // 2026-11-05 第二十二批 398：大型哺乳類還剩下幾種（PHYLACINE）
  megafauna: () => import('./megafauna'),
  housing: () => import('./housing'),
  religion: () => import('./religion'),
  inequality: () => import('./inequality'),
  gender: () => import('./gender'),
  crime: () => import('./crime'),
  laws: () => import('./laws'),
  happiness: () => import('./happiness'),
  nobel: () => import('./nobel'),
  sports: () => import('./sports'),
  racing: () => import('./racing'),
  income: () => import('./income'),
  wages: () => import('./wages'),
  employment: () => import('./employment'),
  wealth: () => import('./wealth'),
  fiscal: () => import('./fiscal'),
  taxes: () => import('./taxes'),
  redistribution: () => import('./redistribution'),
  'social-protection': () => import('./social-protection'),
  'labour-rights': () => import('./labour-rights'),
  reserves: () => import('./reserves'),
  'stock-market': () => import('./stock-market'),
  insurance: () => import('./insurance'),
  banking: () => import('./banking'),
  'business-demography': () => import('./business-demography'),
  'market-regulation': () => import('./market-regulation'),
  'real-estate': () => import('./real-estate'),
  'housing-market': () => import('./housing-market'),
  'property-costs': () => import('./property-costs'),
  retail: () => import('./retail'),
  'climate-action': () => import('./climate-action'),
  'climate-finance': () => import('./climate-finance'),
  cbam: () => import('./cbam'),
  nutrients: () => import('./nutrients'),
  noise: () => import('./noise'),
  'light-pollution': () => import('./light-pollution'),
  'industrial-releases': () => import('./industrial-releases'),
  'contaminated-sites': () => import('./contaminated-sites'),
  materials: () => import('./materials'),
  'land-use': () => import('./land-use'),
  'env-taxes': () => import('./env-taxes'),
  'energy-use': () => import('./energy-use'),
  'energy-jobs': () => import('./energy-jobs'),
  'household-energy': () => import('./household-energy'),
  'energy-poverty': () => import('./energy-poverty'),
  'energy-market': () => import('./energy-market'),
  'energy-taxes': () => import('./energy-taxes'),
  industry: () => import('./industry'),
  agriculture: () => import('./agriculture'),
  minerals: () => import('./minerals'),
  'chain-stores': () => import('./chain-stores'),
  trade: () => import('./trade'),
  migration: () => import('./migration'),
  aid: () => import('./aid'),
  'china-lending': () => import('./china-lending'),
  tourism: () => import('./tourism'),
  passport: () => import('./passport'),
  // 2026-11-06 第二十四批 420：美國、加拿大與台灣的旅遊警示
  'travel-advisories': () => import('./travel-advisories'),
  military: () => import('./military'),
  conflict: () => import('./conflict'),
  news: () => import('./news'),
  democracy: () => import('./democracy'),
  governance: () => import('./governance'),
  organizations: () => import('./organizations'),
  'un-votes': () => import('./un-votes'),
  'taiwan-diplomacy': () => import('./diplomacy'),
  electricity: () => import('./electricity'),
  'power-plants': () => import('./power-plants'),
  'fossil-fuels': () => import('./fossil-fuels'),
  'fossil-infrastructure': () => import('./fossil-infrastructure'),
  nuclear: () => import('./nuclear'),
  'nuclear-reactors': () => import('./nuclear-reactors'),
  'health-spending': () => import('./health-spending'),
  'health-care': () => import('./health-care'),
  covid: () => import('./covid'),
  prices: () => import('./prices'),
  'travel-habits': () => import('./travel-habits'),
  forest: () => import('./forest'),
  'energy-prices': () => import('./energy-prices'),
  'science-facilities': () => import('./science-facilities'),
  starlink: () => import('./starlink'),
  'wafer-fabs': () => import('./wafer-fabs'),
  'rd-companies': () => import('./rd-companies'),
  renewables: () => import('./renewables'),
  'renewable-heat': () => import('./renewable-heat'),
  'biofuels-hydrogen': () => import('./biofuels-hydrogen'),
  climate: () => import('./climate'),
  temperature: () => import('./temperature'),
  'air-quality': () => import('./air-quality'),
  'water-forest': () => import('./water-forest'),
  plastic: () => import('./plastic'),
  ev: () => import('./ev'),
  ai: () => import('./ai'),
  semiconductors: () => import('./semiconductors'),
  digital: () => import('./digital'),
  developers: () => import('./developers'),
  innovation: () => import('./innovation'),
  publications: () => import('./publications'),
  'submarine-cables': () => import('./submarine-cables'),
  space: () => import('./space'),
  transport: () => import('./transport'),
  shipping: () => import('./shipping'),
  'road-safety': () => import('./road-safety'),
  'high-speed-rail': () => import('./high-speed-rail'),
  metro: () => import('./metro'),
  'air-routes': () => import('./air-routes'),
  profiles: () => import('./profiles'),
  flags: () => import('./flags'),
  language: () => import('./language'),
  elevation: () => import('./elevation'),
  rivers: () => import('./rivers'),
  oceans: () => import('./oceans'),
  daylight: () => import('./daylight'),
  eclipses: () => import('./eclipses'),
  antipodes: () => import('./antipodes'),
  attractions: () => import('./attractions'),
  'theme-parks': () => import('./theme-parks'),
  disney: () => import('./disney'),
  universal: () => import('./universal'),
  'amusement-industry': () => import('./amusement-industry'),
  'roller-coasters': () => import('./roller-coasters'),
  'game-companies': () => import('./game-companies'),
  'record-labels': () => import('./record-labels'),
  lodging: () => import('./lodging'),
  'online-video': () => import('./online-video'),
  anime: () => import('./anime'),
  comics: () => import('./comics'),
  'tv-series': () => import('./tv-series'),
  'water-parks': () => import('./water-parks'),
  museums: () => import('./museums'),
  'oldest-universities': () => import('./oldest-universities'),
  antarctica: () => import('./antarctica'),
  'national-parks': () => import('./national-parks'),
  trails: () => import('./trails'),
  festivals: () => import('./festivals'),
  companies: () => import('./companies'),
  aviation: () => import('./aviation'),
  'ride-hailing': () => import('./ride-hailing'),
  'heritage-railways': () => import('./heritage-railways'),
  airspace: () => import('./airspace'),
  'taipei-view': () => import('./taipei-view'),
  magnetic: () => import('./magnetic'),
  aurora: () => import('./aurora'),
  logbooks: () => import('./logbooks'),
  koppen: () => import('./koppen'),
  ice: () => import('./ice'),
  reads: () => import('./reads'),
  empires: () => import('./empires'),
  plates: () => import('./plates'),
  lithology: () => import('./lithology'),
  'special-landforms': () => import('./special-landforms'),
  reclamation: () => import('./reclamation'),
  wind: () => import('./wind'),
  earthquakes: () => import('./earthquakes'),
  typhoons: () => import('./typhoons'),
  wildfires: () => import('./wildfires'),
  'night-lights': () => import('./night-lights'),
  'world-heritage': () => import('./world-heritage'),
  castles: () => import('./castles'),
  skyscrapers: () => import('./skyscrapers'),
  travel: () => import('./travel'),
  'ozone-hole': () => import('./ozone-hole'),
};

/**
 * 模組裡的主題定義（每個主題檔 export 一個 TopicDefinition）。同一個檔可能還有同一個 id 的疊加圖層
 * （城市的 CITY_LAYER 也叫 cities），所以要有主題才有的欄位
 */
export function topicOf(module: Record<string, unknown>, id: string): TopicDefinition {
  for (const value of Object.values(module)) {
    const topic = value as Partial<TopicDefinition> | null;
    if (topic && typeof topic === 'object' && topic.id === id && topic.title && topic.defaultIndicator && Array.isArray(topic.indicators)) {
      return topic as TopicDefinition;
    }
  }
  throw new Error(`topic ${id} not found in its module`);
}
