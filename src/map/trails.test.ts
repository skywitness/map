import { describe, expect, it } from 'vitest';
import { colorAt, gradientStops, headIndex } from './trails';
import type { ColorClasses } from '../topics/types';

const classes: ColorClasses = {
  field: 'y',
  title: 'Year',
  thresholds: [1700, 1800],
  classes: [
    { color: '#000000', label: 'a' },
    { color: '#ffffff', label: 'b' },
    { color: '#ff0000', label: 'c' },
  ],
};

describe('trails', () => {
  it('puts each class colour in the middle of its class', () => {
    const stops = gradientStops(classes, 1600, 1900);
    expect(stops.map(([v]) => v)).toEqual([1650, 1750, 1850]);
    expect(colorAt(stops, 1600)).toBe('rgb(0,0,0)');
    expect(colorAt(stops, 1700)).toBe('rgb(128,128,128)');
    expect(colorAt(stops, 1850)).toBe('rgb(255,0,0)');
    expect(colorAt(stops, 2000)).toBe('rgb(255,0,0)');
  });

  it('finds the head: last point up to the year, or exactly that year', () => {
    const times = [1590, 1591, 1592, 1600];
    expect(headIndex(times, 1595, true)).toBe(2);
    expect(headIndex(times, 1500, true)).toBe(-1);
    expect(headIndex(times, 1595, false)).toBe(-1);
    expect(headIndex(times, 1600, false)).toBe(3);
  });
});
