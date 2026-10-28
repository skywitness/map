import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { EChart } from '../../charts/EChart';
import { latestIndexAtOrBefore, stackedAreaOption } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed, formatPercent } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';
import TradePanel from './TradePanel';

/**
 * 石油、天然氣與煤的側欄（pipeline/topics/fossil_fuels.py 的 countries/<ISO3>.json，加上三種燃料的產量、消費量指標檔）：
 * - 這一年三種燃料的產量、消費量、自給率，天然氣與煤加上進出口（EIA）
 * - 初級能源結構（EIA，千兆 Btu 換成艾焦耳）：歷年堆疊面積與這一年的長條
 * - 這一年的主要出口對象、進口來源（流向檔，重用貿易主題的 TradePanel）
 * - GEM：LNG 接收站、產量最大的油氣田、產能最大的煤礦、管線數
 * - 台灣：能源署的進口來源跟 BACI 對照
 */

type Fuel = 'oil' | 'gas' | 'coal';
const FUELS: Fuel[] = ['oil', 'gas', 'coal'];
type MixKey = 'coal' | 'gas' | 'oil' | 'nuclear' | 'renewables';
const MIX_KEYS: MixKey[] = ['coal', 'gas', 'oil', 'nuclear', 'renewables'];
/** 1 千兆 Btu = 1.055 艾焦耳 */
const QBTU_TO_EJ = 1.055056;

interface ImportBlock {
  years: number[];
  unit: string;
  total: number[];
  baciTotal: number[];
  partners: [string, (number | null)[], (number | null)[]][];
  other: number[];
}

interface FossilDetail {
  mix?: { years: number[] } & Partial<Record<MixKey, (number | null)[]>>;
  eiaTrade?: { years: number[] } & Partial<Record<'gas-import' | 'gas-export' | 'coal-import' | 'coal-export', (number | null)[]>>;
  /** [名稱, 1 進口／2 出口, 運轉中容量, 興建中與規劃中容量, 啟用年份] */
  lng?: [string, number, number, number, number | null][];
  /** [名稱, 產量（百萬桶油當量/年）, 產量的年份, 狀態] */
  fields?: [string, number, number | null, number][];
  fieldCount?: number;
  /** [名稱, 產能, 產量, 產量的年份]（百萬公噸） */
  mines?: [string, number | null, number | null, number | null][];
  mineCount?: number;
  pipelines?: { gas?: number; oil?: number };
  taiwan?: { oil: ImportBlock; lng: ImportBlock; coal: ImportBlock };
}

const MIX: Record<MixKey, { label: Text; hue: Hue }> = {
  coal: { label: { zh: '煤', en: 'Coal' }, hue: 'red' },
  gas: { label: { zh: '天然氣', en: 'Gas' }, hue: 'violet' },
  oil: { label: { zh: '石油', en: 'Oil' }, hue: 'orange' },
  nuclear: { label: { zh: '核能', en: 'Nuclear' }, hue: 'aqua' },
  renewables: { label: { zh: '再生能源與其他', en: 'Renewables and other' }, hue: 'green' },
};

const FUEL_LABEL: Record<Fuel, Text> = {
  oil: { zh: '石油', en: 'Oil' },
  gas: { zh: '天然氣', en: 'Gas' },
  coal: { zh: '煤', en: 'Coal' },
};

