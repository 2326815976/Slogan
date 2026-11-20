'use client';

import { useState } from 'react';
import { spaceRequest } from '@/lib/shiguang/client';
import type { Entry, EntryKind, EntryPayload } from '@/lib/shiguang/types';
import { extractTopics, firstTopic } from '@/lib/shiguang/topics';
import MessageAttachments from './MessageAttachments';
import OptionalSection from './OptionalSection';

export default function EntryForm({ kind, entry, onSaved, onCancel }: { kind: EntryKind; entry?: Entry; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [payload, setPayload] = useState<EntryPayload>(() => {
    const initial = entry?.payload || { direction: 'up', status: 'pending' };
    if (kind !== 'whisper') return initial;
    const content = initial.content || initial.title || '';
    return { ...initial, content, title: firstTopic(content) };
  });
  const [id] = useState(() => entry?.id || crypto.randomUUID());
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState('');
  const contentLength = String(payload.content || '').length;
  const attachmentCount = [payload.image, payload.video, payload.audio].filter(Boolean).length;
  const topics = extractTopics(payload.content);
  function field(key: keyof EntryPayload, label: string, type = 'text', maxLength = 100, required = true) {
    return <label>{label}{type === 'textarea' ? <textarea required={required} maxLength={maxLength} value={String(payload[key] || '')} onChange={e => setPayload(p => ({ ...p, [key]: e.target.value }))} /> : <input type={type} required={required} maxLength={maxLength} value={String(payload[key] || '')} onChange={e => setPayload(p => ({ ...p, [key]: e.target.value }))} />}</label>;
  }
  return <form className={`sg-form sg-card${kind === 'whisper' ? ' sg-form--whisper' : ''}`} onSubmit={async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const nextPayload = kind === 'whisper' ? { ...payload, title: firstTopic(payload.content) } : payload;
      await spaceRequest(`/${kind}${entry ? `/${entry.id}` : ''}`, entry ? 'PUT' : 'POST', { id, payload: nextPayload, version: entry?.version });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }}>
    {kind === 'anniversary' && <>{field('name', '名称')}{field('date', '纪念日期', 'date')}<label>类型<select value={payload.direction} onChange={e => setPayload(p => ({ ...p, direction: e.target.value as 'up' | 'down' }))}><option value="up">正数 · 已走过的日子</option><option value="down">倒数 · 期待的日子</option></select></label></>}
    {kind === 'wish' && <>{field('content', '愿望', 'textarea', 5000)}<label>状态<select value={payload.status} onChange={e => setPayload(p => ({ ...p, status: e.target.value as 'pending' | 'fulfilled' }))}><option value="pending">未实现</option><option value="fulfilled">已实现</option></select></label></>}
    {kind === 'promise' && <>{field('title', '标题')}{field('content', '内容', 'textarea', 10000)}</>}
    {kind === 'whisper' && <>
      <label className="sg-whisper-editor">
        <span className="sg-whisper-editor__head"><span>正文</span><small>{contentLength.toLocaleString('zh-CN')} / 10,000</small></span>
        <textarea placeholder="写下此刻想说的话…" maxLength={10000} value={payload.content || ''} onChange={event => setPayload(previous => ({ ...previous, content: event.target.value }))} />
        {topics.length > 0 && <span className="sg-whisper-topic-preview">
          <span>话题</span>
          {topics.map(topic => <strong key={topic}>#{topic}</strong>)}
        </span>}
      </label>
      <OptionalSection
        key={`whisper-${id}`}
        label="附件"
        status={attachmentCount ? `已添加 ${attachmentCount} 项` : '选填'}
        filled={attachmentCount > 0}
        variant="attachments"
      >
        <MessageAttachments value={payload} disabled={busy} onBusy={setUploading} onChange={(key, value) => setPayload(previous => ({ ...previous, [key]: value, type: (key === 'audio' ? value : previous.audio) ? 'audio' : 'text' }))} />
      </OptionalSection>
    </>}
    {kind === 'mood' && <>
      {field('mood', '今天的心情', 'text', 30)}
      <OptionalSection key={`mood-${id}`} label="描述（选填）" filled={Boolean(payload.description)}>
        {field('description', '描述', 'textarea', 1000, false)}
      </OptionalSection>
      <p className="sg-muted">每天一条，以北京时间为准，只能修改当天的记录。</p>
    </>}
    {error && <p className="sg-error" role="alert">{error}</p>}
    {kind === 'whisper'
      ? <div className="sg-actions sg-whisper-actions">
        <button type="button" disabled={busy || uploading} className="sg-link sg-whisper-cancel" onClick={onCancel}>取消</button>
        <button className="sg-button sg-whisper-save" disabled={busy || uploading}>{busy || uploading ? '处理中…' : '保存'}</button>
      </div>
      : <div className="sg-actions"><button className="sg-button" disabled={busy || uploading}>{busy || uploading ? '处理中…' : '保存'}</button><button type="button" disabled={busy || uploading} className="sg-link" onClick={onCancel}>取消</button></div>}
  </form>;
}
