import { describe, expect, it } from 'vitest';
import { googleMapsUrl } from './googleMaps';

describe('googleMapsUrl', () => {
  it('Google Maps URLs 的 search，緯度在前、6 位小數', () => {
    expect(googleMapsUrl(50.4372, 5.9714)).toBe('https://www.google.com/maps/search/?api=1&query=50.437200%2C5.971400');
  });

  it('南緯、西經是負的', () => {
    expect(googleMapsUrl(-33.8688, -151.2093)).toBe('https://www.google.com/maps/search/?api=1&query=-33.868800%2C-151.209300');
  });
});
