import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { TopicPart } from './parts';
import type { CategoryDef } from './types';

/**
 * 太空的擴充：衛星放在哪一層軌道、巨型星座的競賽、六大衛星導航系統（2026-11-07，製作手冊第二十七批 605，
 * 候選 1332、1333、1334；pipeline/topics/space_orbits.py，資料在 public/data/topics/space/）：GCAT 的 satcat 多三種彙總；
 * 側欄 panels/SpaceOrbitsPanel.tsx。
 */
export const ORBIT_LAYERS: CategoryDef[] = [
  { value: 1, label: { zh: '極低軌道（約 600 公里以下）', en: 'Very low orbit (below about 600 km)' } },
  { value: 2, label: { zh: '低軌道（約 600–2,000 公里）', en: 'Low orbit (about 600–2,000 km)' } },
  { value: 3, label: { zh: '中軌道', en: 'Medium orbit' } },
  { value: 4, label: { zh: '地球同步軌道（約 3.6 萬公里）', en: 'Geosynchronous orbit (about 36,000 km)' } },
  { value: 5, label: { zh: '高橢圓與轉移軌道', en: 'Highly elliptical and transfer orbits' } },
];
export const CONSTELLATIONS = [
  { id: 'starlink', label: { zh: 'Starlink（SpaceX）', en: 'Starlink (SpaceX)' } },
  { id: 'oneweb', label: { zh: 'OneWeb（Eutelsat）', en: 'OneWeb (Eutelsat)' } },
  { id: 'kuiper', label: { zh: 'Kuiper（Amazon）', en: 'Kuiper (Amazon)' } },
  { id: 'qianfan', label: { zh: '千帆（上海垣信）', en: 'Qianfan (Shanghai Spacesail)' } },
  { id: 'guowang', label: { zh: '國網（中國衛星網路集團）', en: 'Guowang (China Satellite Network Group)' } },
] as const;
export const GNSS_SYSTEMS = [
  { id: 'gps', label: { zh: 'GPS（美國）', en: 'GPS (US)' } },
  { id: 'glonass', label: { zh: 'GLONASS（俄羅斯）', en: 'GLONASS (Russia)' } },
  { id: 'beidou', label: { zh: '北斗（中國）', en: 'BeiDou (China)' } },
  { id: 'galileo', label: { zh: 'Galileo（歐盟）', en: 'Galileo (EU)' } },
  { id: 'qzss', label: { zh: '準天頂（日本）', en: 'QZSS (Japan)' } },
  { id: 'navic', label: { zh: 'NavIC（印度）', en: 'NavIC (India)' } },
] as const;
const GNSS_ROLES: CategoryDef[] = [
  { value: 1, label: { zh: '自建全球系統', en: 'Own global system' } },
  { value: 2, label: { zh: '歐盟的 Galileo', en: 'EU’s Galileo' } },
  { value: 3, label: { zh: '自建區域系統', en: 'Own regional system' } },
];
const label = (cats: CategoryDef[]) => (v: number) => {
  const c = cats.find((x) => x.value === v)?.label;
  return c ? (typeof c === 'string' ? c : tr(c)) : '';
};
const payloads = (v: number) => tr({ zh: `${fixed(v, 0)} 顆`, en: `${fixed(v, 0)} satellites` });

