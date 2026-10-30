import { SPACE_BACKGROUND, SPACE_BACKGROUND_LIGHT } from '../theme/tokens';

/**
 * 地圖程式（MapLibre，gzip 後約 300 KB）還沒載好、還沒畫出地球前，先在地圖的位置放一張初始視角的地球圖
 * （2026-10-30，scripts/globe-placeholder.mjs 截的，淺色 32 KB、深色 21 KB）。放在地圖的畫布底下：
 * MapLibre 一畫出地球就蓋過它，不必掐時間移除；地圖載好（'load'）後 WorldMap 不再畫它。
 * 只用在地球儀的初始視角（平面地圖、3D 時不放）
 */
export function GlobePlaceholder({ dark }: { dark: boolean }) {
  return (
    <img
      className="globe-placeholder"
      src={`${import.meta.env.BASE_URL}globe/${dark ? 'dark' : 'light'}.webp`}
      alt=""
      aria-hidden="true"
      decoding="async"
      fetchPriority="high"
    />
  );
}

/** 地圖的程式還沒下載完時（App 的 Suspense）：跟地圖一樣的太空背景加地球圖，下面一行「載入地圖…」 */
export function MapFallback({ dark, text }: { dark: boolean; text: string }) {
  return (
    <div className="map" style={{ background: dark ? SPACE_BACKGROUND : SPACE_BACKGROUND_LIGHT }}>
      <GlobePlaceholder dark={dark} />
      <p className="loading map-fallback-text">{text}</p>
    </div>
  );
}
