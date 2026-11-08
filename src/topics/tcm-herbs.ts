import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 中藥材從哪裡來（新主題，2026-11-08，製作手冊第二十九批 692，候選 1583、1584；pipeline/topics/tcm_herbs.py）：
 * 臺灣中藥典第四版的基原植物 × Kew WCVP 的原生分布。原生地不是產地；清單列出選到的國家原生的種。
 */
const str = (v: unknown) => (typeof v === 'string' && v ? v : '');
const countries = (n: unknown) =>
  Number(n) === 1 ? tr({ zh: '只原生在這一國', en: 'Native only here' }) : tr({ zh: `原生在 ${n} 個國家或地區`, en: `Native to ${n} countries and territories` });

const SPECIES_LIST: ListPanelDef = {
  label: { zh: '原生的藥典基原植物', en: 'Native pharmacopoeia plants' },
  tabLabel: { zh: '植物', en: 'Plants' },
  indicators: ['native', 'endemic'],
  file: 'species.json',
  countryField: 'iso3',
  empty: { zh: '這裡沒有原生的藥典基原植物', en: 'No native pharmacopoeia plants here' },
  rows: (points: PointRecord[]) =>
    [...points]
      .sort((a, b) => Number(a.n) - Number(b.n) || str(a.sci).localeCompare(str(b.sci)))
      .map((p, i): ListRow => ({
        key: `sp-${i}`,
        title: getLang() === 'zh' ? str(p.zh) : str(p.sci),
        titleProper: getLang() !== 'zh',
        properNoun: getLang() === 'zh' ? str(p.sci) : undefined,
        lines: [countries(p.n)],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 4 },
      })),
};

