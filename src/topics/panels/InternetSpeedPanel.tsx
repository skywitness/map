import { useMemo } from 'react';
import { EChart } from '../../charts/EChart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 網路速度的側欄（pipeline/topics/internet_speed.py）：
 * - 固網與行動網路的下載速度歷年變化，虛線是全世界
 * - 選定那一季的下載、上傳、延遲（中位數，下載另列平均）、測試次數與圖塊數，跟全世界對照
 * - 台灣：NCC、數位發展部的官方定點量測跟 Ookla 的行動網路對照
 */

type Kind = 'fixed' | 'mobile';
const KINDS: Kind[] = ['fixed', 'mobile'];

/** 一種網路的歷年數值，跟 years 一一對應；測試太少的季沒有速度（null），測試次數照列 */
interface KindSeries {
  /** 下載、上傳（Mbps）與延遲（毫秒）的中位數，下載另有平均 */
  d: (number | null)[];
  dMean: (number | null)[];
  u: (number | null)[];
  lat: (number | null)[];
  tests: number[];
  tiles: number[];
}

/** 台灣的官方量測（pipeline/sources/tw_mobile_speed.py）：NCC 的 4G 全國平均、數位發展部的 5G 各業者 22 縣市平均 */
interface Official {
  year: number;
  agency: 'ncc' | 'moda';
  tech: '4G' | '5G';
  down?: number;
  up?: number | null;
  /** 各業者：[業者代碼, 下載, 上傳]（Mbps） */
  operators?: [string, number, number][];
}

/** countries/<ISO3>.json 與 world.json */
interface SpeedFile {
  years: number[];
  minTests: number;
  fixed: KindSeries;
  mobile: KindSeries;
  official?: Official[];
}

const OPERATORS: Record<string, { zh: string; en: string }> = {
  cht: { zh: '中華電信', en: 'Chunghwa Telecom' },
  fet: { zh: '遠傳電信', en: 'Far EasTone' },
  twm: { zh: '台灣大哥大', en: 'Taiwan Mobile' },
  tstar: { zh: '台灣之星', en: 'T Star' },
};

const mbps = (v: number | null | undefined) => (v == null ? '—' : fixed(v, v < 10 ? 1 : 0));
const msText = (v: number | null | undefined) => (v == null ? '—' : fixed(v, 0));

