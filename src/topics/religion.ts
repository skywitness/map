import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { religionExtra } from './religion-extra';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 宗教：Pew Research Center 2010、2020 年的宗教組成。
 * Pew 的條款只允許發布摘錄，所以沒有七大類各自的比例（見 pipeline/sources/pew.py 與 DESIGN.md）。
 */

/** 主要宗教的類別代碼（跟 pipeline/topics/religion.py 的 CODES 一致） */
const RELIGIONS: CategoryDef[] = [
  { value: 1, label: { zh: '基督宗教', en: 'Christian' } },
  { value: 2, label: { zh: '伊斯蘭教', en: 'Muslim' } },
  { value: 3, label: { zh: '無宗教信仰', en: 'Religiously unaffiliated' } },
  { value: 4, label: { zh: '印度教', en: 'Hindu' } },
  { value: 5, label: { zh: '佛教', en: 'Buddhist' } },
  { value: 6, label: { zh: '猶太教', en: 'Jewish' } },
  { value: 7, label: { zh: '其他宗教（民間信仰、道教等）', en: 'Other religions (folk religions, Taoism, etc.)' } },
];
const religionLabel = (v: number) => tr(RELIGIONS.find((r) => r.value === v)?.label ?? '');

/** 2026-11-07（製作手冊 553）：OSM 禮拜場所的宗教（pipeline/topics/worship.py 的 GROUPS） */
const WORSHIP: CategoryDef[] = [
  { value: 1, label: { zh: '基督宗教', en: 'Christian' } },
  { value: 2, label: { zh: '伊斯蘭', en: 'Muslim' } },
  { value: 3, label: { zh: '佛教', en: 'Buddhist' } },
  { value: 4, label: { zh: '印度教', en: 'Hindu' } },
  { value: 5, label: { zh: '神道', en: 'Shinto' } },
  { value: 6, label: { zh: '道教與民間信仰', en: 'Taoist and folk' } },
  { value: 7, label: { zh: '猶太教', en: 'Jewish' } },
  { value: 8, label: { zh: '其他', en: 'Other' } },
];
const OSM_NOTE = {
  zh: '資料是 OpenStreetMap 標成禮拜場所（amenity=place_of_worship）的地點，經 QLever 依國界計數；包括已經不用的建築，也同時在量 OpenStreetMap 畫得多完整。',
  en: 'Data are places tagged as places of worship (amenity=place_of_worship) on OpenStreetMap, counted by country via QLever; disused buildings are included, and the counts also reflect how completely OpenStreetMap is mapped.',
};
const pct = (v: number) => `${fixed(v, v < 10 ? 1 : 0)}%`;

const DISCLAIMER = 'Pew Research Center bears no responsibility for the analyses or interpretations of the data presented here.';

