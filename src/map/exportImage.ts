/**
 * 匯出地圖圖片：擷取 MapLibre 的 WebGL 畫面，在 2D 畫布上加上標題、圖例與資料來源，輸出成 PNG。
 *
 * WebGL 畫布沒有開 preserveDrawingBuffer（開了之後每一格都要多複製一次緩衝區，平常拖曳、縮放都會變慢），
 * 畫完一格之後內容隨時可能被清掉。所以只在匯出時重畫一次，並在同一格裡複製：
 * MapLibre 的 'idle' 事件是在「圖磚都載入完」的那一格畫完後、同一個呼叫裡立刻觸發，這時緩衝區還在。
 */
import type { Map as MaplibreMap } from 'maplibre-gl';
import { messages, tr } from '../i18n';
import { SPACE_GRADIENT, type Tokens } from '../theme/tokens';
import {
  COLUMN_NOTE,
  STEP_MAX_PX,
  STEPPED_NOTE,
  type BubbleLegendModel,
  type ChoroplethLegendModel,
  type ColumnLegendModel,
  type FlowLegendModel,
} from './Legend';
import type { LayerKey } from './Overlays';

/** 匯出至少用 2 倍解析度，在高解析度螢幕上看也清楚；只在匯出的那一下調高，之後還原 */
const MIN_EXPORT_RATIO = 2;
/** 圖磚一直載入不完（網路慢）時，最多等這麼久就用目前的畫面 */
const IDLE_TIMEOUT_MS = 10_000;

/** 擷取目前的地圖畫面。回傳的畫布是裝置像素，ratio 是相對於 CSS px 的倍數 */
export async function captureMap(map: MaplibreMap): Promise<{ canvas: HTMLCanvasElement; ratio: number }> {
  const override = map._overridePixelRatio;
  const boost = map.getPixelRatio() < MIN_EXPORT_RATIO;
  if (boost) map.setPixelRatio(MIN_EXPORT_RATIO);
  try {
    return await new Promise((resolve) => {
      let done = false;
      const grab = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        map.off('idle', grab);
        const source = map.getCanvas();
        const canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        canvas.getContext('2d')!.drawImage(source, 0, 0);
        resolve({ canvas, ratio: source.width / source.clientWidth });
      };
      const timer = setTimeout(() => {
        map.once('render', grab);
        map.triggerRepaint();
      }, IDLE_TIMEOUT_MS);
      map.once('idle', grab);
      map.triggerRepaint();
    });
  } finally {
    // undefined / null 表示回到跟隨螢幕的 devicePixelRatio
    if (boost) map.setPixelRatio(override as number);
  }
}

export type ImageLegend =
  /**
   * stepped：3D 模式，色塊畫成階梯並加上高度說明。
   * notes、emptyKey：標題下的說明與取代「無資料」的標示（1 km 網格，跟畫面上的 ChoroplethLegend 一樣）
   */
  | {
      kind: 'choropleth';
      title: string;
      unit: string;
      model: ChoroplethLegendModel;
      stepped?: boolean;
      notes?: string[];
      emptyKey?: string;
    }
  | { kind: 'bubble'; title: string; unit: string; model: BubbleLegendModel }
  /** 3D 模式的柱子 */
  | { kind: 'column'; title: string; unit: string; model: ColumnLegendModel; color: string }
  /** 流向圖：線寬樣本與流向說明 */
  | { kind: 'flow'; title: string; unit: string; model: FlowLegendModel };

/** 圖片上的文字，由呼叫端（知道主題、年份、來源的 App）提供 */
export interface MapImageContent {
  title: string;
  subtitle?: string;
  /** 頁尾的來源與說明，每一項自成一段，太長會自動換行 */
  credits: string[];
}

export interface ComposeOptions extends MapImageContent {
  legend: ImageLegend | null;
  /** 目前開著的疊加圖層（鐵路、機場） */
  layerKeys: { key: LayerKey; color: string }[];
  /** 介面配色：標題、頁尾、圖例卡片（跟畫面上的圖例一樣） */
  tokens: Tokens;
}

