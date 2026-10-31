import { tr } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import { robotaxiExtra } from './robotaxi';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 叫車服務在哪些國家（pipeline/topics/ride_hailing.py）：Uber、Grab、滴滴，手工整理各公司網站列出的國家。
 * 使用者 2026-10-30 決定只做這三家；Uber 的城市頁從 cloud 讀不到，國家照使用者用瀏覽器存的那一頁。
 * 無人計程車在 robotaxi.ts（2026-10-31，第十批 179）。
 */
const PLATFORMS: CategoryDef[] = [
  { value: 1, label: { zh: 'Uber', en: 'Uber' } },
  { value: 2, label: { zh: 'Uber 與滴滴', en: 'Uber and DiDi' } },
  { value: 3, label: { zh: '滴滴（DiDi）', en: 'DiDi' } },
  { value: 4, label: { zh: 'Grab', en: 'Grab' } },
  { value: 0, label: { zh: '三家都沒有', en: 'None of the three' }, color: MAP_TOKENS.categoricalOther },
];

export const rideHailing: TopicDefinition = {
  id: 'ride-hailing',
  title: { zh: '叫車服務在哪些國家（Uber、Grab、滴滴）', en: 'Ride-hailing by country (Uber, Grab, DiDi)' },
  shortTitle: { zh: '叫車服務', en: 'Ride-hailing' },
  defaultIndicator: 'platforms',
  defaultYear: 2026,
  sources: [
    { name: { zh: 'Uber：Uber Cities（各國的城市）', en: 'Uber: Uber Cities' }, url: 'https://www.uber.com/global/en/cities/', license: { zh: '事實，自行整理', en: 'facts, compiled here' } },
    { name: { zh: 'Grab：Locations', en: 'Grab: Locations' }, url: 'https://www.grab.com/sg/locations/', license: { zh: '事實，自行整理', en: 'facts, compiled here' } },
    { name: { zh: '滴滴：DiDi Global 的國家選單', en: 'DiDi: DiDi Global country list' }, url: 'https://web.didiglobal.com/', license: { zh: '事實，自行整理', en: 'facts, compiled here' } },
 
    ...robotaxiExtra.sources,
  ],
  overlays: robotaxiExtra.overlays,
  listPanel: robotaxiExtra.listPanel,
  note: {
    zh:
      '各公司網站 2026 年 10 月底列出有營運的國家：Uber 74 個國家或地區、Grab 東南亞 8 國、滴滴 15 國（含中國）。只看有沒有營運，不看在幾個城市，也不分合法、受限或禁止：被禁止的國家看起來跟沒有營運一樣，台灣、日本、南韓的法規限制寫在附註。' +
      'Uber 2016 年把中國業務賣給滴滴、2018 年把東南亞業務賣給 Grab，所以三家幾乎不重疊。Lyft、Bolt、Yandex Go、Careem 等其他平台不在這個主題裡。' +
      '無人計程車只收車上沒有安全員、對一般乘客收費的城市，手工整理自英文維基百科（Waymo、蘿蔔快跑、Zoox 的服務區表，Tesla Robotaxi）與各公司的公告。',
    en:
      'Countries where each company lists operations on its website as of late October 2026: Uber in 74 countries or territories, Grab in 8 Southeast Asian countries, DiDi in 15 (including China). Only whether a service operates counts, not how many cities, and legal status (legal, restricted or banned) is not shown: a country that bans a service looks the same as one where it never launched; restrictions in Taiwan, Japan and South Korea are in the notes. ' +
      'Uber sold its China business to DiDi in 2016 and its Southeast Asia business to Grab in 2018, so the three barely overlap. Other platforms such as Lyft, Bolt, Yandex Go and Careem are not covered. ' +
      'Robotaxis cover only cities with paid rides open to the public and no safety driver on board, compiled from English Wikipedia (the Waymo, Apollo Go and Zoox service-area tables, and Tesla Robotaxi) and company announcements.',
  },
  indicators: [
    {
      id: 'platforms',
      label: { zh: '有哪幾家', en: 'Which platforms' },
      description: {
        zh: 'Uber、Grab、滴滴在哪些國家營運。Uber 在美洲、歐洲、中東、非洲與南亞，Grab 只在東南亞 8 國，滴滴在中國、拉丁美洲、日本、澳紐與埃及（這些地方跟 Uber 重疊）。台灣只有 Uber。滑過看有哪幾家。',
        en: 'Where Uber, Grab and DiDi operate. Uber covers the Americas, Europe, the Middle East, Africa and South Asia; Grab only eight Southeast Asian countries; DiDi China, Latin America, Japan, Australia, New Zealand and Egypt, where it overlaps with Uber. Taiwan has only Uber. Hover to see which platforms are present.',
      },
      unit: '',
      file: 'platforms.json',
      layer: { kind: 'categorical', categories: PLATFORMS },
      format: (v) => tr(PLATFORMS.find((c) => c.value === v)?.label ?? { zh: '', en: '' }),
      timeless: true,
    },
    ...robotaxiExtra.indicators,
  ],
};
