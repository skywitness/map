import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';
import { ROAD_INJURY_IDS } from '../road-injuries';
import { RoadInjuriesSection } from './RoadInjuriesPanel';
import RoadSafetyPanel from './RoadSafetyPanel';

/** road-type-detail.json（pipeline/topics/road_type.py）：最近一年高速公路、市區、郊區、不詳四類道路的死亡人數 */
interface RoadTypeDetail {
  types: string[];
  countries: Record<string, { year: number; total: number; types: number[] }>;
}

export const ROAD_TYPE_INDICATORS = ['motorway-death-share', 'deaths-per-vkm'];

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `死亡車禍發生在哪一種道路（${y} 年，Eurostat）`,
    aria: '各類道路的死亡人數',
    types: ['高速公路', '市區道路', '郊區道路', '不詳'],
    total: '合計',
    people: (n: number) => `${fixed(n, 0)} 人`,
  },
  en: {
    title: (y: number) => `Road deaths by type of road (${y}, Eurostat)`,
    aria: 'Road deaths by type of road',
    types: ['Motorways', 'Urban roads', 'Rural roads', 'Unknown'],
    total: 'Total',
    people: (n: number) => fixed(n, 0),
  },
});

function RoadTypeSection({ topic, iso3 }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<RoadTypeDetail>(`topics/${topic.id}/road-type-detail.json`).data?.countries[iso3];
  if (!d) return null;
  return (
    <section className="panel-section">
      <h3>{text.title(d.year)}</h3>
      <table className="mini-table" aria-label={text.aria}>
        <tbody>
          {d.types.map((n, i) => (
            <tr key={text.types[i]}>
              <th scope="row">{text.types[i]}</th>
              <td className="num">{text.people(n)}</td>
              <td className="num">{d.total ? `${fixed((n / d.total) * 100, 1)}%` : ''}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">{text.total}</th>
            <td className="num">{text.people(d.total)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </section>
  );
}

/** 交通安全的側欄（2026-11-05 起）：道路類別的兩個指標（第二十三批 405）先列四類道路，其他照舊列死者的組成 */
export default function RoadSafetyPanels(props: PanelExtraProps) {
  // 受傷與事故件數的指標（第二十七批 575）：死亡、受傷、事故件數三條線，下面照舊列死者的組成
  if (ROAD_INJURY_IDS.includes(props.indicator.id))
    return (
      <>
        <RoadInjuriesSection {...props} />
        <RoadSafetyPanel {...props} />
      </>
    );
  return ROAD_TYPE_INDICATORS.includes(props.indicator.id) ? <RoadTypeSection {...props} /> : <RoadSafetyPanel {...props} />;
}
