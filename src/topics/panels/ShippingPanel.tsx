import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { Chart } from '../../charts/Chart';
import { latestIndexAtOrBefore, stackedAreaOption, type StackedSeries } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber, formatLargeTick } from '../../lib/format';
import { decodePoints } from '../../map/Overlays';
import type { Tokens } from '../../theme/tokens';
import { PLSCI_QUARTER, PORT_SIZE_SHORT, portName } from '../shipping';
import type { PanelExtraProps, PointRecord, PointsData } from '../types';

/**
 * 航運與港口的側欄（pipeline/topics/shipping.py）：
 * - 主要港口（ports.json，World Port Index 的點）：港口的班輪航運連結指數、主要港口自己公布的吞吐量與出處
 * - 台灣各港的貨櫃裝卸量（臺灣港務公司的開放資料，2001 年起）
 * - 船旗國的船隊組成（船種，UNCTAD）、這國船東的船掛哪些旗、掛這國旗的船的船東在哪裡（最新一年）
 */

const SHIP_TYPES = ['oil', 'bulk', 'general', 'container', 'other'] as const;
type ShipType = (typeof SHIP_TYPES)[number];

/** countries/<ISO3>.json */
interface ShippingDetail {
  /** 船旗國的船隊：各船種的載重噸（fetchJson 已還原差分編碼） */
  years?: number[];
  values?: Record<ShipType, (number | null)[]>;
  /** 實質船東在這個國家的船（千載重噸），掛本國旗、外國旗與 UNCTAD 列出的 28 個主要船旗 */
  owner?: { year: number; total: number; national: number; foreign: number; flags: [string, number][] };
  /** 掛這國旗的船，實質船東在哪些國家（千載重噸，前 10 名與其他） */
  flagOwners?: { year: number; owners: [string, number][]; rest: number };
  /** 港口自己公布的吞吐量（pipeline/sources/port_teu.py） */
  ports?: {
    zh: string;
    en: string;
    year: number;
    teu: number;
    publisher: string;
    publisherEn: string;
    url: string;
    published: string;
    scope: string;
    scopeEn: string;
    rounded: boolean;
  }[];
  /** 台灣各港的貨櫃裝卸量（TEU，臺灣港務公司） */
  taiwanPorts?: { years: number[]; total: number[]; ports: Record<string, number[]>; source: string };
}

