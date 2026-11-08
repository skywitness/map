import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';
import { withTerritories } from './osm-territories';

/**
 * 通訊塔與行動基地台的密度（新主題，2026-11-07，製作手冊第二十七批 589，候選 1310；科技・網路與連線）：
 * OpenStreetMap 經 QLever，pipeline/topics/cell_towers.py；側欄 panels/CellTowersPanel.tsx 是 OSM 上的營運者前幾名。
 * 這張圖同時在量 OSM 畫得多完整，照網站的規則只替 OSM 畫得完整的國家上色。
 */
const density = (v: number) => fixed(v, v < 10 ? 1 : 0);
const OSM_NOTE = {
  zh: '只替 OpenStreetMap 畫得完整的國家上色（每千名餐飲業就業者至少 20 家餐飲店），人口不到 10 萬的不畫；就算畫得完整，基地台也常常沒畫，數字主要反映有沒有人去畫。',
  en: 'Only countries that OpenStreetMap covers well are shaded (at least 20 food and drink places per 1,000 food-service workers), and those under 100,000 people are not shown; even where coverage is good, base stations are often unmapped, so the numbers mostly reflect whether anyone has mapped them.',
};

export const cellTowers: TopicDefinition = {
  id: 'cell-towers',
  title: { zh: '通訊塔與行動基地台', en: 'Communication towers and mobile masts' },
  shortTitle: { zh: '通訊塔', en: 'Cell towers' },
  defaultIndicator: 'towers-density',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: 'OpenStreetMap 貢獻者：communication:mobile_phone=yes、tower:type=communication 與 operator（經 QLever 查詢，2026-11-07）',
        en: 'OpenStreetMap contributors: communication:mobile_phone=yes, tower:type=communication and operator (queried through QLever, 7 Nov 2026)',
      },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL 1.0',
    },
  ],
  note: withTerritories({
    zh: '資料是 OpenStreetMap 上有人畫的設施（© OpenStreetMap 貢獻者，資料檔依 ODbL 1.0 分享）：通訊塔是標成 tower:type=communication 的塔與桅桿（含廣播、微波中繼），行動電話的天線或基地台是標了 communication:mobile_phone=yes 的物件（可能是塔、屋頂上的天線或機房）。同一座塔上的幾家業者有時會畫成好幾個點。不是官方的基地台統計，台灣的國家通訊傳播委員會有基地台的統計，但沒有放在這裡（口徑不同）。',
    en: 'The data are facilities someone has mapped on OpenStreetMap (© OpenStreetMap contributors; data files shared under ODbL 1.0): communication towers are towers and masts tagged tower:type=communication (including broadcast and microwave relay), and mobile phone antennas or base stations are objects tagged communication:mobile_phone=yes (a tower, a rooftop antenna or an equipment room). Several operators on one tower are sometimes mapped as separate points. These are not official base-station statistics; Taiwan’s NCC publishes those, but they are not used here (different basis).',
  }),
  panelExtra: () => import('./panels/CellTowersPanel'),
  indicators: [
    {
      id: 'towers-density',
      label: { zh: '通訊塔的密度', en: 'Communication tower density' },
      description: {
        zh: `每萬平方公里有幾座通訊塔（OpenStreetMap 的 tower:type=communication，全世界 53.5 萬座）。荷蘭 3,152 座最多，馬爾地夫 2,181、盧森堡 1,496、葡萄牙 1,007、新加坡 829、德國 804、法國 801；日本 242、美國 137、台灣 115（407 座）、南韓 23。${OSM_NOTE.zh}`,
        en: `Communication towers per 10,000 km² (OpenStreetMap tower:type=communication, 534,500 worldwide). The Netherlands has the most at 3,152, followed by the Maldives 2,181, Luxembourg 1,496, Portugal 1,007, Singapore 829, Germany 804 and France 801; Japan 242, the US 137, Taiwan 115 (407 towers) and South Korea 23. ${OSM_NOTE.en}`,
      },
      unit: { zh: '座／萬平方公里', en: 'per 10,000 km²' },
      file: 'towers-density.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 30, 100, 300, 1000] } },
      format: (v) => tr({ zh: `每萬平方公里 ${density(v)} 座`, en: `${density(v)} per 10,000 km²` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'mobile-density',
      label: { zh: '行動電話天線與基地台的密度', en: 'Mobile phone antenna and base station density' },
      description: {
        zh: `每萬平方公里有幾個行動電話的天線或基地台（OpenStreetMap 的 communication:mobile_phone=yes，全世界 25.6 萬個）。比利時 2,532 個最多，葡萄牙 1,190、盧森堡 579、馬爾地夫 436、德國 409、瑞士 303、匈牙利 264、英國 233；美國 89、日本 84、台灣 40（141 個）、南韓 2.9。${OSM_NOTE.zh}`,
        en: `Mobile phone antennas or base stations per 10,000 km² (OpenStreetMap communication:mobile_phone=yes, 255,700 worldwide). Belgium has the most at 2,532, followed by Portugal 1,190, Luxembourg 579, the Maldives 436, Germany 409, Switzerland 303, Hungary 264 and the UK 233; the US 89, Japan 84, Taiwan 40 (141 sites) and South Korea 2.9. ${OSM_NOTE.en}`,
      },
      unit: { zh: '個／萬平方公里', en: 'per 10,000 km²' },
      file: 'mobile-density.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 20, 50, 100, 300] } },
      format: (v) => tr({ zh: `每萬平方公里 ${density(v)} 個`, en: `${density(v)} per 10,000 km²` }),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