export const spaceOrbitsPart: TopicPart = {
  name: { zh: '軌道、巨型星座與衛星導航', en: 'Orbits, megaconstellations and satellite navigation' },
  sources: [],
  note: {
    zh: '軌道層用 GCAT 的運作軌道類別（OpOrbit）：極低軌道（LLEO）在軌的平均高度實測約 600 公里以下，低軌道（LEO）約 600–2,000 公里；高橢圓（HEO、VHEO）與同步轉移軌道（GTO）併成一類。巨型星座用 GCAT 的業者代碼認，國家是擁有國。衛星導航的類別是人工整理的事實，在軌顆數含已經停用但還在軌道上的（GLONASS 有很多舊衛星），實際可用的比較少。',
    en: 'Orbit layers follow GCAT’s operational orbit class (OpOrbit): very low orbit (LLEO) objects have mean altitudes below about 600 km, low orbit (LEO) about 600–2,000 km; highly elliptical (HEO, VHEO) and geosynchronous transfer orbits (GTO) are grouped together. Megaconstellations are identified by GCAT’s operator codes and assigned to the owner’s country. Navigation-system roles are compiled by hand; satellite counts include defunct satellites still in orbit (GLONASS has many old ones), so fewer are usable.',
  },
  panelExtra: () => import('./panels/SpaceOrbitsPanel'),
  indicators: [
    {
      id: 'orbit-layer',
      label: { zh: '衛星主要放在哪一層軌道', en: 'Main orbit of a country’s satellites' },
      description: {
        zh: '每年年底在軌的酬載最多的那一層軌道（至少 5 顆的國家）。2026 年全世界有軌道類別的 18,786 顆裡，極低軌道 14,033 顆、低軌道 3,019、中軌道 430、地球同步軌道 1,070、高橢圓與轉移軌道 234。美國（Starlink）、日本、英國、台灣等 29 國以極低軌道為主；中國、俄羅斯、法國、加拿大等 12 國以低軌道為主；印度、印尼、巴西、泰國、墨西哥、盧森堡（SES）、哈薩克、香港 8 地以同步軌道的通訊與廣播衛星為主。台灣 35 顆：極低軌道 26、低軌道 9。點國家看各層的顆數。',
        en: 'The orbit layer holding most of a country’s payloads at the end of each year (countries with at least 5). Of the world’s 18,786 payloads with an orbit class in 2026, 14,033 are in very low orbit, 3,019 in low orbit, 430 in medium orbit, 1,070 in geosynchronous orbit and 234 in highly elliptical or transfer orbits. 29 countries, including the US (Starlink), Japan, the UK and Taiwan, are mainly in very low orbit; 12, including China, Russia, France and Canada, mainly in low orbit; and 8 (India, Indonesia, Brazil, Thailand, Mexico, Luxembourg (SES), Kazakhstan and Hong Kong) mainly in geosynchronous orbit with communications and broadcasting satellites. Taiwan’s 35: 26 in very low orbit and 9 in low orbit. Click a country for counts by layer.',
      },
      unit: '',
      file: 'orbit-layer.json',
      layer: { kind: 'categorical', ordinal: true, categories: ORBIT_LAYERS },
      format: label(ORBIT_LAYERS),
      missing: { zh: '在軌酬載不到 5 顆', en: 'Fewer than 5 payloads in orbit' },
    },
    {
      id: 'megaconstellations',
      label: { zh: '低軌寬頻巨型星座的衛星', en: 'Satellites in broadband megaconstellations' },
      description: {
        zh: '五個低軌寬頻星座在軌的衛星數（每年年底），依業者所屬的國家。2019 年只有 128 顆，2022 年 3,875、2024 年 7,627，2026 年 12,120：Starlink 10,629 顆、OneWeb 654、Kuiper 392、千帆 239、國網 206。美國 11,021 顆、英國 654、中國 445。台灣沒有自己的星座；哪些國家能用 Starlink 見「Starlink 開通的國家」主題。',
        en: 'Satellites in orbit in the five low-orbit broadband constellations (end of each year), by operator country. Only 128 in 2019, 3,875 in 2022, 7,627 in 2024 and 12,120 in 2026: Starlink 10,629, OneWeb 654, Kuiper 392, Qianfan 239 and Guowang 206. The US has 11,021, the UK 654 and China 445. Taiwan has no constellation of its own; see the Starlink availability topic for where Starlink can be used.',
      },
      unit: { zh: '顆', en: 'satellites' },
      file: 'megaconstellations.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: payloads,
      formatTick: formatLargeTick,
      integer: true,
      shareOfWorld: true,
    },
    {
      id: 'gnss',
      label: { zh: '衛星導航系統', en: 'Satellite navigation systems' },
      description: {
        zh: '全球衛星導航系統只有四個：美國 GPS、俄羅斯 GLONASS、中國北斗與歐盟 Galileo；日本的準天頂（QZSS）與印度的 NavIC 是只涵蓋本國周邊的區域系統。在軌顆數（含已停用的）：GPS 80、GLONASS 143、北斗 64、Galileo 34、準天頂 5、NavIC 10。其他國家（包括台灣）都用別國的系統。',
        en: 'There are only four global navigation satellite systems: the US GPS, Russia’s GLONASS, China’s BeiDou and the EU’s Galileo; Japan’s QZSS and India’s NavIC are regional systems covering their own surroundings. Satellites in orbit (including defunct ones): GPS 80, GLONASS 143, BeiDou 64, Galileo 34, QZSS 5 and NavIC 10. Every other country, Taiwan included, uses other countries’ systems.',
      },
      unit: '',
      file: 'gnss.json',
      layer: { kind: 'categorical', categories: GNSS_ROLES },
      format: label(GNSS_ROLES),
      timeless: true,
      missing: { zh: '用別國的系統', en: 'Uses other countries’ systems' },
    },
  ],
};