const TEXT = defineMessages({
  zh: {
    chartTitle: '固網與行動網路的下載速度',
    chartAria: (country: string) => `${country}歷年固網與行動網路的下載速度中位數，與全世界對照`,
    fixed: '固網',
    mobile: '行動網路',
    worldFixed: '全世界固網',
    worldMobile: '全世界行動',
    chartNote: '每年第 3 季，Mbps；虛線是全世界所有測試的中位數。',
    tableTitle: (when: string) => `${when}的測速結果`,
    tableCaption: (country: string, when: string) => `${country}${when}的下載、上傳速度與延遲，跟全世界對照`,
    colItem: '項目',
    rowDown: '下載速度（中位數，Mbps）',
    rowDownMean: '下載速度（平均，Mbps）',
    rowUp: '上傳速度（中位數，Mbps）',
    rowLat: '延遲（中位數，毫秒）',
    rowTests: '測試次數',
    rowTiles: '有人測的圖塊（約 600 m）',
    world: '全世界',
    few: (min: string) => `沒有速度的季：測試不到 ${min} 次、測試集中在同一個地方，或 Ookla 已經不提供這裡的資料（原因見附註）。`,
    method:
      '中位數：每個圖塊的平均依測試次數加權，等於把每次測試都當成它所在圖塊的平均再取中位數。平均：所有測試的平均，會被少數很快的線路拉高。測試是使用者自己發起的，偏向城市與想確認網速的人。',
    officialTitle: '台灣的官方量測',
    officialCaption: '台灣官方定點量測的行動上網下載速度，與 Ookla 行動網路測試的中位數對照',
    colYear: '年',
    colOfficial: '官方定點量測',
    colOokla: 'Ookla 行動網路中位數',
    slash: '／',
    listSep: '、',
    ncc4g: (down: string, up: string) => `4G ${down}／${up}`,
    moda5g: (low: string, high: string) => `5G ${low}–${high}（各業者下載）`,
    officialUnits:
      '下載／上傳，Mbps。2020、2021 年是 NCC 的 4G 全國平均；2022、2023 年是數位發展部的 5G，四家業者差很多，各自的數字如下。',
    operatorsLine: (year: number, list: string) => `${year} 年 5G 各業者（22 縣市的平均，下載／上傳 Mbps）：${list}。`,
    officialNote:
      '官方量測是專業人員在村里辦公室、車站、郵局等固定地點，用指定的測試手機對每家業者各量一輪（NCC 委託電信技術中心；數位發展部 2022 年起只量 5G），每家業者等量；Ookla 是使用者自己的手機，4G、5G 混在一起，依測試的人數加權，所以數字不能直接相比。5G 各業者的「22 縣市的平均」是這裡把數位發展部開放資料（CC0）的各縣市數字簡單平均，沒有依量測點數加權。NCC 2020 年只公布下載。',
  },
  en: {
    chartTitle: 'Fixed and mobile download speeds',
    chartAria: (country) => `Median fixed and mobile download speeds in ${country} over time, compared with the world`,
    fixed: 'Fixed',
    mobile: 'Mobile',
    worldFixed: 'World, fixed',
    worldMobile: 'World, mobile',
    chartNote: 'Q3 of each year, Mbps; dashed lines are the median of all tests worldwide.',
    tableTitle: (when) => `Speed tests, ${when}`,
    tableCaption: (country, when) => `Download and upload speeds and latency in ${country}, ${when}, compared with the world`,
    colItem: 'Measure',
    rowDown: 'Download (median, Mbps)',
    rowDownMean: 'Download (mean, Mbps)',
    rowUp: 'Upload (median, Mbps)',
    rowLat: 'Latency (median, ms)',
    rowTests: 'Tests',
    rowTiles: 'Tiles tested (~600 m)',
    world: 'World',
    few: (min) => `Quarters without speeds have fewer than ${min} tests, tests concentrated in one place, or no longer appear in Ookla’s data (see the note).`,
    method:
      'Median: tile averages weighted by their number of tests, i.e. the median of all tests with each test counted at its tile’s average. Mean: the average of all tests, pulled up by a few very fast lines. Users start tests themselves, so results lean towards cities and people checking their connection.',
    officialTitle: 'Taiwan’s official measurements',
    officialCaption: 'Mobile download speeds from Taiwan’s official fixed-site measurements, compared with the median of Ookla mobile tests',
    colYear: 'Year',
    colOfficial: 'Official fixed-site',
    colOokla: 'Ookla mobile median',
    slash: ' / ',
    listSep: ', ',
    ncc4g: (down, up) => `4G ${down} / ${up}`,
    moda5g: (low, high) => `5G ${low}–${high} (download by operator)`,
    officialUnits:
      'Download / upload, Mbps. 2020 and 2021 are NCC’s 4G national means; 2022 and 2023 are the Ministry of Digital Affairs’ 5G results, which differ widely between the four operators (below).',
    operatorsLine: (year, list) => `5G by operator in ${year} (mean of 22 counties and cities, down / up Mbps): ${list}.`,
    officialNote:
      'Official measurements are taken by staff at fixed sites such as village offices, stations and post offices, with designated test phones and one round per operator (NCC through the Telecom Technology Center; from 2022 the Ministry of Digital Affairs, 5G only), so each operator counts equally. Ookla tests come from users’ own phones, mix 4G and 5G and are weighted by where people test, so the figures are not directly comparable. The 5G “mean of 22 counties and cities” is a simple average here of the county figures in the ministry’s open data (CC0), not weighted by the number of sites. NCC published only download speeds for 2020.',
  },
});

