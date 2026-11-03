import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Indicator, PanelExtraProps } from '../types';

/** pipeline/topics/newborn_screening.py 的 panel.json */
interface NewbornFile {
  diseases: { code: string; zh: string; en: string; group: 'misc' | 'aa' | 'fao' | 'oa' }[];
  /** s：30 種疾病的等級（一個字一種，0–3）；y：開始年份；l：篩檢實驗室數；t：採血時間（小時）；o：「其他」欄的附註編號；r：地區 */
  countries: Record<string, { s?: string; y?: number; l?: string; t?: string; o?: string; r: string }>;
}

/** pipeline/topics/newborn_screening.py 的 taiwan.json：國健署的歷年成果（1984–2024） */
interface TaiwanFile {
  years: number[];
  /** 篩檢率（%，篩檢人數 ÷ 出生數） */
  rate: number[];
  screened: number[];
  /** 每千名篩檢的蠶豆症、先天性甲狀腺低能症個案 */
  g6pd: (number | null)[];
  ch: (number | null)[];
  total: number[];
  /** 21 種疾病：開始篩的年份、最近一年與累計的異常個案數 */
  diseases: { zh: string; en: string; code: string | null; from: number; latest: number; total: number }[];
}

const GROUPS = ['misc', 'aa', 'fao', 'oa'] as const;
const count = (n: number) => fixed(n, 0);

/** 圖表用的指標：只借 format 與刻度，用循序的圖層，折線圖才不會在 0 畫一條橫線 */
function chartIndicator(base: Indicator, format: (v: number) => string, tick: (v: number) => string): Indicator {
  return { ...base, format, formatTick: tick, integer: false, layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [] } } };
}

