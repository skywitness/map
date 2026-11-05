import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { IndicatorDef, SourceDef } from './types';

/**
 * 歐洲鐵路（2026-11-05，製作手冊第二十三批 407；pipeline/topics/rail_europe.py）：擴充「鐵路」。準點率、員工、競爭業者市占用
 * 歐盟執委會 RMMS 第 9 次報告，單雙線、高速比例用 Eurostat；使用者決定先只做歐洲，臺鐵的準點率放台灣的側欄。
 */
export const RAIL_PUNCTUAL = ['rail-punctual-long', 'rail-punctual-regional'];

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${fixed(v, 0)}%`;
const PUNCTUAL_NOTE = {
  zh: '「準點」的定義各國自己訂（誤點 5、10 或 15 分鐘以內，取消的班次算不算也不一樣），國家之間只能大略比較。',
  en: 'Each country defines “punctual” itself (within 5, 10 or 15 minutes, and cancelled trains may or may not count), so comparisons are only rough.',
};

export const railEurope: { sources: SourceDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: { zh: '歐盟執委會第 9 次鐵路市場監測報告（RMMS，2025 年；準點率、員工、競爭業者市占）', en: 'European Commission, 9th Rail Market Monitoring report (RMMS, 2025; punctuality, staff, competitors’ market share)' },
      url: 'https://transport.ec.europa.eu/transport-modes/rail/market/rail-market-monitoring-rmms_en',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Eurostat：依軌道數（rail_if_line_tr）與最高速度（rail_if_line_sp）的鐵路長度', en: 'Eurostat: railway lines by number of tracks (rail_if_line_tr) and maximum speed (rail_if_line_sp)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/rail_if_line_tr/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '臺灣鐵路公司「車種及線別準點率統計資料」（台灣的側欄）', en: 'Taiwan Railway Corporation, punctuality by train type and line (Taiwan’s side panel)' },
      url: 'https://data.gov.tw/dataset/146628',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  indicators: [
    {
      id: 'rail-punctual-long',
      label: { zh: '長途與高鐵列車準點率（歐洲）', en: 'Long-distance and high-speed train punctuality (Europe)' },
      description: {
        zh: `長途與高鐵客運列車準點的比例（RMMS，2018–2022 年，21 國）。2022 年荷蘭 88.0%、比利時 87.8%、保加利亞 86.7%、丹麥 85.1%、西班牙 84.3%、法國 84.2%；德國 53.6%、葡萄牙 53.4%、希臘 33.9%、羅馬尼亞 19.7%。2020、2021 年班次少，多數國家比較準。${PUNCTUAL_NOTE.zh}台灣沒有放進比較，臺鐵 2021-06 到 2022-10 的準點率列在台灣的側欄。`,
        en: `Share of long-distance and high-speed passenger trains on time (RMMS, 2018–2022, 21 countries). In 2022 the Netherlands 88.0%, Belgium 87.8%, Bulgaria 86.7%, Denmark 85.1%, Spain 84.3% and France 84.2%; Germany 53.6%, Portugal 53.4%, Greece 33.9% and Romania 19.7%. Fewer trains ran in 2020 and 2021, and most countries were more punctual. ${PUNCTUAL_NOTE.en} Taiwan is not compared; Taiwan Railway’s punctuality for June 2021–October 2022 is listed in Taiwan’s side panel.`,
      },
      unit: '%',
      file: 'rail-punctual-long.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 60, 70, 80, 85, 90] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'rail-punctual-regional',
      label: { zh: '區域與近郊列車準點率（歐洲）', en: 'Regional and suburban train punctuality (Europe)' },
      description: {
        zh: `區域與近郊客運列車準點的比例（RMMS，2018–2022 年，25 國）。2022 年拉脫維亞 98.9%、愛沙尼亞 97.3%、奧地利 96.1%、芬蘭 95.9% 最準；克羅埃西亞 76.6%、德國 76.2%、義大利 69.8%、羅馬尼亞 62.7% 最差。${PUNCTUAL_NOTE.zh}`,
        en: `Share of regional and suburban passenger trains on time (RMMS, 2018–2022, 25 countries). In 2022 Latvia 98.9%, Estonia 97.3%, Austria 96.1% and Finland 95.9% were the most punctual; Croatia 76.6%, Germany 76.2%, Italy 69.8% and Romania 62.7% the least. ${PUNCTUAL_NOTE.en}`,
      },
      unit: '%',
      file: 'rail-punctual-regional.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [70, 80, 85, 90, 93, 96] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'rail-double-track',
      label: { zh: '雙線以上鐵路的比例（歐洲）', en: 'Share of double-track railway (Europe)' },
      description: {
        zh: '鐵路路線裡有兩條以上軌道（上下行分開）的比例（Eurostat，1990 年起，取 5 年內最近一年）。比利時 81.2%、荷蘭 70.5%、法國 62.8% 最高，德國 47.9%、義大利 46.0%、波蘭 45.2%；芬蘭 12.1%、愛沙尼亞 9.4%、挪威 8.0% 大多是單線，阿爾巴尼亞、北馬其頓、蒙特內哥羅全是單線。單線鐵路要在車站會車，班次與準點都受限。',
        en: 'Share of railway lines with two or more tracks (Eurostat, from 1990; latest year within five). Belgium 81.2%, the Netherlands 70.5% and France 62.8% are highest; Germany 47.9%, Italy 46.0% and Poland 45.2%; Finland 12.1%, Estonia 9.4% and Norway 8.0% are mostly single-track, and Albania, North Macedonia and Montenegro entirely so. Single-track lines need trains to pass at stations, limiting frequency and punctuality.',
      },
      unit: '%',
      file: 'rail-double-track.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 65] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'rail-highspeed-share',
      label: { zh: '可跑高速的鐵路比例（歐洲）', en: 'Share of high-speed-capable railway (Europe)' },
      description: {
        zh: '鐵路路線裡專用高速線加上升級為高速的既有線（通常 200 km/h 以上）占幾成（Eurostat，各國自己歸類，取 5 年內最近一年）。法國 55.7%（專用高速線只有約 2,700 公里，但 1 萬多公里的既有線升級過）、西班牙 24.4%、土耳其 19.1%、芬蘭 18.8%、瑞典 15.8%；德國 7.0%、義大利 6.5%。跟「高鐵」主題的高鐵路網長度定義不同。',
        en: 'Share of railway lines that are dedicated high-speed lines or upgraded conventional lines (usually 200 km/h or more), as each country classifies them (Eurostat; latest year within five). France 55.7% (only about 2,700 km of dedicated lines, but over 10,000 km of upgraded ones), Spain 24.4%, Türkiye 19.1%, Finland 18.8% and Sweden 15.8%; Germany 7.0% and Italy 6.5%. The definition differs from the network length in the High-speed rail topic.',
      },
      unit: '%',
      file: 'rail-highspeed-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 6, 10, 20, 40] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'rail-employees',
      label: { zh: '鐵路業的員工（歐洲）', en: 'Railway employees (Europe)' },
      description: {
        zh: '鐵路基礎設施管理者與鐵路業者的員工合計（RMMS，2018 與 2022 年），圓的面積與它成正比。2022 年法國 264,021 人、德國 136,000、波蘭 91,581、義大利 72,214、羅馬尼亞 40,010；立陶宛從 2018 年的 10,610 人減到 5,074 人，德國反而從 126,500 人增加。',
        en: 'Employees of railway infrastructure managers and railway undertakings combined (RMMS, 2018 and 2022); circle area is proportional to it. In 2022 France had 264,021, Germany 136,000, Poland 91,581, Italy 72,214 and Romania 40,010; Lithuania fell from 10,610 in 2018 to 5,074, while Germany rose from 126,500.',
      },
      unit: { zh: '人', en: 'employees' },
      file: 'rail-employees.json',
      layer: { kind: 'bubble', legendValues: [5000, 50000, 200000] },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 人`, en: `${formatLargeNumber(v)} employees` }),
      formatTick: formatLargeTick,
    },
    {
      id: 'rail-competition-freight',
      label: { zh: '鐵路貨運的競爭業者市占（歐洲）', en: 'Competitors’ share of rail freight (Europe)' },
      description: {
        zh: '鐵路貨運（延噸公里）裡不是原本國營業者的公司占幾成，看市場開放的程度（RMMS，2022 年）。義大利 63.0%、德國 59.7%、保加利亞 59.3%、波蘭 55.7%、匈牙利 55.3%、荷蘭 53.0%；希臘 4.6%、芬蘭 4.0%、愛沙尼亞 3.1%、立陶宛 0.6% 幾乎沒有競爭。',
        en: 'Share of rail freight (tonne-km) carried by companies other than the incumbent, a gauge of market opening (RMMS, 2022). Italy 63.0%, Germany 59.7%, Bulgaria 59.3%, Poland 55.7%, Hungary 55.3% and the Netherlands 53.0%; Greece 4.6%, Finland 4.0%, Estonia 3.1% and Lithuania 0.6% have almost none.',
      },
      unit: '%',
      file: 'rail-competition-freight.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 20, 35, 45, 55] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'rail-competition-passenger',
      label: { zh: '商業客運的競爭業者市占（歐洲）', en: 'Competitors’ share of commercial rail passenger services (Europe)' },
      description: {
        zh: '不靠政府補貼合約的商業鐵路客運（延人公里）裡，不是原本國營業者的公司占幾成（RMMS，2022 年，12 國）。愛爾蘭 100%、斯洛伐克 97.2%、捷克 64.0%、匈牙利 63.3%、比利時 60.6%、義大利 45.6%（Italo 的高鐵）；德國只有 4.3%、法國 3.7%。',
        en: 'Share of commercial passenger rail (passenger-km, not under public service contracts) run by companies other than the incumbent (RMMS, 2022, 12 countries). Ireland 100%, Slovakia 97.2%, Czechia 64.0%, Hungary 63.3%, Belgium 60.6% and Italy 45.6% (Italo’s high-speed trains); Germany only 4.3% and France 3.7%.',
      },
      unit: '%',
      file: 'rail-competition-passenger.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 20, 40, 60, 90] } },
      format: pct,
      formatTick: pctTick,
    },
  ],
};
