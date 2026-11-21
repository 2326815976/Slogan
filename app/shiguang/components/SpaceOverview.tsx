'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { createClient } from '@/lib/cloudbase/client';
import { spaceRequest } from '@/lib/shiguang/client';
import AnniversaryCardContent, { OverviewFooter } from './AnniversaryCardContent';
import { useSpace } from './SpaceContext';

interface OverviewPhoto {
  id: string;
  thumbnail_url: string;
  shot_date: string | null;
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
  const isCountdown = anniversary?.direction === 'down';
  const albumTitle = summary.album?.title || '空间相册';

  return <div className="sg-overview">
    <button type="button" className={`sg-overview-card${photo ? ' sg-overview-card--photo' : ''}`} onClick={() => void onOpenAlbum()} aria-label={`进入空间：${albumTitle}`}>
      <span className="sg-overview-heading">{albumTitle}</span>
      {photos.map(preview => <img key={preview.id} src={preview.thumbnail_url} alt="" className="sg-overview-photo"
        hidden={preview.id !== photo?.id} onError={() => setPhotos(current => current.filter(item => item.id !== preview.id))} />)}
      {!photo && <LockKeyhole className="sg-overview-placeholder" aria-hidden="true" />}
      <OverviewFooter date={photo?.shot_date} />
    </button>
    <Link href="/shiguang/anniversary" className={`sg-overview-card sg-overview-card--anniversary${isCountdown ? ' sg-overview-card--countdown' : ''}`} aria-label="进入纪念日和倒数日管理">
      <AnniversaryCardContent payload={anniversary} today={summary.today} />
    </Link>
  </div>;
}
