import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

/**
 * 法定退休年齡與退休後的日子（2026-11-04，製作手冊第二十一批 346；pipeline/topics/retirement.py）：
 * OECD Pensions at a Glance：現在與未來的退休年齡（2024 年）、實際退出勞動市場的年齡與之後的預期年數（1970 年起），分男女。
 * 台灣依勞工保險條例第 58 條的老年年金請領年齡補上。
 */

const SEX_OPTIONS = [
  { id: 'men', label: { zh: '男性', en: 'Men' } },
  { id: 'women', label: { zh: '女性', en: 'Women' } },
];
const SEX = { label: { zh: '性別', en: 'Sex' }, options: SEX_OPTIONS, defaultOption: 'men' };
const age = (v: number) => tr({ zh: `${fixed(v, 1).replace(/\.0$/, '')} 歲`, en: `${fixed(v, 1).replace(/\.0$/, '')} years` });
const years = (v: number) => tr({ zh: `${fixed(v, 1)} 年`, en: `${fixed(v, 1)} years` });

const indicator = (
  id: string,
  label: IndicatorDef['label'],
  description: IndicatorDef['description'],
  thresholds: number[],
  unit: IndicatorDef['unit'],
  format: (v: number) => string,
): IndicatorDef => ({
  id,
  label,
  description,
  unit,
  file: `${id}-{item}.json`,
  dimension: SEX,
  layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
  format,
  formatTick: (v) => `${v}`,
});

