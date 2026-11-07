import { tr, type Text } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { FlowLabels, FlowLayer, IndicatorDef, TopicDefinition } from './types';

/**
 * 科學家往哪裡去：科研人力的國際流動（新主題，2026-11-07，製作手冊第二十七批 600，候選 1325；科技・研發與創新）：
 * OECD 從 Scopus 論文掛名推估的科學作者雙邊流動，pipeline/topics/scientist_mobility.py。只有 2010–2024 一期，指標都是 timeless；
 * 流向沿用 src/map/flows.ts，側欄 panels/ScientistMobilityPanel.tsx 是流入、流出與淨流入的數字和前幾個來源、去向。
 */
const PEOPLE: Text = { zh: '人', en: 'people' };
const people = (v: number) => tr({ zh: `${fixed(v, 0)} 人`, en: `${fixed(v, 0)} people` });
const signed = (v: number) => tr({ zh: `${v > 0 ? '+' : ''}${fixed(v, 0)} 人`, en: `${v > 0 ? '+' : ''}${fixed(v, 0)} people` });
const signedTick = (v: number) => `${v > 0 ? '+' : ''}${formatLargeTick(v)}`;

export const NOTE: Text = {
  zh: '「流動」是 OECD 從 Scopus 論文的作者掛名推出來的：2010–2024 年至少有兩篇論文的作者，第一篇與最後一篇掛名的國家不同就算一人，中間待過的國家不算，所以是人數不是人次。在國外讀博士時發表論文、之後回國工作的人，算成流入母國；換機構不一定是搬家，跨國的兼任也可能被算成流動。Scopus 收錄以英文期刊為主，只用本國語言發表的研究者算不到；不到 10 人的雙邊流動不公布。',
  en: '“Moves” are inferred by the OECD from author affiliations in Scopus: authors with at least two papers in 2010–2024 whose first and last papers list different countries count once, ignoring countries in between, so these are people, not trips. Someone who published during a PhD abroad and then went home to work counts as a move into their home country; a change of affiliation is not always a move, and cross-border joint appointments can be counted as one. Scopus mostly indexes English-language journals, so researchers who publish only in their own language are missed; bilateral flows under 10 people are not published.',
};

const LABELS: Record<'export' | 'import', FlowLabels> = {
  import: {
    partners: { zh: '科學家從哪裡來', en: 'where its incoming scientists came from' },
    main: { zh: '流入的科學家從哪裡來', en: 'Where incoming scientists came from' },
    verb: (origin, partner) => tr({ zh: `從${partner}移到${origin}的科學作者`, en: `Scientific authors who moved from ${partner} to ${origin}` }),
  },
  export: {
    partners: { zh: '科學家去了哪裡', en: 'where its scientists went' },
    main: { zh: '流出的科學家去了哪裡', en: 'Where departing scientists went' },
    verb: (origin, partner) => tr({ zh: `從${origin}移到${partner}的科學作者`, en: `Scientific authors who moved from ${origin} to ${partner}` }),
  },
};
const LEGEND_KEY: Text = { zh: '由原本的國家（淺）到後來的國家（深）', en: 'From the earlier country (light) to the later one (dark)' };

function flow(id: string, label: Text, description: Text, file: string, direction: FlowLayer['direction']): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: PEOPLE,
    file,
    layer: { kind: 'flow', file: 'flows.json', direction, labels: LABELS, legendKey: LEGEND_KEY },
    format: people,
    formatTick: formatLargeTick,
    integer: true,
    timeless: true,
  };
}

