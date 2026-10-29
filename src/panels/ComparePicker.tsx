import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLang, useT } from '../i18n';
import { countryName, type CountryTable } from '../lib/countries';
import { buildSearchIndex, searchCountries } from '../lib/countrySearch';
import { COMPARE_MAX } from '../lib/url-state';
import { CloseIcon } from '../map/MapIcons';

interface ComparePickerProps {
  /** 側欄的國家（不能再加進比較） */
  iso3: string;
  compare: string[];
  /** 比較的國家在折線圖與數值卡片上的顏色，依加入的順序 */
  colors: string[];
  /** 可以加的國家：目前指標有資料的 */
  candidates: string[];
  countries: CountryTable | null;
  onChange: (compare: string[]) => void;
}

/**
 * 側欄的「比較」：再加最多 3 個國家，折線圖多畫它們的線、數值卡片多列它們的值。
 * 加國家的輸入框是 WAI-ARIA combobox（跟頂列的搜尋一樣：↑↓ 選、Enter 確定、Esc 關閉，選字中的 Enter 不搶）。
 */
export function ComparePicker({ iso3, compare, colors, candidates, countries, onChange }: ComparePickerProps) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const index = useMemo(
    () => buildSearchIndex(candidates.filter((c) => c !== iso3 && !compare.includes(c)), countries),
    [candidates, iso3, compare, countries],
  );
  const hits = useMemo(() => searchCountries(index, query, lang, 6), [index, query, lang]);
  const expanded = adding && query.trim() !== '';

  const close = () => {
    setAdding(false);
    setQuery('');
    setActive(0);
  };
  const choose = (code: string) => {
    onChange([...compare, code].slice(0, COMPARE_MAX));
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return; // 注音、拼音選字中的 Enter／方向鍵交給輸入法
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && hits.length) {
      e.preventDefault();
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length);
    } else if (e.key === 'Enter' && expanded && hits[active]) {
      e.preventDefault();
      choose(hits[active].entry.iso3);
    } else if (e.key === 'Escape') {
      e.preventDefault(); // 不要順便取消選取的國家（App 的 Esc）
      close();
    }
  };

  return (
    <div className="compare">
      <span className="compare-label">{t.compareLabel}</span>
      {compare.map((code, i) => (
        <span key={code} className="compare-chip">
          <span className="compare-dot" style={{ background: colors[i] }} aria-hidden="true" />
          {countryName(code, countries)}
          <button
            type="button"
            className="compare-remove"
            aria-label={t.compareRemove(countryName(code, countries))}
            title={t.compareRemove(countryName(code, countries))}
            onClick={() => onChange(compare.filter((c) => c !== code))}
          >
            <CloseIcon size={12} />
          </button>
        </span>
      ))}
      {compare.length < COMPARE_MAX &&
        (adding ? (
          <span className="compare-search">
            <input
              ref={inputRef}
              // 點了「加入比較」才出現，直接可以打字
              autoFocus
              type="search"
              role="combobox"
              aria-label={t.compareAddAria}
              aria-autocomplete="list"
              aria-expanded={expanded}
              aria-controls={expanded && hits.length ? `${id}-list` : undefined}
              aria-activedescendant={expanded && hits[active] ? `${id}-${active}` : undefined}
              placeholder={t.comparePlaceholder}
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              onBlur={close}
            />
            {expanded && (
              <span className="compare-results">
                {hits.length ? (
                  <ul id={`${id}-list`} role="listbox" aria-label={t.compareAddAria}>
                    {hits.map(({ entry }, i) => (
                      <li
                        key={entry.iso3}
                        id={`${id}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        className={i === active ? 'is-active' : undefined}
                        // 按下時不讓輸入框失焦，否則清單會在 click 之前就關掉
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseMove={() => i !== active && setActive(i)}
                        onClick={() => choose(entry.iso3)}
                      >
                        {lang === 'en' ? entry.en : entry.zh}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="compare-empty">{t.compareNoResults}</span>
                )}
              </span>
            )}
          </span>
        ) : (
          // 看得到的字要包含在名稱裡（axe 的 label-content-name-mismatch）：「＋」不唸，名稱是「加入比較的國家」
          <button type="button" className="compare-add" onClick={() => setAdding(true)} aria-label={t.compareAddAria}>
            <span aria-hidden="true">+ </span>
            {t.compareAdd}
          </button>
        ))}
    </div>
  );
}
