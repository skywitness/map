import { tr } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 獨立紀念日：哪一年、從誰獨立（新主題，2026-11-07，製作手冊第二十七批 560，候選 1264；pipeline/topics/independence.py）。
 * 英文維基百科「List of national independence days」（revid 1383739965，CC BY-SA 4.0）。一國有好幾列時地圖用第一列。
 */

/** 從誰獨立（pipeline 的 RULER_CLASS） */
const RULERS: CategoryDef[] = [
  { value: 1, label: { zh: '英國', en: 'United Kingdom' } },
  { value: 2, label: { zh: '法國', en: 'France' } },
  { value: 3, label: { zh: '西班牙', en: 'Spain' } },
  { value: 4, label: { zh: '葡萄牙', en: 'Portugal' } },
  { value: 5, label: { zh: '俄羅斯與蘇聯', en: 'Russia and the Soviet Union' } },
  { value: 6, label: { zh: '鄂圖曼帝國', en: 'Ottoman Empire' } },
  { value: 7, label: { zh: '其他歐洲國家', en: 'Other European states' } },
  { value: 8, label: { zh: '其他', en: 'Other' }, color: MAP_TOKENS.categoricalOther },
];

const NOTE = {
  zh: '英文維基百科「List of national independence days」（2026 年 11 月的版本 1383739965，只引用事實；這個主題的資料檔依 CC BY-SA 4.0 分享）：169 個國家與地區的 208 個紀念日。一國有好幾個（阿富汗 1919 年從英國、1989 年蘇聯撤軍；拉脫維亞 1918 年宣布、1990 年恢復獨立）時地圖用表上的第一個，點國家看全部。這是「獨立紀念日」的列表，不是國慶日：法國（7 月 14 日）、中國（10 月 1 日）、日本（2 月 11 日）的國慶日不是從別國獨立，不在表上。已經不存在的國家（蘇聯、鄂圖曼帝國、奧匈帝國、南斯拉夫）照原文，不換成今天的繼承國；跟「帝國與疆界」主題的殖民帝國（COLDAT）是不同的資料，有好幾個宗主國的國家，兩邊可能不一樣。表上的台灣是 10 月 25 日的臺灣光復節（1945 年日本統治結束），那是統治結束、不是獨立，地圖不上色；中華民國國慶日是 10 月 10 日，紀念 1911 年武昌起義。',
  en: 'English Wikipedia’s “List of national independence days” (revision 1383739965, November 2026; facts only, and this topic’s data files are shared under CC BY-SA 4.0): 208 commemorations for 169 countries and territories. Where a country has several (Afghanistan 1919 from the UK and 1989 for the Soviet withdrawal; Latvia’s 1918 proclamation and 1990 restoration), the map uses the first listed and the side panel shows them all. This is a list of independence days, not national days: the national days of France (14 July), China (1 October) and Japan (11 February) do not mark independence from another state and are not on it. States that no longer exist (the Soviet Union, the Ottoman Empire, Austria-Hungary, Yugoslavia) are kept as written rather than mapped to today’s successors; this is a different source from the colonial empires (COLDAT) in the Empires and borders topic, and countries with several former rulers may differ between the two. The list gives Taiwan’s Retrocession Day on 25 October (the end of Japanese rule in 1945), which marks the end of colonial rule rather than independence, so Taiwan is not coloured; the Republic of China’s National Day is 10 October, marking the 1911 Wuchang Uprising.',
};

export const independence: TopicDefinition = {
  id: 'independence',
  title: { zh: '獨立紀念日：哪一年、從誰獨立', en: 'Independence days: when and from whom' },
  shortTitle: { zh: '獨立紀念日', en: 'Independence days' },
  defaultIndicator: 'ruler',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: {
        zh: '英文維基百科「List of national independence days」（revid 1383739965）',
        en: 'English Wikipedia, “List of national independence days” (revision 1383739965)',
      },
      url: 'https://en.wikipedia.org/wiki/List_of_national_independence_days?oldid=1383739965',
      license: { zh: 'CC BY-SA 4.0（引用事實；這個主題的資料檔也用 CC BY-SA 4.0）', en: 'CC BY-SA 4.0 (facts cited; this topic’s data files are shared under CC BY-SA 4.0 too)' },
    },
  ],
  note: NOTE,
  panelExtra: () => import('./panels/IndependencePanel'),
  indicators: [
    {
      id: 'ruler',
      label: { zh: '從誰獨立', en: 'Independence from' },
      description: {
        zh: `獨立紀念日紀念的是從哪一國獨立（有好幾個時用第一個）。168 個有值的國家裡，英國 55 個最多，法國 23、西班牙 20（多半在拉丁美洲，表上寫西班牙帝國）、俄羅斯與蘇聯 15、鄂圖曼帝國 8、葡萄牙 8，其他歐洲國家 20（比利時、荷蘭、奧匈帝國、南斯拉夫等），其他 19（大日本帝國的南韓、北韓、印尼、越南，美國的帛琉、馬紹爾群島、密克羅尼西亞，清朝的蒙古，巴基斯坦的孟加拉，馬來西亞的新加坡，蘇丹的南蘇丹等）。${NOTE.zh}`,
        en: `Which state the independence day marks independence from (the first listed where there are several). Of the 168 countries with a value, the United Kingdom accounts for 55, France 23, Spain 20 (mostly in Latin America, listed as the Spanish Empire), Russia and the Soviet Union 15, the Ottoman Empire 8 and Portugal 8, other European states 20 (Belgium, the Netherlands, Austria-Hungary, Yugoslavia and others) and others 19 (the Empire of Japan for South Korea, North Korea, Indonesia and Vietnam; the US for Palau, the Marshall Islands and Micronesia; the Qing dynasty for Mongolia; Pakistan for Bangladesh; Malaysia for Singapore; Sudan for South Sudan, and more). ${NOTE.en}`,
      },
      unit: '',
      file: 'ruler.json',
      layer: { kind: 'categorical', categories: RULERS },
      format: (v) => tr(RULERS.find((c) => c.value === v)?.label ?? ''),
    },
    {
      id: 'year',
      label: { zh: '獨立的年份', en: 'Year of independence' },
      description: {
        zh: `獨立紀念日紀念的那一年（有好幾個時用第一個）。最早的是瑞士 1291 年、瑞典 1523 年、馬爾地夫 1573 年、葡萄牙 1640 年、美國 1776 年，最晚的是科索沃 2008 年、南蘇丹 2011 年。1960 年代最多（38 國，非洲的去殖民化），其次是 1970 年代 26 國、1940 年代 15 國、1910 年代 14 國（第一次世界大戰後）、1990 年代 14 國（蘇聯與南斯拉夫解體），1820 年代 12 國（拉丁美洲）。${NOTE.zh}`,
        en: `The year marked by the independence day (the first listed where there are several). The earliest are Switzerland 1291, Sweden 1523, the Maldives 1573, Portugal 1640 and the US 1776, and the latest Kosovo 2008 and South Sudan 2011. The 1960s have the most (38 countries, African decolonisation), followed by the 1970s with 26, the 1940s 15, the 1910s 14 (after the First World War), the 1990s 14 (the break-up of the Soviet Union and Yugoslavia) and the 1820s 12 (Latin America). ${NOTE.en}`,
      },
      unit: { zh: '年', en: 'year' },
      file: 'year.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1800, 1900, 1945, 1960, 1970, 1990] } },
      format: (v) => tr({ zh: `${v} 年`, en: String(v) }),
      formatTick: (v) => String(v),
      integer: true,
      rankingBars: false,
    },
  ],
};
