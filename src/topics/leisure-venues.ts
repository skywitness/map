import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';
import type { TopicPart } from './parts';
import { withTerritories } from './osm-territories';

/**
 * 休閒運動場地（2026-11-07，製作手冊第二十四批 428；pipeline/topics/leisure_venues.py，資料在 diving/）：
 * OpenStreetMap 經 QLever 的三溫暖、滑冰場、保齡球館、飛行傘與跳傘、海水浴場與公共泳區、獨木舟。
 * 點全部畫；各國的每十萬人只替 OSM 覆蓋良好的國家上色。台灣的海水浴場另畫觀光署的海洋遊憩景點。
 */

interface Kind {
  value: number;
  label: Text;
  color: string;
}

function names(p: PointRecord, kinds: Kind[]): { title: string; proper?: string } {
  const n = String(p.n ?? '');
  const zh = String(p.nz ?? '');
  const en = String(p.ne ?? '');
  const kind = tr(kinds.find((k) => k.value === p.k)?.label ?? kinds[0].label);
  const unnamed = tr({ zh: `（沒有名稱的${kind}）`, en: '(unnamed)' });
  if (getLang() === 'zh') return zh ? { title: zh, proper: n && n !== zh ? n : en && en !== zh ? en : undefined } : { title: n || en || unnamed };
  return en ? { title: en, proper: n && n !== en ? n : undefined } : { title: n || zh || unnamed };
}

const kindText = (p: PointRecord, kinds: Kind[]) => tr(kinds.find((k) => k.value === p.k)?.label ?? kinds[0].label);

function overlay(id: string, file: string, label: Text, kinds: Kind[], indicators: string[]): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file,
    label,
    radius: 2.4,
    // 只有一類時用單一顏色（MapLibre 的 step 至少要一個門檻）
    color: kinds.length > 1 ? { field: 'k', title: { zh: '種類', en: 'Type' }, thresholds: kinds.slice(1).map((k) => k.value), classes: kinds } : kinds[0].color,
    indicators,
    tooltip: (p, { countryName }) => {
      const { title, proper } = names(p, kinds);
      return { title, detail: [kindText(p, kinds), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '), properNoun: proper };
    },
  };
}

function list(file: string, label: Text, kinds: Kind[], indicators: string[]): ListPanelDef {
  return {
    label,
    indicators,
    file,
    countryField: 'iso3',
    rows: (points, { countryName, country }) => {
      const collator = new Intl.Collator(getLang() === 'zh' ? 'zh-Hant-TW' : 'en');
      return points
        .filter((p) => (p.n || p.nz || p.ne) && typeof p.iso3 === 'string' && (!country || p.iso3 === country))
        .map((p) => ({ p, group: countryName(String(p.iso3)), name: names(p, kinds) }))
        .sort((a, b) => collator.compare(a.group, b.group) || Number(a.p.k) - Number(b.p.k) || collator.compare(a.name.title, b.name.title))
        .map(({ p, group, name }): ListRow => ({
          key: String(p.id),
          title: name.title,
          properNoun: name.proper,
          lines: kinds.length > 1 ? [kindText(p, kinds)] : [],
          group,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
        }));
    },
  };
}

