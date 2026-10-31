import type { PanelExtraProps } from '../types';
import AirlinesPanel from './AirlinesPanel';
import LongestFlightsPanel from './LongestFlightsPanel';

/** 最長航線的三個指標（longest-flights.ts）列這國起降的航線，航空公司的指標列這國的航空公司 */
const ROUTE_INDICATORS = new Set(['routes-count', 'longest', 'discontinued']);

/** 航線與航空公司的側欄（2026-10-30 第十一批 186 從航空拆出來）：依目前的指標換區塊 */
export default function AirRoutesPanel(props: PanelExtraProps) {
  return ROUTE_INDICATORS.has(props.indicator.id) ? <LongestFlightsPanel {...props} /> : <AirlinesPanel {...props} />;
}
