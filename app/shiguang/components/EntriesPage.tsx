'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CalendarDays, Check, ChevronDown, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react';
import SecondaryPageShell from '@/components/shell/SecondaryPageShell';
import { displayMinute, spaceRequest } from '@/lib/shiguang/client';
import { canManageEntry } from '@/lib/shiguang/validation';
import { KIND_LABELS, type Entry, type EntryKind, type PageResult } from '@/lib/shiguang/types';
import { useSpace } from './SpaceContext';
import AnniversaryCardContent from './AnniversaryCardContent';
import EntryForm from './EntryForm';
import EntryTextPreview, { EntryTextDialog, PromiseAuthorAvatar, type EntryText } from './EntryTextPreview';
import ShiguangLoading from './ShiguangLoading';
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

const CARD_SORT_LONG_PRESS_MS = 360;
const CARD_SORT_MOVE_TOLERANCE = 8;

type CardSortDragState = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  targetId: string;
  active: boolean;
  timer: number | null;
  element: HTMLElement;
};

function setCardSortScrollLock(locked: boolean) {
  const scrollArea = document.querySelector<HTMLElement>('.entries-content.sg-content');
  if (!scrollArea) return;
  scrollArea.style.overflowY = locked ? 'hidden' : '';
  scrollArea.style.touchAction = locked ? 'none' : '';
}

