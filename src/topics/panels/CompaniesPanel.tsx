import type { PanelExtraProps } from '../types';
import BrandsPanel from './BrandsPanel';
import OldestCompaniesPanel from './OldestCompaniesPanel';

/** 企業與品牌的側欄（2026-10-30 最古老的公司、品牌的發源地合併）：品牌的指標列這國的品牌，其他列這國的老公司 */
export default function CompaniesPanel(props: PanelExtraProps) {
  return props.indicator.id === 'brands' ? <BrandsPanel {...props} /> : <OldestCompaniesPanel {...props} />;
}
