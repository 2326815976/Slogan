'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SecondaryPageShell from '@/components/shell/SecondaryPageShell';
import { displayTime, spaceRequest, SpaceRequestError, uploadSpaceMedia } from '@/lib/shiguang/client';
import type { GiftCard, PageResult, Prize, Ticket } from '@/lib/shiguang/types';
import { useSpace } from '../components/SpaceContext';
import GrantHistoryDialog from './GrantHistoryDialog';

type OfferingResource = 'prizes' | 'gift-cards';
type Offering = Prize | GiftCard;
type Detail = { resource: 'prizes'; item: Prize } | { resource: 'gift-cards'; item: GiftCard } | { resource: 'tickets'; item: Ticket };
const sections = [{ id: 'wheel', label: '转盘抽奖' }, { id: 'cards', label: '我的卡券' }] as const;
type Section = typeof sections[number]['id'];
const cardsHash = '#sg-my-tickets';

function CardImage({ image, name }: { image: string; name: string }) {
  return image ? <img className="my-2 max-h-56 max-w-full rounded-lg object-contain" src={image} alt={name} loading="lazy" /> : null;
}

function TicketRow({ name, busy, onView, onRemove }: { name: string; busy: boolean; onView: () => void; onRemove?: () => void }) {
  return <article className="sg-list-item sg-ticket-row">
    <h3 className="sg-list-title">{name}</h3>
    <div className="sg-list-actions">
      <button type="button" className="sg-link sg-list-action" aria-haspopup="dialog" disabled={busy} onClick={onView}>查看</button>
      {onRemove && <button type="button" className="sg-link sg-list-action sg-danger" disabled={busy} onClick={onRemove}>删除</button>}
    </div>
  </article>;
}

