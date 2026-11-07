import { fixed } from '../lib/format';
import type { TopicPart } from './parts';
import type { DimensionDef, ScaleSpec } from './types';

/**
 * 產業結構與工業的擴充：ICT 產業占經濟多大，製造還是服務（2026-11-07，製作手冊第二十七批 596，候選 1319；
 * pipeline/topics/ict_sector.py）：Eurostat 的 ICT 部門占附加價值與就業，只有歐洲，所以照手冊的建議不開新主題。
 */
const pct = (v: number) => `${fixed(v, v < 1 ? 2 : 1)}%`;
const DIMENSION: DimensionDef = {
  label: { zh: 'ICT 部門', en: 'ICT sector' },
  options: [
    { id: 'all', label: { zh: 'ICT 部門', en: 'ICT sector' } },
    { id: 'manufacturing', label: { zh: 'ICT 製造業', en: 'ICT manufacturing' } },
    { id: 'services', label: { zh: 'ICT 服務業', en: 'ICT services' } },
  ],
  defaultOption: 'all',
};
const SCALES: Record<string, ScaleSpec> = {
  all: { type: 'sequential', thresholds: [3.5, 4.5, 5.5, 6.5, 8] },
  manufacturing: { type: 'sequential', thresholds: [0.1, 0.2, 0.3, 0.5, 1] },
  services: { type: 'sequential', thresholds: [3, 4, 5, 6, 8] },
};
const NOTE = {
  zh: 'Eurostat，只有歐洲國家（英國照網站的規則不收），各國最近一年（最多往前找 2 年）。ICT 製造是電腦、電子與光學產品等；ICT 服務是軟體出版、電信、電腦程式設計與資訊服務、電子產品的批發與維修。愛爾蘭有許多跨國科技公司把利潤記在當地，比例遠高於實際的生產活動。',
  en: 'Eurostat, European countries only (the UK is excluded under the site’s rules), each country’s latest year (up to 2 years back). ICT manufacturing covers computers, electronic and optical products and the like; ICT services cover software publishing, telecoms, programming and information services, and wholesale and repair of electronics. In Ireland many multinational tech firms book their profits locally, so its share far exceeds its actual production.',
};

export const ictSectorPart: TopicPart = {
  name: { zh: 'ICT 產業', en: 'ICT sector' },
  sources: [
    {
      name: { zh: 'Eurostat：Percentage of the ICT sector in GVA（isoc_bde15ag）、in total employment（isoc_bde15ap）', en: 'Eurostat: Percentage of the ICT sector in GVA (isoc_bde15ag) and in total employment (isoc_bde15ap)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/isoc_bde15ag/default/table',
      license: 'CC BY 4.0',
    },
  ],
  indicators: [
    {
      id: 'ict-gva',
      label: { zh: '占附加價值', en: 'share of value added' },
      description: {
        zh: `ICT 部門占總附加價值的 %（子項目可以分開看製造與服務，2008 年起）。2023 年愛爾蘭 30.9%（製造 13.6%、服務 17.4%）、馬爾他 11.7%、保加利亞 8.1%、塞爾維亞 7.4%、拉脫維亞 6.6%、瑞典 6.2%、愛沙尼亞 6.0%（2022 年）；阿爾巴尼亞 3.0%、義大利 3.1%、希臘 3.3% 最低。製造只有愛爾蘭（13.6%）、匈牙利（1.1%）超過 1%；服務是賽普勒斯 11.2%、馬爾他 11.0% 最高。${NOTE.zh}`,
        en: `The ICT sector’s share of total gross value added (sub-items split manufacturing and services, from 2008). In 2023 Ireland 30.9% (manufacturing 13.6%, services 17.4%), Malta 11.7%, Bulgaria 8.1%, Serbia 7.4%, Latvia 6.6%, Sweden 6.2% and Estonia 6.0% (2022); Albania 3.0%, Italy 3.1% and Greece 3.3% are lowest. Only Ireland (13.6%) and Hungary (1.1%) exceed 1% in ICT manufacturing; in services Cyprus (11.2%) and Malta (11.0%) lead. ${NOTE.en}`,
      },
      unit: '%',
      file: 'ict-gva/{item}.json',
      dimension: DIMENSION,
      layer: { kind: 'choropleth', scale: SCALES.all, itemScales: SCALES },
      format: pct,
      defaultYear: 'latest',
    },
    {
      id: 'ict-employment',
      label: { zh: '占就業', en: 'share of employment' },
      description: {
        zh: `ICT 部門的就業占全部就業的 %。2023 年愛爾蘭 6.1%、愛沙尼亞 6.0%（2022 年）、瑞典 4.8%、拉脫維亞與馬爾他 4.7%、芬蘭 4.2%、立陶宛 4.1%；希臘 1.9% 最低。附加價值的比例比就業高很多的地方（愛爾蘭、馬爾他、保加利亞），每個人創造的附加價值特別高，或有利潤移轉。${NOTE.zh}`,
        en: `ICT sector employment as a share of total employment. In 2023 Ireland 6.1%, Estonia 6.0% (2022), Sweden 4.8%, Latvia and Malta 4.7%, Finland 4.2% and Lithuania 4.1%; Greece is lowest at 1.9%. Where the value-added share far exceeds the employment share (Ireland, Malta, Bulgaria), value added per worker is unusually high or profits are shifted there. ${NOTE.en}`,
      },
      unit: '%',
      file: 'ict-employment/{item}.json',
      dimension: DIMENSION,
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [2.5, 3, 3.5, 4, 5] },
        itemScales: {
          all: { type: 'sequential', thresholds: [2.5, 3, 3.5, 4, 5] },
          manufacturing: { type: 'sequential', thresholds: [0.1, 0.2, 0.3, 0.5, 0.7] },
          services: { type: 'sequential', thresholds: [2.5, 3, 3.5, 4, 5] },
        },
      },
      format: pct,
      defaultYear: 'latest',
    },
  ],
};
