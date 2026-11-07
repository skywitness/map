import { AIR_DISTANCE_IDS } from '../air-distance';
import { FLEET_INDICATORS } from '../air-fleet';
import type { PanelExtraProps } from '../types';
import { AirDistanceSection } from './AirDistancePanel';
import AirlinesPanel from './AirlinesPanel';
import FleetPanel from './FleetPanel';
import LongestFlightsPanel from './LongestFlightsPanel';

/** 最長航線的三個指標（longest-flights.ts）列這國起降的航線，航空公司的指標列這國的航空公司 */
const ROUTE_INDICATORS = new Set(['routes-count', 'longest', 'discontinued']);

/** 航線與航空公司的側欄（2026-10-30 第十一批 186 從航空拆出來）：依目前的指標換區塊；機隊的指標（第二十三批 400）先列機齡與台灣的登記 */
export default function AirRoutesPanel(props: PanelExtraProps) {
  if (ROUTE_INDICATORS.has(props.indicator.id)) return <LongestFlightsPanel {...props} />;
  if (AIR_DISTANCE_IDS.includes(props.indicator.id)) return <AirDistanceSection {...props} />;
  if (FLEET_INDICATORS.includes(props.indicator.id))
    return (
      <>
        <FleetPanel {...props} />
        <AirlinesPanel {...props} />
      </>
    );
  return <AirlinesPanel {...props} />;
}
