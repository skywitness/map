import { getLang, tr } from '../i18n/lang';
import { formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointRecord, Text, TopicDefinition } from './types';

/**
 * 飛航情報區與防空識別區（pipeline/topics/airspace.py）：VATSpy 的飛航情報區（面，滑過看代碼與名稱），國家的值是它管的空域面積。
 * 使用者 2026-10-30 決定照 VATSpy 的管制單位畫（有些國家是區域管制中心或扇區），寫法中性（用 ICAO 的名稱）；
 * 防空識別區等本機 session 下載各國公告後再補。
 */

const DOMESTIC = 1;
const OCEANIC = 2;

/** 防空識別區（adiz.json 的分類）：名稱、宣布的國家、依據 */
const ADIZ: Record<number, { name: Text; basis: Text }> = {
  1: {
    name: { zh: '日本的防空識別圈', en: 'Japan’s ADIZ' },
    basis: { zh: '防衛省訓令（1969 年，2010 年擴及與那國島西側）', en: 'Ministry of Defense directive (1969; extended west of Yonaguni in 2010)' },
  },
  2: {
    name: { zh: '韓國防空識別區（KADIZ）', en: 'Korea Air Defense Identification Zone (KADIZ)' },
    basis: { zh: '國防部告示（2013 年 12 月擴大）', en: 'Ministry of National Defense notice (expanded December 2013)' },
  },
  3: {
    name: { zh: '中國東海防空識別區', en: 'China’s East China Sea ADIZ' },
    basis: { zh: '中國政府聲明（2013 年 11 月）', en: 'Chinese government statement (November 2013)' },
  },
  4: {
    name: { zh: '臺灣防空識別區', en: 'Taiwan ADIZ' },
    basis: { zh: '民航局飛航指南 ENR 5.2.3', en: 'CAA Aeronautical Information Publication, ENR 5.2.3' },
  },
};

const km2 = (v: number) => tr({ zh: `${formatLargeNumber(v)} 平方公里`, en: `${formatLargeNumber(v)} km²` });

/** 只有台北用中文的正式名稱，其他照 VATSpy 的英文名稱（不翻譯） */
function firName(p: PointRecord): string {
  if (p.id === 'RCAA' && getLang() === 'zh') return '台北飛航情報區'; // i18n-ignore（只在中文介面）
  return String(p.name ?? p.id ?? '');
}

