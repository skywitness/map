import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';
import { withParts } from './parts';
import { hostOnly, topicPart } from './merge';
import { boxOfficeTw } from './box-office-tw';

/**
 * 文化：電影院、出版、文化工作者、遺產保存的公共支出（2026-11-04，製作手冊第二十一批 371、372、374、375；pipeline/topics/culture.py）：
 * UNESCO 統計研究所（UIS）的公開 API，年份零散（資料檔設 latestWithin）。台灣不在 UIS 裡，電影院用文化部的統計（2008–2025 年）。
 * 出版（372）是 WIPO 出版業報告的法定送存表（2022 年，CC BY 4.0），台灣用國家圖書館 ISBN 中心的新書 ISBN 數補（2024、2025 年）。
 */

const UIS = {
  name: { zh: 'UNESCO 統計研究所（UIS）資料庫', en: 'UNESCO Institute for Statistics (UIS) database' },
  url: 'https://databrowser.uis.unesco.org/',
  license: 'CC BY-SA 4.0',
};

const eur = (v: number) => tr({ zh: v >= 100 ? `${fixed(v / 100, 1)} 億歐元` : `${fixed(v * 100, 0)} 萬歐元`, en: `€${fixed(v, 1)} million` });

// 2026-11-08（製作手冊第二十七批 661，候選 1447）：電影院的點圖層（OSM amenity=cinema；台灣換成文化部 2025 年的 107 家，有廳數）
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const cinemaName = (p: PointRecord) =>
  (getLang() === 'zh' ? (str(p.nz) ?? str(p.n) ?? str(p.ne)) : (str(p.ne) ?? str(p.n))) ?? tr({ zh: '（沒有名稱）', en: '(unnamed)' });
const cinemaProper = (p: PointRecord) => (getLang() === 'en' && !str(p.ne) && str(p.n) ? String(p.n) : undefined);
const CINEMA_SRC: Text[] = [
  { zh: 'OpenStreetMap', en: 'OpenStreetMap' },
  { zh: '文化部影視局（2025 年）', en: 'Ministry of Culture (2025)' },
];
const WHERE: Text[] = [
  { zh: '', en: '' },
  { zh: '位置是鄉鎮市區的代表點', en: 'Placed at the township centre' },
  { zh: '位置只知道縣市', en: 'Placed at the county centre' },
];
const cinemaLines = (p: PointRecord) =>
  [
    typeof p.s === 'number' ? tr({ zh: `${p.s} 廳`, en: `${p.s} ${p.s === 1 ? 'screen' : 'screens'}` }) : null,
    str(p.t),
    Number(p.a) ? tr(WHERE[Number(p.a)]) : null,
    tr(CINEMA_SRC[(Number(p.k) || 1) - 1]),
  ].filter(Boolean) as string[];
const CINEMAS: PointsOverlayDef = {
  kind: 'points',
  id: 'cinema-points',
  file: 'cinema-points.json',
  label: { zh: '電影院（OSM；台灣用文化部的名單）', en: 'Cinemas (OSM; Taiwan from the Ministry of Culture list)' },
  indicators: ['cinemas-osm-per', 'cinemas-osm'],
  radius: 2.5,
  color: {
    field: 'k',
    title: { zh: '來源', en: 'Source' },
    thresholds: [1.5],
    classes: CINEMA_SRC.map((label, i) => ({ color: [MAP_TOKENS.categorical[5], MAP_TOKENS.categorical[1]][i], label })),
  },
  sortField: 's',
  tooltip: (p, { countryName }) => ({
    title: cinemaName(p),
    detail: typeof p.iso3 === 'string' ? countryName(p.iso3) : '',
    extra: cinemaLines(p),
    properNoun: cinemaProper(p),
  }),
};
const CINEMA_LIST: ListPanelDef = {
  label: { zh: '這一國的電影院', en: 'Cinemas here' },
  tabLabel: { zh: '電影院', en: 'Cinemas' },
  indicators: ['cinemas-osm-per', 'cinemas-osm'],
  file: 'cinema-points.json',
  countryField: 'iso3',
  empty: { zh: 'OpenStreetMap 上這裡沒有標成電影院的地方', en: 'No places tagged as cinemas here in OpenStreetMap' },
  rows: (points) =>
    [...points]
      .sort((a, b) => (Number(b.s) || 0) - (Number(a.s) || 0) || cinemaName(a).localeCompare(cinemaName(b)))
      .map((p, i): ListRow => ({
        key: `cin-${i}`,
        title: cinemaName(p),
        properNoun: cinemaProper(p),
        lines: [cinemaLines(p).join(' · ')],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
      })),
};

// 2026-11-08（製作手冊第二十七批 667，候選 1461）：表演場館的類型（OSM theatre:genre，pipeline/topics/ent_venues.py）
const GENRES: CategoryDef[] = [
  { value: 1, label: { zh: '古典音樂（交響樂、室內樂）', en: 'Classical music (orchestral, chamber)' } },
  { value: 2, label: { zh: '歌劇與芭蕾', en: 'Opera and ballet' } },
  { value: 3, label: { zh: '話劇', en: 'Drama' } },
  { value: 4, label: { zh: '音樂劇', en: 'Musicals' } },
  { value: 5, label: { zh: '喜劇、綜藝與歌舞秀', en: 'Comedy, variety and cabaret' } },
  { value: 6, label: { zh: '馬戲', en: 'Circus' } },
  { value: 7, label: { zh: '偶戲', en: 'Puppetry' } },
  { value: 8, label: { zh: '能、歌舞伎等東亞傳統戲劇', en: 'Noh, kabuki and other East Asian traditional theatre' } },
];
const GENRE_OTHER: CategoryDef = { value: 9, label: { zh: '其他', en: 'Other' } };
const genreText = (k: unknown) => tr([...GENRES, GENRE_OTHER].find((c) => c.value === k)?.label ?? GENRE_OTHER.label);
const THEATRE_GENRES: PointsOverlayDef = {
  kind: 'points',
  id: 'theatre-genres',
  file: 'theatre-genre-points.json',
  label: { zh: '標了類型的表演場館（OSM）', en: 'Venues with a genre (OSM)' },
  indicators: ['theatre-genre'],
  radius: 3,
  color: {
    field: 'k',
    title: { zh: '類型', en: 'Genre' },
    thresholds: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5],
    classes: [...GENRES.map((c, i) => ({ color: MAP_TOKENS.categorical[i], label: c.label })), { color: MAP_TOKENS.categoricalOther, label: GENRE_OTHER.label }],
  },
  sortField: 'k',
  tooltip: (p, { countryName }) => ({
    title: cinemaName(p),
    detail: [genreText(p.k), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    extra: str(p.g) ? [`theatre:genre = ${p.g}`] : [],
    properNoun: cinemaProper(p),
  }),
};

