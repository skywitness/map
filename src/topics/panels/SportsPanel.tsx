import type { PanelExtraProps } from '../types';
import F1Panel from './F1Panel';
import OlympicsPanel from './OlympicsPanel';

/** F1 的 2 個指標（f1.ts） */
const F1_INDICATORS = new Set(['races', 'champions']);

/** 運動的側欄（2026-10-30 奧運、F1 合併）：F1 的指標列賽道與冠軍，其他列這國歷屆的奧運獎牌 */
export default function SportsPanel(props: PanelExtraProps) {
  return F1_INDICATORS.has(props.indicator.id) ? <F1Panel {...props} /> : <OlympicsPanel {...props} />;
}
