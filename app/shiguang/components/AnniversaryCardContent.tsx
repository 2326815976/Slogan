import { CalendarDays, CalendarHeart, Heart } from 'lucide-react';
import type { EntryPayload } from '@/lib/shiguang/types';
import { anniversaryDays } from '@/lib/shiguang/validation';

export function OverviewFooter({ date, actionLabel = '点击进入' }: { date?: string | null; actionLabel?: string }) {
  return <span className="sg-overview-footer">
    {date && <time className="sg-overview-date" dateTime={date}>
      <CalendarDays aria-hidden="true" />
      {date.replace(/-/g, '.')}
    </time>}
    <span className="sg-overview-entry">{actionLabel} <span aria-hidden="true">›</span></span>
  </span>;
}

export default function AnniversaryCardContent({ payload, today, actionLabel }: {
  payload?: EntryPayload;
  today: string;
  actionLabel?: string;
}) {
  const days = payload?.date ? Math.abs(anniversaryDays(payload, today)) : NaN;
  const isCountdown = payload?.direction === 'down';
  const title = payload?.name || (isCountdown ? '倒数日' : '纪念日');
  const numberClass = days >= 100000 ? 'sg-overview-number--compact'
    : days >= 10000 ? 'sg-overview-number--medium'
    : days >= 1000 ? 'sg-overview-number--wide' : undefined;

  return <>
    <span className="sg-overview-flourish" aria-hidden="true"><Heart /></span>
    <span className="sg-overview-heading sg-overview-heading--anniversary">
      <span className="sg-overview-heading-decoration" aria-hidden="true">♥</span>
      <span className="sg-overview-heading-text">{title}</span>
      <span className="sg-overview-heading-decoration" aria-hidden="true">♥</span>
    </span>
    {Number.isFinite(days) ? <span className="sg-overview-count">
      <span className="sg-overview-count-caption">{isCountdown ? '还有' : '已经'}</span>
      <span className={`sg-overview-value${days < 100 ? ' sg-overview-value--accent' : ''}`}>
        <strong className={numberClass}>{days}</strong>
        <span className="sg-overview-unit">天</span>
      </span>
    </span> : <CalendarHeart className="sg-overview-placeholder" aria-hidden="true" />}
    <OverviewFooter date={payload?.date} actionLabel={actionLabel} />
  </>;
}
