import { describe, expect, it } from 'vitest';
import { distanceBearing, distanceRing, octant } from './greatCircle';

describe('greatCircle', () => {
  it('matches the pipeline: Taipei to Washington', () => {
    const [d, b] = distanceBearing(121.5625, 25.0375, -77.0365, 38.8977);
    expect(Math.round(d / 10) * 10).toBeGreaterThan(12000);
    expect(Math.round(d)).toBeLessThan(13000);
    expect(Math.round(b)).toBe(16);
    expect(octant(b)).toBe(1);
  });
  it('octants wrap around north', () => {
    expect(octant(350)).toBe(1);
    expect(octant(30)).toBe(2);
    expect(octant(200)).toBe(5);
    expect(octant(300)).toBe(8);
  });
  it('rings have continuous longitudes', () => {
    const ring = distanceRing([179, 0], 1000);
    for (let i = 1; i < ring.length; i++) expect(Math.abs(ring[i][0] - ring[i - 1][0])).toBeLessThan(180);
  });
});
