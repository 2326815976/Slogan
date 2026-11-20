'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react';
import SecondaryPageShell from '@/components/shell/SecondaryPageShell';
import { displayMinute, spaceRequest } from '@/lib/shiguang/client';
import { cleanTopic } from '@/lib/shiguang/topics';
import { anniversaryDays, canManageEntry } from '@/lib/shiguang/validation';
import { KIND_LABELS, type Entry, type EntryKind, type PageResult } from '@/lib/shiguang/types';
import { useSpace } from './SpaceContext';
import EntryForm from './EntryForm';
import WhisperComposer from './WhisperComposer';
import WhisperPost from './WhisperPost';

const actionLabels: Record<EntryKind, string> = {
  anniversary: '新增纪念日',
  wish: '写下愿望',
  promise: '写下约定',
  whisper: '写絮语',
  mood: '记录今日心情',
  collection: '新增拾物',
};

export default function EntriesPage({ kind }: { kind: EntryKind }) {
  const { summary, refresh } = useSpace();
  const isWhisper = kind === 'whisper';
  const [items, setItems] = useState<Entry[]>([]), [more, setMore] = useState(false), [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Entry | null | undefined>(), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [day, setDay] = useState(''), [replies, setReplies] = useState('');
  const [topic, setTopic] = useState(''), [keyword, setKeyword] = useState(''), [searchDraft, setSearchDraft] = useState(''), [author, setAuthor] = useState('');
  const load = useCallback(async (n = 0) => {
    const query = new URLSearchParams({ page: String(n) });
    if (day) query.set('date', day);
    if (isWhisper && topic) query.set('topic', topic);
    if (isWhisper && keyword) query.set('q', keyword);
    if (isWhisper && author) query.set('author', author);
    const data = await spaceRequest<PageResult<Entry>>(`/${kind}?${query.toString()}`);
    setItems(prev => n ? [...prev, ...data.items] : data.items); setMore(data.hasMore); setPage(n); setLoading(false);
  }, [author, day, isWhisper, keyword, kind, topic]);
  useEffect(() => { setLoading(true); void load().catch(e => { setError(e.message); setLoading(false); }); }, [load]);
  const ownToday = summary.moods.find(e => e.createdBy === summary.userId);
  const isAnniversary = kind === 'anniversary';
  const actionLabel = kind === 'mood' && ownToday ? '编辑今日心情' : actionLabels[kind];
  const hasWhisperFilters = Boolean(topic || keyword || day || author);
  function applyWhisperSearch() {
    const raw = searchDraft.trim();
    if (raw.startsWith('#')) {
      const nextTopic = cleanTopic(raw);
      setTopic(nextTopic);
      setKeyword('');
      setSearchDraft(nextTopic ? `#${nextTopic}` : '');
      return;
    }
    setTopic('');
    setKeyword(raw);
  }
  useEffect(() => {
    if (!isWhisper) return;
    const timer = window.setTimeout(applyWhisperSearch, 300);
    return () => window.clearTimeout(timer);
  }, [isWhisper, searchDraft]);
  function resetWhisperFilters() {
    setTopic('');
    setKeyword('');
    setSearchDraft('');
    setDay('');
    setAuthor('');
  }
  async function removeEntry(entry: Entry) {
    if (!confirm(entry.kind === 'whisper' ? '删除这条絮语及其全部回复？' : '删除这条记录？')) return;
    setBusy(true);
    setError('');
    try {
      await spaceRequest(`/${entry.kind}/${entry.id}`, 'DELETE', { version: entry.version });
      if (replies === entry.id) setReplies('');
      await Promise.all([load(), refresh()]);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggleWish(entry: Entry) {
    if (busy) return;
    const status = entry.payload.status === 'fulfilled' ? 'pending' : 'fulfilled';
    setBusy(true);
    setError('');
    try {
      await spaceRequest(`/wish/${entry.id}`, 'PUT', { version: entry.version, payload: { ...entry.payload, status } });
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <SecondaryPageShell title={KIND_LABELS[kind]} fallbackHref="/shiguang"
    contentClassName={`sg-content sg-stack entries-content${isWhisper ? ' entries-content--whisper' : ''}`}>
    {isWhisper
      ? <section className="whisper-filter-row" aria-label="絮语筛选">
        <form className="whisper-filter-search" onSubmit={event => { event.preventDefault(); applyWhisperSearch(); }}>
          <Search aria-hidden="true" />
          <input value={searchDraft} maxLength={100} placeholder="搜索内容或 #话题" aria-label="搜索内容或话题"
            onChange={event => setSearchDraft(event.target.value)} />
        </form>
        <label className={`whisper-filter-option${day ? ' whisper-filter-option--active' : ''}`} title={day || '按时间筛选'}>
          <CalendarDays aria-hidden="true" />
          <input className="whisper-filter-option__native" type="date" value={day}
            aria-label="按时间筛选絮语" onChange={event => setDay(event.target.value)} />
        </label>
        <label className={`whisper-filter-option${author ? ' whisper-filter-option--active' : ''}`} title="按发布人筛选">
          <UserRound aria-hidden="true" />
          <select className="whisper-filter-option__native" value={author}
            aria-label="按发布人筛选絮语" onChange={event => setAuthor(event.target.value)}>
            <option value="">全部发布人</option>
            {summary.space.members.map(member => <option key={member.userId} value={member.userId}>{member.name}</option>)}
          </select>
        </label>
        {hasWhisperFilters && <button type="button" className="whisper-filter-reset" aria-label="重置筛选" onClick={resetWhisperFilters}>
          <X aria-hidden="true" />
        </button>}
      </section>
      : <div className="entries-toolbar">
        {kind === 'mood' && <div className="entries-date-filter">
          <CalendarDays aria-hidden="true" />
          <span className="entries-date-label">{day || '按日期筛选'}</span>
          <ChevronDown aria-hidden="true" />
          <input type="date" aria-label="按日期查看心情" value={day} onChange={e => setDay(e.target.value)} />
          {day && <button type="button" className="entries-filter-reset" onClick={() => setDay('')}>全部</button>}
        </div>}
        <button type="button" className="entries-add" disabled={busy} onClick={() => setEditing(kind === 'mood' && ownToday ? ownToday : null)}>
          <Plus aria-hidden="true" />
          {actionLabel}
        </button>
      </div>}
    {error && <p role="alert" className="sg-error">{error}</p>}
    {editing !== undefined && <EntryForm key={editing?.id || 'new'} kind={kind} entry={editing || undefined} onCancel={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined); await Promise.all([load(), refresh()]); }} />}
    {loading ? <p role="status">正在加载…</p> : !items.length && <p className="entries-empty">{isWhisper && hasWhisperFilters ? '没有符合筛选条件的絮语。' : '这里还没有记录。'}</p>}
    {items.length > 0 && <div className={isAnniversary ? 'sg-anniversary-grid' : `entries-list${isWhisper ? ' entries-list--whisper' : ''}`}>
      {items.map(entry => {
        const { id, payload, createdBy, createdAt } = entry;
        const member = summary.space.members.find(candidate => candidate.userId === createdBy);
        const author = member?.name || '空间成员';
        const canManage = canManageEntry(entry, summary.userId, summary.today);
        if (kind === 'whisper') {
          return <WhisperPost key={id} entry={entry}
            authorName={author}
            authorAvatar={member?.avatar || ''}
            canManage={canManage}
            busy={busy}
            expanded={replies === id}
            onToggleReplies={() => setReplies(replies === id ? '' : id)}
            onTopicClick={topicValue => { setSearchDraft(`#${topicValue}`); setTopic(topicValue); setKeyword(''); }}
            onEdit={() => setEditing(entry)}
            onDelete={() => removeEntry(entry)} />;
        }
        const body = payload.content || payload.description;
        const showBody = Boolean(body);
        const fulfilled = payload.status === 'fulfilled';
        const days = isAnniversary ? anniversaryDays(payload, summary.today) : 0;
        const countLabel = payload.direction === 'down' ? (days < 0 ? '已过' : '距离约定') : (days < 0 ? '距离这一天' : '一起走过');
        if (kind === 'wish') {
          return <article className={`sg-list-item sg-wish-row${fulfilled ? ' sg-wish-row--done' : ''}`} key={id}>
            <button type="button" className="sg-wish-check" aria-pressed={fulfilled} disabled={busy || !canManage}
              onClick={() => void toggleWish(entry)}
              aria-label={fulfilled ? '标记为未实现' : '标记为已实现'}>
              {fulfilled && <Check aria-hidden="true" />}
            </button>
            <div className="sg-wish-copy">
              <h2 className="sg-wish-title">{body || '一个愿望'}</h2>
              <p className="sg-wish-meta">{author} · {displayMinute(createdAt)}</p>
            </div>
            {canManage && <div className="sg-wish-actions">
              <button type="button" disabled={busy} aria-label="编辑愿望" title="编辑" onClick={() => setEditing(entry)}><Pencil aria-hidden="true" /></button>
              <button type="button" className="sg-wish-action--danger" disabled={busy} aria-label="删除愿望" title="删除" onClick={() => void removeEntry(entry)}><Trash2 aria-hidden="true" /></button>
            </div>}
          </article>;
        }
        return <article className={`sg-list-item${isAnniversary ? ' sg-anniversary-item' : ''}`} key={id}>
          <h2 className="sg-list-title">{payload.name || payload.title || payload.mood || '一条记录'}</h2>
          {isAnniversary && <div className="sg-anniversary-summary">
            <div className="sg-anniversary-count">
              <span className="sg-anniversary-caption">{countLabel}</span>
              <span className="sg-anniversary-value"><strong>{Math.abs(days)}</strong><span>天</span></span>
            </div>
            <span className="sg-anniversary-date"><CalendarDays aria-hidden="true" />{payload.date}</span>
          </div>}
          {showBody && <p className="sg-text">{body}</p>}
          <div className="sg-list-footer">
            <p className="sg-list-meta">{author} · {(kind === 'mood' && entry.moodDate) || displayMinute(createdAt)}</p>
            {canManage && <div className="sg-list-actions">
              <button className="sg-link sg-list-action" disabled={busy} onClick={() => setEditing(entry)}>编辑</button>
              <button className="sg-link sg-list-action sg-danger" disabled={busy} onClick={() => void removeEntry(entry)}>删除</button>
            </div>}
          </div>
        </article>;
      })}
    </div>}
    {more && <button className="entries-load-more" onClick={() => void load(page + 1).catch(e => setError(e.message))}>加载更多</button>}
    {isWhisper && <WhisperComposer disabled={busy} onPublished={async () => {
      await Promise.all([load(), refresh()]);
    }} />}
  </SecondaryPageShell>;
}
