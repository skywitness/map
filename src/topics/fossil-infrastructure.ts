import { tr, type Text } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { INFRA_OVERLAYS, REFINING_CAPACITY } from './fossil-fuels';
import type { PointsOverlayDef, TopicDefinition } from './types';

/**
 * 化石燃料的基礎建設（新主題，2026-11-07，製作手冊第二十七批 613，候選 1349、1351；能源・化石燃料）：
 * 使用者核准把「石油、天然氣與煤」拆成兩個主題，管線、LNG、油氣田、煤礦、煉油廠的圖層與煉油能力搬到這裡
 * （圖層的定義照舊在 fossil-fuels.ts 的 INFRA_OVERLAYS），新加煤礦、LNG、油氣田的國家合計與燃煤機組的技術等級
 * （pipeline/topics/fossil_infrastructure.py）。側欄 panels/FossilInfraPanel.tsx。
 */
const mt = (v: number) => tr({ zh: `每年 ${fixed(v, v < 10 ? 1 : 0)} 百萬公噸`, en: `${fixed(v, v < 10 ? 1 : 0)} Mt/y` });
const tick = (v: number) => fixed(v, 0);

/** 油田燒掉的天然氣（2026-11-08，製作手冊第二十七批 617，候選 1350；pipeline/topics/gas_flaring.py）：世界銀行 Data Catalog 2017–2021 */
const FLARE_KINDS: Text[] = [
  { zh: '上游（油田、氣田）', en: 'Upstream (oil and gas fields)' },
  { zh: '中游與下游（煉油廠、LNG、處理廠）', en: 'Mid- and downstream (refineries, LNG, processing plants)' },
];
const FLARES: PointsOverlayDef = {
  kind: 'points',
  id: 'flares',
  file: 'flares.json',
  label: { zh: '燃除的火炬（2021 年）', en: 'Gas flares (2021)' },
  indicators: ['flaring'],
  radius: { field: 'v', stops: [[1, 1.5], [50, 3], [300, 6], [1300, 10]] },
  color: {
    field: 'k',
    title: { zh: '位置', en: 'Location' },
    thresholds: [1.5],
    classes: FLARE_KINDS.map((label, i) => ({ color: [MAP_TOKENS.categorical[5], MAP_TOKENS.categorical[1]][i], label })),
  },
  sortField: 'v',
  tooltip: (p, { countryName }) => ({
    title: tr({ zh: `一年燒掉 ${fixed(Number(p.v), 1)} 百萬立方公尺`, en: `${fixed(Number(p.v), 1)} million m³ flared a year` }),
    detail: [tr(FLARE_KINDS[(Number(p.k) || 1) - 1]), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
  }),
};

export const fossilInfrastructure: TopicDefinition = {
  id: 'fossil-infrastructure',
  title: { zh: '化石燃料的基礎建設：管線、LNG、油氣田、煤礦與煉油廠', en: 'Fossil fuel infrastructure: pipelines, LNG, fields, mines and refineries' },
  shortTitle: { zh: '化石燃料的基礎建設', en: 'Fossil fuel infrastructure' },
  defaultIndicator: 'coal-mine-capacity',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: 'Global Energy Monitor：Global Gas Infrastructure Tracker、Global Oil Infrastructure Tracker、Global Oil and Gas Extraction Tracker、Global Coal Mine Tracker、Global Integrated Power Tracker',
        en: 'Global Energy Monitor: Global Gas Infrastructure Tracker, Global Oil Infrastructure Tracker, Global Oil and Gas Extraction Tracker, Global Coal Mine Tracker, Global Integrated Power Tracker',
      },
      url: 'https://globalenergymonitor.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '英文維基百科「List of oil refineries」與 Wikidata（煉油廠）', en: 'English Wikipedia, “List of oil refineries”, and Wikidata (refineries)' },
      url: 'https://en.wikipedia.org/wiki/List_of_oil_refineries',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '世界銀行 Data Catalog：Global Gas Flaring Database（0037743，2017–2021 年）', en: 'World Bank Data Catalog: Global Gas Flaring Database (0037743, 2017–2021)' },
      url: 'https://datacatalog.worldbank.org/search/dataset/0037743/global-gas-flaring-database',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '2026-11-07 從「石油、天然氣與煤」拆出來：這裡是「東西在哪裡」（管線、LNG 接收站、油氣田、煤礦、煉油廠與燃煤機組），產量、消費、貿易與價格留在原主題。資料是 Global Energy Monitor 2026 年的追蹤資料（管線與 LNG 2026 年 10 月、油氣田 3 月、煤礦 8 月、發電機組 9 月），只有一個時間點，不跟時間軸變；管線簡化到約 1 公里。煤礦的僱用人數是 GEM 從各種年報整理的，年份不一致，只當規模的參考。台灣沒有在開採的煤礦與油氣田，LNG 全靠進口。燃除量（2026-11-08 加）是世界銀行 2017–2021 年的衛星估計，時間軸只對這個指標有作用。',
    en: 'Split off from “Oil, gas and coal” on 7 November 2026: this topic shows where things are (pipelines, LNG terminals, oil and gas fields, coal mines, refineries and coal power units), while production, consumption, trade and prices remain in the original topic. Data are Global Energy Monitor trackers from 2026 (pipelines and LNG October, fields March, coal mines August, power units September), a single snapshot that does not change with the time slider; pipelines are simplified to about 1 km. Coal mine workforce figures are compiled by GEM from various reports of different years and are only a guide to scale. Taiwan has no working coal mines or oil and gas fields and imports all its LNG. Gas flaring (added 8 November 2026) is a World Bank satellite estimate for 2017–2021, and the time slider applies only to that indicator.',
  },
  panelExtra: () => import('./panels/FossilInfraPanel'),
  overlays: [...INFRA_OVERLAYS, FLARES],
  indicators: [
    {
      id: 'flaring',
      label: { zh: '油田燒掉的天然氣（燃除）', en: 'Gas flaring' },
      description: {
        zh: '衛星（VIIRS）看到的油氣田火炬一年燒掉多少天然氣，十億立方公尺（世界銀行 Global Gas Flaring Database，2017–2021 年，把每個火炬加總到國家），子項目切換上游（油田、氣田，一般說的燃除量）或全部（加煉油廠、LNG、處理廠）。2021 年上游俄羅斯 25.3 最多，伊拉克 17.8、伊朗 17.4、美國 8.7、委內瑞拉 8.2、阿爾及利亞 7.6、奈及利亞 6.6、墨西哥 6.5、利比亞 5.7、中國 2.5；全世界上游 141.0，五年都在 139–146 之間。俄羅斯從 2017 年的 19.9 增加、墨西哥從 3.8 增加。點是 2021 年的每一個火炬（大小是燒掉的量）。自己加總的數字可能跟世界銀行 GFMR 公布的國家數字略有出入；沙烏地與科威特的共管區算進世界合計、不算進國家。台灣沒有油氣田的燃除。',
        en: 'Natural gas burned by oil and gas flares seen by satellite (VIIRS), in billion cubic metres (World Bank Global Gas Flaring Database, 2017–2021, with individual flares summed by country); sub-items switch between upstream (oil and gas fields, the usual flaring figure) and all flares (adding refineries, LNG and processing plants). In 2021 upstream flaring was highest in Russia (25.3), followed by Iraq (17.8), Iran (17.4), the US (8.7), Venezuela (8.2), Algeria (7.6), Nigeria (6.6), Mexico (6.5), Libya (5.7) and China (2.5); the world upstream total was 141.0 and stayed between 139 and 146 over the five years. Russia rose from 19.9 in 2017 and Mexico from 3.8. Dots show every flare in 2021, sized by volume. These sums may differ slightly from the World Bank GFMR’s published country figures; the Saudi–Kuwaiti Neutral Zone counts towards the world total but not any country. Taiwan has no gas flaring.',
      },
      unit: { zh: '十億立方公尺', en: 'bcm' },
      file: 'flaring/{item}.json',
      dimension: {
        label: { zh: '範圍', en: 'Scope' },
        options: [
          { id: 'upstream', label: { zh: '上游（油田、氣田）', en: 'Upstream (oil and gas fields)' } },
          { id: 'all', label: { zh: '全部（含煉油廠、LNG、處理廠）', en: 'All (incl. refineries, LNG, processing)' } },
        ],
        defaultOption: 'upstream',
      },
      layer: { kind: 'bubble', legendValues: [0.5, 5, 25] },
      defaultYear: 2021,
      format: (v) => tr({ zh: `${fixed(v, v < 1 ? 2 : 1)} 十億立方公尺`, en: `${fixed(v, v < 1 ? 2 : 1)} bcm` }),
      formatTick: (v) => fixed(v, 1),
      shareOfWorld: true,
      missing: { zh: '衛星沒有看到燃除', en: 'No flaring detected' },
    },
    {
      id: 'coal-mine-capacity',
      label: { zh: '運轉中煤礦的產能', en: 'Capacity of operating coal mines' },
      description: {
        zh: '運轉中煤礦一年能產多少煤（GEM 有產能的礦合計）。中國每年 4,586 百萬公噸最多，美國 1,458、印度 1,392、澳洲 625、印尼 578、俄羅斯 299。運轉中 3,744 座煤礦裡，動力煤 2,296 座、冶金煤（焦煤）690 座、兩者都有 315 座、化工用煤 47 座。點地圖上的煤礦看煤種、礦型、僱用人數與所屬煤田。',
        en: 'How much coal operating mines can produce in a year (total for mines with capacity data in GEM). China leads with 4,586 million tonnes a year, then the US 1,458, India 1,392, Australia 625, Indonesia 578 and Russia 299. Of 3,744 operating mines, 2,296 produce thermal coal, 690 metallurgical (coking) coal, 315 both and 47 chemical coal. Hover a mine for its coal type, mining method, workforce and coalfield.',
      },
      unit: { zh: '百萬公噸/年', en: 'Mt/y' },
      file: 'coal-mine-capacity.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: mt,
      formatTick: tick,
      timeless: true,
      shareOfWorld: true,
      missing: { zh: 'GEM 沒有運轉中的煤礦', en: 'No operating coal mines in GEM' },
    },
    {
      id: 'coal-mine-workforce',
      label: { zh: '煤礦的僱用人數', en: 'Coal mine workforce' },
      description: {
        zh: '運轉中煤礦的僱用人數合計（GEM 有填的 3,666 座，約 302 萬人）。中國約 193 萬人，占六成以上；印度 266,410、印尼 172,620、俄羅斯 117,620、波蘭 80,997、越南 61,393、澳洲 56,137、南非 41,344、美國 37,487、北韓 22,557。人數是 GEM 從各種年報整理的，年份不一致，只當規模的參考，不是就業統計。',
        en: 'Total workforce at operating coal mines (3,666 mines with data in GEM, about 3.02 million people). China has about 1.93 million, over 60%; India 266,410, Indonesia 172,620, Russia 117,620, Poland 80,997, Vietnam 61,393, Australia 56,137, South Africa 41,344, the US 37,487 and North Korea 22,557. Figures are compiled by GEM from various reports of different years, a guide to scale rather than employment statistics.',
      },
      unit: { zh: '人', en: 'workers' },
      file: 'coal-mine-workforce.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 人`, en: `${fixed(v, 0)} workers` }),
      formatTick: formatLargeTick,
      timeless: true,
      shareOfWorld: true,
      missing: { zh: '沒有運轉中煤礦的人數', en: 'No workforce data for operating mines' },
    },
    {
      id: 'coal-plant-tech',
      label: { zh: '高效率燃煤機組的比例', en: 'Share of high-efficiency coal power' },
      description: {
        zh: '運轉中的燃煤發電容量裡，超臨界、超超臨界與 IGCC（煤氣化複循環）這些效率較高的技術占多少（技術不明的不算進分母，已知技術至少 1,000 MW 的國家）。南韓 91.9%、日本 79.3%、中國 64.2%、德國 59.1%；台灣 43.2%（亞臨界 9,193 MW、超臨界 3,000、超超臨界 4,000）、印度 36.3%、美國 34.0%、波蘭 22.3%、南非 21.3%。點國家看各技術的 MW。',
        en: 'Share of operating coal power capacity using higher-efficiency technology: supercritical, ultra-supercritical and IGCC (integrated gasification combined cycle), excluding capacity of unknown technology and countries with under 1,000 MW of known technology. South Korea 91.9%, Japan 79.3%, China 64.2% and Germany 59.1%; Taiwan 43.2% (9,193 MW subcritical, 3,000 supercritical, 4,000 ultra-supercritical), India 36.3%, the US 34.0%, Poland 22.3% and South Africa 21.3%. Click a country for MW by technology.',
      },
      unit: '%',
      file: 'coal-plant-tech.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 40, 60, 80] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
      timeless: true,
      missing: { zh: '已知技術的燃煤容量不到 1,000 MW', en: 'Under 1,000 MW of coal capacity with known technology' },
    },
    {
      id: 'lng-import',
      label: { zh: 'LNG 接收站的容量（進口）', en: 'LNG import terminal capacity' },
      description: {
        zh: '運轉中的液化天然氣（LNG）接收站一年能接收多少（百萬公噸）。日本 222.4 最多，中國 159.8、南韓 155.1、西班牙 62.4、印度 57.7、英國 40.1；台灣 21.5。地圖上有天然氣管線與 LNG 接收站。',
        en: 'Annual capacity of operating LNG import (regasification) terminals, in million tonnes. Japan leads with 222.4, then China 159.8, South Korea 155.1, Spain 62.4, India 57.7 and the UK 40.1; Taiwan 21.5. The map shows gas pipelines and LNG terminals.',
      },
      unit: { zh: '百萬公噸/年', en: 'Mt/y' },
      file: 'lng-import.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 200] },
      format: mt,
      formatTick: tick,
      timeless: true,
      shareOfWorld: true,
      missing: { zh: '沒有運轉中的 LNG 接收站', en: 'No operating LNG import terminals' },
    },
    {
      id: 'lng-export',
      label: { zh: 'LNG 液化廠的容量（出口）', en: 'LNG export terminal capacity' },
      description: {
        zh: '運轉中的天然氣液化廠一年能出口多少 LNG（百萬公噸）。美國 172.6 最多，澳洲 82.0、卡達 77.1、俄羅斯 41.7、馬來西亞 32.1、阿爾及利亞 25.3、奈及利亞 22.2。',
        en: 'Annual capacity of operating LNG export (liquefaction) plants, in million tonnes. The US leads with 172.6, then Australia 82.0, Qatar 77.1, Russia 41.7, Malaysia 32.1, Algeria 25.3 and Nigeria 22.2.',
      },
      unit: { zh: '百萬公噸/年', en: 'Mt/y' },
      file: 'lng-export.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 200] },
      format: mt,
      formatTick: tick,
      timeless: true,
      shareOfWorld: true,
      missing: { zh: '沒有運轉中的液化廠', en: 'No operating liquefaction plants' },
    },
    {
      id: 'field-output',
      label: { zh: '油氣田的產量', en: 'Oil and gas field output' },
      description: {
        zh: '生產中的油氣田一年的產量合計（百萬桶油當量，GEM 有產量的油氣田）。美國 12,756 最多，俄羅斯 4,827、加拿大 2,842、伊朗 2,789、中國 2,055、沙烏地阿拉伯 1,957、伊拉克 1,789、巴西 1,660。GEM 的油氣田不完整（例如美國的頁岩油多半是依區域整理），數字只是 GEM 收錄的。地圖上有油氣田與油管。',
        en: 'Total annual output of producing oil and gas fields (million barrels of oil equivalent, for fields with output in GEM). The US leads with 12,756, then Russia 4,827, Canada 2,842, Iran 2,789, China 2,055, Saudi Arabia 1,957, Iraq 1,789 and Brazil 1,660. GEM’s field coverage is incomplete, so figures cover only the fields it lists. The map shows fields and oil pipelines.',
      },
      unit: { zh: '百萬桶油當量/年', en: 'million boe/y' },
      file: 'field-output.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => tr({ zh: `每年 ${fixed(v, 0)} 百萬桶油當量`, en: `${fixed(v, 0)} million boe/y` }),
      formatTick: tick,
      timeless: true,
      shareOfWorld: true,
      missing: { zh: 'GEM 沒有生產中的油氣田產量', en: 'No producing fields with output in GEM' },
    },
    REFINING_CAPACITY,
  ],
};
