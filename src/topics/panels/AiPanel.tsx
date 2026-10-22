import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { EChart, escapeHtml, type ChartOption } from '../../charts/EChart';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber, formatLargeTick } from '../../lib/format';
import type { Tokens } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

interface AiFile {
  datacenters?: { count: number; snapshot: string; operators: [string, number][]; unnamed: number };
  clusters?: { name: string; owner: string; h100e: number; year: number; sector: string }[];
  /** OECD.AI 的 OpenRouter 資料：逐月 token 量 */
  openrouter?: { months: string[]; tokens: number[]; world: number[] };
  models?: { name: string; organization: string; date: string }[];
  modelCount?: number;
  /** Anthropic Economic Index：用途與產出類型的比例（%） */
  claude?: { period: string } & Record<string, number | string>;
}

const USE_CASES: Record<string, string> = {
  use_case_work: '工作',
  use_case_personal: '個人生活',
  use_case_coursework: '課業',
};

const ARTIFACTS: Record<string, string> = {
  artifact_explanation_or_answer: '解釋與問答',
  artifact_advice_or_recommendation: '建議',
  artifact_analysis_or_summary: '分析與摘要',
  artifact_code_fix_or_debug: '修正程式錯誤',
  artifact_script_or_snippet: '程式片段',
  artifact_app_or_website: '應用程式與網站',
  artifact_document_or_report: '文件與報告',
  artifact_email_or_message: '電子郵件與訊息',
  artifact_creative_writing: '創意寫作',
  artifact_translation: '翻譯',
  artifact_educational_material: '教材',
  artifact_academic_paper_or_thesis: '學術論文',
  artifact_plan_or_strategy: '計畫與策略',
  artifact_idea_or_brainstorm: '點子與腦力激盪',
  artifact_data_or_spreadsheet: '資料與試算表',
  artifact_math_or_calculation: '數學與計算',
  artifact_chart_or_visualization: '圖表',
  artifact_image_or_graphic: '圖像',
  artifact_presentation_or_slides: '簡報',
  artifact_marketing_or_social_content: '行銷與社群內容',
  artifact_blog_or_article: '部落格與文章',
  artifact_resume_or_job_application: '履歷與求職',
  artifact_config_or_infra: '系統設定',
  artifact_sql_or_database_query: '資料庫查詢',
  artifact_ml_or_ai_system: '機器學習系統',
  artifact_ui_or_design_mockup: '介面設計',
  artifact_game_or_interactive: '遊戲與互動內容',
  artifact_recipe_or_meal_plan: '食譜',
  artifact_video_or_animation: '影片與動畫',
  artifact_audio_or_music: '音訊與音樂',
  artifact_other: '其他產出',
};

const pct = (v: number) => `${fixed(v, 1)}%`;

