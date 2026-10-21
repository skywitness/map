/**
 * 顏色唯一的來源。CSS 透過 applyTokens() 寫入的 CSS 變數取用，D3 與 ECharts 直接讀這個物件。
 *
 * 規則：
 * - 循序（sequential）：單一藍色色相由淺到深；深色模式翻轉，數值低的接近背景。
 * - 發散（diverging）：藍 ↔ 紅，中點為中性灰；紅色臂是依藍色同階的 OKLCH 亮度推導出來的。
 */

export type ThemeMode = 'light' | 'dark';

const BLUE = {
  100: '#cde2fb', 200: '#9ec5f4', 300: '#6da7ec', 400: '#3987e5',
  500: '#256abf', 600: '#184f95', 700: '#0d366b',
} as const;

// 與 BLUE 同階亮度、色相取自 #e34948
const RED = { 200: '#f8aaa3', 400: '#e24a48', 600: '#911e22' } as const;

export interface Tokens {
  mode: ThemeMode;
  page: string;
  surface: string;
  ink: string;
  inkSecondary: string;
  inkMuted: string;
  grid: string;
  axis: string;
  border: string;
  /** 地圖：沒有上色時的陸地、無資料斜線、國界 */
  land: string;
  noDataLine: string;
  countryBorder: string;
  /** 主色（類別第 1 色），比例圓、折線、按鈕 */
  accent: string;
  accentInk: string;
  /** 對照用的灰色系列（例如「世界」） */
  context: string;
  /** 7 級循序色，由低到高 */
  sequential: string[];
  /** 7 級發散色，由負到正，中間為中性 */
  diverging: string[];
}

export const TOKENS: Record<ThemeMode, Tokens> = {
  light: {
    mode: 'light',
    page: '#f9f9f7',
    surface: '#fcfcfb',
    ink: '#0b0b0b',
    inkSecondary: '#52514e',
    inkMuted: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    border: 'rgba(11,11,11,0.10)',
    land: '#e9e8e3',
    noDataLine: '#c3c2b7',
    countryBorder: '#fcfcfb',
    accent: '#2a78d6',
    accentInk: '#ffffff',
    context: '#898781',
    sequential: [BLUE[100], BLUE[200], BLUE[300], BLUE[400], BLUE[500], BLUE[600], BLUE[700]],
    diverging: [RED[600], RED[400], RED[200], '#f0efec', BLUE[200], BLUE[400], BLUE[600]],
  },
  dark: {
    mode: 'dark',
    page: '#0d0d0d',
    surface: '#1a1a19',
    ink: '#f0efec',
    inkSecondary: '#c3c2b7',
    inkMuted: '#898781',
    grid: '#2c2c2a',
    axis: '#383835',
    border: 'rgba(255,255,255,0.10)',
    land: '#2c2c2a',
    noDataLine: '#4a4a46',
    countryBorder: '#1a1a19',
    accent: '#3987e5',
    accentInk: '#ffffff',
    context: '#898781',
    sequential: [BLUE[700], BLUE[600], BLUE[500], BLUE[400], BLUE[300], BLUE[200], BLUE[100]],
    diverging: [RED[200], RED[400], RED[600], '#383835', BLUE[600], BLUE[400], BLUE[200]],
  },
};

const CSS_VARS: Partial<Record<keyof Tokens, string>> = {
  page: '--page',
  surface: '--surface',
  ink: '--ink',
  inkSecondary: '--ink-secondary',
  inkMuted: '--ink-muted',
  grid: '--grid',
  axis: '--axis',
  border: '--border',
  accent: '--accent',
  accentInk: '--accent-ink',
};

export function applyTokens(tokens: Tokens): void {
  const root = document.documentElement;
  root.style.colorScheme = tokens.mode;
  for (const [key, cssVar] of Object.entries(CSS_VARS)) {
    root.style.setProperty(cssVar, tokens[key as keyof Tokens] as string);
  }
}
