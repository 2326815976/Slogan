'use client';

import { ChevronDown, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { displayMinute } from '@/lib/shiguang/client';
import type { Entry } from '@/lib/shiguang/types';
import AudioPlayer from './AudioPlayer';
import Replies from './Replies';
import TopicText from './TopicText';

export default function WhisperPost({
  entry,
  authorName,
  authorAvatar,
  canManage,
  busy,
  expanded,
  onToggleReplies,
  onTopicClick,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  authorName: string;
  authorAvatar: string;
  canManage: boolean;
  busy: boolean;
  expanded: boolean;
  onToggleReplies: () => void;
  onTopicClick?: (topic: string) => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const content = String(entry.payload.content || entry.payload.description || entry.payload.title || '').trim();
  const initial = authorName.slice(0, 1) || '成';
  const mediaSeen = new Set<string>();
  const media = [
    ...(Array.isArray(entry.payload.media) ? entry.payload.media : []),
    ...(entry.payload.image ? [{ type: 'image' as const, reference: entry.payload.image }] : []),
    ...(entry.payload.video ? [{ type: 'video' as const, reference: entry.payload.video }] : []),
  ].filter(item => {
    const key = `${item.type}:${item.reference}`;
    if (!item.reference || mediaSeen.has(key)) return false;
    mediaSeen.add(key);
    return true;
  }).slice(0, 3);

  return <>
    <article className="sg-list-item entries-post">
    <header className="entries-post-header">
      <div className="entries-post-avatar" aria-hidden="true">
        <span>{initial}</span>
        {authorAvatar && <img src={authorAvatar} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
      </div>
      <div className="entries-post-identity">
        <strong>{authorName}</strong>
        <time dateTime={entry.createdAt}>{displayMinute(entry.createdAt)}</time>
      </div>
      {canManage && <div className="entries-post-manage">
        <button type="button" className="entries-post-icon" aria-label="编辑絮语" title="编辑" disabled={busy} onClick={onEdit}><Pencil /></button>
        <button type="button" className="entries-post-icon entries-post-icon--danger" aria-label="删除絮语" title="删除" disabled={busy} onClick={() => void onDelete()}><Trash2 /></button>
      </div>}
    </header>

    {content && <div className="entries-post-body"><p className="entries-post-text"><TopicText content={content} onTopicClick={onTopicClick} /></p></div>}

    {(media.length > 0 || entry.payload.audio) && <div className="entries-post-media entries-whisper-media">
      {media.map((item, index) => item.type === 'image' ? <a key={`${item.reference}-${index}`} className="entries-whisper-media__tile" href={item.reference} target="_blank" rel="noreferrer" aria-label="查看原图">
        <img src={`${item.reference}?variant=preview`} alt="絮语图片" loading="lazy" onError={event => {
          const image = event.currentTarget;
          if (image.getAttribute('src') !== item.reference) image.src = item.reference;
        }} />
      </a> : <div key={`${item.reference}-${index}`} className="entries-whisper-media__tile entries-whisper-media__tile--video entries-whisper-media__video-frame">
        <video className="entries-whisper-media__video" src={item.reference} controls playsInline preload="metadata"
          controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback />
      </div>)}
      {entry.payload.audio && <div className="entries-whisper-media__audio"><AudioPlayer src={entry.payload.audio} variant="progress" /></div>}
    </div>}

    <footer className="entries-post-footer">
      <button type="button" className="entries-post-reply" aria-expanded={expanded} onClick={onToggleReplies}>
        <MessageCircle aria-hidden="true" />
        <span>{expanded ? '收起评论' : '评论'}</span>
        <ChevronDown className="entries-post-reply__chevron" aria-hidden="true" />
      </button>
    </footer>

    {expanded && <Replies entryId={entry.id} />}
    </article>
  </>;
}
