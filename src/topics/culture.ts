import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 文化：電影院、文化工作者、遺產保存的公共支出（2026-11-04，製作手冊第二十一批 371、374、375；pipeline/topics/culture.py）：
 * UNESCO 統計研究所（UIS）的公開 API，年份零散（資料檔設 latestWithin）。台灣不在 UIS 裡。
 */

const UIS = {
  name: { zh: 'UNESCO 統計研究所（UIS）資料庫', en: 'UNESCO Institute for Statistics (UIS) database' },
  url: 'https://databrowser.uis.unesco.org/',
  license: 'CC BY-SA 4.0',
};

export const culture: TopicDefinition = {
  id: 'culture',
  title: { zh: '文化：電影院、文化工作者與遺產保存', en: 'Culture: cinemas, cultural jobs and heritage' },
  shortTitle: { zh: '文化', en: 'Culture' },
  defaultIndicator: 'cinemas-per-100k',
  defaultYear: 2017,
  sources: [
    UIS,
    { name: { zh: 'UN World Population Prospects 2024（每十萬人用的人口）', en: 'UN World Population Prospects 2024 (population)' }, url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
  ],
  note: {
    zh: '都是 UNESCO 統計研究所的資料（CC BY-SA 4.0，資料檔同樣授權），各國回報的年份差很多：電影院到 2017 年（之後 UIS 沒有再收），文化工作者 2010–2016 年，遺產保存支出 2017–2024 年；某一年沒有資料時用前幾年最近的值（滑過國家看年份）。電影院是「室內電影院」的家數，一家影城算一家、不是銀幕數。文化工作者是文化職業（藝術家、設計師、圖書館員、手工藝師等）占全部就業的比例，各國的職業分類細度不同、低所得國家的數字可能偏高。遺產保存支出是政府花在文化與自然遺產（博物館、古蹟、自然保護區等）的錢，每人、購買力平價美元。台灣不在 UNESCO 的資料裡。',
    en: 'All from the UNESCO Institute for Statistics (CC BY-SA 4.0; data files are shared under the same licence). Reporting years vary a lot: cinemas up to 2017 (UIS stopped collecting them), cultural employment 2010–2016 and heritage spending 2017–2024; where a year is missing, the most recent earlier value is used (hover for the year). Cinemas are indoor cinema venues, each multiplex counting once, not screens. Cultural employment is the share of jobs in cultural occupations (artists, designers, librarians, craftspeople and so on); occupational detail differs by country, and figures for low-income countries may be high. Heritage spending is government spending on cultural and natural heritage (museums, monuments, nature reserves and so on), per person in PPP dollars. Taiwan is not in the UNESCO data.',
  },
  indicators: [
    {
      id: 'cinemas-per-100k',
      label: { zh: '每十萬人有幾家電影院', en: 'Cinemas per 100,000 people' },
      description: {
        zh: '室內電影院家數除以人口（UNESCO，最近一年多是 2017 年）。冰島、瑞典、愛沙尼亞、挪威每十萬人 4 家左右最多，法國 3.1、義大利 2.0、德國 1.9、美國 1.7、英國 1.2；日本 0.5、南韓 0.7、中國 0.1（2009 年）低，一個原因是大型影城一家有很多廳。台灣的電影院家數還在整理。',
        en: 'Indoor cinemas divided by population (UNESCO, mostly 2017). Iceland, Sweden, Estonia and Norway have about 4 per 100,000, the most; France 3.1, Italy 2.0, Germany 1.9, the US 1.7 and the UK 1.2; Japan 0.5, South Korea 0.7 and China 0.1 (2009) are low partly because their multiplexes have many screens each. Taiwan’s cinema count has not been added yet.',
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
        zh: '室內電影院的家數（UNESCO）。美國 5,747 家（2017 年）最多，法國 2,046、中國 1,687（2009 年）、德國 1,612、俄羅斯 1,596、義大利 1,204。',
        en: 'Number of indoor cinemas (UNESCO). The US has the most at 5,747 (2017), followed by France 2,046, China 1,687 (2009), Germany 1,612, Russia 1,596 and Italy 1,204.',
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
  ],
};
