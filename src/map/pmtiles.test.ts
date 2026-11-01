import { describe, expect, it } from 'vitest';
import { setLocation } from '../test/setup';
import { pmtilesSource, tilesUrl } from './pmtiles';

describe('PMTiles 的來源', () => {
  it('網址是絕對網址加 pmtiles://，有 promoteId 才寫', () => {
    setLocation('http://localhost/map/t/map/');
    expect(tilesUrl('admin0-10m-1a2b3c4d.pmtiles')).toMatch(/^http:\/\/localhost\/.*pmtiles\/admin0-10m-1a2b3c4d\.pmtiles$/);
    const entry = { file: 'admin0-10m-1a2b3c4d.pmtiles', layer: 'admin0', minzoom: 4, maxzoom: 10, bytes: 1, generatedAt: '' };
    const source = pmtilesSource(entry, 'iso3');
    expect(source.type).toBe('vector');
    expect(source.url).toMatch(/^pmtiles:\/\/http:\/\/localhost\/.*admin0-10m-1a2b3c4d\.pmtiles$/);
    expect(source.promoteId).toBe('iso3');
    expect('promoteId' in pmtilesSource(entry)).toBe(false);
  });
});
