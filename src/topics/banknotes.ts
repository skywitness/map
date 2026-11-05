import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 鈔票（2026-11-05，製作手冊第二十二批 397「鈔票上是誰」，加上使用者改成要做的候選 681「最大面額的鈔票」）：
 * pipeline/topics/banknote_people.py（英文維基「List of people on banknotes」）、banknote_largest.py（各貨幣條目的資訊框、
 * 世界銀行官方匯率）。兩份資料檔都依 CC BY-SA 4.0 分享。
 */

/** 人像的類別（pipeline 的 CATEGORIES 與 OTHER、NOBODY） */
export const PORTRAIT: CategoryDef[] = [
  { value: 1, label: { zh: '政治人物（總統、總理…）', en: 'Politicians (presidents, prime ministers…)' } },
  { value: 2, label: { zh: '君主', en: 'Monarchs' } },
  { value: 3, label: { zh: '國父、獨立或革命人物', en: 'Founders, independence or revolutionary figures' } },
  { value: 4, label: { zh: '科學家、發明家、探險家', en: 'Scientists, inventors, explorers' } },
  { value: 5, label: { zh: '作家、藝術家、學者', en: 'Writers, artists, scholars' } },
  { value: 6, label: { zh: '軍人', en: 'Military figures' } },
  { value: 7, label: { zh: '宗教人物', en: 'Religious figures' } },
  { value: 8, label: { zh: '其他', en: 'Others' } },
  { value: 9, label: { zh: '鈔票上沒有人（歐元）', en: 'No people (euro)' } },
];
/** 地圖的類別（最多 8 色）：軍人、宗教人物為主的國家在 pipeline 併進「其他」 */
const PORTRAIT_MAP: CategoryDef[] = PORTRAIT.filter((c) => c.value !== 6 && c.value !== 7).map((c) =>
  c.value === 8 ? { ...c, label: { zh: '其他（含軍人、宗教人物）', en: 'Others (incl. military and religious figures)' } } : c,
);

const usd = (v: number) => tr({ zh: `${formatLargeNumber(v)} 美元`, en: `US$${v < 10 ? fixed(v, 2) : formatLargeNumber(v)}` });

