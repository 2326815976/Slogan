'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { spaceRequest, SpaceRequestError } from '@/lib/shiguang/client';
import { useSpace } from './SpaceContext';

const quickMoods = [
  { name: '开心', icon: '😄', tone: 'happy' },
  { name: '平静', icon: '😌', tone: 'calm' },
  { name: '难过', icon: '😢', tone: 'sad' },
];

export default function TodayMood() {
  const { summary, refresh } = useSpace();
  const entry = summary.moods.find(mood => mood.createdBy === summary.userId);
  const dialog = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function open() {
    setExpanded(false);
    setName(entry?.payload.mood ?? '');
    setDescription(entry?.payload.description ?? '');
    setError('');
    dialog.current?.showModal();
  }

  async function save(mood: string, detail: string) {
    if (saving) return;
    const value = mood.trim();
    if (!value) { setError('请输入心情'); return; }
    const payload = { mood: value, description: detail.trim() };
    setSaving(true);
    setError('');
    try {
      if (entry) await spaceRequest(`/mood/${entry.id}`, 'PUT', { version: entry.version, payload });
      else await spaceRequest('/mood', 'POST', { id: crypto.randomUUID(), payload });
      await refresh();
      dialog.current?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试');
      if (cause instanceof SpaceRequestError && cause.status === 409) await refresh();
    } finally {
      setSaving(false);
    }
  }

  const historyLabel = <>心情记录<span className="sg-mood-arrow" aria-hidden="true" /></>;

  return <>
    <button type="button" className="sg-mood sg-mood-trigger" aria-haspopup="dialog" onClick={open}>
      {entry?.payload.mood || '记录心情'}
    </button>
    <dialog ref={dialog} className="sg-card sg-mood-dialog" aria-labelledby="sg-mood-title" onCancel={event => { if (saving) event.preventDefault(); }}>
      <div className="sg-mood-dialog-heading">
        <h2 id="sg-mood-title">今天的心情</h2>
        <button type="button" className="sg-mood-close" aria-label="关闭" disabled={saving} onClick={() => dialog.current?.close()}>×</button>
      </div>
      <div className="sg-mood-options">
        {quickMoods.map(mood => <button key={mood.name} type="button" className={`sg-mood-option sg-mood-option--${mood.tone}`} disabled={saving}
          aria-pressed={entry?.payload.mood === mood.name} onClick={() => void save(mood.name, entry?.payload.description ?? '')}>
          <span className="sg-mood-option-icon" aria-hidden="true">{mood.icon}</span>
          {mood.name}
        </button>)}
      </div>
      <div className="sg-mood-dialog-footer">
        <button type="button" className="sg-mood-secondary" aria-expanded={expanded} disabled={saving} onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起自定义' : '自定义心情'}
          <span className="sg-mood-arrow" aria-hidden="true" />
        </button>
        {saving ? <button type="button" className="sg-mood-secondary" disabled>{historyLabel}</button> :
          <Link href="/shiguang/mood" className="sg-mood-secondary" onClick={() => dialog.current?.close()}>{historyLabel}</Link>}
      </div>
      {expanded && <form className="sg-form sg-mood-form" onSubmit={event => { event.preventDefault(); void save(name, description); }}>
        <label>心情<input required maxLength={30} value={name} disabled={saving} onChange={event => setName(event.target.value)} /></label>
        <label>感受（选填）<textarea maxLength={1000} value={description} disabled={saving} onChange={event => setDescription(event.target.value)} /></label>
        <button className="sg-button" disabled={saving}>保存心情</button>
      </form>}
      {saving && <p className="sg-muted" role="status">正在保存…</p>}
      {error && <p className="sg-error" role="alert">{error}</p>}
    </dialog>
  </>;
}
