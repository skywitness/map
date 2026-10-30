import type { PanelExtraProps } from '../types';
import HousePricesPanel from './HousePricesPanel';
import HousingPanel from './HousingPanel';

/** 房價的 5 個指標（house-prices.ts） */
const PRICE_INDICATORS = new Set(['real-price-10y', 'real-price-5y', 'price-income', 'price-rent', 'real-rent-5y']);

/** 住宅與房價的側欄（2026-10-30 房價與居住負擔併進來）：房價的指標畫房價、租金與負擔的歷年，其他畫住宅類型 */
export default function HousingTopicPanel(props: PanelExtraProps) {
  return PRICE_INDICATORS.has(props.indicator.id) ? <HousePricesPanel {...props} /> : <HousingPanel {...props} />;
}
