import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { centralSpan, parseElements, umbraAt, utcText, type ElementsRow } from './eclipseShadow';

const file = JSON.parse(readFileSync(new URL('../../public/data/topics/eclipses/elements.json', import.meta.url), 'utf-8')) as {
  rows: ElementsRow[];
};
const byDate = (ymd: number) => parseElements(file.rows.find((r) => r[1] === ymd)!);

describe('eclipseShadow', () => {
  it('puts the 2024-04-08 umbra at NASA’s point of greatest eclipse', () => {
    const el = byDate(20240408);
    // 食甚 18:18:29 TD（NASA）：25.3°N 104.1°W
    const t = 18 + 18 / 60 + 29 / 3600 - el.t0;
    const u = umbraAt(el, t)!;
    expect(u.total).toBe(true);
    expect(u.center[1]).toBeCloseTo(25.3, 0);
    expect(u.center[0]).toBeCloseTo(-104.1, 0);
    // 本影約 198 km 寬：外框離中心 0.7°–1.5° 左右
    expect(u.ring).not.toBeNull();
    const far = Math.max(...u.ring!.map(([lon, lat]) => Math.hypot((lon - u.center[0]) * Math.cos((lat * Math.PI) / 180), lat - u.center[1])));
    expect(far).toBeGreaterThan(0.6);
    expect(far).toBeLessThan(2);
    expect(utcText(el, t)).toBe('18:17');
  });

  it('finds when the shadow axis is on Earth', () => {
    const el = byDate(20240408);
    const [a, b] = centralSpan(el)!;
    // 中心線 16:38–19:55 UTC 左右（約 3 小時 17 分）
    expect((b - a) * 60).toBeGreaterThan(180);
    expect((b - a) * 60).toBeLessThan(215);
  });

  it('marks annular eclipses', () => {
    const u = umbraAt(byDate(20231014), 0.3)!;
    expect(u.total).toBe(false);
  });
});
