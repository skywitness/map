/**
 * 顏色唯一的來源。CSS 透過 applyTokens() 寫入的 CSS 變數取用，D3 與 ECharts 直接讀這個物件。
 *
 * 規則：
 * - 循序（sequential）：單一藍色色相由淺到深；深色模式翻轉，數值低的接近背景。
 * - 發散（diverging）：藍 ↔ 紅，中點為中性灰；紅色臂是依藍色同階的 OKLCH 亮度推導出來的。
 */

export type ThemeMode = 'light' | 'dark';

/** 類別色的八個色相。多系列圖表依固定順序取用（藍、橘、綠松、黃…），不要循環或自己生成。 */
export type Hue = 'blue' | 'orange' | 'aqua' | 'yellow' | 'magenta' | 'green' | 'violet' | 'red';
export const HUE_ORDER: Hue[] = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'];

const BLUE = {
  100: '#cde2fb', 200: '#9ec5f4', 300: '#6da7ec', 400: '#3987e5',
  500: '#256abf', 600: '#184f95', 700: '#0d366b',
} as const;

// 與 BLUE 同階亮度、色相取自 #e34948
const RED = { 200: '#f8aaa3', 400: '#e24a48', 600: '#911e22' } as const;

// 地圖專用：底圖的海是藍色，資料若也用藍色（或偏藍的紫色），淺色的國家會跟海混在一起，
// 所以循序色用橘色、發散色用橘 ↔ 青綠。都與 BLUE 同階亮度（OKLCH L 相同），
// 色相分別取自類別色的橘 #eb6834 與綠松 #1baf7a。
const ORANGE = {
  100: '#fbd7ca', 200: '#f2b098', 300: '#e68764', 400: '#d95923',
  500: '#b44005', 600: '#8a2e00', 700: '#611e00',
} as const;
const AQUA = { 200: '#9ad0b4', 400: '#039f6d', 600: '#046041' } as const;

// 夜間燈光的網格（pipeline/topics/night_lights_tiles.py 直接讀這一段）：第一個是夜色（沒有燈光的地方，
// 前端鋪在網格底下），之後 6 級燈光由暗到亮，深褐 → 橘 → 黃 → 近白（像鈉燈與 LED 的光）。
// OKLCH 亮度 0.19、0.40、0.51、0.62、0.73、0.85、0.96 等距遞增，色相 42°→100° 只在橘黃之間；
// 跟夜色的對比 1.9、3.1、4.9、7.5、11.6、16.6:1，越亮越突出，所以底圖是彩色地形或深色都一樣讀。
const NIGHT = {
  0: '#0d1228', 1: '#6f351d', 2: '#9d4c14', 3: '#c46d14', 4: '#e49324', 5: '#f4c761', 6: '#fcf4be',
} as const;

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
  /** 類別色（已用配色驗證工具檢查過色盲分辨度） */
  hues: Record<Hue, string>;
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
    hues: {
      blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', yellow: '#eda100',
      magenta: '#e87ba4', green: '#008300', violet: '#6250d6', red: '#e34948',
    },
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
    hues: {
      blue: '#3987e5', orange: '#d95926', aqua: '#199e70', yellow: '#c98500',
      magenta: '#d55181', green: '#008300', violet: '#9085e9', red: '#e66767',
    },
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

/**
 * 地球儀外面的深藍夜空：由畫面中心往外的放射漸層 [位置 0–1, 顏色]（2026-10-28 從黑色改成深藍，使用者從三個版本選的）。
 * WebGL 畫布在太空的部分是透明的，畫面上由 CSS 背景顯示，匯出圖片時在 canvas 上畫同一組顏色；
 * 地球邊緣的大氣層顏色在 style.ts 的 sky，分享預覽圖（scripts/og-image.mjs）也用同一組。
 */
export const SPACE_GRADIENT: [number, string][] = [
  [0, '#1d3157'],
  [0.45, '#0c1830'],
  [1, '#050a14'],
];

export interface MapTokens extends Tokens {
  /** 類別圖（kind: 'categorical'）的顏色，依序取用，最多 8 類；超過的要併到「其他」 */
  categorical: string[];
  /** 類別圖的「其他」：淺的中性色，跟無資料的灰色分得開 */
  categoricalOther: string;
  /** 沒有資料的國家；圖例的「無資料」色塊用同一個顏色（深色介面也一樣：地圖上的填色不跟著深淺色換） */
  noData: string;
  /** 夜間燈光網格：第一個是夜色（網格底下的底色），之後由暗到亮；顏色由 pipeline 寫進圖磚與 meta.json */
  night: string[];
}

/**
 * 地圖上的資料色：以明亮的彩色地圖（藍色的海）為準挑的。深色介面沒選過底圖時用深藍底圖（basemaps.ts），
 * 資料色不變，只是填色改成幾乎不透明（WorldMap.tsx 的 DATA_FILL_OPACITY_DARK）。
 * 循序色用橘色、發散色用橘 ↔ 青綠（ColorBrewer BrBG 的配法，色盲也分得開）、比例圓用紫色。
 *
 * 類別色：地圖上任兩類都可能相鄰，所以 8 色是「任兩色」都要分得開（不只相鄰的順序），
 * 用配色驗證工具（OKLab ΔE×100，Machado 2009 色盲模擬）在候選色裡搜尋出來的：
 * 紅色盲、綠色盲下任兩色 ΔE ≥ 10.4，一般視覺 ≥ 16.2（加上「其他」也一樣）；
 * 跟藍色的海（#9ebdff、#a0c8f0、#b4cfe0）與無資料的灰色 ΔE ≥ 12。
 * 為了讓 8 色兩兩分得開，亮度從深（#8a2e00）到淺（#f0e442）都有，不像圖表的類別色限制在同一亮度帶。
 * 在深色介面的圖例上，最深的兩色對比約 2:1，所以圖例一定附文字。
 */
export const MAP_TOKENS: MapTokens = {
  ...TOKENS.light,
  sequential: [ORANGE[100], ORANGE[200], ORANGE[300], ORANGE[400], ORANGE[500], ORANGE[600], ORANGE[700]],
  diverging: [ORANGE[600], ORANGE[400], ORANGE[200], '#f0efec', AQUA[200], AQUA[400], AQUA[600]],
  accent: TOKENS.light.hues.violet,
  categorical: ['#4fc29f', '#9085e9', '#eda100', '#4d9221', '#f0e442', ORANGE[600], '#7b3294', '#e7298a'],
  categoricalOther: '#ece8df',
  noData: '#c9c7c0',
  night: Object.values(NIGHT),
};
