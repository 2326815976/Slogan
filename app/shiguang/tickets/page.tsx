'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SecondaryPageShell from '@/components/shell/SecondaryPageShell';
import { displayTime, spaceRequest, SpaceRequestError, uploadSpaceMedia } from '@/lib/shiguang/client';
import type { GiftCard, Grant, PageResult, Prize, Ticket } from '@/lib/shiguang/types';
import { useSpace } from '../components/SpaceContext';

type OfferingResource = 'prizes' | 'gift-cards';
type Offering = Prize | GiftCard;

function CardImage({ image, name }: { image: string; name: string }) {
  return image ? <img className="my-2 max-h-56 max-w-full rounded-lg object-contain" src={image} alt={name} loading="lazy" /> : null;
}

export default function Page() {
  const { summary, refresh } = useSpace();
  const [prizes, setPrizes] = useState<Prize[]>([]), [tickets, setTickets] = useState<Ticket[]>([]), [grants, setGrants] = useState<Grant[]>([]);
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [ticketPage, setTicketPage] = useState(0), [grantPage, setGrantPage] = useState(0), [ticketMore, setTicketMore] = useState(false), [grantMore, setGrantMore] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(1), [angle, setAngle] = useState(0);
  const [mode, setMode] = useState<OfferingResource | ''>(''), [editing, setEditing] = useState<Offering>(), [name, setName] = useState(''), [content, setContent] = useState(''), [image, setImage] = useState('');
  const requests = useRef(new Map<string, string>()), locked = useRef(false), recordId = useRef('');
  const retryDraw = requests.current.has(JSON.stringify(['draw', {}]));
  const userName = (id: string) => summary.space.members.find(m => m.userId === id)?.name || '成员';
  const partner = summary.space.members.find(m => m.userId !== summary.userId)!;
  const pool = prizes.filter(p => p.providerId !== summary.userId);
  const loadHistory = useCallback(async (resource: 'tickets' | 'grants', page = 0) => {
    if (resource === 'tickets') { const data = await spaceRequest<PageResult<Ticket>>(`/tickets?page=${page}`); setTickets(p => page ? [...p, ...data.items] : data.items); setTicketMore(data.hasMore); setTicketPage(page); }
    else { const data = await spaceRequest<PageResult<Grant>>(`/grants?page=${page}`); setGrants(p => page ? [...p, ...data.items] : data.items); setGrantMore(data.hasMore); setGrantPage(page); }
  }, []);
  const load = useCallback(async () => {
    const [prizeList, cardList] = await Promise.all([
      spaceRequest<PageResult<Prize>>('/prizes'), spaceRequest<PageResult<GiftCard>>('/gift-cards'),
      loadHistory('tickets'), loadHistory('grants'),
    ]);
    setPrizes(prizeList.items);
    setCards(cardList.items);
  }, [loadHistory]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible' && !locked.current) void load().catch(e => setError(e.message)); }, 5000); return () => clearInterval(timer); }, [load]);
  async function action(operation: string, data: Record<string, unknown> = {}) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setMessage('');
    const key = JSON.stringify([operation, data]);
    // 网络重试保留请求编号，服务端以此原子去重。
    const requestId = requests.current.get(key) || crypto.randomUUID();
    requests.current.set(key, requestId);
    let spin: Promise<void> | undefined;
    try {
      const result = await spaceRequest<Ticket>('/actions', 'POST', { operation, requestId, ...data });
      requests.current.delete(key);
      if (operation === 'draw') {
        const index = pool.findIndex(p => p.id === result.prizeId);
        if (index >= 0) {
          setAngle(previous => Math.ceil(previous / 360) * 360 + 1800 - (index + .5) * 360 / pool.length);
          spin = new Promise(resolve => setTimeout(resolve, 2500));
        }
        setMessage(`抽中了「${result.name}」，已经放入你的奖券。`);
      } else { setMessage(operation === 'grant' ? '抽奖次数已送达' : operation === 'send-card' ? '心意已送达' : '已记录兑现时间'); }
      if (operation === 'send-card' && editing?.id === data.cardId) setMode('');
      await Promise.all([load(), refresh()]);
    } catch (e) {
      if (e instanceof SpaceRequestError && e.status === 409) requests.current.delete(key);
      setError((e as Error).message);
    }
    finally { await spin; locked.current = false; setBusy(false); }
  }
  function openForm(next: OfferingResource, record?: Offering) {
    setError('');
    setMode(next);
    setEditing(record);
    setName(record?.name || '');
    setContent(record?.content || '');
    setImage(record?.image || '');
    recordId.current = record?.id || crypto.randomUUID();
  }
  async function mutate(work: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try { await work(); }
    catch (error) { setError((error as Error).message); }
    finally { locked.current = false; setBusy(false); }
  }
  async function save() {
    await mutate(async () => {
      await spaceRequest(`/${mode}${editing ? `/${editing.id}` : ''}`, editing ? 'PUT' : 'POST', { id: recordId.current, version: editing?.version, name, content, image });
      setMessage(editing ? '修改已保存' : mode === 'gift-cards' ? '卡券已创建，可稍后赠送' : '奖项已创建');
      setMode('');
      await load();
    });
  }
  async function remove(resource: OfferingResource, record: Offering) {
    if (!confirm(resource === 'prizes' ? '删除这个奖项？已获得的券会保留。' : '删除这张待赠卡券？')) return;
    await mutate(async () => {
      await spaceRequest(`/${resource}/${record.id}`, 'DELETE', { version: record.version });
      if (editing?.id === record.id) setMode('');
      await load();
    });
  }
  const label = mode === 'gift-cards' ? '卡券' : '奖项';
  const editor = mode && <form className="sg-form border-t pt-4" onSubmit={event => { event.preventDefault(); void save(); }}>
    <h3 className="font-semibold">{editing ? '编辑' : '新增'}{label}</h3>
    <label>名称<input required maxLength={100} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
    <label>内容<textarea required maxLength={5000} value={content} disabled={busy} onChange={event => setContent(event.target.value)} /></label>
    <label>图片（可选）<input key={`${mode}-${recordId.current}`} type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={busy} onChange={event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) void mutate(async () => setImage(await uploadSpaceMedia(file)));
    }} /></label>
    {image && <div><CardImage image={image} name={`${label}图片预览`} /><button type="button" className="sg-link" disabled={busy} onClick={() => setImage('')}>移除图片</button></div>}
    <div className="sg-actions"><button disabled={busy} className="sg-button">保存</button><button disabled={busy} type="button" className="sg-link" onClick={() => setMode('')}>取消</button></div>
  </form>;
  return <SecondaryPageShell title="心意奖券" fallbackHref="/shiguang" contentClassName="sg-content sg-stack">
    {error && <p className="sg-error" role="alert">{error}</p>}{message && <p className="sg-card" role="status">{message}</p>}
    <section className="sg-card text-center"><h2 className="font-semibold text-lg">{partner.name} 的心意转盘</h2><p className="sg-muted">剩余 {summary.balances[summary.userId] || 0} 次 · 每项机会相同，每次必中奖</p>
      <div className="sg-wheel-pointer">▼</div><div className="sg-wheel" style={{ transform: `rotate(${angle}deg)`, background: pool.length ? `conic-gradient(${pool.map((_, i) => `${['#FFE2AE', '#F6C6C6', '#DCE7D1', '#FBEFCB'][i % 4]} ${i * 100 / pool.length}% ${(i + 1) * 100 / pool.length}%`).join(',')})` : '#FBEFCB' }} aria-label={`${pool.length} 个等概率奖项`}>{pool.map((p, i) => <span key={p.id} className="sg-wheel-label" style={{ transform: `rotate(${(i + .5) * 360 / pool.length - 90}deg) translateX(24px)` }}>{p.name}</span>)}</div>
      <button className="sg-button" disabled={busy || (!retryDraw && (!pool.length || !(summary.balances[summary.userId] > 0)))} onClick={() => void action('draw')}>{busy ? '处理中…' : retryDraw ? '确认上次抽奖' : '转动心意'}</button>
      {!pool.length && <p className="sg-muted mt-3">对方还没有准备奖项</p>}
      <div className="mt-4 text-left sg-stack">{pool.map(prize => <div key={prize.id}><strong>{prize.name}</strong><CardImage image={prize.image} name={prize.name} /><p className="sg-text text-sm">{prize.content}</p><p className="sg-muted">{userName(prize.providerId)} 提供 · 抽奖人 {userName(prize.drawerId)} · {displayTime(prize.createdAt)}</p></div>)}</div>
    </section>
    <section className="sg-card sg-stack"><h2 className="font-semibold">给 {partner.name} 抽奖次数</h2><p className="sg-muted">对方可用 {summary.balances[partner.userId] || 0} 次</p><form className="sg-actions" onSubmit={e => { e.preventDefault(); void action('grant', { amount }); }}><label>给予次数 <input className="border rounded-lg p-2 w-20" type="number" required min={1} max={1000} step={1} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label><button className="sg-button" disabled={busy}>赠送次数</button></form></section>
    <section className="sg-card sg-stack">
      <div className="sg-actions justify-between"><h2 className="font-semibold">我提供的奖池</h2><button className="sg-link" disabled={busy} onClick={() => openForm('prizes')}>新增奖项</button></div>
      <p className="sg-muted">供 {partner.name} 抽取，修改不会影响已获得的奖券。</p>
      {mode === 'prizes' && editor}
      {prizes.filter(prize => prize.providerId === summary.userId).map(prize => <div key={prize.id} className="border-t pt-3">
        <strong>{prize.name}</strong><CardImage image={prize.image} name={prize.name} /><p className="sg-text">{prize.content}</p>
        <p className="sg-muted">{userName(prize.providerId)} 提供 · 抽奖人 {userName(prize.drawerId)} · {displayTime(prize.createdAt)}</p>
        <button className="sg-link" disabled={busy} onClick={() => openForm('prizes', prize)}>编辑</button>
        <button className="sg-link sg-danger" disabled={busy} onClick={() => void remove('prizes', prize)}>删除</button>
      </div>)}
    </section>
    <section className="sg-card sg-stack">
      <div className="sg-actions justify-between"><h2 className="font-semibold">待赠卡券</h2><button className="sg-link" disabled={busy} onClick={() => openForm('gift-cards')}>创建卡券</button></div>
      {mode === 'gift-cards' && editor}
      {!cards.length && <p className="sg-muted">还没有待赠卡券</p>}
      {cards.map(card => <article key={card.id} className="border-t pt-3">
        <strong>{card.name}</strong><CardImage image={card.image} name={card.name} /><p className="sg-text">{card.content}</p>
        <p className="sg-muted">{userName(card.providerId)} 提供 · 拟赠给 {userName(card.holderId)} · {displayTime(card.createdAt)}</p>
        {card.providerId === summary.userId && <div className="sg-actions">
          <button className="sg-button" disabled={busy} onClick={() => { if (confirm(`确认把「${card.name}」送给 ${partner.name}？送出后不可编辑或删除。`)) void action('send-card', { cardId: card.id, version: card.version }); }}>赠送给对方</button>
          <button className="sg-link" disabled={busy} onClick={() => openForm('gift-cards', card)}>编辑</button>
          <button className="sg-link sg-danger" disabled={busy} onClick={() => void remove('gift-cards', card)}>删除</button>
        </div>}
      </article>)}
    </section>
    <section className="sg-card sg-stack">
      <h2 className="font-semibold">我们的奖券</h2>
      {!tickets.length && <p className="sg-muted">还没有收到心意券</p>}
      {tickets.map(ticket => <article key={ticket.id} className="border-t pt-3">
        <div className="sg-actions justify-between"><strong>{ticket.name}</strong><span>{ticket.status === 'used' ? '已使用' : '待使用'}</span></div>
        <CardImage image={ticket.image} name={ticket.name} /><p className="sg-text">{ticket.content}</p>
        <p className="sg-muted">{ticket.source === 'draw' ? '抽奖获得' : '直接赠送'} · {userName(ticket.providerId)} 提供给 {userName(ticket.holderId)}<br />获得：{displayTime(ticket.obtainedAt)}{ticket.usedAt && <><br />使用：{displayTime(ticket.usedAt)}</>}</p>
        {ticket.providerId === summary.userId && ticket.status === 'unused' && <button className="sg-link" disabled={busy} onClick={() => { if (confirm('确认已经为对方兑现这张券？')) void action('redeem', { ticketId: ticket.id }); }}>已兑现，标记使用</button>}
      </article>)}
      {ticketMore && <button className="sg-link" onClick={() => void loadHistory('tickets', ticketPage + 1).catch(e => setError(e.message))}>更多奖券</button>}
    </section>
    <details className="sg-card"><summary>次数赠送记录</summary>{grants.map(g => <p className="sg-muted my-3" key={g.id}>{userName(g.giverId)} 给予 {userName(g.receiverId)} {g.amount} 次 · {displayTime(g.createdAt)}</p>)}{grantMore && <button className="sg-link" onClick={() => void loadHistory('grants', grantPage + 1).catch(e => setError(e.message))}>更多记录</button>}</details>
  </SecondaryPageShell>;
}
