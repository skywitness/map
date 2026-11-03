import { tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import {
  entryId,
  LOCAL_PREFIX,
  localEntryId,
  readLocalRegistry,
  type LocalColor,
  type LocalDerived,
  type LocalField,
  type LocalFlowSpec,
  type LocalFlowWords,
  type LocalPointSpec,
  type LocalShapeSpec,
  type LocalSourceMeta,
  type LocalTableSpec,
} from '../lib/localRegistry';
import { addSearchIndicators } from '../lib/topicSearch';
import { MAP_TOKENS } from '../theme/tokens';
import { summarize } from './catalog';
import { CATALOG } from './catalog.gen';
import { addLocalTopic, setTopicAugmenter } from './index';
import { TOPIC_MODULES } from './registry';
import type {
  ColorClasses,
  FlowLabels,
  IndicatorDef,
  LayerSpec,
  LinesOverlayDef,
  ListPanelDef,
  ListRow,
  OverlayDef,
  PointRecord,
  PointsOverlayDef,
  SourceDef,
  TopicDefinition,
} from './types';

/**
 * 本機匯入的來源（lib/localRegistry.ts 的清單）變成網站的指標、圖層、清單與新主題（製作手冊第十三批 209，DESIGN.md 第 11 節「本機匯入」）。
 * 只有這個瀏覽器匯入過資料時，main.tsx 才載入這個檔（自己一個 chunk）並在第一個畫面之前呼叫 installLocal()：
 * - 已有的主題：loadTopic() 讀到主題定義後接上匯入的指標（表格、流向）、圖層（點、線面）、清單、資料來源（topics/index.ts 的 augmenter）。
 * - 新主題：放進主題目錄、頂列的分類、主題總覽與搜尋。
 * 名稱後面都加「（本機）」；網址不記（lib/url-state.ts）；嵌入模式不載入。
 */

const LOCAL_TAG = { zh: '（本機）', en: ' (local)' };
const NO_TAIWAN = { zh: '這份資料沒有台灣', en: 'Taiwan is not in this dataset' };
const PERSONAL = { zh: '只供自己使用', en: 'personal use only' };
const MONTH = { zh: '月份', en: 'Month' };
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const both = (text: Text): { zh: string; en: string } => (typeof text === 'string' ? { zh: text, en: text } : text);
const tagged = (text: Text): Text => {
  const t = both(text);
  return { zh: `${t.zh}${LOCAL_TAG.zh}`, en: `${t.en}${LOCAL_TAG.en}` };
};
const joinText = (...parts: (Text | undefined)[]): Text => {
  const list = parts.filter((p): p is Text => Boolean(p)).map(both);
  return { zh: list.map((p) => p.zh).join(''), en: list.map((p) => p.en).join(' ') };
};

/** 匯入的說明：原本的說明接上「本機匯入：出處，只在這個瀏覽器」 */
function described(description: Text | undefined, meta: LocalSourceMeta): Text {
  const name = meta.about.source.name;
  return joinText(description, { zh: `（本機匯入：${name}，只在這個瀏覽器，沒有上傳）`, en: `(Imported in this browser only: ${name}; not uploaded.)` });
}

// ---------------------------------------------------------------- 數字的寫法

function numberFormat(unit: Text | undefined, decimals = 0): { format: (v: number) => string; tick: (v: number) => string } {
  const text = (v: number, tick: boolean) => {
    const num = decimals === 0 && Math.abs(v) >= 1e4 ? (tick ? formatLargeTick(v) : formatLargeNumber(v)) : fixed(v, tick ? Math.min(decimals, 1) : decimals);
    const u = unit ? tr(unit) : '';
    if (!u || tick) return num;
    return u === '%' ? `${num}%` : `${num} ${u}`;
  };
  return { format: (v) => text(v, false), tick: (v) => text(v, true) };
}

const monthLabel = (index: number): string => {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return tr({ zh: `${y} 年 ${m} 月`, en: `${MONTHS_EN[m - 1]} ${y}` });
};

function fieldText(p: PointRecord, f: LocalField): string | null {
  const v = p[f.field];
  if (v === null || v === undefined || v === '') return null;
  const shown = typeof v === 'number' ? numberFormat(f.unit, f.decimals ?? 0).format(v) : String(v);
  return `${tr(f.label)}${tr({ zh: '：', en: ': ' })}${shown}`;
}

// ---------------------------------------------------------------- 表格與流向 → 指標

const CATEGORY_MAX = MAP_TOKENS.categorical.length;

function tableIndicator(meta: LocalSourceMeta, spec: LocalTableSpec): IndicatorDef | null {
  const eid = entryId(spec);
  const d = meta.derived[eid];
  if (d?.kind !== 'table') return null;
  const labels = new Map((spec.categories ?? []).map((c) => [c.value, c.label]));
  let layer: LayerSpec;
  let format: (v: number) => string;
  let formatTick: ((v: number) => string) | undefined;
  if (d.categories) {
    const cats = d.categories;
    // 超過 8 類的併到「其他」（類別色只有 8 個，DESIGN.md 第 5 節）
    layer = {
      kind: 'categorical',
      categories: cats.slice(0, CATEGORY_MAX).map((c, i) => ({ value: i + 1, label: labels.get(c) ?? c })),
      ...(cats.length > CATEGORY_MAX && { other: { zh: '其他', en: 'Other' } }),
      ...(spec.ordinal && { ordinal: true }),
    };
    format = (v) => {
      const raw = cats[Math.round(v) - 1];
      const label = raw === undefined ? undefined : labels.get(raw);
      return label ? tr(label) : (raw ?? '');
    };
  } else {
    const f = numberFormat(spec.unit, spec.decimals ?? 0);
    format = f.format;
    formatTick = f.tick;
    layer =
      spec.map === 'bubble'
        ? { kind: 'bubble', legendValues: 'auto' }
        : {
            kind: 'choropleth',
            scale: spec.diverging
              ? { type: 'diverging', thresholds: d.thresholds ?? [-1, 1], ...(spec.reverse && { reverse: true }) }
              : { type: 'sequential', thresholds: d.thresholds ?? [1] },
          };
  }
  return {
    id: localEntryId(meta.id, eid),
    label: tagged(spec.label),
    description: described(spec.description, meta),
    unit: spec.unit ?? '',
    file: `local:${meta.id}/${eid}`,
    layer,
    format,
    ...(formatTick && { formatTick }),
    ...(spec.lowerIsBetter && { lowerIsBetter: true }),
    ...((spec.unranked || d.categories) && { unranked: true }),
    ...(spec.integer && { integer: true }),
    ...(spec.shareOfWorld && { shareOfWorld: true }),
    ...(d.categories && { panelChart: false as const, rankingBars: false as const }),
    ...(!d.taiwan && { noValue: { TWN: NO_TAIWAN } }),
    ...(d.monthly && {
      timeAxis: { label: MONTH, year: monthLabel, tick: (y: number) => `${Math.floor(y / 12)}/${(y % 12) + 1}` },
    }),
    defaultYear: 'latest',
  };
}

function flowWords(words: LocalFlowWords | undefined, fallback: LocalFlowWords, reverse: boolean): FlowLabels {
  const w = words ?? fallback;
  return {
    partners: w.partners,
    main: w.main,
    verb: (a, b) => {
      const text = tr(w.verb);
      return text.includes('{a}') ? text.replace('{a}', a).replace('{b}', b) : reverse ? `${b} → ${a}` : `${a} → ${b}`;
    },
  };
}

const EXPORT_WORDS: LocalFlowWords = { partners: { zh: '往來對象', en: 'partners' }, main: { zh: '主要對象', en: 'Main partners' }, verb: '{a} → {b}' };
const IMPORT_WORDS: LocalFlowWords = { partners: { zh: '來源', en: 'origins' }, main: { zh: '主要來源', en: 'Main origins' }, verb: '{b} → {a}' };

function flowIndicator(meta: LocalSourceMeta, spec: LocalFlowSpec): IndicatorDef | null {
  const eid = entryId(spec);
  const d = meta.derived[eid];
  if (d?.kind !== 'flow') return null;
  const f = spec.presence
    ? numberFormat({ zh: '國', en: 'countries' }, 0)
    : numberFormat(spec.unit, spec.decimals ?? 0);
  const direction = spec.direction ?? 'export';
  return {
    id: localEntryId(meta.id, eid),
    label: tagged(spec.label),
    description: described(spec.description, meta),
    unit: spec.presence ? { zh: '國', en: 'countries' } : (spec.unit ?? ''),
    file: `local:${meta.id}/${eid}#totals`,
    layer: {
      kind: 'flow',
      file: `local:${meta.id}/${eid}/{year}`,
      direction,
      labels: {
        export: flowWords(spec.words?.export, EXPORT_WORDS, false),
        import: flowWords(spec.words?.import, IMPORT_WORDS, true),
      },
      legendKey: { zh: '由起點（淺）到終點（深）', en: 'From origin (light) to destination (dark)' },
      ...(spec.presence && { presence: tagged(spec.label) }),
    },
    format: f.format,
    formatTick: f.tick,
    ...(spec.presence && { integer: true }),
    ...(!d.taiwan && { noValue: { TWN: NO_TAIWAN } }),
    defaultYear: 'latest',
  };
}

// ---------------------------------------------------------------- 點、線面 → 圖層

function rangeLabels(thresholds: number[], fmt: (v: number) => string): Text[] {
  const out: Text[] = [{ zh: `< ${fmt(thresholds[0])}`, en: `< ${fmt(thresholds[0])}` }];
  for (let i = 1; i < thresholds.length; i++) out.push(`${fmt(thresholds[i - 1])}–${fmt(thresholds[i])}`);
  out.push(`≥ ${fmt(thresholds[thresholds.length - 1])}`);
  return out;
}

/** 點的顏色：類別依序取類別色（多的併「其他」）；數值依門檻取循序色或發散色 */
function pointColor(spec: { color?: LocalColor; label: Text; fields?: LocalField[] }, d: Extract<LocalDerived, { kind: 'points' | 'shapes' }>): string | ColorClasses {
  const color = spec.color;
  if (!color) return MAP_TOKENS.hues.violet;
  if ('categories' in color) {
    const cats = d.categories ?? [];
    const labels = new Map(color.categories.map((c) => [c.value, c.label]));
    const shown = cats.slice(0, CATEGORY_MAX);
    const classes = shown.map((c, i) => ({ color: MAP_TOKENS.categorical[i], label: labels.get(c) ?? c }));
    if (cats.length > CATEGORY_MAX) classes.push({ color: MAP_TOKENS.categoricalOther, label: { zh: '其他', en: 'Other' } });
    return { field: '_c', title: spec.label, thresholds: classes.slice(1).map((_, i) => i + 0.5), classes };
  }
  const thresholds = d.thresholds ?? [1];
  const field = spec.fields?.find((f) => f.field === color.field);
  const fmt = numberFormat(undefined, field?.decimals ?? 0).tick;
  const ramp = color.diverging ? MAP_TOKENS.diverging : MAP_TOKENS.sequential;
  // 門檻 N 個 → N+1 級，從 7 階的色帶平均取
  const n = thresholds.length + 1;
  const picks = Array.from({ length: n }, (_, i) => ramp[Math.round((i * (ramp.length - 1)) / Math.max(1, n - 1))]);
  const labels = rangeLabels(thresholds, fmt);
  return { field: color.field, title: field?.label ?? spec.label, thresholds, classes: picks.map((c, i) => ({ color: c, label: labels[i] })) };
}

function tooltipOf(spec: LocalPointSpec | LocalShapeSpec, meta: LocalSourceMeta) {
  const fields = spec.fields ?? [];
  return (p: PointRecord) => {
    const lines = fields.map((f) => fieldText(p, f)).filter((s): s is string => Boolean(s));
    return {
      title: String(p.name ?? tr(spec.label)),
      ...(lines.length && { detail: lines[0] }),
      extra: [...lines.slice(1), tr({ zh: `本機匯入：${meta.about.source.name}`, en: `Imported: ${meta.about.source.name}` })],
    };
  };
}

/** 點的大小：面積跟數值成正比（半徑依平方根），在幾個點之間線性內插 */
function sqrtStops(max: number): [number, number][] {
  const r = (v: number) => 2.5 + 11 * Math.sqrt(v / max);
  return [0, 0.01, 0.05, 0.2, 0.5, 1].map((k) => [k * max, Number(r(k * max).toFixed(2))] as [number, number]);
}

function pointsOverlay(meta: LocalSourceMeta, spec: LocalPointSpec): PointsOverlayDef | null {
  const eid = entryId(spec);
  const d = meta.derived[eid];
  if (d?.kind !== 'points') return null;
  return {
    kind: 'points',
    id: localEntryId(meta.id, eid),
    file: `local:${meta.id}/${eid}`,
    label: tagged(spec.label),
    ...(spec.hidden && { hidden: true }),
    shareable: false,
    radius: spec.size && d.sizeMax ? { field: spec.size.field, stops: sqrtStops(d.sizeMax) } : 4,
    color: pointColor(spec, d),
    ...(spec.size && { sortField: spec.size.field }),
    ...(spec.time && {
      timeField: spec.time.field,
      ...(spec.time.end && { endField: spec.time.end }),
      overlayTime: spec.time.mode ?? 'year',
      timeRange: 'data' as const,
    }),
    ...(spec.labels && { pointLabel: (p: PointRecord) => String(p.name ?? '') }),
    tooltip: tooltipOf(spec, meta),
  };
}

function shapesOverlay(meta: LocalSourceMeta, spec: LocalShapeSpec): LinesOverlayDef | null {
  const eid = entryId(spec);
  const d = meta.derived[eid];
  if (d?.kind !== 'shapes') return null;
  const c = pointColor(spec, d);
  return {
    kind: 'lines',
    id: localEntryId(meta.id, eid),
    file: `local:${meta.id}/${eid}`,
    label: tagged(spec.label),
    ...(spec.hidden && { hidden: true }),
    shareable: false,
    width: 1.5,
    color: typeof c === 'string' ? c : { title: c.title, classes: c.classes.map((k, i) => ({ value: i, color: k.color, label: k.label })) },
    groupField: '_f',
    hoverHalo: true,
    ...(d.polygons && { fill: { field: '_poly', value: 1, opacity: 0.22, darkOpacity: 0.32, holeField: '_hole', outline: false as const, hover: true } }),
    ...(spec.time && {
      timeField: spec.time.field,
      ...(spec.time.end && { endField: spec.time.end }),
      overlayTime: spec.time.mode ?? 'year',
      timeRange: 'data' as const,
    }),
    ...(spec.labels && { lineLabel: (p: PointRecord) => String(p.name ?? '') }),
    tooltip: tooltipOf(spec, meta),
  };
}

/** 點的序列（_s：「年:值;年:值」）→ 清單裡的小長條圖，只畫最近 60 筆 */
function seriesBars(p: PointRecord, spec: LocalPointSpec): ListRow['bars'] | undefined {
  const s = p._s;
  if (typeof s !== 'string' || !spec.series) return undefined;
  const pts = s.split(';').map((x) => x.split(':').map(Number) as [number, number]).slice(-60);
  if (pts.length < 2) return undefined;
  const min = Math.min(...pts.map((x) => x[1]));
  const fmt = numberFormat(spec.series.unit, spec.series.decimals ?? 0).format;
  const label = tr(spec.series.label);
  return {
    values: pts.map((x) => x[1] - Math.min(0, min)),
    labels: [String(pts[0][0]), String(pts[pts.length - 1][0])],
    aria: `${label}${tr({ zh: '：', en: ': ' })}${pts.map(([y, v]) => `${y} ${fmt(v)}`).join(tr({ zh: '、', en: ', ' }))}`,
  };
}

function inTime(p: PointRecord, spec: LocalPointSpec, year: number): boolean {
  const t = spec.time;
  if (!t) return true;
  const y = p[t.field];
  if (typeof y !== 'number') return false;
  const end = t.end ? p[t.end] : null;
  const mode = t.mode ?? 'year';
  if (mode === 'cumulative') return y <= year && (typeof end !== 'number' || end > year);
  if (typeof mode === 'number') return y >= year && y < year + mode;
  return y === year;
}

function listPanel(meta: LocalSourceMeta, spec: LocalPointSpec): ListPanelDef | null {
  const list = spec.list;
  if (!list) return null;
  const eid = entryId(spec);
  const sorts = list.sorts ?? [];
  const fields = spec.fields ?? [];
  return {
    label: tagged(list.label),
    tabLabel: tagged(list.label),
    file: `local:${meta.id}/${eid}`,
    ...(sorts.length > 1 && { sorts: sorts.map((s) => ({ id: s.field, label: s.label })) }),
    ...(spec.country && { countryField: 'iso3' }),
    empty: { zh: '這一年沒有資料', en: 'Nothing in this year' },
    rows: (points, ctx) => {
      const sort = sorts.find((s) => s.field === ctx.sort) ?? sorts[0];
      const groupOf = (p: PointRecord): string | undefined => {
        if (!list.group) return undefined;
        if (list.group === 'country') return typeof p.iso3 === 'string' ? p.iso3.split(',').map((c) => ctx.countryName(c.trim())).join(tr({ zh: '、', en: ', ' })) : undefined;
        const g = p[list.group];
        return g === null || g === undefined ? undefined : String(g);
      };
      const rows = points
        .map((p, i) => ({ p, i, g: groupOf(p) }))
        .filter(({ p }) => inTime(p, spec, ctx.year));
      const value = (p: PointRecord) => (sort ? p[sort.field] : null);
      rows.sort((a, b) => {
        if (list.group && a.g !== b.g) return (a.g ?? '').localeCompare(b.g ?? '');
        const va = value(a.p);
        const vb = value(b.p);
        if (sort && va !== vb) {
          if (va === null || va === undefined) return 1;
          if (vb === null || vb === undefined) return -1;
          const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
          return sort.order === 'desc' ? -cmp : cmp;
        }
        return String(a.p.name ?? '').localeCompare(String(b.p.name ?? ''));
      });
      return rows.map(({ p, i, g }) => {
        const lines = fields.map((f) => fieldText(p, f)).filter((s): s is string => Boolean(s));
        const bars = seriesBars(p, spec);
        const year = spec.time && (spec.time.mode ?? 'year') === 'year' && typeof p[spec.time.field] === 'number' ? (p[spec.time.field] as number) : undefined;
        return {
          key: String(i),
          title: String(p.name ?? ''),
          titleProper: true,
          ...(lines.length && { lines }),
          ...(g !== undefined && { group: g }),
          ...(bars && { bars }),
          ...(year !== undefined && { year }),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 6 },
        };
      });
    },
  };
}