const TEXT = defineMessages({
  zh: {
    fuelsTitle: (year: number) => `${year} 年三種燃料`,
    production: '產量',
    consumption: '消費量',
    selfSufficiency: '自給率',
    trade: '進口／出口',
    fuelsNote: '石油：千桶/日；天然氣：十億立方公尺；煤：百萬公噸（EIA）。石油的產量是原油；自給率是產量 ÷ 消費量，石油的分子另外含天然氣液與其他液體。',
    mixTitle: '初級能源結構',
    mixAria: (country: string) => `${country}歷年各種初級能源消費的堆疊面積圖`,
    mixYear: (year: number) => `${year} 年初級能源消費`,
    mixList: (country: string, year: number) => `${country}${year} 年初級能源結構`,
    mixNote: '全部能源的消費（含運輸、工業、發電用的燃料），不是發電結構；單位艾焦耳（EJ），EIA 的千兆 Btu 換算。',
    gemTitle: 'Global Energy Monitor 收錄的設施',
    lngTitle: 'LNG 接收站',
    lngImport: '進口',
    lngExport: '出口',
    lngCapacity: (op: string, plan: string) => (plan ? `運轉中 ${op}，另有興建中與規劃中 ${plan}` : `運轉中 ${op}`),
    lngPlannedOnly: (plan: string) => `興建中與規劃中 ${plan}`,
    since: (year: number) => `${year} 年啟用`,
    fieldsTitle: (n: number, total: number) => (total > n ? `產量最大的 ${n} 個油氣田（共 ${total} 個有產量）` : '油氣田'),
    fieldsAria: (country: string) => `${country}產量最大的油氣田`,
    minesTitle: (n: number, total: number) => (total > n ? `產能最大的 ${n} 座運轉中煤礦（共 ${total} 座）` : '運轉中的煤礦'),
    minesAria: (country: string) => `${country}產能最大的煤礦`,
    pipelines: (gas: number, oil: number) =>
      [gas ? `天然氣管線 ${gas} 條` : '', oil ? `油管 ${oil} 條` : ''].filter(Boolean).join('、') + '（含運轉中、興建中與規劃中，跨國的每一國都算）。',
    taiwanNoGem: '台灣沒有 GEM 收錄的油管、油氣田與煤礦。',
    taiwanTitle: (fuel: string) => `台灣的${fuel}進口來源：能源署 vs BACI`,
    partner: '來源國',
    official: '能源署',
    baci: 'BACI',
    other: '其他',
    taiwanNote:
      '能源署的進口來源年資料只有幾個主要來源國的欄位，其餘併進「其他」；BACI 是出口國申報的數量（台灣沒有自己的申報，代碼也不全是台灣），占比可能不同。',
    noTaiwanYear: (year: number) => `能源署的進口來源只有 2005 年起，沒有 ${year} 年。`,
    oilImport: '原油',
    lngImportLabel: '液化天然氣',
    coalImport: '煤炭',
    mtpa: (v: string) => `每年 ${v} 百萬公噸`,
    mboe: (v: string) => `每年 ${v} 百萬桶油當量`,
  },
  en: {
    fuelsTitle: (year) => `Three fuels, ${year}`,
    production: 'Production',
    consumption: 'Consumption',
    selfSufficiency: 'Self-sufficiency',
    trade: 'Imports / exports',
    fuelsNote:
      'Oil: thousand barrels per day; gas: billion cubic metres; coal: million tonnes (EIA). Oil production is crude oil; self-sufficiency is production divided by consumption, and for oil the numerator also includes natural gas liquids and other liquids.',
    mixTitle: 'Primary energy mix',
    mixAria: (country) => `Stacked area chart of primary energy consumption by source in ${country} over time`,
    mixYear: (year) => `Primary energy consumption, ${year}`,
    mixList: (country, year) => `Primary energy mix of ${country}, ${year}`,
    mixNote:
      'All energy consumed (including fuels for transport, industry and power), not the electricity mix; in exajoules (EJ), converted from EIA quadrillion Btu.',
    gemTitle: 'Facilities tracked by Global Energy Monitor',
    lngTitle: 'LNG terminals',
    lngImport: 'import',
    lngExport: 'export',
    lngCapacity: (op, plan) => (plan ? `${op} operating, plus ${plan} under construction or proposed` : `${op} operating`),
    lngPlannedOnly: (plan) => `${plan} under construction or proposed`,
    since: (year) => `since ${year}`,
    fieldsTitle: (n, total) => (total > n ? `Top ${n} oil and gas fields by output (of ${total} with output data)` : 'Oil and gas fields'),
    fieldsAria: (country) => `Largest oil and gas fields of ${country}`,
    minesTitle: (n, total) => (total > n ? `Top ${n} operating coal mines by capacity (of ${total})` : 'Operating coal mines'),
    minesAria: (country) => `Largest coal mines of ${country}`,
    pipelines: (gas, oil) =>
      [gas ? `${gas} gas pipelines` : '', oil ? `${oil} oil pipelines` : ''].filter(Boolean).join(' and ') +
      ' (operating, under construction or proposed; cross-border lines count for every country).',
    taiwanNoGem: 'GEM lists no oil pipelines, oil and gas fields or coal mines in Taiwan.',
    taiwanTitle: (fuel) => `Taiwan's ${fuel} import sources: Energy Administration vs BACI`,
    partner: 'Source',
    official: 'Energy Admin.',
    baci: 'BACI',
    other: 'Other',
    taiwanNote:
      "The Energy Administration's import-source data have columns only for a few main suppliers, with the rest under \"other\"; BACI quantities are reported by exporters (Taiwan has no reports of its own, and the code is not only Taiwan), so shares can differ.",
    noTaiwanYear: (year) => `The Energy Administration's import-source data start in 2005; none for ${year}.`,
    oilImport: 'crude oil',
    lngImportLabel: 'LNG',
    coalImport: 'coal',
    mtpa: (v) => `${v} Mt/y`,
    mboe: (v) => `${v} million boe/y`,
  },
});

