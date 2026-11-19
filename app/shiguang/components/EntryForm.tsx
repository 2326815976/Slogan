'use client';

import { useState } from 'react';
import { spaceRequest } from '@/lib/shiguang/client';
import type { Entry, EntryKind, EntryPayload } from '@/lib/shiguang/types';
import MessageAttachments from './MessageAttachments';

export default function EntryForm({ kind, entry, onSaved, onCancel }: { kind: EntryKind; entry?: Entry; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [payload, setPayload] = useState<EntryPayload>(entry?.payload || { direction: 'up', status: 'pending' });
  const [id] = useState(() => entry?.id || crypto.randomUUID());
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState('');
  function field(key: keyof EntryPayload, label: string, type = 'text', maxLength = 100, required = true) {
    return <label>{label}{type === 'textarea' ? <textarea required={required} maxLength={maxLength} value={String(payload[key] || '')} onChange={e => setPayload(p => ({ ...p, [key]: e.target.value }))} /> : <input type={type} required={required} maxLength={maxLength} value={String(payload[key] || '')} onChange={e => setPayload(p => ({ ...p, [key]: e.target.value }))} />}</label>;
  }
  return <form className="sg-form sg-card" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await spaceRequest(`/${kind}${entry ? `/${entry.id}` : ''}`, entry ? 'PUT' : 'POST', { id, payload, version: entry?.version }); await onSaved(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
    {kind === 'anniversary' && <>{field('name', '名称')}{field('date', '纪念日期', 'date')}<label>类型<select value={payload.direction} onChange={e => setPayload(p => ({ ...p, direction: e.target.value as 'up' | 'down' }))}><option value="up">正数 · 已走过的日子</option><option value="down">倒数 · 期待的日子</option></select></label></>}
    {kind === 'wish' && <>{field('content', '愿望', 'textarea', 5000)}<label>状态<select value={payload.status} onChange={e => setPayload(p => ({ ...p, status: e.target.value as 'pending' | 'fulfilled' }))}><option value="pending">未实现</option><option value="fulfilled">已实现</option></select></label></>}
    {kind === 'promise' && <>{field('title', '标题')}{field('content', '内容', 'textarea', 10000)}</>}
    {kind === 'whisper' && <>
      <label>正文<textarea placeholder="写下想说的话…" maxLength={10000} value={payload.content || ''} onChange={event => setPayload(previous => ({ ...previous, content: event.target.value }))} /></label>
      {field('title', '标题（选填）', 'text', 100, false)}
      <MessageAttachments value={payload} disabled={busy} onBusy={setUploading} onChange={(key, value) => setPayload(previous => ({ ...previous, [key]: value, type: (key === 'audio' ? value : previous.audio) ? 'audio' : 'text' }))} />
    </>}
    {kind === 'mood' && <>{field('mood', '今天的心情', 'text', 30)}{field('description', '描述（可选）', 'textarea', 1000, false)}<p className="sg-muted">每天一条，以北京时间为准，只能修改当天的记录。</p></>}
    {error && <p className="sg-error" role="alert">{error}</p>}
    <div className="sg-actions"><button className="sg-button" disabled={busy || uploading}>{busy || uploading ? '处理中…' : '保存'}</button><button type="button" disabled={busy || uploading} className="sg-link" onClick={onCancel}>取消</button></div>
  </form>;
}