export default function AiPanel({ topic, iso3, countryName, tokens }: PanelExtraProps) {
  const { data, error } = useJson<AiFile>(`topics/${topic.id}/countries/${iso3}.json`);
  const tokenOption = useMemo(
    () => (data?.openrouter ? monthlyTokensOption(data.openrouter, countryName, tokens) : null),
    [data, countryName, tokens],
  );
  if (error) return <p className="empty">Epoch AI 與 Anthropic 的資料都沒有收錄這個國家。</p>;
  if (!data) return <p className="empty">載入中…</p>;

  const claude = data.claude;
  const number = (key: string) => (typeof claude?.[key] === 'number' ? (claude[key] as number) : 0);
  const artifacts = Object.keys(ARTIFACTS)
    .map((key) => ({ key, label: ARTIFACTS[key], value: number(key) }))
    .filter((a) => a.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <section className="panel-section">
      {data.datacenters && (
        <>
          <h3>數據中心</h3>
          <p className="panel-year-note">
            OpenStreetMap 上標示了 {data.datacenters.count} 處（{data.datacenters.snapshot}）
          </p>
          {data.datacenters.operators.length > 0 && (
            <>
              <h4>標示的營運者</h4>
              <BarList
                items={data.datacenters.operators.map(([name, n]) => ({ key: name, label: name, value: n }))}
                format={(v) => `${fixed(v, 0)} 處`}
                ariaLabel={`${countryName}數據中心營運者`}
              />
            </>
          )}
          {data.datacenters.unnamed > 0 && (
            <p className="note">另有 {data.datacenters.unnamed} 處沒有標示營運者。</p>
          )}
        </>
      )}

      {data.openrouter && tokenOption && (
        <>
          <h3>每月 token 用量（OpenRouter）</h3>
          <p className="panel-year-note">
            {formatMonth(data.openrouter.months[data.openrouter.months.length - 1])}：
            {formatLargeNumber(data.openrouter.tokens[data.openrouter.tokens.length - 1])} tokens，占全球{' '}
            {fixed(
              (data.openrouter.tokens[data.openrouter.tokens.length - 1] /
                data.openrouter.world[data.openrouter.world.length - 1]) *
                100,
              2,
            )}
            %
          </p>
          <EChart option={tokenOption} height={180} ariaLabel={`${countryName}每月 OpenRouter token 用量`} />
          <p className="note">只代表透過 OpenRouter 平台呼叫 AI 模型的用量，依請求發出的地點計算。</p>
        </>
      )}

      {data.clusters && (
        <>
          <h3>已知 AI 運算叢集</h3>
          <p className="panel-year-note">目前運作中，依算力排序（Epoch AI 收錄）</p>
          <BarList
            items={data.clusters.map((c) => ({
              key: c.name,
              label: `${c.name}（${c.owner}，${c.year}）`,
              value: c.h100e,
            }))}
            format={(v) => `${formatLargeNumber(v)} 張`}
            ariaLabel={`${countryName}的 AI 運算叢集`}
          />
          <p className="note">數值為相當於幾張 NVIDIA H100 GPU 的算力。</p>
        </>
      )}

      {data.models && (
        <>
          <h3>重要 AI 模型</h3>
          <p className="panel-year-note">共 {data.modelCount} 個，以下為最近發表的</p>
          <ul className="plain-list">
            {data.models.map((m) => (
              <li key={`${m.name}-${m.date}`}>
                <span className="plain-title">{m.name}</span>
                <span className="plain-meta">
                  {m.organization.split(',').join('、')} · {m.date.slice(0, 4)} 年 {Number(m.date.slice(5, 7))} 月
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {claude && (
        <>
          <h3>Claude 用在哪裡</h3>
          <p className="panel-year-note">
            {claude.period.slice(0, 4)} 年 {Number(claude.period.slice(5, 7))} 月對話抽樣（Anthropic Economic Index）
          </p>
          <h4>用途</h4>
          <BarList
            items={Object.entries(USE_CASES).map(([key, label]) => ({ key, label, value: number(key) }))}
            format={pct}
            max={100}
            ariaLabel={`${countryName}的 Claude 用途`}
          />
          {artifacts.length > 0 && (
            <>
              <h4>最常見的產出</h4>
              <BarList items={artifacts} format={pct} ariaLabel={`${countryName}的 Claude 產出類型`} />
            </>
          )}
        </>
      )}
    </section>
  );
}

function monthlyTokensOption(
  series: NonNullable<AiFile['openrouter']>,
  countryName: string,
  tokens: Tokens,
): ChartOption {
  return {
    animation: false,
    grid: { left: 4, right: 12, top: 8, bottom: 4, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: tokens.axis, width: 1 } },
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      textStyle: { color: tokens.ink, fontSize: 12 },
      formatter: (params) => {
        const p = (Array.isArray(params) ? params : [params])[0];
        const month = String((p as { axisValue?: string }).axisValue ?? '');
        return (
          `<div class="tt-head">${escapeHtml(formatMonth(month))}</div>` +
          `<div class="tt-row"><strong>${escapeHtml(formatLargeNumber(Number(p.value)))} tokens</strong>` +
          `<span class="tt-name">${escapeHtml(countryName)}</span></div>`
        );
      },
    },
    xAxis: {
      type: 'category',
      data: series.months,
      boundaryGap: false,
      axisLine: { lineStyle: { color: tokens.axis } },
      axisTick: { show: false },
      axisLabel: {
        color: tokens.inkMuted,
        fontSize: 11,
        // 只標每年 1 月與 7 月
        interval: (_i: number, v: string) => v.endsWith('-01') || v.endsWith('-07'),
        formatter: (v: string) => (v.endsWith('-01') ? v.slice(0, 4) : `${Number(v.slice(5))} 月`),
      },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: tokens.grid, width: 1 } },
      axisLabel: { color: tokens.inkMuted, fontSize: 11, formatter: (v: number) => formatLargeTick(v) },
    },
    series: [
      {
        type: 'line',
        name: countryName,
        data: series.tokens,
        showSymbol: false,
        color: tokens.accent,
        lineStyle: { width: 2, color: tokens.accent },
        emphasis: { disabled: true },
      },
    ],
  };
}

/** '2026-07' → '2026 年 7 月' */
function formatMonth(month: string): string {
  return `${month.slice(0, 4)} 年 ${Number(month.slice(5, 7))} 月`;
}
