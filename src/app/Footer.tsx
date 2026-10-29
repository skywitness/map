import { ClampedText } from '../controls/ClampedText';
import { useT } from '../i18n';
import type { Topic } from '../topics/types';

/** 頁尾：主題的資料來源與授權、國界、資料更新日期、主題的說明、免責聲明（App.tsx，2026-10-29 拆出來） */
export function Footer({ topic, generatedAt }: { topic: Topic; generatedAt: string | null }) {
  const t = useT();
  return (
    <footer className="footer">
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
      {/* 主題的說明常常有好幾行：先露兩行，授權要求的聲明（夜間燈光的 EOG、學生能力的 OECD）寫在開頭 */}
      {topic.note && <ClampedText key={topic.note} text={topic.note} className="footer-note" />}
      <p className="footer-disclaimer">{t.disclaimer}</p>
    </footer>
  );
}
