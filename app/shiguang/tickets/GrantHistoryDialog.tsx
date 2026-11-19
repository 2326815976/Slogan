import { useRef, useState } from 'react';
import { displayTime, spaceRequest } from '@/lib/shiguang/client';
import type { Grant, PageResult } from '@/lib/shiguang/types';

const emptyHistory: PageResult<Grant> & { page: number } = { items: [], hasMore: false, page: 0 };

export default function GrantHistoryDialog({ memberName, disabled }: { memberName: (id: string) => string; disabled: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [history, setHistory] = useState(emptyHistory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(page = 0) {
    if (loading) return;
    setLoading(true);
    setError('');
    if (!page) setHistory(emptyHistory);
    try {
      const result = await spaceRequest<PageResult<Grant>>(`/grants?page=${page}`);
      setHistory(previous => ({ page, hasMore: result.hasMore, items: page ? [...previous.items, ...result.items] : result.items }));
    } catch (cause) {
      setError((cause as Error).message || '加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return <>
    <button type="button" className="sg-link sg-list-action" aria-haspopup="dialog" disabled={disabled} onClick={() => { dialog.current?.showModal(); void load(); }}>查看记录</button>
    <dialog ref={dialog} className="sg-ticket-dialog" aria-labelledby="sg-grant-history-title">
      <div className="sg-ticket-dialog__header">
        <h2 className="sg-list-title" id="sg-grant-history-title">次数赠送记录</h2>
        <button type="button" className="sg-ticket-dialog__close" aria-label="关闭" onClick={() => dialog.current?.close()}>×</button>
      </div>
      <div className="sg-ticket-dialog__body" aria-busy={loading}>
        {error && <p className="sg-error" role="alert">{error}</p>}
        {!history.items.length && !error && <p className="sg-muted" role="status">{loading ? '正在加载记录…' : '还没有赠送记录'}</p>}
        {history.items.length > 0 && <div className="sg-list-stack">
          {history.items.map(grant => <article key={grant.id} className="sg-list-item">
            <div className="sg-list-line"><h3 className="sg-list-title">{memberName(grant.giverId)} 赠给 {memberName(grant.receiverId)}</h3><span className="sg-list-tag">{grant.amount} 次</span></div>
            <p className="sg-list-meta">{displayTime(grant.createdAt)}</p>
          </article>)}
        </div>}
        {(history.hasMore || error) && <button type="button" className="sg-link justify-self-start" disabled={loading} onClick={() => void load(history.items.length ? history.page + 1 : 0)}>{loading ? '正在加载…' : error ? '重试' : '更多记录'}</button>}
      </div>
    </dialog>
  </>;
}