const SAUNA: Kind[] = [{ value: 1, label: { zh: '三溫暖', en: 'Sauna' }, color: MAP_TOKENS.categorical[5] }];
const ICE: Kind[] = [{ value: 1, label: { zh: '滑冰場', en: 'Ice rink' }, color: MAP_TOKENS.categorical[1] }];
const BOWLING: Kind[] = [{ value: 1, label: { zh: '保齡球館', en: 'Bowling alley' }, color: MAP_TOKENS.categorical[6] }];
const FLYING: Kind[] = [
  { value: 1, label: { zh: '飛行傘、滑翔翼的起降場', en: 'Paragliding and hang-gliding site' }, color: MAP_TOKENS.categorical[2] },
  { value: 2, label: { zh: '跳傘場', en: 'Skydiving site' }, color: MAP_TOKENS.categorical[6] },
];
const WATER: Kind[] = [
  { value: 1, label: { zh: '海水浴場（有管理的海灘）', en: 'Beach resort (managed beach)' }, color: MAP_TOKENS.categorical[2] },
  { value: 2, label: { zh: '公共泳區（湖、河、海）', en: 'Swimming area (lake, river or sea)' }, color: MAP_TOKENS.categorical[0] },
  { value: 3, label: { zh: '台灣觀光署的海洋遊憩景點', en: 'Taiwan Tourism Administration marine recreation site' }, color: MAP_TOKENS.categorical[6] },
];
const CANOE: Kind[] = [{ value: 1, label: { zh: '獨木舟與輕艇場地', en: 'Canoe and kayak site' }, color: MAP_TOKENS.categorical[0] }];

const PER: Text = { zh: '處／十萬人', en: 'per 100,000 people' };
const digits = (v: number) => (v < 0.1 ? 3 : v < 1 ? 2 : 1);
const perText = (v: number) => tr({ zh: `每十萬人 ${fixed(v, digits(v))} 處`, en: `${fixed(v, digits(v))} per 100,000` });

function indicator(id: string, label: Text, description: Text, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: PER,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: perText,
    formatTick: (v) => fixed(v, v < 0.1 ? 2 : v < 1 ? 1 : 0),
    panelChart: false,
  };
}

