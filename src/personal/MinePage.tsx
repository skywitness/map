import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { defineMessages, langParam, setLang, tr, useLang, type Text } from '../i18n';
import {
  deleteLocalSource,
  importLocalFiles,
  listLocalSources,
  registryOutOfSync,
  syncLocalRegistry,
  type LocalImportResult,
} from '../lib/localData';
import { entryId, LOCAL_PREFIX, type LocalSourceMeta } from '../lib/localRegistry';
import { siteRoot, topicPath } from '../lib/url-state';
import { useTheme } from '../theme/useTheme';
import { CATALOG } from '../topics/catalog.gen';

/**
 * 本機匯入頁 mine/（製作手冊第十三批 209，DESIGN.md 第 11 節「本機匯入」）：匯入轉好的通用格式（整個資料夾或檔案），
 * 列出已經匯入的來源，可以刪除單一來源或全部。資料只存在這個瀏覽器（IndexedDB），不上傳。
 * 匯入、刪除後回到地圖（重新載入）就會看到；網站一打開時依 localStorage 的清單接上（topics/localTopics.ts）。
 */

const TEXT = defineMessages({
  zh: {
    pageTitle: '本機匯入 · 世界資料地圖',
    back: '← 回到地圖',
    title: '本機匯入：只給自己看的資料',
    otherLang: 'English',
    themeLight: '淺色',
    themeDark: '深色',
    intro: [
      '因為授權不能放上網站的資料，可以自己到原網站下載，用本機的轉換程式轉成通用格式，在這裡匯入。匯入的指標、圖層和主題名稱後面標「（本機）」。',
      '資料只在這個瀏覽器裡讀、存在這個瀏覽器，不會上傳；換瀏覽器或清除網站資料要重新匯入。分享的網址不會帶匯入的指標，別人打開看到的是那個主題原本的指標。',
      '把匯入後的截圖或匯出的檔案公開分享，就是轉載原始資料：多數來源的條款不允許，請只給自己看。',
    ],
    formatNote: '格式：一個來源一個資料夾，裡面有 about.json 與它列出的 CSV、GeoJSON（DESIGN.md 第 11 節「本機匯入」）。選整個 import 資料夾時，裡面的 racing-routes.geojson 照舊匯入成賽車的我的路線。',
    importFolder: '匯入整個資料夾…',
    importFiles: '匯入檔案…',
    importing: '匯入中…',
    unavailable: '這個瀏覽器存不了資料（私密瀏覽或封鎖了網站資料），沒辦法匯入。',
    resultTitle: '這次匯入',
    ok: '完成',
    failed: '失敗',
    warnings: '略過（地圖上沒有的代碼）：',
    routes: (n: number, files: number) => `我的路線：${files} 個檔、${n} 條路線`,
    skipped: (names: string) => `不認得、略過的檔：${names}`,
    goMap: '回到地圖看看',
    listTitle: '已經匯入的來源',
    none: '還沒有匯入任何來源。',
    refreshed: '這個瀏覽器的清單已經補回。',
    topic: '放在：',
    newTopic: '新主題：',
    imported: (date: string) => `匯入 ${date}`,
    downloaded: (date: string) => `原檔下載 ${date}`,
    files: (n: number, mb: string) => `${n} 個檔，${mb} MB`,
    entries: '內容：',
    noTaiwan: '沒有台灣',
    terms: '條款：',
    page: '下載頁',
    remove: '刪除',
    removeAll: '刪除全部',
    confirmAll: '確定刪除全部匯入的資料？我的路線不受影響。',
    confirmOne: (name: string) => `確定刪除「${name}」？`,
    kinds: { table: '指標', flow: '流向', points: '點', shapes: '線面' } as Record<string, string>,
    colon: '：',
    listSep: '、',
    warnSep: '；',
    entry: (label: string, detail: string) => `${label}（${detail}）`,
    count: (n: number) => `${n.toLocaleString('zh-TW')} 筆`,
  },
  en: {
    pageTitle: 'Local import · World Data Map',
    back: '← Back to the map',
    title: 'Local import: data for your eyes only',
    otherLang: '中文', // i18n-ignore（語言切換鈕）
    themeLight: 'Light',
    themeDark: 'Dark',
    intro: [
      'Data that cannot be published on this site because of its licence can be downloaded from the original website, converted into the common format with the local converters, and imported here. Imported indicators, layers and topics are tagged “(local)”.',
      'The data is read and stored in this browser only and is never uploaded; another browser, or clearing site data, needs a fresh import. Shared links never carry imported indicators: others see the topic’s own indicator.',
      'Posting screenshots or exported files of imported data republishes the original data, which most sources do not allow. Keep it to yourself.',
    ],
    formatNote:
      'Format: one folder per source with an about.json and the CSV and GeoJSON files it lists (DESIGN.md section 11, “Local import”). When you pick the whole import folder, racing-routes.geojson in it is imported as My routes for racing, as before.',
    importFolder: 'Import a folder…',
    importFiles: 'Import files…',
    importing: 'Importing…',
    unavailable: 'This browser cannot store data (private browsing or blocked site data), so nothing can be imported.',
    resultTitle: 'This import',
    ok: 'Done',
    failed: 'Failed',
    warnings: 'Skipped (codes not on the map): ',
    routes: (n: number, files: number) => `My routes: ${files} files, ${n} routes`,
    skipped: (names: string) => `Skipped files: ${names}`,
    goMap: 'Back to the map to see it',
    listTitle: 'Imported sources',
    none: 'Nothing has been imported yet.',
    refreshed: 'The list in this browser has been restored.',
    topic: 'In: ',
    newTopic: 'New topic: ',
    imported: (date: string) => `imported ${date}`,
    downloaded: (date: string) => `downloaded ${date}`,
    files: (n: number, mb: string) => `${n} files, ${mb} MB`,
    entries: 'Contents: ',
    noTaiwan: 'no Taiwan',
    terms: 'Terms: ',
    page: 'Download page',
    remove: 'Delete',
    removeAll: 'Delete all',
    confirmAll: 'Delete all imported data? My routes are not affected.',
    confirmOne: (name: string) => `Delete “${name}”?`,
    kinds: { table: 'indicator', flow: 'flows', points: 'points', shapes: 'shapes' } as Record<string, string>,
    colon: ': ',
    listSep: ', ',
    warnSep: '; ',
    entry: (label: string, detail: string) => `${label} (${detail})`,
    count: (n: number) => `${n.toLocaleString('en-US')} rows`,
  },
});

