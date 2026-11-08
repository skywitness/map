import { tr } from '../i18n/lang';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 傳統醫學的制度（新主題，2026-11-08，製作手冊第二十九批 691，候選 1552、1544；pipeline/topics/tcm_systems.py）：
 * WHO 2024 年報告 Annex 1 的四次調查（194 個會員國有沒有回報），與 2019 年報告區域表的政策、法規國數（說明裡）。
 * 逐國的政策與法規等順序 704 從國家段落抽出來後再加指標。兩份報告 CC BY-NC-SA 3.0 IGO。
 */
const RESPONDED: CategoryDef[] = [
  { value: 1, label: { zh: '有回報', en: 'Responded' } },
  { value: 2, label: { zh: '沒有回報', en: 'Did not respond' } },
];

export const tcmSystems: TopicDefinition = {
  id: 'tcm-systems',
  title: { zh: '傳統醫學的制度：各國向 WHO 回報了幾次', en: 'Traditional medicine systems: reporting to WHO' },
  shortTitle: { zh: '傳統醫學的制度', en: 'Traditional medicine policy' },
  defaultIndicator: 'reports',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'WHO《WHO global report on traditional, complementary and integrative medicine 2024》Annex 1「WHO Member States that responded to the surveys by Region」',
        en: 'WHO, WHO global report on traditional, complementary and integrative medicine 2024, Annex 1 (Member States that responded to the surveys, by region)',
      },
      url: 'https://iris.who.int/server/api/core/bitstreams/f67507c0-30a3-41c0-b497-2fa9034b197d/content',
      license: 'CC BY-NC-SA 3.0 IGO',
    },
    {
      name: {
        zh: 'WHO《WHO global report on traditional and complementary medicine 2019》區域表 5.1–5.6',
        en: 'WHO, WHO global report on traditional and complementary medicine 2019, regional tables 5.1–5.6',
      },
      url: 'https://iris.who.int/server/api/core/bitstreams/a5de1ce2-b5c1-4c5d-b529-339bc5c47e24/content',
      license: 'CC BY-NC-SA 3.0 IGO',
    },
  ],
  note: {
    zh: '兩份 WHO 報告（CC BY-NC-SA 3.0 IGO，資料檔照同一授權）。各國的政策與法規只寫在 2019 年報告的國家段落裡，這裡先寫全球與分區的數：2018 年有國家級傳統醫學政策的 98 國（2005 年 45 國），非洲 40、西太平洋 17、美洲 11、歐洲 11、東南亞 10、東地中海 9；有法律或法規的 109 國（非洲 39、歐洲 21、美洲 15、西太平洋 13、東地中海 12、東南亞 9）；有國家級主管辦公室的 107 國、專家委員會 93 國、草藥納入藥品管理的 124 國。六區相加都等於報告的全球數。2023 年的第三次調查是政策 90 國、法規 90 國、辦公室 100 國、專家委員會 76 國、草藥管理 116 國，但只有 106 國回報，跟 2018 年的數不能直接比。台灣不是 WHO 會員國，不在調查裡；台灣有《中醫藥發展法》（2019 年 12 月 31 日公布）與衛福部中醫藥司，中醫門診由全民健保給付。',
    en: 'Two WHO reports (CC BY-NC-SA 3.0 IGO; the data files carry the same licence). Country-level policies and laws appear only in the country sections of the 2019 report, so global and regional counts are given here: in 2018, 98 countries had a national traditional medicine policy (45 in 2005), including 40 in Africa, 17 in the Western Pacific, 11 each in the Americas and Europe, 10 in South-East Asia and 9 in the Eastern Mediterranean; 109 had laws or regulations (Africa 39, Europe 21, the Americas 15, Western Pacific 13, Eastern Mediterranean 12, South-East Asia 9); 107 had a national office, 93 an expert committee and 124 regulated herbal medicines. The six regions add up to the report’s global figures. The third survey in 2023 found 90 with a policy, 90 with laws or regulations, 100 with an office, 76 with an expert committee and 116 regulating herbal medicines, but only 106 countries responded, so these are not directly comparable with 2018. Taiwan is not a WHO Member State and is not in the surveys; it has a Chinese Medicine Development Act (promulgated 31 December 2019) and a Department of Chinese Medicine and Pharmacy, and National Health Insurance covers Chinese medicine outpatient care.',
  },
  indicators: [
    {
      id: 'reports',
      label: { zh: '向 WHO 回報過幾次', en: 'Times reported to WHO' },
      description: { zh: 'WHO 做過四次傳統醫學的全球調查（2001、2012、2016–18 年的更新調查、2023 年），194 個會員國各回報過幾次。四次的回報國數是 142、134、114、106 國；四次都回報的 45 國，3 次 63 國、2 次 49 國、1 次 29 國，至少回報過一次的 186 國。從沒回報過的只有 8 國：阿爾及利亞、南蘇丹、聖克里斯多福及尼維斯、委內瑞拉、希臘、盧森堡、摩納哥、土庫曼。這張圖量的是有沒有填 WHO 的問卷，不是有沒有傳統醫學的制度：希臘、盧森堡沒回報，不代表那裡沒有。', en: 'WHO has run four global surveys on traditional medicine (2001, 2012, an update in 2016–18 and 2023); this shows how many each of the 194 Member States answered. The surveys drew 142, 134, 114 and 106 responses; 45 countries answered all four, 63 three, 49 two and 29 one, so 186 answered at least once. Only 8 never answered: Algeria, South Sudan, Saint Kitts and Nevis, Venezuela, Greece, Luxembourg, Monaco and Turkmenistan. This measures whether a country filled in WHO’s questionnaire, not whether it has traditional medicine policies: Greece and Luxembourg not answering does not mean they have none.' },
      unit: { zh: '次', en: 'surveys' },
      file: 'reports.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 4] } },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${v} 次`, en: `${v} of 4` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'responded',
      label: { zh: '每一次調查有沒有回報', en: 'Responded to each survey' },
      description: { zh: '拖時間軸看每一次調查哪些國家有回報：2001 年 142 國、2012 年 134 國、2016–18 年的更新調查 114 國（畫在 2018 年）、2023 年 106 國。2024 年報告說第二次調查另外用了 WHO 的全球與區域報告等資料補充，方法不同，所以有些項目看起來往下。', en: 'Drag the timeline to see which countries answered each survey: 142 in 2001, 134 in 2012, 114 in the 2016–18 update (shown at 2018) and 106 in 2023. The 2024 report notes that the second survey was supplemented with other sources such as WHO global and regional reports, so methodological differences make some items appear to fall.' },
      unit: '',
      file: 'responded.json',
      layer: { kind: 'categorical', categories: RESPONDED },
      unranked: true,
      format: (v) => tr(RESPONDED.find((c) => c.value === v)?.label ?? { zh: '', en: '' }),
    },
  ],
};
