import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, TopicDefinition } from './types';

const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const age = (v: number) => tr({ zh: `${fixed(v, 1)} 歲`, en: `${fixed(v, 1)} years` });
const ageTick = (v: number) => fixed(v, 0);
const rate = (v: number) => tr({ zh: `每千人 ${fixed(v, 1)} 對`, en: `${fixed(v, 1)} per 1,000` });
const rateTick = (v: number) => fixed(v, v % 1 ? 1 : 0);

/** 同性伴侶的法律地位（pipeline/sources/same_sex_unions.py）：有強弱之分，用循序色，第一類最深 */
const SAME_SEX: CategoryDef[] = [
  { value: 1, label: { zh: '同性婚姻', en: 'Same-sex marriage' } },
  { value: 2, label: { zh: '民事結合等其他全國性的承認', en: 'Civil unions or other national recognition' } },
  { value: 3, label: { zh: '沒有全國性的法律承認', en: 'No national legal recognition' } },
];
const sameSexLabel = (v: number) => tr(SAME_SEX.find((c) => c.value === v)?.label ?? '');

export const marriage: TopicDefinition = {
  id: 'marriage',
  title: { zh: '婚姻與家庭', en: 'Marriage and family' },
  shortTitle: { zh: '婚姻與家庭', en: 'Marriage' },
  defaultIndicator: 'age-women',
  defaultYear: 2024,
  sources: [
    {
      name: 'UN DESA Population Division, World Marriage Data 2019',
      url: 'https://www.un.org/development/desa/pd/data/world-marriage-data',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: 'UNdata，Demographic Statistics Database（聯合國統計司 Demographic Yearbook 的結婚、離婚對數）',
        en: 'UNdata, Demographic Statistics Database (UN Statistics Division, Demographic Yearbook marriages and divorces)',
      },
      url: 'https://data.un.org/Data.aspx?d=POP&f=tableCode%3a14',
      license: { zh: 'UNdata 使用條款（註明出處即可轉載）', en: 'UNdata terms of use (free to copy and redistribute with attribution)' },
    },
    {
      name: {
        zh: 'Eurostat（demo_nind、demo_ndivind、demo_find、lfst_hhnhtych）',
        en: 'Eurostat (demo_nind, demo_ndivind, demo_find, lfst_hhnhtych)',
      },
      url: 'https://ec.europa.eu/eurostat/web/population-demography/demography-population-stock-balance/database',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'OECD Family Database（SF2.4 非婚生子女、SF3.1 結婚與離婚）',
        en: 'OECD Family Database (SF2.4 births outside marriage, SF3.1 marriage and divorce rates)',
      },
      url: 'https://www.oecd.org/en/data/datasets/oecd-family-database.html',
      license: 'CC BY 4.0',
    },
    {
      name: 'United Nations, Database on Household Size and Composition 2022',
      url: 'https://www.un.org/development/desa/pd/data/household-size-and-composition',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: { zh: 'UN World Population Prospects 2024（加權與粗率的人口）', en: 'UN World Population Prospects 2024 (population for weights and crude rates)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: '內政部戶政司 人口統計資料（結婚、離婚、初婚年齡、婚姻狀況、非婚生）、內政部統計查詢網',
        en: 'Department of Household Registration, Ministry of the Interior (Taiwan): marriages, divorces, age at first marriage, marital status, births outside marriage',
      },
      url: 'https://www.ris.gov.tw/app/portal/346',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '主計總處 家庭收支調查', en: 'DGBAS (Taiwan), Survey of Family Income and Expenditure' },
      url: 'https://www.stat.gov.tw/News.aspx?n=3908&sms=11530',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: '英文維基百科「Same-sex marriage」「Civil union」與各國條目（同性伴侶的法律地位）',
        en: 'Wikipedia, “Same-sex marriage”, “Civil union” and country articles (legal status of same-sex couples)',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1381842102',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh:
      '初婚年齡在歐洲、其他 OECD 國家與台灣是依結婚登記的初婚者平均年齡（美國、澳洲、紐西蘭是中位數），其他國家是聯合國依普查或調查的未婚比例推算的單身平均結婚年齡（SMAM），兩種算法的數字相近但不完全相同；' +
      '聯合國的資料大多只到 2010 年代，地圖用每個國家 10 年內最近一年的值。有偶比例與 30–34 歲未婚比例用聯合國的各年齡組比例，以 WPP 的人口加權成男女合計，部分國家的「有偶」含同居。' +
      '粗結婚率、粗離婚率是一年的結婚（離婚）對數除以年中人口，受年齡結構影響；聯合國的對數只收 Demographic Yearbook 認為登記完整的國家，庫克群島、塞席爾等觀光結婚多的地方會特別高。' +
      '同性伴侶的法律地位依英文維基百科的條目自行整理（2026 年 10 月，CC BY-SA 4.0），是每年年底的狀態，各國的依據寫在側欄的附註；這個指標的資料檔也依 CC BY-SA 4.0 分享。',
    en:
      'Age at first marriage is the mean age of people marrying for the first time, from registrations, in Europe, other OECD countries and Taiwan (the median in the United States, Australia and New Zealand); elsewhere it is the UN’s singulate mean age at marriage (SMAM), estimated from the share never married in censuses and surveys, which gives similar but not identical figures. ' +
      'Most UN data end in the 2010s, so the map shows each country’s latest value within 10 years. The married and never-married shares use the UN’s age-specific figures weighted to both sexes with WPP population; in some countries “married” includes cohabiting couples. ' +
      'Crude marriage and divorce rates are marriages (divorces) in a year per 1,000 mid-year population, so they depend on age structure; UN counts are used only for countries whose registration the Demographic Yearbook considers complete, and places with many destination weddings, such as the Cook Islands and Seychelles, stand out. ' +
      'The legal status of same-sex couples is compiled from Wikipedia articles (October 2026, CC BY-SA 4.0) and shows the situation at the end of each year, with the legal basis for each country in the panel notes; the data file of this indicator is shared under CC BY-SA 4.0 as well.',
  },
  panelExtra: () => import('./panels/MarriagePanel'),
  indicators: [
    {
      id: 'age-women',
      label: { zh: '女性初婚年齡', en: 'Age at first marriage, women' },
      description: {
        zh: '女性第一次結婚的平均年齡。歐洲、OECD 國家與台灣依結婚登記，其他國家是聯合國依普查推算的 SMAM。',
        en: 'Mean age of women at their first marriage: from registrations in Europe, OECD countries and Taiwan, and the UN’s census-based SMAM elsewhere.',
      },
      unit: { zh: '歲', en: 'years' },
      file: 'age-women.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [21, 23, 25, 27, 29, 31] } },
      format: age,
      formatTick: ageTick,
      unranked: true,
    },
    {
      id: 'age-men',
      label: { zh: '男性初婚年齡', en: 'Age at first marriage, men' },
      description: {
        zh: '男性第一次結婚的平均年齡。歐洲、OECD 國家與台灣依結婚登記，其他國家是聯合國依普查推算的 SMAM。',
        en: 'Mean age of men at their first marriage: from registrations in Europe, OECD countries and Taiwan, and the UN’s census-based SMAM elsewhere.',
      },
      unit: { zh: '歲', en: 'years' },
      file: 'age-men.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [24, 26, 28, 30, 32, 34] } },
      format: age,
      formatTick: ageTick,
      unranked: true,
    },
    {
      id: 'married',
      label: { zh: '15 歲以上有偶比例', en: 'Married, ages 15+' },
      description: {
        zh: '15 歲以上人口中目前有配偶的比例（男女合計），不含離婚、喪偶與未婚；年輕人多的國家會比較高。',
        en: 'Share of people aged 15 and over who are currently married (both sexes), excluding the divorced, widowed and never married; it tends to be lower where the population is young.',
      },
      unit: '%',
      file: 'married.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [40, 45, 50, 55, 60, 65] } },
      format: pct,
      formatTick: pctTick,
      unranked: true,
    },
    {
      id: 'never-married',
      label: { zh: '30–34 歲未婚比例', en: 'Never married at 30–34' },
      description: {
        zh: '30–34 歲的人之中從來沒有結過婚的比例（男女合計），看得出晚婚、不婚的程度，不受年齡結構影響。',
        en: 'Share of people aged 30–34 who have never married (both sexes), a measure of later and less marriage that is not affected by age structure.',
      },
      unit: '%',
      file: 'never-married.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 30, 45, 60] } },
      format: pct,
      formatTick: pctTick,
      unranked: true,
    },
    {
      id: 'marriage-rate',
      label: { zh: '粗結婚率', en: 'Crude marriage rate' },
      description: {
        zh: '一年的結婚對數除以年中人口（每千人幾對）。台灣 2019 年起含同性婚姻。',
        en: 'Marriages in a year per 1,000 mid-year population. Taiwan includes same-sex marriages from 2019.',
      },
      unit: '‰',
      file: 'marriage-rate.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 4, 5, 6, 7, 9] } },
      format: rate,
      formatTick: rateTick,
      unranked: true,
    },
    {
      id: 'divorce-rate',
      label: { zh: '粗離婚率', en: 'Crude divorce rate' },
      description: {
        zh: '一年的離婚對數除以年中人口（每千人幾對）。法律上不能離婚、或離婚要經過法院的國家會比較低。',
        en: 'Divorces in a year per 1,000 mid-year population. It is lower where divorce is restricted or must go through the courts.',
      },
      unit: '‰',
      file: 'divorce-rate.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 1.5, 2, 2.5, 3] } },
      format: rate,
      formatTick: rateTick,
      unranked: true,
    },
    {
      id: 'births-outside',
      label: { zh: '非婚生子女比例', en: 'Births outside marriage' },
      description: {
        zh: '出生時母親沒有婚姻關係的嬰兒占所有出生數的比例，同居生子的也算。只有歐洲、OECD 國家與台灣有資料。',
        en: 'Share of births to mothers who are not married at the time, including those living with a partner. Europe, OECD countries and Taiwan only.',
      },
      unit: '%',
      file: 'births-outside.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 15, 30, 45, 60, 75] } },
      format: pct,
      formatTick: pctTick,
      unranked: true,
    },
    {
      id: 'one-person',
      label: { zh: '單人家戶比例', en: 'One-person households' },
      description: {
        zh: '只有一個人住的家戶占所有家戶的比例（不是人口的比例），來自普查與家戶調查。',
        en: 'Share of households with only one member (a share of households, not of people), from censuses and household surveys.',
      },
      unit: '%',
      file: 'one-person.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 40] } },
      format: pct,
      formatTick: pctTick,
      unranked: true,
    },
    {
      id: 'same-sex',
      label: { zh: '同性伴侶的法律地位', en: 'Same-sex unions' },
      description: {
        zh: '每年年底同性伴侶能不能結婚，或有沒有民事結合、伴侶登記等全國性的制度。台灣 2019 年起可以結婚，是亞洲第一個。',
        en: 'Whether same-sex couples could marry at the end of each year, or had civil unions, registered partnerships or other national recognition. Taiwan has allowed it since 2019, the first in Asia.',
      },
      unit: '',
      file: 'same-sex.json',
      layer: { kind: 'categorical', categories: SAME_SEX, ordinal: true },
      format: sameSexLabel,
    },
  ],
};
