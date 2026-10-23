import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

export const happiness: TopicDefinition = {
  id: 'happiness',
  title: { zh: '各國幸福感', en: 'Happiness by country' },
  shortTitle: { zh: '幸福感', en: 'Happiness' },
  defaultIndicator: 'life-evaluation',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'Helliwell, J. F., Layard, R., Sachs, J. D., De Neve, J.-E., Aknin, L. B., & Wang, S. (Eds.). (2026). World Happiness Report 2026（Figure 2.1 的資料；資料來自 Gallup World Poll）',
        en: 'Helliwell, J. F., Layard, R., Sachs, J. D., De Neve, J.-E., Aknin, L. B., & Wang, S. (Eds.). (2026). World Happiness Report 2026 (data for Figure 2.1; data from the Gallup World Poll)',
      },
      url: 'https://worldhappiness.report/data-sharing/',
      license: {
        zh: '註明出處後可以轉載（WHR 的資料分享說明）',
        en: 'May be reproduced with the reference (WHR data sharing policy)',
      },
    },
  ],
  note: {
    zh: '分數是蓋洛普世界民調（每國每年約 1,000 人）的近三年平均，有抽樣誤差：差距在 0.1–0.2 分以內的國家，名次前後不一定有意義（點國家可以看到 95% 信賴區間）。台灣在《世界幸福報告》裡寫成「Taiwan Province of China」。排名表的名次依分數計算（同分同名次），跟報告公布的名次偶爾差 1（報告用沒有四捨五入的分數），側欄另外列出報告公布的名次。',
    en: "Scores are three-year averages from the Gallup World Poll (about 1,000 people per country per year) and carry sampling error: rank differences between countries within 0.1–0.2 points may not be meaningful (select a country to see the 95% confidence interval). The ranking table ranks by the score shown (ties share a rank), which occasionally differs by one place from the report's published rank, as the report ranks unrounded scores; the side panel also gives the published rank.",
  },
  panelExtra: () => import('./panels/HappinessPanel'),
  indicators: [
    {
      id: 'life-evaluation',
      label: { zh: '生活評價', en: 'Life evaluation' },
      description: {
        zh: '「把最好的生活想成 10 分、最壞的是 0 分，你覺得自己現在在第幾階？」的全國平均，是《世界幸福報告》排名用的分數。每一年是那一年與前兩年調查的平均（例如 2025 年是 2023–2025 年，《世界幸福報告 2026》公布）。',
        en: "The national average answer to 'imagine a ladder from 0, the worst possible life for you, to 10, the best possible life: which step are you on now?', the score the World Happiness Report ranks countries by. Each year is the average of that year's and the two previous years' surveys (2025, for example, covers 2023–2025 and was published in the World Happiness Report 2026).",
      },
      unit: { zh: '0–10 分', en: '0–10 scale' },
      file: 'life-evaluation.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [4, 5, 5.5, 6, 6.5, 7] } },
      // 報告公布到小數 3 位，2 位的話第 2、3 名（7.540、7.539）看起來同分卻不同名次
      format: (v) => tr({ zh: `${fixed(v, 3)} 分`, en: fixed(v, 3) }),
      formatTick: (v) => fixed(v, v % 1 === 0 ? 0 : 1),
    },
  ],
};
