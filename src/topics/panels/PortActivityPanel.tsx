import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import { MAP_TOKENS } from '../../theme/tokens';
import { CARGO_TYPES, PORT_CARGO_TYPE_IDS } from '../port-activity';
import { dataFolder, type PanelExtraProps } from '../types';

/**
 * 航運與港口：港口的靠港與貨型的側欄（2026-11-07，製作手冊第二十七批 579、580）。
 * - 貨型：這一國那一年各貨型的千公噸（Eurostat）；台灣是港務公司的三分類
 * - 靠港與貨量：台灣的 10 個港最近 12 個月的靠港艘次與進出口（PortWatch 的月加總）
 */
interface CargoDetail {
  years: number[];
  countries: Record<string, Record<string, (number | null)[]>>;
  tw: { years: number[]; values: [number, number, number][] };
}
interface TwPorts {
  months: string[];
  ports: Record<string, ([number, number, number] | null)[]>;
}

const TEXT = defineMessages({
  zh: {
    cargo: (y: number) => `${y} 年港口的貨型`,
    aria: (c: string) => `${c}港口依貨型的貨量`,
    kt: (v: number) => `${formatLargeNumber(v * 1000)} 公噸`,
    noCargo: 'Eurostat 沒有這一國這一年的港口貨型（只有歐洲各國，1997–2024 年）。',
    twTitle: (y: number) => `${y} 年台灣國際商港的貨物（港務公司）`,
    twClasses: ['國際貨櫃貨', '散雜貨', '管道貨'],
    twNote: '臺灣港務公司只分三類（散雜貨含乾散貨與雜貨），跟 Eurostat 的六類對不起來，地圖上沒有替台灣上色。',
    portsTitle: (from: string, to: string) => `台灣各港的靠港與進出口（${from}–${to}）`,
    port: '港口',
    calls: '靠港艘次',
    imp: '進口（公噸）',
    exp: '出口（公噸）',
    portsNote: 'IMF PortWatch 用 AIS 推算的最近 12 個月合計，只算貨船。',
  },
  en: {
    cargo: (y: number) => `Port cargo by type, ${y}`,
    aria: (c: string) => `Port cargo in ${c} by type`,
    kt: (v: number) => `${formatLargeNumber(v * 1000)} t`,
    noCargo: 'Eurostat has no port cargo by type for this country and year (European countries only, 1997–2024).',
    twTitle: (y: number) => `Cargo at Taiwan’s international commercial ports, ${y}`,
    twClasses: ['Containers', 'Bulk and general cargo', 'Pipeline cargo'],
    twNote: 'Taiwan’s port corporation uses only three classes (bulk and general cargo together), which do not match Eurostat’s six, so Taiwan is not shaded.',
    portsTitle: (from: string, to: string) => `Port calls and cargo at Taiwan’s ports (${from}–${to})`,
    port: 'Port',
    calls: 'Calls',
    imp: 'Imports (t)',
    exp: 'Exports (t)',
    portsNote: 'Last 12 months, estimated from AIS by IMF PortWatch; cargo ships only.',
  },
});

function CargoTypes({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<CargoDetail>(`topics/${dataFolder(topic)}/port-cargo-detail.json`).data;
  if (!d) return null;
  if (iso3 === 'TWN') {
    const k = d.tw.years.includes(year) ? d.tw.years.indexOf(year) : d.tw.years.length - 1;
    const y = d.tw.years[k];
    const items = d.tw.values[k].map((v, n) => ({ key: String(n), label: text.twClasses[n], value: v, color: MAP_TOKENS.categorical[n] }));
    return (
      <section className="panel-section">
        <h3>{text.twTitle(y)}</h3>
        <BarList items={items} format={text.kt} total={items.reduce((s, x) => s + x.value, 0)} ariaLabel={text.aria(countryName)} />
        <p className="note">{text.twNote}</p>
      </section>
    );
  }
  const row = d.countries[iso3];
  const i = d.years.indexOf(year);
  const items = CARGO_TYPES.map((c, n) => ({
    key: c.id,
    label: tr(c.label, lang),
    value: (row && i >= 0 && row[c.id]?.[i]) || 0,
    color: c.id === 'other' ? MAP_TOKENS.categoricalOther : MAP_TOKENS.categorical[n],
  })).filter((x) => x.value > 0);
  if (!items.length) return <p className="empty">{text.noCargo}</p>;
  return (
    <section className="panel-section">
      <h3>{text.cargo(year)}</h3>
      <BarList items={items} format={text.kt} total={items.reduce((s, x) => s + x.value, 0)} ariaLabel={text.aria(countryName)} />
    </section>
  );
}

function TaiwanPorts({ topic }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<TwPorts>(`topics/${dataFolder(topic)}/portwatch-tw.json`).data;
  if (!d) return null;
  // 最近 12 個完整的月（最後一個月可能還沒過完，不算）
  const end = d.months.length - 1;
  const from = Math.max(0, end - 12);
  const rows = Object.entries(d.ports).map(([name, s]) => {
    const sum = [0, 0, 0];
    for (let i = from; i < end; i++) s[i]?.forEach((v, k) => (sum[k] += v));
    return { name, sum };
  });
  return (
    <section className="panel-section">
      <h3>{text.portsTitle(d.months[from], d.months[end - 1])}</h3>
      <table className="mini-table" aria-label={text.portsTitle(d.months[from], d.months[end - 1])}>
        <thead>
          <tr>
            <th scope="col">{text.port}</th>
            <th scope="col" className="num">{text.calls}</th>
            <th scope="col" className="num">{text.imp}</th>
            <th scope="col" className="num">{text.exp}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row" translate="no">{r.name}</th>
              <td className="num">{fixed(r.sum[0], 0)}</td>
              <td className="num">{formatLargeNumber(r.sum[1])}</td>
              <td className="num">{formatLargeNumber(r.sum[2])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.portsNote}</p>
    </section>
  );
}

export default function PortActivityPanel(props: PanelExtraProps) {
  if (PORT_CARGO_TYPE_IDS.includes(props.indicator.id)) return <CargoTypes {...props} />;
  return props.iso3 === 'TWN' ? <TaiwanPorts {...props} /> : null;
}
