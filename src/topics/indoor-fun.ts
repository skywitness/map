import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';
import type { TopicPart } from './parts';

/**
 * 室內娛樂場所（2026-11-08，製作手冊第二十七批 666，候選 1386、1460；pipeline/topics/ent_venues.py 的 indoor，資料在 diving/）：
 * OpenStreetMap 經 QLever 的電子遊樂場（leisure=amusement_arcade）、密室逃脫（escape_game）、彈跳床樂園（trampoline_park）。
 * 點全部畫；每百萬人只替 OSM 覆蓋良好的國家上色。接在「休閒運動場地」後面（照手冊的選項，不另開主題）。
 */
const KINDS: Text[] = [
  { zh: '電子遊樂場', en: 'Amusement arcade' },
  { zh: '密室逃脫', en: 'Escape room' },
  { zh: '彈跳床樂園', en: 'Trampoline park' },
];
const COLORS = [MAP_TOKENS.categorical[3], MAP_TOKENS.categorical[6], MAP_TOKENS.categorical[2]];
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const kindText = (p: PointRecord) => tr(KINDS[(Number(p.k) || 1) - 1]);
const nameOf = (p: PointRecord) =>
  (getLang() === 'zh' ? (str(p.nz) ?? str(p.n) ?? str(p.ne)) : (str(p.ne) ?? str(p.n))) ?? tr({ zh: `（沒有名稱的${kindText(p)}）`, en: '(unnamed)' });
const proper = (p: PointRecord) => (getLang() === 'en' && !str(p.ne) && str(p.n) ? String(p.n) : undefined);
const IND = ['arcades-per', 'escape-games-per', 'trampoline-parks-per', 'indoor-count'];

