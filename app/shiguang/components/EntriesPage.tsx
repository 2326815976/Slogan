'use client';

import { useCallback, useEffect, useState } from 'react';
import SecondaryPageShell from '@/components/shell/SecondaryPageShell';
import { displayTime, spaceRequest } from '@/lib/shiguang/client';
import { anniversaryDays, canManageEntry } from '@/lib/shiguang/validation';
import { KIND_LABELS, SHARED_KINDS, type Entry, type EntryKind, type PageResult } from '@/lib/shiguang/types';
import { useSpace } from './SpaceContext';
import EntryForm from './EntryForm';
import Replies from './Replies';
import MessageMedia from './MessageMedia';

export default function EntriesPage({ kind }: { kind: EntryKind }) {
  const { summary, refresh } = useSpace();
  const [items, setItems] = useState<Entry[]>([]), [more, setMore] = useState(false), [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Entry | null | undefined>(), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [day, setDay] = useState(''), [replies, setReplies] = useState('');
  const load = useCallback(async (n = 0) => {
    const data = await spaceRequest<PageResult<Entry>>(`/${kind}?page=${n}${day ? `&date=${day}` : ''}`);
    setItems(prev => n ? [...prev, ...data.items] : data.items); setMore(data.hasMore); setPage(n); setLoading(false);
  }, [kind, day]);
  useEffect(() => { setLoading(true); void load().catch(e => { setError(e.message); setLoading(false); }); }, [load]);
  const ownToday = summary.moods.find(e => e.createdBy === summary.userId);
  const isAnniversary = kind === 'anniversary';
  return <SecondaryPageShell title={KIND_LABELS[kind]} fallbackHref="/shiguang" contentClassName="sg-content sg-stack">
    <div className="sg-actions justify-between"><p className="sg-muted">{SHARED_KINDS.includes(kind) ? '两个人共同管理，留下最初的记录者。' : '彼此可见，各自管理自己的记录。'}</p><button className="sg-button" disabled={busy} onClick={() => setEditing(kind === 'mood' && ownToday ? ownToday : null)}>{kind === 'mood' && ownToday ? '编辑今日心情' : '新增记录'}</button></div>
    {kind === 'mood' && <label className="sg-actions">按日期查看<input type="date" value={day} onChange={e => setDay(e.target.value)} /><button className="sg-link" onClick={() => setDay('')}>全部历史</button></label>}
    {error && <p role="alert" className="sg-error">{error}</p>}
    {editing !== undefined && <EntryForm key={editing?.id || 'new'} kind={kind} entry={editing || undefined} onCancel={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined); await Promise.all([load(), refresh()]); }} />}
    {loading ? <p role="status">正在翻开记录…</p> : !items.length && <p className="sg-card text-center">这里还没有记录，写下我们的第一笔吧。</p>}
    {items.length > 0 && <div className={isAnniversary ? 'sg-anniversary-grid' : 'sg-stack'}>
      {items.map(entry => {
        const { id, payload, createdBy, createdAt } = entry;
        const body = payload.content || payload.description;
        return <article className="sg-card" key={id}>
          {(kind !== 'whisper' || payload.title) && <h2 className="text-lg font-semibold">{payload.name || payload.title || payload.mood || '一个愿望'}</h2>}
          {isAnniversary && <div className="sg-anniversary-summary">
            <div className="sg-anniversary-count">
              <span>{payload.direction === 'down' ? '距离约定' : '一起走过'}</span>
              <span className="sg-anniversary-value"><strong>{anniversaryDays(payload, summary.today)}</strong>天</span>
            </div>
            <p className="sg-muted">{payload.date} · {payload.direction === 'down' ? '倒数' : '正数'}</p>
          </div>}
          {kind === 'wish' && <span className="sg-muted">{payload.status === 'fulfilled' ? '已实现' : '未实现'}</span>}
          {kind === 'mood' && <p className="sg-muted">{entry.moodDate}</p>}
          {body && <p className="sg-text my-3">{body}</p>}
          {kind === 'whisper' && <MessageMedia {...payload} />}
          <p className="sg-muted sg-entry-byline">{summary.space.members.find(member => member.userId === createdBy)?.name} · {displayTime(createdAt)}</p>
          <div className="sg-actions">
            {canManageEntry(entry, summary.userId, summary.today) && <>
              <button className="sg-link" disabled={busy} onClick={() => setEditing(entry)}>编辑</button>
              <button className="sg-link sg-danger" disabled={busy} onClick={async () => {
                if (!confirm(kind === 'whisper' ? '删除这条絮语及其全部回复？' : '删除这条记录？')) return;
                setBusy(true);
                try {
                  await spaceRequest(`/${kind}/${id}`, 'DELETE', { version: entry.version });
                  await Promise.all([load(), refresh()]);
                } catch (cause) {
                  setError((cause as Error).message);
                } finally {
                  setBusy(false);
                }
              }}>删除</button>
            </>}
            {kind === 'whisper' && <button className="sg-link" onClick={() => setReplies(replies === id ? '' : id)}>{replies === id ? '收起回复' : '查看 / 写回复'}</button>}
          </div>
          {replies === id && <Replies entryId={id} />}
        </article>;
      })}
    </div>}
    {more && <button className="sg-button" onClick={() => void load(page + 1).catch(e => setError(e.message))}>更多记录</button>}
  </SecondaryPageShell>;
}
