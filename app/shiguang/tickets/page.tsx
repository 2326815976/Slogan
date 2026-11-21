'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import SecondaryPageShell from '@/components/shell/SecondaryPageShell';
import { displayTime, spaceRequest, SpaceRequestError, uploadSpaceMedia } from '@/lib/shiguang/client';
import type { GiftCard, PageResult, Prize, PrizeSummary, Ticket } from '@/lib/shiguang/types';
import { useSpace } from '../components/SpaceContext';
import OptionalSection from '../components/OptionalSection';
import ShiguangLoading from '../components/ShiguangLoading';
import GrantHistoryDialog from './GrantHistoryDialog';
import './tickets.css';

type OfferingResource = 'prizes' | 'gift-cards';
type Offering = Prize | GiftCard;
type Detail =
  | { resource: 'gift-cards'; item: GiftCard; presentation?: 'send-preview' }
  | { resource: 'tickets'; item: Ticket; presentation?: 'draw-result' };
const sections = [{ id: 'wheel', label: '转盘抽奖' }, { id: 'cards', label: '我的卡券' }] as const;
type Section = typeof sections[number]['id'];
const ticketScopes = [
  { id: 'all', label: '全部' }, { id: 'received', label: '我收到的' }, { id: 'provided', label: '我提供的' },
] as const;
type TicketScope = typeof ticketScopes[number]['id'];
const cardsHash = '#sg-my-tickets';
const wheelColors = ['#FFE0BB', '#F8CCD8', '#DCE9CC', '#FCE9B8', '#F3C9C3', '#DCEBE7'];
const wheelSpinDurationMs = 3200;

function WheelVisual({ prizes, angle, emptyLabel = '暂无奖项' }: { prizes: PrizeSummary[]; angle: number; emptyLabel?: string }) {
  const prizeCount = prizes.length;
  const segmentAngle = prizeCount ? 360 / prizeCount : 0;
  const dividerAngle = Math.min(.6, segmentAngle / 8);
  const segments = prizes.map((_, index) => `${wheelColors[index % wheelColors.length]} ${index * segmentAngle}deg ${(index + 1) * segmentAngle}deg`);
  const dividers = prizeCount > 1
    ? `repeating-conic-gradient(#fffdf9ed 0deg ${dividerAngle}deg, transparent ${dividerAngle}deg ${segmentAngle}deg), `
    : '';
  const background = prizeCount
    ? `${dividers}conic-gradient(${segments.join(',')})`
    : 'repeating-conic-gradient(#fff5e6 0deg 45deg, #f5eadc 45deg 90deg)';
  return <div className="sg-wheel-stage">
    <div className="sg-wheel-pointer" aria-hidden="true" />
    <div className="sg-wheel"
      style={{ transform: `rotate(${prizeCount ? angle : 0}deg)`, background }}
      aria-label={prizeCount ? `${prizeCount} 个等概率奖项` : '暂无奖项'}>
      {prizes.map((prize, index) => {
        const labelAngle = prizeCount === 1 ? 0 : (index + .5) * segmentAngle * Math.PI / 180;
        return <span key={prize.id} className="sg-wheel-label" title={prize.name} style={{
          left: `${50 + 29 * Math.sin(labelAngle)}%`,
          top: `${50 - 29 * Math.cos(labelAngle)}%`,
          maxWidth: `${Math.min(30, 155 / prizeCount)}%`,
          transform: `translate(-50%, -50%) rotate(${-angle}deg)`,
        }}>{prize.name}</span>;
      })}
    </div>
    <div className={`sg-wheel-hub${prizeCount ? ' sg-wheel-hub--dot' : ''}`}>
      {prizeCount ? <span className="sg-wheel-hub-heart" aria-hidden="true">♥</span> : <span>{emptyLabel}</span>}
    </div>
  </div>;
}