const TEXT = defineMessages({
  zh: {
    title: '篩哪些病',
    groups: { misc: '內分泌、血液與其他', aa: '胺基酸代謝', fao: '脂肪酸氧化', oa: '有機酸代謝' },
    levels: ['沒有', '試辦或少數醫院', '國家計畫，涵蓋不到一半', '國家計畫，涵蓋過半'],
    facts: (y?: number, l?: string, t?: string) =>
      [y ? `${y} 年開始` : null, l ? `篩檢實驗室 ${l} 個` : null, t ? `出生後 ${t} 小時採血` : null].filter(Boolean).join('・'),
    other: (o: string) => `論文表上「其他」欄另有附註第 ${o} 項（其他疾病，見論文原文）。`,
    noInfo: '論文的表上沒有這一國的資料。',
    ssa: '撒哈拉以南非洲的表只列了 5 種病，其他的當作沒有篩。',
    us: '美國、加拿大依各州、省的出生數加權：篩這種病的州、省出生數過半才算「涵蓋過半」。',
    twTitle: '台灣的歷年成果',
    twSummary: (y: number, n: number, rate: number, total: number) =>
      `${y} 年篩檢 ${count(n)} 人，篩檢率 ${fixed(rate, 1)}%，異常個案 ${count(total)} 例。`,
    rateTitle: '篩檢率',
    rateLine: '篩檢率',
    rateAria: '台灣歷年的新生兒篩檢率',
    casesTitles: ['蠶豆症（每千名篩檢）', '先天性甲狀腺低能症（每千名篩檢）'],
    casesLines: ['蠶豆症', '先天性甲狀腺低能症'],
    casesAria: ['台灣歷年每千名篩檢的蠶豆症個案', '台灣歷年每千名篩檢的先天性甲狀腺低能症個案'],
    perK: (v: number) => `每千名 ${fixed(v, 1)} 例`,
    tableCaption: '國健署成果表的 21 種疾病：開始篩檢的時間與異常個案數',
    colDisease: '疾病',
    colLatest: (y: number) => `${y} 年`,
    colTotal: '累計',
    since: (y: number) => (y === 2006 ? '2006 年 7 月起' : y === 2019 ? '2019 年 10 月起' : `${y} 年起`),
    g6pdName: '蠶豆症（G6PD 缺乏症）',
    twNote:
      '衛福部國民健康署「新生兒先天性代謝異常疾病篩檢歷年成果表」（3 家篩檢中心，全國，政府資料開放授權條款第 1 版）。篩檢率是篩檢人數 ÷ 出生數，2004–2006 年篩檢人數比出生數多，所以超過 100%（表上沒有說明原因）；2014 年的出生數是表上用篩檢人數倒推的。表上沒有寫「異常個案」是篩檢陽性還是確診。蠶豆症 1984–1986 年是 0、1987 年才有個案，表上沒有說明，從 1987 年開始畫。2006 年 7 月、2019 年 10 月加入的疾病，那一年不是整年。論文的 30 種跟國健署的 21 種分法不同（例如論文把瓜胺酸血症第 I、II 型算一種），上面的勾選表依論文。',
  },
  en: {
    title: 'Conditions screened',
    groups: { misc: 'Endocrine, blood and other', aa: 'Amino acid disorders', fao: 'Fatty acid oxidation disorders', oa: 'Organic acid disorders' },
    levels: ['No', 'Pilot or a few hospitals', 'National, under half covered', 'National, over half covered'],
    facts: (y, l, t) =>
      [y ? `Since ${y}` : null, l ? `${l} screening laboratories` : null, t ? `sample at ${t} hours` : null].filter(Boolean).join(' · '),
    other: (o) => `The paper’s “other” column adds note ${o} (further conditions; see the paper).`,
    noInfo: 'The paper’s tables have no information for this country.',
    ssa: 'The sub-Saharan Africa table lists only five conditions; the rest count as not screened.',
    us: 'The US and Canada are weighted by births in each state or province: a condition counts as over half covered when states or provinces with over half the births screen for it.',
    twTitle: 'Results in Taiwan over time',
    twSummary: (y, n, rate, total) => `${y}: ${count(n)} newborns screened (${fixed(rate, 1)}% coverage), ${count(total)} abnormal cases.`,
    rateTitle: 'Screening coverage',
    rateLine: 'Coverage',
    rateAria: 'Newborn screening coverage in Taiwan over time',
    casesTitles: ['G6PD deficiency (per 1,000 screened)', 'Congenital hypothyroidism (per 1,000 screened)'],
    casesLines: ['G6PD deficiency', 'Congenital hypothyroidism'],
    casesAria: [
      'G6PD deficiency cases per 1,000 newborns screened in Taiwan over time',
      'Congenital hypothyroidism cases per 1,000 newborns screened in Taiwan over time',
    ],
    perK: (v) => `${fixed(v, 1)} per 1,000`,
    tableCaption: 'The 21 conditions in the Health Promotion Administration table: when screening began and abnormal cases',
    colDisease: 'Condition',
    colLatest: (y) => String(y),
    colTotal: 'Total',
    since: (y) => (y === 2006 ? 'From July 2006' : y === 2019 ? 'From October 2019' : `From ${y}`),
    g6pdName: 'G6PD deficiency',
    twNote:
      'Health Promotion Administration, Ministry of Health and Welfare, newborn screening results (three screening centres, national; Open Government Data License, Taiwan 1.0). Coverage is newborns screened ÷ births; in 2004–2006 more newborns were screened than were born, so it exceeds 100% (the table does not say why), and the 2014 birth figure is back-calculated in the table from the number screened. The table does not say whether “abnormal cases” are screen positives or confirmed cases. G6PD deficiency shows 0 in 1984–1986 and cases only from 1987, without explanation, so the line starts in 1987. Conditions added in July 2006 and October 2019 cover only part of that year. The paper’s 30 conditions are grouped differently from the administration’s 21 (for example, the paper counts citrullinaemia types I and II as one); the checklist above follows the paper.',
  },
});