export default function Page() {
  const { summary, refresh } = useSpace();
  const [section, setSection] = useState<Section>('wheel');
  const [prizes, setPrizes] = useState<Prize[]>([]), [tickets, setTickets] = useState<Ticket[]>([]);
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [ticketPage, setTicketPage] = useState(0), [ticketMore, setTicketMore] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(1), [angle, setAngle] = useState(0);
  const [mode, setMode] = useState<OfferingResource | ''>(''), [editing, setEditing] = useState<Offering>(), [name, setName] = useState(''), [content, setContent] = useState(''), [image, setImage] = useState('');
  const [detail, setDetail] = useState<Detail>();
  const itemDialog = useRef<HTMLDialogElement>(null);
  const itemDialogOpen = Boolean(mode || detail);
  useEffect(() => {
    const dialog = itemDialog.current;
    if (itemDialogOpen && dialog && !dialog.open) dialog.showModal();
    if (!itemDialogOpen && dialog?.open) dialog.close();
  }, [itemDialogOpen]);
  const requests = useRef(new Map<string, string>()), locked = useRef(false), recordId = useRef('');
  const retryDraw = requests.current.has(JSON.stringify(['draw', {}]));
  const userName = (id: string) => summary.space.members.find(m => m.userId === id)?.name || '成员';
  const partner = summary.space.members.find(m => m.userId !== summary.userId)!;
  const pool = prizes.filter(p => p.providerId !== summary.userId);
  const ownPrizes = prizes.filter(prize => prize.providerId === summary.userId);
  const pendingCards = cards.filter(card => card.providerId === summary.userId);
  const loadTickets = useCallback(async (page = 0) => {
    const data = await spaceRequest<PageResult<Ticket>>(`/tickets?page=${page}`);
    setTickets(previous => page ? [...previous, ...data.items] : data.items);
    setTicketMore(data.hasMore);
    setTicketPage(page);
  }, []);
  const load = useCallback(async () => {
    const [prizeList, cardList] = await Promise.all([
      spaceRequest<PageResult<Prize>>('/prizes'), spaceRequest<PageResult<GiftCard>>('/gift-cards'),
      loadTickets(),
    ]);
    setPrizes(prizeList.items);
    setCards(cardList.items);
  }, [loadTickets]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible' && !locked.current) void load().catch(e => setError(e.message)); }, 5000); return () => clearInterval(timer); }, [load]);
  useEffect(() => {
    const syncSection = () => setSection(window.location.hash === cardsHash ? 'cards' : 'wheel');
    syncSection();
    window.addEventListener('hashchange', syncSection);
    return () => window.removeEventListener('hashchange', syncSection);
  }, []);
  function selectSection(next: Section) {
    if (next === section || busy) return;
    setSection(next);
    setMessage('');
    const url = new URL(window.location.href);
    url.hash = next === 'cards' ? cardsHash : '';
    window.history.replaceState(window.history.state, '', url);
  }
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
        setMessage(`抽中了「${result.name}」，已放入「我的卡券」。`);
      } else { setMessage(operation === 'grant' ? '抽奖次数已送达' : operation === 'send-card' ? '心意已送达' : '已记录兑现时间'); }
      if (operation === 'send-card' || operation === 'redeem') setDetail(undefined);
      await Promise.all([load(), refresh()]);
    } catch (e) {
      if (e instanceof SpaceRequestError && e.status === 409) requests.current.delete(key);
      setError((e as Error).message);
    }
    finally { await spin; locked.current = false; setBusy(false); }
  }
  function openForm(next: OfferingResource, record?: Offering) {
    setError('');
    setDetail(undefined);
    setMode(next);
    setEditing(record);
    setName(record?.name || '');
    setContent(record?.content || '');
    setImage(record?.image || '');
    recordId.current = record?.id || crypto.randomUUID();
  }
  function openDetails(next: Detail) {
    setError('');
    setDetail(next);
  }
  function closeItemDialog() {
    if (busy) return;
    setMode('');
    setDetail(undefined);
    setError('');
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
  const editor = mode && <form className="sg-form" onSubmit={event => { event.preventDefault(); void save(); }}>
    <label>名称<input required maxLength={100} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
    <label>{mode === 'prizes' ? '内容（选填）' : '内容'}<textarea required={mode === 'gift-cards'} maxLength={5000} value={content} disabled={busy} onChange={event => setContent(event.target.value)} /></label>
    <label>图片（可选）<input key={`${mode}-${recordId.current}`} type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={busy} onChange={event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) void mutate(async () => setImage(await uploadSpaceMedia(file)));
    }} /></label>
    {image && <div><CardImage image={image} name={`${label}图片预览`} /><button type="button" className="sg-link" disabled={busy} onClick={() => setImage('')}>移除图片</button></div>}
    <div className="sg-list-actions"><button disabled={busy} type="button" className="sg-link sg-list-action" onClick={closeItemDialog}>取消</button><button disabled={busy} className="sg-link sg-list-action sg-list-action--accent">保存</button></div>
  </form>;
  function renderDetails({ resource, item }: Detail) {
    const ticket = resource === 'tickets' ? item : undefined;
    const sentGift = ticket?.source === 'gift' && ticket.providerId === summary.userId;
    const source = !ticket ? '' : ticket.source === 'draw' ? '抽奖获得'
      : sentGift ? `已赠给 ${userName(ticket.holderId)}` : `收到 ${userName(ticket.providerId)} 的赠送`;
    const canEdit = resource !== 'tickets' && item.providerId === summary.userId;
    const canRedeem = ticket?.providerId === summary.userId && ticket.status === 'unused';
    return <>
      {item.content && <p className="sg-text">{item.content}</p>}
      <CardImage image={item.image} name={item.name} />
      {!item.content && !item.image && !ticket && <p className="sg-muted">暂无补充内容</p>}
      {ticket && <div className="sg-list-meta">
        <div className="sg-list-line"><span>{source}</span><span className={`sg-list-tag${ticket.status === 'used' ? ' sg-list-tag--done' : ''}`}>{ticket.status === 'used' ? '已使用' : '待使用'}</span></div>
        <p>{sentGift ? '送出' : '获得'}：{displayTime(ticket.obtainedAt)}</p>
        {ticket.usedAt && <p>使用：{displayTime(ticket.usedAt)}</p>}
      </div>}
      {(canEdit || canRedeem) && <div className="sg-list-actions">
        {canEdit && resource !== 'tickets' && <button type="button" className="sg-link sg-list-action" disabled={busy} onClick={() => openForm(resource, item)}>编辑</button>}
        {canEdit && resource === 'gift-cards' && <button type="button" className="sg-link sg-list-action sg-list-action--accent" disabled={busy} onClick={() => {
          if (confirm(`确认把「${item.name}」送给 ${partner.name}？送出后不可编辑或删除。`)) void action('send-card', { cardId: item.id, version: item.version });
        }}>赠送给对方</button>}
        {canRedeem && ticket && <button type="button" className="sg-link sg-list-action sg-list-action--accent" disabled={busy} onClick={() => {
          if (confirm('确认已经为对方兑现这张券？')) void action('redeem', { ticketId: ticket.id });
        }}>已兑现，标记使用</button>}
      </div>}
    </>;
  }
  const wheelSection = <>
    <section className="sg-card text-center"><h2 className="font-semibold text-lg">{partner.name} 的心意转盘</h2><p className="sg-muted">剩余 {summary.balances[summary.userId] || 0} 次 · 每项机会相同，每次必中奖</p>
      <div className="sg-wheel-pointer">▼</div><div className="sg-wheel" style={{ transform: `rotate(${angle}deg)`, background: pool.length ? `conic-gradient(${pool.map((_, i) => `${['#FFE2AE', '#F6C6C6', '#DCE7D1', '#FBEFCB'][i % 4]} ${i * 100 / pool.length}% ${(i + 1) * 100 / pool.length}%`).join(',')})` : '#FBEFCB' }} aria-label={`${pool.length} 个等概率奖项`}>{pool.map((p, i) => <span key={p.id} className="sg-wheel-label" style={{ transform: `rotate(${(i + .5) * 360 / pool.length - 90}deg) translateX(24px)` }}>{p.name}</span>)}</div>
      <button className="sg-button" disabled={busy || (!retryDraw && (!pool.length || !(summary.balances[summary.userId] > 0)))} onClick={() => void action('draw')}>{busy ? '处理中…' : retryDraw ? '确认上次抽奖' : '转动心意'}</button>
      {!pool.length && <p className="sg-muted mt-3">对方还没有准备奖项</p>}
      {pool.length > 0 && <div className="mt-4 text-left sg-list-stack">
        {pool.map(prize => <TicketRow key={prize.id} name={prize.name} busy={busy} onView={() => openDetails({ resource: 'prizes', item: prize })} />)}
      </div>}
    </section>
    <section className="sg-card sg-actions justify-between">
      <div>
        <h2 className="font-semibold">赠送抽奖次数</h2>
        <p className="sg-muted">{partner.name} 可用 {summary.balances[partner.userId] || 0} 次</p>
      </div>
      <form className="sg-list-actions items-center" onSubmit={e => { e.preventDefault(); void action('grant', { amount }); }}>
        <label className="sg-actions flex-nowrap text-sm">次数 <input className="border rounded-lg p-2 w-20" type="number" required min={1} max={1000} step={1} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
        <button className="sg-link sg-list-action sg-list-action--accent" disabled={busy}>赠送次数</button>
        <GrantHistoryDialog memberName={userName} disabled={busy} />
      </form>
    </section>
    <section className="sg-card sg-stack">
      <div className="sg-actions justify-between"><h2 className="font-semibold">我提供的奖池</h2><button className="sg-link" disabled={busy} onClick={() => openForm('prizes')}>新增奖项</button></div>
      {ownPrizes.length > 0 ? <div className="sg-list-stack">
        {ownPrizes.map(prize => <TicketRow key={prize.id} name={prize.name} busy={busy} onView={() => openDetails({ resource: 'prizes', item: prize })} onRemove={() => void remove('prizes', prize)} />)}
      </div> : <p className="sg-muted">还没有提供奖项</p>}
    </section>
  </>;
  const cardsSection = <>
    <section className="sg-card sg-stack">
      <div className="sg-actions justify-between"><h2 className="font-semibold">待赠卡券</h2><button className="sg-link" disabled={busy} onClick={() => openForm('gift-cards')}>创建卡券</button></div>
      {!pendingCards.length && <p className="sg-muted">还没有待赠卡券</p>}
      {pendingCards.length > 0 && <div className="sg-list-stack">
        {pendingCards.map(card => <TicketRow key={card.id} name={card.name} busy={busy} onView={() => openDetails({ resource: 'gift-cards', item: card })} onRemove={() => void remove('gift-cards', card)} />)}
      </div>}
    </section>
    <section className="sg-card sg-stack">
      <h2 className="font-semibold">送出与获得</h2>
      {!tickets.length && <p className="sg-muted">还没有卡券记录</p>}
      {tickets.length > 0 && <div className="sg-list-stack">
        {tickets.map(ticket => <TicketRow key={ticket.id} name={ticket.name} busy={busy} onView={() => openDetails({ resource: 'tickets', item: ticket })} />)}
      </div>}
      {ticketMore && <button className="sg-link" onClick={() => void loadTickets(ticketPage + 1).catch(e => setError(e.message))}>更多奖券</button>}
    </section>
  </>;
  return <SecondaryPageShell title="心意奖券" fallbackHref="/shiguang" contentClassName="sg-content sg-stack">
    <div id="sg-my-tickets" className="sg-ticket-tabs" role="group" aria-label="心意奖券分类">
      {sections.map(({ id, label }) => <button key={id} className="sg-ticket-tab" type="button" aria-pressed={id === section} disabled={busy} onClick={() => selectSection(id)}>
        {label}
      </button>)}
    </div>
    {!itemDialogOpen && error && <p className="sg-error" role="alert">{error}</p>}{message && <p className="sg-card" role="status">{message}</p>}
    {section === 'wheel' ? wheelSection : cardsSection}
    <dialog ref={itemDialog} className="sg-ticket-dialog" aria-labelledby="sg-ticket-detail-title" onCancel={event => { event.preventDefault(); closeItemDialog(); }}>
      <div className="sg-ticket-dialog__header">
        <h2 className="sg-list-title" id="sg-ticket-detail-title">{mode ? `${editing ? '编辑' : '新增'}${label}` : detail?.item.name}</h2>
        <button type="button" className="sg-ticket-dialog__close" aria-label="关闭" disabled={busy} onClick={closeItemDialog}>×</button>
      </div>
      <div className="sg-ticket-dialog__body" key={mode || 'detail'}>
        {itemDialogOpen && error && <p className="sg-error" role="alert">{error}</p>}
        {mode ? editor : detail && renderDetails(detail)}
      </div>
    </dialog>
  </SecondaryPageShell>;
}