function reorderEntryItems(items: Entry[], sourceId: string, targetId: string) {
  const sourceIndex = items.findIndex(item => item.id === sourceId);
  const targetIndex = items.findIndex(item => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return null;
  const next = items.slice();
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

export default function EntriesPage({ kind }: { kind: EntryKind }) {
  const { summary, refresh } = useSpace();
  const isWhisper = kind === 'whisper';
  const isPromise = kind === 'promise';
  const [readingPromise, setReadingPromise] = useState<EntryText | null>(null);
  const [items, setItems] = useState<Entry[]>([]), [more, setMore] = useState(false), [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Entry | null | undefined>(), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [day, setDay] = useState(''), [replies, setReplies] = useState('');
  const [updatingReplies, setUpdatingReplies] = useState(false);
  const [keyword, setKeyword] = useState(''), [searchDraft, setSearchDraft] = useState(''), [author, setAuthor] = useState('');
  const cardSortDragRef = useRef<CardSortDragState | null>(null);
  const suppressCardClickUntilRef = useRef(0);
  const [sortDraggingId, setSortDraggingId] = useState('');
  const [sortDragOverId, setSortDragOverId] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const activeEntriesRequest = useRef<object | null>(null);
  const loadMoreButton = useRef<HTMLButtonElement>(null);
  const updateReplyCount = useCallback((entryId: string, replyCount: number) => {
    setItems(previous => previous.map(entry => (
      entry.id === entryId && entry.replyCount !== replyCount ? { ...entry, replyCount } : entry
    )));
  }, []);
  const load = useCallback(async (n = 0) => {
    if (n && activeEntriesRequest.current) return;
    const request = {};
    activeEntriesRequest.current = request;
    setLoadingMore(n > 0);
    const query = new URLSearchParams({ page: String(n) });
    if (isWhisper) query.set('pageSize', '10');
    if (day) query.set('date', day);
    if (isWhisper && keyword) query.set('q', keyword);
    if (isWhisper && author) query.set('author', author);
    try {
      const data = await spaceRequest<PageResult<Entry>>(`/${kind}?${query.toString()}`);
      if (activeEntriesRequest.current !== request) return;
      setItems(previous => {
        if (!n) return data.items;
        const existingIds = new Set(previous.map(entry => entry.id));
        return previous.concat(data.items.filter(entry => !existingIds.has(entry.id)));
      });
      setMore(data.hasMore);
      setPage(n);
    } catch (error) {
      if (activeEntriesRequest.current === request) throw error;
    } finally {
      if (activeEntriesRequest.current === request) {
        activeEntriesRequest.current = null;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [author, day, isWhisper, keyword, kind]);
  useEffect(() => {
    setLoading(true);
    if (isWhisper) {
      setItems([]);
      setMore(false);
      setPage(0);
      setError('');
    }
    void load().catch(error => setError(error.message));
    return () => { activeEntriesRequest.current = null; };
  }, [isWhisper, load]);
  const loadMore = useCallback(() => {
    if (!more || loading || loadingMore || busy || activeEntriesRequest.current) return;
    setError('');
    void load(page + 1).catch(error => setError(error.message));
  }, [busy, load, loading, loadingMore, more, page]);
  useEffect(() => {
    const button = loadMoreButton.current;
    if (!isWhisper || !button || loading || loadingMore || busy || error || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { root: button.closest('.entries-content'), rootMargin: '0px 0px 160px 0px' });
    observer.observe(button);
    return () => observer.disconnect();
  }, [busy, error, isWhisper, loadMore, loading, loadingMore]);
  const ownToday = summary.moods.find(e => e.createdBy === summary.userId);
  const isAnniversary = kind === 'anniversary';
  const isWish = kind === 'wish';
  const canQuickAdd = isAnniversary || isWish || isPromise || kind === 'mood';
  const actionLabel = kind === 'mood' && ownToday ? '编辑今日心情' : actionLabels[kind];
  const wishPending = kind === 'wish' ? items.filter(entry => entry.payload.status !== 'fulfilled') : [];
  const wishCompleted = kind === 'wish' ? items.filter(entry => entry.payload.status === 'fulfilled') : [];
  const hasWhisperFilters = Boolean(keyword || day || author);
  const selectedAuthorName = summary.space.members.find(member => member.userId === author)?.name || '';
  function applyWhisperSearch() {
    const raw = searchDraft.trim();
    setKeyword(raw);
  }
  useEffect(() => {
    if (!isWhisper) return;
    const timer = window.setTimeout(applyWhisperSearch, 300);
    return () => window.clearTimeout(timer);
  }, [isWhisper, searchDraft]);
  function resetWhisperFilters() {
    setKeyword('');
    setSearchDraft('');
    setDay('');
    setAuthor('');
  }
  useEffect(() => () => {
    const drag = cardSortDragRef.current;
    if (drag?.timer) window.clearTimeout(drag.timer);
    cardSortDragRef.current = null;
    setCardSortScrollLock(false);
  }, []);

  function handleCardSortPointerDown(event: ReactPointerEvent<HTMLElement>, entry: Entry) {
    if (busy || event.button !== 0) return;
    const interactive = (event.target as Element).closest('button, a, input, textarea, select');
    if (interactive && interactive !== event.currentTarget) return;
    const previous = cardSortDragRef.current;
    if (previous?.timer) window.clearTimeout(previous.timer);

    const drag: CardSortDragState = {
      id: entry.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      targetId: entry.id,
      active: false,
      timer: null,
      element: event.currentTarget,
    };
    cardSortDragRef.current = drag;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    drag.timer = window.setTimeout(() => {
      const current = cardSortDragRef.current;
      if (!current || current.pointerId !== drag.pointerId || current.active) return;
      current.active = true;
      current.timer = null;
      suppressCardClickUntilRef.current = Date.now() + 1200;
      setSortDraggingId(current.id);
      setSortDragOverId(current.id);
      setCardSortScrollLock(true);
      navigator.vibrate?.(12);
    }, CARD_SORT_LONG_PRESS_MS);
  }

  function handleCardSortPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = cardSortDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= CARD_SORT_MOVE_TOLERANCE) return;
      if (drag.timer) window.clearTimeout(drag.timer);
      cardSortDragRef.current = null;
      try { drag.element.releasePointerCapture(drag.pointerId); } catch {}
      return;
    }

    event.preventDefault();
    const hovered = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-entry-id]') as HTMLElement | null;
    const targetId = hovered?.dataset.entryId;
    if (!targetId || targetId === drag.targetId) return;
    const sourceEntry = items.find(entry => entry.id === drag.id);
    const targetEntry = items.find(entry => entry.id === targetId);
    if (!sourceEntry || !targetEntry) return;
    if (isWish && sourceEntry.payload.status !== targetEntry.payload.status) {
      if (drag.targetId !== drag.id) {
        drag.targetId = drag.id;
        setSortDragOverId(drag.id);
      }
      return;
    }
    drag.targetId = targetId;
    setSortDragOverId(targetId);
  }

  function finishCardSortDrag(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const drag = cardSortDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.timer) window.clearTimeout(drag.timer);
    cardSortDragRef.current = null;
    if (!drag.active) {
      try { drag.element.releasePointerCapture(drag.pointerId); } catch {}
      return;
    }

    event.preventDefault();
    suppressCardClickUntilRef.current = Date.now() + 700;
    setSortDraggingId('');
    setSortDragOverId('');
    setCardSortScrollLock(false);
    try { drag.element.releasePointerCapture(drag.pointerId); } catch {}
    if (cancelled || drag.targetId === drag.id) return;

    const next = reorderEntryItems(items, drag.id, drag.targetId);
    if (!next) return;
    setItems(next);
    void saveEntryOrder(next);
  }

  async function saveEntryOrder(visibleOrder: Entry[]) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const visibleIds = new Set(visibleOrder.map(entry => entry.id));
      let orderedEntries: { entry: Entry; order: number }[] = [];
      if (isAnniversary) {
        orderedEntries = [
          ...visibleOrder,
          ...summary.anniversaries.filter(entry => !visibleIds.has(entry.id)),
        ].map((entry, order) => ({ entry, order }));
      } else {
        const allWishEntries: Entry[] = [];
        for (let pageIndex = 0; ; pageIndex += 1) {
          const data = await spaceRequest<PageResult<Entry>>(`/wish?page=${pageIndex}`);
          allWishEntries.push(...data.items);
          if (!data.hasMore) break;
        }
        const fullWishOrder = [
          ...visibleOrder,
          ...allWishEntries.filter(entry => !visibleIds.has(entry.id)),
        ];
        orderedEntries = (['pending', 'fulfilled'] as const).flatMap(status =>
          fullWishOrder
            .filter(entry => (entry.payload.status === 'fulfilled' ? 'fulfilled' : 'pending') === status)
            .map((entry, order) => ({ entry, order })));
      }
      const tasks: { id: string; promise: Promise<Entry> }[] = [];
      orderedEntries.forEach(({ entry, order }) => {
        if (Number(entry.payload.sortOrder ?? 0) === order) return;
        tasks.push({
          id: entry.id,
          promise: spaceRequest<Entry>(`/${entry.kind}/${entry.id}`, 'PUT', {
            version: entry.version,
            payload: { ...entry.payload, sortOrder: order },
          }),
        });
      });
      if (!tasks.length) {
        await refresh();
        return;
      }

      const results = await Promise.allSettled(tasks.map(task => task.promise));
      const failed = results.find(result => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;

      const updated = new Map<string, Entry>();
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') updated.set(tasks[index].id, result.value);
      });
      setItems(current => current
        .map(entry => updated.get(entry.id) ? { ...entry, ...updated.get(entry.id)! } : entry)
        .sort((left, right) => {
          if (isWish) {
            const statusOrder = Number(left.payload.status === 'fulfilled') - Number(right.payload.status === 'fulfilled');
            if (statusOrder) return statusOrder;
          }
          return Number(left.payload.sortOrder ?? 0) - Number(right.payload.sortOrder ?? 0);
        }));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '排序保存失败，请重试');
      await Promise.allSettled([load(), refresh()]);
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(entry: Entry) {
    if (busy) return;
    const message = entry.kind === 'anniversary'
      ? '删除这个纪念日后不可恢复，确认删除？'
      : entry.kind === 'whisper'
        ? '删除这条絮语及其全部回复？'
        : '删除这条记录？';
    if (!confirm(message)) return;
    setBusy(true);
    setError('');
    try {
      await spaceRequest(`/${entry.kind}/${entry.id}`, 'DELETE', { version: entry.version });
      if (replies === entry.id) setReplies('');
      if (editing?.id === entry.id) setEditing(undefined);
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
  function renderWishEntry(entry: Entry) {
    const { id, payload, createdBy, createdAt } = entry;
    const member = summary.space.members.find(candidate => candidate.userId === createdBy);
    const author = member?.name || '空间成员';
    const entryTime = displayMinute(createdAt);
    const canManage = canManageEntry(entry, summary.userId, summary.today);
    const fulfilled = payload.status === 'fulfilled';
    return <article
      className={`sg-wish-entry${sortDraggingId === id ? ' sg-wish-entry--dragging' : ''}${sortDragOverId === id && sortDraggingId !== id ? ' sg-wish-entry--drag-over' : ''}`}
      data-entry-id={id}
      key={id}>
      <div className={`sg-list-item sg-wish-row${fulfilled ? ' sg-wish-row--done' : ''}`}
        onPointerDown={event => handleCardSortPointerDown(event, entry)}
        onContextMenu={event => event.preventDefault()}>
        <div className="sg-wish-body">
          <h2 className="sg-wish-title">{payload.content || '一个愿望'}</h2>
          <button type="button" className="sg-wish-check" aria-pressed={fulfilled} disabled={busy || !canManage}
            onClick={() => void toggleWish(entry)}
            aria-label={fulfilled ? '标记为未实现' : '标记为已实现'}>
            {fulfilled && <Check aria-hidden="true" />}
          </button>
        </div>
        <footer className="sg-wish-footer">
          <div className="entries-post-avatar" aria-hidden="true">
            <span>{author.slice(0, 1)}</span>
            {member?.avatar && <img src={member.avatar} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
          </div>
          <div className="entries-post-identity">
            <strong>{author}</strong>
            {entryTime && <time dateTime={createdAt}>{entryTime}</time>}
          </div>
          {canManage && <div className="sg-wish-actions">
            <button type="button" disabled={busy} aria-label="编辑愿望" title="编辑" onClick={() => setEditing(entry)}><Pencil aria-hidden="true" /></button>
            <button type="button" className="sg-wish-action--danger" disabled={busy} aria-label="删除愿望" title="删除" onClick={() => void removeEntry(entry)}><Trash2 aria-hidden="true" /></button>
          </div>}
        </footer>
      </div>
    </article>;
  }
  return <SecondaryPageShell title={KIND_LABELS[kind]} fallbackHref="/shiguang"
    className={isWhisper ? 'entries-whisper-shell' : undefined}
    contentClassName={`sg-content sg-stack entries-content${isWhisper ? ' entries-content--whisper' : ''}${canQuickAdd ? ' entries-content--fab' : ''}`}>
    {isWhisper
      ? <section className={`whisper-filter-row${day && author ? ' whisper-filter-row--expanded' : ''}`} aria-label="絮语筛选">
        <form className="whisper-filter-search" onSubmit={event => { event.preventDefault(); applyWhisperSearch(); }}>
          <Search aria-hidden="true" />
          <input value={searchDraft} maxLength={100} placeholder="搜索絮语" aria-label="全局搜索絮语"
            onChange={event => setSearchDraft(event.target.value)} />
        </form>
        <label className={`whisper-filter-option${day ? ' whisper-filter-option--active' : ''}`} title={day || '按时间筛选'}>
          <CalendarDays aria-hidden="true" />
          {day && <span className="whisper-filter-option__label">{day}</span>}
          <input className="whisper-filter-option__native" type="date" value={day}
            aria-label="按时间筛选絮语" onChange={event => setDay(event.target.value)} />
        </label>
        <label className={`whisper-filter-option${author ? ' whisper-filter-option--active' : ''}`} title="按发布人筛选">
          <UserRound aria-hidden="true" />
          {author && <span className="whisper-filter-option__label">{selectedAuthorName}</span>}
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
      : kind === 'mood' ? <div className="entries-toolbar">
        <div className="entries-date-filter">
          <CalendarDays aria-hidden="true" />
          <span className="entries-date-label">{day || '按日期筛选'}</span>
          <ChevronDown aria-hidden="true" />
          <input type="date" aria-label="按日期查看心情" value={day} onChange={e => setDay(e.target.value)} />
          {day && <button type="button" className="entries-filter-reset" aria-label="清除日期筛选" onClick={() => setDay('')}>
            <X aria-hidden="true" />
          </button>}
        </div>
      </div> : null}
    {error && <p role="alert" className="sg-error">{error}</p>}
    {!isWhisper && editing !== undefined && <EntryForm key={editing?.id || 'new'} kind={kind} entry={editing || undefined}
      onDelete={editing ? () => removeEntry(editing) : undefined}
      onCancel={() => setEditing(undefined)}
      onSaved={async () => { setEditing(undefined); await Promise.all([load(), refresh()]); }} />}
    {loading ? <ShiguangLoading description="正在加载记录" /> : !items.length && <p className="entries-empty">{isWhisper && hasWhisperFilters ? '没有符合筛选条件的絮语。' : '这里还没有记录。'}</p>}
    {kind === 'wish' && items.length > 0 && <div
      className={`sg-wish-sections${sortDraggingId ? ' sg-wish-sections--dragging' : ''}`}
      onPointerMove={handleCardSortPointerMove}
      onPointerUp={event => finishCardSortDrag(event)}
      onPointerCancel={event => finishCardSortDrag(event, true)}>
      <section className="sg-wish-section" aria-labelledby="wish-pending-title">
        <div className="sg-wish-section__heading">
          <h2 id="wish-pending-title">未实现</h2>
          <span>{wishPending.length}</span>
        </div>
        {wishPending.length > 0
          ? <div className="entries-wish-list">{wishPending.map(renderWishEntry)}</div>
          : <p className="sg-wish-section__empty">暂无未实现的愿望</p>}
      </section>
      <section className="sg-wish-section sg-wish-section--done" aria-labelledby="wish-completed-title">
        <div className="sg-wish-section__heading">
          <h2 id="wish-completed-title">已实现</h2>
          <span>{wishCompleted.length}</span>
        </div>
        {wishCompleted.length > 0
          ? <div className="entries-wish-list">{wishCompleted.map(renderWishEntry)}</div>
          : <p className="sg-wish-section__empty">暂无已实现的愿望</p>}
      </section>
    </div>}
    {kind !== 'wish' && items.length > 0 && <div
      className={isAnniversary
        ? `sg-anniversary-grid${sortDraggingId ? ' sg-anniversary-grid--dragging' : ''}`
        : `entries-list${isWhisper ? ' entries-list--whisper' : ''}${isPromise ? ' entries-list--promise' : ''}`}
      onPointerMove={isAnniversary ? handleCardSortPointerMove : undefined}
      onPointerUp={isAnniversary ? event => finishCardSortDrag(event) : undefined}
      onPointerCancel={isAnniversary ? event => finishCardSortDrag(event, true) : undefined}>
      {items.map(entry => {
        const { id, payload, createdBy, createdAt } = entry;
        const member = summary.space.members.find(candidate => candidate.userId === createdBy);
        const author = member?.name || '空间成员';
        const canManage = canManageEntry(entry, summary.userId, summary.today);
        if (isAnniversary) {
          const isCountdown = payload.direction === 'down';
          return <article
            className={`sg-anniversary-entry${sortDraggingId === id ? ' sg-anniversary-entry--dragging' : ''}${sortDragOverId === id && sortDraggingId !== id ? ' sg-anniversary-entry--drag-over' : ''}`}
            data-entry-id={id}
            key={id}>
            <button type="button" className={`sg-overview-card sg-overview-card--anniversary${isCountdown ? ' sg-overview-card--countdown' : ''} sg-anniversary-entry__card`}
              disabled={busy}
              onPointerDown={event => handleCardSortPointerDown(event, entry)}
              onClick={() => {
                if (Date.now() < suppressCardClickUntilRef.current) return;
                setEditing(entry);
              }}
              onContextMenu={event => event.preventDefault()}
              aria-label={`点击编辑，长按拖动排序：${payload.name || (isCountdown ? '倒数日' : '纪念日')}`}>
              <AnniversaryCardContent payload={payload} today={summary.today} actionLabel="点击编辑" />
            </button>
            <p className="sg-anniversary-entry__meta">{author} · {displayMinute(createdAt)}</p>
          </article>;
        }
        if (kind === 'whisper') {
          return <WhisperPost key={id} entry={entry}
            authorName={author}
            authorAvatar={member?.avatar || ''}
            canManage={canManage}
            busy={busy}
            expanded={replies === id}
            repliesLocked={updatingReplies}
            onToggleReplies={() => setReplies(previous => previous === id ? '' : id)}
            onReplyCountChange={updateReplyCount}
            onReplyMutation={setUpdatingReplies}
            onTopicClick={topicValue => { setSearchDraft(`#${topicValue}`); setKeyword(`#${topicValue}`); }}
            onEdit={() => setEditing(entry)}
            onDelete={() => removeEntry(entry)} />;
        }
        const title = payload.name || payload.title || payload.mood || '一条记录';
        const body = payload.content || payload.description || '';
        const entryTime = (kind === 'mood' && entry.moodDate) || displayMinute(createdAt);
        const heading = <h2 className="sg-list-title">{title}</h2>;
        const metadata = <p className="sg-list-meta">{author}{entryTime && ` · ${entryTime}`}</p>;
        const actions = canManage && <div className="sg-list-actions">
          <button type="button" className="sg-link sg-list-action" disabled={busy} onClick={() => setEditing(entry)}
            aria-label={isPromise ? '编辑心约' : undefined} title={isPromise ? '编辑心约' : undefined}>
            {isPromise ? <Pencil aria-hidden="true" /> : '编辑'}
          </button>
          <button type="button" className="sg-link sg-list-action sg-danger" disabled={busy} onClick={() => void removeEntry(entry)}
            aria-label={isPromise ? '删除心约' : undefined} title={isPromise ? '删除心约' : undefined}>
            {isPromise ? <Trash2 aria-hidden="true" /> : '删除'}
          </button>
        </div>;
        return <article className="sg-list-item" key={id}>
          {heading}
          {body && (isPromise ? <EntryTextPreview content={body} onRead={() => setReadingPromise({
            kind: 'promise', title, content: body, author, authorAvatar: member?.avatar, recordTime: entryTime,
          })} /> : <p className="sg-text">{body}</p>)}
          {isPromise ? <footer className="entries-promise-footer">
            <PromiseAuthorAvatar author={author} avatar={member?.avatar} />
            <div className="entries-post-identity">
              <strong>{author}</strong>
              {entryTime && <time dateTime={createdAt}>{entryTime}</time>}
            </div>
            {actions}
          </footer> : <div className="sg-list-footer">{metadata}{actions}</div>}
        </article>;
      })}
    </div>}
    {more && <button type="button" ref={loadMoreButton} className="entries-load-more" disabled={loading || loadingMore || busy} onClick={loadMore}>
      {loadingMore ? '正在加载…' : '加载更多'}
    </button>}
    {isPromise && <EntryTextDialog entry={readingPromise} onClose={() => setReadingPromise(null)} />}
    {isWhisper && <WhisperComposer disabled={busy} onSaved={async () => {
      await Promise.all([load(), refresh()]);
    }} />}
    {isWhisper && editing && <WhisperComposer key={editing.id} entry={editing}
      onCancel={() => setEditing(undefined)}
      onSaved={async () => { setEditing(undefined); await Promise.all([load(), refresh()]); }} />}
    {canQuickAdd && editing === undefined && <button type="button" className="entries-quick-add" disabled={busy}
      aria-label={actionLabel} onClick={() => setEditing(kind === 'mood' && ownToday ? ownToday : null)}>
      <Plus aria-hidden="true" />
    </button>}
  </SecondaryPageShell>;
}
