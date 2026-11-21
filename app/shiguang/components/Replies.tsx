'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { displayMinute, spaceRequest } from '@/lib/shiguang/client';
import type { Reply, ReplyPage, SpaceMember } from '@/lib/shiguang/types';
import { useSpace } from './SpaceContext';
import MessageAttachments from './MessageAttachments';
import WhisperMedia from './WhisperMedia';

const emptyDraft = { content: '', audio: '', image: '', video: '' };

function CommentAvatar({ member, name }: { member?: SpaceMember; name: string }) {
  return <div className="entries-comment-avatar" aria-hidden="true">
    <span>{name.slice(0, 1) || '成'}</span>
    {member?.avatar && <img src={member.avatar} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
  </div>;
}

function commentContent(content: string) {
  const match = content.match(/^回复\s*@([^：:]+)[：:]\s*([\s\S]*)$/);
  return match ? { mention: `回复 @${match[1]}`, text: match[2] } : { mention: '', text: content };
}

export default function Replies({ entryId, onReplyCountChange, onReplyMutation }: {
  entryId: string;
  onReplyCountChange: (entryId: string, replyCount: number) => void;
  onReplyMutation: (updating: boolean) => void;
}) {
  const { summary } = useSpace();
  const [items, setItems] = useState<Reply[]>([]), [more, setMore] = useState(false), [page, setPage] = useState(0);
  const [draft, setDraft] = useState(emptyDraft), [editing, setEditing] = useState<Reply>(), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [loaded, setLoaded] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Reply>();
  const [draftVersion, setDraftVersion] = useState(0);
  const [id, setId] = useState(() => crypto.randomUUID());
  const textarea = useRef<HTMLTextAreaElement>(null);
  const activeRepliesRequest = useRef<object | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const load = useCallback(async (n = 0) => {
    if (n && activeRepliesRequest.current) return;
    const request = {};
    activeRepliesRequest.current = request;
    setLoadingMore(n > 0);
    setError('');
    try {
      const data = await spaceRequest<ReplyPage>(`/replies?entryId=${entryId}&page=${n}&pageSize=10`);
      if (activeRepliesRequest.current !== request) return;
      if (typeof data.replyCount === 'number') onReplyCountChange(entryId, data.replyCount);
      setItems(previous => {
        if (!n) return data.items;
        const existingIds = new Set(previous.map(reply => reply.id));
        return previous.concat(data.items.filter(reply => !existingIds.has(reply.id)));
      });
      setMore(data.hasMore);
      setPage(n);
    } catch (error) {
      if (activeRepliesRequest.current === request) throw error;
    } finally {
      if (activeRepliesRequest.current === request) {
        activeRepliesRequest.current = null;
        setLoaded(true);
        setLoadingMore(false);
      }
    }
  }, [entryId, onReplyCountChange]);
  useEffect(() => {
    void load().catch(cause => setError((cause as Error).message));
    return () => { activeRepliesRequest.current = null; };
  }, [load]);

  function edit(reply?: Reply) {
    setEditing(reply);
    setDraft(reply ? { content: reply.content, audio: reply.audio || '', image: reply.image || '', video: reply.video || '' } : { ...emptyDraft });
    setReplyTarget(undefined);
    setDraftVersion(version => version + 1);
    setError('');
  }

  function beginReply(reply: Reply) {
    setEditing(undefined);
    setReplyTarget(reply);
    setDraft({ ...emptyDraft });
    setDraftVersion(version => version + 1);
    setError('');
    setId(crypto.randomUUID());
    requestAnimationFrame(() => textarea.current?.focus());
  }

  async function save() {
    if (busy || uploading || !(draft.content.trim() || draft.audio || draft.image || draft.video)) return;
    onReplyMutation(true);
    setBusy(true);
    setError('');
    try {
      const targetName = replyTarget ? summary.space.members.find(member => member.userId === replyTarget.createdBy)?.name || '空间成员' : '';
      const content = !editing && targetName
        ? `回复 @${targetName}：${draft.content.trim()}`
        : draft.content;
      await spaceRequest(`/replies${editing ? `/${editing.id}` : ''}`, editing ? 'PUT' : 'POST', {
        id,
        entryId,
        ...draft,
        content,
        version: editing?.version,
      });
      edit();
      setId(crypto.randomUUID());
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      onReplyMutation(false);
    }
  }

  async function remove(reply: Reply) {
    if (!confirm('删除这条回复？')) return;
    onReplyMutation(true);
    setBusy(true);
    setError('');
    try {
      await spaceRequest(`/replies/${reply.id}`, 'DELETE', { version: reply.version });
      if (editing?.id === reply.id) edit();
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      onReplyMutation(false);
    }
  }

  return <section className="entries-comments entries-comments--douyin" aria-label="絮语评论">
    {error && <p role="alert" className="sg-error">{error}</p>}

    {items.length > 0 && <div className="entries-comment-list">
      {items.map(reply => {
        const member = summary.space.members.find(candidate => candidate.userId === reply.createdBy);
        const name = member?.name || '空间成员';
        const content = commentContent(reply.content);
        return <article className="entries-comment" key={reply.id}>
          <CommentAvatar member={member} name={name} />
          <div className="entries-comment-main">
            <div className="entries-comment-identity">
              <strong>{name}</strong>
              <time dateTime={reply.createdAt}>{displayMinute(reply.createdAt)}</time>
            </div>
            {(reply.content || reply.image || reply.video || reply.audio) && <div className="entries-comment-body">
              {reply.content && <p className="entries-comment-text">
                {content.mention && <span className="entries-comment-mention">{content.mention}：</span>}
                {content.text}
              </p>}
              {(reply.image || reply.video || reply.audio) && <WhisperMedia audio={reply.audio} media={[
                ...(reply.image ? [{ type: 'image' as const, reference: reply.image }] : []),
                ...(reply.video ? [{ type: 'video' as const, reference: reply.video }] : []),
              ]} />}
            </div>}
            <div className="entries-comment-meta-row">
              <button type="button" disabled={busy || uploading} onClick={() => beginReply(reply)}>回复</button>
              {reply.createdBy === summary.userId && <div className="entries-comment-actions">
                <button type="button" disabled={busy || uploading} onClick={() => edit(reply)}>编辑</button>
                <button type="button" className="entries-comment-action--danger" disabled={busy || uploading} onClick={() => void remove(reply)}>删除</button>
              </div>}
            </div>
          </div>
        </article>;
      })}
    </div>}

    {!items.length && !error && <p className="entries-comments-empty">{loaded ? '还没有评论' : '正在加载评论…'}</p>}
    {more && <button type="button" className="entries-comments-more" disabled={busy || loadingMore} onClick={() => void load(page + 1).catch(cause => setError((cause as Error).message))}>
      {loadingMore ? '正在加载…' : '展开更多评论'}
    </button>}

    <form className="entries-comment-composer" onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="entries-comment-composer-main">
        {replyTarget && <div className="entries-comment-reply-target">
          回复 @{summary.space.members.find(member => member.userId === replyTarget.createdBy)?.name || '空间成员'}
          <button type="button" aria-label="取消回复" onClick={() => setReplyTarget(undefined)}><X /></button>
        </div>}
        {editing && <div className="entries-comment-reply-target">正在编辑评论</div>}
        <textarea className="entries-comment-input" ref={textarea} rows={2} maxLength={2000} value={draft.content} disabled={busy}
          aria-label="评论内容" placeholder={replyTarget ? '回复评论…' : editing ? '修改评论…' : '说点什么…'}
          onChange={event => setDraft(previous => ({ ...previous, content: event.target.value }))} />
        <MessageAttachments key={draftVersion} value={draft} disabled={busy} onBusy={setUploading}
          onChange={(key, value) => setDraft(previous => ({ ...previous, [key]: value }))}
          replyActions={<>
            {editing && <button type="button" className="entries-comment-cancel" disabled={busy || uploading} onClick={() => edit()}>取消</button>}
            <button className="entries-comment-submit" disabled={busy || uploading || !(draft.content.trim() || draft.audio || draft.image || draft.video)}>
              {busy ? '发送中…' : editing ? '保存' : '发送'}
            </button>
          </>} />
      </div>
    </form>
  </section>;
}
