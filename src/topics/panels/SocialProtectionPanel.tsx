import { BarList } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { itemLabel } from '../social-protection';
import type { PanelExtraProps } from '../types';

/**
 * 社會保障覆蓋率的側欄（2026-11-07，第二十五批 450）：這一國 9 項最近一次的值與年份，跟各國中位數對照
 * （latest.json，pipeline/topics/social_protection.py）
 */
interface LatestFile {
  items: string[];
  median: Record<string, number>;
  countries: Record<string, Record<string, [number, number]>>;
}

const TEXT = defineMessages({
  zh: {
    title: '各項給付的覆蓋率',
    label: (name: string, year: number, median: number) => `${name}（${year}）· 各國中位數 ${fixed(median, 0)}%`,
    note: '每一項是那一種風險人口裡受覆蓋的比例，分母不同、不能相加；年份是這一國最近一次回報的年份。',
    none: '這個國家沒有 ILO 的社會保障資料。',
  },
  en: {
    title: 'Coverage by benefit',
    label: (name: string, year: number, median: number) => `${name} (${year}) · median ${fixed(median, 0)}%`,
    note: 'Each item is the share of the people facing that risk who are covered, so the denominators differ and cannot be added; years are the country’s latest report.',
    none: 'No ILO social protection data for this country.',
  },
});

export default function SocialProtectionPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<LatestFile>(`topics/${topic.id}/latest.json`);
  if (!data) return null;
  const own = data.countries[iso3];
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {own ? (
        <>
          <BarList
            items={data.items
              .filter((id) => own[id])
              .map((id) => ({ key: id, label: text.label(itemLabel(id), own[id][1], data.median[id]), value: own[id][0] }))}
            format={(v) => `${fixed(v, v === 100 || v === 0 ? 0 : 1)}%`}
            max={100}
            ariaLabel={`${countryName} · ${text.title}`}
          />
          <p className="note">{text.note}</p>
        </>
      ) : (
        <p className="empty">{text.none}</p>
      )}
    </section>
  );
}
