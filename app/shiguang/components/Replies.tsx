'use client';

import { useCallback, useEffect, useState } from 'react';
import { displayTime, spaceRequest } from '@/lib/shiguang/client';
import type { PageResult, Reply } from '@/lib/shiguang/types';
import { useSpace } from './SpaceContext';
import MessageAttachments from './MessageAttachments';
import MessageMedia from './MessageMedia';

const emptyDraft = { content: '', audio: '', image: '', video: '' };

export default function Replies({ entryId }: { entryId: string }) {
  const { summary } = useSpace();
  const [items, setItems] = useState<Reply[]>([]), [more, setMore] = useState(false), [page, setPage] = useState(0);
  const [draft, setDraft] = useState(emptyDraft), [editing, setEditing] = useState<Reply>(), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false);
  const [id, setId] = useState(() => crypto.randomUUID());
  const load = useCallback(async (n = 0) => { const data = await spaceRequest<PageResult<Reply>>(`/replies?entryId=${entryId}&page=${n}`); setItems(prev => n ? [...prev, ...data.items] : data.items); setMore(data.hasMore); setPage(n); }, [entryId]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);

  function edit(reply?: Reply) {
    setEditing(reply);
    setDraft(reply ? { content: reply.content, audio: reply.audio || '', image: reply.image || '', video: reply.video || '' } : emptyDraft);
    setError('');
  }

  async function save() {
    if (busy || uploading || !(draft.content.trim() || draft.audio || draft.image || draft.video)) return;
    setBusy(true);
    setError('');
    try {
      await spaceRequest(`/replies${editing ? `/${editing.id}` : ''}`, editing ? 'PUT' : 'POST', { id, entryId, ...draft, version: editing?.version });
      edit();
      setId(crypto.randomUUID());
      await load();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(reply: Reply) {
    if (!confirm('删除这条回复？')) return;
    setBusy(true);
    try {
      await spaceRequest(`/replies/${reply.id}`, 'DELETE', { version: reply.version });
      if (editing?.id === reply.id) edit();
      await load();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="sg-stack border-t pt-4 mt-4">
    {items.map(reply => <div key={reply.id} className="sg-list-item">
      {reply.content && <p className="sg-text">{reply.content}</p>}
      <MessageMedia {...reply} />
      <div className="sg-list-footer">
        <p className="sg-list-meta">{summary.space.members.find(member => member.userId === reply.createdBy)?.name || '空间成员'} · {displayTime(reply.createdAt)}</p>
        {reply.createdBy === summary.userId && <div className="sg-list-actions">
          <button className="sg-link sg-list-action" disabled={busy || uploading} onClick={() => edit(reply)}>编辑</button>
          <button className="sg-link sg-list-action sg-danger" disabled={busy || uploading} onClick={() => void remove(reply)}>删除</button>
        </div>}
      </div>
    </div>)}
    {more && <button className="sg-link" onClick={() => void load(page + 1).catch(e => setError(e.message))}>更多回复</button>}
    <form className="sg-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label>{editing ? '编辑回复' : '写一句回应'}<textarea maxLength={2000} value={draft.content} disabled={busy} onChange={event => setDraft(previous => ({ ...previous, content: event.target.value }))} /></label>
      <MessageAttachments value={draft} disabled={busy} onBusy={setUploading} onChange={(key, value) => setDraft(previous => ({ ...previous, [key]: value }))} />
      <div className="sg-actions">
        <button className="sg-button" disabled={busy || uploading || !(draft.content.trim() || draft.audio || draft.image || draft.video)}>{editing ? '保存回复' : '回复'}</button>
        {editing && <button className="sg-link" type="button" disabled={busy || uploading} onClick={() => edit()}>取消</button>}
      </div>
    </form>
    {error && <p role="alert" className="sg-error">{error}</p>}
  </div>;
}
