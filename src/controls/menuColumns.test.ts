import { describe, expect, it } from 'vitest';
import { fixedColumns, packColumns } from './menuColumns';

// 2026-10-31 量到的段高（px）：社會 6 段、地理 4 段
const SOCIETY = [369, 528, 173, 281, 298, 227];
const GEO = [352, 619, 386, 335];
const count = (cols: number[][]) => cols.map((c) => c.length);
const heights = (cols: number[][], h: number[]) => cols.map((c) => c.reduce((s, i) => s + h[i], 0));

describe('packColumns', () => {
  it('段照順序、每一段只出現一次', () => {
    const cols = packColumns(SOCIETY, 3);
    expect(cols.flat()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('螢幕夠高時欄高由左往右遞減（左邊最滿）', () => {
    const h = heights(packColumns(SOCIETY, 3), SOCIETY);
    for (let i = 1; i < h.length; i++) expect(h[i]).toBeLessThanOrEqual(h[i - 1] + 2);
  });

  it('左邊最滿的排法放不下時改用放得下的最矮排法', () => {
    // 左邊最滿要 971px；只有 750px 時改用放得下的 352／619／721
    expect(packColumns(GEO, 3)).toEqual([[0, 1], [2, 3]]);
    expect(packColumns(GEO, 3, 750)).toEqual([[0], [1], [2, 3]]);
  });

  it('都放不下時照樣挑左邊最滿的', () => {
    expect(count(packColumns(SOCIETY, 3, 100))).toEqual(count(packColumns(SOCIETY, 3)));
  });

  it('只有一段、或只能一欄', () => {
    expect(packColumns([400], 3)).toEqual([[0]]);
    expect(packColumns(SOCIETY, 1)).toEqual([[0, 1, 2, 3, 4, 5]]);
  });
});

describe('fixedColumns', () => {
  it('依每一欄的段數切', () => {
    expect(fixedColumns([2, 2, 2], 6)).toEqual([[0, 1], [2, 3], [4, 5]]);
    expect(fixedColumns([2, 1, 1], 4)).toEqual([[0, 1], [2], [3]]);
  });

  it('段數對不上時多的放最後一欄、多寫的欄拿掉', () => {
    expect(fixedColumns([1, 1], 4)).toEqual([[0], [1, 2, 3]]);
    expect(fixedColumns([2, 2, 2], 3)).toEqual([[0, 1], [2]]);
  });
});