export const retirement: TopicDefinition = {
  id: 'retirement',
  title: { zh: '退休年齡與退休後的日子', en: 'Retirement age and life after work' },
  shortTitle: { zh: '退休', en: 'Retirement' },
  defaultIndicator: 'retirement-age',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'OECD Pensions at a Glance 的資料庫（退休年齡、實際退出勞動市場的年齡）', en: 'OECD Pensions at a Glance database (retirement ages, effective labour market exit age)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_PAG%40DF_DPS&df[ag]=OECD.ELS.SPD',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '全國法規資料庫：勞工保險條例第 58 條、勞動基準法第 54 條（台灣）', en: 'Laws & Regulations Database of Taiwan: Labour Insurance Act Art. 58, Labour Standards Act Art. 54' },
      url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001',
      license: { zh: '法律條文不是著作權的標的（著作權法第 9 條）', en: 'Statutes are not subject to copyright (Copyright Act, Article 9)' },
    },
  ],
  note: {
    zh: 'OECD 的「退休年齡」是一個假設下的數字：22 歲開始工作、職涯不中斷的人，可以領全額年金的年齡，不是各國法條寫的年齡，也不是最早可以退休的年齡；沙烏地阿拉伯 47 歲、土耳其 52 歲這種低值，是因為那些制度看繳費年數，不是年齡。「未來的退休年齡」是今天 22 歲開始工作的人依現行法律的退休年齡，各國修法就會變（例如丹麥連動平均壽命）。實際退出勞動市場的年齡與之後的預期年數是 OECD 用勞動力調查估算的，有些國家的最近一年比較舊（滑過國家看年份）。台灣不在 OECD 的資料裡，用勞工保險條例第 58 條：保險年資滿 15 年可以請領老年年金的年齡，2018 年起從 60 歲逐步提高，2024 年 64 歲、2026 年起 65 歲；勞動基準法第 54 條的 65 歲是雇主可以強制退休的年齡。台灣沒有可比的實際退出年齡。',
    en: 'The OECD “retirement age” is a hypothetical figure: the age at which someone who started work at 22 with an uninterrupted career can draw a full pension, not the age written in each country’s law nor the earliest age at which one can retire. Low values such as Saudi Arabia’s 47 and Türkiye’s 52 arise because those systems depend on years of contributions, not age. The “future retirement age” is the retirement age under current law for someone starting work at 22 today, and it changes whenever countries reform (Denmark, for example, links it to life expectancy). The effective labour market exit age and the expected years after exit are OECD estimates from labour force surveys; for some countries the latest year is older (hover to see the year). Taiwan is not in the OECD data, so it uses Art. 58 of the Labour Insurance Act: the age at which an old-age pension can be claimed with 15 years of contributions, raised gradually from 60 from 2018 to 64 in 2024 and 65 from 2026; the 65 in Art. 54 of the Labour Standards Act is the age at which employers may require retirement. Taiwan has no comparable effective exit age.',
  },
  indicators: [
    indicator(
      'retirement-age',
      { zh: '現在的退休年齡', en: 'Current retirement age' },
      {
        zh: '2024 年，22 歲開始工作、職涯不中斷的人可以領全額年金的年齡。丹麥、冰島、以色列、荷蘭、挪威、澳洲 67 歲最高，美國 66.7、德國 66.2、英國 66、日本 65、法國 64.3、南韓 63、中國 60（女性 55）、印度 58；沙烏地 47、土耳其 52（女性 49）最低。台灣依勞工保險條例是 64 歲（2026 年起 65 歲）。OECD 平均男性 64.7、女性 63.9 歲。切換男女看差別。',
        en: 'The age in 2024 at which someone who started work at 22 with an uninterrupted career can draw a full pension. Denmark, Iceland, Israel, the Netherlands, Norway and Australia are highest at 67, the US 66.7, Germany 66.2, the UK 66, Japan 65, France 64.3, South Korea 63, China 60 (55 for women) and India 58; Saudi Arabia 47 and Türkiye 52 (49 for women) are lowest. Taiwan is 64 under the Labour Insurance Act (65 from 2026). The OECD average is 64.7 for men and 63.9 for women. Switch between men and women to compare.',
      },
      [58, 60, 62, 64, 66, 67],
      { zh: '歲', en: 'years' },
      age,
    ),
    indicator(
      'future-retirement-age',
      { zh: '未來的退休年齡', en: 'Future retirement age' },
      {
        zh: '今天 22 歲開始工作的人，依現行法律可以領全額年金的年齡。丹麥 74 歲最高（連動平均壽命），愛沙尼亞 71、荷蘭、瑞典、義大利 70，英國 68，美國、德國 67，日本、南韓、法國、台灣 65；中國 63（女性 58）、印度 58。OECD 平均男性 66.4 歲。',
        en: 'The full-pension age under current law for someone starting work at 22 today. Denmark is highest at 74 (linked to life expectancy), Estonia 71, the Netherlands, Sweden and Italy 70, the UK 68, the US and Germany 67, Japan, South Korea, France and Taiwan 65; China 63 (58 for women) and India 58. The OECD average for men is 66.4.',
      },
      [60, 63, 65, 67, 68, 70],
      { zh: '歲', en: 'years' },
      age,
    ),
    indicator(
      'exit-age',
      { zh: '實際退出勞動市場的年齡', en: 'Effective labour market exit age' },
      {
        zh: '實際上平均幾歲離開勞動市場（OECD 用勞動力調查估算，1970 年起）。2024 年男性：南非 54.1、巴西 55.8、印度 56.1 最早，法國 61.9、英國 63.8、德國 64.2，日本 66.9、美國 67.3、南韓 67.4，智利 69.0、印尼 69.8 最晚；南韓女性 69.6 歲。很多國家比法定退休年齡晚（日本、南韓），也有很多早（法國）。台灣沒有可比的數字。',
        en: 'The average age at which people actually leave the labour force (OECD estimates from labour force surveys, from 1970). For men in 2024: South Africa 54.1, Brazil 55.8 and India 56.1 are earliest; France 61.9, the UK 63.8, Germany 64.2, Japan 66.9, the US 67.3, South Korea 67.4; Chile 69.0 and Indonesia 69.8 are latest. South Korean women leave at 69.6. Many countries exit later than the pension age (Japan, South Korea), others earlier (France). No comparable figure for Taiwan.',
      },
      [58, 60, 62, 64, 66, 68],
      { zh: '歲', en: 'years' },
      age,
    ),
    indicator(
      'years-after-exit',
      { zh: '退出勞動市場後的預期年數', en: 'Expected years after labour market exit' },
      {
        zh: '從實際退出勞動市場的年齡算起，平均還可以活幾年。2024 年男性：盧森堡 23.2、法國 22.5、西班牙 21.7 年最長，日本 18.6、南韓 17.3、美國 17.0 年；女性多 3–5 年（法國 26.1 年）。退得早、活得久的國家退休後的日子長。',
        en: 'Average remaining life expectancy at the effective exit age. For men in 2024: Luxembourg 23.2, France 22.5 and Spain 21.7 years are longest, Japan 18.6, South Korea 17.3 and the US 17.0; women live 3–5 years longer (France 26.1). Countries where people leave early and live long have the longest retirements.',
      },
      [15, 17, 19, 21, 23, 25],
      { zh: '年', en: 'years' },
      years,
    ),
  ],
};
