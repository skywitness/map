/**
 * 風場的資料（2026-10-30 從 windLayer.ts 拆出來）：解開 pipeline 寫的風場檔、查某一點的風。
 * 首頁的程式（app/overlays.ts）與風的主題只要這些，粒子動畫的 WebGL 圖層（windLayer.ts）留在地圖的 chunk
 */
/** 解開的風場：第一列北緯 90°、第一行西經 180°，每 deg 度一點（含 180° 那一行），u、v 是 m/s */
export interface WindField {
  width: number;
  height: number;
  deg: number;
  u: Float32Array;
  v: Float32Array;
}

/** pipeline 寫的檔：u、v 是 int8 的 base64，乘 scale 是 m/s */
export interface WindFieldFile {
  width: number;
  height: number;
  deg: number;
  scale: number;
  u: string;
  v: string;
}

const decoded = new WeakMap<WindFieldFile, WindField>();

export function decodeWindField(file: WindFieldFile): WindField {
  let field = decoded.get(file);
  if (!field) {
    const unpack = (b64: string) => {
      const bin = atob(b64);
      const out = new Float32Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        const b = bin.charCodeAt(i);
        out[i] = (b > 127 ? b - 256 : b) * file.scale;
      }
      return out;
    };
    field = { width: file.width, height: file.height, deg: file.deg, u: unpack(file.u), v: unpack(file.v) };
    decoded.set(file, field);
  }
  return field;
}

/** 風場在這個經緯度的 [u, v]（雙線性內插） */
export function windAt(field: WindField, lon: number, lat: number): [number, number] {
  const x = ((((lon + 180) % 360) + 360) % 360) / field.deg;
  const y = Math.max(0, Math.min(field.height - 1.001, (90 - lat) / field.deg));
  const x0 = Math.min(field.width - 2, Math.floor(x));
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * field.width + x0;
  const j = i + field.width;
  const mix = (a: Float32Array) =>
    (a[i] * (1 - fx) + a[i + 1] * fx) * (1 - fy) + (a[j] * (1 - fx) + a[j + 1] * fx) * fy;
  return [mix(field.u), mix(field.v)];
}