/** 依大小決定小數位（同 fossil-fuels.ts 的 num） */
function num(v: number): string {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 100) return fixed(v, 0);
  if (a >= 10) return fixed(v, 1);
  if (a >= 1) return fixed(v, 2);
  return fixed(v, Math.min(6, 2 - Math.floor(Math.log10(a))));
}

/** 指標檔裡這個國家在這一年（沒有就往前找最近一年）的值 */
function valueAt(data: IndicatorData | null, iso3: string, year: number): number | null {
  const series = data?.values[iso3];
  if (!data || !series) return null;
  for (let i = data.years.length - 1; i >= 0; i--) {
    if (data.years[i] <= year && series[i] != null) return series[i];
  }
  return null;
}

function seriesAt(years: number[] | undefined, series: (number | null)[] | undefined, year: number): number | null {
  if (!years || !series) return null;
  const i = years.indexOf(year);
  return i >= 0 ? series[i] : null;
}

export default function FossilFuelsPanel(props: PanelExtraProps) {
  const { topic, iso3, year, item, countryName, tokens } = props;
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data: detail } = useJson<FossilDetail>(`topics/${topic.id}/countries/${iso3}.json`);
  const countries = useJson<CountryTable>('countries.json').data;
  const files = useMemo(
    () =>
      FUELS.flatMap((f) => ['production', 'consumption', 'self-sufficiency'].map((k) => `topics/${topic.id}/${k}/${f}.json`)),
    [topic.id],
  );
  const volumes = useJsonMany<IndicatorData>(files);

  const mix = useMemo(() => {
    const m = detail?.mix;
    if (!m) return null;
    const keys = MIX_KEYS.filter((k) => m[k]);
    const ej = (k: MixKey) => (m[k] ?? []).map((v) => (v == null ? null : v * QBTU_TO_EJ));
    const series = keys.map((k) => ({ name: tr(MIX[k].label, lang), values: ej(k), color: tokens.hues[MIX[k].hue] }));
    const index = latestIndexAtOrBefore(m.years, year, (i) => keys.some((k) => (m[k]?.[i] ?? 0) > 0));
    const format = (v: number) => `${num(v)} EJ`;
    const option = stackedAreaOption({ years: m.years, series, year, format, formatTick: (v) => num(v), tokens });
    const items = keys
      .map((k) => ({ key: k, label: tr(MIX[k].label, lang), value: ej(k)[index] ?? 0, color: tokens.hues[MIX[k].hue] }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);
    return { option, items, shownYear: index >= 0 ? m.years[index] : null, format };
  }, [detail, year, tokens, lang]);

  const fuelRows = FUELS.map((fuel, i) => {
    const prod = valueAt(volumes[i * 3], iso3, year);
    const cons = valueAt(volumes[i * 3 + 1], iso3, year);
    // 自給率用指標檔（石油的分子含天然氣液與其他液體，不是表上的原油產量）
    const ratio = valueAt(volumes[i * 3 + 2], iso3, year);
    const trade = detail?.eiaTrade;
    const imp = fuel === 'oil' ? null : seriesAt(trade?.years, trade?.[`${fuel}-import`], year);
    const exp = fuel === 'oil' ? null : seriesAt(trade?.years, trade?.[`${fuel}-export`], year);
    return { fuel, prod, cons, ratio, imp, exp };
  });
  const hasFuels = fuelRows.some((r) => r.prod != null || r.cons != null);

  const taiwanFuel = item === 'coal' ? 'coal' : item === 'oil' ? 'oil' : 'lng';
  const taiwan = iso3 === 'TWN' ? detail?.taiwan?.[taiwanFuel] : undefined;
  const taiwanIndex = taiwan ? taiwan.years.indexOf(year) : -1;
  const taiwanLabel = taiwanFuel === 'oil' ? text.oilImport : taiwanFuel === 'coal' ? text.coalImport : text.lngImportLabel;
  const pct = (v: number | null | undefined) => (v == null ? '–' : formatPercent(v, 1));

  return (
    <>
      {hasFuels && (
        <section className="panel-section">
          <h3>{text.fuelsTitle(year)}</h3>
          <table className="mini-table">
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col" className="num">{text.production}</th>
                <th scope="col" className="num">{text.consumption}</th>
                <th scope="col" className="num">{text.selfSufficiency}</th>
                <th scope="col" className="num">{text.trade}</th>
              </tr>
            </thead>
            <tbody>
              {fuelRows.map((r) => (
                <tr key={r.fuel} className={r.fuel === item ? 'is-current' : undefined}>
                  <th scope="row">{tr(FUEL_LABEL[r.fuel], lang)}</th>
                  <td className="num">{r.prod == null ? '–' : num(r.prod)}</td>
                  <td className="num">{r.cons == null ? '–' : num(r.cons)}</td>
                  <td className="num">{r.ratio == null ? '–' : formatPercent(r.ratio, r.ratio >= 100 ? 0 : 1)}</td>
                  <td className="num">
                    {r.imp == null && r.exp == null ? '–' : `${r.imp == null ? '–' : num(r.imp)} / ${r.exp == null ? '–' : num(r.exp)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.fuelsNote}</p>
        </section>
      )}

      {mix && (
        <section className="panel-section">
          <h3>{text.mixTitle}</h3>
          <EChart option={mix.option} height={200} ariaLabel={text.mixAria(countryName)} />
          {mix.shownYear !== null && (
            <>
              <h4>
                {text.mixYear(mix.shownYear)}
                {mix.shownYear !== year && <span className="muted">{t.yearMissing(year)}</span>}
              </h4>
              <BarList
                items={mix.items}
                format={mix.format}
                total={mix.items.reduce((s, i) => s + i.value, 0)}
                ariaLabel={text.mixList(countryName, mix.shownYear)}
              />
            </>
          )}
          <p className="note">{text.mixNote}</p>
        </section>
      )}

      <TradePanel {...props} />

      {taiwan && (
        <section className="panel-section">
          <h3>{text.taiwanTitle(taiwanLabel)}</h3>
          {taiwanIndex < 0 ? (
            <p className="empty">{text.noTaiwanYear(year)}</p>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th scope="col">{text.partner}</th>
                  <th scope="col" className="num">{text.official}</th>
                  <th scope="col" className="num">{text.baci}</th>
                </tr>
              </thead>
              <tbody>
                {taiwan.partners
                  .filter(([, o, b]) => (o[taiwanIndex] ?? 0) > 0 || (b[taiwanIndex] ?? 0) > 0)
                  .map(([p, o, b]) => (
                    <tr key={p}>
                      <th scope="row">{nameOf(p, countries, lang)}</th>
                      <td className="num">{pct(o[taiwanIndex])}</td>
                      <td className="num">{pct(b[taiwanIndex])}</td>
                    </tr>
                  ))}
                <tr>
                  <th scope="row">{text.other}</th>
                  <td className="num">{pct(taiwan.other[taiwanIndex])}</td>
                  <td className="num" />
                </tr>
              </tbody>
            </table>
          )}
          <p className="note">{text.taiwanNote}</p>
        </section>
      )}

      {detail && (detail.lng || detail.fields || detail.mines || detail.pipelines || iso3 === 'TWN') && (
        <section className="panel-section">
          <h3>{text.gemTitle}</h3>
          {detail.pipelines && <p className="note">{text.pipelines(detail.pipelines.gas ?? 0, detail.pipelines.oil ?? 0)}</p>}
          {detail.lng && (
            <>
              <h4>{text.lngTitle}</h4>
              <ul className="plain-list">
                {detail.lng.map(([name, kind, op, plan, start], i) => (
                  <li key={i}>
                    <span translate="no">{name}</span>
                    {' · '}
                    {kind === 2 ? text.lngExport : text.lngImport}
                    {' · '}
                    {op > 0 ? text.lngCapacity(text.mtpa(num(op)), plan > 0 ? num(plan) : '') : text.lngPlannedOnly(text.mtpa(num(plan)))}
                    {start ? ` · ${text.since(start)}` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
          {detail.fields && (
            <>
              <h4>{text.fieldsTitle(detail.fields.length, detail.fieldCount ?? detail.fields.length)}</h4>
              <BarList
                items={detail.fields.map(([name, prod], i) => ({ key: String(i), label: name, value: prod }))}
                format={(v) => text.mboe(num(v))}
                ariaLabel={text.fieldsAria(countryName)}
                properNouns
              />
            </>
          )}
          {detail.mines && (
            <>
              <h4>{text.minesTitle(detail.mines.length, detail.mineCount ?? detail.mines.length)}</h4>
              <BarList
                items={detail.mines.map(([name, cap, prod], i) => ({ key: String(i), label: name, value: cap ?? prod ?? 0 }))}
                format={(v) => text.mtpa(num(v))}
                ariaLabel={text.minesAria(countryName)}
                properNouns
              />
            </>
          )}
          {iso3 === 'TWN' && <p className="note">{text.taiwanNoGem}</p>}
        </section>
      )}
    </>
  );
}
