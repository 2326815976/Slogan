'use client';

import { useEffect, useRef, useState, type PointerEvent, type ReactElement } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react';
import SecondaryPageShell from '@/components/shell/SecondaryPageShell';
import { displayMinute, spaceRequest } from '@/lib/shiguang/client';
import type { Entry, PageResult, SpaceMember } from '@/lib/shiguang/types';
import { useSpace } from './SpaceContext';
import EntryForm from './EntryForm';
import EntryTextPreview, { EntryTextDialog, type EntryText } from './EntryTextPreview';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const FIRST_MOOD_MONTH = '1970-01';
const LAST_MOOD_MONTH = '2099-12';
const MONTH_SWIPE_DISTANCE = 48;
const MOOD_EMOJI = new Map([
  ['开心', '😊'], ['超开心', '😍'], ['平静', '😌'], ['难过', '😢'],
]);

type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
};

function shiftMonth(value: string, delta: number) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthCells(month: string, today: string): CalendarCell[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const firstCell = Date.UTC(year, monthNumber - 1, 1 - firstWeekday);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const value = new Date(firstCell + index * 86400000);
    const date = value.toISOString().slice(0, 10);
    return {
      date,
      day: value.getUTCDate(),
      inMonth: value.getUTCFullYear() === year && value.getUTCMonth() === monthNumber - 1,
      isToday: date === today,
      isFuture: date > today,
    };
  });
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split('-');
  return `${year}年${Number(monthNumber)}月`;
}

const MONTH_OPTIONS: ReactElement[] = [];
for (let month = LAST_MOOD_MONTH; month >= FIRST_MOOD_MONTH; month = shiftMonth(month, -1)) {
  MONTH_OPTIONS.push(<option key={month} value={month}>{formatMonth(month)}</option>);
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return { day: `${month}月${day}日`, weekday: `（周${weekday}）` };
}

function memberMood(moodsByDate: Map<string, Entry[]>, date: string, member: SpaceMember) {
  return (moodsByDate.get(date) || []).find(entry => entry.createdBy === member.userId);
}

