import { fixed } from '../lib/format';
import type { TopicPart } from './parts';
import type { DimensionDef } from './types';

/**
 * 能源用在哪裡的擴充：能源業自己吃掉多少（自用與損失）、電力用在哪個部門（2026-11-08，製作手冊第二十七批 626，
 * 候選 1365、1366；pipeline/topics/energy_losses.py，資料在 public/data/topics/energy-use/）。來源同原主題（UNSD、能源署）。
 */
const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${fixed(v, 0)}%`;
const LOSSES: DimensionDef = {
  label: { zh: '項目', en: 'Item' },
  options: [
    { id: 'total', label: { zh: '合計（自用＋損失）', en: 'Total (own use + losses)' } },
    { id: 'own-use', label: { zh: '能源業自用', en: 'Energy industry own use' } },
    { id: 'losses', label: { zh: '輸送與配送的損失', en: 'Transmission and distribution losses' } },
  ],
  defaultOption: 'total',
};
const ELEC: DimensionDef = {
  label: { zh: '部門', en: 'Sector' },
  options: [
    { id: 'industry', label: { zh: '工業', en: 'Industry' } },
    { id: 'households', label: { zh: '家戶', en: 'Households' } },
    { id: 'commerce', label: { zh: '商業與公共服務', en: 'Commerce and public services' } },
    { id: 'transport', label: { zh: '運輸（含鐵路、管線）', en: 'Transport (incl. rail and pipelines)' } },
    { id: 'agriculture', label: { zh: '農林漁業', en: 'Agriculture, forestry and fishing' } },
    { id: 'other', label: { zh: '其他未分類', en: 'Not elsewhere specified' } },
  ],
  defaultOption: 'industry',
};

export const energyLossesPart: TopicPart = {
  name: { zh: '能源業自用與損失、電力的部門用途', en: 'Energy own use and losses; electricity by sector' },
  sources: [],
  note: {
    zh: '自用與損失是能源還沒送到使用者手上就用掉的部分：能源業自用是油氣田、煉油廠、煤礦、液化廠與電廠自己用掉的，損失是輸電、輸氣、運送的損失；分母是一次能源總供給，總供給至少 10 PJ 的國家才畫。產油產氣國的自用高是因為油氣處理與液化很耗能。台灣用能源署的「能源部門自用」，沒有損失。電力的部門用途分母是電力的最終消費，含「其他未分類」（中國、印度的商業與公共服務記在這裡）。',
    en: 'Own use and losses are energy consumed before reaching end users: the energy industry’s own use at oil and gas fields, refineries, coal mines, liquefaction plants and power stations, and losses in transmission, pipelines and transport. They are shares of total primary energy supply, for countries supplying at least 10 PJ. Oil and gas producers have high own use because processing and liquefaction are energy-intensive. Taiwan uses the Energy Administration’s energy sector own use, with no losses figure. Electricity by sector is a share of final electricity consumption, including “not elsewhere specified” (where China and India record commerce and public services).',
  },
  indicators: [
    {
      id: 'own-use-losses',
      label: { zh: '能源業自用與損失占總供給', en: 'Energy own use and losses as a share of supply' },
      description: {
        zh: '一次能源總供給有多少被能源業自己用掉或在輸送中損失（子項目分開看）。2023 年汶萊 30.5%（自用 27.4、損失 3.0）最高，委內瑞拉 29.4%（22.0／7.3）、卡達 28.2%、挪威 23.8%、科威特 20.9%、加拿大 20.3%（18.8／1.5）、伊拉克 18.3%（自用 7.5、損失 10.8）；澳洲 13.8%、巴西 11.2%、俄羅斯 10.9%（6.7／4.3），美國 7.1%、德國 5.7%、中國 5.5%、日本 4.9%。台灣的能源部門自用 2023 年 5.2%。',
        en: 'Share of total primary energy supply used by the energy industry itself or lost in delivery (sub-items separate the two). In 2023 Brunei was highest at 30.5% (own use 27.4, losses 3.0), then Venezuela 29.4% (22.0/7.3), Qatar 28.2%, Norway 23.8%, Kuwait 20.9%, Canada 20.3% (18.8/1.5) and Iraq 18.3% (own use 7.5, losses 10.8); Australia 13.8%, Brazil 11.2%, Russia 10.9% (6.7/4.3), the US 7.1%, Germany 5.7%, China 5.5% and Japan 4.9%. Taiwan’s energy sector own use was 5.2% in 2023.',
      },
      unit: '%',
      file: 'own-use-losses/{item}.json',
      dimension: LOSSES,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 5, 8, 12, 20] } },
      format: pct,
      formatTick: pctTick,
      defaultYear: 2023,
      lowerIsBetter: true,
      missing: { zh: '不在 UNSD 裡或總供給太小', en: 'Not in UNSD data or supply too small' },
    },
    {
      id: 'electricity-use',
      label: { zh: '電力用在哪個部門', en: 'Electricity use by sector' },
      description: {
        zh: '電力的最終消費裡各部門占多少（子項目是部門）。2023 年中國的電 63% 給工業、家戶 16%、其他未分類 16%（含商業）；韓國工業 51%、商業 31%；俄羅斯工業 45%、運輸 10%；德國工業 42%、家戶 28%、商業 25%；日本工業 35%、商業 34%、家戶 29%；美國家戶 38%、商業 34%、工業只有 22%；沙烏地家戶 47%；巴西農林漁 6%。台灣不在 UNSD 裡。',
        en: 'Share of final electricity consumption by sector (sub-items are sectors). In 2023 China used 63% of its electricity in industry, 16% in households and 16% not elsewhere specified (including commerce); South Korea 51% industry and 31% commerce; Russia 45% industry and 10% transport; Germany 42% industry, 28% households and 25% commerce; Japan 35% industry, 34% commerce and 29% households; the US 38% households, 34% commerce and only 22% industry; Saudi Arabia 47% households; Brazil 6% agriculture. Taiwan is not in the UNSD data.',
      },
      unit: '%',
      file: 'electricity-use/{item}.json',
      dimension: ELEC,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 15, 30, 45, 60] } },
      format: pct,
      formatTick: pctTick,
      defaultYear: 2023,
      missing: { zh: '不在 UNSD 裡或用電太少', en: 'Not in UNSD data or little electricity use' },
    },
  ],
};
