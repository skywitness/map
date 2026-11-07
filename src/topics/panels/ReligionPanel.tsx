import { defineMessages } from '../../i18n';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';
import { VdemIndices, type Scale, type VdemIndex, type VdemText } from './GovernancePanel';

/**
 * 宗教主題的側欄（2026-11-07，製作手冊第二十七批 554）：選了 V-Dem 的三項時，畫這一年的值、68% 可信區間、
 * 世界中位數，加 1789 年起的歷年小圖（跟政府治理主題的行政權制衡同一個元件，刻度改成 −4 到 +4）。
 * id 跟 religion.ts、pipeline/topics/religion_vdem.py 一致
 */
const INDICES: VdemIndex[] = [
  { id: 'religious-freedom', label: { zh: '宗教自由', en: 'Freedom of religion' }, interval: true },
  { id: 'religious-repression', label: { zh: '宗教組織不受壓制', en: 'Religious organizations not repressed' }, interval: true },
  { id: 'religious-consultation', label: { zh: '宗教組織說得上話', en: 'Religious organizations consulted' }, interval: true },
];

const SCALE: Scale = {
  min: -4,
  max: 4,
  ticks: [-4, -2, 0, 2, 4],
  format: (v) => {
    const s = fixed(Math.abs(v), 2);
    return v < 0 && s !== fixed(0, 2) ? `−${s}` : s;
  },
};

const TEXT: VdemText = defineMessages({
  zh: {
    title: (year: number) => `宗教自由與宗教組織（${year} 年）`,
    interval: '68% 可信區間',
    note: 'V-Dem 的專家評分用測量模型合成的估計值（區間尺度，0 大約是 1789 年以來所有國家年份的平均）；前兩項越高越自由、越不受壓制，第三項高分只表示政府會徵詢宗教組織，不等於好（伊朗的神權體制分數高）。區間重疊的國家，高低不一定有意義。世界中位數是當年有資料的國家的中位數。',
    chartAria: (country: string, label: string) => `${country}歷年的 V-Dem ${label}估計值、68% 可信區間與世界中位數`,
    rowAria: (label: string, value: string, low: string, high: string, median: string) =>
      `${label} ${value}，68% 可信區間 ${low} 到 ${high}，世界中位數 ${median}`,
  },
  en: {
    title: (year) => `Religious freedom and organizations (${year})`,
    interval: '68% credible interval',
    note: 'Estimates combining V-Dem expert ratings with a measurement model (an interval scale; 0 is roughly the average of all country-years since 1789). Higher means freer and less repressed for the first two; for the third, a high score only means the government consults religious organizations and is not necessarily good (theocratic Iran scores high). Where intervals overlap, countries may not really differ. The world median is the median of countries with data that year.',
    chartAria: (country, label) => `V-Dem estimate of ${label.toLowerCase()} for ${country} over time, with the 68% credible interval and the world median`,
    rowAria: (label, value, low, high, median) =>
      `${label}: ${value}, 68% credible interval ${low} to ${high}, world median ${median}`,
  },
});

export default function ReligionPanel(props: PanelExtraProps) {
  if (!INDICES.some((d) => d.id === props.indicator.id)) return null;
  return <VdemIndices {...props} indices={INDICES} text={TEXT} scale={SCALE} />;
}
