import { createElement } from 'react';
import type { Text } from '../i18n/lang';
import type { IndicatorDef, OverlayDef, PanelExtraProps, SourceDef, TopicDefinition } from './types';

/**
 * 併進大主題的小主題（2026-10-30，第七批 122）：小主題的檔改成匯出一個 TopicPart，大主題用 withParts() 接上，
 * 大主題原本的檔只改開頭與結尾兩行（別的 session 同時在改大主題的指標，合併時才不會衝突）。
 */
export interface TopicPart {
  /** 頁尾說明裡這一段的標題（「出生的季節：…」） */
  name: { zh: string; en: string };
  sources: SourceDef[];
  note?: { zh: string; en: string };
  overlays?: OverlayDef[];
  indicators: IndicatorDef[];
  /** 這幾個指標的側欄區塊（取代大主題的 panelExtra） */
  panelExtra?: TopicDefinition['panelExtra'];
  /** 這幾個指標的 tooltip 多寫的幾行（取代大主題的 tooltipLines） */
  tooltipLines?: TopicDefinition['tooltipLines'];
}

/** 大主題接上小主題：資料來源、說明接在後面，指標、疊加圖層加在後面，側欄依指標換 */
export function withParts(topic: TopicDefinition, ...parts: TopicPart[]): TopicDefinition {
  const join = (lang: 'zh' | 'en') =>
    [topic.note, ...parts.map((p) => p.note && ({ zh: `${p.name.zh}：${p.note.zh}`, en: `${p.name.en}: ${p.note.en}` }))]
      .filter((n): n is Text => Boolean(n))
      .map((n) => (typeof n === 'string' ? n : n[lang]))
      .join(lang === 'zh' ? '' : ' ');
  return {
    ...topic,
    sources: [...topic.sources, ...parts.flatMap((p) => p.sources.filter((s) => !topic.sources.some((t) => t.url === s.url)))],
    note: { zh: join('zh'), en: join('en') },
    overlays: [...(topic.overlays ?? []), ...parts.flatMap((p) => p.overlays ?? [])],
    indicators: [...topic.indicators, ...parts.flatMap((p) => p.indicators)],
    panelExtra: partsPanel(topic.panelExtra, parts),
    tooltipLines: partsTooltip(topic.tooltipLines, parts),
  };
}

/** tooltip 多寫的幾行：小主題的指標用小主題的，其他用大主題的 */
function partsTooltip(base: TopicDefinition['tooltipLines'], parts: TopicPart[]): TopicDefinition['tooltipLines'] {
  const byIndicator = new Map(parts.flatMap((p) => (p.tooltipLines ? p.indicators.map((i) => [i.id, p.tooltipLines!] as const) : [])));
  if (!byIndicator.size) return base;
  return (iso3, ctx) => (byIndicator.get(ctx.indicator) ?? base)?.(iso3, ctx) ?? [];
}

/** 側欄：小主題的指標用小主題自己的區塊，其他用大主題的；用到的區塊一起下載（各一個小 chunk） */
function partsPanel(base: TopicDefinition['panelExtra'], parts: TopicPart[]): TopicDefinition['panelExtra'] {
  const own = parts.filter((p) => p.panelExtra);
  if (!own.length) return base;
  return async () => {
    const [main, ...loaded] = await Promise.all([base?.(), ...own.map((p) => p.panelExtra!())]);
    const byIndicator = new Map(own.flatMap((p, i) => p.indicators.map((ind) => [ind.id, loaded[i]!.default] as const)));
    function PartsPanel(props: PanelExtraProps) {
      const Panel = byIndicator.get(props.indicator.id) ?? main?.default;
      return Panel ? createElement(Panel, props) : null;
    }
    return { default: PartsPanel };
  };
}
