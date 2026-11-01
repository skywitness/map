import { ClampedText } from '../controls/ClampedText';
import { langParam, useT } from '../i18n';
import { aboutPath } from '../lib/url-state';
import type { Topic } from '../topics/types';

/**
 * 頁尾：主題的資料來源與授權、國界、資料更新日期、主題的說明、免責聲明（App.tsx，2026-10-29 拆出來）。
 * sources（資料來源與說明）、disclaimer（國界聲明與「關於這個網站」）可以分別關掉（版面的偏好，2026-11-01）
 */
export function Footer({
  topic,
  generatedAt,
  sources = true,
  disclaimer = true,
}: {
  topic: Topic;
  generatedAt: string | null;
  sources?: boolean;
  disclaimer?: boolean;
}) {
  const t = useT();
  return (
    <footer className="footer">
      {sources && (
      <p className="footer-sources">
        {t.sources}
        {topic.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && t.listSeparator}
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.name}
            </a>
            {t.sourceLicense(s.license)}
          </span>
        ))}
        {t.borders}
        <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">
          Natural Earth
        </a>
        {t.publicDomain}
        {generatedAt && t.generatedAt(generatedAt.slice(0, 10))}
      </p>
      )}
      {/* 主題的說明常常有好幾行：先露兩行，授權要求的聲明（夜間燈光的 EOG、學生能力的 OECD）寫在開頭 */}
      {sources && topic.note && <ClampedText key={topic.note} text={topic.note} className="footer-note" />}
      {disclaimer && (
        <p className="footer-disclaimer">
          {t.disclaimer} <a href={aboutPath(langParam())}>{t.aboutSite}</a>
        </p>
      )}
    </footer>
  );
}
