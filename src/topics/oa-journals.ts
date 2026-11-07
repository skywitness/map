import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 開放取用期刊是誰出版的、作者要不要付錢（新主題，2026-11-07，製作手冊第二十七批 599，候選 1323；科技・研發與創新）：
 * DOAJ 的期刊 CSV（CC0），pipeline/topics/oa_journals.py；側欄 panels/OaJournalsPanel.tsx 是學科與投稿語言。
 */
const NOTE = {
  zh: 'DOAJ 只收通過審查的開放取用期刊，國家是出版者的登記地：印尼很多是大學辦的小型期刊，瑞士的 821 本多半是登記在瑞士的 MDPI，所以期刊數不等於學術產量。',
  en: 'DOAJ lists only vetted open-access journals, by the publisher’s registered country: many of Indonesia’s are small university journals and most of Switzerland’s 821 belong to MDPI, which is registered there, so journal counts are not research output.',
};

export const oaJournals: TopicDefinition = {
  id: 'oa-journals',
  title: { zh: '開放取用期刊是誰出版的、作者要不要付錢', en: 'Who publishes open-access journals, and who charges authors' },
  shortTitle: { zh: '開放取用期刊', en: 'Open-access journals' },
  defaultIndicator: 'oa-journals',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'DOAJ（Directory of Open Access Journals）期刊清單 CSV，2026-11-07 下載', en: 'DOAJ (Directory of Open Access Journals) journal CSV, downloaded 7 Nov 2026' },
      url: 'https://doaj.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh: 'DOAJ 收錄的開放取用期刊（讀者免費、內容用開放授權），23,578 本，依出版者所在國。有些期刊向投稿的作者收論文處理費（APC），有些由大學、學會或政府出錢、作者不必付（俗稱鑽石型開放取用）。時間軸是期刊「全部內容改用開放授權」的年份累計，只算現在還在 DOAJ 裡的期刊，停刊或被除名的不算。台灣在 DOAJ 寫成「Taiwan, Province of China」，這裡改成台灣。',
    en: 'Open-access journals listed in DOAJ (free to read, openly licensed), 23,578 in all, by the publisher’s country. Some charge authors an article processing charge (APC); others are paid for by universities, societies or governments, so authors pay nothing (“diamond” open access). The timeline accumulates the year each journal made all its content openly licensed, counting only journals still in DOAJ, so ceased or removed journals are missing. DOAJ lists Taiwan as “Taiwan, Province of China”; it is shown as Taiwan here.',
  },
  panelExtra: () => import('./panels/OaJournalsPanel'),
  indicators: [
    {
      id: 'oa-journals',
      label: { zh: '開放取用期刊的數量', en: 'Open-access journals' },
      description: {
        zh: `DOAJ 收錄的開放取用期刊，依出版者所在國，141 國。印尼 2,730 本最多，英國 2,330、巴西 1,395、美國 1,340、伊朗 1,096、西班牙 1,031、波蘭 1,013、瑞士 821、土耳其 716、俄羅斯 654、中國 577；台灣 23 本。時間軸是改成開放取用的年份累計（現在還在 DOAJ 的）：1990 年以前 344 本、2010 年 6,152 本。${NOTE.zh}`,
        en: `Open-access journals listed in DOAJ, by publisher country, 141 countries. Indonesia has the most at 2,730, followed by the UK 2,330, Brazil 1,395, the US 1,340, Iran 1,096, Spain 1,031, Poland 1,013, Switzerland 821, Turkey 716, Russia 654 and China 577; Taiwan has 23. The timeline accumulates the year journals went open access (those still in DOAJ): 344 by 1990 and 6,152 by 2010. ${NOTE.en}`,
      },
      unit: { zh: '本', en: 'journals' },
      file: 'journals.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${fixed(v, 0)} 本`, en: fixed(v, 0) }),
      formatTick: formatLargeTick,
      integer: true,
    },
    {
      id: 'oa-apc-share',
      label: { zh: '向作者收費的期刊比例', en: 'Journals charging authors (APC)' },
      description: {
        zh: `開放取用期刊裡向作者收論文處理費（APC）的比例（至少 10 本期刊的國家）。全世界 23,578 本裡 8,848 本收費（37.5%）。瑞士 87.7%、英國 77.4%、中國 76.6%、日本 69.5% 這些商業出版社多的地方收費的多；印尼 55.8%、美國 49.3%，台灣 21.7%，巴西只有 10.7%，拉丁美洲很多國家幾乎都不收（大學與政府出錢）。${NOTE.zh}`,
        en: `Share of open-access journals charging authors an article processing charge (countries with at least 10 journals). Worldwide 8,848 of 23,578 charge (37.5%). Places with many commercial publishers charge most: Switzerland 87.7%, the UK 77.4%, China 76.6% and Japan 69.5%; Indonesia 55.8%, the US 49.3%, Taiwan 21.7% and Brazil only 10.7%, and in many Latin American countries almost none charge (universities and governments pay). ${NOTE.en}`,
      },
      unit: '%',
      file: 'apc-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 40, 55, 70] } },
      format: (v) => `${fixed(v, 1)}%`,
      timeless: true,
    },
  ],
};
