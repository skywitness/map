/**
 * World Magnetic Model（WMM2025）在瀏覽器裡算某一點的磁場（磁極主題滑到地圖上任一點時）。
 * 跟 pipeline/sources/wmm.py 同一套算法（WMM2025 技術報告第 1.2 節）：大地座標換成地心座標，
 * Schmidt 半正規化的連帶 Legendre 函數（不在極點除以零的遞迴求導數），再轉回大地座標的 X（北）、Y（東）、Z（向下）。
 * 係數是 pipeline 輸出的 wmm.json（WMM2025.COF 原樣，公有領域）；scripts 沒有單元測試，pipeline 用官方測試值驗過同一套算法，
 * 這裡的結果在 DESIGN.md 第 8 節第 101 點記下跟測試值的比對。
 */

export interface WmmFile {
  model: string;
  epoch: number;
  /** [n, m, g, h, ġ, ḣ]（nT、nT/年） */
  coef: [number, number, number, number, number, number][];
}

export interface MagneticField {
  /** 磁偏角（度，東為正） */
  declination: number;
  /** 磁傾角（度，向下為正） */
  inclination: number;
  /** 水平分量（nT） */
  horizontal: number;
  /** 總強度（nT） */
  total: number;
}

const A_REF = 6371.2;
const WGS84_A = 6378.137;
const WGS84_F = 1 / 298.257223563;
const E2 = WGS84_F * (2 - WGS84_F);
const RAD = Math.PI / 180;

/** 某一點（大地緯度、經度，度；高度 km；年份是小數年）的磁場 */
export function magneticField(file: WmmFile, lat: number, lon: number, heightKm = 0, year = file.epoch): MagneticField {
  const degree = Math.max(...file.coef.map((c) => c[0]));
  const size = degree + 1;
  const g = new Float64Array(size * size);
  const h = new Float64Array(size * size);
  const dt = year - file.epoch;
  for (const [n, m, gn, hn, gd, hd] of file.coef) {
    g[n * size + m] = gn + dt * gd;
    h[n * size + m] = hn + dt * hd;
  }
  // 極點上 Y 要除以 cos 地心緯度：差一點點離開極點，結果不變
  const phi = Math.max(-89.9999, Math.min(89.9999, lat)) * RAD;
  const rc = WGS84_A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
  const p = (rc + heightKm) * Math.cos(phi);
  const z = (rc * (1 - E2) + heightKm) * Math.sin(phi);
  const r = Math.hypot(p, z);
  const phic = Math.asin(z / r);
  const theta = Math.PI / 2 - phic;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const P = new Float64Array(size * size);
  const dP = new Float64Array(size * size);
  P[0] = 1;
  for (let n = 1; n <= degree; n++) {
    const nn = n * size;
    if (n === 1) {
      P[nn + 1] = s;
      dP[nn + 1] = c;
    } else {
      const k = Math.sqrt((2 * n - 1) / (2 * n));
      const prev = (n - 1) * size + (n - 1);
      P[nn + n] = k * s * P[prev];
      dP[nn + n] = k * (s * dP[prev] + c * P[prev]);
    }
    for (let m = 0; m < n; m++) {
      const a = (2 * n - 1) / Math.sqrt(n * n - m * m);
      const b = n > 1 ? Math.sqrt(((n - 1) ** 2 - m * m) / (n * n - m * m)) : 0;
      const p1 = (n - 1) * size + m;
      const p2 = n > 1 ? (n - 2) * size + m : -1;
      P[nn + m] = a * c * P[p1] - (p2 >= 0 ? b * P[p2] : 0);
      dP[nn + m] = a * (c * dP[p1] - s * P[p1]) - (p2 >= 0 ? b * dP[p2] : 0);
    }
  }
  const lam = lon * RAD;
  let xp = 0;
  let yp = 0;
  let zp = 0;
  for (let n = 1; n <= degree; n++) {
    const ratio = (A_REF / r) ** (n + 2);
    for (let m = 0; m <= n; m++) {
      const i = n * size + m;
      const cm = Math.cos(m * lam);
      const sm = Math.sin(m * lam);
      const gc = g[i] * cm + h[i] * sm;
      const gs = g[i] * sm - h[i] * cm;
      xp += ratio * dP[i] * gc;
      yp += ratio * m * P[i] * gs;
      zp -= (n + 1) * ratio * P[i] * gc;
    }
  }
  yp /= Math.cos(phic);
  const psi = phic - phi;
  const x = xp * Math.cos(psi) - zp * Math.sin(psi);
  const zz = xp * Math.sin(psi) + zp * Math.cos(psi);
  const horizontal = Math.hypot(x, yp);
  return {
    declination: Math.atan2(yp, x) / RAD,
    inclination: Math.atan2(zz, horizontal) / RAD,
    horizontal,
    total: Math.hypot(horizontal, zz),
  };
}
