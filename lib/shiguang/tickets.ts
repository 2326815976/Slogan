import 'server-only';
import { createHash } from 'crypto';
import { executeSQL } from '@/lib/cloudbase/sql-executor';
import { ACTIVE_SPACE_SQL } from './access';
import { callProcedure, rows, timestamp, type Row } from './db';
import { integer, mediaReference, ShiguangError, text, uuid } from './validation';
import type { GiftCard, Grant, PageResult, Prize, PrizeSummary, Ticket } from './types';

function cardSummary(row: Row): PrizeSummary {
  return { id: String(row.id), name: String(row.name), providerId: String(row.provider_id) };
}
function cardDetails(row: Row) {
  return { ...cardSummary(row), content: String(row.content), image: String(row.image ?? '') };
}
function toPrize(row: Row): Prize {
  return { ...cardDetails(row), drawerId: String(row.drawer_id), createdAt: timestamp(row.created_at), version: Number(row.version) };
}
function toGiftCard(row: Row): GiftCard {
  return { ...cardDetails(row), holderId: String(row.holder_id), createdAt: timestamp(row.created_at), version: Number(row.version) };
}
function toTicket(r: Row): Ticket { return { ...cardDetails(r), holderId: String(r.holder_id), source: r.source === 'draw' ? 'draw' : 'gift', status: r.status === 'used' ? 'used' : 'unused', obtainedAt: timestamp(r.obtained_at), usedAt: r.used_at ? timestamp(r.used_at) : null, prizeId: r.prize_id ? String(r.prize_id) : null }; }
function toGrant(r: Row): Grant { return { id: String(r.id), giverId: String(r.giver_id), receiverId: String(r.receiver_id), amount: Number(r.amount), createdAt: timestamp(r.created_at) }; }
export async function listPrizes(space: string, viewer: string): Promise<PageResult<PrizeSummary | Prize>> {
  const result = await rows(`SELECT id,name,provider_id,drawer_id,created_at,version,
    CASE WHEN provider_id={{viewer}} THEN content END AS content,
    CASE WHEN provider_id={{viewer}} THEN image END AS image
    FROM shiguang_prizes WHERE space_id={{space}} ORDER BY created_at,id`, { space, viewer });
  const items = result.map(row => String(row.provider_id) === viewer ? toPrize(row) : cardSummary(row));
  return { items, hasMore: false };
}
export async function listGiftCards(space: string) {
  const result = await rows('SELECT * FROM shiguang_gift_cards WHERE space_id={{space}} AND sent_at <=> NULL ORDER BY created_at DESC,id DESC', { space });
  return { items: result.map(toGiftCard), hasMore: false };
}
export async function listTicketHistory(space: string, resource: 'tickets' | 'grants', page: number, viewer: string, scope: string) {
  if (scope !== 'all' && scope !== 'received' && scope !== 'provided') throw new ShiguangError('奖券筛选条件无效');
  const offset = integer(page, 0, 100000) * 30;
  const memberFilter = resource === 'tickets' && scope !== 'all'
    ? ` AND ${scope === 'received' ? 'holder_id' : 'provider_id'}={{viewer}}`
    : '';
  const result = await rows(`SELECT * FROM ${resource === 'tickets' ? 'shiguang_tickets' : 'shiguang_grants'} WHERE space_id={{space}}
    ${memberFilter} ORDER BY ${resource === 'tickets' ? 'obtained_at' : 'created_at'} DESC,id DESC LIMIT 31 OFFSET ${offset}`,
    memberFilter ? { space, viewer } : { space });
  return { items: result.slice(0, 30).map(r => resource === 'tickets' ? toTicket(r) : toGrant(r)), hasMore: result.length > 30 };
}
export async function saveOffering(resource: 'prizes' | 'gift-cards', space: string, user: string, partner: string, data: Record<string, unknown>, id?: string, remove = false) {
  const recordId = uuid(id || data.id);
  const gift = resource === 'gift-cards';
  const table = gift ? 'shiguang_gift_cards' : 'shiguang_prizes';
  const label = gift ? '卡券' : '奖项';
  const name = remove ? '' : text(data.name, `${label}名称`, 100);
  const content = remove ? '' : text(data.content, `${label}内容`, 5000, false);
  const image = remove ? '' : mediaReference(data.image);
  const params = { id: recordId, space, user, partner, name, content, image, version: id ? integer(data.version, 1, 2147483647) : 1 };
  if (image) {
    const media = await rows(`SELECT id FROM shiguang_media WHERE id={{mediaId}} AND space_id={{space}}
      AND uploaded_by={{user}} AND purpose='member' AND mime_type LIKE 'image/%'`, { mediaId: uuid(image.split('/').pop()), space, user });
    if (!media[0]) throw new ShiguangError('请选择自己在当前空间上传的图片');
  }
  let sql: string;
  if (id) {
    const where = `id={{id}} AND space_id={{space}} AND provider_id={{user}} AND version={{version}}
      ${gift ? 'AND sent_at <=> NULL' : ''} AND ${ACTIVE_SPACE_SQL}`;
    const imageUpdate = data.image === undefined ? '' : ',image={{image}}';
    sql = remove ? `DELETE FROM ${table} WHERE ${where}` : `UPDATE ${table} SET name={{name}},content={{content}}${imageUpdate},version=version+1 WHERE ${where}`;
  } else {
    const existing = await rows(`SELECT space_id,provider_id FROM ${table} WHERE id={{id}}`, { id: recordId });
    if (existing[0]) {
      if (existing[0].provider_id !== user || existing[0].space_id !== space) throw new ShiguangError('请求编号已占用', 409);
      return { id: recordId };
    }
    sql = `INSERT INTO ${table}(id,space_id,provider_id,${gift ? 'holder_id' : 'drawer_id'},name,content,image,created_at)
      SELECT {{id}},{{space}},{{user}},{{partner}},{{name}},{{content}},{{image}},UTC_TIMESTAMP(3) WHERE ${ACTIVE_SPACE_SQL}`;
  }
  const result = await executeSQL(sql, params);
  if (!result.affectedRows) throw new ShiguangError(`仅可管理自己的${gift ? '待赠卡券' : '奖项'}，记录有变化时请刷新`, 409);
  return { id: recordId };
}
export async function ticketOperation(space: string, user: string, data: Record<string, unknown>) {
  const operation = text(data.operation, '操作', 16);
  if (!['draw', 'grant', 'gift', 'send-card', 'redeem'].includes(operation)) throw new ShiguangError('不支持的奖券操作');
  const requestId = uuid(data.requestId);
  const amount = operation === 'grant' ? integer(data.amount, 1, 1000) : 0;
  const name = operation === 'gift' ? text(data.name, '卡券名称', 100) : '';
  const content = operation === 'gift' ? text(data.content, '卡券内容', 5000) : '';
  const ticketId = operation === 'redeem' ? uuid(data.ticketId) : '';
  const cardId = operation === 'send-card' ? uuid(data.cardId) : '';
  const version = operation === 'send-card' ? integer(data.version, 1, 2147483647) : 0;
  const identity = [space, user, operation, amount, name, content, ticketId];
  if (operation === 'send-card') identity.push(cardId, version);
  const fingerprint = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  if (operation === 'draw' || operation === 'send-card') {
    await callProcedure('shiguang_issue_ticket_v2', [space, user, requestId, operation, fingerprint, cardId, version]);
  } else {
    await callProcedure('shiguang_ticket_v1', [space, user, requestId, operation, fingerprint, amount, name, content, ticketId]);
  }
  const result = await rows('SELECT result_id FROM shiguang_operations WHERE id={{id}} AND actor_id={{user}} AND space_id={{space}}', { id: requestId, user, space });
  if (!result[0]) throw new ShiguangError('操作尚未确认，请使用原请求重试', 503);
  if (operation === 'grant') return { id: String(result[0].result_id) };
  const tickets = await rows('SELECT * FROM shiguang_tickets WHERE id={{id}} AND space_id={{space}}', { id: result[0].result_id, space });
  if (!tickets[0]) throw new ShiguangError('奖券尚未确认，请重试', 503);
  return toTicket(tickets[0]);
}
