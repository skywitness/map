import type { Text, TopicDefinition } from './types';

/** 指標選單的一組：標題與這一組的指標 id（依選單裡的順序） */
export type MenuGroup = [Text, string[]];

/**
 * 指標選單（下拉）分組（2026-11-07 第二十五批 446 先用在產業結構與工業，第二十七批 537 抽出來給景點地圖共用）：
 * 指標依 groups 的順序重排，同一組的排在一起，每個指標寫上 menuGroup。沒有列到的指標開發時直接報錯，免得漏掉
 */
export function withMenuGroups(topic: TopicDefinition, groups: MenuGroup[]): TopicDefinition {
  const order = new Map(groups.flatMap(([, ids], g) => ids.map((id, i) => [id, [g, i] as const])));
  const missing = topic.indicators.filter((i) => !order.has(i.id)).map((i) => i.id);
  if (missing.length) throw new Error(`${topic.id} 的指標沒有分組：${missing.join(', ')}`); // i18n-ignore 開發時的錯誤訊息
  const indicators = [...topic.indicators]
    .sort((a, b) => {
      const [ga, ia] = order.get(a.id)!;
      const [gb, ib] = order.get(b.id)!;
      return ga - gb || ia - ib;
    })
    .map((i) => ({ ...i, menuGroup: groups[order.get(i.id)![0]][0] }));
  return { ...topic, indicators };
}
