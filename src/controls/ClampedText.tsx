import { useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n';

/**
 * 只露前兩行的文字，真的被截掉時右邊才出現「更多」，點了展開。哪裡截、截幾行由 CSS 決定（className）：
 * - 選單下面的指標說明（indicator-desc）：只有手機截，英文的說明常常四、五行，會把地圖往下擠
 * - 頁尾的主題說明（footer-note）：都截，有的主題寫了十幾行
 * 換指標、換主題時由呼叫端用 key 重設成收起。
 */
export function ClampedText({ text, className }: { text: string; className: string }) {
  const t = useT();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 收起時才量得出有沒有被截掉；寬度變了（轉向、跨過手機的寬度）重新量
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className={`clamped-row ${className}-row`}>
      <p ref={ref} className={`${className}${expanded ? ' is-expanded' : ''}`}>
        {text}
      </p>
      {(clamped || expanded) && (
        <button type="button" className="clamped-toggle" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? t.descLess : t.descMore}
        </button>
      )}
    </div>
  );
}