const PAD = 16;
const TITLE = { size: 18, line: 24 };
const SUBTITLE = { size: 13, line: 18 };
const CREDIT = { size: 11, line: 16 };
/** 圖例卡片：跟 styles.css 的 .map-legend > .legend 同樣的間距 */
const CARD = { padX: 12, padY: 10, gap: 8, inset: 12, radius: 8 };

/** 把地圖畫面、標題、圖例、來源組成一張圖 */
export function composeMapImage(map: HTMLCanvasElement, ratio: number, options: ComposeOptions): HTMLCanvasElement {
  const { title, subtitle, credits, tokens } = options;
  const font = getComputedStyle(document.documentElement).fontFamily || 'sans-serif';
  const width = map.width / ratio;
  const mapHeight = map.height / ratio;
  const textWidth = width - PAD * 2;

  const out = document.createElement('canvas');
  const ctx = out.getContext('2d')!;
  ctx.font = `650 ${TITLE.size}px ${font}`;
  const titleLines = wrapText(ctx, title, textWidth);
  ctx.font = `${SUBTITLE.size}px ${font}`;
  const subtitleLines = subtitle ? wrapText(ctx, subtitle, textWidth) : [];
  ctx.font = `${CREDIT.size}px ${font}`;
  const creditLines = credits.flatMap((c) => wrapText(ctx, c, textWidth));

  const headerHeight =
    PAD + titleLines.length * TITLE.line + (subtitleLines.length ? 4 + subtitleLines.length * SUBTITLE.line : 0) + 12;
  const footerHeight = 10 + creditLines.length * CREDIT.line + 12;

  // 改畫布大小會重設 context 的狀態，所以量完文字才設
  out.width = map.width;
  out.height = Math.round((headerHeight + mapHeight + footerHeight) * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = tokens.page;
  ctx.fillRect(0, 0, width, headerHeight + mapHeight + footerHeight);

  let y = PAD;
  ctx.fillStyle = tokens.ink;
  ctx.font = `650 ${TITLE.size}px ${font}`;
  for (const line of titleLines) {
    ctx.fillText(line, PAD, y + TITLE.line / 2);
    y += TITLE.line;
  }
  if (subtitleLines.length) {
    y += 4;
    ctx.fillStyle = tokens.inkSecondary;
    ctx.font = `${SUBTITLE.size}px ${font}`;
    for (const line of subtitleLines) {
      ctx.fillText(line, PAD, y + SUBTITLE.line / 2);
      y += SUBTITLE.line;
    }
  }

  // 太空的部分在 WebGL 畫布上是透明的（畫面上靠 CSS 背景），先畫上同樣的放射漸層
  const cx = width / 2;
  const cy = headerHeight + mapHeight / 2;
  const space = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(width / 2, mapHeight / 2));
  for (const [at, color] of SPACE_GRADIENT) space.addColorStop(at, color);
  ctx.fillStyle = space;
  ctx.fillRect(0, headerHeight, width, mapHeight);
  ctx.drawImage(map, 0, headerHeight, width, mapHeight);
  drawLegends(ctx, options, font, CARD.inset, headerHeight + mapHeight - CARD.inset, width - CARD.inset * 2);

  y = headerHeight + mapHeight + 10;
  ctx.fillStyle = tokens.inkSecondary;
  ctx.font = `${CREDIT.size}px ${font}`;
  for (const line of creditLines) {
    ctx.fillText(line, PAD, y + CREDIT.line / 2);
    y += CREDIT.line;
  }
  return out;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png'),
  );
}

/* ── 圖例 ───────────────────────────── */

interface Card {
  width: number;
  height: number;
  /** 以卡片內容區的左上角為原點畫內容 */
  draw: () => void;
}

