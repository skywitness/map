import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { categoryStyle, Glyph, topicGlyph, useTopicIcons } from '../controls/TopicIcon';
import { defineMessages, tr, useLang } from '../i18n';
import { normalize } from '../lib/countrySearch';
import { groupOfTopic, TOPIC_GROUPS } from '../topics';
import { CATALOG } from '../topics/catalog.gen';
import { foreignKey } from '../topics/foreign-layers';
import { FOREIGN_LAYERS } from '../topics/foreignLayers.gen';
import { SearchIcon } from './MapIcons';

// 只有這個對話框用到的樣式，跟著程式延後下載
import './LayerPicker.css';

export interface LayerPickerProps {
  open: boolean;
  onClose: () => void;
  /** 目前打開的共用疊加圖層與別的主題的圖層（`<主題>/<圖層 id>`） */
  selected: string[];
  /** 目前的主題：它自己的圖層不列 */
  topic: string;
  onToggle: (key: string) => void;
}

const TEXT = defineMessages({
  zh: {
    title: '更多主題的圖層',
    hint: '勾選的圖層疊在目前的地圖上，換主題也留著。跟時間軸的方式照原本的主題；只畫某一年的圖層，時間軸超出它的資料年份時畫最接近的一年。',
    search: '搜尋主題或圖層',
    close: '關閉',
    done: '完成',
    points: '點',
    lines: '線',
    count: (n: number) => (n ? `已經加入 ${n} 個圖層` : '還沒有加入圖層'),
    removeAll: '全部移除',
    empty: '沒有符合的主題或圖層',
  },
  en: {
    title: 'Layers from more topics',
    hint: 'Checked layers are drawn on top of the current map and stay when you change topics. Each follows the time slider the way it does in its own topic; a layer that shows one year at a time shows its nearest year when the slider is outside its data.',
    search: 'Search topics or layers',
    close: 'Close',
    done: 'Done',
    points: 'Points',
    lines: 'Lines',
    count: (n: number) => (n ? `${n} ${n === 1 ? 'layer' : 'layers'} added` : 'No layers added yet'),
    removeAll: 'Remove all',
    empty: 'No matching topics or layers',
  },
});

/**
 * 圖層選單的「更多主題的圖層…」（2026-10-31，使用者選的第四輪 一、4）：任何主題的點、線圖層都可以疊到目前的主題上。
 * 依分類、主題列出（foreignLayers.gen.ts），勾了馬上加上（資料等畫的時候才下載），可以連續勾好幾個；
 * 上面的搜尋框比對主題名稱與圖層名稱。<dialog> 的 showModal：焦點留在裡面、Esc 關閉
 */
export default function LayerPicker({ open, onClose, selected, topic, onToggle }: LayerPickerProps) {
  const lang = useLang();
  const T = TEXT[lang];
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const icons = useTopicIcons(open);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery('');
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  const groups = useMemo(() => {
    const q = normalize(query).replace(/ /g, '');
    const has = (text: string) => normalize(text).replace(/ /g, '').includes(q);
    return TOPIC_GROUPS.map((group) => ({
      id: group.id,
      label: tr(group.label, lang),
      topics: FOREIGN_LAYERS.filter((t) => t.topic !== topic && groupOfTopic(t.topic) === group.id).flatMap((t) => {
        const title = tr(CATALOG.topics[t.topic]?.title ?? t.topic, lang);
        // 主題名稱相符時列出全部圖層，否則只列名稱相符的圖層（兩種語言都比對）
        const all = !q || has(title) || has(tr(CATALOG.topics[t.topic]?.title ?? '', lang === 'zh' ? 'en' : 'zh'));
        const layers = all ? t.layers : t.layers.filter((l) => has(tr(l.label, 'zh')) || has(tr(l.label, 'en')));
        return layers.length ? [{ topic: t.topic, title, layers }] : [];
      }),
    })).filter((g) => g.topics.length);
  }, [query, topic, lang]);

  const foreignOn = selected.filter((key) => key.includes('/'));

  // 點對話框外面的暗色背景也關閉
  const onDialogClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="layer-picker"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={onDialogClick}
      // 對話框裡的按鍵不給全域快捷鍵（勾選框上的方向鍵會換年份、Esc 會取消選取的國家）；Esc 照樣關閉對話框
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="layer-picker-head">
        <h2 id={`${id}-title`}>{T.title}</h2>
        <button type="button" className="layer-picker-close" aria-label={T.close} title={T.close} onClick={onClose}>
          ×
        </button>
      </div>
      <p className="layer-picker-hint">{T.hint}</p>
      <div className="layer-picker-search">
        <SearchIcon />
        <input
          ref={inputRef}
          type="search"
          aria-label={T.search}
          placeholder={T.search}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </div>
      <div className="layer-picker-list">
        {groups.length ? (
          groups.map((group) => (
            <section key={group.id} className="layer-picker-group" aria-label={group.label}>
              <h3 className="layer-picker-group-title">{group.label}</h3>
              {group.topics.map((t) => (
                <fieldset key={t.topic} className="layer-picker-topic" style={categoryStyle(group.id)}>
                  <legend>
                    <span className="topic-tile" aria-hidden="true">
                      <Glyph size={14} d={topicGlyph(icons, t.topic)} />
                    </span>
                    {t.title}
                  </legend>
                  {t.layers.map((l) => {
                    const key = foreignKey(t.topic, l.id);
                    return (
                      <label key={l.id} className="layer-picker-item">
                        <input type="checkbox" checked={selected.includes(key)} onChange={() => onToggle(key)} />
                        <span className="layer-picker-name">{tr(l.label, lang)}</span>
                        <span className="layer-picker-kind">{l.kind === 'points' ? T.points : T.lines}</span>
                      </label>
                    );
                  })}
                </fieldset>
              ))}
            </section>
          ))
        ) : (
          <p className="layer-picker-empty">{T.empty}</p>
        )}
      </div>
      <div className="layer-picker-foot">
        <span aria-live="polite">{T.count(foreignOn.length)}</span>
        {foreignOn.length > 0 && (
          <button type="button" className="layer-picker-clear" onClick={() => foreignOn.forEach(onToggle)}>
            {T.removeAll}
          </button>
        )}
        <button type="button" className="layer-picker-done" onClick={onClose}>
          {T.done}
        </button>
      </div>
    </dialog>
  );
}
