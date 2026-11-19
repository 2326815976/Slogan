import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AudioLines, ImageIcon, Pause, Play, X } from 'lucide-react';
import { displayTime } from '@/lib/shiguang/client';
import type { Entry } from '@/lib/shiguang/types';
import styles from './HomeModules.module.css';

const attachmentKinds = ['image', 'video', 'audio'] as const;
const attachmentLabels = { image: '图片', video: '视频', audio: '音频' };
const attachmentIcons = { image: ImageIcon, video: Play, audio: AudioLines };

export default function WhisperPreview({ entry, author }: { entry: Entry; author: string }) {
  const { content, title, image, video, audio } = entry.payload;
  const attachments = attachmentKinds.filter(kind => entry.payload[kind]);
  const single = attachments.length === 1 ? attachments[0] : undefined;
  const dialog = useRef<HTMLDialogElement>(null);
  const videoPlayer = useRef<HTMLVideoElement>(null);
  const audioPlayer = useRef<HTMLAudioElement>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const player = audioPlayer.current ?? videoPlayer.current;
    return () => { player?.pause(); };
  }, [single, audio, video, mediaOpen]);

  function openAttachment() {
    setError('');
    if (single === 'audio') {
      const player = audioPlayer.current;
      if (!player) return;
      if (player.paused) {
        void player.play().catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setError('音频暂时无法播放');
        });
      } else player.pause();
      return;
    }
    dialog.current?.showModal();
    setMediaOpen(true);
  }

  return <div className={styles.whisperPreview}>
    <Link href="/shiguang/whisper" className={`${styles.whisperCopy} ${styles.whisperLink}`}>
      {(content || title) && <p className={styles.whisperText}>{content || title}</p>}
      <div className={`${styles.meta} ${styles.whisperMeta}`}>
        <span>{author}</span><span aria-hidden="true">·</span><time dateTime={entry.createdAt}>{displayTime(entry.createdAt)}</time>
      </div>
      {single === 'audio' && error && <span className={styles.meta} role="status">{error}</span>}
    </Link>
    {attachments.length > 0 && <div className={styles.whisperMedia}>
      {attachments.map(kind => {
        const active = kind === 'audio' && playing;
        const Icon = active ? Pause : attachmentIcons[kind];
        const tile = <><Icon aria-hidden="true" />{active ? '暂停' : attachmentLabels[kind]}</>;
        return single === kind ? <button key={kind} type="button" className={styles.attachment} data-kind={kind}
          aria-label={kind === 'image' ? '查看原图' : active ? '暂停音频' : `播放${attachmentLabels[kind]}`} onClick={openAttachment}>
          {tile}
          {kind === 'image' && <img key={image} src={`${image}?variant=preview`} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
        </button> : <span key={kind} className={styles.attachment} data-kind={kind}>{tile}</span>;
      })}
    </div>}
    {single === 'audio' && <audio ref={audioPlayer} src={audio} preload="none" hidden
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onError={() => { setPlaying(false); setError('音频暂时无法播放'); }} />}
    {(single === 'image' || single === 'video') && <dialog ref={dialog} className={styles.mediaDialog}
      aria-label={single === 'image' ? '查看原图' : '播放视频'} onClose={() => { videoPlayer.current?.pause(); setMediaOpen(false); }}>
      <button type="button" className={styles.closeMedia} aria-label="关闭" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></button>
      {mediaOpen && (error ? <p role="status">{error}</p> : single === 'image'
        ? <img src={image} alt="絮语原图" onError={() => setError('原图暂时无法打开')} />
        : <video ref={videoPlayer} src={video} controls autoPlay playsInline onError={() => setError('视频暂时无法播放')} />)}
    </dialog>}
  </div>;
}
