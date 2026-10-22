import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

const pct = (v: number) => `${fixed(v, v < 1 ? 2 : 1)}%`;
/** 計數加單位，英文分單複數：1 site、3 sites */
const count = (v: number, unit: { zh: string; en: [one: string, many: string] }) =>
  `${fixed(v, 0)} ${tr({ zh: unit.zh, en: unit.en[Math.round(v) === 1 ? 0 : 1] })}`;

export const ai: TopicDefinition = {
  id: 'ai',
  title: { zh: '各國 AI 發展', en: 'AI by country' },
  shortTitle: 'AI',
  defaultIndicator: 'datacenters',
  defaultYear: 2025,
  sources: [
    { name: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright', license: 'ODbL' },
    { name: 'Epoch AI (GPU clusters, Notable AI models)', url: 'https://epoch.ai/data', license: 'CC BY 4.0' },
    {
      name: 'Anthropic Economic Index',
      url: 'https://huggingface.co/datasets/Anthropic/EconomicIndex',
      license: 'CC BY',
    },
    {
      name: 'Microsoft AI Economy Institute, AI Diffusion Report',
      url: 'https://github.com/microsoft/ai-diffusion-report',
      license: 'MIT',
    },
    {
      name: { zh: 'OECD.AI（OpenRouter 資料）', en: 'OECD.AI (OpenRouter data)' },
      url: 'https://oecd.ai/en/data?selectedArea=ai-model-usage',
      license: { zh: '未明示授權', en: 'licence not stated' },
    },
  ],
  note: {
    zh: 'token 用量只有 OpenRouter 這個 API 轉接平台的資料（OECD.AI 整理），不是各國的全部 AI 用量；AI 公司本身都沒有按國家公布 token 用量。算力只計入公開可查的 AI 運算叢集；數據中心數是 OpenStreetMap 上有標示的地點，各國完整度不一。',
    en: 'Token usage covers only the OpenRouter API gateway (compiled by OECD.AI), not all AI use in a country; no AI company publishes token usage by country. Compute counts only publicly documented AI clusters. Data centres are the sites mapped on OpenStreetMap, whose completeness varies by country.',
  },
  panelExtra: () => import('./panels/AiPanel'),
  indicators: [
    {
      id: 'datacenters',
      label: { zh: '數據中心數', en: 'Data centres' },
      description: {
        zh: 'OpenStreetMap 上標示為數據中心的地點數（目前的快照，沒有歷年資料）。各國標示的完整度差很多，例如中國明顯偏少，也包含小型機房，只能當作相對參考。',
        en: 'Number of sites tagged as data centres on OpenStreetMap (a current snapshot with no history). Mapping completeness varies widely, China for example is clearly undercounted, and small server rooms are included, so treat it as a relative guide only.',
      },
      unit: { zh: '處', en: 'sites' },
      file: 'datacenters.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => count(v, { zh: '處', en: ['site', 'sites'] }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'compute',
      label: { zh: 'AI 算力', en: 'AI compute' },
      description: {
        zh: '已知 AI 運算叢集在該年底的算力總和，換算成相當於幾張 NVIDIA H100 GPU，算在叢集所在的國家。只含 Epoch AI 收錄的公開叢集（約占全球 10–20%），中國等地可能低報。',
        en: 'Total computing power of known AI clusters at year end, expressed as an equivalent number of NVIDIA H100 GPUs and counted in the country where the cluster is located. Only public clusters tracked by Epoch AI (about 10–20% of the world total) are included; China and others may be under-reported.',
      },
      unit: { zh: 'H100 等效', en: 'H100 equivalents' },
      file: 'compute.json',
      layer: { kind: 'bubble', legendValues: [1e3, 1e4, 1e5] },
      format: (v) => `${formatLargeNumber(v)} ${tr({ zh: '張 H100 等效', en: 'H100 equivalents' })}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'models',
      label: { zh: '重要 AI 模型數', en: 'Notable AI models' },
      description: {
        zh: '該年發表的重要 AI 模型（Epoch AI 收錄具代表性的模型），依開發機構所在國家計算；多國合作的模型，每個參與國各算一次。',
        en: 'Notable AI models released that year (as tracked by Epoch AI), counted by the country of the developing organisation; models from international collaborations count once for each country involved.',
      },
      unit: { zh: '個', en: 'models' },
      file: 'models.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 50] },
      format: (v) => count(v, { zh: '個', en: ['model', 'models'] }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'openrouter-tokens',
      label: { zh: 'token 用量（OpenRouter）', en: 'Token usage (OpenRouter)' },
      description: {
        zh: '透過 OpenRouter（串接各家 AI 模型的 API 平台）呼叫 AI 模型的 token 量，每年取每月平均，2026 年為 1–7 月。依請求發出的地點計算，新加坡、德國等伺服器集中的地方會偏高；只代表這個平台，不是全國總用量。',
        en: 'Tokens processed through OpenRouter, an API platform that connects to many AI models, as a monthly average for each year (January–July for 2026). Counted by where requests come from, so server hubs such as Singapore and Germany run high. It covers this one platform only, not national totals.',
      },
      unit: { zh: 'tokens/月', en: 'tokens/month' },
      file: 'openrouter-tokens.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => `${formatLargeNumber(v)} ${tr({ zh: 'tokens/月', en: 'tokens/month' })}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'claude-share',
      label: { zh: 'Claude 使用量占全球比重', en: 'Share of global Claude usage' },
      description: {
        zh: '各國占全球 Claude.ai 對話量的比例，是最接近「各國 token 用量」的公開資料，但只代表 Claude 的網頁與 App，不含 API 與 Claude Code。2025 年為 8 月一週、2026 年為 5 月的抽樣。',
        en: "Each country's share of global Claude.ai conversations, the closest public data to token usage by country. It covers only Claude on the web and apps, not the API or Claude Code. Samples are one week in August 2025 and May 2026.",
      },
      unit: '%',
      file: 'claude-share.json',
      layer: { kind: 'bubble', legendValues: [0.1, 1, 10] },
      format: pct,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'claude-index',
      label: { zh: 'Claude 人均使用指數', en: 'Claude usage per capita index' },
      description: {
        zh: 'Claude 使用量占比 ÷ 工作年齡人口占比。1 表示用量跟人口比例相當；大於 1（綠色）表示人均用得比較多，小於 1（橘色）表示比較少。',
        en: 'Share of Claude usage ÷ share of working-age population. 1 means usage in line with population; above 1 (green) means more use per person, below 1 (orange) less.',
      },
      unit: { zh: '倍', en: '×' },
      file: 'claude-index.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [0.25, 0.5, 0.8, 1.25, 2, 4] } },
      format: (v) => tr({ zh: `${fixed(v, 2)} 倍`, en: `${fixed(v, 2)}×` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'ai-adoption',
      label: { zh: '生成式 AI 使用率', en: 'Generative AI adoption' },
      description: {
        zh: '工作年齡（15–64 歲）人口中使用生成式 AI 的比例，微軟依自家遙測資料推估，涵蓋 ChatGPT、Claude、Gemini 等工具。2025 年為下半年、2026 年為第二季。',
        en: 'Share of the working-age population (15–64) using generative AI, estimated by Microsoft from its telemetry and covering tools such as ChatGPT, Claude and Gemini. 2025 is the second half of the year; 2026 is the second quarter.',
      },
      unit: '%',
      file: 'ai-adoption.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 25, 35, 50] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
  ],
};
