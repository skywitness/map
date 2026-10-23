import type { TopicDefinition } from './types';

// 暫時的骨架，主題的 agent 會換成完整的設定
export const earthquakes: TopicDefinition = {
  id: 'earthquakes',
  title: { zh: '地震與火山', en: "Earthquakes & volcanoes" },
  shortTitle: { zh: '地震與火山', en: "Earthquakes & volcanoes" },
  defaultIndicator: 'todo',
  defaultYear: 2025,
  sources: [],
  indicators: [
    {
      id: 'todo',
      label: { zh: '地震與火山', en: "Earthquakes & volcanoes" },
      description: { zh: '地震與火山', en: "Earthquakes & volcanoes" },
      unit: '',
      file: 'todo.json',
      layer: { kind: 'none' },
      format: (v) => String(v),
    },
  ],
};