/** 圖例卡片貼在地圖左下角，由下往上疊：數值圖例在最下面，圖層開關在上面（跟畫面上一樣） */
function drawLegends(
  ctx: CanvasRenderingContext2D,
  options: ComposeOptions,
  font: string,
  left: number,
  bottom: number,
  maxWidth: number,
) {
  const cards: Card[] = [];
  if (options.layerKeys.length) cards.push(layerCard(ctx, options, font));
  if (options.legend) cards.push(valueCard(ctx, options.legend, options.tokens, font));
  if (!cards.length) return;

  // 地圖很窄（手機）時整組縮小，不超出地圖
  const widest = Math.max(...cards.map((c) => c.width + CARD.padX * 2));
  const scale = Math.min(1, maxWidth / widest);
  ctx.save();
  ctx.translate(left, bottom);
  ctx.scale(scale, scale);
  let y = 0;
  for (const card of [...cards].reverse()) {
    const w = card.width + CARD.padX * 2;
    const h = card.height + CARD.padY * 2;
    y -= h;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = options.tokens.surface;
    roundRect(ctx, 0, y, w, h, CARD.radius);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = options.tokens.border;
    ctx.lineWidth = 1;
    roundRect(ctx, 0.5, y + 0.5, w - 1, h - 1, CARD.radius);
    ctx.stroke();
    ctx.translate(CARD.padX, y + CARD.padY);
    card.draw();
    ctx.restore();
    y -= CARD.gap;
  }
  ctx.restore();
}

const LEGEND_TITLE = 16;
const TITLE_GAP = 6;
const NO_DATA_ROW = 18;
/** 3D 圖例標題下的高度說明（.legend-note） */
const NOTE_ROW = 18;

