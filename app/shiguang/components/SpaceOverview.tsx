'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarDays, CalendarHeart, Heart, LockKeyhole } from 'lucide-react';
import { createClient } from '@/lib/cloudbase/client';
import { spaceRequest } from '@/lib/shiguang/client';
import { anniversaryDays } from '@/lib/shiguang/validation';
import { useSpace } from './SpaceContext';

interface OverviewPhoto {
  id: string;
  thumbnail_url: string;
  shot_date: string | null;
}

function OverviewFooter({ date }: { date?: string | null }) {
  return <span className="sg-overview-footer">
    {date && <time className="sg-overview-date" dateTime={date}>
      <CalendarDays aria-hidden="true" />
      {date.replace(/-/g, '.')}
    </time>}
    <span className="sg-overview-entry">点击进入 <span aria-hidden="true">›</span></span>
  </span>;
}

export default function SpaceOverview({ onOpenAlbum }: { onOpenAlbum: () => Promise<void> }) {
  const { summary } = useSpace();
  const albumId = summary.album?.id;
  const [photos, setPhotos] = useState<OverviewPhoto[]>([]);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (!albumId) return;
    let active = true;
    async function loadPhotos() {
      const { webPath } = await spaceRequest<{ webPath: string }>('/album');
      const encodedKey = /^\/album\/([^/]+)$/.exec(webPath)?.[1];
      if (!active || !encodedKey) return;
      const { data, error } = await createClient().rpc('get_album_photo_page', {
        input_key: decodeURIComponent(encodedKey), folder_id: '__ROOT__', page_no: 1, page_size: 6,
      });
      if (!active || error || !Array.isArray(data?.photos)) return;
      setPhotos(data.photos.filter((photo: OverviewPhoto) =>
        photo.thumbnail_url === `/api/shiguang/album-assets/${encodeURIComponent(photo.id)}?variant=thumbnail`,
      ));
    }
    void loadPhotos().catch(() => {});
    return () => { active = false; };
  }, [albumId]);

  const anniversaries = summary.anniversaries;
  useEffect(() => {
    if (photos.length < 2 && anniversaries.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setPosition(current => current + 1);
      }
    }, 6000);
    return () => window.clearInterval(timer);
  }, [photos.length, anniversaries.length]);

  const photo = photos[position % Math.max(1, photos.length)];
  const anniversary = anniversaries[position % Math.max(1, anniversaries.length)]?.payload;
  const date = anniversary?.date;
  const elapsed = date ? anniversaryDays({ date }, summary.today) : NaN;
  const days = Math.abs(elapsed);
  const caption = elapsed === 0 ? '就是今天' : elapsed < 0 ? '还有' : anniversary?.direction === 'down' ? '已过去' : '已走过';
  const albumTitle = summary.album?.title || '空间相册';

  return <div className="sg-overview">
    <button type="button" className={`sg-overview-card${photo ? ' sg-overview-card--photo' : ''}`} onClick={() => void onOpenAlbum()} aria-label={`进入空间：${albumTitle}`}>
      <span className="sg-overview-heading">{albumTitle}</span>
      {photos.map(preview => <img key={preview.id} src={preview.thumbnail_url} alt="" className="sg-overview-photo"
        hidden={preview.id !== photo?.id} onError={() => setPhotos(current => current.filter(item => item.id !== preview.id))} />)}
      {!photo && <LockKeyhole className="sg-overview-placeholder" aria-hidden="true" />}
      <OverviewFooter date={photo?.shot_date} />
    </button>
    <Link href="/shiguang/anniversary" className="sg-overview-card sg-overview-card--anniversary" aria-label="进入纪念日和倒数日管理">
      <span className="sg-overview-flourish" aria-hidden="true"><Heart /></span>
      <span className="sg-overview-heading sg-overview-heading--anniversary">
        <span className="sg-overview-heading-decoration" aria-hidden="true">♥</span>
        <span className="sg-overview-heading-text">{anniversary?.name || '纪念日'}</span>
        <span className="sg-overview-heading-decoration" aria-hidden="true">♥</span>
      </span>
      {Number.isFinite(days) ? <span className="sg-overview-count">
        <span className="sg-overview-count-caption">{caption}</span>
        <span className={`sg-overview-value${days < 100 ? ' sg-overview-value--accent' : ''}`}>
          <strong className={days >= 100000 ? 'sg-overview-number--compact' : days >= 1000 ? 'sg-overview-number--wide' : undefined}>{days}</strong>
          <span className="sg-overview-unit">天</span>
        </span>
      </span> : <CalendarHeart className="sg-overview-placeholder" aria-hidden="true" />}
      <OverviewFooter date={date} />
    </Link>
  </div>;
}
