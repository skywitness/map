import type { SourceDef, Text, TilesOverlayDef } from './types';

/**
 * 中研院人社中心 GIS 專題中心「臺灣百年歷史地圖」的圖磚（2026-11-03，製作手冊第十七批 280；kind 'tiles'，map/tilesOverlay.ts）。
 * WMTS（https://gis.sinica.edu.tw/tileserver/wmts ）的 GetCapabilities 列 86 個圖層，GoogleMapsCompatible 格網，
 * 圖磚網址是它的 ResourceURL 樣板（file-exists.php?img=圖層-格式-z-x-y），`Access-Control-Allow-Origin: *`，不必登入。
 * 授權：中研院智財技轉處（iptt.sinica.edu.tw/shares/1121，2021-06-07）寫平台與圖資「採用「創用CC授權條款：姓名標示（BY）-
 * 非商業性使用（NC）」釋出」，網站非商業，照標示。圖磚伺服器頁沒有寫流量限制；舊地圖、舊航照預設關閉，打開才要圖磚。
 */

const TILE = 'https://gis.sinica.edu.tw/tileserver/file-exists.php?img=';
/** GetCapabilities 的範圍（全台的圖層） */
const TAIWAN: [number, number, number, number] = [117.85, 21.65, 123.86, 25.65];

export const SINICA_ATTRIBUTION =
  '<a href="https://gissrv4.sinica.edu.tw/gis/twhgis/" target="_blank" rel="noreferrer">Academia Sinica Center for GIS, RCHSS: Taiwan History and Culture in Maps</a> (CC BY-NC)';

export const SINICA_SOURCE: SourceDef = {
  name: {
    zh: '中央研究院人文社會科學研究中心 GIS 專題中心：臺灣百年歷史地圖（WMTS 圖磚）',
    en: 'Academia Sinica Center for GIS, RCHSS: Taiwan History and Culture in Maps (WMTS tiles)',
  },
  url: 'https://gis.sinica.edu.tw/tileserver/',
  license: { zh: 'CC BY-NC（中研院智財技轉處公告）', en: 'CC BY-NC (Academia Sinica IP office notice)' },
};

/** 一個圖層；layer 是 WMTS 的圖層代碼，ext 是 png 或 jpg */
export function sinicaLayer(
  id: string,
  layer: string,
  ext: 'png' | 'jpg',
  label: Text,
  opts: { maxzoom: number; minzoom?: number; bounds?: [number, number, number, number]; years?: [number, number]; note?: Text; hidden?: boolean; opacity?: number; indicators?: string[] },
): TilesOverlayDef {
  return {
    kind: 'tiles',
    id,
    label,
    url: `${TILE}${layer}-${ext}-{z}-{x}-{y}`,
    attribution: SINICA_ATTRIBUTION,
    bounds: opts.bounds ?? TAIWAN,
    minzoom: opts.minzoom ?? 6,
    maxzoom: opts.maxzoom,
    opacity: opts.opacity,
    years: opts.years,
    note: opts.note,
    hidden: opts.hidden ?? true,
    indicators: opts.indicators,
    shareable: false,
  };
}
