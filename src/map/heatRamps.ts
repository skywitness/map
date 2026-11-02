/** 熱度圖（PointsOverlayDef.heatmap）的顏色；圖例（Overlays.tsx）也用，這個檔不 import 別的東西 */
/** 熱度的顏色：淡黃到深紅（透明起頭，點少的地方看得到底圖），跟圖例的色塊一樣 */
export const HEAT_COLORS: [number, string][] = [
  [0, 'rgba(255, 237, 160, 0)'],
  [0.15, 'rgba(254, 217, 118, 0.6)'],
  [0.35, '#feb24c'],
  [0.55, '#fd8d3c'],
  [0.75, '#e31a1c'],
  [1, '#800026'],
];
/** 紫色的熱度（2026-11-02，店家：底下的面量圖已經是橘色，熱度用跟店家的點一樣的紫色才分得開） */
export const HEAT_VIOLET: [number, string][] = [
  [0, 'rgba(144, 133, 233, 0)'],
  [0.15, 'rgba(144, 133, 233, 0.55)'],
  [0.4, '#9085e9'],
  [0.7, '#6250d6'],
  [1, '#2f2280'],
];
export const heatRamp = (ramp?: 'heat' | 'violet') => (ramp === 'violet' ? HEAT_VIOLET : HEAT_COLORS);
