import { defineMessages, tr, useLang } from '../i18n';
import { CATALOG } from '../topics/catalog.gen';
import { TopicLink } from '../topics/panels/TopicLink';
import { relatedTopics } from '../topics/related';

const TEXT = defineMessages({
  zh: { title: '相關主題' },
  en: { title: 'Related topics' },
});

/** 國家側欄最下面的相關主題（topics/related.ts，2026-10-30）：點了換到那個主題，選取的國家留著 */
export function RelatedTopics({ topic, iso3 }: { topic: string; iso3: string }) {
  const lang = useLang();
  const ids = relatedTopics(topic).filter((id) => CATALOG.topics[id]);
  if (!ids.length) return null;
  return (
    <section className="related-topics" aria-label={TEXT[lang].title}>
      <h3>{TEXT[lang].title}</h3>
      <ul className="profile-more">
        {ids.map((id) => (
          <li key={id}>
            <TopicLink topic={id} iso3={iso3}>
              {tr(CATALOG.topics[id].title, lang)}
            </TopicLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