const TEXT = defineMessages({
  zh: {
    portsTitle: '主要港口',
    portsSummary: (n: number, large: number, medium: number) =>
      `World Port Index 列出 ${n} 個港口（大型 ${large}、中型 ${medium}）。依港口班輪航運連結指數排列：`,
    portsCaption: (country: string) => `${country}的主要港口：大小、港口班輪航運連結指數與公布的貨櫃吞吐量`,
    noPorts: 'World Port Index 沒有列出這個國家的港口。',
    colPort: '港口',
    colSize: '大小',
    colPlsci: '連結指數',
    colTeu: (year: number) => `${year} 年 TEU`,
    plsciNote: (q: string) =>
      `連結指數是 UNCTAD 的港口班輪航運連結指數（PLSCI，${q}，2023 年第 1 季各港平均 = 100），只有貨櫃港有；依靠港的貨櫃船班次、運能、航線、船公司、最大船型與直航的港口數計算。`,
    teuSources: '港口公布的吞吐量出處',
    teuLine: (port: string, year: number, teu: string, scope: string) => `${port} ${year} 年 ${teu}${scope ? `（${scope}）` : ''}：`,
    rounded: '（官方只公布到這個精度）',
    twTitle: '台灣各港的貨櫃裝卸量',
    twAria: '台灣各國際商港歷年的貨櫃裝卸量',
    twNote: (year: number, total: string) =>
      `${year} 年合計 ${total}。臺灣港務公司的開放資料（政府資料開放平臺 8368），逐月加總；UNCTAD 的台灣數字跟這個合計一致。花蓮、蘇澳、安平港的貨櫃很少，併在「其他」。`,
    twPorts: { Kaohsiung: '高雄', Taichung: '臺中', Keelung: '基隆', Taipei: '臺北', other: '其他' } as Record<string, string>,
    fleetTitle: '船隊的組成（掛這國旗的船）',
    fleetAria: (country: string) => `${country}船旗的商船隊，各船種的載重噸`,
    fleetYear: (year: number) => `${year} 年 1 月 1 日`,
    types: { oil: '油輪', bulk: '散裝船', general: '雜貨船', container: '貨櫃船', other: '其他（液化氣、化學品、客輪、近海作業船…）' } as Record<ShipType, string>,
    ownerTitle: (country: string, year: number) => `${country}船東的船掛哪國的旗（${year} 年）`,
    ownerAria: (country: string) => `${country}實質船東的船隊，依船旗`,
    ownerSummary: (total: string, share: string) => `合計 ${total}，其中 ${share} 掛外國旗。`,
    nationalFlag: '本國旗',
    otherFlags: '其他船旗',
    ownerNote:
      'UNCTAD 只分出 28 個主要船旗，其他的併在「其他船旗」；香港、澳門、台灣各自算一個船旗。實質船東是負責營運的公司所在地，不一定是登記的船東。',
    flagOwnersTitle: (country: string, year: number) => `掛${country}旗的船，船東在哪裡（${year} 年）`,
    flagOwnersAria: (country: string) => `掛${country}旗的商船，依實質船東所在國`,
    otherOwners: '其他國家',
    national: (country: string) => `${country}（本國）`,
    dwt: (v: number) => `${formatLargeNumber(v)} 載重噸`,
    teu: (v: number) => `${formatLargeNumber(v)} TEU`,
  },
  en: {
    portsTitle: 'Main ports',
    portsSummary: (n, large, medium) =>
      `The World Port Index lists ${n} ${n === 1 ? 'port' : 'ports'} (${large} large, ${medium} medium). Ranked by port liner shipping connectivity:`,
    portsCaption: (country) => `Main ports of ${country}: size, port liner shipping connectivity and published container throughput`,
    noPorts: 'The World Port Index lists no ports for this country.',
    colPort: 'Port',
    colSize: 'Size',
    colPlsci: 'Connectivity',
    colTeu: (year) => `TEU ${year}`,
    plsciNote: (q) =>
      `Connectivity is UNCTAD’s Port Liner Shipping Connectivity Index (PLSCI, ${q}; the average port in Q1 2023 = 100), available for container ports only, built from container-ship calls, capacity, services, carriers, largest ship size and ports served directly.`,
    teuSources: 'Sources of the ports’ own figures',
    teuLine: (port, year, teu, scope) => `${port}, ${year}: ${teu}${scope ? ` (${scope})` : ''}: `,
    rounded: ' (rounded in the official figure)',
    twTitle: 'Container throughput of Taiwan’s ports',
    twAria: 'Container throughput of Taiwan’s international commercial ports by year',
    twNote: (year, total) =>
      `Total ${total} in ${year}. Open data from Taiwan International Ports Corporation (data.gov.tw dataset 8368), summed by month; UNCTAD’s figure for Taiwan matches this total. Hualien, Su-ao and Anping handle few containers and are grouped as Other.`,
    twPorts: { Kaohsiung: 'Kaohsiung', Taichung: 'Taichung', Keelung: 'Keelung', Taipei: 'Taipei', other: 'Other' },
    fleetTitle: 'Fleet by ship type (ships flying this flag)',
    fleetAria: (country) => `Merchant fleet flagged in ${country} by ship type, deadweight tons`,
    fleetYear: (year) => `1 January ${year}`,
    types: {
      oil: 'Oil tankers',
      bulk: 'Bulk carriers',
      general: 'General cargo',
      container: 'Container ships',
      other: 'Other (gas and chemical carriers, passenger ships, offshore vessels…)',
    },
    ownerTitle: (country, year) => `Flags flown by ships owned in ${country} (${year})`,
    ownerAria: (country) => `Fleet of beneficial owners based in ${country}, by flag`,
    ownerSummary: (total, share) => `${total} in total; ${share} under foreign flags.`,
    nationalFlag: 'National flag',
    otherFlags: 'Other flags',
    ownerNote:
      'UNCTAD singles out 28 major flags; the rest are grouped as Other flags. Hong Kong, Macao and Taiwan each count as a flag. The beneficial owner is where the company with commercial responsibility is based, not necessarily the registered owner.',
    flagOwnersTitle: (country, year) => `Where the owners of ${country}-flagged ships are based (${year})`,
    flagOwnersAria: (country) => `Merchant ships flagged in ${country}, by country of beneficial ownership`,
    otherOwners: 'Other countries',
    national: (country) => `${country} (national)`,
    dwt: (v) => `${formatLargeNumber(v)} dwt`,
    teu: (v) => `${formatLargeNumber(v)} TEU`,
  },
});

/** 側欄列出幾個港口、幾個船旗與船東國 */
const SHOWN_PORTS = 8;
const SHOWN_FLAGS = 8;
const TYPE_HUES: Record<ShipType, keyof Tokens['hues']> = {
  oil: 'orange',
  bulk: 'blue',
  general: 'yellow',
  container: 'aqua',
  other: 'violet',
};
const TW_PORT_HUES: Record<string, keyof Tokens['hues']> = {
  Kaohsiung: 'blue',
  Taichung: 'aqua',
  Keelung: 'orange',
  Taipei: 'violet',
  other: 'yellow',
};

