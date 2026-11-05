import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

/**
 * 六個因素各「解釋」了多少分（2026-11-04，主題盤點的擴2：原本只畫在側欄，改成也是地圖指標；資料是同一個檔，
 * pipeline/topics/happiness.py 的 factors/*.json）。《世界幸福報告》用迴歸把各國的分數拆成六個因素比假想最差的國家
 * （反烏托邦）高出多少分，再加上反烏托邦基準與殘差；2019 年（報告 2020）起才有。數字是「這個因素貢獻了幾分」，不是因素本身
 */
function factor(id: string, label: { zh: string; en: string }, extra: { zh: string; en: string }, thresholds: number[]): IndicatorDef {
  return {
    id: `factor-${id}`,
    // 中文名稱以英文字母結尾時（人均 GDP）照網站的排版習慣空一格
    label: { zh: `${label.zh}${/[A-Za-z]$/.test(label.zh) ? ' ' : ''}解釋的分數`, en: `Explained by ${label.en}` },
    description: {
      zh: `《世界幸福報告》把各國的生活評價拆成六個因素，這是「${label.zh}」比假想最差的國家高出、因此多出來的分數（不是${label.zh}本身）。${extra.zh}2019 年起才有。`,
      en: `The World Happiness Report splits each country's life evaluation into six factors; this is how many points ${label.en} adds compared with a hypothetical worst country (it is not the factor itself). ${extra.en} Available from 2019.`,
    },
    unit: { zh: '分', en: 'points' },
    file: `factors/${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: (v) => tr({ zh: `${fixed(v, 3)} 分`, en: fixed(v, 3) }),
    formatTick: (v) => fixed(v, v % 1 === 0 ? 0 : 2),
  };
}

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
    factor('gdp', { zh: '人均 GDP', en: 'GDP per capita' }, {
      zh: '2025 年新加坡 2.17、盧森堡 2.16 分最多，台灣 1.96、日本 1.86、中國 1.66。',
      en: 'In 2025 Singapore (2.17) and Luxembourg (2.16) score highest; Taiwan 1.96, Japan 1.86, China 1.66.',
    }, [1, 1.3, 1.6, 1.8, 2]),
    factor('social-support', { zh: '社會支持', en: 'social support' }, {
      zh: '「遇到困難時有親友可以依靠」回答是的比例。2025 年冰島 1.72、芬蘭 1.64 分最多，台灣 1.45、日本 1.41、南韓 1.23、中國 0.96。',
      en: "The share who say they have relatives or friends to count on in times of trouble. In 2025 Iceland (1.72) and Finland (1.64) score highest; Taiwan 1.45, Japan 1.41, South Korea 1.23, China 0.96.",
    }, [0.6, 0.9, 1.2, 1.4, 1.55]),
    factor('healthy-life', { zh: '健康平均壽命', en: 'healthy life expectancy' }, {
      zh: '2025 年香港 1.24、新加坡 1.06、日本 1.04 分最多，台灣 0.93、美國 0.68。',
      en: 'In 2025 Hong Kong (1.24), Singapore (1.06) and Japan (1.04) score highest; Taiwan 0.93, the US 0.68.',
    }, [0.3, 0.5, 0.7, 0.85, 1]),
    factor('freedom', { zh: '人生選擇的自由', en: 'freedom to make life choices' }, {
      zh: '「對自己能選擇怎麼過生活感到滿意」的比例。2025 年越南、貝里斯 1.15 分最多，芬蘭 1.11，台灣 0.88、日本 0.88、美國 0.78。',
      en: 'The share satisfied with their freedom to choose what to do with their lives. In 2025 Vietnam and Belize (1.15) score highest, Finland 1.11; Taiwan 0.88, Japan 0.88, the US 0.78.',
    }, [0.6, 0.75, 0.85, 0.95, 1.05]),
    factor('generosity', { zh: '慷慨', en: 'generosity' }, {
      zh: '過去一個月有沒有捐款（扣掉所得高低的影響）。2025 年印尼、緬甸 0.29 分最多，台灣 0.11、日本 0.02。',
      en: 'Whether people donated to charity in the past month, after allowing for income. In 2025 Indonesia and Myanmar (0.29) score highest; Taiwan 0.11, Japan 0.02.',
    }, [0.05, 0.08, 0.11, 0.15, 0.2]),
    factor('corruption', { zh: '貪腐觀感', en: 'perceptions of corruption' }, {
      zh: '覺得政府與企業貪腐的人越少分數越高。2025 年新加坡 0.51、芬蘭 0.49、丹麥 0.47 分最多，日本 0.20、台灣 0.18、南韓 0.15。',
      en: 'The fewer people who see corruption in government and business, the higher the score. In 2025 Singapore (0.51), Finland (0.49) and Denmark (0.47) score highest; Japan 0.20, Taiwan 0.18, South Korea 0.15.',
    }, [0.05, 0.1, 0.15, 0.25, 0.35]),
  ],
};
