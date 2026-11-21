'use client';

import { Play } from 'lucide-react';
import { useRef, useState } from 'react';
import type { EntryMedia } from '@/lib/shiguang/types';
import AudioPlayer, { formatDuration, type AudioPlayerHandle } from './AudioPlayer';
import WhisperVideoDialog from './WhisperVideoDialog';

function WhisperVideo({ src, onOpen }: { src: string; onOpen: () => void }) {
  const [opened, setOpened] = useState(false);
  const [duration, setDuration] = useState('');

  return <>
    <div className="entries-whisper-media__tile entries-whisper-media__tile--video entries-whisper-media__video-frame">
      <video className="entries-whisper-media__video" src={src} muted playsInline preload="metadata" aria-hidden="true"
        onDurationChange={event => {
          const seconds = event.currentTarget.duration;
          setDuration(Number.isFinite(seconds) && seconds > 0 ? formatDuration(seconds) : '');
        }} />
      <button type="button" className="entries-whisper-video-play compact-button" aria-label="播放视频" aria-haspopup="dialog"
        onClick={() => { onOpen(); setOpened(true); }}>
        <Play aria-hidden="true" />
      </button>
      {duration && <span className="entries-whisper-video-duration">{duration}</span>}
    </div>
    {opened && <WhisperVideoDialog src={src} onClose={() => setOpened(false)} />}
  </>;
}

export default function WhisperMedia({ media, audio }: { media: EntryMedia[]; audio?: string }) {
  const audioPlayer = useRef<AudioPlayerHandle>(null);
  return <>
    {media.length > 0 && <div className="entries-post-media entries-whisper-media">
      {media.map((item, index) => item.type === 'image' ? <a key={`${item.reference}-${index}`} className="entries-whisper-media__tile" href={item.reference} target="_blank" rel="noreferrer" aria-label="查看原图">
        <img src={`${item.reference}?variant=preview`} alt="图片附件" loading="lazy" onError={event => {
          const image = event.currentTarget;
          if (image.getAttribute('src') !== item.reference) image.src = item.reference;
        }} />
      </a> : <WhisperVideo key={`${item.reference}-${index}`} src={item.reference} onOpen={() => audioPlayer.current?.pause()} />)}
    </div>}
    {audio && <div className="entries-whisper-media__audio">
      <AudioPlayer ref={audioPlayer} src={audio} variant="progress" />
    </div>}
  </>;
}
