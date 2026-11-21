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

function Card({ kind, label, icon, href, children }: {
  kind: string;
  label: string;
  icon: ReactNode;
  href?: string;
  children: ReactNode;
}) {
  return <section className={`${styles.card} ${styles[kind] ?? ''}${href ? ` ${styles.cardLinked}` : ''}`}>
    {href && <Link href={href} className={styles.cardLink} aria-label={`进入${label}`} />}
    <header className={styles.cardHeader}>
      <h2 className={styles.heading}>
        <span className={styles.icon} aria-hidden="true">{icon}</span>{label}
      </h2>
      {href && <span className={styles.enter} aria-hidden="true"><ChevronRight /></span>}
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
  const whispers = data.whispers?.items.slice(0, 2) ?? [];
  const wishCount = pageCount(data.wishes);
  const fulfilledCount = pageCount(data.wishes, data.wishes?.items.filter(entry => entry.payload.status === 'fulfilled').length);
  const promiseCount = pageCount(data.promises);
  const whisperCount = pageCount(data.whispers);
  const ticketCount = pageCount(data.tickets, data.tickets?.items.filter(ticket => ticket.holderId === userId).length);
  const empty = (result: unknown, label: string) => result ? label : '暂时无法加载';

  return <div className={styles.modules}>
    <Card kind="wish" label="许愿池" icon={<WishIcon />} href="/shiguang/wish">
      <div className={styles.previewBody}>
        {!loaded ? <p className={styles.previewLoading} role="status">加载中...</p> : wishes.length ? <ul className={styles.previewList}>
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
    <Card kind="promise" label="心约" icon={<PromiseIcon />} href="/shiguang/promise">
      <div className={`${styles.previewBody}${loaded && !promises.length ? ` ${styles.promiseEmpty}` : ''}`}>
        {!loaded ? <p className={styles.previewLoading} role="status">加载中...</p> : promises.length ? <ul className={styles.previewList}>
          {promises.map(({ id, payload }) => <li key={id}><span className={styles.promiseName}>{payload.title || payload.name || '一条心约'}</span></li>)}
        </ul> : <>
          <Heart aria-hidden="true" />
          <span>{empty(data.promises, '还没有心约')}</span>
        </>}
      </div>
      {promiseCount !== undefined && <p className={styles.previewSummary}><span>共 <strong>{promiseCount}</strong> 条心约</span></p>}
    </Card>
    <Card kind="whisper" label="絮语" icon={<MessageCircleMore />} href="/shiguang/whisper">
      {!loaded ? <p className={styles.previewLoading} role="status">加载中...</p> : whispers.length ? <div className={styles.whisperList}>
        {whispers.map(whisper => <WhisperPreview key={whisper.id} entry={whisper}
          author={members.find(member => member.userId === whisper.createdBy)?.name || '成员'} />)}
      </div> :
        <div className={styles.whisperPreview}><p className={styles.whisperEmpty}>{empty(data.whispers, '还没有絮语')}</p></div>}
      {whisperCount !== undefined && <p className={styles.previewSummary}><span>共 <strong>{whisperCount}</strong> 条絮语</span></p>}
    </Card>
    <Card kind="tickets" label="心意奖券" icon={<Ticket />}>
      <div className={styles.ticketActions}>
        <Link href="/shiguang/tickets" className={styles.ticketAction}>
          <span className={styles.wheel} aria-hidden="true">♥</span>
          <span className={styles.ticketCopy}>
            <strong>转盘抽奖</strong>
            <span className={styles.meta}>{loaded ? `剩余 ${balance} 次` : '加载中...'}</span>
          </span>
          <span className={styles.enter} aria-hidden="true"><ChevronRight /></span>
        </Link>
        <Link href="/shiguang/tickets#sg-my-tickets" className={styles.ticketAction}>
          <span className={styles.ticketArt} aria-hidden="true"><Ticket /><Heart /></span>
          <span className={styles.ticketCopy}>
            <strong>我的卡券</strong>
            {ticketCount !== undefined ? <span className={styles.meta}>已获得 <strong className={styles.ticketCount}>{ticketCount}</strong> 张</span> :
              !loaded && <span className={styles.meta}>加载中...</span>}
          </span>
          <span className={styles.enter} aria-hidden="true"><ChevronRight /></span>
        </Link>
      </div>
    </Card>
  </div>;
}
