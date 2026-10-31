import { describe, expect, it } from 'vitest';
import { setLocation } from '../test/setup';
import { read, topicPath } from './url-state';

describe('網址 → 畫面狀態（read）', () => {
  it('主題在路徑，指標、年份、國家在參數', () => {
    setLocation('http://localhost/map/t/fertility/?ind=tfr&year=1990&country=TWN');
    const s = read();
    expect(s.topic).toBe('fertility');
    expect(s.indicator).toBe('tfr');
    expect(s.year).toBe(1990);
    expect(s.country).toBe('TWN');
    expect(s.view).toBe('map');
  });

  it('舊的 ?topic= 優先於路徑', () => {
    setLocation('http://localhost/map/t/fertility/?topic=trade');
    expect(read().topic).toBe('trade');
  });

  it('年份可以是 0 或負的，寫錯是 null', () => {
    setLocation('http://localhost/map/?year=-500');
    expect(read().year).toBe(-500);
    setLocation('http://localhost/map/?year=0');
    expect(read().year).toBe(0);
    setLocation('http://localhost/map/?year=abc');
    expect(read().year).toBeNull();
    setLocation('http://localhost/map/?year=1990.5');
    expect(read().year).toBeNull();
  });

  it('比較的國家：去重、只收國家代碼', () => {
    setLocation('http://localhost/map/?cmp=JPN,USA,JPN,bad,_SOL');
    expect(read().compare).toEqual(['JPN', 'USA', '_SOL']);
  });

  it('框選範圍要合理（南小於北、經度在 ±180 內）', () => {
    setLocation('http://localhost/map/?bbox=100,20,130,40');
    expect(read().box).toEqual([100, 20, 130, 40]);
    setLocation('http://localhost/map/?bbox=100,40,130,20');
    expect(read().box).toBeNull();
    setLocation('http://localhost/map/?bbox=100,20,200,40');
    expect(read().box).toBeNull();
  });

  it('檢視、3D、網格、嵌入、地圖上的數值', () => {
    setLocation('http://localhost/map/?view=table&3d=1&grid=0&embed=1&vals=1');
    const s = read();
    expect(s.view).toBe('table');
    expect(s.threeD).toBe(true);
    expect(s.grid).toBe(false);
    expect(s.embed).toBe(true);
    expect(s.labels).toBe(true);
    setLocation('http://localhost/map/?view=analysis');
    expect(read().view).toBe('analysis');
    setLocation('http://localhost/map/?view=whatever');
    expect(read().view).toBe('map');
  });
});

describe('topicPath', () => {
  it('每個主題自己的網址', () => {
    expect(topicPath('trade')).toMatch(/\/t\/trade\/$/);
    expect(topicPath(null)).not.toMatch(/\/t\//);
  });
});
