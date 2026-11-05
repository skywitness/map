import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { DimensionDef, PointsOverlayDef } from './types';

/**
 * 都市垃圾的去處、焚化廠與掩埋場（2026-11-05，製作手冊第二十二批 389；pipeline/topics/waste_europe.py，資料在 waste/）：
 * Eurostat env_wasmun 的歐洲各國 1995–2024 年逐年序列（每人每年公斤與占處理量的比例），台灣用環境部的處理量
 * （回收再利用的口徑較寬，使用者決定照畫、說明寫口徑）。What a Waste（waste.ts）是一次性快照，這一塊才有時間軸。
 * 點：台灣 27 座垃圾焚化廠（環境部，位置用 OSM）、OpenStreetMap 的掩埋場。
 */

const KG_YEAR = { zh: '公斤/人/年', en: 'kg/person/yr' };
const pct = (v: number) => `${fixed(v, v < 10 && v !== 0 ? 1 : 0)}%`;

const ROUTE_OPTIONS = [
  { id: 'landfilled', label: { zh: '掩埋', en: 'Landfilled' } },
  { id: 'incinerated', label: { zh: '焚化', en: 'Incinerated' } },
  { id: 'recycled', label: { zh: '回收（含堆肥）', en: 'Recycled (incl. composting)' } },
  { id: 'material', label: { zh: '物質回收', en: 'Materially recycled' } },
  { id: 'composted', label: { zh: '堆肥與厭氧消化', en: 'Composted or digested' } },
];
const ROUTES_KG: DimensionDef = {
  label: { zh: '去處', en: 'Route' },
  options: [{ id: 'generated', label: { zh: '產生', en: 'Generated' } }, ...ROUTE_OPTIONS],
  defaultOption: 'landfilled',
};
const ROUTES_SHARE: DimensionDef = { label: { zh: '去處', en: 'Route' }, options: ROUTE_OPTIONS, defaultOption: 'landfilled' };

/** 這兩個指標才畫焚化廠與掩埋場（What a Waste 的快照、塑膠、電子垃圾不畫） */
export const ROUTE_INDICATORS = ['waste-routes', 'waste-routes-share'];

const OWNERSHIP = [
  { zh: '公有公營', en: 'publicly owned and operated' },
  { zh: '公有民營', en: 'publicly owned, privately operated' },
  { zh: '民有民營', en: 'privately owned and operated' },
];

/** 環境部的 27 座垃圾焚化廠（位置用 OpenStreetMap 上同一座廠） */
const INCINERATORS: PointsOverlayDef = {
  kind: 'points',
  id: 'incinerators-tw',
  topic: 'waste',
  file: 'incinerators-tw.json',
  indicators: ROUTE_INDICATORS,
  label: { zh: '台灣的垃圾焚化廠（環境部）', en: 'Taiwan’s waste incinerators (Ministry of Environment)' },
  radius: { field: 'cap', stops: [[300, 3.5], [1800, 7]] },
  color: MAP_TOKENS.hues.red,
  sortField: 'cap',
  tooltip: (p) => {
    const cap = typeof p.cap === 'number' ? p.cap : null;
    const mw = typeof p.mw === 'number' ? p.mw : null;
    const own = typeof p.own === 'number' ? OWNERSHIP[p.own] : null;
    return {
      title: String(p.n ?? ''),
      detail: [
        cap !== null ? tr({ zh: `設計處理量每天 ${fixed(cap, 0)} 公噸`, en: `designed for ${fixed(cap, 0)} t/day` }) : null,
        mw !== null ? tr({ zh: `發電 ${fixed(mw, mw < 10 ? 1 : 0)} MW`, en: `${fixed(mw, mw < 10 ? 1 : 0)} MW generating capacity` }) : null,
      ]
        .filter(Boolean)
        .join(tr({ zh: '，', en: ', ' })),
      extra: [
        typeof p.y === 'number'
          ? tr({ zh: `${p.y} 年開始營運`, en: `operating since ${p.y}` })
          : tr({ zh: '興建中、還沒營運', en: 'under construction, not yet operating' }),
        own ? tr(own) : '',
      ].filter(Boolean),
      properNoun: String(p.n ?? ''),
    };
  },
};