export default function ShippingPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const base = `topics/${topic.id}`;
  const countries = useJson<CountryTable>('countries.json').data;
  // 港口圖層的同一個檔（地圖已經載入過就直接用快取）
  const portsFile = useJson<PointsData>(`${base}/ports.json`).data;
  const detail = useJson<ShippingDetail>(`${base}/countries/${iso3}.json`).data;
  const points = useMemo(() => (portsFile ? decodePoints(portsFile) : null), [portsFile]);
  const quarter = tr({
    zh: `${PLSCI_QUARTER.slice(0, 4)} 年第 ${Number(PLSCI_QUARTER.slice(5))} 季`,
    en: `Q${Number(PLSCI_QUARTER.slice(5))} ${PLSCI_QUARTER.slice(0, 4)}`,
  }, lang);

  const ports = useMemo(() => {
    if (!points) return null;
    const own = points.filter((p) => p.iso3 === iso3);
    const rank = (p: PointRecord) => [Number(p.teu ?? 0), Number(p.plsci ?? 0), Number(p.size ?? 0)];
    const sorted = [...own].sort((a, b) => {
      const [x, y] = [rank(a), rank(b)];
      return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
    });
    return {
      n: own.length,
      large: own.filter((p) => p.size === 4).length,
      medium: own.filter((p) => p.size === 3).length,
      shown: sorted.slice(0, SHOWN_PORTS),
    };
  }, [points, iso3]);

  const fleet = useMemo(() => {
    if (!detail?.years || !detail.values) return null;
    // 從這個國家第一年有資料的年份畫起（台灣 1995 年起才有）
    const start = detail.years.findIndex((_, i) => SHIP_TYPES.some((k) => detail.values![k][i] != null));
    if (start < 0) return null;
    const years = detail.years.slice(start);
    const values = Object.fromEntries(SHIP_TYPES.map((k) => [k, detail.values![k].slice(start)])) as Record<ShipType, (number | null)[]>;
    const series: StackedSeries[] = SHIP_TYPES.map((k) => ({ name: text.types[k], values: values[k], color: tokens.hues[TYPE_HUES[k]] }));
    const index = latestIndexAtOrBefore(years, year, (i) => SHIP_TYPES.some((k) => (values[k][i] ?? 0) > 0));
    if (index < 0) return null;
    const option = stackedAreaOption({ years, series, year, format: text.dwt, formatTick: formatLargeTick, tokens });
    const items: BarListItem[] = SHIP_TYPES.map((k) => ({ key: k, label: text.types[k], value: values[k][index] ?? 0, color: tokens.hues[TYPE_HUES[k]] }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);
    return { option, items, year: years[index], total: items.reduce((s, i) => s + i.value, 0) };
  }, [detail, year, tokens, text]);

  const taiwan = useMemo(() => {
    const tw = detail?.taiwanPorts;
    if (!tw) return null;
    const named = Object.keys(tw.ports);
    // 合計與各港相加有四捨五入的差（2017 年差 −1），夾到 0 以上，否則 y 軸會多出一格負的
    const other = tw.total.map((v, i) => Math.max(0, v - named.reduce((s, k) => s + tw.ports[k][i], 0)));
    const series: StackedSeries[] = [
      ...named.map((k) => ({ name: text.twPorts[k] ?? k, values: tw.ports[k], color: tokens.hues[TW_PORT_HUES[k] ?? 'yellow'] })),
      { name: text.twPorts.other, values: other, color: tokens.hues[TW_PORT_HUES.other] },
    ];
    const option = stackedAreaOption({ years: tw.years, series, year, format: text.teu, formatTick: formatLargeTick, tokens });
    const last = tw.years.length - 1;
    return { option, year: tw.years[last], total: tw.total[last] };
  }, [detail, year, tokens, text]);

  const name = (code: string) => nameOf(code, countries, lang);
  const owner = detail?.owner;
  const ownerItems: BarListItem[] = [];
  if (owner) {
    const listed = owner.flags.reduce((sum, [, v]) => sum + v, 0);
    const ranked = [
      { key: 'national', label: text.nationalFlag, value: owner.national * 1000, color: tokens.accent as string | undefined },
      ...owner.flags.map(([code, v]) => ({ key: code, label: name(code), value: v * 1000, color: undefined })),
    ]
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);
    // 前 SHOWN_FLAGS 名、而且至少占 0.5% 的才列出來，其他（含 UNCTAD 沒分出來的船旗）併成「其他船旗」
    const shown = ranked.filter((i, n) => i.key === 'national' || (n < SHOWN_FLAGS && i.value >= owner.total * 1000 * 0.005));
    ownerItems.push(...shown);
    const other = Math.max(0, owner.foreign - listed) * 1000 + ranked.filter((i) => !shown.includes(i)).reduce((sum, i) => sum + i.value, 0);
    if (other > 0) ownerItems.push({ key: 'other', label: text.otherFlags, value: other, color: tokens.context });
  }
  const flagOwners = detail?.flagOwners;
  const flagOwnersTotal = flagOwners ? (flagOwners.owners.reduce((sum, [, v]) => sum + v, 0) + flagOwners.rest) * 1000 : 0;
  const flagOwnerItems: BarListItem[] = [];
  if (flagOwners) {
    const shown = flagOwners.owners.filter(([, v], n) => n < SHOWN_FLAGS && v * 1000 >= flagOwnersTotal * 0.005);
    flagOwnerItems.push(
      ...shown.map(([code, v]) => ({
        key: code,
        label: code === iso3 ? text.national(name(code)) : name(code),
        value: v * 1000,
        color: code === iso3 ? tokens.accent : undefined,
      })),
    );
    const rest = flagOwnersTotal - shown.reduce((sum, [, v]) => sum + v * 1000, 0);
    if (rest > 0) flagOwnerItems.push({ key: 'rest', label: text.otherOwners, value: rest, color: tokens.context });
  }

  if (!points && !detail) return <p className="empty">{t.loading}</p>;

  return (
    <>
      <section className="panel-section">
        <h3>{text.portsTitle}</h3>
        {!ports ? (
          <p className="empty">{t.loading}</p>
        ) : ports.n === 0 ? (
          <p className="empty">{text.noPorts}</p>
        ) : (
          <>
            <p className="panel-year-note">{text.portsSummary(ports.n, ports.large, ports.medium)}</p>
            <table className="mini-table" aria-label={text.portsCaption(countryName)}>
              <thead>
                <tr>
                  <th scope="col">{text.colPort}</th>
                  <th scope="col">{text.colSize}</th>
                  <th scope="col" className="num">
                    {text.colPlsci}
                  </th>
                  <th scope="col" className="num">
                    {text.colTeu(detail?.ports?.[0]?.year ?? 2025)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ports.shown.map((p, i) => {
                  const label = portName(p, lang);
                  return (
                    <tr key={`${i}-${String(p.name)}`}>
                      <th scope="row" translate={label === p.name ? 'no' : undefined}>
                        {label}
                      </th>
                      <td>{tr(PORT_SIZE_SHORT[Number(p.size)] ?? PORT_SIZE_SHORT[0], lang)}</td>
                      <td className="num">{typeof p.plsci === 'number' ? fixed(p.plsci, 0) : '–'}</td>
                      <td className="num">{typeof p.teu === 'number' ? formatLargeNumber(p.teu) : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="note">{text.plsciNote(quarter)}</p>
          </>
        )}
        {detail?.ports && detail.ports.length > 0 && (
          <>
            <h4>{text.teuSources}</h4>
            <ul className="note source-list">
              {detail.ports.map((c) => {
                const scope = lang === 'zh' ? c.scope : c.scopeEn;
                return (
                  <li key={c.zh}>
                    {text.teuLine(lang === 'zh' ? c.zh : c.en, c.year, text.teu(c.teu), scope)}
                    <a href={c.url} target="_blank" rel="noreferrer">
                      {lang === 'zh' ? c.publisher : c.publisherEn}
                    </a>
                    {c.rounded && text.rounded}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {taiwan && (
        <section className="panel-section">
          <h3>{text.twTitle}</h3>
          <Chart spec={taiwan.option} height={220} ariaLabel={text.twAria} />
          <p className="note">{text.twNote(taiwan.year, text.teu(taiwan.total))}</p>
        </section>
      )}

      {fleet && (
        <section className="panel-section">
          <h3>{text.fleetTitle}</h3>
          <Chart spec={fleet.option} height={200} ariaLabel={text.fleetAria(countryName)} />
          <p className="panel-year-note">{text.fleetYear(fleet.year)}</p>
          <BarList items={fleet.items} format={text.dwt} total={fleet.total} ariaLabel={text.fleetAria(countryName)} />
        </section>
      )}

      {owner && ownerItems.length > 0 && (
        <section className="panel-section">
          <h3>{text.ownerTitle(countryName, owner.year)}</h3>
          <p className="panel-year-note">
            {text.ownerSummary(text.dwt(owner.total * 1000), `${fixed((owner.foreign / owner.total) * 100, 0)}%`)}
          </p>
          <BarList items={ownerItems} format={text.dwt} total={owner.total * 1000} ariaLabel={text.ownerAria(countryName)} />
          <p className="note">{text.ownerNote}</p>
        </section>
      )}

      {flagOwners && flagOwners.owners.length > 0 && (
        <section className="panel-section">
          <h3>{text.flagOwnersTitle(countryName, flagOwners.year)}</h3>
          <BarList items={flagOwnerItems} format={text.dwt} total={flagOwnersTotal} ariaLabel={text.flagOwnersAria(countryName)} />
        </section>
      )}
    </>
  );
}