const POINTS: PointsOverlayDef = {
  kind: 'points',
  id: 'indoor',
  file: 'indoor-points.json',
  label: { zh: '電子遊樂場、密室逃脫與彈跳床樂園', en: 'Arcades, escape rooms and trampoline parks' },
  indicators: IND,
  radius: 2.4,
  color: {
    field: 'k',
    title: { zh: '種類', en: 'Type' },
    thresholds: [1.5, 2.5],
    classes: KINDS.map((label, i) => ({ color: COLORS[i], label })),
  },
  tooltip: (p, { countryName }) => ({
    title: nameOf(p),
    detail: [kindText(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    properNoun: proper(p),
  }),
};

const LIST: ListPanelDef = {
  label: { zh: '電子遊樂場、密室逃脫與彈跳床樂園（依國家）', en: 'Arcades, escape rooms and trampoline parks by country' },
  tabLabel: { zh: '室內娛樂', en: 'Indoor fun' },
  indicators: IND,
  file: 'indoor-points.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    points
      .filter((p) => p.n || p.nz || p.ne)
      .map((p) => ({ p, group: typeof p.iso3 === 'string' ? countryName(p.iso3) : '' }))
      .sort((a, b) => a.group.localeCompare(b.group, getLang() === 'zh' ? 'zh-Hant' : 'en') || Number(a.p.k) - Number(b.p.k))
      .map(({ p, group }, i): ListRow => ({
        key: `in-${i}`,
        title: nameOf(p),
        properNoun: proper(p),
        lines: [kindText(p)],
        group,
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 15 },
      })),
};

const perMillion = (v: number) => tr({ zh: `每百萬人 ${fixed(v, v < 1 ? 2 : 1)} 處`, en: `${fixed(v, v < 1 ? 2 : 1)} per million` });
const PER: Text = { zh: '處／百萬人', en: 'per million people' };

export const indoorFunPart: TopicPart = {
  name: { zh: '電子遊樂場、密室逃脫與彈跳床樂園', en: 'Arcades, escape rooms and trampoline parks' },
  sources: [],
  note: {
    zh: '電子遊樂場（leisure=amusement_arcade）在各國不是同一種店：日本的遊戲中心、英國海濱有吃角子老虎的遊樂場、台灣的電子遊戲場與夾娃娃機店都算。密室逃脫（escape_game）、彈跳床樂園（trampoline_park）是比較新的標籤，台灣幾乎沒有人標。每百萬人只替 OSM 覆蓋良好的國家上色，數量也在量 OSM 畫得多完整。',
    en: 'Amusement arcades (leisure=amusement_arcade) are not the same kind of place everywhere: Japanese game centres, British seaside arcades with slot machines and Taiwan’s video game parlours and claw-machine shops all count. Escape rooms (escape_game) and trampoline parks (trampoline_park) are newer tags that hardly anyone in Taiwan has used. Per-million rates are shaded only for countries where OSM is reasonably complete, and counts also reflect how completely OSM is mapped.',
  },
  overlays: [POINTS],
  listPanel: [LIST],
  indicators: [
    {
      id: 'arcades-per',
      label: { zh: '每百萬人有幾家電子遊樂場', en: 'Amusement arcades per million people' },
      description: {
        zh: 'OpenStreetMap 上標成電子遊樂場的地方 ÷ 2024 年人口，只替 OSM 覆蓋良好的 93 國上色。全球 9,077 處、141 國，美國 2,184、墨西哥 829、日本 761、英國 599 最多；台灣 191 處。每百萬人新加坡 8.9、賽普勒斯 8.8、英國 8.7、紐西蘭 8.6、台灣 8.2；美國 6.3、日本 6.2、法國 5.9、德國 3.4、南韓 2.0。',
        en: 'Places tagged as amusement arcades in OpenStreetMap divided by 2024 population, shaded only for the 93 countries well covered by OSM. There are 9,077 in 141 countries, led by the US (2,184), Mexico (829), Japan (761) and the UK (599); Taiwan has 191. Per million people: Singapore 8.9, Cyprus 8.8, the UK 8.7, New Zealand 8.6 and Taiwan 8.2; the US 6.3, Japan 6.2, France 5.9, Germany 3.4 and South Korea 2.0.',
      },
      unit: PER,
      file: 'arcades-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 6, 8] } },
      format: perMillion,
      formatTick: (v) => `${v}`,
      panelChart: false,
    },
    {
      id: 'escape-games-per',
      label: { zh: '每百萬人有幾家密室逃脫', en: 'Escape rooms per million people' },
      description: {
        zh: 'OpenStreetMap 上標成密室逃脫的地方 ÷ 2024 年人口。全球 3,226 處、93 國，美國 570、法國 545、俄羅斯 280、德國 269、英國 192 最多。每百萬人愛沙尼亞 11.0、瑞士 8.5、斯洛伐克 8.4、法國 8.2、芬蘭 6.8、比利時 6.6；德國 3.2、英國 2.8、美國 1.7、南韓 0.3、日本 0.02，台灣 OSM 上沒有標。',
        en: 'Places tagged as escape rooms in OpenStreetMap divided by 2024 population. There are 3,226 in 93 countries, led by the US (570), France (545), Russia (280), Germany (269) and the UK (192). Per million people: Estonia 11.0, Switzerland 8.5, Slovakia 8.4, France 8.2, Finland 6.8 and Belgium 6.6; Germany 3.2, the UK 2.8, the US 1.7, South Korea 0.3 and Japan 0.02, with none tagged in Taiwan.',
      },
      unit: PER,
      file: 'escape-games-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 6, 8] } },
      format: perMillion,
      formatTick: (v) => `${v}`,
      panelChart: false,
    },
    {
      id: 'trampoline-parks-per',
      label: { zh: '每百萬人有幾家彈跳床樂園', en: 'Trampoline parks per million people' },
      description: {
        zh: 'OpenStreetMap 上標成彈跳床樂園的地方 ÷ 2024 年人口。全球 1,248 處、76 國，美國 422、英國 112、法國 104、德國 84 最多；台灣 1 處。每百萬人愛沙尼亞 5.1、紐西蘭 2.9、冰島 2.5、挪威 2.5、克羅埃西亞 2.3、丹麥 2.2；英國 1.6、法國 1.6、美國 1.2、德國 1.0、日本 0.08。',
        en: 'Places tagged as trampoline parks in OpenStreetMap divided by 2024 population. There are 1,248 in 76 countries, led by the US (422), the UK (112), France (104) and Germany (84); Taiwan has 1. Per million people: Estonia 5.1, New Zealand 2.9, Iceland 2.5, Norway 2.5, Croatia 2.3 and Denmark 2.2; the UK 1.6, France 1.6, the US 1.2, Germany 1.0 and Japan 0.08.',
      },
      unit: PER,
      file: 'trampoline-parks-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.25, 0.5, 1, 1.5, 2, 3] } },
      format: perMillion,
      formatTick: (v) => `${v}`,
      panelChart: false,
    },
    {
      id: 'indoor-count',
      label: { zh: '室內娛樂場所的處數', en: 'Indoor entertainment venues' },
      description: {
        zh: 'OpenStreetMap 上各國的處數，子項目切換電子遊樂場、密室逃脫、彈跳床樂園（數字見上面三個指標的說明）。比例圓不看 OSM 覆蓋，畫得少的國家會偏低。',
        en: 'Counts by country in OpenStreetMap; sub-items switch between amusement arcades, escape rooms and trampoline parks (see the three indicators above for figures). Bubbles do not account for OSM coverage, so poorly mapped countries come out low.',
      },
      unit: { zh: '處', en: 'venues' },
      file: '{item}.json',
      dimension: {
        label: { zh: '種類', en: 'Type' },
        options: [
          { id: 'arcades', label: { zh: '電子遊樂場', en: 'Amusement arcades' } },
          { id: 'escape-games', label: { zh: '密室逃脫', en: 'Escape rooms' } },
          { id: 'trampoline-parks', label: { zh: '彈跳床樂園', en: 'Trampoline parks' } },
        ],
        defaultOption: 'arcades',
      },
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 處`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
  ],
};