export const banknotes: TopicDefinition = {
  id: 'banknotes',
  title: { zh: '鈔票：上面是誰、最大面額值多少', en: 'Banknotes: who is on them, and what the largest is worth' },
  shortTitle: { zh: '鈔票', en: 'Banknotes' },
  defaultIndicator: 'portrait',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: '英文維基百科「List of people on banknotes」（2026 年 10 月的版本）', en: 'Wikipedia, “List of people on banknotes” (October 2026 revision)' },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_people_on_banknotes&oldid=1381887954',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '英文維基百科「List of circulating currencies」與各貨幣條目的資訊框', en: 'Wikipedia, “List of circulating currencies” and the infoboxes of each currency article' },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_circulating_currencies&oldid=1383733421',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'World Bank, World Development Indicators（官方匯率 PA.NUS.FCRF）', en: 'World Bank, World Development Indicators (official exchange rate, PA.NUS.FCRF)' },
      url: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '中央銀行（新台幣對美元匯率）', en: 'Central Bank of the Republic of China (Taiwan), NT$/US$ exchange rate' },
      url: 'https://www.cbc.gov.tw/tw/np-1251-1.html',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '人像依英文維基「List of people on banknotes」：流通年份是開放式的（例如「2001–」）才算現在流通，紀念鈔不算；條目常常沒有更新，判斷會有錯。類別依「被紀念的理由」原文的關鍵字自動分：先看是不是君主，再看國父、獨立或革命，再依序是宗教、科學、文藝、政治、軍人，都比不到的算其他；一國取現在流通的人像裡最多的一類，一樣多時取面額最大那張上的人。分類本身有爭議（孫中山算國父，蔣中正算政治人物），滑過國家看最大面額上是誰，側欄列每個人的原文理由。歐元紙鈔上沒有人像；英國只算英格蘭銀行的鈔票。最大面額依各貨幣條目資訊框的「常用、少用的鈔票」，用世界銀行最近一年的官方匯率換成美元（台灣用中央銀行的年平均匯率）；惡性通膨國家的官方匯率跟市場差很多，只當參考。兩份資料檔都依 CC BY-SA 4.0 分享。',
    en: 'Portraits follow the Wikipedia “List of people on banknotes”: only notes with an open-ended circulation period (such as “2001–”) count as current, and commemorative notes are excluded; the article is not always up to date, so some judgements will be wrong. Categories come from keywords in the “reason for honour” text: monarchs first, then founders, independence and revolutionary figures, then religious figures, scientists, writers and artists, politicians and military figures in that order, with the rest as others. A country takes the most common category among its current portraits, with ties going to the person on the highest denomination. The categories are debatable (Sun Yat-sen counts as a founder, Chiang Kai-shek as a politician); hover to see who is on the highest note, and the side panel lists each person’s reason as written. Euro banknotes show no people; for the UK only Bank of England notes count. The largest note comes from each currency article’s infobox (frequently and rarely used banknotes), converted to US dollars at the World Bank’s latest official exchange rate (Taiwan: the central bank’s annual average). Official rates in countries with very high inflation differ greatly from market rates, so treat those values as a guide only. Both data files are shared under CC BY-SA 4.0.',
  },
  panelExtra: () => import('./panels/BanknotesPanel'),
  indicators: [
    {
      id: 'portrait',
      label: { zh: '鈔票上是誰', en: 'Who is on the banknotes' },
      description: {
        zh: '現在流通的鈔票上的人像，大多是哪一類人（英文維基「List of people on banknotes」，113 國 771 人次）。政治人物 33 國（中國、加拿大、南非、新加坡…）、君主 33 國（英國、泰國、沙烏地、摩洛哥、馬來西亞…）、作家與藝術家 25 國（瑞士、瑞典、挪威、日本、南韓、澳洲…）、國父與獨立革命人物 17 國（美國、印度、印尼、墨西哥、越南…），科學家為主的只有伊拉克與塞爾維亞；26 個用歐元的國家鈔票上沒有人。台灣的 100 元是孫中山（國父）、200 元是蔣中正（政治人物），一樣多時取面額大的那張，所以算政治人物；500、1,000、2,000 元上面沒有人。滑過國家看最大面額上是誰。',
        en: 'Which kind of person mostly appears on a country’s current banknotes (Wikipedia, “List of people on banknotes”; 113 countries, 771 portraits). Politicians lead in 33 countries (China, Canada, South Africa, Singapore…) and monarchs in 33 (the UK, Thailand, Saudi Arabia, Morocco, Malaysia…), writers and artists in 25 (Switzerland, Sweden, Norway, Japan, South Korea, Australia…) and founders or independence figures in 17 (the US, India, Indonesia, Mexico, Vietnam…); only Iraq and Serbia are led by scientists, and the 26 countries using the euro have no people on their notes. Taiwan’s NT$100 shows Sun Yat-sen (a founder) and the NT$200 Chiang Kai-shek (a politician); ties go to the higher note, so Taiwan counts as politicians. The NT$500, 1,000 and 2,000 show no one. Hover to see who is on the highest denomination.',
      },
      unit: '',
      file: 'portrait.json',
      layer: { kind: 'categorical', categories: PORTRAIT_MAP },
      format: (v) => tr(PORTRAIT_MAP.find((c) => c.value === v)?.label ?? ''),
    },
    {
      id: 'largest-usd',
      label: { zh: '最大面額的鈔票值多少美元', en: 'Largest banknote in US dollars' },
      description: {
        zh: '最大面額的鈔票換成美元約多少（各貨幣條目資訊框列的常用與少用面額，世界銀行 2023 年以後最近一年的官方匯率，177 國）。新加坡 10,000 元約 7,648 美元最大，瑞士 1,000 法郎約 1,203 美元，用歐元的國家 500 歐元約 565 美元；香港 1,000 港元約 128 美元、美國 100 美元、日本 1 萬日圓約 67 美元、台灣 2,000 元約 64 美元、南韓 5 萬韓元約 35 美元、中國 100 元約 14 美元。最小的是南蘇丹 1,000 鎊約 0.46 美元、奈及利亞 1,000 奈拉約 0.66 美元、葉門 1,000 里亞爾約 0.74 美元、黎巴嫩 10 萬鎊約 1.1 美元。英鎊、印度盧比等條目沒有可靠的現行面額，沒有畫。',
        en: 'The largest banknote in US dollars (frequently and rarely used notes in each currency article’s infobox, at the latest World Bank official exchange rate from 2023 on; 177 countries). Singapore’s S$10,000 is the largest at about US$7,648, then Switzerland’s CHF 1,000 at about US$1,203 and the €500 at about US$565 in euro countries; Hong Kong’s HK$1,000 is about US$128, the US $100, Japan’s ¥10,000 about US$67, Taiwan’s NT$2,000 about US$64, South Korea’s ₩50,000 about US$35 and China’s ¥100 about US$14. The smallest are South Sudan’s 1,000 pounds (about US$0.46), Nigeria’s ₦1,000 (US$0.66), Yemen’s 1,000 rials (US$0.74) and Lebanon’s 100,000 pounds (US$1.1). Articles such as the pound sterling and Indian rupee give no reliable current denominations and are left out.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'largest-usd.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 20, 50, 100, 200, 500] } },
      format: usd,
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
