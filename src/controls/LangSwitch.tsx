import { setLang, useLang, useT, type Lang } from '../i18n';

// 語言名稱用各自的語言寫，lang 屬性讓螢幕閱讀器用對的發音
const OPTIONS: { lang: Lang; label: string; htmlLang: string }[] = [
  { lang: 'zh', label: '中文', htmlLang: 'zh-Hant' }, // i18n-ignore
  { lang: 'en', label: 'EN', htmlLang: 'en' },
];

/** 中文 / EN 切換，不必重新整理 */
export function LangSwitch() {
  const lang = useLang();
  const t = useT();
  return (
    <div className="lang-switch" role="radiogroup" aria-label={t.language}>
      {OPTIONS.map((o) => (
        <button
          key={o.lang}
          type="button"
          role="radio"
          lang={o.htmlLang}
          aria-checked={o.lang === lang}
          className={`segment${o.lang === lang ? ' is-active' : ''}`}
          onClick={() => setLang(o.lang)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
