import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { ColorClasses, PointRecord, PointsOverlayDef } from './types';

/**
 * 雲端機房的區域（pipeline/topics/cloud_regions.py、sources/cloud_regions.py）：AWS、Google Cloud、Microsoft Azure 的
 * 公有雲區域，手工整理的事實表。使用者 2026-10-29 決定：只做這三家，不爬 AWS 的網站。
 */

export const PROVIDERS: { value: number; label: Text }[] = [
  { value: 1, label: { zh: 'AWS', en: 'AWS' } },
  { value: 2, label: { zh: 'Google Cloud', en: 'Google Cloud' } },
  { value: 3, label: { zh: 'Microsoft Azure', en: 'Microsoft Azure' } },
];
export const providerLabel = (p: unknown) => tr(PROVIDERS.find((x) => x.value === p)?.label ?? '');

const PROVIDER_COLORS: ColorClasses = {
  field: 'p',
  title: { zh: '業者', en: 'Provider' },
  thresholds: [1.5, 2.5],
  classes: [
    { color: MAP_TOKENS.categorical[2], label: PROVIDERS[0].label },
    { color: MAP_TOKENS.categorical[0], label: PROVIDERS[1].label },
    { color: MAP_TOKENS.categorical[7], label: PROVIDERS[2].label },
  ],
};

/** 區域的說明：業者 · 代碼 · 城市 · 開放年份（中國境內的寫營運的業者，限制存取的註明） */
export function regionFacts(p: PointRecord): string {
  const parts = [providerLabel(p.p), String(p.code), String(p.city)];
  if (typeof p.y === 'number') parts.push(tr({ zh: `${p.y} 年開放`, en: `opened ${p.y}` }));
  else parts.push(tr({ zh: '預覽中', en: 'in preview' }));
  if (typeof p.op === 'string') parts.push(tr({ zh: `由${p.op}營運`, en: `run by ${p.opEn}` }));
  if (p.r === 1) parts.push(tr({ zh: '限制存取', en: 'restricted access' }));
  return parts.join(' · ');
}

function layer(id: string, file: string, label: Text, preview: boolean): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file,
    label,
    radius: preview ? 4 : 5,
    color: preview ? MAP_TOKENS.context : PROVIDER_COLORS,
    ...(preview ? {} : { timeField: 'y' }),
    tooltip: (p, ctx) => ({
      title: String(p.name),
      detail: [regionFacts(p), typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null].filter(Boolean).join(' · '),
    }),
  };
}

/** AI 發展（ai.ts）的雲端機房的區域部分：2026-10-30（第七批 122）起併進 AI 發展 */
export const cloudRegionsPart: TopicPart = {
  name: { zh: '雲端機房的區域', en: 'Cloud regions' },
  sources: [
    {
      name: {
        zh: 'AWS、Google Cloud、Microsoft Azure 的區域清單與開放公告（手工整理，出處見 pipeline/sources/cloud_regions.py）',
        en: 'AWS, Google Cloud and Microsoft Azure region lists and launch announcements (compiled by hand; sources in pipeline/sources/cloud_regions.py)',
      },
      url: 'https://github.com/skywitness/map/blob/main/pipeline/sources/cloud_regions.py',
      license: { zh: '引用事實並註明出處', en: 'facts cited with sources' },
    },
  ],
  note: {
    zh:
      '區域是三家業者已經開放給一般客戶（GA）的公有雲區域，2026 年 10 月 29 日查：AWS 37 個、Google Cloud 43 個、Azure 61 個。點在業者寫的城市（業者不公開機房的位置，只寫州或國家的用常見報導的城市），同一個城市有好幾家的稍微錯開；年份是開放的年份，不是宣布的年份。' +
      '不含美國政府專用的區域（AWS GovCloud、Azure Government）與邊緣節點；中國境內的區域由當地業者營運（AWS 的光環新網、西云數據，Azure 的世紀互聯）；限制存取的區域（只給同一國的客戶做備援等）照收、在說明裡註明。' +
      '每家的「區域」大小不同（可用區的數目不一），區域數只能大概比較。Azure 的 Taiwan North（台北）與 Southeast Asia 3（馬來西亞柔佛）還在預覽，只開放給挑選的客戶，畫成灰色、不算進區域數；AWS 的台北區域 2025 年 6 月開放，Google 的彰化（asia-east1）2014 年開放。',
    en:
      'Regions are the public cloud regions the three providers have opened to customers in general (GA), checked on 29 October 2026: 37 for AWS, 43 for Google Cloud and 61 for Azure. Dots are placed at the city the provider names (providers do not disclose data-centre locations; where only a state or country is given, the commonly reported city is used), offset slightly where several providers share a city; years are when each region opened, not when it was announced. ' +
      'US government regions (AWS GovCloud, Azure Government) and edge locations are excluded; regions in China are run by local partners (Sinnet and NWCD for AWS, 21Vianet for Azure); restricted-access regions (for in-country backup and similar) are included and marked. ' +
      'A “region” differs in size between providers (the number of availability zones varies), so counts are only roughly comparable. Azure’s Taiwan North (Taipei) and Southeast Asia 3 (Johor, Malaysia) are still in preview for selected customers and are shown in grey without counting; AWS’s Taipei region opened in June 2025 and Google’s Changhua region (asia-east1) in 2014.',
  },
  panelExtra: () => import('./panels/CloudRegionsPanel'),
  overlays: [
    layer('regions', 'regions.json', { zh: '雲端區域（依開放年份）', en: 'Cloud regions (by opening year)' }, false),
    layer('preview', 'preview.json', { zh: '預覽中的區域', en: 'Regions in preview' }, true),
  ],
  indicators: [
    {
      id: 'regions',
      label: { zh: '雲端區域數', en: 'Cloud regions' },
      description: {
        zh: '這一年三家業者在這個國家開放的雲端區域數（AWS、Google Cloud、Azure 合計），圓的面積與它成正比；點是每個區域，顏色是業者。2006 年 AWS 在美國維吉尼亞開了第一個區域，2026 年共 141 個：美國 22 個，印度、澳洲各 8 個，日本、德國、中國、加拿大各 6 個；台灣 2 個（Google 彰化 2014 年、AWS 台北 2025 年），Azure 的台北區域還在預覽。拖動時間軸或按播放；點國家列出它的區域。',
        en: 'Cloud regions the three providers (AWS, Google Cloud and Azure combined) have opened in each country by the year; circle area is proportional to the count, and dots are individual regions coloured by provider. AWS opened the first region in Virginia in 2006; by 2026 there are 141: 22 in the US, 8 each in India and Australia, 6 each in Japan, Germany, China and Canada; Taiwan has 2 (Google in Changhua from 2014, AWS in Taipei from 2025), with Azure’s Taipei region still in preview. Drag the timeline or press play; select a country for its regions.',
      },
      unit: { zh: '個', en: 'regions' },
      file: 'regions-count.json',
      defaultYear: 2026,
      layer: { kind: 'bubble', legendValues: [1, 5, 20] },
      overlayTime: 'cumulative',
      format: (v) => tr({ zh: `${fixed(v, 0)} 個區域`, en: `${fixed(v, 0)} ${v === 1 ? 'region' : 'regions'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      shareOfWorld: true,
    },
  ],
};
