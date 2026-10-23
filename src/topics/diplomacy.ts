import type { TopicDefinition } from './types';

// 暫時的骨架，主題的 agent 會換成完整的設定
export const diplomacy: TopicDefinition = {
  id: 'taiwan-diplomacy',
  title: { zh: '台灣的外交', en: "Taiwan's diplomacy" },
  shortTitle: { zh: '台灣的外交', en: "Taiwan's diplomacy" },
  defaultIndicator: 'todo',
  defaultYear: 2025,
  sources: [],
  indicators: [
    {
      id: 'todo',
      label: { zh: '台灣的外交', en: "Taiwan's diplomacy" },
      description: { zh: '台灣的外交', en: "Taiwan's diplomacy" },
      unit: '',
      file: 'todo.json',
      layer: { kind: 'none' },
      format: (v) => String(v),
    },
  ],
};