export const religion: TopicDefinition = {
  id: 'religion',
  title: { zh: '各國宗教', en: 'Religion by country' },
  shortTitle: { zh: '宗教', en: 'Religion' },
  defaultIndicator: 'main',
  defaultYear: 2020,
  sources: [
    {
      name: { zh: 'OpenStreetMap 的禮拜場所（amenity=place_of_worship），經 QLever', en: 'OpenStreetMap places of worship (amenity=place_of_worship), via QLever' },
      url: 'https://www.openstreetmap.org/copyright',
      license: { zh: 'ODbL 1.0（© OpenStreetMap contributors）', en: 'ODbL 1.0 (© OpenStreetMap contributors)' },
    },
    {
      name: {
        zh: 'Pew Research Center, Religious Composition 2010–2020（摘錄）',
        en: 'Pew Research Center, Religious Composition 2010–2020 (excerpts)',
      },
      url: 'https://www.pewresearch.org/religion/feature/religious-composition-by-country-2010-2020/',
      license: { zh: 'Pew 使用條款（只限摘錄）', en: 'Pew terms of use (excerpts only)' },
    },
    {
      name: { zh: '內政部宗教統計（寺廟、教會登記）', en: 'Ministry of the Interior (Taiwan), religious statistics' },
      url: 'https://statis.moi.gov.tw/micst/webMain.aspx?sys=100&funid=defjsp',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    ...religionExtra.sources,
  ],
  overlays: religionExtra.overlays,
  listPanel: religionExtra.listPanel,
  note: {
    zh:
      'Pew 依 2,700 多份普查與調查估計 201 個國家與地區的宗教組成，分成基督宗教（天主教、基督新教、東正教等）、伊斯蘭教、無宗教信仰、印度教、佛教、猶太教與其他宗教（民間信仰、道教、神道教、錫克教、巴哈伊教等）七大類，只有 2010、2020 兩年。' +
      'Pew 的使用條款只允許發布摘錄，所以這裡只有主要宗教、它的比例、無宗教信仰比例與多樣性指數，沒有每一種宗教各自的比例。' +
      DISCLAIMER,
    en:
      'Pew estimates the religious composition of 201 countries and territories from more than 2,700 censuses and surveys, in seven groups: Christians (Catholic, Protestant, Orthodox, etc.), Muslims, the religiously unaffiliated, Hindus, Buddhists, Jews and other religions (folk religions, Taoism, Shinto, Sikhism, the Baha’i faith, etc.), for 2010 and 2020 only. ' +
      "Pew's terms of use allow publishing excerpts only, so this page shows the largest group, its share, the unaffiliated share and the diversity index, not the share of every group. " +
      DISCLAIMER,
  },
  indicators: [
    {
      id: 'main',
      label: { zh: '主要宗教', en: 'Largest religious group' },
      description: {
        zh: '人數最多的宗教類別。滑過或點選圖例可以只看某一種宗教。',
        en: 'The religious group with the most adherents. Hover over or click the legend to show a single group.',
      },
      unit: '',
      file: 'main.json',
      layer: { kind: 'categorical', categories: RELIGIONS },
      format: religionLabel,
    },
    {
      id: 'main-share',
      label: { zh: '主要宗教的人口比例', en: 'Share of the largest group' },
      description: {
        zh: '人數最多的宗教占總人口的比例。比例越低，代表沒有一種宗教占多數。',
        en: 'Share of the population belonging to the largest religious group. The lower it is, the less any single group dominates.',
      },
      unit: '%',
      file: 'main-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [40, 50, 60, 70, 80, 90] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
    {
      id: 'unaffiliated',
      label: { zh: '無宗教信仰比例', en: 'Religiously unaffiliated' },
      description: {
        zh: '不認同任何宗教的人（無神論者、不可知論者，以及沒有特定宗教的人）占總人口的比例。',
        en: 'Share of people who do not identify with any religion (atheists, agnostics and those with no particular religion).',
      },
      unit: '%',
      file: 'unaffiliated.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 35, 50] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
      compareWorld: true,
    },
    {
      id: 'diversity',
      label: { zh: '宗教多樣性指數', en: 'Religious Diversity Index' },
      description: {
        zh: 'Pew 的宗教多樣性指數，0–10：七大類各占七分之一是 10，全國只有一種宗教是 0。新加坡、蘇利南、台灣都很高。',
        en: "Pew's Religious Diversity Index, 0–10: 10 when each of the seven groups makes up one-seventh of the population, 0 when everyone belongs to one group. Singapore, Suriname and Taiwan score very high.",
      },
      unit: '',
      file: 'diversity.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 4, 5.5, 7] } },
      format: (v) => fixed(v, 1),
      formatTick: (v) => fixed(v, v % 1 ? 1 : 0),
      compareWorld: true,
    },
    // 2026-11-07（製作手冊第二十七批 553，候選 1246、1247）：禮拜場所（pipeline/topics/worship.py）
    {
      id: 'worship-density',
      label: { zh: '每十萬人幾座禮拜場所', en: 'Places of worship per 100,000 people' },
      description: {
        zh: `${OSM_NOTE.zh}照網站的規則只替 OpenStreetMap 覆蓋良好的 93 國上色（用餐飲店對餐飲業就業人數判斷），人口是聯合國 WPP 2024。希臘每十萬人 283 座最多（到處是小教堂），奧地利 167、克羅埃西亞 141、斯洛伐克 138、斯洛維尼亞 135、葡萄牙 131、義大利 117；法國 92、德國 86、美國 78、日本 64、台灣 63（14,547 座）、英國 60、新加坡 11。全世界 OpenStreetMap 上約 162 萬座：美國 27.3 萬、印尼 9.0 萬、日本 7.9 萬、印度 7.2 萬、德國 7.2 萬。`,
        en: `${OSM_NOTE.en} Following the site’s rule, only the 93 countries where OpenStreetMap is well mapped are coloured (judged by food and drink places against food-service employment); population is from UN WPP 2024. Greece has the most at 283 per 100,000 (chapels everywhere), followed by Austria 167, Croatia 141, Slovakia 138, Slovenia 135, Portugal 131 and Italy 117; France 92, Germany 86, the US 78, Japan 64, Taiwan 63 (14,547 places), the UK 60 and Singapore 11. OpenStreetMap has about 1.62 million worldwide: 273,000 in the US, 90,000 in Indonesia, 79,000 in Japan and 72,000 each in India and Germany.`,
      },
      unit: { zh: '座／十萬人', en: 'per 100,000' },
      file: 'worship-density.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 75, 100, 150] } },
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, 0)} 座`, en: `${fixed(v, 0)} per 100,000` }),
      formatTick: (v) => fixed(v, 0),
      timeless: true,
    },
    {
      id: 'worship-main',
      label: { zh: '禮拜場所最多的宗教', en: 'Most common religion of places of worship' },
      description: {
        zh: `${OSM_NOTE.zh}只看有標宗教（religion）的場所，有標的不到 100 座或不到一半的國家不畫；174 國有值。這是場所的數目，不是信徒的人數：小廟多的宗教會比較多。基督宗教 116 國、伊斯蘭 44 國；佛教 9 國（中國大陸、泰國、緬甸、越南、柬埔寨、寮國、斯里蘭卡、不丹、蒙古），印度教是印度與尼泊爾，神道是日本（55%，佛教 41%），猶太教是以色列（82%）。台灣有標宗教的 8,517 座裡道教與民間信仰占 68%（道教 5,282、華人民間信仰 472），基督宗教 16%、佛教 15%：道教的宮廟是基督宗教的 4 倍，跟信徒的比例不同。滑過看前三名的比例。`,
        en: `${OSM_NOTE.en} Only places with a religion tag are counted, and countries with fewer than 100 tagged places or under half tagged are not shown; 174 countries have a value. These are numbers of places, not of believers, so religions with many small shrines count for more. Christianity leads in 116 countries and Islam in 44; Buddhism in 9 (mainland China, Thailand, Myanmar, Vietnam, Cambodia, Laos, Sri Lanka, Bhutan and Mongolia), Hinduism in India and Nepal, Shinto in Japan (55%, with Buddhism 41%) and Judaism in Israel (82%). Of Taiwan’s 8,517 tagged places, 68% are Taoist or folk temples (5,282 Taoist and 472 Chinese folk), 16% Christian and 15% Buddhist: Taoist temples outnumber churches four to one, unlike the shares of believers. Hover for the top three shares.`,
      },
      unit: '',
      file: 'worship-main.json',
      layer: { kind: 'categorical', categories: WORSHIP },
      format: (v) => tr(WORSHIP.find((r) => r.value === v)?.label ?? ''),
      timeless: true,
    },
    ...religionExtra.indicators,
  ],
};