export const leisureVenuesPart: TopicPart = {
  name: { zh: '三溫暖、滑冰場、保齡球館、飛行傘、海水浴場與獨木舟', en: 'Saunas, ice rinks, bowling, paragliding, beaches and canoeing' },
  sources: [
    {
      name: { zh: '交通部觀光署 具海洋遊憩活動之景點設施', en: 'Taiwan Tourism Administration, marine recreation sites' },
      url: 'https://data.gov.tw/dataset/135722',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: withTerritories({
    zh: '點是 OpenStreetMap 上標成三溫暖（leisure=sauna）、滑冰場（ice_rink）、保齡球館（bowling_alley）、海水浴場（beach_resort）、公共泳區（swimming_area）、飛行傘與滑翔翼的起降場（sport=free_flying、paragliding）、跳傘場（parachuting）與獨木舟（canoe）的地方，2026 年 11 月的快照（© OpenStreetMap contributors，資料檔依 ODbL 1.0 分享），不是官方名錄：有人畫才有，私人住宅裡的三溫暖通常不會畫上去，各國的差距有一部分是測繪習慣的不同。畫成面或線的取中心當點。每十萬人的面量圖只替 OSM 覆蓋良好的國家上色（判準跟潛水中心相同），人口是聯合國 2025 年的推估。滑冰場不算 sport 標籤或名稱寫明是旱冰（直排輪、滑輪溜冰）的；台灣標成冰場的 70 筆逐筆看過，69 筆是學校、公園的旱冰場，只算桃園滑冰運動世界。台灣的海水浴場在 OSM 上只有 4 處，另畫交通部觀光署的 41 處海洋遊憩景點（不算進各國的數字）。',
    en: 'Dots are places tagged on OpenStreetMap as saunas (leisure=sauna), ice rinks (ice_rink), bowling alleys (bowling_alley), beach resorts (beach_resort), swimming areas (swimming_area), paragliding and hang-gliding sites (sport=free_flying, paragliding), skydiving sites (parachuting) and canoeing (canoe), as of November 2026 (© OpenStreetMap contributors; the data files are shared under ODbL 1.0). This is not an official directory: only what volunteers have mapped appears, saunas in private homes are rarely mapped, and part of the difference between countries comes from mapping habits. Areas and lines are drawn at their centre. The per-100,000 choropleths colour only countries where OSM is reasonably complete (the same test as for dive centres), using UN population estimates for 2025. Ice rinks exclude those whose sport tag or name marks them as roller rinks; Taiwan’s 70 places tagged as ice rinks were checked one by one, and 69 are school or park roller rinks, so only Taoyuan Ice Skating World counts. Taiwan has only 4 beach resorts on OSM, so the Tourism Administration’s 41 marine recreation sites are also drawn (not counted in the country figures).',
  }),
  overlays: [
    overlay('saunas', 'saunas-points.json', { zh: '三溫暖', en: 'Saunas' }, SAUNA, ['saunas']),
    overlay('ice-rinks', 'ice-rinks-points.json', { zh: '滑冰場', en: 'Ice rinks' }, ICE, ['ice-rinks']),
    overlay('bowling', 'bowling-points.json', { zh: '保齡球館', en: 'Bowling alleys' }, BOWLING, ['bowling']),
    overlay('flying', 'flying-points.json', { zh: '飛行傘與跳傘', en: 'Paragliding and skydiving' }, FLYING, ['free-flying', 'parachuting']),
    overlay('beaches', 'beaches-points.json', { zh: '海水浴場與公共泳區', en: 'Beach resorts and swimming areas' }, WATER, ['beach-resorts', 'swimming-areas']),
    overlay('canoe', 'canoe-points.json', { zh: '獨木舟與輕艇', en: 'Canoeing and kayaking' }, CANOE, ['canoe']),
  ],
  listPanel: [
    list('saunas-points.json', { zh: '三溫暖（依國家）', en: 'Saunas by country' }, SAUNA, ['saunas']),
    list('ice-rinks-points.json', { zh: '滑冰場（依國家）', en: 'Ice rinks by country' }, ICE, ['ice-rinks']),
    list('bowling-points.json', { zh: '保齡球館（依國家）', en: 'Bowling alleys by country' }, BOWLING, ['bowling']),
    list('flying-points.json', { zh: '飛行傘與跳傘（依國家）', en: 'Paragliding and skydiving by country' }, FLYING, ['free-flying', 'parachuting']),
    list('beaches-points.json', { zh: '海水浴場與公共泳區（依國家）', en: 'Beaches and swimming areas by country' }, WATER, ['beach-resorts', 'swimming-areas']),
    list('canoe-points.json', { zh: '獨木舟與輕艇（依國家）', en: 'Canoeing and kayaking by country' }, CANOE, ['canoe']),
  ],
  indicators: [
    indicator(
      'saunas',
      { zh: '三溫暖', en: 'Saunas' },
      {
        zh: 'OpenStreetMap 上的三溫暖，全世界 18,120 處、130 個國家或地區：俄羅斯 4,678 處、芬蘭 3,686、德國 1,501、南韓 913、日本 817、烏克蘭 620、白俄羅斯 511；台灣 18 處。每十萬人芬蘭 65.5 處，是第二名拉脫維亞 7.9 的 8 倍多，愛沙尼亞 7.4、冰島 7.0、白俄羅斯 5.7、瑞典 3.5、俄羅斯 3.2；德國 1.8、南韓 1.8、日本 0.66、台灣 0.078。畫的是公共與商業的三溫暖（含飯店、健身房、泳池附設的），私人住宅裡的通常不在地圖上。',
        en: 'Saunas on OpenStreetMap: 18,120 in 130 countries and territories. Russia has 4,678, Finland 3,686, Germany 1,501, South Korea 913, Japan 817, Ukraine 620 and Belarus 511; Taiwan has 18. Per 100,000 people Finland has 65.5, more than eight times second-placed Latvia at 7.9, followed by Estonia 7.4, Iceland 7.0, Belarus 5.7, Sweden 3.5 and Russia 3.2; Germany 1.8, South Korea 1.8, Japan 0.66 and Taiwan 0.078. These are public and commercial saunas (including those in hotels, gyms and pools); saunas in private homes are rarely mapped.',
      },
      [0.5, 1, 2, 5, 10, 30],
    ),
    indicator(
      'ice-rinks',
      { zh: '滑冰場', en: 'Ice rinks' },
      {
        zh: 'OpenStreetMap 上的滑冰場（標成旱冰的不算），全世界 9,942 處、94 個國家或地區：加拿大 3,068 處、美國 2,006、俄羅斯 1,365、芬蘭 654、荷蘭 451、瑞典 297。每十萬人芬蘭 11.6 處、加拿大 7.6、拉脫維亞 3.5、瑞典 2.8、荷蘭 2.5；美國 0.58、德國 0.23、日本 0.069。台灣標成冰場的 70 筆裡 69 筆是旱冰場，只算桃園滑冰運動世界 1 處。',
        en: 'Ice rinks on OpenStreetMap (excluding those marked as roller rinks): 9,942 in 94 countries and territories. Canada has 3,068, the US 2,006, Russia 1,365, Finland 654, the Netherlands 451 and Sweden 297. Per 100,000 people Finland has 11.6, Canada 7.6, Latvia 3.5, Sweden 2.8 and the Netherlands 2.5; the US 0.58, Germany 0.23 and Japan 0.069. Of Taiwan’s 70 places tagged as ice rinks, 69 are roller rinks, so only Taoyuan Ice Skating World is counted.',
      },
      [0.1, 0.25, 0.5, 1, 2.5, 5],
    ),
    indicator(
      'bowling',
      { zh: '保齡球館', en: 'Bowling alleys' },
      {
        zh: 'OpenStreetMap 上的保齡球館，全世界 6,430 處、132 個國家或地區：美國 2,348 處、德國 730、法國 325、加拿大 295、日本 294、英國 281；台灣 14 處。每十萬人斯洛伐克 1.37 最多，芬蘭 1.12、庫拉索 1.08、丹麥 1.05、阿魯巴 0.93、德國 0.87、捷克 0.87；美國 0.68、日本 0.24、南韓 0.20、台灣 0.061。',
        en: 'Bowling alleys on OpenStreetMap: 6,430 in 132 countries and territories. The US has 2,348, Germany 730, France 325, Canada 295, Japan 294 and the UK 281; Taiwan has 14. Per 100,000 people Slovakia leads with 1.37, followed by Finland 1.12, Curaçao 1.08, Denmark 1.05, Aruba 0.93, Germany 0.87 and Czechia 0.87; the US 0.68, Japan 0.24, South Korea 0.20 and Taiwan 0.061.',
      },
      [0.1, 0.2, 0.4, 0.6, 0.8, 1],
    ),
    indicator(
      'free-flying',
      { zh: '飛行傘起降場', en: 'Paragliding sites' },
      {
        zh: 'OpenStreetMap 上的飛行傘、滑翔翼起降場，全世界 7,247 處、81 個國家或地區：挪威 2,376 處，約占全世界三分之一，法國 1,785、德國 460、瑞士 431、義大利 318、奧地利 254；台灣 5 處。每十萬人挪威 42.3，瑞士 4.8、斯洛維尼亞 3.1、奧地利 2.8、法國 2.7。',
        en: 'Paragliding and hang-gliding sites on OpenStreetMap: 7,247 in 81 countries and territories. Norway has 2,376, about a third of the world total, followed by France 1,785, Germany 460, Switzerland 431, Italy 318 and Austria 254; Taiwan has 5. Per 100,000 people Norway has 42.3, Switzerland 4.8, Slovenia 3.1, Austria 2.8 and France 2.7.',
      },
      [0.05, 0.1, 0.25, 0.5, 1, 3],
    ),
    indicator(
      'parachuting',
      { zh: '跳傘場', en: 'Skydiving sites' },
      {
        zh: 'OpenStreetMap 上的跳傘場，全世界只有 202 處、41 個國家或地區：德國 35 處、法國 26、美國 19、澳洲 15、義大利 10；台灣沒有。每十萬人挪威 0.14、芬蘭 0.12、丹麥 0.10 最多。OSM 上標成跳傘場的地方很少，只能看大概。',
        en: 'Skydiving sites on OpenStreetMap: only 202 in 41 countries and territories. Germany has 35, France 26, the US 19, Australia 15 and Italy 10; Taiwan has none. Per 100,000 people Norway (0.14), Finland (0.12) and Denmark (0.10) lead. Few places are tagged as skydiving sites, so treat the map as a rough guide.',
      },
      [0.01, 0.02, 0.04, 0.08, 0.12],
    ),
    indicator(
      'beach-resorts',
      { zh: '海水浴場', en: 'Beach resorts' },
      {
        zh: 'OpenStreetMap 上的海水浴場（有人管理、有設施的海灘），全世界 15,646 處、165 個國家或地區：義大利 5,496 處，占全世界 35%，菲律賓 1,330、希臘 1,091、俄羅斯 1,081、烏克蘭 583、阿根廷 512、西班牙 444。每十萬人蒙特內哥羅 12.3、希臘 11.0、義大利 9.3、維德角 6.8、賽普勒斯 4.0。台灣 OSM 上只有 4 處，地圖另畫觀光署的 41 處海洋遊憩景點（紫色）。',
        en: 'Beach resorts (managed beaches with facilities) on OpenStreetMap: 15,646 in 165 countries and territories. Italy has 5,496, 35% of the world total, followed by the Philippines 1,330, Greece 1,091, Russia 1,081, Ukraine 583, Argentina 512 and Spain 444. Per 100,000 people Montenegro has 12.3, Greece 11.0, Italy 9.3, Cabo Verde 6.8 and Cyprus 4.0. Taiwan has only 4 on OSM, so the Tourism Administration’s 41 marine recreation sites are also drawn (purple).',
      },
      [0.1, 0.25, 0.5, 1, 3, 8],
    ),
    indicator(
      'swimming-areas',
      { zh: '公共泳區（湖、河、海）', en: 'Swimming areas (lakes, rivers, sea)' },
      {
        zh: 'OpenStreetMap 上劃給人游泳的湖、河或海的水域，全世界 6,859 處、111 個國家或地區：德國 1,058 處、美國 821、愛沙尼亞 540、法國 469、芬蘭 375；台灣 1 處。每十萬人愛沙尼亞 40.2 最多，阿魯巴 12.0、蒙特內哥羅 8.1、芬蘭 6.7、挪威 4.2、克羅埃西亞 3.9、瑞典 2.6。標得多的國家多半在歐洲，其他地方少不代表沒有野外泳區。',
        en: 'Areas of lakes, rivers or the sea marked for swimming on OpenStreetMap: 6,859 in 111 countries and territories. Germany has 1,058, the US 821, Estonia 540, France 469 and Finland 375; Taiwan has 1. Per 100,000 people Estonia leads with 40.2, followed by Aruba 12.0, Montenegro 8.1, Finland 6.7, Norway 4.2, Croatia 3.9 and Sweden 2.6. Most countries that use this tag heavily are in Europe; few elsewhere does not mean there are no outdoor swimming spots.',
      },
      [0.1, 0.25, 0.5, 1, 2.5, 5],
    ),
    indicator(
      'canoe',
      { zh: '獨木舟與輕艇', en: 'Canoeing and kayaking' },
      {
        zh: 'OpenStreetMap 上標成獨木舟、輕艇的地方，全世界 3,160 處、81 個國家或地區：德國 779 處、加拿大 527、法國 461、美國 188、波蘭 150；台灣 1 處。每十萬人加拿大 1.31、馬爾地夫 0.94、德國 0.93、法國 0.69、匈牙利 0.65。',
        en: 'Places tagged for canoeing and kayaking on OpenStreetMap: 3,160 in 81 countries and territories. Germany has 779, Canada 527, France 461, the US 188 and Poland 150; Taiwan has 1. Per 100,000 people Canada has 1.31, the Maldives 0.94, Germany 0.93, France 0.69 and Hungary 0.65.',
      },
      [0.05, 0.1, 0.25, 0.5, 1],
    ),
  ],
};