export const tcmHerbs: TopicDefinition = {
  id: 'tcm-herbs',
  title: { zh: '中藥材從哪裡來：藥典的基原植物原生在哪裡', en: 'Where Chinese herbal medicines come from: native ranges of pharmacopoeia plants' },
  shortTitle: { zh: '中藥材從哪裡來', en: 'Chinese herbal medicines' },
  defaultIndicator: 'native',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '衛生福利部《臺灣中藥典》第四版英文版（Taiwan Herbal Pharmacopeia 4th Edition，2022-06-01 生效）各品項的基原',
        en: 'Taiwan Ministry of Health and Welfare, Taiwan Herbal Pharmacopeia 4th Edition (English edition, in force from 1 June 2022): botanical sources of each monograph',
      },
      url: 'https://www.mohw.gov.tw/dl-81227-a4342f00-f6fe-4347-8a17-058b7d6d0d89.html',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: {
        zh: 'The World Checklist of Vascular Plants (WCVP)，Royal Botanic Gardens, Kew（2026-06-04 版的原生分布）',
        en: 'The World Checklist of Vascular Plants (WCVP), facilitated by the Royal Botanic Gardens, Kew (native distributions, 4 June 2026 release)',
      },
      url: 'https://doi.org/10.34885/egs6-cp24',
      license: 'CC BY 3.0',
    },
    {
      name: { zh: 'TDWG World Geographical Scheme for Recording Plant Distributions（地區對國家）', en: 'TDWG World Geographical Scheme for Recording Plant Distributions (regions to countries)' },
      url: 'https://github.com/tdwg/wgsrpd',
      license: { zh: 'TDWG 標準（只用地區代碼與國家代碼的對照）', en: 'TDWG standard (only the region-to-country code correspondence)' },
    },
  ],
  note: {
    zh: '藥材清單是臺灣中藥典第四版（英文版）每一個品項的基原說明裡的學名，對到 Kew 的世界維管束植物名錄（WCVP）的接受種：319 個品項、350 種植物；動物、真菌、礦物不算。WCVP 記的是每一種的原生分布（TDWG 的「植物學國家」），只算原生，引進與存疑的不算；一個地區跨好幾國時每一國都算，但「中國東南」那一區含金門、馬祖與澳門，只算中國，台灣只算 TDWG 的「台灣」那一區。原生地不是產地：當歸只原生在中國，日本、韓國也有栽培；這張圖不是看哪裡種、從哪裡出口。',
    en: 'The plant list is the scientific names in the botanical-source statement of each monograph in the Taiwan Herbal Pharmacopeia, 4th edition (English edition), matched to accepted species in Kew’s World Checklist of Vascular Plants (WCVP): 319 monographs and 350 plant species; animals, fungi and minerals are not included. WCVP records each species’ native range by TDWG “botanical country”; only native records count, not introduced or doubtful ones. A region spanning several countries counts for each of them, except that the “China Southeast” region, which includes Kinmen, Matsu and Macao, counts only for China, and Taiwan counts only the TDWG “Taiwan” region. Native range is not where a plant is grown: Chinese angelica is native only to China but is also cultivated in Japan and Korea, and this map says nothing about cultivation or exports.',
  },
  listPanel: [SPECIES_LIST],
  indicators: [
    {
      id: 'native',
      label: { zh: '原生的藥典基原植物', en: 'Native pharmacopoeia plants' },
      description: { zh: '各國原生的臺灣中藥典基原植物有幾種（350 種裡）。224 個國家或地區有至少一種：中國 305 種最多，南韓與北韓各 134、日本 125、越南 125、俄羅斯 119、印度 118、台灣 113、緬甸 82、尼泊爾 75、不丹 75。分布最廣的是蘆根（蘆葦）137 國、香附 133 國、蒺藜 111 國、燈心草 98 國。左邊列出選到的國家原生的種，越獨特的排越前面。', en: 'How many of the 350 Taiwan Herbal Pharmacopeia source plants are native to each country. 224 countries and territories have at least one: China has the most (305), followed by South and North Korea (134 each), Japan (125), Vietnam (125), Russia (119), India (118), Taiwan (113), Myanmar (82), Nepal (75) and Bhutan (75). The most widespread are common reed (Phragmites australis, 137 countries), nutgrass (Cyperus rotundus, 133), puncturevine (Tribulus terrestris, 111) and soft rush (Juncus effusus, 98). The list on the left shows the species native to the selected country, most distinctive first.' },
      unit: { zh: '種', en: 'species' },
      file: 'native.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 25, 50, 100, 200] } },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 種`, en: `${fixed(v, 0)} species` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'endemic',
      label: { zh: '只原生在這一國的', en: 'Native only to this country' },
      description: { zh: '350 種裡有 64 種只原生在一個國家：中國 54 種（例如當歸、杜仲、山茱萸、延胡索、連翹、厚朴、枸杞與幾種川貝母、淫羊藿），印尼 3 種（肉豆蔻、丁香與豆蔻的一種），印度 2 種（薑黃與豆蔻的另一種），菲律賓的檳榔、尼泊爾的天南星、希臘的番紅花、日本的佩蘭、斯里蘭卡的胡椒各 1 種。台灣原生的 113 種沒有一種只長在台灣。「只原生在一國」是 WCVP 的原生分布判定，不是只有那裡種得出來。', en: '64 of the 350 species are native to a single country: 54 to China (including Chinese angelica, eucommia, Asiatic dogwood, yanhusuo, forsythia, magnolia bark, goji and several fritillaries and epimediums), 3 to Indonesia (nutmeg, clove and one of the cardamom sources), 2 to India (turmeric and the other cardamom source), and one each to the Philippines (areca palm), Nepal (an Arisaema), Greece (saffron crocus), Japan (an Eupatorium) and Sri Lanka (black pepper). None of Taiwan’s 113 native species is found only in Taiwan. “Native to one country” is WCVP’s native-range assessment, not a claim that the plant can only be grown there.' },
      unit: { zh: '種', en: 'species' },
      file: 'endemic.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 50] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 種`, en: `${fixed(v, 0)} species` }),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
