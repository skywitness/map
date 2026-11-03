import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

/**
 * 台灣的藥從哪裡來（2026-11-03，製作手冊第十九批 298；pipeline/topics/taiwan_medicines.py）：
 * 食藥署未註銷藥品許可證，依製造廠所在的國家數張數。
 */

const format = (v: number) => tr({ zh: `${fixed(v, 0)} 張`, en: `${fixed(v, 0)} licences` });

function licences(id: string, label: { zh: string; en: string }, description: { zh: string; en: string }, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: { zh: '張', en: 'licences' },
    file: `${id}.json`,
    timeless: true,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format,
    formatTick: (v) => fixed(v, 0),
  };
}

export const taiwanMedicines: TopicDefinition = {
  id: 'taiwan-medicines',
  title: { zh: '台灣的藥從哪裡來', en: 'Where Taiwan’s medicines are made' },
  shortTitle: { zh: '台灣的藥', en: 'Taiwan’s medicines' },
  defaultIndicator: 'all',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: {
        zh: '衛生福利部食品藥物管理署：未註銷藥品許可證資料集（data.gov.tw 9123）',
        en: 'Taiwan Food and Drug Administration: unrevoked drug licences (data.gov.tw 9123)',
      },
      url: 'https://data.gov.tw/dataset/9123',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, Taiwan 1.0' },
    },
  ],
  note: {
    zh: '食藥署每週更新的有效藥品許可證（2026 年 10 月 22 日的版本，共 25,964 張），依「製造廠國別」數張數；製造廠國別空白的 57 張不算。是許可證的張數，不是用量或金額：同一個成分常有很多張證（不同廠牌、劑量、劑型），一張證也不代表賣得多。進口藥的許可證由台灣的代理商申請，製造廠在國外。',
    en: 'Valid drug licences from Taiwan’s Food and Drug Administration, updated weekly (version of 22 October 2026, 25,964 licences), counted by the country of the manufacturing site; 57 with no country are left out. These are numbers of licences, not volumes or sales: one ingredient often has many licences (different brands, strengths and forms), and a licence says nothing about how much is sold. Imported drugs are licensed through a Taiwanese agent but made abroad.',
  },
  indicators: [
    licences(
      'all',
      { zh: '全部許可證', en: 'All licences' },
      {
        zh: '台灣有效的藥品許可證，依製造廠所在的國家：台灣 17,457 張（67%）、印度 1,583、德國 896、中國 823、日本 649、美國 621、義大利 560、法國 385、瑞士 380，共 56 個國家。',
        en: 'Valid drug licences in Taiwan by the country of the manufacturing site: Taiwan 17,457 (67%), India 1,583, Germany 896, China 823, Japan 649, the US 621, Italy 560, France 385 and Switzerland 380; 56 countries in all.',
      },
      [5, 20, 100, 300, 1000],
    ),
    licences(
      'products',
      { zh: '製劑（成藥與處方藥）', en: 'Finished medicines' },
      {
        zh: '「製劑」許可證：做好的藥（錠劑、膠囊、注射劑、藥膏等）。台灣 16,869 張（81%）最多，進口的以德國 547、日本 492、印度 361、法國 282、義大利 281、美國 252 較多。',
        en: 'Licences for finished medicines (tablets, capsules, injections, ointments and so on). Taiwan has by far the most, 16,869 (81%); among imports, Germany 547, Japan 492, India 361, France 282, Italy 281 and the US 252 lead.',
      },
      [5, 20, 100, 300, 1000],
    ),
    licences(
      'api',
      { zh: '原料藥', en: 'Active ingredients' },
      {
        zh: '「原料藥」許可證：做藥用的有效成分（藥廠買來做成製劑）。印度 1,208 張（39%）、中國 821（27%），兩國合計約三分之二；台灣 313（10%）、義大利 195、日本 89、西班牙 81。',
        en: 'Licences for active pharmaceutical ingredients (bought by drug makers to make finished medicines). India 1,208 (39%) and China 821 (27%) together supply about two-thirds; Taiwan 313 (10%), Italy 195, Japan 89 and Spain 81.',
      },
      [3, 10, 30, 100, 500],
    ),
    licences(
      'biologics',
      { zh: '生物藥品（菌疫）', en: 'Biologics and vaccines' },
      {
        zh: '「菌疫」許可證：疫苗、血液製劑與其他生物藥品。美國 347 張（18%）、德國 292、台灣 246、丹麥 119、瑞士 113、愛爾蘭 96。',
        en: 'Licences for biologics (vaccines, blood products and other biological medicines). The US 347 (18%), Germany 292, Taiwan 246, Denmark 119, Switzerland 113 and Ireland 96.',
      },
      [3, 10, 30, 100, 250],
    ),
  ],
};