const cultureOwn: TopicDefinition = {
  id: 'culture',
  title: { zh: '文化：電影院、出版、文化工作者與遺產保存', en: 'Culture: cinemas, books, cultural jobs and heritage' },
  shortTitle: { zh: '文化', en: 'Culture' },
  defaultIndicator: 'cinemas-per-100k',
  defaultYear: 2017,
  // 2026-11-07（製作手冊 556）：政府的文化、廣播與出版支出的側欄（COFOG 08 的分項長條）
  panelExtra: () => import('./panels/Cofog08Panel'),
  overlays: [CINEMAS, THEATRE_GENRES],
  listPanel: [CINEMA_LIST],
  sources: [
    UIS,
    { name: { zh: 'OpenStreetMap（amenity=theatre、arts_centre、cinema 與 theatre:genre，經 QLever 查詢）', en: 'OpenStreetMap (amenity=theatre, arts_centre and cinema, and theatre:genre, via QLever)' }, url: 'https://www.openstreetmap.org/copyright', license: 'ODbL 1.0' },
    {
      name: { zh: '文化部：文創產業家數與營業額統計資訊（data.gov.tw 103019，2008–2023 年）', en: 'Ministry of Culture (Taiwan): creative industry establishments and turnover (data.gov.tw 103019, 2008–2023)' },
      url: 'https://data.gov.tw/dataset/103019',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: '文化部文化統計網：文化參與率（電影、表演藝術，2013–2024 年）', en: 'Ministry of Culture (Taiwan) cultural statistics: participation rates (film and performing arts, 2013–2024)' },
      url: 'https://stat.moc.gov.tw/',
      license: { zh: '文化部網站著作權聲明（以文化部名義發表的著作，合理範圍內可重製、公開傳輸，需註明出處）；只用最近一年的參與率', en: 'Ministry of Culture website copyright notice (its own works may be reproduced within reasonable limits with attribution); only the latest participation rates are used' },
    },
    {
      name: { zh: '文化部影視及流行音樂產業局：全國電影院資料（data.gov.tw 22213，2025 年）', en: 'Ministry of Culture Bureau of Audiovisual and Music Industry Development: cinemas in Taiwan (data.gov.tw 22213, 2025)' },
      url: 'https://data.gov.tw/dataset/22213',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: 'Eurostat：一般政府依職能分類的支出（gov_10a_exp，COFOG 08）與 GDP（nama_10_gdp）', en: 'Eurostat: general government expenditure by function (gov_10a_exp, COFOG 08) and GDP (nama_10_gdp)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/gov_10a_exp/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'WIPO《The Global Publishing Industry in 2022》表 3（法定送存）', en: 'WIPO, The Global Publishing Industry in 2022, table 3 (legal deposits)' },
      url: 'https://www.wipo.int/edocs/pubdocs/en/wipo-pub-1064-2023-2-en-the-global-publishing-industry-in-2022.pdf',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '國家圖書館 ISBN 中心：臺灣出版新書預告書訊（政府資料開放平臺 6730）', en: 'National Central Library ISBN Center: forthcoming new books in Taiwan (data.gov.tw 6730)' },
      url: 'https://data.gov.tw/dataset/6730',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: '文化部文化統計網：電影院概況（2008–2024 年）與電影片映演業統計（2026 年 5 月，2025 年的家數）', en: 'Ministry of Culture (Taiwan) cultural statistics: cinemas, 2008–2024, and film exhibition statistics (May 2026, for 2025)' },
      url: 'https://stat.moc.gov.tw/HS_UserCatalogView.aspx',
      license: { zh: '文化部網站著作權聲明（以文化部名義發表的著作，合理範圍內可重製、公開傳輸，需註明出處）；只用逐年的家數', en: 'Ministry of Culture website copyright notice (its own works may be reproduced within reasonable limits with attribution); only annual counts are used' },
    },
    {
      name: { zh: 'Eurostat：文化部門企業（cult_ent_val）、文化就業（cult_emp_art）、EU-SILC 文化參與（ilc_scp03）', en: 'Eurostat: cultural enterprises (cult_ent_val), cultural employment (cult_emp_art) and EU-SILC cultural participation (ilc_scp03)' },
      url: 'https://ec.europa.eu/eurostat/web/culture/database',
      license: 'CC BY 4.0',
    },
    { name: { zh: 'UN World Population Prospects 2024（人口）', en: 'UN World Population Prospects 2024 (population)' }, url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
  ],
  note: {
    zh: '都是 UNESCO 統計研究所的資料（CC BY-SA 4.0，資料檔同樣授權），各國回報的年份差很多：電影院到 2017 年（之後 UIS 沒有再收；台灣用文化部的統計，到 2025 年），文化工作者 2010–2016 年，遺產保存支出 2017–2024 年；某一年沒有資料時用前幾年最近的值（滑過國家看年份）。出版是世界智慧財產權組織（WIPO）出版業報告裡各國國家圖書館（法定送存機構）2022 年收到的書（CC BY 4.0），有沒有強制送存電子書差很多，只能看大概；中國、義大利不在表裡；這是改作過的內容，WIPO 秘書處不對改作或翻譯負任何責任。台灣用國家圖書館 ISBN 中心一年登記的新書 ISBN 數（2024、2025 年），不是送存件數。電影院是「室內電影院」的家數，一家影城算一家、不是銀幕數。文化工作者是文化職業（藝術家、設計師、圖書館員、手工藝師等）占全部就業的比例，各國的職業分類細度不同、低所得國家的數字可能偏高。遺產保存支出是政府花在文化與自然遺產（博物館、古蹟、自然保護區等）的錢，每人、購買力平價美元。台灣不在 UNESCO 的資料裡。',
    en: 'All from the UNESCO Institute for Statistics (CC BY-SA 4.0; data files are shared under the same licence). Reporting years vary a lot: cinemas up to 2017 (UIS stopped collecting them; Taiwan uses Ministry of Culture figures to 2025), cultural employment 2010–2016 and heritage spending 2017–2024; where a year is missing, the most recent earlier value is used (hover for the year). Books are those received in 2022 by national libraries (legal deposit repositories), from the World Intellectual Property Organization’s publishing report (CC BY 4.0); whether e-books must be deposited varies a lot, so treat comparisons as approximate; China and Italy are not in the table. This is an adaptation: the Secretariat of WIPO assumes no liability or responsibility with regard to the transformation or translation of the original content. Taiwan’s figure is new-book ISBNs registered with the National Central Library in 2024 and 2025, not deposits. Cinemas are indoor cinema venues, each multiplex counting once, not screens. Cultural employment is the share of jobs in cultural occupations (artists, designers, librarians, craftspeople and so on); occupational detail differs by country, and figures for low-income countries may be high. Heritage spending is government spending on cultural and natural heritage (museums, monuments, nature reserves and so on), per person in PPP dollars. Taiwan is not in the UNESCO data.',
  },
  indicators: [
    // 2026-11-08（製作手冊第二十七批 661，候選 1447）電影院（OSM 現況；UNESCO 的電影院數只到 2017 年）
    {
      id: 'cinemas-osm-per',
      label: { zh: '每十萬人有幾家電影院（OSM）', en: 'Cinemas per 100,000 people (OSM)' },
      description: {
        zh: 'OpenStreetMap 上標成電影院（amenity=cinema）的地方 ÷ 2024 年人口，只替 OSM 覆蓋良好的 93 國上色。冰島每十萬人 4.58 家最多，捷克 3.83、法國 3.22、瑞士 3.04、希臘 2.96、挪威 2.85；義大利 2.46、德國 1.72、美國 1.59、英國 1.20、南韓 1.09、台灣 0.56、日本 0.42。一家影城算一家、不管有幾廳，所以多廳影城多的國家（日本、南韓、台灣）會偏低；密度也在量 OSM 畫得多完整。點圖層的台灣換成文化部 2025 年的 107 家電影院（932 廳）。',
        en: 'Places tagged as cinemas (amenity=cinema) in OpenStreetMap divided by 2024 population, shown only for the 93 countries well covered by OSM. Iceland has the most per 100,000 people (4.58), followed by Czechia (3.83), France (3.22), Switzerland (3.04), Greece (2.96) and Norway (2.85); Italy has 2.46, Germany 1.72, the US 1.59, the UK 1.20, South Korea 1.09, Taiwan 0.56 and Japan 0.42. Each multiplex counts once however many screens it has, so countries with many multiplexes (Japan, South Korea, Taiwan) come out low, and densities also reflect how completely OSM is mapped. On the point layer, Taiwan uses the Ministry of Culture’s 2025 list of 107 cinemas (932 screens).',
      },
      unit: { zh: '家／十萬人', en: 'per 100,000' },
      file: 'cinemas-osm-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.25, 0.5, 1, 1.5, 2, 3] } },
      timeless: true,
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, 2)} 家`, en: `${fixed(v, 2)} per 100,000` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'cinemas-osm',
      label: { zh: '電影院家數（OSM）', en: 'Cinemas (OSM)' },
      description: {
        zh: 'OpenStreetMap 上標成電影院的地方：31,657 處、197 國。美國 5,489 處最多，印度 2,209、法國 2,144、俄羅斯 1,965、義大利 1,459、德國 1,458、中國 1,378、英國 832；台灣 131 處（文化部 2025 年的名單是 107 家、932 廳）。印度多半是單廳戲院，跟美國的多廳影城不能直接比；OSM 標了廳數（screen）的只有兩成多。',
        en: 'Places tagged as cinemas in OpenStreetMap: 31,657 in 197 countries. The US has the most (5,489), followed by India (2,209), France (2,144), Russia (1,965), Italy (1,459), Germany (1,458), China (1,378) and the UK (832); Taiwan has 131 (the Ministry of Culture’s 2025 list has 107 cinemas with 932 screens). India’s are mostly single-screen cinemas, not comparable with US multiplexes; only about a fifth of OSM cinemas are tagged with a screen count.',
      },
      unit: { zh: '家', en: 'cinemas' },
      file: 'cinemas-osm.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 5000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
    },
    // 2026-11-08（製作手冊第二十七批 641）劇院與藝文中心（OSM）
    {
      id: 'theatres-per',
      label: { zh: '每十萬人有幾家劇院（OSM）', en: 'Theatres per 100,000 people (OSM)' },
      description: { zh: 'OpenStreetMap 上標成劇院（amenity=theatre）的家數 ÷ 2024 年人口，只替 OSM 覆蓋良好的 93 國上色。拉脫維亞每十萬人 8.4 家最多，希臘 7.7、賽普勒斯 7.3、芬蘭 7.3；法國 5.2、德國 3.7、美國 3.2、英國 2.3、南韓 2.0、日本 1.1、台灣 0.7。劇院包括小劇場與社區劇場，密度也在量 OSM 畫得多完整。', en: 'Places tagged as theatres (amenity=theatre) in OpenStreetMap divided by 2024 population, shown only for the 93 countries well covered by OSM. Latvia has the most per 100,000 people (8.4), followed by Greece (7.7), Cyprus (7.3) and Finland (7.3); France has 5.2, Germany 3.7, the US 3.2, the UK 2.3, South Korea 2.0, Japan 1.1 and Taiwan 0.7. Theatres include small and community stages, and densities also reflect how completely OSM is mapped.' },
      unit: { zh: '家／十萬人', en: 'per 100,000' },
      file: 'theatres-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 8, 16] } },
      timeless: true,
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, 2)} 家`, en: `${fixed(v, 2)} per 100,000` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'theatres',
      label: { zh: '劇院家數（OSM）', en: 'Theatres (OSM)' },
      description: { zh: 'OpenStreetMap 上標成劇院的地方：53,349 家、185 國。美國 10,964 家最多，法國 3,451、義大利 3,214、德國 3,114、西班牙 2,188、俄羅斯 1,984；台灣 160 家。', en: 'Places tagged as theatres in OpenStreetMap: 53,349 in 185 countries. The US has the most (10,964), followed by France (3,451), Italy (3,214), Germany (3,114), Spain (2,188) and Russia (1,984); Taiwan has 160.' },
      unit: { zh: '家', en: 'theatres' },
      file: 'theatres.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'theatre-genre',
      label: { zh: '表演場館最多的類型（OSM）', en: 'Most common venue genre (OSM)' },
      description: {
        zh: 'OpenStreetMap 上標了表演類型（theatre:genre）的場館 1,469 處、77 國，地圖畫每一國最多的類型，只替至少 10 處的 28 國上色（多重類型各算一次）。古典音樂廳是 16 國最多的類型（波蘭、奧地利、義大利、西班牙、加拿大等）；德國（246 處裡 74 處）、美國、法國、英國是喜劇、綜藝與歌舞秀；俄羅斯是馬戲；捷克、喬治亞是偶戲；瑞典、愛爾蘭是話劇；日本是能、歌舞伎等傳統戲劇（100 處裡 43 處）。台灣只有 5 處標了類型。全部場館裡古典音樂 413 處、喜劇綜藝 343、話劇 156、馬戲 156、音樂劇 137、偶戲 116、歌劇芭蕾 105。標了類型的只占劇院的一小部分，偏德語區、俄羅斯與日本，只能看大概。',
        en: 'OpenStreetMap has 1,469 venues tagged with a performance genre (theatre:genre) in 77 countries; the map shows each country’s most common genre, shaded only for the 28 countries with at least 10 such venues (venues with several genres count for each). Classical concert halls are the most common type in 16 countries (including Poland, Austria, Italy, Spain and Canada); Germany (74 of 246), the US, France and the UK are led by comedy, variety and cabaret; Russia by circus; Czechia and Georgia by puppetry; Sweden and Ireland by drama; and Japan by noh, kabuki and other traditional theatre (43 of 100). Only 5 venues in Taiwan have a genre. Across all venues: classical music 413, comedy and variety 343, drama 156, circus 156, musicals 137, puppetry 116, and opera and ballet 105. Venues with a genre are only a small share of theatres and are concentrated in German-speaking countries, Russia and Japan, so treat this as approximate.',
      },
      unit: '',
      file: 'theatre-genre.json',
      layer: { kind: 'categorical', categories: GENRES },
      timeless: true,
      format: (v) => genreText(v),
      unranked: true,
    },
    {
      id: 'arts-centres-per',
      label: { zh: '每十萬人有幾家藝文中心（OSM）', en: 'Arts centres per 100,000 people (OSM)' },
      description: { zh: 'OpenStreetMap 上標成藝文中心（amenity=arts_centre）的家數 ÷ 2024 年人口，只替 OSM 覆蓋良好的 93 國上色。盧森堡每十萬人 9.1 家最多，法國 4.5、比利時 3.8、奧地利 3.7；德國 2.8、南韓 1.6、英國 1.1、美國 0.9、台灣 0.8、日本 0.2。各國把什麼標成藝文中心不太一樣。', en: 'Places tagged as arts centres (amenity=arts_centre) in OpenStreetMap divided by 2024 population, shown only for the 93 countries well covered by OSM. Luxembourg has the most per 100,000 people (9.1), followed by France (4.5), Belgium (3.8) and Austria (3.7); Germany has 2.8, South Korea 1.6, the UK 1.1, the US 0.9, Taiwan 0.8 and Japan 0.2. What gets tagged as an arts centre varies by country.' },
      unit: { zh: '家／十萬人', en: 'per 100,000' },
      file: 'arts-centres-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 8, 16] } },
      timeless: true,
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, 2)} 家`, en: `${fixed(v, 2)} per 100,000` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'arts-centres',
      label: { zh: '藝文中心家數（OSM）', en: 'Arts centres (OSM)' },
      description: { zh: 'OpenStreetMap 上標成藝文中心的地方：28,528 家、186 國。法國 3,007 家最多，美國 2,966、德國 2,328、俄羅斯 2,312、巴西 1,842、波蘭 1,310；台灣 189 家。', en: 'Places tagged as arts centres in OpenStreetMap: 28,528 in 186 countries. France has the most (3,007), followed by the US (2,966), Germany (2,328), Russia (2,312), Brazil (1,842) and Poland (1,310); Taiwan has 189.' },
      unit: { zh: '家', en: 'arts centres' },
      file: 'arts-centres.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 3000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'cinemas-per-100k',
      label: { zh: '每十萬人有幾家電影院', en: 'Cinemas per 100,000 people' },
      description: {
        zh: '室內電影院家數除以人口（UNESCO，最近一年多是 2017 年）。冰島、瑞典、愛沙尼亞、挪威每十萬人 4 家左右最多，法國 3.1、義大利 2.0、德國 1.9、美國 1.7、英國 1.2；日本 0.5、南韓 0.7、中國 0.1（2009 年）低，一個原因是大型影城一家有很多廳。台灣用文化部的統計：2017 年 111 家（每十萬人 0.47）、2025 年 104 家（0.45），一家平均 9 廳左右。',
        en: 'Indoor cinemas divided by population (UNESCO, mostly 2017). Iceland, Sweden, Estonia and Norway have about 4 per 100,000, the most; France 3.1, Italy 2.0, Germany 1.9, the US 1.7 and the UK 1.2; Japan 0.5, South Korea 0.7 and China 0.1 (2009) are low partly because their multiplexes have many screens each. Taiwan uses Ministry of Culture figures: 111 cinemas in 2017 (0.47 per 100,000) and 104 in 2025 (0.45), with about nine screens each on average.',
      },
      unit: { zh: '家／十萬人', en: 'per 100,000' },
      file: 'cinemas-per-100k.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.25, 0.5, 1, 2, 3, 4] } },
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, 2)} 家`, en: `${fixed(v, 2)} per 100,000` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'cinemas',
      label: { zh: '電影院家數', en: 'Cinemas' },
      description: {
        zh: '室內電影院的家數（UNESCO）。美國 5,747 家（2017 年）最多，法國 2,046、中國 1,687（2009 年）、德國 1,612、俄羅斯 1,596、義大利 1,204。台灣 2017 年 111 家、2025 年 104 家（文化部；2016 年 7 月起算實際營業的家數，以前是許可證家數）。',
        en: 'Number of indoor cinemas (UNESCO). The US has the most at 5,747 (2017), followed by France 2,046, China 1,687 (2009), Germany 1,612, Russia 1,596 and Italy 1,204. Taiwan had 111 in 2017 and 104 in 2025 (Ministry of Culture; operating cinemas from July 2016, licensed cinemas before).',
      },
      unit: { zh: '家', en: 'cinemas' },
      file: 'cinemas.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 5000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: fixed(v, 0) }),
    },
    {
      id: 'culture-jobs',
      label: { zh: '文化工作者占就業', en: 'Cultural employment' },
      description: {
        zh: '文化職業的就業人數占全部就業的比例（UNESCO 依 ILOSTAT 的職業分類算，2010–2016 年，74 國）。南韓 6.9%、俄羅斯 5.4%、墨西哥 4.6%、越南 4.6%、德國 4.1%、義大利 4.0%、法國 3.0%、菲律賓 2.1%。多哥、馬爾地夫、巴基斯坦的數字很高，各國職業分類的細度不同，只能看大概。',
        en: 'Employment in cultural occupations as a share of total employment (UNESCO from ILOSTAT occupational data, 2010–2016, 74 countries). South Korea 6.9%, Russia 5.4%, Mexico 4.6%, Vietnam 4.6%, Germany 4.1%, Italy 4.0%, France 3.0% and the Philippines 2.1%. Togo, the Maldives and Pakistan show very high figures; occupational coding differs by country, so treat comparisons as approximate.',
      },
      unit: '%',
      file: 'culture-jobs.json',
      defaultYear: 2015,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 4, 5, 6] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'heritage-spending',
      label: { zh: '每人的遺產保存公共支出', en: 'Public spending on heritage per person' },
      description: {
        zh: '政府花在文化與自然遺產（博物館、古蹟、自然保護區等）的錢，每人、購買力平價美元（UNESCO，2017–2024 年，77 國）。安道爾 578、比利時 369、馬爾他 350、芬蘭 265、克羅埃西亞 245 最多；英國 132、法國 117、俄羅斯 105、西班牙 61、南韓 40、巴西 20、墨西哥 10、中國 8、日本 7。',
        en: 'Government spending on cultural and natural heritage (museums, monuments, nature reserves and so on) per person, in PPP dollars (UNESCO, 2017–2024, 77 countries). Andorra 578, Belgium 369, Malta 350, Finland 265 and Croatia 245 spend the most; the UK 132, France 117, Russia 105, Spain 61, South Korea 40, Brazil 20, Mexico 10, China 8 and Japan 7.',
      },
      unit: { zh: '購買力平價美元／人', en: 'PPP$ per person' },
      file: 'heritage-spending.json',
      defaultYear: 2023,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 20, 50, 100, 200] } },
      format: (v) => tr({ zh: `每人 ${fixed(v, 1)} 美元（購買力平價）`, en: `PPP$${fixed(v, 1)} per person` }),
      formatTick: (v) => `${v}`,
    },
    // 2026-11-07（製作手冊第二十七批 556，候選 1261）：政府的文化服務、廣播與出版支出（Eurostat COFOG 08.2、08.3，
    // pipeline/topics/culture_spending.py）；手冊建議放「各國在讀什麼」，遺產保存的公共支出在這裡，放在一起
    {
      id: 'gov-culture',
      label: { zh: '政府的文化服務支出', en: 'Government spending on cultural services' },
      description: {
        zh: '一般政府（中央、地方與社會安全基金）花在文化服務（聯合國政府職能分類 COFOG 08.2：圖書館、博物館、劇院、古蹟、文化活動等）的錢占 GDP，Eurostat 的金額除以 GDP，只有歐洲 30 國（不含英國），1995 年起。2024 年冰島 1.02%、愛沙尼亞 0.96%、馬爾他 0.94%、匈牙利 0.90%、拉脫維亞 0.88%、克羅埃西亞 0.79% 最高，法國 0.65%、德國 0.41%、義大利 0.34%，希臘、愛爾蘭、賽普勒斯 0.17% 最低；歐盟 27 國合計 0.48%（876.72 億歐元），法國 189.63 億、德國 180.77 億歐元最多。台灣沒有 COFOG 分類的資料。點國家看遊憩、文化、廣播出版與宗教各花多少。',
        en: 'Spending by general government (central, local and social security funds) on cultural services (UN COFOG 08.2: libraries, museums, theatres, monuments, cultural events and so on) as a share of GDP: Eurostat’s euro amounts divided by GDP, for 30 European countries only (not the UK), from 1995. In 2024 Iceland (1.02%), Estonia (0.96%), Malta (0.94%), Hungary (0.90%), Latvia (0.88%) and Croatia (0.79%) were highest, with France 0.65%, Germany 0.41% and Italy 0.34%, and Greece, Ireland and Cyprus lowest at 0.17%; the EU27 total was 0.48% (€87.67 billion), led by France (€18.96 billion) and Germany (€18.08 billion). There are no COFOG data for Taiwan. Select a country for its spending on recreation, culture, broadcasting and religion.',
      },
      unit: { zh: '% GDP', en: '% of GDP' },
      file: 'gov-culture.json',
      defaultYear: 2024,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.3, 0.4, 0.5, 0.6, 0.8] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'gov-broadcasting',
      label: { zh: '政府的廣播與出版支出', en: 'Government spending on broadcasting and publishing' },
      description: {
        zh: '一般政府花在廣播與出版服務（COFOG 08.3，主要是公共廣播）的錢占 GDP，Eurostat，歐洲 30 國（不含英國），1995 年起。只算政府部門的支出：靠執照費或廣播費、由廣播機構自己收的國家可能不在裡面而偏低。2024 年匈牙利 0.32% 最高，奧地利、德國、克羅埃西亞、法國 0.26%，芬蘭 0.25%；歐盟 27 國合計 0.20%（366.28 億歐元），德國 114.98 億、法國 75.60 億、義大利 32.34 億、西班牙 31.44 億歐元；羅馬尼亞、馬爾他 0.06% 最低。台灣沒有 COFOG 分類的資料。',
        en: 'Spending by general government on broadcasting and publishing services (COFOG 08.3, mostly public broadcasting) as a share of GDP, from Eurostat, for 30 European countries (not the UK), from 1995. Only government spending counts: where a licence fee or broadcasting levy is collected by the broadcaster itself, it may be left out and the figure understated. In 2024 Hungary was highest at 0.32%, followed by Austria, Germany, Croatia and France at 0.26% and Finland at 0.25%; the EU27 total was 0.20% (€36.63 billion), including €11.50 billion in Germany, €7.56 billion in France, €3.23 billion in Italy and €3.14 billion in Spain; Romania and Malta were lowest at 0.06%. There are no COFOG data for Taiwan.',
      },
      unit: { zh: '% GDP', en: '% of GDP' },
      file: 'gov-broadcasting.json',
      defaultYear: 2024,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.15, 0.2, 0.25, 0.3] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'books-per-million',
      label: { zh: '每百萬人送存幾本書', en: 'Books deposited per million people' },
      description: {
        zh: '國家圖書館（法定送存機構）一年收到的書除以人口（WIPO，2022 年，82 個國家或地區）。丹麥 15,260 件最多（八成是電子書），列支敦斯登 12,946、冰島 12,404、阿爾巴尼亞 5,333、芬蘭 5,324、德國 4,771；新加坡 3,778、英國 2,449、西班牙 2,055、南韓 1,721、荷蘭 1,307、法國 1,236 與日本 906（只收紙本）、美國 775；巴西 100、墨西哥 52。台灣 2025 年 2,587（新書 ISBN 數，不是送存件數）。',
        en: 'Books received in a year by national libraries (legal deposit repositories) divided by population (WIPO, 2022, 82 countries and territories). Denmark is highest at 15,260 (80% e-books), followed by Liechtenstein 12,946, Iceland 12,404, Albania 5,333, Finland 5,324 and Germany 4,771; Singapore 3,778, the UK 2,449, Spain 2,055, South Korea 1,721, the Netherlands 1,307, France 1,236 and Japan 906 (print only) and the US 775; Brazil 100 and Mexico 52. Taiwan: 2,587 in 2025 (new-book ISBNs, not deposits).',
      },
      unit: { zh: '件／百萬人', en: 'per million' },
      file: 'books-per-million.json',
      defaultYear: 2025,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 500, 1000, 2000, 4000, 8000] } },
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 0)} 件`, en: `${fixed(v, 0)} per million` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'books-deposited',
      label: { zh: '一年送存幾本書', en: 'Books deposited' },
      description: {
        zh: '國家圖書館一年收到的書（紙本、電子書與其他形式合計，WIPO，2022 年）。德國 401,197 件最多（其中電子書 286,633），美國 264,722（電子書 242,828）、英國 167,000、日本 113,296、西班牙 98,289、土耳其 91,145、丹麥 90,080、南韓 89,110。中國、義大利不在表裡。台灣 2025 年登記新書 ISBN 59,784 個（紙本 35,256、電子書 24,528）。',
        en: 'Books received in a year by national libraries (print, e-books and other formats, WIPO, 2022). Germany has the most at 401,197 (286,633 of them e-books), followed by the US 264,722 (242,828 e-books), the UK 167,000, Japan 113,296, Spain 98,289, Türkiye 91,145, Denmark 90,080 and South Korea 89,110. China and Italy are not in the table. Taiwan registered 59,784 new-book ISBNs in 2025 (35,256 print, 24,528 e-book).',
      },
      unit: { zh: '件', en: 'items' },
      file: 'books-deposited.json',
      defaultYear: 2025,
      layer: { kind: 'bubble', legendValues: [1000, 20000, 200000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 件`, en: fixed(v, 0) }),
    },
    {
      id: 'books-digital-share',
      label: { zh: '送存的書有多少是電子書', en: 'Digital share of books deposited' },
      description: {
        zh: '送存的書裡電子書（數位形式）的比例（WIPO，2022 年）；只收紙本或沒有回報數位件數的國家不上色。美國 92%、丹麥 82%、德國 71%、紐西蘭與芬蘭 61% 最高，英國 45%、荷蘭 43%、西班牙 27%、南韓 22%；越南 5.4%、瑞典 1.5% 幾乎都是紙本。台灣 2025 年新書 ISBN 有 41% 是電子書（PDF、EPUB 各一個 ISBN）。',
        en: 'Share of deposited books that are digital (WIPO, 2022); countries whose library collects print only, or that did not report digital deposits, are left blank. The US 92%, Denmark 82%, Germany 71%, New Zealand and Finland 61% are highest; the UK 45%, the Netherlands 43%, Spain 27% and South Korea 22%; Vietnam 5.4% and Sweden 1.5% are almost all print. In Taiwan 41% of new-book ISBNs in 2025 were e-books (PDF and EPUB each get an ISBN).',
      },
      unit: '%',
      file: 'books-digital-share.json',
      defaultYear: 2025,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 20, 40, 60, 80] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    // 2026-11-08（製作手冊第二十七批 661，候選 1448）：去電影院與看現場表演的比例（EU-SILC）
    {
      id: 'attend-cinema',
      label: { zh: '一年去過電影院的人（歐洲）', en: 'Went to the cinema in the past year (Europe)' },
      description: {
        zh: '16 歲以上的人過去 12 個月至少去過一次電影院的比例（Eurostat EU-SILC 的文化參與調查，2006、2015、2022 三波，地圖用各國最近一波；冰島、德國、北馬其頓最新是 2015 年）。冰島 69.0% 最高（2015），丹麥 52.4%、盧森堡 49.2%、德國 46.6%（2015）、挪威 45.8%、荷蘭 44.5%；羅馬尼亞 14.5%、拉脫維亞 14.4%、土耳其 14.3%、北馬其頓 13.1%（2015）、保加利亞 13.0% 最低。2022 年有些國家還在疫情尾聲。台灣不在 EU-SILC，滑過台灣看文化部文化參與調查的數字（2024/2025 年 33.5%，問法不同、不能直接比）。',
        en: 'Share of people aged 16 and over who went to the cinema at least once in the past 12 months (Eurostat EU-SILC cultural participation, waves 2006, 2015 and 2022; the map uses each country’s latest wave, 2015 for Iceland, Germany and North Macedonia). Iceland is highest at 69.0% (2015), then Denmark 52.4%, Luxembourg 49.2%, Germany 46.6% (2015), Norway 45.8% and the Netherlands 44.5%; Romania 14.5%, Latvia 14.4%, Turkey 14.3%, North Macedonia 13.1% (2015) and Bulgaria 13.0% are lowest. Some countries were still emerging from the pandemic in 2022. Taiwan is not in EU-SILC; hover over it for the Ministry of Culture’s participation survey (33.5% in 2024/2025, a different survey that is not directly comparable).',
      },
      unit: '%',
      file: 'attend-cinema.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [15, 20, 25, 30, 40, 50] } },
      defaultYear: 2022,
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      missing: { zh: '只有歐洲有資料', en: 'Europe only' },
    },
    {
      id: 'attend-live',
      label: { zh: '一年看過現場表演的人（歐洲）', en: 'Saw a live performance in the past year (Europe)' },
      description: {
        zh: '16 歲以上的人過去 12 個月至少看過一次現場表演（戲劇、音樂會、芭蕾）的比例（同一份調查）。冰島 73.5% 最高（2015），德國 48.6%（2015）、盧森堡 48.5%、瑞士 46.6%、丹麥 45.7%、挪威 41.8%；保加利亞 10.7%、羅馬尼亞 10.4%、土耳其 6.2% 最低。台灣用文化部調查的表演藝術（含流行音樂）參與率：2024/2025 年 38.2%（滑過台灣看）。',
        en: 'Share of people aged 16 and over who saw a live performance (theatre, concert or ballet) at least once in the past 12 months (same survey). Iceland is highest at 73.5% (2015), then Germany 48.6% (2015), Luxembourg 48.5%, Switzerland 46.6%, Denmark 45.7% and Norway 41.8%; Bulgaria 10.7%, Romania 10.4% and Turkey 6.2% are lowest. For Taiwan, hover for the Ministry of Culture’s performing arts participation rate (including pop music): 38.2% in 2024/2025.',
      },
      unit: '%',
      file: 'attend-live.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 30, 40, 50] } },
      defaultYear: 2022,
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      missing: { zh: '只有歐洲有資料', en: 'Europe only' },
    },
    // 2026-11-08（製作手冊第二十七批 662，候選 1450、1457、1458、1459）
    {
      id: 'industry',
      label: { zh: '文化產業的營業額（歐洲）', en: 'Cultural industry turnover (Europe)' },
      description: {
        zh: '文化相關行業的企業一年營業額（Eurostat 文化部門企業統計，各國最近一年，多半是 2020 年，資料到 2020 年為止），子項目切換行業。影視與音樂製作：德國 109 億歐元、法國 83 億、西班牙 44 億、荷蘭 43 億；廣播：法國 225 億、德國 106 億、義大利 73 億；書籍出版：法國 61 億、德國 57 億；報紙：德國 128 億、法國 38 億；期刊：德國 64 億、法國 38 億；書店零售：德國 36 億、法國 22 億；影音零售只剩幾千萬歐元（義大利 5,170 萬最多）。英國照網站的 Eurostat 規則不收；遊戲出版在「遊戲與電競」。台灣不在 Eurostat，滑過台灣看文化部文創產業統計最接近的細類（2023 年，新台幣，分類不同）。',
        en: 'Annual turnover of enterprises in culture-related industries (Eurostat statistics on cultural enterprises, each country’s latest year, mostly 2020, when the series ends); sub-items switch industries. Film, video and music production: Germany €10.9 billion, France €8.3 billion, Spain €4.4 billion and the Netherlands €4.3 billion; broadcasting: France €22.5 billion, Germany €10.6 billion and Italy €7.3 billion; book publishing: France €6.1 billion and Germany €5.7 billion; newspapers: Germany €12.8 billion and France €3.8 billion; magazines: Germany €6.4 billion and France €3.8 billion; bookshops: Germany €3.6 billion and France €2.2 billion; music and video retail is down to tens of millions (Italy highest at €51.7 million). The UK is excluded under this site’s Eurostat rule; game publishing is in Games and esports. Taiwan is not in Eurostat; hover over it for the closest sub-categories in the Ministry of Culture’s creative industry statistics (2023, NT dollars, different classification).',
      },
      unit: { zh: '百萬歐元', en: '€ million' },
      file: 'industry/{item}.json',
      dimension: {
        label: { zh: '行業', en: 'Industry' },
        options: [
          { id: 'film-music', label: { zh: '影視與音樂製作（J59）', en: 'Film, video and music production (J59)' } },
          { id: 'broadcasting', label: { zh: '廣播與電視台（J60）', en: 'Broadcasting (J60)' } },
          { id: 'books', label: { zh: '書籍出版（J58.11）', en: 'Book publishing (J58.11)' } },
          { id: 'newspapers', label: { zh: '報紙出版（J58.13）', en: 'Newspaper publishing (J58.13)' } },
          { id: 'magazines', label: { zh: '期刊出版（J58.14）', en: 'Magazine publishing (J58.14)' } },
          { id: 'bookshops', label: { zh: '書店零售（G47.61）', en: 'Bookshops (G47.61)' } },
          { id: 'music-video-retail', label: { zh: '影音零售（G47.63）', en: 'Music and video retail (G47.63)' } },
        ],
        defaultOption: 'film-music',
      },
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      timeless: true,
      format: eur,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: false,
      missing: { zh: '只有歐洲有資料', en: 'Europe only' },
    },
    {
      id: 'artists',
      label: { zh: '藝術家、作家與記者（歐洲）', en: 'Artists, writers and journalists (Europe)' },
      description: {
        zh: '創作與表演藝術家、作家、記者與語言工作者的人數（Eurostat 文化就業統計，千人，2011–2025）。2025 年德國約 37.6 萬人最多，法國約 29.7 萬、義大利約 16.4 萬、西班牙約 15.6 萬、土耳其約 15 萬、荷蘭約 14.4 萬。這是 Eurostat 的職業定義，跟上面 UIS 的「文化工作者占就業」不是同一個算法。',
        en: 'Number of creative and performing artists, authors, journalists and linguists (Eurostat cultural employment statistics, thousands, 2011–2025). In 2025 Germany had the most (about 376,000), followed by France (297,000), Italy (164,000), Spain (156,000), Turkey (150,000) and the Netherlands (144,000). This uses Eurostat’s occupational definition, not the same as UIS’s cultural employment share above.',
      },
      unit: { zh: '千人', en: 'thousand people' },
      file: 'artists.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 300] },
      defaultYear: 2025,
      format: (v) => tr({ zh: `${fixed(v * 1000, 0)} 人`, en: `${fixed(v * 1000, 0)} people` }),
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '只有歐洲有資料', en: 'Europe only' },
    },
    {
      id: 'domains',
      label: { zh: '文化工作者在哪個領域', en: 'Cultural workers by domain' },
      description: {
        zh: '文化職業的就業裡，各個文化領域占多少（UNESCO UIS，2010–2016 年，各國最近一年，約 55 國），子項目切換七個領域。分母是文化職業就業，不是總就業，只能看結構。書籍與報刊：盧森堡 49.6%、瑞典 28.1%；影視與互動媒體：玻利維亞 17.5%、法國 14.0%；視覺藝術與工藝：烏干達 92.0%、斯里蘭卡 91.8%（多半是工藝）；設計與創意服務：馬利 79.6%、瑞士 43.3%、比利時 42.0%；文化教育與訓練：馬爾他 27.1%、南韓 25.8%。UIS 不收台灣。',
        en: 'How cultural employment is split across cultural domains (UNESCO UIS, 2010–2016, each country’s latest year, about 55 countries); sub-items switch between the seven domains. The denominator is employment in cultural occupations, not total employment, so this shows structure only. Books and press: Luxembourg 49.6% and Sweden 28.1%; audiovisual and interactive media: Bolivia 17.5% and France 14.0%; visual arts and crafts: Uganda 92.0% and Sri Lanka 91.8% (mostly crafts); design and creative services: Mali 79.6%, Switzerland 43.3% and Belgium 42.0%; cultural education and training: Malta 27.1% and South Korea 25.8%. UIS does not cover Taiwan.',
      },
      unit: '%',
      file: 'domains/{item}.json',
      dimension: {
        label: { zh: '領域', en: 'Domain' },
        options: [
          { id: 'd1', label: { zh: '文化與自然遺產', en: 'Cultural and natural heritage' } },
          { id: 'd2', label: { zh: '表演與慶典', en: 'Performance and celebration' } },
          { id: 'd3', label: { zh: '視覺藝術與工藝', en: 'Visual arts and crafts' } },
          { id: 'd4', label: { zh: '書籍與報刊', en: 'Books and press' } },
          { id: 'd5', label: { zh: '影視與互動媒體', en: 'Audiovisual and interactive media' } },
          { id: 'd6', label: { zh: '設計與創意服務', en: 'Design and creative services' } },
          { id: 'd7', label: { zh: '文化教育與訓練', en: 'Cultural education and training' } },
        ],
        defaultOption: 'd5',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 30, 50] } },
      defaultYear: 2016,
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
  ],
};

/**
 * 文化（2026-11-04，主題整併 併10）：「台灣人看哪一國的電影」併進來（電影院已經在這裡），資料照舊在 box-office-tw/
 * （topics/merge.ts），舊網址 t/box-office-tw/ 轉到這裡（redirects.ts）
 */
export const culture: TopicDefinition = withParts(
  {
    ...hostOnly(cultureOwn),
    title: { zh: '文化：電影院與台灣的票房、出版、文化工作者與遺產保存', en: 'Culture: cinemas and Taiwan’s box office, books, cultural jobs and heritage' },
  },
  topicPart(boxOfficeTw),
);
