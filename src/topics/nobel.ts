import type { TopicDefinition } from './types';

// 暫時的骨架，主題的 agent 會換成完整的設定
export const nobel: TopicDefinition = {
  id: 'nobel',
  title: { zh: '諾貝爾獎', en: "Nobel Prizes" },
  shortTitle: { zh: '諾貝爾獎', en: "Nobel Prizes" },
  defaultIndicator: 'todo',
  defaultYear: 2025,
  sources: [],
  indicators: [
    {
      id: 'todo',
      label: { zh: '諾貝爾獎', en: "Nobel Prizes" },
      description: { zh: '諾貝爾獎', en: "Nobel Prizes" },
      unit: '',
      file: 'todo.json',
      layer: { kind: 'none' },
      format: (v) => String(v),
    },
  ],
};
