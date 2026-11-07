import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang } from '../../i18n';
import type { Text } from '../../i18n/lang';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import { MAP_TOKENS } from '../../theme/tokens';
import { AIRCRAFT_ITEMS, AIRCRAFT_OTHER, DISTANCE_ITEMS } from '../air-distance';
import { dataFolder, type PanelExtraProps } from '../types';

/**
 * 飛多遠、搭什麼機型的側欄（2026-11-07，製作手冊第二十七批 572；pipeline/topics/air_distance.py 的 air-distance-detail.json）：
 * 這一國那一年的機上旅客依航程級距、依機型。
 */
interface Detail {
  years: number[];
  countries: Record<string, { t: (number | null)[]; d: Record<string, (number | null)[]>; a: Record<string, (number | null)[]> }>;
}

const TEXT = defineMessages({
  zh: {
    distance: (y: number) => `${y} 年的旅客依航程`,
    aircraft: (y: number) => `${y} 年的旅客依機型`,
    distanceAria: (c: string) => `${c}的機上旅客依航程`,
    aircraftAria: (c: string) => `${c}的機上旅客依機型`,
    people: (v: number) => `${formatLargeNumber(v)} 人次`,
    total: (v: string) => `機上旅客合計 ${v} 人次。`,
    none: 'Eurostat 沒有這個國家這一年的機上旅客（只有歐洲各國，2008–2024 年；英國照網站的規則不畫）。',
  },
  en: {
    distance: (y: number) => `Passengers by distance, ${y}`,
    aircraft: (y: number) => `Passengers by aircraft type, ${y}`,
    distanceAria: (c: string) => `Passengers on board in ${c} by distance`,
    aircraftAria: (c: string) => `Passengers on board in ${c} by aircraft type`,
    people: (v: number) => formatLargeNumber(v),
    total: (v: string) => `${v} passengers on board in all.`,
    none: 'Eurostat has no passengers on board for this country and year (European countries only, 2008–2024; the UK is not shown by the site’s rule).',
  },
});

export function AirDistanceSection({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const data = useJson<Detail>(`topics/${dataFolder(topic)}/air-distance-detail.json`).data;
  if (!data) return null;
  const i = data.years.indexOf(year);
  const row = data.countries[iso3];
  const total = row && i >= 0 ? row.t[i] : null;
  if (!row || total == null) return <p className="empty">{text.none}</p>;
  const items = (list: { id: string; label: Text }[], src: Record<string, (number | null)[]>) =>
    list
      .map((x, n) => ({ key: x.id, label: tr(x.label, lang), value: src[x.id]?.[i] ?? 0, color: MAP_TOKENS.categorical[n] }))
      .filter((x) => x.value > 0);
  const aircraft = [...items(AIRCRAFT_ITEMS, row.a), ...items(AIRCRAFT_OTHER, row.a).map((x) => ({ ...x, color: MAP_TOKENS.categoricalOther }))];
  return (
    <>
      <section className="panel-section">
        <h3>{text.distance(year)}</h3>
        <BarList items={items(DISTANCE_ITEMS, row.d)} format={text.people} total={total} ariaLabel={text.distanceAria(countryName)} />
        <p className="note">{text.total(fixed(total, 0))}</p>
      </section>
      <section className="panel-section">
        <h3>{text.aircraft(year)}</h3>
        <BarList items={aircraft} format={text.people} total={total} ariaLabel={text.aircraftAria(countryName)} />
      </section>
    </>
  );
}
