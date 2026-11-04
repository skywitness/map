import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 血漿製劑能不能自給（2026-11-04，製作手冊第二十批 322；pipeline/topics/plasma.py、sources/who_blood.py）：
 * WHO 血液安全報告 2025 附錄 9（PDF，CC BY-NC-SA 3.0 IGO）。每國用有值的最近一年（2014–2023），主題不分年份。
 * 跟「捐血率」不同：這裡是本國血漿能不能做成白蛋白、免疫球蛋白、凝血因子這些藥。
 */

const ARRANGEMENTS: CategoryDef[] = [
  { value: 1, label: { zh: '國內公立或非營利機構分餾', en: 'In-country, public or not-for-profit' } },
  { value: 2, label: { zh: '國內營利機構分餾', en: 'In-country, for-profit' } },
  { value: 3, label: { zh: '委託他國分餾', en: 'Contract fractionation abroad' } },
  { value: 4, label: { zh: '血漿賣給製造商', en: 'Plasma sold to manufacturers' } },
  { value: 5, label: { zh: '國內營利分餾＋賣給製造商', en: 'In-country for-profit + sold to manufacturers' }, hatch: { base: 2, stripes: 4 } },
];
const byValue = new Map(ARRANGEMENTS.map((c) => [c.value, c.label]));
const pct = (v: number) => `${fixed(v, 0)}%`;