export default function MoodCalendar() {
  const { summary, refresh } = useSpace();
  const today = summary.today;
  const currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState(today);
  const [moods, setMoods] = useState<Entry[]>([]);
  const [loadedMonth, setLoadedMonth] = useState('');
  const [reload, setReload] = useState(0);
  const monthSwipeStart = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const monthSwipeHandled = useRef(false);
  const [readingMood, setReadingMood] = useState<EntryText | null>(null);
  const [editing, setEditing] = useState<Entry | null | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    async function loadMonth() {
      try {
        const data = await spaceRequest<PageResult<Entry>>(`/mood?month=${month}`);
        if (!active) return;
        setMoods(data.items);
        setLoadedMonth(month);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '心情日历加载失败');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadMonth();
    return () => { active = false; };
  }, [month, reload]);

  const moodsByDate = new Map<string, Entry[]>();
  for (const entry of loadedMonth === month ? moods : []) {
    const key = entry.moodDate || entry.createdAt.slice(0, 10);
    moodsByDate.set(key, [...(moodsByDate.get(key) || []), entry]);
  }

  const cells = monthCells(month, today);
  const members = [...summary.space.members].sort((left, right) => left.role.localeCompare(right.role));
  const memberDetails = members.map(member => ({ member, entry: memberMood(moodsByDate, selectedDate, member) }));
  const selectedLabel = formatDate(selectedDate);
  function changeMonth(next: string) {
    if (next === month) return;
    selectDate(next === currentMonth ? today : `${next}-01`);
  }

  function startMonthSwipe(event: PointerEvent<HTMLDivElement>) {
    monthSwipeHandled.current = false;
    monthSwipeStart.current = event.isPrimary && event.button === 0
      ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
      : null;
  }

  function finishMonthSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = monthSwipeStart.current;
    monthSwipeStart.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const horizontal = event.clientX - start.x;
    const vertical = event.clientY - start.y;
    if (Math.abs(horizontal) < MONTH_SWIPE_DISTANCE || Math.abs(horizontal) <= Math.abs(vertical) * 1.4) return;
    monthSwipeHandled.current = true;
    changeMonth(shiftMonth(month, horizontal < 0 ? 1 : -1));
  }

  function selectDate(date: string) {
    const targetMonth = date.slice(0, 7);
    if (targetMonth < FIRST_MOOD_MONTH || targetMonth > LAST_MOOD_MONTH) return;
    if (targetMonth !== month) setMonth(targetMonth);
    setSelectedDate(date);
  }

  async function removeMood(entry: Entry) {
    if (entry.moodDate !== today || entry.createdBy !== summary.userId || !confirm('删除当天的心情记录？')) return;
    setBusy(true);
    setError('');
    try {
      await spaceRequest(`/mood/${entry.id}`, 'DELETE', { version: entry.version });
      setMoods(current => current.filter(item => item.id !== entry.id));
      await refresh();
      setReload(current => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  return <SecondaryPageShell title="心情" fallbackHref="/shiguang" contentClassName="sg-content sg-stack mood-calendar-page">
    <section className="mood-calendar-panel" aria-label="心情日历">
      <header className="mood-calendar-header">
        <button type="button" className="mood-calendar-nav" aria-label="上个月" disabled={month === FIRST_MOOD_MONTH} onClick={() => changeMonth(shiftMonth(month, -1))}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <label className="mood-calendar-title">
          <CalendarDays aria-hidden="true" />
          <span>{formatMonth(month)}</span>
          <ChevronDown aria-hidden="true" />
          <select aria-label="选择月份" value={month} onChange={event => changeMonth(event.target.value)}>
            {MONTH_OPTIONS}
          </select>
        </label>
        <button type="button" className="mood-calendar-nav" aria-label="下个月" disabled={month === LAST_MOOD_MONTH} onClick={() => changeMonth(shiftMonth(month, 1))}>
          <ChevronRight aria-hidden="true" />
        </button>
      </header>

      <div className="mood-calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map(day => <span key={day}>{day}</span>)}
      </div>
      <div className="mood-calendar-grid"
        onPointerDown={startMonthSwipe}
        onPointerUp={finishMonthSwipe}
        onPointerCancel={() => { monthSwipeStart.current = null; }}
        onPointerLeave={() => { monthSwipeStart.current = null; }}
        onClickCapture={event => {
          if (!monthSwipeHandled.current || event.detail === 0) return;
          monthSwipeHandled.current = false;
          event.stopPropagation();
        }}>
        {cells.map(cell => {
          const dayMoods = moodsByDate.get(cell.date) || [];
          const dotRoles = members
            .filter(member => dayMoods.some(entry => entry.createdBy === member.userId))
            .map(member => member.role);
          const label = formatDate(cell.date);
          return <button type="button" key={cell.date}
            className={`mood-calendar-day${cell.inMonth ? '' : ' mood-calendar-day--outside'}${cell.isToday ? ' mood-calendar-day--today' : ''}${cell.date === selectedDate ? ' mood-calendar-day--selected' : ''}${cell.isFuture ? ' mood-calendar-day--future' : ''}`}
            disabled={cell.date < `${FIRST_MOOD_MONTH}-01` || cell.date > `${LAST_MOOD_MONTH}-31`}
            aria-pressed={cell.date === selectedDate}
            aria-label={`${cell.date.slice(0, 4)}年${label.day}${label.weekday}${dayMoods.length ? `，${dayMoods.length} 条心情记录` : '，无心情记录'}`}
            onClick={() => selectDate(cell.date)}>
            <span>{cell.day}</span>
            <span className="mood-calendar-dots" aria-hidden="true">
              {dotRoles.map(role => <i key={role} className={`mood-calendar-dot mood-calendar-dot--${role}`} />)}
            </span>
          </button>;
        })}
      </div>
      <div className="mood-calendar-legend" aria-label="心情颜色图例">
        {members.map(member => <span key={member.userId} className="mood-calendar-legend__item">
          <i className={`mood-calendar-dot mood-calendar-dot--${member.role}`} aria-hidden="true" />
          <span>{member.name}的记录</span>
        </span>)}
        <span className="mood-calendar-legend__item">
          <span className="mood-calendar-legend__both" aria-hidden="true">
            <i className="mood-calendar-dot mood-calendar-dot--boy" />
            <i className="mood-calendar-dot mood-calendar-dot--girl" />
          </span>
          双方都有记录
        </span>
      </div>
    </section>

    {error && <p className="sg-error" role="alert">{error}</p>}
    {loading && <p className="mood-calendar-status" role="status">正在加载本月心情…</p>}

    {loadedMonth === month && <section className="mood-detail-panel" aria-label={`${selectedLabel.day}的心情`}>
      <header className="mood-detail-header">
        <CalendarDays aria-hidden="true" />
        <h2>{selectedLabel.day}</h2>
        <span>{selectedLabel.weekday}</span>
      </header>

      <div className="mood-detail-list">
        {memberDetails.map(({ member, entry }) => {
          const canRecord = !entry && member.userId === summary.userId && selectedDate === today && !loading && !error;
          const mood = entry?.payload.mood?.trim() || '';
          const emoji = MOOD_EMOJI.get(mood);
          return <div key={member.userId} className={`mood-detail-card mood-detail-card--${member.role}${entry || canRecord ? '' : ' mood-detail-card--empty'}`}>
            <div className="mood-detail-card__identity">
              <div className="mood-detail-card__avatar">
                <span aria-hidden="true">{member.name.slice(0, 1)}</span>
                {member.avatar && <img key={member.avatar} src={member.avatar} alt="" onError={event => { event.currentTarget.hidden = true; }} />}
              </div>
              <div className="mood-detail-card__info">
                <span className="mood-detail-card__name">{member.name}</span>
                {canRecord ? <button type="button" className="mood-detail-card__mood mood-detail-card__mood--record" disabled={busy} onClick={() => setEditing(null)}>记录心情</button> : <strong className="mood-detail-card__mood">
                  {emoji && <span aria-hidden="true">{emoji}</span>}
                  {mood || '未记录'}
                </strong>}
              </div>
            </div>
          </div>;
        })}
      </div>

      {memberDetails.some(({ entry }) => entry) && <div className="mood-detail-records">
        {memberDetails.map(({ member, entry }) => {
          if (!entry) return null;
          const canManage = member.userId === summary.userId && selectedDate === today && entry.moodDate === today;
          const description = entry.payload.description?.trim() || '';
          const timestamp = Number.isFinite(Date.parse(entry.updatedAt)) ? entry.updatedAt : entry.createdAt;
          const recordTime = displayMinute(timestamp);
          return <article key={entry.id} className={`mood-detail-record mood-detail-card--${member.role}`}>
            <header className="mood-detail-record__header">
              <div className="mood-detail-record__meta">
                <h3 className="mood-detail-record__author">{member.name}</h3>
                {recordTime && <time className="mood-detail-card__time" dateTime={timestamp}>{recordTime}</time>}
              </div>
              {canManage && !busy && !loading && <details className="mood-detail-record__options"
                onBlur={event => {
                  if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
                }}
                onKeyDown={event => {
                  if (event.key !== 'Escape' || !event.currentTarget.open) return;
                  event.currentTarget.querySelector('summary')?.focus();
                  event.currentTarget.open = false;
                }}>
                <summary aria-label="心情记录操作"><Ellipsis aria-hidden="true" /></summary>
                <div className="mood-detail-record__menu"
                  onMouseDown={event => event.preventDefault()}
                  onClick={event => {
                    const options = event.currentTarget.closest('details');
                    options?.querySelector('summary')?.focus();
                    if (options) options.open = false;
                  }}>
                  <button type="button" className="mood-detail-card__action" onClick={() => setEditing(entry)}>编辑</button>
                  <button type="button" className="mood-detail-card__action mood-detail-card__delete" onClick={() => void removeMood(entry)}>删除</button>
                </div>
              </details>}
            </header>
            {description && <EntryTextPreview content={description} onRead={() => setReadingMood({
              kind: 'mood', title: `${member.name}的心情`, subtitle: recordTime, content: description,
            })} />}
          </article>;
        })}
      </div>}
    </section>}

    <EntryTextDialog entry={readingMood} onClose={() => setReadingMood(null)} />

    {editing !== undefined && <EntryForm kind="mood" entry={editing || undefined}
      onCancel={() => setEditing(undefined)}
      onSaved={async () => {
        setEditing(undefined);
        setReload(current => current + 1);
        await refresh();
      }} />}
  </SecondaryPageShell>;
}
