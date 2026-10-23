import type { TopicDefinition } from './types';

// 暫時的骨架，主題的 agent 會換成完整的設定
export const democracy: TopicDefinition = {
  id: 'democracy',
  title: { zh: '民主與自由', en: "Democracy" },
  shortTitle: { zh: '民主與自由', en: "Democracy" },
  defaultIndicator: 'todo',
  defaultYear: 2025,
  sources: [],
  indicators: [
    {
      id: 'todo',
      label: { zh: '民主與自由', en: "Democracy" },
      description: { zh: '民主與自由', en: "Democracy" },
      unit: '',
      file: 'todo.json',
      layer: { kind: 'none' },
      format: (v) => String(v),
    },
  ],
};
