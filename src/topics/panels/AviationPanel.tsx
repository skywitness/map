import type { PanelExtraProps } from '../types';
import AirlinesPanel from './AirlinesPanel';
import LongestFlightsPanel from './LongestFlightsPanel';

/** 最長航線的三個指標（longest-flights.ts）列這國起降的航線，其他指標列這國的航空公司 */
const ROUTE_INDICATORS = new Set(['routes-count', 'longest', 'discontinued']);

/** 航空主題的側欄（2026-10-30 航空公司、最長的直飛航線合併）：依目前的指標換區塊 */
export default function AviationPanel(props: PanelExtraProps) {
  return ROUTE_INDICATORS.has(props.indicator.id) ? <LongestFlightsPanel {...props} /> : <AirlinesPanel {...props} />;
}
