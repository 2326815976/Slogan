import 'server-only';
import { createHash } from 'crypto';
import { executeSQL } from '@/lib/cloudbase/sql-executor';
import { ACTIVE_SPACE_SQL } from './access';
import { callProcedure, rows, timestamp, type Row } from './db';
import { integer, ShiguangError, text, uuid } from './validation';
import type { Grant, Prize, Ticket } from './types';

function toPrize(r: Row): Prize { return { id: String(r.id), name: String(r.name), content: String(r.content), providerId: String(r.provider_id), drawerId: String(r.drawer_id), createdAt: timestamp(r.created_at), version: Number(r.version) }; }
function toTicket(r: Row): Ticket { return { id: String(r.id), name: String(r.name), content: String(r.content), providerId: String(r.provider_id), holderId: String(r.holder_id), source: r.source === 'draw' ? 'draw' : 'gift', status: r.status === 'used' ? 'used' : 'unused', obtainedAt: timestamp(r.obtained_at), usedAt: r.used_at ? timestamp(r.used_at) : null, prizeId: r.prize_id ? String(r.prize_id) : null }; }
function toGrant(r: Row): Grant { return { id: String(r.id), giverId: String(r.giver_id), receiverId: String(r.receiver_id), amount: Number(r.amount), createdAt: timestamp(r.created_at) }; }
export async function listPrizes(space: string) {
  const result = await rows('SELECT * FROM shiguang_prizes WHERE space_id={{space}} ORDER BY created_at,id', { space });
  return { items: result.map(toPrize), hasMore: false };
}
export async function listTicketHistory(space: string, resource: 'tickets' | 'grants', page: number) {
  const offset = integer(page, 0, 100000) * 30;
  const result = await rows(`SELECT * FROM ${resource === 'tickets' ? 'shiguang_tickets' : 'shiguang_grants'} WHERE space_id={{space}}
    ORDER BY ${resource === 'tickets' ? 'obtained_at' : 'created_at'} DESC,id DESC LIMIT 31 OFFSET ${offset}`, { space });
  return { items: result.slice(0, 30).map(r => resource === 'tickets' ? toTicket(r) : toGrant(r)), hasMore: result.length > 30 };
}
export async function savePrize(space: string, user: string, partner: string, data: Record<string, unknown>, id?: string, remove = false) {
  const prizeId = uuid(id || data.id);
  const name = remove ? '' : text(data.name, '奖项名称', 100);
  const content = remove ? '' : text(data.content, '奖项内容', 5000);
  const params = { id: prizeId, space, user, partner, name, content, version: id ? integer(data.version, 1, 2147483647) : 1 };
  let sql: string;
  if (id) {
    const where = `id={{id}} AND space_id={{space}} AND provider_id={{user}} AND version={{version}} AND ${ACTIVE_SPACE_SQL}`;
    sql = remove ? `DELETE FROM shiguang_prizes WHERE ${where}` : `UPDATE shiguang_prizes SET name={{name}},content={{content}},version=version+1 WHERE ${where}`;
  } else {
    const existing = await rows('SELECT * FROM shiguang_prizes WHERE id={{id}}', { id: prizeId });
    if (existing[0]) {
      if (existing[0].provider_id !== user || existing[0].space_id !== space) throw new ShiguangError('请求编号已占用', 409);
      return toPrize(existing[0]);
    }
    sql = `INSERT INTO shiguang_prizes(id,space_id,provider_id,drawer_id,name,content,created_at)
      SELECT {{id}},{{space}},{{user}},{{partner}},{{name}},{{content}},UTC_TIMESTAMP(3) WHERE ${ACTIVE_SPACE_SQL}`;
  }
  const result = await executeSQL(sql, params);
  if (!result.affectedRows) throw new ShiguangError('仅可管理自己提供的奖项；记录已变化时请刷新', 409);
  return { id: prizeId };
}
export async function ticketOperation(space: string, user: string, data: Record<string, unknown>) {
  const operation = text(data.operation, '操作', 16);
  if (!['draw', 'grant', 'gift', 'redeem'].includes(operation)) throw new ShiguangError('不支持的奖券操作');
  const requestId = uuid(data.requestId);
  const amount = operation === 'grant' ? integer(data.amount, 1, 1000) : 0;
  const name = operation === 'gift' ? text(data.name, '卡券名称', 100) : '';
  const content = operation === 'gift' ? text(data.content, '卡券内容', 5000) : '';
  const ticketId = operation === 'redeem' ? uuid(data.ticketId) : '';
  const fingerprint = createHash('sha256').update(JSON.stringify([space, user, operation, amount, name, content, ticketId])).digest('hex');
  await callProcedure('shiguang_ticket_v1', [space, user, requestId, operation, fingerprint, amount, name, content, ticketId]);
  const result = await rows('SELECT result_id FROM shiguang_operations WHERE id={{id}} AND actor_id={{user}} AND space_id={{space}}', { id: requestId, user, space });
  if (!result[0]) throw new ShiguangError('操作尚未确认，请使用原请求重试', 503);
  if (operation === 'grant') return { id: String(result[0].result_id) };
  const tickets = await rows('SELECT * FROM shiguang_tickets WHERE id={{id}} AND space_id={{space}}', { id: result[0].result_id, space });
  if (!tickets[0]) throw new ShiguangError('奖券尚未确认，请重试', 503);
  return toTicket(tickets[0]);
}
