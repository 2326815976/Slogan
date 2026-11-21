'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AudioLines, ImageIcon, Pause, Video, X } from 'lucide-react';
import { displayMinute } from '@/lib/shiguang/client';
import type { Entry } from '@/lib/shiguang/types';
import styles from './HomeModules.module.css';
import TopicText from './TopicText';
import WhisperVideoDialog from './WhisperVideoDialog';

type AttachmentKind = 'image' | 'video' | 'audio';
type Attachment = { kind: AttachmentKind; reference: string };
const attachmentMeta = {
  image: { label: '查看图片', Icon: ImageIcon },
  video: { label: '播放视频', Icon: Video },
  audio: { label: '播放音频', Icon: AudioLines },
};

export default function WhisperPreview({ entry, author }: { entry: Entry; author: string }) {
  const source = String(entry.payload.content || entry.payload.title || '').replace(/\s+/g, ' ').trim();
  const seen = new Set<string>();
  const media = [
    ...(Array.isArray(entry.payload.media) ? entry.payload.media : []),
    ...(entry.payload.image ? [{ type: 'image' as const, reference: entry.payload.image }] : []),
    ...(entry.payload.video ? [{ type: 'video' as const, reference: entry.payload.video }] : []),
  ].filter(item => {
    const key = `${item.type}:${item.reference}`;
    if (!item.reference || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
  const fallback = entry.payload.audio ? '[音频]' : media.length ? '[媒体]' : '未命名絮语';
  const excerpt = Array.from(source || fallback);
  const previewText = excerpt.length > 20 ? `${excerpt.slice(0, 20).join('')}...` : excerpt.join('');
  const date = displayMinute(entry.createdAt).slice(0, 10);
  const dialog = useRef<HTMLDialogElement>(null);
  const audioPlayer = useRef<HTMLAudioElement>(null);
  const audioSource = entry.payload.audio;
  const [previewAttachment, setPreviewAttachment] = useState<Attachment>();
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const attachments: Attachment[] = [
    ...media.map(item => ({ kind: item.type, reference: item.reference })),
    ...(entry.payload.audio ? [{ kind: 'audio' as const, reference: entry.payload.audio }] : []),
  ];

  useEffect(() => {
    const player = audioPlayer.current;
    setPlaying(false);
    return () => player?.pause();
  }, [audioSource]);

  function openAttachment(attachment: Attachment) {
    setError('');
    if (attachment.kind === 'audio') {
      const player = audioPlayer.current;
      if (!player) return;
      if (player.paused) {
        void player.play().catch(() => setError('音频暂时无法播放'));
      } else {
        player.pause();
      }
      return;
    }
    audioPlayer.current?.pause();
    if (attachment.kind === 'video') {
      flushSync(() => setPreviewAttachment(attachment));
      return;
    }
    setPreviewAttachment(attachment);
    dialog.current?.showModal();
  }

  function closePreview() {
    setPreviewAttachment(undefined);
    setError('');
  }

  return <div className={styles.whisperPreview}>
    <div className={styles.whisperContent}>
      <span className={styles.whisperTitleRow}>
        <span className={styles.whisperAccent} aria-hidden="true" />
        <TopicText className={styles.whisperTitle} content={previewText} />
      </span>
      <span className={styles.whisperSide}>
        {attachments.length > 0 && <span className={styles.whisperAttachments}>
          {attachments.map((attachment, index) => {
            const { label, Icon: BaseIcon } = attachmentMeta[attachment.kind];
            const active = attachment.kind === 'audio' && playing;
            const Icon = active ? Pause : BaseIcon;
            const actionLabel = active ? '暂停音频' : label;
            return <button key={`${attachment.reference}-${index}`} type="button" className={styles.whisperAttachmentIcon}
              aria-label={actionLabel} title={actionLabel}
              onClick={event => { event.preventDefault(); event.stopPropagation(); openAttachment(attachment); }}>
              <Icon aria-hidden="true" />
            </button>;
          })}
        </span>}
        <span className={styles.whisperMeta}>
          <span className={styles.whisperAuthor}>{author}</span>
          {date && <>
            <span className={styles.whisperDivider} aria-hidden="true">·</span>
            <time dateTime={entry.createdAt}>{date}</time>
          </>}
        </span>
      </span>
    </div>
    {error && <span className={styles.whisperError} role="status">{error}</span>}
    {audioSource && <audio key={audioSource} ref={audioPlayer} src={audioSource} preload="none" hidden
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onError={() => { setPlaying(false); setError('音频暂时无法播放'); }} />}
    {previewAttachment?.kind === 'video' && <WhisperVideoDialog src={previewAttachment.reference} onClose={closePreview} />}
    <dialog ref={dialog} className={styles.mediaDialog} aria-label="查看图片" onClose={closePreview}>
      <button type="button" className={styles.closeMedia} aria-label="关闭" onClick={() => dialog.current?.close()}>
        <X aria-hidden="true" />
      </button>
      {previewAttachment?.kind === 'image' && <img src={previewAttachment.reference} alt="絮语图片" onError={() => setError('图片暂时无法打开')} />}
      {error && <p role="status">{error}</p>}
    </dialog>
  </div>;
}