// ---------------------------------------------------------------- 一個來源 → 主題的零件

interface Parts {
  indicators: IndicatorDef[];
  overlays: OverlayDef[];
  lists: ListPanelDef[];
  sources: SourceDef[];
  notices: Text[];
  /** 有 label 欄的表格（tooltip 多寫一行，例如那一年在位的領導人）的指標 id */
  labelled: string[];
}

function partsOf(meta: LocalSourceMeta): Parts {
  const a = meta.about;
  const tables = (a.tables ?? []).map((s) => tableIndicator(meta, s));
  const flows = (a.flows ?? []).map((s) => flowIndicator(meta, s));
  const points = (a.points ?? []).map((s) => pointsOverlay(meta, s));
  const shapes = (a.shapes ?? []).map((s) => shapesOverlay(meta, s));
  const lists = (a.points ?? []).map((s) => listPanel(meta, s));
  return {
    indicators: [...tables, ...flows].filter((x): x is IndicatorDef => Boolean(x)),
    overlays: [...points, ...shapes].filter((x): x is PointsOverlayDef | LinesOverlayDef => Boolean(x)),
    lists: lists.filter((x): x is ListPanelDef => Boolean(x)),
    sources: [
      {
        name: joinText(
          a.source.name,
          a.source.downloaded
            ? { zh: `（本機匯入，${a.source.downloaded} 下載，只在這個瀏覽器）`, en: `(imported in this browser only, downloaded ${a.source.downloaded})` }
            : { zh: '（本機匯入，只在這個瀏覽器）', en: '(imported in this browser only)' },
        ),
        url: a.source.page ?? '',
        license: PERSONAL,
      },
    ],
    notices: a.source.notice ? [a.source.notice] : [],
    labelled: (a.tables ?? [])
      .filter((s) => {
        const d = meta.derived[entryId(s)];
        return d?.kind === 'table' && d.labels;
      })
      .map((s) => localEntryId(meta.id, entryId(s))),
  };
}

