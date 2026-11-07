import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 晶片的原料被誰扣住了：關鍵材料的出口管制（新主題，2026-11-07，製作手冊第二十七批 594，候選 1317；科技・運算與晶片）：
 * OECD 的原料出口管制清冊，只抓晶片與電子相關的 HS 碼（pipeline/topics/chip_materials.py）；
 * 側欄 panels/ChipMaterialsPanel.tsx 是這一國那一年的措施清單。
 */
export const MATERIAL_LABELS: Record<string, { zh: string; en: string }> = {
  'minor-metals': { zh: '鎵、鍺、銦等（8112）', en: 'Gallium, germanium, indium etc. (8112)' },
  graphite: { zh: '石墨', en: 'Graphite' },
  silicon: { zh: '矽', en: 'Silicon' },
  tungsten: { zh: '鎢', en: 'Tungsten' },
  antimony: { zh: '銻', en: 'Antimony' },
  cobalt: { zh: '鈷', en: 'Cobalt' },
  'rare-earths': { zh: '稀土', en: 'Rare earths' },
};

export const MEASURE_LABELS: Record<string, { zh: string; en: string }> = {
  M4: { zh: '出口禁令', en: 'Export ban' },
  M3: { zh: '出口配額', en: 'Export quota' },
  M6: { zh: '出口許可', en: 'Licensing requirement' },
  M1: { zh: '出口稅', en: 'Export tax' },
  M2: { zh: '出口附加稅', en: 'Export surtax' },
  M5: { zh: '財政性出口稅', en: 'Fiscal tax on exports' },
  M9: { zh: '取消或降低出口退稅', en: 'VAT rebate cut or withdrawn' },
  M12: { zh: '國內市場供應義務', en: 'Domestic market obligation' },
  M14: { zh: '其他出口措施', en: 'Other export measures' },
};

const STRICTEST: CategoryDef[] = [
  { value: 5, label: { zh: '出口禁令', en: 'Export ban' } },
  { value: 4, label: { zh: '出口配額', en: 'Export quota' } },
  { value: 3, label: { zh: '出口許可', en: 'Licensing requirement' } },
  { value: 2, label: { zh: '出口稅', en: 'Export tax' } },
  { value: 1, label: { zh: '其他措施（退稅、供應義務等）', en: 'Other measures (rebates, supply obligations etc.)' } },
  { value: 0, label: { zh: '沒有這類措施', en: 'No such measures' } },
];

const NOTE = {
  zh: '清冊收了 82 國（主要是原料出口國與 OECD 國家），台灣不在裡面；清冊外的國家灰色。',
  en: 'The inventory covers 82 countries (mainly raw-material exporters and OECD members); Taiwan is not among them, and countries outside it are grey.',
};