function valueCard(ctx: CanvasRenderingContext2D, legend: ImageLegend, tokens: Tokens, font: string): Card {
  const t = messages();
  const unit = t.unitSuffix(legend.unit);
  ctx.font = `600 12px ${font}`;
  const titleWidth = ctx.measureText(legend.title).width;
  ctx.font = `12px ${font}`;
  const titleTotal = titleWidth + ctx.measureText(unit).width;
  ctx.font = `11px ${font}`;
  // 1 km 網格沒有「無資料」，改標示不上色的格子
  const empty = legend.kind === 'choropleth' ? legend.emptyKey : undefined;
  const noDataWidth = 22 + ctx.measureText(empty ?? t.noData).width;
  const noteText = legend.kind === 'column' ? COLUMN_NOTE : legend.kind === 'choropleth' && legend.stepped ? STEPPED_NOTE : null;
  const notes = [...(noteText ? [tr(noteText)] : []), ...(legend.kind === 'choropleth' ? (legend.notes ?? []) : [])];
  const noteWidth = Math.max(0, ...notes.map((n) => ctx.measureText(n).width));

  const drawTitle = () => {
    ctx.font = `600 12px ${font}`;
    ctx.fillStyle = tokens.ink;
    ctx.fillText(legend.title, 0, LEGEND_TITLE / 2);
    ctx.font = `12px ${font}`;
    ctx.fillStyle = tokens.inkSecondary;
    ctx.fillText(unit, titleWidth, LEGEND_TITLE / 2);
    ctx.font = `11px ${font}`;
    notes.forEach((note, i) => ctx.fillText(note, 0, LEGEND_TITLE + TITLE_GAP + 5 + i * NOTE_ROW));
  };
  const drawNoData = (top: number) => {
    const y = top + 4;
    if (empty) {
      // 跟 .swatch-empty 一樣：只有外框，透出底圖
      ctx.strokeStyle = tokens.axis;
      ctx.lineWidth = 1;
      roundRect(ctx, 0.5, y + 2.5, 15, 9, 2);
      ctx.stroke();
    } else {
      hatchSwatch(ctx, 0, y + 2, 16, 10, tokens);
    }
    ctx.font = `11px ${font}`;
    ctx.fillStyle = tokens.inkSecondary;
    ctx.fillText(empty ?? t.noData, 22, y + 7);
  };

  const top = LEGEND_TITLE + TITLE_GAP + notes.length * NOTE_ROW;
  if (legend.kind === 'choropleth') {
    const { colors, labels, swatchWidth } = legend.model;
    const stepped = Boolean(legend.stepped);
    const scaleWidth = colors.length * swatchWidth;
    // 階梯色塊（3D）比平的高，刻度跟著往下移（跟 .legend-scale.is-stepped 一樣）
    const swatchesHeight = stepped ? STEP_MAX_PX : 10;
    const scaleHeight = swatchesHeight + 18;
    return {
      width: Math.max(titleTotal, noteWidth, scaleWidth, noDataWidth),
      height: top + scaleHeight + NO_DATA_ROW,
      draw: () => {
        drawTitle();
        const gap = 2;
        const w = (scaleWidth - gap * (colors.length - 1)) / colors.length;
        colors.forEach((c, i) => {
          ctx.fillStyle = c;
          const x = i * (w + gap);
          const first = i === 0;
          const last = i === colors.length - 1;
          if (stepped) {
            const h = ((i + 1) / colors.length) * STEP_MAX_PX;
            roundRect(ctx, x, top + STEP_MAX_PX - h, w, h, [2, 2, 0, 0]);
          } else {
            roundRect(ctx, x, top, w, 10, [first ? 2 : 0, last ? 2 : 0, last ? 2 : 0, first ? 2 : 0]);
          }
          ctx.fill();
        });
        ctx.font = `11px ${font}`;
        ctx.fillStyle = tokens.inkSecondary;
        ctx.textAlign = 'center';
        labels.forEach((label, i) => ctx.fillText(label, ((i + 1) / colors.length) * scaleWidth, top + swatchesHeight + 4 + 7));
        ctx.textAlign = 'left';
        drawNoData(top + scaleHeight);
      },
    };
  }

  if (legend.kind === 'flow') {
    const { rows, colors, lineLength, height, key } = legend.model;
    const labelWidth = Math.max(...rows.map((r) => ctx.measureText(r.label).width));
    const keyWidth = 44 + ctx.measureText(key).width;
    return {
      width: Math.max(titleTotal, lineLength + 12 + labelWidth, keyWidth),
      height: top + height + NO_DATA_ROW,
      draw: () => {
        drawTitle();
        ctx.font = `11px ${font}`;
        ctx.lineCap = 'round';
        for (const { label, width, y } of rows) {
          ctx.strokeStyle = colors.mid;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(2, top + y);
          ctx.lineTo(2 + lineLength, top + y);
          ctx.stroke();
          ctx.fillStyle = tokens.inkSecondary;
          ctx.fillText(label, lineLength + 12, top + y);
        }
        ctx.lineCap = 'butt';
        // 流向說明：跟畫面上一樣，淺 → 深的漸層樣本
        const keyY = top + height + 4;
        const gradient = ctx.createLinearGradient(2, 0, 38, 0);
        gradient.addColorStop(0, colors.start);
        gradient.addColorStop(1, colors.end);
        ctx.fillStyle = gradient;
        roundRect(ctx, 2, keyY + 5, 36, 4, 2);
        ctx.fill();
        ctx.fillStyle = tokens.inkSecondary;
        ctx.fillText(key, 44, keyY + 7);
      },
    };
  }

  if (legend.kind === 'column') {
    const { bars, baseline, width, height } = legend.model;
    return {
      width: Math.max(titleTotal, noteWidth, width, noDataWidth),
      height: top + height + NO_DATA_ROW,
      draw: () => {
        drawTitle();
        ctx.font = `11px ${font}`;
        ctx.textAlign = 'center';
        for (const { label, x, h } of bars) {
          ctx.fillStyle = legend.color;
          roundRect(ctx, x - 6, top + baseline - h, 12, h, [1.5, 1.5, 0, 0]);
          ctx.fill();
          ctx.fillStyle = tokens.inkSecondary;
          ctx.fillText(label, x, top + baseline - h - 4 - 4);
        }
        ctx.textAlign = 'left';
        ctx.strokeStyle = tokens.axis;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, top + baseline + 0.5);
        ctx.lineTo(width, top + baseline + 0.5);
        ctx.stroke();
        drawNoData(top + height);
      },
    };
  }

  const { items, maxR, baseline, labelX, width, height } = legend.model;
  return {
    width: Math.max(titleTotal, width, noDataWidth),
    height: top + height + NO_DATA_ROW,
    draw: () => {
      drawTitle();
      ctx.font = `11px ${font}`;
      ctx.lineWidth = 1;
      for (const { label, r, labelY } of items) {
        ctx.strokeStyle = tokens.inkMuted;
        ctx.beginPath();
        ctx.arc(maxR, top + baseline - r, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = tokens.axis;
        ctx.beginPath();
        ctx.moveTo(maxR, top + baseline - r * 2);
        ctx.lineTo(labelX - 10, top + baseline - r * 2);
        ctx.lineTo(labelX - 4, top + labelY);
        ctx.stroke();
        ctx.fillStyle = tokens.inkSecondary;
        ctx.fillText(label, labelX, top + labelY);
      }
      drawNoData(top + height);
    },
  };
}

