'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, Heart, MessageCircleMore, Ticket } from 'lucide-react';
import { spaceRequest } from '@/lib/shiguang/client';
import type { Entry, PageResult, Ticket as SpaceTicket } from '@/lib/shiguang/types';
import WhisperPreview from './WhisperPreview';
import styles from './HomeModules.module.css';

type PreviewData = {
  wishes?: PageResult<Entry>;
  promises?: PageResult<Entry>;
  whispers?: PageResult<Entry>;
  tickets?: PageResult<SpaceTicket>;
};

function pageCount(result?: PageResult<unknown>, count = result?.items.length ?? 0) {
  return result && `${count}${result.hasMore ? '+' : ''}`;
}

function WishIcon() {
  return <svg viewBox="0 0 64 64" fill="none" stroke="#745338" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 13v10c0 6-10 8-10 18v8q0 11 12 11h16q12 0 12-11v-8c0-10-10-12-10-18V13Z" fill="#e1efea" />
    <path d="M22 14h20v8H22Z" fill="#fff6de" />
    <rect x="20" y="7" width="24" height="9" rx="4" fill="#efcc99" />
    <path d="m32 29 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="#ffd572" />
    <path d="M18 39c-3 10-1 16 4 17" stroke="#fffdf4" strokeWidth="3" />
    <path d="m22 22 20-1" stroke="#c6ad86" strokeWidth="1.4" />
  </svg>;
}

function PromiseIcon() {
  return <svg viewBox="0 0 64 64" fill="none" stroke="#745338" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M27 45C17 39 4 29 4 18 4 6 19 3 27 13 34 1 48 7 47 19 46 30 36 39 27 45Z" fill="#f6b6b0" />
    <path d="M41 58C33 53 22 45 22 35c0-11 13-14 19-5 7-10 19-5 19 5 0 9-11 18-19 23Z" fill="#f8c6bb" />
    <path d="M10 20c-1-6 4-10 8-9M28 37c-1-5 3-9 7-8" stroke="#ffe2d9" strokeWidth="3" />
  </svg>;
}

function Card({ kind, label, icon, controls, children }: {
  kind: string;
  label: string;
  icon: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return <section className={`${styles.card} ${styles[kind] ?? ''}`}>
    <header className={styles.cardHeader}>
      <h2 className={styles.heading}>
        <Link href={`/shiguang/${kind}`}><span className={styles.icon} aria-hidden="true">{icon}</span>{label}</Link>
      </h2>
      {controls}
      <span className={styles.enter} aria-hidden="true">进入 <ChevronRight /></span>
    </header>
    {children}
  </section>;
}

export default function HomeModules({ userId, balance, members }: {
  userId: string;
  balance: number;
  members: { userId: string; name: string }[];
}) {
  const [data, setData] = useState<PreviewData>({});
  const [loaded, setLoaded] = useState(false);
  const [mine, setMine] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      spaceRequest<PageResult<Entry>>('/wish'), spaceRequest<PageResult<Entry>>('/promise'),
      spaceRequest<PageResult<Entry>>('/whisper'),
      spaceRequest<PageResult<SpaceTicket>>('/tickets'),
    ] as const).then(([wishes, promises, whispers, tickets]) => {
      if (!active) return;
      setData({
        wishes: wishes.status === 'fulfilled' ? wishes.value : undefined,
        promises: promises.status === 'fulfilled' ? promises.value : undefined,
        whispers: whispers.status === 'fulfilled' ? whispers.value : undefined,
        tickets: tickets.status === 'fulfilled' ? tickets.value : undefined,
      });
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  const wishes = (data.wishes?.items ?? []).slice(0, 3).map(entry => ({
    id: entry.id,
    name: entry.payload.content || entry.payload.name || entry.payload.title || '一个愿望',
    fulfilled: entry.payload.status === 'fulfilled',
  }));
  const promises = data.promises?.items.slice(0, 3) ?? [];
  const whisper = data.whispers?.items.find(entry => !mine || entry.createdBy === userId);
  const wishCount = pageCount(data.wishes);
  const fulfilledCount = pageCount(data.wishes, data.wishes?.items.filter(entry => entry.payload.status === 'fulfilled').length);
  const promiseCount = pageCount(data.promises);
  const ticketCount = pageCount(data.tickets, data.tickets?.items.filter(ticket => ticket.holderId === userId).length);
  const empty = (result: unknown, label: string) => !loaded ? '加载中…' : result ? label : '暂时无法加载';

  return <div className={styles.modules}>
    <Card kind="wish" label="许愿池" icon={<WishIcon />}>
      <div className={styles.previewBody}>
        {wishes.length ? <ul className={styles.previewList}>
          {wishes.map(wish => <li key={wish.id} className={wish.fulfilled ? styles.fulfilled : ''}>
            <span className={styles.check} aria-hidden="true">{wish.fulfilled ? '✓' : ''}</span>
            <span className={styles.wishName}>{wish.name}</span>
          </li>)}
        </ul> : <p className={styles.wishEmpty}>{empty(data.wishes, '还没有愿望')}</p>}
      </div>
      {wishCount !== undefined && <p className={styles.previewSummary}>
        <span>共 <strong>{wishCount}</strong> 个愿望</span>
        <span>· 已实现 <strong>{fulfilledCount}</strong> 个</span>
      </p>}
    </Card>
    <Card kind="promise" label="心约" icon={<PromiseIcon />}>
      <div className={`${styles.previewBody}${promises.length ? '' : ` ${styles.promiseEmpty}`}`}>
        {promises.length ? <ul className={styles.previewList}>
          {promises.map(({ id, payload }) => <li key={id}><span className={styles.promiseName}>{payload.title || payload.name || '一条心约'}</span></li>)}
        </ul> : <>
          <Heart aria-hidden="true" />
          <span>{empty(data.promises, '还没有心约')}</span>
        </>}
      </div>
      {promiseCount !== undefined && <p className={styles.previewSummary}><span>共 <strong>{promiseCount}</strong> 条心约</span></p>}
    </Card>
    <Card kind="whisper" label="絮语" icon={<MessageCircleMore />} controls={
      <div className={styles.tabs} role="group" aria-label="絮语筛选">
        <button type="button" aria-pressed={!mine} onClick={() => setMine(false)}>最新</button>
        <button type="button" aria-pressed={mine} onClick={() => setMine(true)}>我的</button>
      </div>
    }>
      {whisper ? <WhisperPreview key={whisper.id} entry={whisper} author={members.find(member => member.userId === whisper.createdBy)?.name || '成员'} /> :
        <div className={styles.whisperPreview}><p className={styles.whisperEmpty}>{empty(data.whispers, mine ? '近期没有我的絮语' : '还没有絮语')}</p></div>}
    </Card>
    <Card kind="tickets" label="心意奖券" icon={<Ticket />}>
      <div className={styles.ticketActions}>
        <Link href="/shiguang/tickets" className={styles.ticketAction}>
          <span className={styles.wheel} aria-hidden="true">♥</span>
          <span><strong>转盘抽奖</strong><span className={styles.meta}>剩余 {balance} 次</span><span className={styles.ticketButton}>去抽奖 ›</span></span>
        </Link>
        <Link href="/shiguang/tickets#sg-my-tickets" className={styles.ticketAction}>
          <span className={styles.ticketArt} aria-hidden="true"><Ticket /><Heart /></span>
          <span><strong>我的卡券</strong>{ticketCount !== undefined && <span className={styles.meta}>已获得 {ticketCount} 张</span>}<span className={styles.ticketButton}>查看卡券 ›</span></span>
        </Link>
      </div>
    </Card>
  </div>;
}