export const airspace: TopicDefinition = {
  id: 'airspace',
  title: { zh: '飛航情報區與防空識別區', en: 'Flight information regions and air defence zones' },
  shortTitle: { zh: '飛航情報區', en: 'Airspace' },
  defaultIndicator: 'fir-area',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'VATSpy 資料專案（VATSIM 模擬飛行社群整理的管制範圍，非官方）',
        en: 'VATSpy Data Project (control boundaries compiled by the VATSIM flight-simulation community; unofficial)',
      },
      url: 'https://github.com/vatsimnetwork/vatspy-data-project',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '防空識別區：日本防衛省訓令第 36 號、中國政府 2013-11-23 聲明、大韓民國國防部告示第 2013-449 號（座標見韓國 AIP ENR 5.2，國土交通部）、交通部民用航空局 AIP ENR 5.2.3',
        en: 'ADIZs: Japan Ministry of Defense directive No. 36; Chinese government statement of 23 November 2013; Republic of Korea Ministry of National Defense notice 2013-449 (coordinates from the Korean AIP, ENR 5.2, MOLIT); Taiwan CAA AIP, ENR 5.2.3',
      },
      url: 'https://ais.caa.gov.tw/eaip/',
      license: { zh: '政府公告（不受著作權保護）', en: 'Government announcements (not subject to copyright)' },
    },
    {
      name: { zh: 'OurAirports（ICAO 代碼字首對到國家）', en: 'OurAirports (ICAO prefixes matched to countries)' },
      url: 'https://ourairports.com/data/',
      license: { zh: '公有領域', en: 'Public domain' },
    },
  ],
  note: {
    zh:
      '飛航情報區（FIR）是國際民航組織（ICAO）劃分、由各國提供飛航情報與管制服務的空域，跟領空、國界不同（海上的大片空域也有人負責）。ICAO 本身的 FIR 檔要付費、不准複製，這裡用模擬飛行社群 VATSIM 維護的 VATSpy 範圍（CC BY-SA 4.0，不是官方資料）：一個 FIR 切成好幾個扇區的已經合併，但有些國家 VATSpy 是依區域管制中心或扇區畫的，不是 ICAO 的 FIR（澳洲 76 個扇區、中國 24 個、印度 21 個，日本、紐西蘭也是），照原樣畫。' +
      '負責的國家依 ICAO 代碼的字首（RC 台灣、RJ 日本、K 美國…）。國家的值是它負責的範圍面積（聯集，重疊的扇區只算一次）。防空識別區（ADIZ）是各國自行宣布、要求進入的航空器先表明身分的空域，不是領空；這裡只畫東亞的日本、韓國、中國與台灣，照各國公告的座標分別畫，互相重疊的地方照畫。日本的是外側線扣掉內側線的環（與那國島西側那段是島外 14 海里），中國的是六點連線與領海線之間（領海線用海岸線往外 12 海里近似），韓國的座標依韓國飛航指南 ENR 5.2（國防部告示），台灣的依民航局飛航指南 ENR 5.2.3。飛航情報區的資料檔依 CC BY-SA 4.0 分享。',
    en:
      'Flight information regions (FIRs) are the airspace the International Civil Aviation Organization (ICAO) assigns to states to provide flight information and air traffic services; they differ from national airspace and borders and also cover large areas over the sea. ICAO’s own FIR file is paid and may not be copied, so the boundaries come from VATSpy, maintained by the VATSIM flight-simulation community (CC BY-SA 4.0; not official). FIRs split into sectors have been merged, but in some countries VATSpy draws area control centres or sectors rather than ICAO FIRs (76 sectors in Australia, 24 in China, 21 in India, also Japan and New Zealand), shown as they are. ' +
      'The responsible country follows the ICAO code prefix (RC Taiwan, RJ Japan, K United States…). A country’s value is the area it is responsible for (union, so overlapping sectors count once). Air defence identification zones (ADIZs) are declared unilaterally and ask aircraft entering them to identify themselves; they are not national airspace. Only East Asia is shown — Japan, South Korea, China and Taiwan — each drawn from its own announcement, overlaps included. Japan’s is a ring between an outer and an inner line (west of Yonaguni it runs 14 nautical miles off the island); China’s lies between six points and its territorial sea line (approximated as 12 nautical miles off the coast); Korea’s coordinates follow the Korean AIP, ENR 5.2 (Ministry of National Defense notice), and Taiwan’s the Civil Aeronautics Administration’s AIP, ENR 5.2.3. The FIR data files are shared under CC BY-SA 4.0.',
  },
  overlays: [
    {
      kind: 'lines',
      id: 'adiz',
      file: 'adiz.json',
      label: { zh: '防空識別區（東亞，各國自行宣布）', en: 'Air defence identification zones (East Asia, declared by each country)' },
      width: 1.6,
      color: {
        title: { zh: '宣布的國家', en: 'Declared by' },
        classes: [
          { value: 1, color: MAP_TOKENS.categorical[5], label: { zh: '日本', en: 'Japan' } },
          { value: 2, color: MAP_TOKENS.categorical[1], label: { zh: '韓國', en: 'South Korea' } },
          { value: 3, color: MAP_TOKENS.categorical[2], label: { zh: '中國', en: 'China' } },
          { value: 4, color: MAP_TOKENS.categorical[3], label: { zh: '台灣', en: 'Taiwan' } },
        ],
      },
      groupField: 'c',
      fill: { field: 'f', value: 1, opacity: 0.12, darkOpacity: 0.18, holeField: 'h', hover: true },
      tooltip: (p) => {
        const z = ADIZ[Number(p.c)];
        return {
          title: z ? tr(z.name) : '',
          detail: z ? tr(z.basis) : undefined,
          extra: typeof p.area === 'number' ? [tr({ zh: `約 ${km2(p.area)}；跟其他國家的範圍可能重疊`, en: `About ${km2(p.area)}; may overlap other zones` })] : undefined,
        };
      },
    },
    {
      kind: 'lines',
      id: 'firs',
      file: 'firs.json',
      label: { zh: '飛航情報區（VATSpy）', en: 'Flight information regions (VATSpy)' },
      width: 0.8,
      color: {
        title: { zh: '範圍', en: 'Region' },
        classes: [
          { value: DOMESTIC, color: MAP_TOKENS.hues.blue, label: { zh: '陸上', en: 'Continental' } },
          { value: OCEANIC, color: MAP_TOKENS.hues.aqua, label: { zh: '海洋', en: 'Oceanic' }, dash: true },
        ],
      },
      groupField: 'id',
      fill: { field: 'f', value: 1, opacity: 0.04, darkOpacity: 0.08, holeField: 'h', hover: true },
      tooltip: (p, ctx) => ({
        title: `${firName(p)} (${p.id})`,
        detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null, p.oc === 1 ? tr({ zh: '海洋區', en: 'Oceanic' }) : null]
          .filter(Boolean)
          .join(' · '),
        extra: typeof p.area === 'number' ? [tr({ zh: `約 ${km2(p.area)}`, en: `About ${km2(p.area)}` })] : undefined,
        properNoun: getLang() === 'zh' && p.id === 'RCAA' ? String(p.name ?? '') : undefined,
      }),
    },
  ],
  indicators: [
    {
      id: 'fir-area',
      label: { zh: '負責的空域面積', en: 'Airspace managed' },
      description: {
        zh: '這個國家負責的飛航情報區合計的面積（VATSpy 的範圍）。美國約 7,300 萬平方公里最多（含太平洋上的奧克蘭海洋區），澳洲 5,500 萬，南非、智利、紐西蘭負責大片的南方海洋；台北飛航情報區約 32 萬平方公里。滑過地圖上的範圍看代碼與名稱。',
        en: 'The combined area of the flight information regions the country is responsible for (VATSpy boundaries). The US leads with about 73 million km² (including the Oakland Oceanic region over the Pacific), Australia has 55 million, and South Africa, Chile and New Zealand cover large parts of the southern oceans; the Taipei FIR is about 320,000 km². Hover over a region for its code and name.',
      },
      unit: { zh: '平方公里', en: 'km²' },
      file: 'fir-area.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 5e7] },
      format: km2,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      panelChart: false,
      missing: { zh: '沒有負責的飛航情報區', en: 'No flight information region' },
    },
  ],
};