export const scientistMobility: TopicDefinition = {
  id: 'scientist-mobility',
  title: { zh: '科學家往哪裡去：科研人力的國際流動', en: 'Where scientists go: international mobility of researchers' },
  shortTitle: { zh: '科學家的流動', en: 'Scientist mobility' },
  defaultIndicator: 'scientists-net',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'OECD：Bibliometric indicators of implied bilateral mobility flows（DF_BIBLIO_F；OECD 依 Elsevier 的 Scopus Custom Data 1.2026 計算）',
        en: 'OECD: Bibliometric indicators of implied bilateral mobility flows (DF_BIBLIO_F; OECD calculations based on Elsevier’s Scopus Custom Data, version 1.2026)',
      },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_BIBLIO_F%40DF_BIBLIO_F&df[ag]=OECD.STI.STP',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: `科學作者在國家之間的移動，2010–2024 年累計（只有這一期，沒有時間軸）：219 個來源、222 個目的地，6,797 條雙邊流動。跟「學術論文」主題的合著國家不同，那是一起寫論文，這裡是人換了國家。${NOTE.zh}`,
    en: `Moves of scientific authors between countries, accumulated over 2010–2024 (a single period, so there is no timeline): 219 origins, 222 destinations and 6,797 bilateral flows. Unlike co-authorship in the Publications topic, which is about writing papers together, this is about people changing country. ${NOTE.en}`,
  },
  panelExtra: () => import('./panels/ScientistMobilityPanel'),
  indicators: [
    {
      id: 'scientists-net',
      label: { zh: '科學家的淨流入', en: 'Net inflow of scientists' },
      description: {
        zh: `流入的科學作者減去流出的（2010–2024 年）。淨流入：美國 +45,977 人最多，瑞士 +12,700、沙烏地 +10,205、加拿大 +6,615、瑞典 +6,043、澳洲 +5,899、德國 +5,659、挪威 +5,006。淨流出：印度 −30,866 人最多，伊朗 −22,045、義大利 −11,810、巴西 −10,557、法國 −7,369、西班牙 −6,797、馬來西亞 −6,674、英國 −5,580。台灣流入 18,381 人、流出 20,831 人，淨流出 2,450 人。點國家看前幾個來源與去向。${NOTE.zh}`,
        en: `Scientific authors moving in minus those moving out (2010–2024). Net gains: the US leads with +45,977, then Switzerland +12,700, Saudi Arabia +10,205, Canada +6,615, Sweden +6,043, Australia +5,899, Germany +5,659 and Norway +5,006. Net losses: India −30,866, Iran −22,045, Italy −11,810, Brazil −10,557, France −7,369, Spain −6,797, Malaysia −6,674 and the UK −5,580. Taiwan gained 18,381 and lost 20,831, a net loss of 2,450. Click a country for its main origins and destinations. ${NOTE.en}`,
      },
      unit: PEOPLE,
      file: 'net.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-10000, -3000, -500, 500, 3000, 10000] } },
      format: signed,
      formatTick: signedTick,
      integer: true,
      timeless: true,
    },
    {
      id: 'scientists-balance',
      label: { zh: '淨流入占進出的比例', en: 'Net inflow as a share of all moves' },
      description: {
        zh: `淨流入 ÷（流入＋流出），正的是來的比走的多，進出至少 1,000 人的國家才算。伊拉克 +33.4% 最高，利比亞 +27.8%、剛果民主共和國 +27.1%、阿聯 +23.1%、阿曼 +22.1%；伊朗 −42.9% 最低，古巴 −27.8%、委內瑞拉 −27.2%、烏克蘭 −22.2%、印度 −21.9%。瑞士 +9.7%、美國 +4.9%、中國 +1.1%、英國 −1.3%、日本 −4.1%、台灣 −6.2%。${NOTE.zh}`,
        en: `Net inflow divided by all moves in and out; positive means more arrived than left. Only countries with at least 1,000 moves are shown. Iraq is highest at +33.4%, then Libya +27.8%, DR Congo +27.1%, the UAE +23.1% and Oman +22.1%; Iran is lowest at −42.9%, then Cuba −27.8%, Venezuela −27.2%, Ukraine −22.2% and India −21.9%. Switzerland +9.7%, the US +4.9%, China +1.1%, the UK −1.3%, Japan −4.1% and Taiwan −6.2%. ${NOTE.en}`,
      },
      unit: '%',
      file: 'balance.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-20, -10, -3, 3, 10, 20] } },
      format: (v) => `${v > 0 ? '+' : ''}${fixed(v, 1)}%`,
      formatTick: (v) => `${v > 0 ? '+' : ''}${fixed(v, 0)}%`,
      timeless: true,
      missing: { zh: '進出不到 1,000 人', en: 'Fewer than 1,000 moves' },
    },
    flow(
      'scientists-in',
      { zh: '流向：流入的科學家從哪裡來', en: 'Flows: where incoming scientists came from' },
      {
        zh: `移入這個國家的科學作者（2010–2024 年），點選國家畫出前 15 個來源。美國約 49.4 萬人最多，英國 21.0 萬、中國 19.4 萬、德國 15.7 萬；台灣 18,381 人，從美國 5,535、中國 4,406、印度 1,323、日本 1,026 最多。最大的幾條：中國→美國 66,146 人、美國→中國 65,423、英國→美國 44,786、美國→英國 42,720、加拿大→美國 40,610。${NOTE.zh}`,
        en: `Scientific authors who moved into the country (2010–2024); click a country to draw its top 15 origins. The US received the most (about 494,000), then the UK 210,000, China 194,000 and Germany 157,000; Taiwan received 18,381, mostly from the US (5,535), China (4,406), India (1,323) and Japan (1,026). The largest flows: China→US 66,146, US→China 65,423, UK→US 44,786, US→UK 42,720 and Canada→US 40,610. ${NOTE.en}`,
      },
      'inflow.json',
      'import',
    ),
    flow(
      'scientists-out',
      { zh: '流向：流出的科學家去了哪裡', en: 'Flows: where departing scientists went' },
      {
        zh: `從這個國家移出的科學作者（2010–2024 年），點選國家畫出前 15 個去向。美國約 44.8 萬人最多，英國 21.6 萬、中國 19.0 萬、德國 15.2 萬、法國 12.2 萬；台灣 20,831 人，到美國 6,224、中國 5,546、日本 1,172、印尼 917 最多。${NOTE.zh}`,
        en: `Scientific authors who moved out of the country (2010–2024); click a country to draw its top 15 destinations. The most left the US (about 448,000), then the UK 216,000, China 190,000, Germany 152,000 and France 122,000; 20,831 left Taiwan, mostly for the US (6,224), China (5,546), Japan (1,172) and Indonesia (917). ${NOTE.en}`,
      },
      'outflow.json',
      'export',
    ),
  ],
};
