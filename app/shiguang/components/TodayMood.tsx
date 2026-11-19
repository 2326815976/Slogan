'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { spaceRequest, SpaceRequestError } from '@/lib/shiguang/client';
import { useSpace } from './SpaceContext';

const quickMoods = ['开心', '平静', '难过'];

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
    if (!value) { setError('请输入心情名称'); return; }
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

  return <>
    <button type="button" className="sg-mood sg-mood-trigger" aria-haspopup="dialog" onClick={open}>
      {entry?.payload.mood || '记录心情'}
    </button>
    <dialog ref={dialog} className="sg-card sg-mood-dialog" aria-labelledby="sg-mood-title" onCancel={event => { if (saving) event.preventDefault(); }}>
      <div className="sg-mood-dialog-heading">
        <h2 id="sg-mood-title">今天的心情</h2>
        <button type="button" className="sg-link" disabled={saving} onClick={() => dialog.current?.close()}>关闭</button>
      </div>
      <div className="sg-mood-options">
        {quickMoods.map(mood => <button key={mood} type="button" className="sg-link" disabled={saving}
          aria-pressed={entry?.payload.mood === mood} onClick={() => void save(mood, entry?.payload.description ?? '')}>{mood}</button>)}
      </div>
      {expanded && <form className="sg-form sg-mood-form" onSubmit={event => { event.preventDefault(); void save(name, description); }}>
        <label>心情名称<input required maxLength={30} value={name} disabled={saving} onChange={event => setName(event.target.value)} /></label>
        <label>描述（可选）<textarea maxLength={1000} value={description} disabled={saving} onChange={event => setDescription(event.target.value)} /></label>
        <button className="sg-button" disabled={saving}>保存</button>
      </form>}
      {saving && <p className="sg-muted" role="status">正在保存…</p>}
      {error && <p className="sg-error" role="alert">{error}</p>}
      <div className="sg-mood-dialog-footer">
        <button type="button" className="sg-link" aria-expanded={expanded} disabled={saving} onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起自定义' : '展开自定义'}
        </button>
        {saving ? <button type="button" className="sg-link" disabled>更多</button> :
          <Link href="/shiguang/mood" className="sg-link" aria-label="更多心情记录" onClick={() => dialog.current?.close()}>更多</Link>}
      </div>
    </dialog>
  </>;
}