export default function InternetSpeedPanel({ topic, iso3, year, countryName, tokens, indicator }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const own = useJson<SpeedFile>(`topics/${topic.id}/countries/${iso3}.json`);
  const world = useJson<SpeedFile>(`topics/${topic.id}/world.json`).data;
  const data = own.data;

  const view = useMemo(() => {
    if (!data || !world) return null;
    const download = topic.indicators.find((i) => i.id === 'download')!;
    const option = timeSeriesOption({
      years: data.years,
      lines: [
        { name: text.fixed, values: data.fixed.d, color: tokens.hues.blue },
        { name: text.mobile, values: data.mobile.d, color: tokens.hues.orange },
        { name: text.worldFixed, values: world.fixed.d, color: tokens.hues.blue, dashed: true },
        { name: text.worldMobile, values: world.mobile.d, color: tokens.hues.orange, dashed: true },
      ],
      year,
      indicator: download,
      tokens,
    });
    // 時間軸的年份不在資料裡時取最接近的一季
    let index = data.years.indexOf(year);
    if (index < 0) index = year < data.years[0] ? 0 : data.years.length - 1;
    return { option, index };
  }, [data, world, topic, year, tokens, text]);

  if (own.loading) return <p className="empty">{t.loading}</p>;
  if (!data || !world || !view) return own.error ? <p className="note">{t.noData}</p> : null;

  const i = view.index;
  const when = indicator.timeAxis?.year(data.years[i]) ?? String(data.years[i]);
  const minTests = formatLargeNumber(data.minTests);
  const row = (label: string, pick: (s: KindSeries) => number | null | undefined, fmt: (v: number | null | undefined) => string) => (
    <>
      <tr>
        <th scope="row">{label}</th>
        {KINDS.map((k) => (
          <td key={k} className="num">
            {fmt(pick(data[k]))}
          </td>
        ))}
      </tr>
      <tr className="is-world">
        <th scope="row">{text.world}</th>
        {KINDS.map((k) => (
          <td key={k} className="num">
            {fmt(pick(world[k]))}
          </td>
        ))}
      </tr>
    </>
  );
  const few = KINDS.some((k) => data[k].tests[i] > 0 && data[k].d[i] == null);
  const ooklaYear = (y: number) => {
    const j = data.years.indexOf(y);
    return j < 0 ? '—' : `${mbps(data.mobile.d[j])}${text.slash}${mbps(data.mobile.u[j])}`;
  };
  const operators = (o: Official) =>
    (o.operators ?? [])
      .map(([id, d, u]) => `${OPERATORS[id]?.[lang] ?? id} ${mbps(d)}${text.slash}${mbps(u)}`)
      .join(text.listSep);

  return (
    <>
      <section className="panel-section">
        <h3>{text.chartTitle}</h3>
        <EChart option={view.option} height={210} ariaLabel={text.chartAria(countryName)} />
        <p className="note">{text.chartNote}</p>
      </section>
      <section className="panel-section">
        <h3>{text.tableTitle(when)}</h3>
        <table className="mini-table speed-table" aria-label={text.tableCaption(countryName, when)}>
          <thead>
            <tr>
              <th scope="col">{text.colItem}</th>
              <th scope="col" className="num">
                {text.fixed}
              </th>
              <th scope="col" className="num">
                {text.mobile}
              </th>
            </tr>
          </thead>
          <tbody>
            {row(text.rowDown, (s) => s.d[i], mbps)}
            {row(text.rowDownMean, (s) => s.dMean[i], mbps)}
            {row(text.rowUp, (s) => s.u[i], mbps)}
            {row(text.rowLat, (s) => s.lat[i], msText)}
            {row(text.rowTests, (s) => s.tests[i], (v) => (v ? formatLargeNumber(v) : '0'))}
            {row(text.rowTiles, (s) => s.tiles[i], (v) => (v ? formatLargeNumber(v) : '0'))}
          </tbody>
        </table>
        {few && <p className="note">{text.few(minTests)}</p>}
        <p className="note">{text.method}</p>
      </section>
      {data.official && (
        <section className="panel-section">
          <h3>{text.officialTitle}</h3>
          <table className="mini-table speed-table" aria-label={text.officialCaption}>
            <thead>
              <tr>
                <th scope="col">{text.colYear}</th>
                <th scope="col" className="num">
                  {text.colOfficial}
                </th>
                <th scope="col" className="num">
                  {text.colOokla}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.official.map((o) => (
                <tr key={o.year}>
                  <th scope="row">{o.year}</th>
                  <td className="num">
                    {o.operators
                      ? text.moda5g(mbps(Math.min(...o.operators.map((x) => x[1]))), mbps(Math.max(...o.operators.map((x) => x[1]))))
                      : text.ncc4g(mbps(o.down), mbps(o.up))}
                  </td>
                  <td className="num">{ooklaYear(o.year)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.officialUnits}</p>
          {data.official
            .filter((o) => o.operators)
            .map((o) => (
              <p key={o.year} className="note">
                {text.operatorsLine(o.year, operators(o))}
              </p>
            ))}
          <p className="note">{text.officialNote}</p>
        </section>
      )}
    </>
  );
}