export const plasma: TopicDefinition = {
  id: 'plasma',
  title: { zh: '血漿製劑能不能自給', en: 'Plasma-derived medicines: self-sufficiency' },
  shortTitle: { zh: '血漿製劑', en: 'Plasma medicines' },
  defaultIndicator: 'fractionation',
  defaultYear: 2023,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'WHO, Global status report on blood safety and availability 2025，附錄 9（各國以本國血漿分餾的血漿製劑，2014–2023）',
        en: 'WHO, Global status report on blood safety and availability 2025, annex 9 (plasma-derived medicinal products from domestic plasma, 2014–2023)',
      },
      url: 'https://iris.who.int/server/api/core/bitstreams/aa36bd85-6947-4097-adf6-f734922c8026/content',
      license: { zh: 'CC BY-NC-SA 3.0 IGO（非商業；資料檔也是）', en: 'CC BY-NC-SA 3.0 IGO (non-commercial; data files too)' },
    },
  ],
  note: {
    zh: '血漿製劑（PDMP）是把血漿「分餾」做成的藥：白蛋白（燒燙傷、休克）、靜脈注射免疫球蛋白（IVIG，免疫缺乏）、第八凝血因子（血友病）等。這個主題看的是一國用自己的血漿能做出多少，是醫藥產業與自主的問題，跟「有多少人去捐血」不同。資料來自 WHO 全球血液安全資料庫（GDBS）的各國回報，2014、2015、2017、2018、2023 年，每國用有值的最近一年（滑過國家看年份），約 57 國；「…」沒有回報與「—」沒有回覆都當成無資料，不是 0。台灣不在 WHO 的資料庫裡。',
    en: 'Plasma-derived medicinal products (PDMPs) are medicines made by fractionating plasma: albumin (burns, shock), intravenous immunoglobulin (IVIG, immune deficiency), factor VIII (haemophilia) and others. This topic shows how much a country can make from its own plasma, a question of industry and self-reliance rather than of how many people donate blood. Data are country reports to WHO’s Global Database on Blood Safety for 2014, 2015, 2017, 2018 and 2023; each country shows its latest year with a value (hover to see the year), about 57 countries. “Not reported” and “no response” are both treated as no data, not zero. Taiwan is not in WHO’s database.',
  },
  indicators: [
    {
      id: 'fractionation',
      label: { zh: '本國血漿怎麼做成藥', en: 'How domestic plasma is fractionated' },
      description: {
        zh: '本國採集的血漿交給誰分餾：國內的公立或非營利機構（澳洲、加拿大、中國、義大利、紐西蘭、南非等 25 國）、國內的營利公司（法國、西班牙、比利時等 8 國）、委託他國的工廠代工（日本、南韓、德國、美國、捷克、瑞士等 16 國），或直接把血漿賣給藥廠（挪威、印度、墨西哥等 7 國）；瑞典是國內營利分餾加賣給藥廠。',
        en: 'Who fractionates the plasma collected in the country: the public or not-for-profit sector at home (25 countries, including Australia, Canada, China, Italy, New Zealand and South Africa), for-profit companies at home (8, including France, Spain and Belgium), contract fractionation abroad (16, including Japan, South Korea, Germany, the US, Czechia and Switzerland), or plasma sold directly to manufacturers (7, including Norway, India and Mexico); Sweden both fractionates through for-profit companies and sells plasma.',
      },
      unit: { zh: '類別', en: 'category' },
      file: 'fractionation.json',
      layer: { kind: 'categorical', categories: ARRANGEMENTS },
      format: (v) => {
        const t = byValue.get(v);
        return t ? tr(t) : fixed(v, 0);
      },
      formatTick: (v) => fixed(v, 0),
      unranked: true,
    },
    {
      id: 'plasma-volume',
      label: { zh: '每千人用於分餾的血漿', en: 'Plasma for fractionation per 1,000 people' },
      description: {
        zh: '一年用於分餾（或賣給藥廠）的本國血漿，每千人幾公升。捷克 94.1 公升（2023 年）遠遠領先，丹麥 42.5、德國 36.1、澳洲 32.9、南韓 26.7、紐西蘭 21.1；墨西哥、烏茲別克 0.1、吉爾吉斯 0.2、巴西 0.4。',
        en: 'Domestic plasma used for fractionation (or sold to manufacturers) per 1,000 people a year, in litres. Czechia leads by far at 94.1 litres (2023), followed by Denmark 42.5, Germany 36.1, Australia 32.9, South Korea 26.7 and New Zealand 21.1; Mexico and Uzbekistan 0.1, Kyrgyzstan 0.2, Brazil 0.4.',
      },
      unit: { zh: '公升/千人', en: 'litres per 1,000' },
      file: 'plasma-volume.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 6, 10, 20, 35] } },
      format: (v) => tr({ zh: `每千人 ${fixed(v, 1)} 公升`, en: `${fixed(v, 1)} L per 1,000` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'self-reliance',
      label: { zh: '血漿製劑的自給率', en: 'Self-reliance in plasma-derived medicines' },
      description: {
        zh: '國內用的血漿製劑，有幾成是用本國血漿做的，選上方的「藥品」切換。白蛋白：澳洲、紐西蘭、挪威、捷克、丹麥、南非 100%，日本 67%、南韓 40%、智利 20%。IVIG：南韓、捷克、南非 100%，日本 83%，澳洲 41%、加拿大 17%、挪威 16%。第八凝血因子：澳洲、日本、南韓 100%，阿根廷 2%，丹麥、新加坡 0。',
        en: 'Share of the plasma-derived medicines used in the country that were made from domestic plasma; switch with “Medicine” above. Albumin: 100% in Australia, New Zealand, Norway, Czechia, Denmark and South Africa; Japan 67%, South Korea 40%, Chile 20%. IVIG: 100% in South Korea, Czechia and South Africa; Japan 83%; Australia 41%, Canada 17%, Norway 16%. Factor VIII: 100% in Australia, Japan and South Korea; Argentina 2%; zero in Denmark and Singapore.',
      },
      unit: '%',
      file: 'self-reliance-{item}.json',
      dimension: {
        label: { zh: '藥品', en: 'Medicine' },
        options: [
          { id: 'albumin', label: { zh: '白蛋白', en: 'Albumin' } },
          { id: 'ivig', label: { zh: '靜脈注射免疫球蛋白（IVIG）', en: 'Immunoglobulin (IVIG)' } },
          { id: 'f8', label: { zh: '第八凝血因子', en: 'Factor VIII' } },
        ],
        defaultOption: 'albumin',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 40, 60, 80, 99] } },
      format: pct,
      formatTick: (v) => `${v}%`,
    },
  ],
};
