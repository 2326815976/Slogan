'use client';

import { useCallback, useEffect, useState } from 'react';
import { displayTime, spaceRequest } from '@/lib/shiguang/client';
import type { PageResult, Reply } from '@/lib/shiguang/types';
import { useSpace } from './SpaceContext';

export default function Replies({ entryId }: { entryId: string }) {
  const { summary } = useSpace();
  const [items, setItems] = useState<Reply[]>([]), [more, setMore] = useState(false), [page, setPage] = useState(0);
  const [content, setContent] = useState(''), [editing, setEditing] = useState<Reply>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [id, setId] = useState(() => crypto.randomUUID());
  const load = useCallback(async (n = 0) => { const data = await spaceRequest<PageResult<Reply>>(`/replies?entryId=${entryId}&page=${n}`); setItems(prev => n ? [...prev, ...data.items] : data.items); setMore(data.hasMore); setPage(n); }, [entryId]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  return <div className="sg-stack border-t pt-4 mt-4">
    {items.map(r => <div key={r.id} className="bg-[#FFFBF0] p-3 rounded-xl"><p className="sg-text">{r.content}</p><p className="sg-muted">{summary.space.members.find(m => m.userId === r.createdBy)?.name} · {displayTime(r.createdAt)}</p>{r.createdBy === summary.userId && <div className="sg-actions"><button className="sg-link" disabled={busy} onClick={() => { setEditing(r); setContent(r.content); }}>编辑回复</button><button className="sg-link sg-danger" disabled={busy} onClick={async () => { if (!confirm('删除这条回复？')) return; setBusy(true); try { await spaceRequest(`/replies/${r.id}`, 'DELETE', { version: r.version }); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>删除</button></div>}</div>)}
    {more && <button className="sg-link" onClick={() => void load(page + 1).catch(e => setError(e.message))}>更多回复</button>}
    <form className="sg-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await spaceRequest(`/replies${editing ? `/${editing.id}` : ''}`, editing ? 'PUT' : 'POST', { id, entryId, content, version: editing?.version }); setContent(''); setEditing(undefined); setId(crypto.randomUUID()); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><label>{editing ? '编辑回复' : '写一句回应'}<textarea required maxLength={2000} value={content} onChange={e => setContent(e.target.value)} /></label><div className="sg-actions"><button className="sg-button" disabled={busy}>{editing ? '保存回复' : '回复'}</button>{editing && <button className="sg-link" type="button" onClick={() => { setEditing(undefined); setContent(''); }}>取消</button>}</div></form>
    {error && <p role="alert" className="sg-error">{error}</p>}
  </div>;
}
