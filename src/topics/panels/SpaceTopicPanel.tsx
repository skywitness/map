import type { PanelExtraProps } from '../types';
import LandingsPanel from './LandingsPanel';
import SpacePanel from './SpacePanel';

/** 月球與火星的登陸（landings.ts）的 4 個指標 */
const LANDING_INDICATORS = new Set(['moon', 'moon-soft', 'mars', 'mars-soft']);

/** 太空主題的側欄（2026-10-30 月球與火星的登陸併進來）：登陸的指標列這國的每一次登陸，其他指標列酬載與發射 */
export default function SpaceTopicPanel(props: PanelExtraProps) {
  return LANDING_INDICATORS.has(props.indicator.id) ? <LandingsPanel {...props} /> : <SpacePanel {...props} />;
}