function entryList(meta: LocalSourceMeta, text: (typeof TEXT)['zh'], lang: 'zh' | 'en'): string[] {
  const a = meta.about;
  const out: string[] = [];
  const add = (kind: string, spec: { file: string; id?: string; label: Text }) => {
    const d = meta.derived[entryId(spec)];
    const tw = d && 'taiwan' in d && !d.taiwan ? `, ${text.noTaiwan}` : '';
    const years = d && 'years' in d && d.years ? ` ${d.years[0] === d.years[1] ? d.years[0] : `${yearText(d.years[0], d)}–${yearText(d.years[1], d)}`}` : '';
    const n = !d ? null : 'rows' in d ? d.rows : d.count;
    out.push(text.entry(tr(spec.label, lang), `${text.kinds[kind]}${years}${n === null ? '' : `, ${text.count(n)}`}${tw}`));
  };
  for (const s of a.tables ?? []) add('table', s);
  for (const s of a.flows ?? []) add('flow', s);
  for (const s of a.points ?? []) add('points', s);
  for (const s of a.shapes ?? []) add('shapes', s);
  return out;
}

const yearText = (y: number, d: LocalSourceMeta['derived'][string]): string =>
  d.kind === 'table' && d.monthly ? `${Math.floor(y / 12)}/${(y % 12) + 1}` : String(y);