function merge(list: Parts[]): Parts {
  return {
    indicators: list.flatMap((p) => p.indicators),
    overlays: list.flatMap((p) => p.overlays),
    lists: list.flatMap((p) => p.lists),
    sources: list.flatMap((p) => p.sources),
    notices: list.flatMap((p) => p.notices),
    labelled: list.flatMap((p) => p.labelled),
  };
}

/** 表格的 label 欄：tooltip 在數值下面寫那一年的 label（指標檔多一個 labels，lib/localData.ts） */
function withLabels(base: TopicDefinition['tooltipLines'], ids: string[]): TopicDefinition['tooltipLines'] {
  if (!ids.length) return base;
  return (iso3, ctx) => {
    const lines = base?.(iso3, ctx) ?? [];
    if (!ids.includes(ctx.indicator)) return lines;
    const src = ctx.source as { years?: number[]; labels?: Record<string, (string | null)[]> } | null;
    const i = src?.years && ctx.year !== undefined ? src.years.indexOf(ctx.year) : -1;
    const label = i >= 0 ? src?.labels?.[iso3]?.[i] : null;
    return label ? [...lines, label] : lines;
  };
}

function applyParts(def: TopicDefinition, parts: Parts): TopicDefinition {
  const lists = [def.listPanel ?? []].flat();
  return {
    ...def,
    indicators: [...def.indicators, ...parts.indicators],
    ...(parts.overlays.length && { overlays: [...(def.overlays ?? []), ...parts.overlays] }),
    ...(parts.lists.length && { listPanel: [...lists, ...parts.lists] }),
    sources: [...def.sources, ...parts.sources],
    ...(parts.notices.length && { note: joinText(def.note, ...parts.notices) }),
    ...(parts.labelled.length && { tooltipLines: withLabels(def.tooltipLines, parts.labelled) }),
  };
}