function CardImage({ image, name }: { image: string; name: string }) {
  return image ? <img className="mx-auto my-2 block max-h-56 max-w-full rounded-lg object-contain" src={image} alt={name} loading="lazy" /> : null;
}

function TicketRow({ name, image, status, statusLabel, variant = 'prize', busy, actionLabel = '查看', quickActionLabel, onView, onQuickAction, onRemove }: {
  name: string;
  image: string;
  status?: Ticket['status'];
  statusLabel?: string;
  variant?: 'prize' | 'gift' | 'ticket';
  busy: boolean;
  actionLabel?: string;
  quickActionLabel?: string;
  onView: () => void;
  onQuickAction?: () => void;
  onRemove?: () => void;
}) {
  const [visibleImage, setVisibleImage] = useState('');
  const imageLoaded = Boolean(image && visibleImage === image);
  return <article className="sg-list-item sg-ticket-row" data-variant={variant}>
    <span className="ticket-row-mark relative" aria-hidden="true">
      {!imageLoaded && '券'}
      {image && <img className="ticket-row-thumbnail absolute inset-0" src={`${image}?variant=thumbnail`} alt="" loading="lazy"
        style={{ opacity: imageLoaded ? 1 : 0 }} onLoad={() => setVisibleImage(image)} onError={() => setVisibleImage('')} />}
    </span>
    <div className="sg-ticket-row-copy">
      <h3 className="sg-list-title">{name}</h3>
      {status && <span className="ticket-status" data-used={status === 'used'}>{statusLabel}</span>}
    </div>
    <div className="sg-list-actions">
      {quickActionLabel && onQuickAction && <button type="button" className="sg-link sg-list-action sg-list-action--accent" disabled={busy} onClick={onQuickAction}>{quickActionLabel}</button>}
      <button type="button" className="sg-link sg-list-action" aria-haspopup="dialog" disabled={busy} onClick={onView}>{actionLabel}</button>
      {onRemove && <button type="button" className="sg-link sg-list-action sg-danger" disabled={busy} onClick={onRemove}>删除</button>}
    </div>
  </article>;
}