const LAYER_ROW = 16;
const LAYER_GAP = 4;

function layerCard(ctx: CanvasRenderingContext2D, options: ComposeOptions, font: string): Card {
  const { layerKeys, tokens } = options;
  ctx.font = `12px ${font}`;
  const t = messages();
  const rowWidth = Math.max(...layerKeys.map(({ key }) => 24 + ctx.measureText(tr(key.label)).width));
  ctx.font = `600 12px ${font}`;
  const titleWidth = ctx.measureText(t.layers).width;
  return {
    width: Math.max(titleWidth, rowWidth),
    height: LEGEND_TITLE + layerKeys.length * (LAYER_ROW + LAYER_GAP),
    draw: () => {
      ctx.font = `600 12px ${font}`;
      ctx.fillStyle = tokens.ink;
      ctx.fillText(t.layers, 0, LEGEND_TITLE / 2);
      ctx.font = `12px ${font}`;
      layerKeys.forEach(({ key, color }, i) => {
        const cy = LEGEND_TITLE + LAYER_GAP + i * (LAYER_ROW + LAYER_GAP) + LAYER_ROW / 2;
        if (key.shape === 'line') {
          ctx.strokeStyle = color;
          ctx.lineWidth = key.size;
          ctx.beginPath();
          ctx.moveTo(1, cy);
          ctx.lineTo(17, cy);
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(9, cy, key.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = tokens.ink;
        ctx.fillText(tr(key.label), 24, cy);
      });
    },
  };
}

/** 「無資料」的斜線色塊（跟 .swatch-nodata 一樣） */
function hatchSwatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tokens: Tokens) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 2);
  ctx.fillStyle = tokens.grid;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = tokens.axis;
  ctx.lineWidth = 1;
  for (let i = -h; i < w; i += 4) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/* ── 文字換行 ───────────────────────── */

// 英文、數字、網址連在一起當一個詞；中文每個字都可以斷開。左括號跟著後面的字，不留在行尾
const TOKEN = /[（「『〔【]*(?:[\p{Script=Latin}\p{N}.,:;/?#&=%_~+@'!*()[\]<>-]+|.)|\s+/gu;
// 這些標點不放在行首，寬度超出一點也跟著上一行
const NO_LINE_START = /^[、，。：；！？）」』〕】%]$/;

/** 依寬度換行；比整行還長的詞（例如網址）逐字斷開 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  const push = () => {
    if (line.trim()) lines.push(line.trimEnd());
    line = '';
  };
  for (const token of text.match(TOKEN) ?? []) {
    if (!line && /^\s+$/.test(token)) continue;
    if (ctx.measureText(line + token).width <= maxWidth || NO_LINE_START.test(token)) {
      line += token;
      continue;
    }
    if (ctx.measureText(token).width <= maxWidth) {
      push();
      line = token.trimStart();
      continue;
    }
    for (const ch of token) {
      if (line && ctx.measureText(line + ch).width > maxWidth) push();
      line += ch;
    }
  }
  push();
  return lines;
}
