import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 山口與越嶺點（新主題，2026-11-07，製作手冊第二十七批 546，候選 1231；pipeline/topics/mountain_passes.py）。
 * Wikidata 的山口 2.4 萬個；覆蓋極不平均，所以國家只用「最高的山口」上色，數量只看點的密度。
 */

const D = MAP_TOKENS.diverging;
const meters = (v: number) => tr({ zh: `${fixed(v, 0)} 公尺`, en: `${fixed(v, 0)} m` });
const passName = (p: PointRecord) => String((getLang() === 'zh' ? p.zh || p.en : p.en || p.zh) ?? '');
const proper = (p: PointRecord, title: string) => {
  const other = getLang() === 'zh' ? p.en : p.zh;
  return typeof other === 'string' && other && other !== title ? other : undefined;
};
const height = (p: PointRecord) => (typeof p.e === 'number' ? meters(p.e) : tr({ zh: 'Wikidata 沒寫海拔', en: 'Elevation not given' }));

const PASSES: PointsOverlayDef = {
  kind: 'points',
  id: 'passes',
  file: 'passes.json',
  label: { zh: '山口（Wikidata）', en: 'Mountain passes (Wikidata)' },
  shape: 'triangle',
  radius: { field: 'sl', stops: [[0, 2.4], [5, 3.2], [20, 4.6], [50, 6]] },
  // 國家是橘色的面量圖，點用藍綠色系
  color: {
    field: 'k',
    title: { zh: '山口的海拔', en: 'Pass elevation' },
    thresholds: [1, 2, 3],
    classes: [
      { color: MAP_TOKENS.inkMuted, label: { zh: '沒寫海拔', en: 'Not given' } },
      { color: D[4], label: { zh: '2,000 公尺以下', en: 'Under 2,000 m' } },
      { color: D[5], label: { zh: '2,000–3,999 公尺', en: '2,000–3,999 m' } },
      { color: D[6], label: { zh: '4,000 公尺以上', en: '4,000 m or higher' } },
    ],
  },
  sortField: 'e',
  // 縮小時只畫有英文或中文維基條目的（瑞士、韓國的上千個小山口才不會蓋滿）
  minValue: { field: 'w', stops: [[0, 1], [6, 0]] },
  tooltip: (p, { countryName }) => {
    const title = passName(p);
    return {
      title,
      detail: [height(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      properNoun: proper(p, title),
    };
  },
};

const LIST: ListPanelDef = {
  label: { zh: '最高的山口', en: 'Highest passes' },
  file: 'passes.json',
  countryField: 'iso3',
  rows: (points, { countryName, country }) =>
    [...points]
      .filter((p) => country || typeof p.e === 'number')
      .sort((a, b) => Number(b.e ?? -1e4) - Number(a.e ?? -1e4) || Number(b.sl) - Number(a.sl))
      .slice(0, country ? undefined : 100)
      .map((p, i): ListRow => {
        const title = passName(p);
        return {
          key: `pass-${i}`,
          title: `${i + 1}. ${title}`,
          properNoun: proper(p, title),
          lines: [[height(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · ')],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 11 },
        };
      }),
};

export const mountainPasses: TopicDefinition = {
  id: 'mountain-passes',
  title: { zh: '山口與越嶺點', en: 'Mountain passes' },
  shortTitle: { zh: '山口', en: 'Passes' },
  defaultIndicator: 'highest',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'Wikidata 的山口（Q133056 與子類別）與海拔，經 QLever', en: 'Wikidata mountain passes (Q133056 and subclasses) and elevations, via QLever' },
      url: 'https://www.wikidata.org/wiki/Q133056',
      license: 'CC0',
    },
  ],
  note: {
    zh: '山口是 Wikidata 收錄的山口、鞍部、埡口與越嶺點（mountain pass 與它的子類別）：24,641 個項目，23,790 個有座標，只有 6,559 個寫了海拔（換算成公尺）。Wikidata 是志願者編輯的，各國收得多不多差很多：瑞士 1,875 個、韓國 1,871、墨西哥 1,702、北韓 1,520、摩洛哥 1,342、伊朗 1,329、法國 1,235，其中韓國、北韓多半是從地名資料庫大量匯入的小山口、很少寫海拔（韓國最高的才 334 公尺），所以國家只用「寫了海拔的山口裡最高的那一個」上色，數量只看點的疏密。邊界上的山口依座標歸到一國：聖母峰的南坳（7,906 公尺）在中國與尼泊爾的邊界上，算中國。縮小時只畫有英文或中文維基百科條目的山口（1,786 個）。',
    en: 'Passes are the mountain passes, cols, saddles and crossings recorded in Wikidata (mountain pass and its subclasses): 24,641 items, 23,790 with coordinates and only 6,559 with an elevation (converted to metres). Wikidata is edited by volunteers and coverage varies widely: Switzerland 1,875, South Korea 1,871, Mexico 1,702, North Korea 1,520, Morocco 1,342, Iran 1,329 and France 1,235, the two Koreas being mostly small passes bulk-imported from place-name databases with few elevations (South Korea’s highest recorded is just 334 m). Countries are therefore coloured only by the highest pass with a recorded elevation, and the number of passes is shown only by the density of dots. Passes on borders are assigned by their coordinates: the South Col of Everest (7,906 m), on the China–Nepal border, counts for China. Zoomed out, only passes with an English or Chinese Wikipedia article are drawn (1,786).',
  },
  overlays: [PASSES],
  listPanel: LIST,
  indicators: [
    {
      id: 'highest',
      label: { zh: '最高的山口', en: 'Highest pass' },
      description: {
        zh: '這一國 Wikidata 寫了海拔的山口裡最高的那一個（公尺；滑過看名稱），90 國有值。聖母峰的南坳 7,906 公尺（中國與尼泊爾的邊界，依座標算中國）、印度的 Nepal Gap 6,194、巴基斯坦的 Conway Saddle 6,044、尼泊爾的 Amphu Labtsa 5,845、玻利維亞的 Abra Pacuani 5,699、阿富汗 5,386、不丹 5,257、智利 5,209、阿根廷的 Agua Negra 5,108。台灣 13 個山口裡最高的是南投與花蓮交界的大水窟 3,280 公尺，其次武嶺 3,275、克難關 3,179、八通關 2,800、能高鞍部 2,765、大禹嶺 2,565、思源埡口 1,948。點是全部的山口（三角形，依海拔上色）；點國家列出它的山口，由高到低。',
        en: 'The highest pass with a recorded elevation in each country (metres; hover for its name), for 90 countries. The South Col of Everest at 7,906 m (on the China–Nepal border, counted for China by its coordinates), Nepal Gap in India at 6,194, Conway Saddle in Pakistan at 6,044, Amphu Labtsa in Nepal at 5,845, Abra Pacuani in Bolivia at 5,699, Afghanistan 5,386, Bhutan 5,257, Chile 5,209 and the Agua Negra Pass in Argentina at 5,108. Of Taiwan’s 13 passes the highest is Dashueiku on the Nantou–Hualien border at 3,280 m, followed by Wuling 3,275, Kenanguan 3,179, Batongguan 2,800, Nenggao Saddle 2,765, Dayuling 2,565 and Siyuan Pass 1,948. Dots are all the passes (triangles, coloured by elevation); select a country for its passes, highest first.',
      },
      unit: { zh: '公尺', en: 'm' },
      file: 'highest.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1000, 2000, 3000, 4000, 5000] } },
      format: meters,
      formatTick: (v) => fixed(v, 0),
      panelChart: false,
      missing: { zh: 'Wikidata 沒有寫了海拔的山口', en: 'No pass with a recorded elevation in Wikidata' },
    },
  ],
};
