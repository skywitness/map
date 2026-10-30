import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointRecord, TopicDefinition } from './types';

/**
 * F1 賽道與冠軍（pipeline/topics/f1.py，Jolpica-F1）：賽道畫成點（大小是舉辦的分站數，依第一站的年份出現），
 * 國家的值是累計舉辦的分站數（依賽道所在的國家）與車手冠軍數（依車手登記的國籍）。
 * Jolpica 的資料是 CC BY-NC-SA 4.0：只准非商業，頁尾寫明（使用者 2026-10-30 決定）。
 */

const n0 = (v: number) => fixed(v, 0);
export const racesText = (v: number) => tr({ zh: `${n0(v)} 站`, en: `${n0(v)} ${Math.round(v) === 1 ? 'race' : 'races'}` });
export const titlesText = (v: number) => tr({ zh: `${n0(v)} 次`, en: `${n0(v)} ${Math.round(v) === 1 ? 'title' : 'titles'}` });

function circuitTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const span = p.first === p.last ? String(p.first) : `${p.first}–${p.last}`;
  return {
    title: String(p.name ?? ''),
    detail: [String(p.loc ?? ''), typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : ''].filter(Boolean).join(' · '),
    extra: [tr({ zh: `辦過 ${n0(Number(p.n))} 站（${span}）`, en: `${racesText(Number(p.n))} (${span})` })],
  };
}

/** 賽車主題（racing.ts）的 F1 部分：2026-10-30（第七批 121）跟奧運合成「運動」，同一天（第九批 160）搬到「賽車」 */
export const f1Part = {
  sources: [
    {
      name: {
        zh: 'Jolpica-F1（Ergast 的接手者）資料庫匯出，2026-10-13 的延遲版本；只准非商業使用',
        en: 'Jolpica-F1 (successor to Ergast) database dump of 13 October 2026 (delayed release); non-commercial use only',
      },
      url: 'https://github.com/jolpica/jolpica-f1',
      license: 'CC BY-NC-SA 4.0',
    },
  ],
  note: {
    zh:
      'F1 世界錦標賽的資料來自 Jolpica-F1（Ergast 的接手者），依 CC BY-NC-SA 4.0 授權：只准非商業使用、衍生的資料檔依同一授權分享；這個網站是非商業的，資料檔與匯出的圖片、CSV 也只能非商業使用。' +
      '分站算在賽道所在的國家，不是分站的名稱（在西班牙辦的歐洲大獎賽算西班牙，美國一年辦 3 站就算 3 站），取消的不算，2026 年到 10 月 11 日。車手冠軍是每一季最後一站之後的積分榜第 1 名，依車手在 FIA 登記的國籍；還沒結束的 2026 年不算。台灣沒有辦過分站，也沒有台灣籍的 F1 車手。',
    en:
      'Formula One World Championship data come from Jolpica-F1 (the successor to Ergast) under CC BY-NC-SA 4.0: non-commercial use only, with derived data shared alike. This site is non-commercial, and its data files and exported images and CSVs may likewise be used only non-commercially. ' +
      'Races count for the country where the circuit is, not the race name (the European Grand Prix held in Spain counts for Spain, and three US races in a year count three times); cancelled races are excluded, and 2026 runs to 11 October. Drivers’ titles go to the leader of the standings after the last race of each season, by the nationality the driver is registered under with the FIA; the unfinished 2026 season is not counted. Taiwan has never hosted a race and has had no Formula One driver.',
  },
  overlays: [
    {
      kind: 'points',
      id: 'circuits',
      file: 'circuits.json',
      label: { zh: '賽道（依第一站的年份）', en: 'Circuits (by first race)' },
      radius: { field: 'n', stops: [[1, 2.4], [10, 4], [40, 7], [77, 9.5]] },
      color: MAP_TOKENS.hues.red,
      sortField: 'n',
      timeField: 'first',
      indicators: ['races', 'champions'],
      sizeLegend: { title: { zh: '辦過的分站', en: 'Races held' }, values: [5, 25, 75], format: n0 },
      tooltip: circuitTooltip,
    },
  ],
  indicators: [
    {
      id: 'races',
      label: { zh: '舉辦的分站數', en: 'Races hosted' },
      description: {
        zh: '1950 年第一屆 F1 世界錦標賽起，到這一年在這個國家的賽道辦過幾站（累計）。到 2026 年 10 月義大利 110 站最多（蒙札幾乎每年都辦），美國 83、英國 81、德國 79、摩納哥 72；亞洲從 1976 年的日本富士開始。點是賽道，大小是辦過的分站數。',
        en: 'Formula One World Championship races held at circuits in the country from the first season in 1950 up to the selected year. By October 2026 Italy led with 110 (Monza hosts almost every year), followed by the US (83), the UK (81), Germany (79) and Monaco (72); Asia’s first was Fuji, Japan, in 1976. Dots are circuits, sized by races held.',
      },
      unit: { zh: '站', en: 'races' },
      file: 'races.json',
      layer: { kind: 'bubble', legendValues: [10, 50, 100] },
      overlayTime: 'cumulative',
      format: racesText,
      formatTick: n0,
      integer: true,
      shareOfWorld: true,
    },
    {
      id: 'champions',
      label: { zh: '車手冠軍（依國籍）', en: 'Drivers’ titles by nationality' },
      description: {
        zh: '到這一年為止，這個國籍的車手拿過幾次 F1 世界冠軍（累計）。英國 21 次最多（漢米爾頓 7 次），德國 12 次（舒馬克 7 次），巴西 8、阿根廷 5（方吉奧）；2025 年是英國的諾里斯。',
        en: 'Formula One drivers’ world titles won by drivers of each nationality up to the selected year. The UK leads with 21 (seven for Lewis Hamilton), then Germany with 12 (seven for Michael Schumacher), Brazil 8 and Argentina 5 (Juan Manuel Fangio); the 2025 champion was Britain’s Lando Norris.',
      },
      unit: { zh: '次', en: 'titles' },
      file: 'champions.json',
      layer: { kind: 'bubble', legendValues: [1, 5, 20] },
      overlayTime: 'cumulative',
      format: titlesText,
      formatTick: n0,
      integer: true,
      shareOfWorld: true,
      missing: { zh: '還沒有這個國籍的車手冠軍', en: 'No drivers’ title yet' },
    },
  ],
} satisfies Partial<TopicDefinition>;
