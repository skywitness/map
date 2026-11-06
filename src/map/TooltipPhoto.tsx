import { useState } from 'react';
import type { PointTooltip } from '../topics/types';

/**
 * tooltip 的照片（2026-11-06，城2；PointTooltip.photo）：固定 16:9 的框，照片到之前先留空間，tooltip 不會跳；
 * 讀不到（檔案改名、刪除）時整張拿掉，只留文字。出處（攝影者、授權）寫在照片下面；點一下固定的卡片裡照片連到 Commons
 */
export function TooltipPhoto({ photo }: { photo: NonNullable<PointTooltip['photo']> }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === photo.src) return null;
  const img = (
    <img
      key={photo.src}
      src={photo.src}
      srcSet={photo.srcSet}
      sizes="240px"
      alt=""
      width={240}
      height={135}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(photo.src)}
    />
  );
  return (
    <figure className="tt-photo">
      {/* 點一下固定的卡片裡可以點照片開 Commons 的檔案頁（滑過的 tooltip 點不到） */}
      {photo.page ? (
        <a href={photo.page} target="_blank" rel="noopener noreferrer" title={photo.credit}>
          {img}
        </a>
      ) : (
        img
      )}
      <figcaption>{photo.credit}</figcaption>
    </figure>
  );
}
