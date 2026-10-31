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
    ...religionExtra.indicators,
  ],
};