/** OpenStreetMap 的掩埋場（landuse=landfill）：預設關閉；縮小時只畫有名稱的，其餘放大到 6 級才載入 */
const LANDFILLS: PointsOverlayDef = {
  kind: 'points',
  id: 'landfills',
  topic: 'waste',
  file: 'landfills.json',
  indicators: ROUTE_INDICATORS,
  label: { zh: '掩埋場（OpenStreetMap）', en: 'Landfills (OpenStreetMap)' },
  // 5.8 萬個點在歐洲會蓋住面量圖，預設關閉
  hidden: true,
  radius: 2.2,
  color: MAP_TOKENS.hues.orange,
  more: { minZoom: 6 },
  tooltip: (p, { countryName }) => ({
    title: typeof p.n === 'string' && p.n ? p.n : tr({ zh: '（沒有名稱的掩埋場）', en: '(unnamed landfill)' }),
    extra: [typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : ''],
    properNoun: typeof p.n === 'string' && p.n ? p.n : undefined,
  }),
};

export const wasteRoutesPart: TopicPart = {
  name: { zh: '垃圾的去處', en: 'Where municipal waste goes' },
  sources: [
    {
      name: { zh: 'Eurostat，都市垃圾依處理方式（env_wasmun）', en: 'Eurostat, Municipal waste by waste management operations (env_wasmun)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/env_wasmun/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '環境部：全國一般廢棄物處理量、一般廢棄物回收率、焚化廠基本資料',
        en: 'Ministry of Environment, Taiwan: municipal waste treatment, recycling rates and incinerator data',
      },
      url: 'https://data.moenv.gov.tw/dataset/detail/STAT_P_128',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: { zh: 'OpenStreetMap 的掩埋場與焚化廠位置（經 QLever）', en: 'OpenStreetMap landfills and incinerator locations (via QLever)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL 1.0',
    },
  ],
  note: {
    zh: 'Eurostat 的都市垃圾是地方政府收運的垃圾（含商店、機關類似家戶的垃圾），1995–2024 年。焚化含回收能源與不回收能源兩種；回收含物質回收、堆肥與厭氧消化，以及少量的準備再使用；各項加起來不一定等於產生量（出口、庫存、統計差），比例的分母是處理總量。科索沃不在 Eurostat 允許商業使用的範圍內，沒有畫；英國已經不在這個資料集裡。北馬其頓、波士尼亞等的 0 可能是沒有統計。台灣是環境部的一般廢棄物處理量（2021 年起），「回收再利用」含資源回收、廚餘與巨大垃圾再利用，口徑比歐洲的回收寬，兩邊不要直接比。焚化廠是環境部列的 27 座，掩埋場是 OpenStreetMap 上標的 landuse=landfill（有些是土方、廢土堆置場），點的多寡也在量各國畫得多完整，所以不算每百萬人。',
    en: 'Eurostat’s municipal waste is waste collected by or for municipalities (including similar waste from shops and offices), 1995–2024. Incineration includes plants with and without energy recovery; recycling includes material recycling, composting, anaerobic digestion and a little preparation for reuse. The routes need not add up to waste generated (exports, stockpiles, statistical differences), so shares are of total waste treated. Kosovo is outside the scope Eurostat allows for commercial use and is not shown; the UK is no longer in this dataset. Zeros for North Macedonia, Bosnia and others may mean “not reported”. Taiwan’s figures are the Ministry of Environment’s municipal waste treatment amounts (from 2021), whose “recycled” includes recyclables, food waste and reused bulky waste, a broader scope than Europe’s, so the two should not be compared directly. The incinerators are the 27 listed by the Ministry of Environment; landfills are areas tagged landuse=landfill in OpenStreetMap (some are spoil or construction-waste tips), and their number also reflects how completely each country is mapped, so no per-million figure is given.',
  },
  overlays: [INCINERATORS, LANDFILLS],
  panelExtra: () => import('./panels/WasteRoutesPanel'),
  indicators: [
    {
      id: 'waste-routes',
      label: { zh: '垃圾量（每人每年）', en: 'municipal waste per person' },
      description: {
        zh: '每人每年產生多少公斤都市垃圾、各送到哪裡，選上方的「去處」切換（Eurostat，歐洲 36 國，1995–2024 年；台灣是環境部的數字）。2024 年產生量奧地利 775、丹麥 758、盧森堡 730 公斤最多，羅馬尼亞 305 公斤（2023）最少；台灣 2025 年 537 公斤。掩埋：蒙特內哥羅 556、賽普勒斯 456、馬爾他 448 公斤，瑞士 0、比利時 1、德國 3；拖時間軸看德國從 1995 年的 267 公斤、義大利從 422 公斤一路掉下來。焚化：丹麥 389、挪威 339、瑞士 323 公斤，台灣 192。回收：奧地利 471、德國 425、盧森堡 412 公斤（物質回收奧地利 292、德國 282；堆肥與厭氧消化盧森堡 181、丹麥 179），台灣 307（口徑較寬，見說明）。地圖上的紅點是台灣的 27 座焚化廠；OpenStreetMap 的掩埋場（約 5.8 萬個）在圖層開關裡打開。',
        en: 'Kilograms of municipal waste generated per person per year and where it goes; switch with “Route” above (Eurostat, 36 European countries, 1995–2024; Taiwan from its Ministry of Environment). In 2024 Austria (775), Denmark (758) and Luxembourg (730) generated the most and Romania the least (305 in 2023); Taiwan 537 in 2025. Landfill: Montenegro 556, Cyprus 456, Malta 448; Switzerland 0, Belgium 1, Germany 3 — drag the timeline to watch Germany fall from 267 kg in 1995 and Italy from 422. Incineration: Denmark 389, Norway 339, Switzerland 323; Taiwan 192. Recycling: Austria 471, Germany 425, Luxembourg 412 (material recycling Austria 292, Germany 282; composting and digestion Luxembourg 181, Denmark 179); Taiwan 307 (broader scope, see notes). Red dots are Taiwan’s 27 incinerators; landfills from OpenStreetMap (about 58,000) can be switched on under Layers.',
      },
      unit: KG_YEAR,
      file: '../waste/routes/{item}.json',
      defaultYear: 'latest',
      dimension: ROUTES_KG,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 100, 200, 350, 550] } },
      format: (v) => `${fixed(v, 0)} ${tr(KG_YEAR)}`,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'waste-routes-share',
      label: { zh: '占處理量的比例', en: 'share of municipal waste treated' },
      description: {
        zh: '處理的都市垃圾有多少比例掩埋、焚化、回收，選上方的「去處」切換（Eurostat，分母是處理總量；台灣是環境部的處理量）。2024 年掩埋：北馬其頓 100%（2023）、波士尼亞 98.5%、蒙特內哥羅 96.4%、希臘 80.3%，西班牙 47.4%、波蘭 36.0%，德國 0.5%、瑞士 0%；波蘭 1995 年是 97.9%、義大利 90.2%。焚化：瑞典 52.9%、芬蘭 51.6%、丹麥 51.3%、瑞士 48.2%，台灣 2025 年 36.6%。回收：斯洛維尼亞 70.5%、德國 69.0%、奧地利 60.8%、義大利 60.5%，台灣 58.6%（含廚餘、巨大垃圾再利用，口徑較寬）。',
        en: 'Share of treated municipal waste that is landfilled, incinerated or recycled; switch with “Route” above (Eurostat, of total waste treated; Taiwan from its Ministry of Environment). Landfill in 2024: North Macedonia 100% (2023), Bosnia 98.5%, Montenegro 96.4%, Greece 80.3%, Spain 47.4%, Poland 36.0%, Germany 0.5%, Switzerland 0% — Poland was at 97.9% in 1995 and Italy at 90.2%. Incineration: Sweden 52.9%, Finland 51.6%, Denmark 51.3%, Switzerland 48.2%; Taiwan 36.6% in 2025. Recycling: Slovenia 70.5%, Germany 69.0%, Austria 60.8%, Italy 60.5%; Taiwan 58.6% (including food waste and reused bulky waste, a broader scope).',
      },
      unit: '%',
      file: '../waste/routes-share/{item}.json',
      defaultYear: 'latest',
      dimension: ROUTES_SHARE,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 15, 30, 45, 60, 80] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
  ],
};