export const chipMaterials: TopicDefinition = {
  id: 'chip-materials',
  title: { zh: '晶片的原料被誰扣住了：關鍵材料的出口管制', en: 'Export restrictions on chip materials' },
  shortTitle: { zh: '晶片原料管制', en: 'Chip materials' },
  defaultIndicator: 'chip-material-strictest',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'OECD：Inventory of export restrictions on industrial raw materials（DF_QDD_TAD_EXP_RESTRIC）', en: 'OECD: Inventory of export restrictions on industrial raw materials (DF_QDD_TAD_EXP_RESTRIC)' },
      url: 'https://www.oecd.org/en/topics/sub-issues/trade-in-raw-materials.html',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: 'OECD 逐條整理各國對工業原料的出口限制（2009–2024 年）：出口禁令、配額、許可證、出口稅、取消出口退稅等。原本的清冊以廢鋼、木材這類為大宗，這裡只挑晶片與電子用得到的材料（HS2007）：鎵、鍺、銦等小金屬（811292、811299）與氧化鍺（282560）、石墨（2504、380110）、矽（2804）、鎢（2611、8101）、銻（2617、2825、8110）、鈷（2605、8105、2822）、稀土（280530、2846）。一項措施是「一個國家對一個 HS 碼的一種限制」，同一條規定套到好幾個 HS 碼就算好幾項，所以項數不等於嚴重程度；清冊只到 2024 年，之後的新措施（例如 2025 年中國的稀土管制）還沒收進來。',
    en: 'The OECD compiles each country’s export restrictions on industrial raw materials (2009–2024): bans, quotas, licensing, export taxes, withdrawn VAT rebates and more. The full inventory is dominated by scrap metal and timber, so only materials used in chips and electronics are picked out here (HS2007): minor metals such as gallium, germanium and indium (811292, 811299) and germanium oxide (282560), graphite (2504, 380110), silicon (2804), tungsten (2611, 8101), antimony (2617, 2825, 8110), cobalt (2605, 8105, 2822) and rare earths (280530, 2846). A measure is one restriction by one country on one HS code, so a rule applied to several codes counts several times and the count is not a measure of severity; the inventory ends in 2024, so later measures (such as China’s 2025 rare-earth controls) are not yet included.',
  },
  panelExtra: () => import('./panels/ChipMaterialsPanel'),
  indicators: [
    {
      id: 'chip-material-strictest',
      label: { zh: '最嚴的出口管制', en: 'Strictest export restriction' },
      description: {
        zh: `這一國對晶片相關材料最嚴的一種出口限制。2024 年有出口禁令的 7 國都在非洲與中亞：蒲隆地、剛果民主共和國、肯亞、奈及利亞、盧安達、辛巴威與塔吉克；瓜地馬拉是配額；中國、俄羅斯、印尼、緬甸、巴西、南非等 22 國最嚴的是出口許可；越南、阿根廷、幾內亞是出口稅；印度只有其他措施。清冊裡 46 國（含美國、日本、南韓、歐洲各國）沒有這類措施。${NOTE.zh}點國家看管了哪些材料。`,
        en: `The strictest kind of export restriction a country applies to chip-related materials. In 2024 the seven countries with export bans are all in Africa and Central Asia: Burundi, the DR Congo, Kenya, Nigeria, Rwanda, Zimbabwe and Tajikistan; Guatemala uses a quota; for 22 countries including China, Russia, Indonesia, Myanmar, Brazil and South Africa the strictest is licensing; Vietnam, Argentina and Guinea use export taxes, and India has only other measures. 46 countries in the inventory (including the US, Japan, South Korea and the European countries) have no such measures. ${NOTE.en} Click a country for the materials covered.`,
      },
      unit: '',
      file: 'strictest.json',
      layer: { kind: 'categorical', categories: STRICTEST, ordinal: true },
      format: (v) => tr(STRICTEST.find((c) => c.value === v)?.label ?? ''),
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
    {
      id: 'chip-material-measures',
      label: { zh: '出口管制措施的項數', en: 'Number of export restrictions' },
      description: {
        zh: `這一國對晶片相關材料有幾項出口限制（一個 HS 碼的一種限制算一項）。2024 年中國 30 項最多（鎵鍺等小金屬、稀土、銻、鎢、鈷都要出口許可，小金屬有幾項許可從 2023 年 8 月 1 日起），剛果民主共和國 26 項（主要是鈷）、緬甸 25、玻利維亞 18、俄羅斯 15、印度 14、馬達加斯加 13。${NOTE.zh}`,
        en: `How many export restrictions a country applies to chip-related materials (one restriction on one HS code counts once). In 2024 China has the most at 30 (licences for minor metals such as gallium and germanium, rare earths, antimony, tungsten and cobalt, some of the minor-metal licences dating from 1 August 2023), followed by the DR Congo 26 (mostly cobalt), Myanmar 25, Bolivia 18, Russia 15, India 14 and Madagascar 13. ${NOTE.en}`,
      },
      unit: { zh: '項', en: 'measures' },
      file: 'measures.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 6, 10, 20] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 項`, en: `${fixed(v, 0)} measures` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
    },
  ],
};