export default function MinePage() {
  const lang = useLang();
  const text = TEXT[lang];
  const { tokens, toggle } = useTheme();
  const [list, setList] = useState<LocalSourceMeta[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LocalImportResult | null>(null);
  const [restored, setRestored] = useState(false);
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = text.pageTitle;
  }, [text]);

  const reload = useCallback(async () => {
    try {
      const sources = await listLocalSources();
      // localStorage 被清掉、IndexedDB 還在時補回清單（網站一打開讀的是 localStorage）
      if (registryOutOfSync(sources)) {
        await syncLocalRegistry();
        if (sources.length) setRestored(true);
      }
      setList(sources);
    } catch {
      setUnavailable(true);
      setList([]);
    }
  }, []);

  useEffect(() => {
    if (typeof indexedDB === 'undefined') setUnavailable(true);
    else void reload();
  }, [reload]);

  // webkitdirectory 不是 React 認得的屬性
  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '');
  }, []);

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      setResult(await importLocalFiles(files));
    } catch (error) {
      setResult({ sources: [{ id: '', title: null, ok: false, error: String(error), warnings: [], counts: [] }], routes: null, skipped: [] });
    }
    setBusy(false);
    await reload();
  };

  const remove = async (meta: LocalSourceMeta | null) => {
    const name = meta ? tr(meta.about.title, lang) : '';
    if (!window.confirm(meta ? text.confirmOne(name) : text.confirmAll)) return;
    await deleteLocalSource(meta ? meta.id : null);
    await reload();
  };

  const home = `${siteRoot()}${langParam() ? `?lang=${langParam()}` : ''}`;
  const topicTitle = (id: string) => tr(CATALOG.topics[id]?.title ?? id, lang);
  const dateText = useMemo(() => new Intl.DateTimeFormat(lang === 'zh' ? 'zh-TW' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }), [lang]);
  const firstTopic = result?.sources.find((s) => s.ok)?.id;
  const firstMeta = list?.find((m) => m.id === firstTopic);
  const target = firstMeta?.about.topic
    ? topicPath(firstMeta.about.topic)
    : firstMeta?.about.newTopic
      ? `${siteRoot()}?topic=${LOCAL_PREFIX}${firstMeta.about.newTopic.id}`
      : home;

  return (
    <div className="about-page">
      <header className="about-top">
        <a href={home} className="about-back">
          {text.back}
        </a>
        <span className="about-tools">
          <button type="button" className="about-tool" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
            {text.otherLang}
          </button>
          <button type="button" className="about-tool" onClick={toggle}>
            {tokens.mode === 'dark' ? text.themeLight : text.themeDark}
          </button>
        </span>
      </header>
      <main className="about-main mine-main">
        <h1>{text.title}</h1>
        {text.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p className="about-note">{text.formatNote}</p>

        {unavailable ? (
          <p className="mine-error">{text.unavailable}</p>
        ) : (
          <div className="mine-actions">
            <button type="button" className="mine-button" disabled={busy} onClick={() => folderRef.current?.click()}>
              {text.importFolder}
            </button>
            <button type="button" className="mine-button is-secondary" disabled={busy} onClick={() => filesRef.current?.click()}>
              {text.importFiles}
            </button>
            {busy && <span className="about-note">{text.importing}</span>}
            <input ref={folderRef} type="file" multiple hidden onChange={onPick} />
            <input ref={filesRef} type="file" multiple hidden accept=".json,.csv,.geojson,.zip,.gpx,.kml,.kmz" onChange={onPick} />
          </div>
        )}

        {result && (
          <section className="mine-result" aria-live="polite">
            <h2>{text.resultTitle}</h2>
            <ul>
              {result.sources.map((s) => (
                <li key={s.id || 'error'}>
                  <strong>{s.title ? tr(s.title, lang) : s.id}</strong> <span className="mine-id">{s.id}</span> —{' '}
                  {s.ok ? text.ok : `${text.failed}${text.colon}${s.error}`}
                  {s.counts.length > 0 && <div className="about-note">{s.counts.join(' · ')}</div>}
                  {s.warnings.length > 0 && (
                    <div className="about-note">
                      {text.warnings}
                      {s.warnings.join(text.warnSep)}
                    </div>
                  )}
                </li>
              ))}
              {result.routes && <li>{text.routes(result.routes.routes, result.routes.files)}</li>}
              {result.skipped.length > 0 && <li className="about-note">{text.skipped(result.skipped.join(text.listSep))}</li>}
            </ul>
            {result.sources.some((s) => s.ok) && (
              <p>
                <a href={target}>{text.goMap}</a>
              </p>
            )}
          </section>
        )}

        <section>
          <h2>{text.listTitle}</h2>
          {restored && <p className="about-note">{text.refreshed}</p>}
          {list && !list.length && <p>{text.none}</p>}
          <ul className="mine-list">
            {list?.map((m) => {
              const a = m.about;
              const bytes = m.files.reduce((s, f) => s + f.bytes, 0);
              const topic = a.topic ?? `${LOCAL_PREFIX}${a.newTopic?.id ?? ''}`;
              return (
                <li key={m.id} className="mine-item">
                  <div className="mine-item-head">
                    <strong>{tr(a.title, lang)}</strong>
                    <button type="button" className="about-tool" onClick={() => void remove(m)}>
                      {text.remove}
                    </button>
                  </div>
                  <div className="about-note">
                    <span className="mine-id">{m.id}</span> · {text.imported(dateText.format(m.importedAt))}
                    {a.source.downloaded && ` · ${text.downloaded(a.source.downloaded)}`} · {text.files(m.files.length, (bytes / 1e6).toFixed(1))}
                  </div>
                  <div>
                    {a.topic ? text.topic : text.newTopic}
                    <a href={a.topic ? topicPath(a.topic) : `${siteRoot()}?topic=${topic}`}>{a.topic ? topicTitle(topic) : tr(a.newTopic!.title, lang)}</a>
                  </div>
                  <div className="about-note">
                    {text.entries}
                    {entryList(m, text, lang).join(text.listSep)}
                  </div>
                  <div className="about-note">
                    {a.source.name}
                    {a.source.page && (
                      <>
                        {' · '}
                        <a href={a.source.page} target="_blank" rel="noreferrer">
                          {text.page}
                        </a>
                      </>
                    )}
                  </div>
                  {a.source.terms && (
                    <div className="about-note">
                      {text.terms}
                      {tr(a.source.terms, lang)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {list && list.length > 1 && (
            <button type="button" className="about-tool" onClick={() => void remove(null)}>
              {text.removeAll}
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
