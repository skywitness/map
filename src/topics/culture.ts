import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

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

export const culture: TopicDefinition = {
  id: 'culture',
  title: { zh: '文化：電影院、出版、文化工作者與遺產保存', en: 'Culture: cinemas, books, cultural jobs and heritage' },
  shortTitle: { zh: '文化', en: 'Culture' },
  defaultIndicator: 'cinemas-per-100k',
  defaultYear: 2017,
  sources: [
    UIS,
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
    { name: { zh: 'UN World Population Prospects 2024（人口）', en: 'UN World Population Prospects 2024 (population)' }, url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
  ],
  note: {
    zh: '都是 UNESCO 統計研究所的資料（CC BY-SA 4.0，資料檔同樣授權），各國回報的年份差很多：電影院到 2017 年（之後 UIS 沒有再收；台灣用文化部的統計，到 2025 年），文化工作者 2010–2016 年，遺產保存支出 2017–2024 年；某一年沒有資料時用前幾年最近的值（滑過國家看年份）。出版是世界智慧財產權組織（WIPO）出版業報告裡各國國家圖書館（法定送存機構）2022 年收到的書（CC BY 4.0），有沒有強制送存電子書差很多，只能看大概；中國、義大利不在表裡；這是改作過的內容，WIPO 秘書處不對改作或翻譯負任何責任。台灣用國家圖書館 ISBN 中心一年登記的新書 ISBN 數（2024、2025 年），不是送存件數。電影院是「室內電影院」的家數，一家影城算一家、不是銀幕數。文化工作者是文化職業（藝術家、設計師、圖書館員、手工藝師等）占全部就業的比例，各國的職業分類細度不同、低所得國家的數字可能偏高。遺產保存支出是政府花在文化與自然遺產（博物館、古蹟、自然保護區等）的錢，每人、購買力平價美元。台灣不在 UNESCO 的資料裡。',
    en: 'All from the UNESCO Institute for Statistics (CC BY-SA 4.0; data files are shared under the same licence). Reporting years vary a lot: cinemas up to 2017 (UIS stopped collecting them; Taiwan uses Ministry of Culture figures to 2025), cultural employment 2010–2016 and heritage spending 2017–2024; where a year is missing, the most recent earlier value is used (hover for the year). Books are those received in 2022 by national libraries (legal deposit repositories), from the World Intellectual Property Organization’s publishing report (CC BY 4.0); whether e-books must be deposited varies a lot, so treat comparisons as approximate; China and Italy are not in the table. This is an adaptation: the Secretariat of WIPO assumes no liability or responsibility with regard to the transformation or translation of the original content. Taiwan’s figure is new-book ISBNs registered with the National Central Library in 2024 and 2025, not deposits. Cinemas are indoor cinema venues, each multiplex counting once, not screens. Cultural employment is the share of jobs in cultural occupations (artists, designers, librarians, craftspeople and so on); occupational detail differs by country, and figures for low-income countries may be high. Heritage spending is government spending on cultural and natural heritage (museums, monuments, nature reserves and so on), per person in PPP dollars. Taiwan is not in the UNESCO data.',
  },
  indicators: [
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
  ],
};
