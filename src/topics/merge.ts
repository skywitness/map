import type { TopicPart } from './parts';
import { usesDimension, type IndicatorDef, type ListPanelDef, type OverlayDef, type TopicDefinition } from './types';

/**
 * 主題整併（2026-11-04，使用者看過盤點後選「併1–併16、整1–整4 都做」）：把另一個主題的指標、疊加圖層、清單拼進來，
 * 資料檔照舊讀原本的資料夾（`../<主題>/<檔名>`，types.ts 的 topicFile），pipeline 不必改、資料不必搬。
 * 原本主題層級的設定搬到每個指標上：timeless、defaultYear、focus、noValue、子項目（dimension）。
 * 疊加圖層與清單沒寫 indicators 的（原本整個主題都顯示）改成只在拼進來的這幾個指標顯示，不會跑到別的指標上。
 * 原本主題的定義檔照舊留著（說明、來源、面板從那裡拿），只是不再登記在 registry.ts；舊網址由 redirects.ts 轉過來。
 */

export interface AbsorbOptions {
  /** 只拿這幾個指標（原本主題的指標 id）；沒寫是全部 */
  only?: string[];
  /** 指標改名（原本的 id → 新的 id），跟拼進去的主題已有的指標 id 衝突時用（例如兩個主題都有 'map'） */
  rename?: Record<string, string>;
  /** 疊加圖層的 id 加上這個前綴（跟拼進去的主題已有的圖層 id 衝突時用） */
  overlayPrefix?: string;
}

export interface Absorbed {
  indicators: IndicatorDef[];
  overlays: OverlayDef[];
  listPanel: ListPanelDef[];
}

/** 原本主題的資料夾裡的檔 → 從別的主題讀的路徑 */
export function rebaseFile(folder: string, file: string): string {
  return file.startsWith('../') ? file : `../${folder}/${file}`;
}

export function absorb(def: TopicDefinition, opts: AbsorbOptions = {}): Absorbed {
  const folder = def.dataTopic ?? def.id;
  const rebase = (file: string) => rebaseFile(folder, file);
  const rename = (id: string) => opts.rename?.[id] ?? id;
  const picked = def.indicators.filter((i) => !opts.only || opts.only.includes(i.id));
  if (opts.only && picked.length !== opts.only.length) {
    throw new Error(`${def.id}：找不到指標 ${opts.only.filter((id) => !picked.some((i) => i.id === id)).join('、')}`); // i18n-ignore（開發時的錯誤）
  }
  const ids = new Set(picked.map((i) => i.id));
  const topicFocus = typeof def.focus === 'function' ? undefined : def.focus;

  const indicators = picked.map((i): IndicatorDef => {
    const timeless = i.timeless ?? (def.timeless || undefined);
    const layer =
      i.layer.kind === 'flow'
        ? { ...i.layer, file: rebase(i.layer.file) }
        : i.layer.kind === 'bubble' && i.layer.pie
          ? {
              ...i.layer,
              pie: {
                ...i.layer.pie,
                parts: i.layer.pie.parts.map((p) => ({ ...p, indicator: rename(p.indicator), file: p.file && rebase(p.file) })),
              },
            }
          : i.layer;
    return {
      ...i,
      id: rename(i.id),
      file: rebase(i.file),
      layer,
      timeless,
      defaultYear: timeless ? i.defaultYear : (i.defaultYear ?? def.defaultYear),
      focus: i.focus ?? topicFocus,
      noValue: i.noValue ?? def.noValue,
      dimension: i.dimension ?? (def.dimension && usesDimension(i) ? def.dimension : undefined),
    };
  });

  const keep = (list: string[] | undefined) => (list ? list.some((id) => ids.has(id)) : !opts.only);
  const indicatorsOf = (list: string[] | undefined) => (list ?? [...ids]).filter((id) => ids.has(id)).map(rename);

  const overlays = (def.overlays ?? [])
    .filter((o) => keep(o.indicators))
    .map((o): OverlayDef => {
      const id = opts.overlayPrefix ? `${opts.overlayPrefix}${o.id}` : o.id;
      const shown = indicatorsOf(o.indicators);
      // 讀資料檔的圖層：記下原本的資料夾（OverlayBase.topic）；不讀檔的（圖磚、夜色、月亮、即時網格）只改顯示的指標
      if (o.kind === 'tiles' || o.kind === 'night' || o.kind === 'moon' || o.kind === 'liveGrid') return { ...o, id, indicators: shown } as OverlayDef;
      return { ...o, id, indicators: shown, topic: o.topic ?? folder } as OverlayDef;
    });

  const listPanel = [def.listPanel ?? []]
    .flat()
    .filter((l) => keep(l.indicators))
    .map((l) => ({
      ...l,
      file: l.fromLive ? l.file : rebase(l.file),
      itemFiles: l.itemFiles && Object.fromEntries(Object.entries(l.itemFiles).map(([k, f]) => [k, rebase(f)])),
      indicators: indicatorsOf(l.indicators),
    }));

  return { indicators, overlays, listPanel };
}

/**
 * 接別的主題進來的大主題：原本沒寫 indicators 的疊加圖層與清單（整個主題都顯示）改成只在大主題自己的指標顯示，
 * 拼進來的指標才不會畫到大主題的點與清單（2026-11-04 潛水的點跑到攀岩的指標上）
 */
export function hostOnly(def: TopicDefinition): TopicDefinition {
  const ids = def.indicators.map((i) => i.id);
  const lists = [def.listPanel ?? []].flat();
  return {
    ...def,
    overlays: def.overlays?.map((o) => (o.indicators ? o : ({ ...o, indicators: ids } as OverlayDef))),
    listPanel: lists.length ? lists.map((l) => (l.indicators ? l : { ...l, indicators: ids })) : def.listPanel,
  };
}

/** 原本沒有國家側欄區塊的主題：拼進去以後它的指標也不畫大主題的區塊 */
const NO_PANEL: NonNullable<TopicDefinition['panelExtra']> = async () => ({ default: () => null });

/**
 * 整個主題（或其中幾個指標）變成 parts.ts 的 TopicPart，給大主題的 withParts() 接上：
 * 側欄區塊、tooltip 多寫的幾行只用在這幾個指標（改了名的指標，tooltip 照舊拿到原本的 id）
 */
export function topicPart(def: TopicDefinition, opts: AbsorbOptions & { name?: { zh: string; en: string } } = {}): TopicPart {
  const { indicators, overlays, listPanel } = absorb(def, opts);
  const original = new Map(Object.entries(opts.rename ?? {}).map(([from, to]) => [to, from]));
  const lines = def.tooltipLines;
  const title = typeof def.title === 'string' ? { zh: def.title, en: def.title } : def.title;
  const note = !def.note ? undefined : typeof def.note === 'string' ? { zh: def.note, en: def.note } : def.note;
  return {
    name: opts.name ?? title,
    sources: def.sources,
    note,
    overlays,
    indicators,
    panelExtra: def.panelExtra ?? NO_PANEL,
    tooltipLines: lines && ((iso3, ctx) => lines(iso3, { ...ctx, indicator: original.get(ctx.indicator) ?? ctx.indicator })),
    listPanel,
  };
}