function TaiwanHistory({ data, indicator, year, tokens }: { data: TaiwanFile } & Pick<PanelExtraProps, 'indicator' | 'year' | 'tokens'>) {
  const lang = useLang();
  const text = TEXT[lang];
  const charts = useMemo(() => {
    const rate = timeSeriesOption({
      years: data.years,
      lines: [{ name: text.rateLine, values: data.rate, color: tokens.hues.blue }],
      year,
      indicator: chartIndicator(indicator, (v) => `${fixed(v, 1)}%`, (v) => `${fixed(v, 0)}%`),
      tokens,
    });
    // 兩種病差 10 倍，各畫一張（同一張的話甲狀腺低能症的變化看不出來）
    const cases = [data.g6pd, data.ch].map((values, i) =>
      timeSeriesOption({
        years: data.years,
        lines: [{ name: text.casesLines[i], values, color: tokens.hues.orange }],
        year,
        indicator: chartIndicator(indicator, text.perK, (v) => fixed(v, i ? 1 : 0)),
        tokens,
      }),
    );
    return { rate, cases };
  }, [data, indicator, year, tokens, text]);
  const last = data.years.length - 1;
  const latestYear = data.years[last];
  // 依開始篩檢的時間分組（1984 年、2006 年 7 月、2019 年 10 月）
  const groups = [...new Set(data.diseases.map((d) => d.from))];
  return (
    <section className="panel-section">
      <h3>{text.twTitle}</h3>
      <p className="note">{text.twSummary(latestYear, data.screened[last], data.rate[last], data.total[last])}</p>
      <h4>{text.rateTitle}</h4>
      <Chart spec={charts.rate} height={150} ariaLabel={text.rateAria} />
      {charts.cases.map((spec, i) => (
        <div key={i}>
          <h4>{text.casesTitles[i]}</h4>
          <Chart spec={spec} height={130} ariaLabel={text.casesAria[i]} />
        </div>
      ))}
      <table className="mini-table screening-tw" aria-label={text.tableCaption}>
        <thead>
          <tr>
            <th scope="col">{text.colDisease}</th>
            <th scope="col" className="num">
              {text.colLatest(latestYear)}
            </th>
            <th scope="col" className="num">
              {text.colTotal}
            </th>
          </tr>
        </thead>
        {groups.map((from) => (
          <tbody key={from}>
            <tr className="is-group">
              <th scope="colgroup" colSpan={3}>
                {text.since(from)}
              </th>
            </tr>
            {data.diseases
              .filter((d) => d.from === from)
              .map((d) => (
                <tr key={d.zh}>
                  <th scope="row">{d.code === 'G6PD' ? text.g6pdName : lang === 'en' ? d.en : d.zh}</th>
                  <td className="num">{count(d.latest)}</td>
                  <td className="num">{count(d.total)}</td>
                </tr>
              ))}
          </tbody>
        ))}
      </table>
      <p className="note">{text.twNote}</p>
    </section>
  );
}

export default function NewbornScreeningPanel({ topic, iso3, indicator, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<NewbornFile>(`topics/${topic.id}/panel.json`);
  const taiwan = useJson<TaiwanFile>(iso3 === 'TWN' ? `topics/${topic.id}/taiwan.json` : null).data;
  const country = data?.countries[iso3];
  if (!data || !country) return null;
  if (!country.s) {
    return (
      <section className="panel-section">
        <h3>{text.title}</h3>
        <p className="note">{text.noInfo}</p>
      </section>
    );
  }
  const levels = country.s;
  const facts = text.facts(country.y, country.l, country.t);
  return (
    <>
      <section className="panel-section">
        <h3>{text.title}</h3>
        {facts && <p className="note">{facts}</p>}
        {GROUPS.map((group) => (
          <div key={group}>
            <h4>{text.groups[group]}</h4>
            <ul className="screening-list">
              {data.diseases.map((d, i) =>
                d.group === group ? (
                  <li key={d.code} className={`is-level-${levels[i]}`}>
                    <span className="screening-name">
                      {lang === 'en' ? d.en : d.zh} <span className="screening-code">{d.code}</span>
                    </span>
                    <span className="screening-level">{text.levels[Number(levels[i])]}</span>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        ))}
        {country.o && <p className="note">{text.other(country.o)}</p>}
        {country.r === 'ssa' && <p className="note">{text.ssa}</p>}
        {country.r === 'na' && <p className="note">{text.us}</p>}
      </section>
      {taiwan && <TaiwanHistory data={taiwan} indicator={indicator} year={year} tokens={tokens} />}
    </>
  );
}
