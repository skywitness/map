import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

const pct = (v: number) => `${fixed(v, v < 1 ? 2 : 1)}%`;

export const ai: TopicDefinition = {
  id: 'ai',
  title: '各國 AI 發展',
  shortTitle: 'AI',
  defaultIndicator: 'datacenters',
  defaultYear: 2025,
  sources: [
    { name: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright', license: 'ODbL' },
    { name: 'Epoch AI（GPU clusters、Notable AI models）', url: 'https://epoch.ai/data', license: 'CC BY 4.0' },
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
      name: 'OECD.AI（OpenRouter 資料）',
      url: 'https://oecd.ai/en/data?selectedArea=ai-model-usage',
      license: '未明示授權',
    },
  ],
  note: 'token 用量只有 OpenRouter 這個 API 轉接平台的資料（OECD.AI 整理），不是各國的全部 AI 用量；AI 公司本身都沒有按國家公布 token 用量。算力只計入公開可查的 AI 運算叢集；數據中心數是 OpenStreetMap 上有標示的地點，各國完整度不一。',
  panelExtra: () => import('./panels/AiPanel'),
  indicators: [
    {
      id: 'datacenters',
      label: '數據中心數',
      description:
        'OpenStreetMap 上標示為數據中心的地點數（目前的快照，沒有歷年資料）。各國標示的完整度差很多，例如中國明顯偏少，也包含小型機房，只能當作相對參考。',
      unit: '處',
      file: 'datacenters.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => `${fixed(v, 0)} 處`,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'compute',
      label: 'AI 算力',
      description:
        '已知 AI 運算叢集在該年底的算力總和，換算成相當於幾張 NVIDIA H100 GPU，算在叢集所在的國家。只含 Epoch AI 收錄的公開叢集（約占全球 10–20%），中國等地可能低報。',
      unit: 'H100 等效',
      file: 'compute.json',
      layer: { kind: 'bubble', legendValues: [1e3, 1e4, 1e5] },
      format: (v) => `${formatLargeNumber(v)} 張 H100 等效`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'models',
      label: '重要 AI 模型數',
      description:
        '該年發表的重要 AI 模型（Epoch AI 收錄具代表性的模型），依開發機構所在國家計算；多國合作的模型，每個參與國各算一次。',
      unit: '個',
      file: 'models.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 50] },
      format: (v) => `${fixed(v, 0)} 個`,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'openrouter-tokens',
      label: 'token 用量（OpenRouter）',
      description:
        '透過 OpenRouter（串接各家 AI 模型的 API 平台）呼叫 AI 模型的 token 量，每年取每月平均，2026 年為 1–7 月。依請求發出的地點計算，新加坡、德國等伺服器集中的地方會偏高；只代表這個平台，不是全國總用量。',
      unit: 'tokens/月',
      file: 'openrouter-tokens.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => `${formatLargeNumber(v)} tokens/月`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'claude-share',
      label: 'Claude 使用量占全球比重',
      description:
        '各國占全球 Claude.ai 對話量的比例，是最接近「各國 token 用量」的公開資料，但只代表 Claude 的網頁與 App，不含 API 與 Claude Code。2025 年為 8 月一週、2026 年為 5 月的抽樣。',
      unit: '%',
      file: 'claude-share.json',
      layer: { kind: 'bubble', legendValues: [0.1, 1, 10] },
      format: pct,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'claude-index',
      label: 'Claude 人均使用指數',
      description:
        'Claude 使用量占比 ÷ 工作年齡人口占比。1 表示用量跟人口比例相當；大於 1（藍色）表示人均用得比較多，小於 1（紅色）表示比較少。',
      unit: '倍',
      file: 'claude-index.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [0.25, 0.5, 0.8, 1.25, 2, 4] } },
      format: (v) => `${fixed(v, 2)} 倍`,
      formatTick: (v) => `${v}`,
    },
    {
      id: 'ai-adoption',
      label: '生成式 AI 使用率',
      description:
        '工作年齡（15–64 歲）人口中使用生成式 AI 的比例，微軟依自家遙測資料推估，涵蓋 ChatGPT、Claude、Gemini 等工具。2025 年為下半年、2026 年為第二季。',
      unit: '%',
      file: 'ai-adoption.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 25, 35, 50] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
  ],
};