export default function Page() {
  const { summary, refresh } = useSpace();
  const [section, setSection] = useState<Section>('wheel');
  const [prizes, setPrizes] = useState<(PrizeSummary | Prize)[]>([]), [tickets, setTickets] = useState<Ticket[]>([]);
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [ticketScope, setTicketScope] = useState<TicketScope>('all');
  const [ticketMore, setTicketMore] = useState(false), [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const ticketHistory = useRef<{ scope: TicketScope; page: number; request?: symbol }>({ scope: 'all', page: 0 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(1), [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [mode, setMode] = useState<OfferingResource | ''>(''), [editing, setEditing] = useState<Offering>(), [name, setName] = useState(''), [content, setContent] = useState(''), [image, setImage] = useState('');
  const [detail, setDetail] = useState<Detail>();
  const [previewOpen, setPreviewOpen] = useState(false), [previewAngle, setPreviewAngle] = useState(0);
  const [previewBusy, setPreviewBusy] = useState(false), [previewResult, setPreviewResult] = useState('');
  const itemDialog = useRef<HTMLDialogElement>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const itemDialogOpen = Boolean(mode || detail);
  useEffect(() => {
    const dialog = itemDialog.current;
    if (itemDialogOpen && dialog && !dialog.open) dialog.showModal();
    if (!itemDialogOpen && dialog?.open) dialog.close();
  }, [itemDialogOpen]);
  useEffect(() => {
    const dialog = previewDialog.current;
    if (previewOpen && dialog && !dialog.open) dialog.showModal();
    if (!previewOpen && dialog?.open) dialog.close();
  }, [previewOpen]);
  const requests = useRef(new Map<string, string>()), locked = useRef(false), recordId = useRef(''), imageInput = useRef<HTMLInputElement>(null);
  const previewTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => { if (previewTimer.current) window.clearTimeout(previewTimer.current); }, []);
  const retryDraw = requests.current.has(JSON.stringify(['draw', {}]));
  const userName = (id: string) => summary.space.members.find(m => m.userId === id)?.name || '成员';
  const ticketSourceLabel = (ticket: Ticket) => {
    if (ticket.source === 'draw') return '转盘抽奖';
    return ticket.providerId === summary.userId ? `赠给 ${userName(ticket.holderId)}` : `${userName(ticket.providerId)} 赠送`;
  };
  const ticketEventLabel = (ticket: Ticket) => {
    if (ticket.providerId === summary.userId) return ticket.source === 'draw' ? '开出' : '送出';
    return '获得';
  };
  const ticketStatusLabel = (ticket: Ticket) => {
    if (ticket.status === 'used') return '已兑现';
    return ticket.providerId === summary.userId ? '待兑现' : '待使用';
  };
  const partner = summary.space.members.find(m => m.userId !== summary.userId)!;
  const pool = prizes.filter(p => p.providerId !== summary.userId);
  const ownPrizes = prizes.filter((prize): prize is Prize => prize.providerId === summary.userId && 'content' in prize);
  const pendingCards = cards.filter(card => card.providerId === summary.userId);
  const loadTickets = useCallback(async (page = 0) => {
    const history = ticketHistory.current;
    const { scope } = history;
    const request = Symbol();
    history.request = request;
    setTicketLoading(true);
    setTicketError('');
    try {
      const data = await spaceRequest<PageResult<Ticket>>(`/tickets?page=${page}&scope=${scope}`);
      if (history.request !== request) return;
      const items = scope === 'all' ? data.items : data.items.filter(ticket =>
        (scope === 'received' ? ticket.holderId : ticket.providerId) === summary.userId);
      setTickets(previous => page ? [...previous, ...items] : items);
      setTicketMore(data.hasMore);
      history.page = page;
    } catch (cause) {
      if (history.request === request) setTicketError((cause as Error).message);
    } finally {
      if (history.request === request) {
        history.request = undefined;
        setTicketLoading(false);
      }
    }
  }, [summary.userId]);
  const load = useCallback(async (background = false) => {
    const history = ticketHistory.current;
    const refreshTickets = !background || (!history.page && !history.request);
    try {
      const [prizeList, cardList] = await Promise.all([
        spaceRequest<PageResult<PrizeSummary | Prize>>('/prizes'), spaceRequest<PageResult<GiftCard>>('/gift-cards'),
        refreshTickets && loadTickets(),
      ]);
      setPrizes(prizeList.items);
      setCards(cardList.items);
    } finally {
      setLoaded(true);
    }
  }, [loadTickets]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible' && !locked.current) void load(true).catch(e => setError(e.message)); }, 5000); return () => clearInterval(timer); }, [load]);
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
  function selectTicketScope(scope: TicketScope) {
    if (busy || scope === ticketHistory.current.scope) return;
    ticketHistory.current.scope = scope;
    ticketHistory.current.page = 0;
    setTicketScope(scope);
    setTickets([]);
    setTicketMore(false);
    void loadTickets();
  }
  function openWheelPreview() {
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    setPreviewAngle(0);
    setPreviewResult('');
    setPreviewBusy(false);
    setPreviewOpen(true);
  }
  function closeWheelPreview() {
    if (previewBusy) return;
    setPreviewOpen(false);
  }
  function simulateDraw() {
    if (previewBusy || !ownPrizes.length) return;
    const index = Math.floor(Math.random() * ownPrizes.length);
    const prizeName = ownPrizes[index].name;
    setPreviewBusy(true);
    setPreviewResult('');
    const offset = ownPrizes.length > 1 ? (index + .5) * 360 / ownPrizes.length : 0;
    setPreviewAngle(previous => Math.ceil(previous / 360) * 360 + 1800 - offset);
    previewTimer.current = window.setTimeout(() => {
      setPreviewBusy(false);
      setPreviewResult(prizeName);
      previewTimer.current = undefined;
    }, wheelSpinDurationMs);
  }
  async function action(operation: string, data: Record<string, unknown> = {}) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setMessage('');
    const key = JSON.stringify([operation, data]);
    // 网络重试保留请求编号，服务端以此原子去重。
    const requestId = requests.current.get(key) || crypto.randomUUID();
    requests.current.set(key, requestId);
    try {
      const result = await spaceRequest<Ticket>('/actions', 'POST', { operation, requestId, ...data });
      requests.current.delete(key);
      if (operation === 'draw') {
        const index = pool.findIndex(p => p.id === result.prizeId);
        if (index >= 0) {
          const offset = pool.length > 1 ? (index + .5) * 360 / pool.length : 0;
          setSpinning(true);
          setAngle(previous => Math.ceil(previous / 360) * 360 + 1800 - offset);
          await new Promise(resolve => setTimeout(resolve, wheelSpinDurationMs));
          setSpinning(false);
        }
        openDetails({ resource: 'tickets', item: result, presentation: 'draw-result' });
      } else { setMessage(operation === 'grant' ? '抽奖次数已送达' : operation === 'send-card' ? '心意已送达' : '已记录兑现时间'); }
      if (operation === 'send-card' || operation === 'redeem') setDetail(undefined);
      await Promise.all([load(), refresh()]);
    } catch (e) {
      if (e instanceof SpaceRequestError && e.status === 409) requests.current.delete(key);
      setError((e as Error).message);
    }
    finally { locked.current = false; setBusy(false); }
  }
  async function redeemTicket(ticket: Ticket) {
    if (confirm('确认已经为对方兑现这张券？')) await action('redeem', { ticketId: ticket.id });
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
    <OptionalSection key={`${mode}-${recordId.current}`} label="添加内容与图片（选填）" filled={Boolean(content.trim() || image)}>
      <label>内容<textarea maxLength={5000} value={content} disabled={busy} onChange={event => setContent(event.target.value)} /></label>
      <div className="sg-field offering-image-field">
        <span className="sg-label">图片</span>
        <div className="offering-image-editor">
          <div className="offering-image-thumbnail">
            {image ? <img src={`${image}?variant=preview`} alt={`${label}图片预览`} loading="lazy" /> : <ImagePlus aria-hidden="true" />}
          </div>
          <div className="offering-image-copy">
            <strong>{image ? '图片已上传' : '添加一张图片'}</strong>
            <span>{image ? '可更换或移除' : '支持 JPG、PNG、GIF、WebP'}</span>
          </div>
          <div className="offering-image-actions">
            <input ref={imageInput} className="offering-image-input" key={`${mode}-${recordId.current}`} type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={busy} onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void mutate(async () => setImage(await uploadSpaceMedia(file, false, file.name, false, { thumbnail: true })));
            }} />
            <button type="button" className="offering-image-action" disabled={busy} onClick={() => imageInput.current?.click()}>
              {image ? <RefreshCw aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
              {image ? '更换' : '上传'}
            </button>
            {image && <button type="button" className="offering-image-action offering-image-action--danger" disabled={busy} onClick={() => setImage('')}>
              <Trash2 aria-hidden="true" />移除
            </button>}
          </div>
        </div>
      </div>
    </OptionalSection>
    <div className="sg-list-actions"><button disabled={busy} type="button" className="sg-link sg-list-action" onClick={closeItemDialog}>取消</button><button disabled={busy} className="sg-link sg-list-action sg-list-action--accent">保存</button></div>
  </form>;
  function renderDetails({ resource, item, presentation }: Detail) {
    if (presentation === 'draw-result' && resource === 'tickets') return <div className="ticket-draw-result">
      <div className="ticket-draw-result__card">
        <div className="ticket-draw-result__prize">
          <span className="ticket-draw-result__star" aria-hidden="true">✦</span>
          <h3 className="ticket-draw-result__name">{item.name}</h3>
          {item.content && <p className="sg-text m-0">{item.content}</p>}
          <CardImage image={item.image} name={item.name} />
        </div>
        <p className="ticket-draw-result__status">已放入「我的卡券」</p>
      </div>
      <button type="button" className="sg-link sg-list-action ticket-primary ticket-draw-result__button" onClick={() => openDetails({ resource, item })}>
        查看这张券 <span aria-hidden="true">›</span>
      </button>
    </div>;
    if (presentation === 'send-preview' && resource === 'gift-cards') return <div className="ticket-dialog-preview">
      <p className="sg-muted">送给 {partner.name}</p>
      <h3 className="sg-list-title">{item.name}</h3>
      <CardImage image={item.image} name={item.name} />
      {item.content && <p className="sg-text">{item.content}</p>}
      <p className="sg-muted">送出后不可编辑或删除</p>
      <button type="button" className="sg-link sg-list-action ticket-primary" disabled={busy} onClick={() => void action('send-card', { cardId: item.id, version: item.version })}>确认赠送</button>
    </div>;
    const ticket = resource === 'tickets' ? item : undefined;
    const source = ticket ? ticketSourceLabel(ticket) : '';
    const eventLabel = ticket ? ticketEventLabel(ticket) : '';
    const canEdit = resource !== 'tickets' && item.providerId === summary.userId;
    const canRedeem = ticket?.providerId === summary.userId && ticket.status === 'unused';
    return <div className="ticket-detail-layout">
      {ticket && <div className="ticket-detail-overview">
        <span className="ticket-status" data-used={ticket.status === 'used'}>{ticketStatusLabel(ticket)}</span>
        <span>{source}</span>
      </div>}
      {(item.content || item.image || !ticket) && <div className="ticket-detail-content">
        {item.content && <p className="sg-text">{item.content}</p>}
        <CardImage image={item.image} name={item.name} />
        {!item.content && !item.image && !ticket && <p className="sg-muted">暂无补充内容</p>}
      </div>}
      {ticket && <dl className="ticket-detail-times">
        <div><dt>{eventLabel}时间</dt><dd><time dateTime={ticket.obtainedAt}>{displayTime(ticket.obtainedAt)}</time></dd></div>
        {ticket.usedAt && <div><dt>兑现时间</dt><dd><time dateTime={ticket.usedAt}>{displayTime(ticket.usedAt)}</time></dd></div>}
      </dl>}
      {(canEdit || canRedeem) && <div className={`sg-list-actions ticket-detail-actions${resource === 'gift-cards' ? ' ticket-detail-actions--gift' : ''}`}>
        {canEdit && <button type="button" className="sg-link sg-list-action" disabled={busy} onClick={() => openForm(resource, item)}>编辑</button>}
        {canEdit && resource === 'gift-cards' && <button type="button" className="sg-link sg-list-action ticket-primary" disabled={busy}
          onClick={() => openDetails({ resource, item, presentation: 'send-preview' })}>赠送给对方</button>}
        {canRedeem && ticket && <button type="button" className="sg-link sg-list-action sg-list-action--accent" disabled={busy} onClick={() => {
          void redeemTicket(ticket);
        }}>确认兑现</button>}
      </div>}
    </div>;
  }
  const balance = summary.balances[summary.userId] || 0;
  const wheelSection = <div className="ticket-layout ticket-layout--wheel">
    <section className="ticket-panel ticket-hero">
      <h2 className="ticket-hero-title">{partner.name} 的心意转盘</h2>
      <WheelVisual prizes={pool} angle={angle} emptyLabel="待开启" />
      <p className="ticket-balance">剩余 <strong>{balance}</strong> 次</p>
      <button type="button" className="sg-button ticket-draw" disabled={busy || (!retryDraw && (!pool.length || balance <= 0))} onClick={() => void action('draw')}>
        {spinning ? '转动中…' : busy ? '处理中…' : retryDraw ? '确认上次抽奖' : '转动心意'}
      </button>
      {(!pool.length || !balance) && (
        <p className="ticket-hint">{!pool.length ? '对方还没有准备奖项' : '等待对方赠送抽奖机会'}</p>
      )}
    </section>
    <div className="ticket-layout">
      <section className="ticket-panel ticket-panel--grant">
        <div className="ticket-heading">
          <div className="ticket-heading-copy">
            <h2>赠送抽奖次数</h2>
            <p className="ticket-hint">{partner.name} 可用 <strong>{summary.balances[partner.userId] || 0}</strong> 次</p>
          </div>
          <GrantHistoryDialog memberName={userName} disabled={busy} />
        </div>
        <form className="ticket-tools ticket-grant-tools" onSubmit={event => { event.preventDefault(); void action('grant', { amount }); }}>
          <label className="ticket-amount">次数 <input type="number" required min={1} max={1000} step={1} value={amount} onChange={event => setAmount(Number(event.target.value))} /></label>
          <button className="sg-link sg-list-action ticket-primary" disabled={busy}>赠送次数</button>
        </form>
      </section>
      <section className="ticket-panel">
        <div className="ticket-heading">
          <h2>我提供的奖池</h2>
          <div className="ticket-tools">
            <button type="button" className="sg-link sg-list-action" disabled={busy} onClick={openWheelPreview}>转盘预览</button>
            <button type="button" className="sg-link sg-list-action ticket-primary" disabled={busy} onClick={() => openForm('prizes')}>新增奖项</button>
          </div>
        </div>
        {ownPrizes.length > 0 ? <div className="sg-list-stack ticket-list">
          {ownPrizes.map(prize => <TicketRow key={prize.id} name={prize.name} image={prize.image} busy={busy} actionLabel="编辑"
            onView={() => openForm('prizes', prize)} onRemove={() => void remove('prizes', prize)} />)}
        </div> : <p className="ticket-empty">还没有提供奖项</p>}
      </section>
    </div>
  </div>;
  const cardsSection = <div className="ticket-layout ticket-layout--cards">
    <section className="ticket-panel ticket-panel--wallet">
      <div className="ticket-heading">
        <h2>待赠卡券</h2>
        <button type="button" className="sg-link sg-list-action ticket-primary" disabled={busy} onClick={() => openForm('gift-cards')}>创建卡券</button>
      </div>
      {pendingCards.length > 0 ? <div className="sg-list-stack ticket-list">
        {pendingCards.map(card => <TicketRow key={card.id} name={card.name} image={card.image} variant="gift" busy={busy}
          quickActionLabel="赠送" onQuickAction={() => openDetails({ resource: 'gift-cards', item: card, presentation: 'send-preview' })}
          onView={() => openDetails({ resource: 'gift-cards', item: card })} onRemove={() => void remove('gift-cards', card)} />)}
      </div> : <p className="ticket-empty">还没有待赠卡券</p>}
    </section>
    <section className="ticket-panel ticket-history">
      <div className="ticket-history-heading">
        <h2>双方奖券记录</h2>
        <div className="ticket-filters" role="group" aria-label="筛选奖券记录">
          {ticketScopes.map(({ id, label }) => <button key={id} type="button" className="ticket-filter" aria-pressed={id === ticketScope} disabled={busy} onClick={() => selectTicketScope(id)}>{label}</button>)}
        </div>
      </div>
      {ticketError && <p className="sg-error" role="alert">{ticketError}</p>}
      {tickets.length > 0 ? <div className="sg-list-stack ticket-list">
        {tickets.map(ticket => <TicketRow key={ticket.id} name={ticket.name} image={ticket.image}
          variant="ticket" status={ticket.status} statusLabel={ticketStatusLabel(ticket)}
          busy={busy}
          quickActionLabel={ticket.providerId === summary.userId && ticket.status === 'unused' ? '确认兑现' : undefined}
          onQuickAction={ticket.providerId === summary.userId && ticket.status === 'unused' ? () => void redeemTicket(ticket) : undefined}
          onView={() => openDetails({ resource: 'tickets', item: ticket })} />)}
      </div> : !ticketError && <p className="ticket-history-state" role="status">
        {ticketLoading ? '正在加载奖券…' : ticketMore ? '暂未找到匹配记录' : '暂无奖券记录'}
      </p>}
      {(ticketMore || ticketError) && <button type="button" className="sg-link sg-list-action ticket-more" disabled={busy || ticketLoading}
        onClick={() => void loadTickets(ticketMore ? ticketHistory.current.page + 1 : 0)}>
        {ticketLoading ? '正在加载…' : ticketError ? '重试' : tickets.length ? '更多奖券' : '继续查找'}
      </button>}
    </section>
  </div>;
  if (!loaded) return <SecondaryPageShell title="心意奖券" fallbackHref="/shiguang" contentClassName="sg-content sg-stack">
    <ShiguangLoading description="正在加载心意奖券" />
  </SecondaryPageShell>;

  return <SecondaryPageShell title="心意奖券" fallbackHref="/shiguang" contentClassName="sg-content sg-stack sg-tickets-page">
    <div id="sg-my-tickets" className="sg-ticket-tabs" role="group" aria-label="心意奖券分类">
      {sections.map(({ id, label }) => <button key={id} className="sg-ticket-tab" type="button" aria-pressed={id === section} disabled={busy} onClick={() => selectSection(id)}>
        {label}
      </button>)}
    </div>
    {!itemDialogOpen && error && <p className="sg-error" role="alert">{error}</p>}{message && <p className="ticket-feedback" role="status">{message}</p>}
    {section === 'wheel' ? wheelSection : cardsSection}
    <dialog ref={itemDialog} className="sg-ticket-dialog" aria-labelledby="sg-ticket-detail-title" onCancel={event => { event.preventDefault(); closeItemDialog(); }}>
      <div className="sg-ticket-dialog__header">
        <h2 className="sg-list-title" id="sg-ticket-detail-title">{mode ? `${editing ? '编辑' : '新增'}${label}` : detail?.presentation === 'draw-result' ? '抽中啦' : detail?.presentation === 'send-preview' ? '赠送卡券' : detail?.item.name}</h2>
        <button type="button" className="sg-ticket-dialog__close" aria-label="关闭" disabled={busy} onClick={closeItemDialog}>×</button>
      </div>
      <div className="sg-ticket-dialog__body" key={mode || detail?.presentation || 'detail'}>
        {itemDialogOpen && error && <p className="sg-error" role="alert">{error}</p>}
        {mode ? editor : detail && renderDetails(detail)}
      </div>
    </dialog>
    <dialog ref={previewDialog} className="sg-ticket-dialog wheel-preview-dialog" aria-labelledby="sg-wheel-preview-title" onCancel={event => { event.preventDefault(); closeWheelPreview(); }}>
      <div className="sg-ticket-dialog__header">
        <h2 className="sg-list-title" id="sg-wheel-preview-title">转盘预览</h2>
        <button type="button" className="sg-ticket-dialog__close" aria-label="关闭" disabled={previewBusy} onClick={closeWheelPreview}>×</button>
      </div>
      <div className="sg-ticket-dialog__body">
        <WheelVisual prizes={ownPrizes} angle={previewAngle} />
        <button type="button" className="sg-button ticket-draw wheel-preview-button" disabled={previewBusy || !ownPrizes.length} onClick={simulateDraw}>
          {previewBusy ? '转动中…' : previewResult ? '再抽一次' : '转动预览'}
        </button>
        {!ownPrizes.length && <p className="sg-muted">还没有提供奖项</p>}
        {previewResult && <p className="wheel-preview-result" role="status">抽中了「{previewResult}」</p>}
      </div>
    </dialog>
  </SecondaryPageShell>;
}
