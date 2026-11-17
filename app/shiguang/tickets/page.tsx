'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SecondaryPageShell from '@/components/shell/SecondaryPageShell';
import { displayTime, spaceRequest } from '@/lib/shiguang/client';
import type { Grant, PageResult, Prize, Ticket } from '@/lib/shiguang/types';
import { useSpace } from '../components/SpaceContext';

export default function Page() {
  const { summary, refresh } = useSpace();
  const [prizes, setPrizes] = useState<Prize[]>([]), [tickets, setTickets] = useState<Ticket[]>([]), [grants, setGrants] = useState<Grant[]>([]);
  const [ticketPage, setTicketPage] = useState(0), [grantPage, setGrantPage] = useState(0), [ticketMore, setTicketMore] = useState(false), [grantMore, setGrantMore] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(1), [angle, setAngle] = useState(0);
  const [mode, setMode] = useState<'prize' | 'gift' | ''>(''), [editing, setEditing] = useState<Prize>(), [name, setName] = useState(''), [content, setContent] = useState('');
  const request = useRef<{ key: string; id: string } | null>(null), locked = useRef(false), prizeId = useRef('');
  const userName = (id: string) => summary.space.members.find(m => m.userId === id)?.name || '成员';
  const partner = summary.space.members.find(m => m.userId !== summary.userId)!;
  const pool = prizes.filter(p => p.providerId !== summary.userId);
  const loadHistory = useCallback(async (resource: 'tickets' | 'grants', page = 0) => {
    if (resource === 'tickets') { const data = await spaceRequest<PageResult<Ticket>>(`/tickets?page=${page}`); setTickets(p => page ? [...p, ...data.items] : data.items); setTicketMore(data.hasMore); setTicketPage(page); }
    else { const data = await spaceRequest<PageResult<Grant>>(`/grants?page=${page}`); setGrants(p => page ? [...p, ...data.items] : data.items); setGrantMore(data.hasMore); setGrantPage(page); }
  }, []);
  const load = useCallback(async () => { const p = await spaceRequest<PageResult<Prize>>('/prizes'); setPrizes(p.items); await Promise.all([loadHistory('tickets'), loadHistory('grants')]); }, [loadHistory]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible' && !locked.current) void load().catch(e => setError(e.message)); }, 5000); return () => clearInterval(timer); }, [load]);
  async function action(operation: string, data: Record<string, unknown> = {}) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setMessage('');
    const key = JSON.stringify([operation, data]);
    // 网络重试保留请求编号，服务端以此原子去重。
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    try {
      const result = await spaceRequest<Ticket>('/actions', 'POST', { operation, requestId: request.current.id, ...data });
      request.current = null;
      if (operation === 'draw') {
        const index = pool.findIndex(p => p.id === result.prizeId);
        setAngle(a => Math.ceil(a / 360) * 360 + 1440 + 360 - ((Math.max(0, index) + .5) * 360 / Math.max(1, pool.length)));
        setMessage(`抽中了「${result.name}」，已经放入你的奖券。`);
      } else { setMessage(operation === 'grant' ? '抽奖次数已送达' : operation === 'gift' ? '心意已送达' : '已记录兑现时间'); }
      setMode(''); await Promise.all([load(), refresh()]);
    } catch (e) { setError((e as Error).message); }
    finally { locked.current = false; setBusy(false); }
  }
  function openForm(next: 'prize' | 'gift', prize?: Prize) { setMode(next); setEditing(prize); setName(prize?.name || ''); setContent(prize?.content || ''); prizeId.current = prize?.id || crypto.randomUUID(); }
  return <SecondaryPageShell title="心意奖券" fallbackHref="/shiguang" contentClassName="sg-content sg-stack">
    {error && <p className="sg-error" role="alert">{error}</p>}{message && <p className="sg-card" role="status">{message}</p>}
    <section className="sg-card text-center"><h2 className="font-semibold text-lg">{partner.name} 的心意转盘</h2><p className="sg-muted">剩余 {summary.balances[summary.userId] || 0} 次 · 每项机会相同，每次必中奖</p>
      <div className="sg-wheel-pointer">▼</div><div className="sg-wheel" style={{ transform: `rotate(${angle}deg)`, background: pool.length ? `conic-gradient(${pool.map((_, i) => `${['#FFE2AE', '#F6C6C6', '#DCE7D1', '#FBEFCB'][i % 4]} ${i * 100 / pool.length}% ${(i + 1) * 100 / pool.length}%`).join(',')})` : '#FBEFCB' }} aria-label={`${pool.length} 个等概率奖项`}>{pool.map((p, i) => <span key={p.id} className="sg-wheel-label" style={{ transform: `rotate(${(i + .5) * 360 / pool.length - 90}deg) translateX(24px)` }}>{p.name}</span>)}</div>
      <button className="sg-button" disabled={busy || !pool.length || !(summary.balances[summary.userId] > 0)} onClick={() => void action('draw')}>{busy ? '处理中…' : '转动心意'}</button>
      {!pool.length && <p className="sg-muted mt-3">对方还没有准备奖项</p>}
      <div className="mt-4 text-left sg-stack">{pool.map(p => <div key={p.id}><strong>{p.name}</strong><p className="sg-text text-sm">{p.content}</p><p className="sg-muted">{userName(p.providerId)} 提供 · {displayTime(p.createdAt)}</p></div>)}</div>
    </section>
    <section className="sg-card sg-stack"><h2 className="font-semibold">送给 {partner.name}</h2><p className="sg-muted">对方可用 {summary.balances[partner.userId] || 0} 次</p><form className="sg-actions" onSubmit={e => { e.preventDefault(); void action('grant', { amount }); }}><label>给予次数 <input className="border rounded-lg p-2 w-20" type="number" required min={1} max={1000} step={1} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label><button className="sg-button" disabled={busy}>赠送次数</button><button className="sg-link" type="button" disabled={busy} onClick={() => openForm('gift')}>直接赠送卡券</button></form></section>
    {mode && <form className="sg-card sg-form" onSubmit={async e => { e.preventDefault(); if (mode === 'gift') { void action('gift', { name, content }); return; } if (locked.current) return; locked.current = true; setBusy(true); try { await spaceRequest(`/prizes${editing ? `/${editing.id}` : ''}`, editing ? 'PUT' : 'POST', { id: prizeId.current, name, content, version: editing?.version }); setMode(''); await load(); } catch (e) { setError((e as Error).message); } finally { locked.current = false; setBusy(false); } }}><h2>{mode === 'gift' ? '赠送一张心意券' : editing ? '编辑奖项' : '准备新奖项'}</h2><label>名称<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><label>内容<textarea required maxLength={5000} value={content} onChange={e => setContent(e.target.value)} /></label><div className="sg-actions"><button disabled={busy} className="sg-button">{mode === 'gift' ? '赠送给对方' : '保存'}</button><button disabled={busy} type="button" className="sg-link" onClick={() => setMode('')}>取消</button></div></form>}
    <section className="sg-card sg-stack"><div className="sg-actions justify-between"><h2 className="font-semibold">我提供的奖池</h2><button className="sg-link" disabled={busy} onClick={() => openForm('prize')}>新增奖项</button></div><p className="sg-muted">供 {partner.name} 抽取，修改不会影响已获得的奖券。</p>{prizes.filter(p => p.providerId === summary.userId).map(p => <div key={p.id} className="border-t pt-3"><strong>{p.name}</strong><p className="sg-text">{p.content}</p><p className="sg-muted">抽奖人：{userName(p.drawerId)} · {displayTime(p.createdAt)}</p><button className="sg-link" disabled={busy} onClick={() => openForm('prize', p)}>编辑</button><button className="sg-link sg-danger" disabled={busy} onClick={async () => { if (!confirm('删除这个奖项？已获得的券会保留。')) return; setBusy(true); try { await spaceRequest(`/prizes/${p.id}`, 'DELETE', { version: p.version }); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>删除</button></div>)}</section>
    <section className="sg-card sg-stack"><h2 className="font-semibold">我们的奖券</h2>{!tickets.length && <p className="sg-muted">还没有收到心意券</p>}{tickets.map(t => <article key={t.id} className="border-t pt-3"><div className="sg-actions justify-between"><strong>{t.name}</strong><span>{t.status === 'used' ? '已使用' : '待使用'}</span></div><p className="sg-text">{t.content}</p><p className="sg-muted">{t.source === 'draw' ? '抽奖获得' : '直接赠送'} · {userName(t.providerId)} 提供给 {userName(t.holderId)}<br />获得：{displayTime(t.obtainedAt)}{t.usedAt && <><br />使用：{displayTime(t.usedAt)}</>}</p>{t.providerId === summary.userId && t.status === 'unused' && <button className="sg-link" disabled={busy} onClick={() => { if (confirm('确认已经为对方兑现这张券？')) void action('redeem', { ticketId: t.id }); }}>已兑现，标记使用</button>}</article>)}{ticketMore && <button className="sg-link" onClick={() => void loadHistory('tickets', ticketPage + 1).catch(e => setError(e.message))}>更多奖券</button>}</section>
    <details className="sg-card"><summary>次数赠送记录</summary>{grants.map(g => <p className="sg-muted my-3" key={g.id}>{userName(g.giverId)} 给予 {userName(g.receiverId)} {g.amount} 次 · {displayTime(g.createdAt)}</p>)}{grantMore && <button className="sg-link" onClick={() => void loadHistory('grants', grantPage + 1).catch(e => setError(e.message))}>更多记录</button>}</details>
  </SecondaryPageShell>;
}
