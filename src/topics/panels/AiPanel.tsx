import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { defineMessages, tr, useLang, useT, type Lang, type Text } from '../../i18n';
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

const USE_CASES: Record<string, Text> = {
  use_case_work: { zh: '工作', en: 'Work' },
  use_case_personal: { zh: '個人生活', en: 'Personal' },
  use_case_coursework: { zh: '課業', en: 'Coursework' },
};

const ARTIFACTS: Record<string, Text> = {
  artifact_explanation_or_answer: { zh: '解釋與問答', en: 'Explanations and answers' },
  artifact_advice_or_recommendation: { zh: '建議', en: 'Advice' },
  artifact_analysis_or_summary: { zh: '分析與摘要', en: 'Analysis and summaries' },
  artifact_code_fix_or_debug: { zh: '修正程式錯誤', en: 'Code fixes and debugging' },
  artifact_script_or_snippet: { zh: '程式片段', en: 'Scripts and code snippets' },
  artifact_app_or_website: { zh: '應用程式與網站', en: 'Apps and websites' },
  artifact_document_or_report: { zh: '文件與報告', en: 'Documents and reports' },
  artifact_email_or_message: { zh: '電子郵件與訊息', en: 'Emails and messages' },
  artifact_creative_writing: { zh: '創意寫作', en: 'Creative writing' },
  artifact_translation: { zh: '翻譯', en: 'Translation' },
  artifact_educational_material: { zh: '教材', en: 'Educational material' },
  artifact_academic_paper_or_thesis: { zh: '學術論文', en: 'Academic papers' },
  artifact_plan_or_strategy: { zh: '計畫與策略', en: 'Plans and strategies' },
  artifact_idea_or_brainstorm: { zh: '點子與腦力激盪', en: 'Ideas and brainstorming' },
  artifact_data_or_spreadsheet: { zh: '資料與試算表', en: 'Data and spreadsheets' },
  artifact_math_or_calculation: { zh: '數學與計算', en: 'Maths and calculations' },
  artifact_chart_or_visualization: { zh: '圖表', en: 'Charts' },
  artifact_image_or_graphic: { zh: '圖像', en: 'Images' },
  artifact_presentation_or_slides: { zh: '簡報', en: 'Presentations' },
  artifact_marketing_or_social_content: { zh: '行銷與社群內容', en: 'Marketing and social media' },
  artifact_blog_or_article: { zh: '部落格與文章', en: 'Blog posts and articles' },
  artifact_resume_or_job_application: { zh: '履歷與求職', en: 'CVs and job applications' },
  artifact_config_or_infra: { zh: '系統設定', en: 'Configuration and infrastructure' },
  artifact_sql_or_database_query: { zh: '資料庫查詢', en: 'Database queries' },
  artifact_ml_or_ai_system: { zh: '機器學習系統', en: 'Machine learning systems' },
  artifact_ui_or_design_mockup: { zh: '介面設計', en: 'UI design' },
  artifact_game_or_interactive: { zh: '遊戲與互動內容', en: 'Games and interactive content' },
  artifact_recipe_or_meal_plan: { zh: '食譜', en: 'Recipes' },
  artifact_video_or_animation: { zh: '影片與動畫', en: 'Video and animation' },
  artifact_audio_or_music: { zh: '音訊與音樂', en: 'Audio and music' },
  artifact_other: { zh: '其他產出', en: 'Other outputs' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TEXT = defineMessages({
  zh: {
    noCountry: 'Epoch AI 與 Anthropic 的資料都沒有收錄這個國家。',
    datacenters: '數據中心',
    datacentersCount: (count: number, snapshot: string) => `OpenStreetMap 上標示了 ${count} 處（${snapshot}）`,
    operators: '標示的營運者',
    operatorsAria: (country: string) => `${country}數據中心營運者`,
    sites: (n: number) => `${n} 處`,
    unnamed: (n: number) => `另有 ${n} 處沒有標示營運者。`,
    tokens: '每月 token 用量（OpenRouter）',
    tokensLatest: (month: string, tokens: string, share: string) => `${month}：${tokens} tokens，占全球 ${share}%`,
    tokensAria: (country: string) => `${country}每月 OpenRouter token 用量`,
    tokensNote: '只代表透過 OpenRouter 平台呼叫 AI 模型的用量，依請求發出的地點計算。',
    clusters: '已知 AI 運算叢集',
    clustersNote: '目前運作中，依算力排序（Epoch AI 收錄）',
    cluster: (name: string, owner: string, year: number) => `${name}（${owner}，${year}）`,
    gpus: (n: string) => `${n} 張`,
    clustersAria: (country: string) => `${country}的 AI 運算叢集`,
    clustersUnit: '數值為相當於幾張 NVIDIA H100 GPU 的算力。',
    models: '重要 AI 模型',
    modelsCount: (n: number) => `共 ${n} 個，以下為最近發表的`,
    organizations: (list: string[]) => list.join('、'),
    claude: 'Claude 用在哪裡',
    claudePeriod: (month: string) => `${month}對話抽樣（Anthropic Economic Index）`,
    useCases: '用途',
    useCasesAria: (country: string) => `${country}的 Claude 用途`,
    artifacts: '最常見的產出',
    artifactsAria: (country: string) => `${country}的 Claude 產出類型`,
    /** '2026-07' → '2026 年 7 月' */
    month: (year: string, month: number) => `${year} 年 ${month} 月`,
    monthTick: (month: number) => `${month} 月`,
  },
  en: {
    noCountry: 'Neither Epoch AI nor Anthropic covers this country.',
    datacenters: 'Data centres',
    datacentersCount: (count, snapshot) => `${count} ${count === 1 ? 'site' : 'sites'} mapped on OpenStreetMap (${snapshot})`,
    operators: 'Operators mapped',
    operatorsAria: (country) => `Data centre operators in ${country}`,
    sites: (n) => `${n} ${n === 1 ? 'site' : 'sites'}`,
    unnamed: (n) => `Another ${n} ${n === 1 ? 'site has' : 'sites have'} no operator mapped.`,
    tokens: 'Monthly token usage (OpenRouter)',
    tokensLatest: (month, tokens, share) => `${month}: ${tokens} tokens, ${share}% of the world`,
    tokensAria: (country) => `Monthly OpenRouter token usage in ${country}`,
    tokensNote: 'Covers only AI model calls made through the OpenRouter platform, counted by where requests come from.',
    clusters: 'Known AI compute clusters',
    clustersNote: 'Currently operating, sorted by compute (tracked by Epoch AI)',
    cluster: (name, owner, year) => `${name} (${owner}, ${year})`,
    gpus: (n) => `${n} GPUs`,
    clustersAria: (country) => `AI compute clusters in ${country}`,
    clustersUnit: 'Values are compute expressed as an equivalent number of NVIDIA H100 GPUs.',
    models: 'Notable AI models',
    modelsCount: (n) => `${n} in total; the most recent are listed below`,
    organizations: (list) => list.join(', '),
    claude: 'What Claude is used for',
    claudePeriod: (month) => `Conversation sample from ${month} (Anthropic Economic Index)`,
    useCases: 'Use cases',
    useCasesAria: (country) => `Claude use cases in ${country}`,
    artifacts: 'Most common outputs',
    artifactsAria: (country) => `Types of Claude output in ${country}`,
    month: (year, month) => `${MONTHS[month - 1]} ${year}`,
    monthTick: (month) => MONTHS[month - 1],
  },
});

const pct = (v: number) => `${fixed(v, 1)}%`;

export default function AiPanel({ topic, iso3, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<AiFile>(`topics/${topic.id}/countries/${iso3}.json`);
  const tokenOption = useMemo(
    () => (data?.openrouter ? monthlyTokensOption(data.openrouter, countryName, tokens, lang) : null),
    [data, countryName, tokens, lang],
  );
  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;

  const claude = data.claude;
  const number = (key: string) => (typeof claude?.[key] === 'number' ? (claude[key] as number) : 0);
  const artifacts = Object.keys(ARTIFACTS)
    .map((key) => ({ key, label: tr(ARTIFACTS[key], lang), value: number(key) }))
    .filter((a) => a.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <section className="panel-section">
      {data.datacenters && (
        <>
          <h3>{text.datacenters}</h3>
          <p className="panel-year-note">{text.datacentersCount(data.datacenters.count, data.datacenters.snapshot)}</p>
          {data.datacenters.operators.length > 0 && (
            <>
              <h4>{text.operators}</h4>
              {/* 營運者是 OpenStreetMap 上標示的原名（專有名詞），不翻譯 */}
              <BarList
                items={data.datacenters.operators.map(([name, n]) => ({ key: name, label: name, value: n }))}
                format={(v) => text.sites(Math.round(v))}
                ariaLabel={text.operatorsAria(countryName)}
                properNouns
              />
            </>
          )}
          {data.datacenters.unnamed > 0 && <p className="note">{text.unnamed(data.datacenters.unnamed)}</p>}
        </>
      )}

      {data.openrouter && tokenOption && (
        <>
          <h3>{text.tokens}</h3>
          <p className="panel-year-note">
            {text.tokensLatest(
              formatMonth(data.openrouter.months[data.openrouter.months.length - 1], lang),
              formatLargeNumber(data.openrouter.tokens[data.openrouter.tokens.length - 1]),
              fixed(
                (data.openrouter.tokens[data.openrouter.tokens.length - 1] /
                  data.openrouter.world[data.openrouter.world.length - 1]) *
                  100,
                2,
              ),
            )}
          </p>
          <Chart spec={tokenOption} height={180} ariaLabel={text.tokensAria(countryName)} />
          <p className="note">{text.tokensNote}</p>
        </>
      )}

      {data.clusters && (
        <>
          <h3>{text.clusters}</h3>
          <p className="panel-year-note">{text.clustersNote}</p>
          <BarList
            items={data.clusters.map((c) => ({
              key: c.name,
              label: text.cluster(c.name, c.owner, c.year),
              value: c.h100e,
            }))}
            format={(v) => text.gpus(formatLargeNumber(v))}
            ariaLabel={text.clustersAria(countryName)}
          />
          <p className="note">{text.clustersUnit}</p>
        </>
      )}

      {data.models && (
        <>
          <h3>{text.models}</h3>
          <p className="panel-year-note">{text.modelsCount(data.modelCount ?? data.models.length)}</p>
          <ul className="plain-list">
            {data.models.map((m) => (
              <li key={`${m.name}-${m.date}`}>
                <span className="plain-title">{m.name}</span>
                <span className="plain-meta">
                  {text.organizations(m.organization.split(',').map((o) => o.trim()))} · {formatMonth(m.date, lang)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {claude && (
        <>
          <h3>{text.claude}</h3>
          <p className="panel-year-note">{text.claudePeriod(formatMonth(claude.period, lang))}</p>
          <h4>{text.useCases}</h4>
          <BarList
            items={Object.entries(USE_CASES).map(([key, label]) => ({ key, label: tr(label, lang), value: number(key) }))}
            format={pct}
            max={100}
            ariaLabel={text.useCasesAria(countryName)}
          />
          {artifacts.length > 0 && (
            <>
              <h4>{text.artifacts}</h4>
              <BarList items={artifacts} format={pct} ariaLabel={text.artifactsAria(countryName)} />
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
  lang: Lang,
): ChartSpec {
  const months = series.months;
  return {
    x: {
      type: 'category',
      // 只標每年 1 月與 7 月
      labels: months.map((v) => (v.endsWith('-01') ? v.slice(0, 4) : TEXT[lang].monthTick(Number(v.slice(5))))),
      showLabel: (i) => months[i].endsWith('-01') || months[i].endsWith('-07'),
    },
    y: { format: formatLargeTick },
    series: [{ type: 'line', name: countryName, values: series.tokens, color: tokens.accent }],
    tooltip: (i) =>
      series.tokens[i] == null
        ? null
        : {
            head: formatMonth(months[i], lang),
            rows: [{ color: tokens.accent, value: `${formatLargeNumber(Number(series.tokens[i]))} tokens`, name: countryName }],
          },
  };
}

/** '2026-07'（或完整日期）→ 中文「2026 年 7 月」、英文「Jul 2026」 */
function formatMonth(month: string, lang: Lang): string {
  return TEXT[lang].month(month.slice(0, 4), Number(month.slice(5, 7)));
}
