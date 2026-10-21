import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

function share(id: string, label: string, description: string, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: '%',
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: (v) => `${fixed(v, 1)}%`,
    formatTick: (v) => `${v}%`,
    compareWorld: true,
  };
}

export const sectors: TopicDefinition = {
  id: 'sectors',
  title: '各國產業結構',
  shortTitle: '產業結構',
  defaultIndicator: 'services',
  defaultYear: 2022,
  sources: [
    { name: 'World Bank, World Development Indicators', url: 'https://data.worldbank.org/', license: 'CC BY 4.0' },
    { name: '行政院主計總處 總體統計資料庫', url: 'https://nstatdb.dgbas.gov.tw/', license: '政府資料開放授權條款' },
  ],
  note: '台灣資料由行政院主計總處的各業 GDP 與就業人數計算。三業占 GDP 的比重加總略小於 100%，差額是產品稅。',
  panelExtra: () => import('./panels/SectorsPanel'),
  indicators: [
    share('agriculture', '農業占 GDP', '農、林、漁、牧業的附加價值占 GDP 的比例。', [2, 5, 10, 15, 25, 40]),
    share('industry', '工業占 GDP', '工業（製造、礦業、水電燃氣、營造）的附加價值占 GDP 的比例。', [10, 20, 25, 30, 40, 50]),
    share('manufacturing', '製造業占 GDP', '製造業的附加價值占 GDP 的比例，是工業的一部分。', [5, 10, 15, 20, 25, 30]),
    share('services', '服務業占 GDP', '批發零售、金融、運輸、醫療、教育等服務業的附加價值占 GDP 的比例。', [30, 40, 50, 60, 70, 80]),
    share('employment-agriculture', '農業就業占比', '在農、林、漁、牧業工作的人占就業人口的比例。', [2, 5, 10, 20, 40, 60]),
    share('employment-industry', '工業就業占比', '在工業部門工作的人占就業人口的比例。', [10, 15, 20, 25, 30, 35]),
    share('employment-services', '服務業就業占比', '在服務業工作的人占就業人口的比例。', [20, 35, 50, 60, 70, 80]),
  ],
};