// ---------------------------------------------------------------- 安裝

/**
 * 依 localStorage 的清單接上本機匯入的東西（main.tsx 在第一個畫面之前呼叫一次）。新主題放進主題目錄與頂列的分類，
 * 已有的主題在 loadTopic() 時接上
 */
export function installLocal(): void {
  const metas = readLocalRegistry();
  if (!metas.length) return;
  const byTopic = new Map<string, Parts[]>();
  const newTopics = new Map<string, { metas: LocalSourceMeta[]; parts: Parts[] }>();
  for (const meta of metas) {
    const parts = partsOf(meta);
    if (meta.about.topic) (byTopic.get(meta.about.topic) ?? byTopic.set(meta.about.topic, []).get(meta.about.topic)!).push(parts);
    else if (meta.about.newTopic) {
      const id = `${LOCAL_PREFIX}${meta.about.newTopic.id}`;
      const entry = newTopics.get(id) ?? newTopics.set(id, { metas: [], parts: [] }).get(id)!;
      entry.metas.push(meta);
      entry.parts.push(parts);
    }
  }
  const search: Record<string, { id: string; label: Text }[]> = {};
  for (const [topic, list] of byTopic) search[topic] = merge(list).indicators.map((i) => ({ id: i.id, label: i.label }));

  for (const [id, { metas: ms, parts }] of newTopics) {
    const nt = ms[0].about.newTopic!;
    const all = merge(parts);
    if (!all.indicators.length) continue;
    const years = ms.flatMap((m) => Object.values(m.derived).flatMap((d) => ('years' in d && d.years ? [d.years[1]] : [])));
    const def: TopicDefinition = applyParts(
      {
        id,
        title: tagged(nt.title),
        shortTitle: tagged(nt.shortTitle ?? nt.title),
        sources: [],
        indicators: [],
        defaultIndicator: all.indicators[0].id,
        defaultYear: nt.defaultYear ?? (years.length ? Math.max(...years) : new Date().getFullYear()),
        ...(nt.description && { note: nt.description }),
        ...(nt.focus && { focus: nt.focus }),
      },
      all,
    );
    CATALOG.topics[id] = summarize(def);
    TOPIC_MODULES[id] = () => Promise.resolve({ [id]: def });
    addLocalTopic(id, nt.group ?? 'geo');
  }
  addSearchIndicators(search);
  setTopicAugmenter((def) => {
    const list = byTopic.get(def.id);
    return list ? applyParts(def, merge(list)) : def;
  });
}

/** 測試用：一個來源變成的零件 */
export const _partsOf = partsOf;
