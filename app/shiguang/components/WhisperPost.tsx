'use client';

import { ChevronDown, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { displayMinute } from '@/lib/shiguang/client';
import type { Entry } from '@/lib/shiguang/types';
import Replies from './Replies';
import WhisperMedia from './WhisperMedia';
import WhisperPostText from './WhisperPostText';

export default function WhisperPost({
  entry,
  authorName,
  authorAvatar,
  canManage,
  busy,
  expanded,
  repliesLocked,
  onToggleReplies,
  onReplyCountChange,
  onReplyMutation,
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
  repliesLocked: boolean;
  onToggleReplies: () => void;
  onReplyCountChange: (entryId: string, replyCount: number) => void;
  onReplyMutation: (updating: boolean) => void;
  onTopicClick?: (topic: string) => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const content = String(entry.payload.content || entry.payload.description || entry.payload.title || '').trim();
  const replyCount = entry.replyCount ?? 0;
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

    {content && <WhisperPostText key={content} content={content} onTopicClick={onTopicClick} />}

    <WhisperMedia media={media} audio={entry.payload.audio} />

    <footer className="entries-post-footer">
      <button type="button" className="entries-post-reply" aria-expanded={expanded} disabled={repliesLocked} onClick={onToggleReplies}>
        <MessageSquare aria-hidden="true" />
        <span>{expanded ? '收起评论' : entry.replyCount === 0 ? '写评论' : '评论'}</span>
        {replyCount > 0 && <span className="entries-post-reply__count" aria-label={`${replyCount} 条评论`}>{replyCount}</span>}
        <ChevronDown className="entries-post-reply__chevron" aria-hidden="true" />
      </button>
    {expanded && <Replies entryId={entry.id} onReplyCountChange={onReplyCountChange} onReplyMutation={onReplyMutation} />}
    </footer>
    </article>
  </>;
}
