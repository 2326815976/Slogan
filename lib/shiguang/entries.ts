import 'server-only';
import { executeSQL } from '@/lib/cloudbase/sql-executor';
import { ACTIVE_SPACE_SQL } from './access';
import { rows, timestamp, type Row } from './db';
import { beijingDate, canManageEntry, date, entryKind, entryPayload, integer, object, ShiguangError, text, uuid } from './validation';
import type { Entry, EntryPayload, Reply } from './types';

export function toEntry(row: Row): Entry {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  return { id: String(row.id), kind: entryKind(String(row.kind)), payload: object(payload) as EntryPayload,
    createdBy: String(row.created_by), createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
    moodDate: row.mood_date ? (row.mood_date instanceof Date ? row.mood_date.toISOString() : String(row.mood_date)).slice(0, 10) : null, version: Number(row.version) };
}
function toReply(row: Row): Reply {
  return { id: String(row.id), entryId: String(row.entry_id), content: String(row.content), createdBy: String(row.created_by), createdAt: timestamp(row.created_at), version: Number(row.version) };
}
export async function validateMemberMedia(space: string, user: string, payload: EntryPayload) {
  for (const ref of [payload.image, payload.audio].filter(Boolean)) {
    const mediaId = String(ref).split('/').pop();
    const result = await rows('SELECT id,mime_type FROM shiguang_media WHERE id={{id}} AND space_id={{space}} AND uploaded_by={{user}} AND purpose=\'member\'', { id: mediaId, space, user });
    if (!result[0] || (ref === payload.audio ? !String(result[0].mime_type).startsWith('audio/') : !String(result[0].mime_type).startsWith('image/'))) throw new ShiguangError('媒体不属于当前成员或类型错误', 403);
  }
}
export async function findEntry(space: string, id: string) {
  const result = await rows('SELECT * FROM shiguang_entries WHERE id={{id}} AND space_id={{space}}', { id: uuid(id), space });
  if (!result[0]) throw new ShiguangError('内容不存在', 404);
  return toEntry(result[0]);
}
export async function listEntries(space: string, resource: string, url: URL) {
  const kind = entryKind(resource);
  const page = integer(url.searchParams.get('page') ?? 0, 0, 100000);
  const day = url.searchParams.get('date');
  const result = await rows(`SELECT * FROM shiguang_entries WHERE space_id={{space}} AND kind={{kind}}
    ${kind === 'mood' && day ? 'AND mood_date={{day}}' : ''} ORDER BY created_at DESC,id DESC LIMIT 31 OFFSET ${page * 30}`, { space, kind, day: day ? date(day) : null });
  return { items: result.slice(0, 30).map(toEntry), hasMore: result.length > 30 };
}
export async function createEntry(space: string, user: string, resource: string, data: Record<string, unknown>) {
  const kind = entryKind(resource);
  const id = uuid(data.id);
  const payload = entryPayload(kind, data.payload);
  await validateMemberMedia(space, user, payload);
  const existing = await rows('SELECT * FROM shiguang_entries WHERE id={{id}}', { id });
  if (existing[0]) {
    if (existing[0].space_id !== space || existing[0].created_by !== user || existing[0].kind !== kind) throw new ShiguangError('请求编号已占用', 409);
    return toEntry(existing[0]);
  }
  // CloudBase 数据模型 SDK 会把 null 参数转换为字符串，非心情日期须使用 SQL NULL。
  const moodDateSql = kind === 'mood' ? '{{day}}' : 'NULL';
  const result = await executeSQL(`INSERT INTO shiguang_entries (id,space_id,kind,payload,mood_date,created_by,created_at,updated_at)
    SELECT {{id}},{{space}},{{kind}},{{payload}},${moodDateSql},{{user}},UTC_TIMESTAMP(3),UTC_TIMESTAMP(3) WHERE ${ACTIVE_SPACE_SQL}`,
  { id, space, kind, payload: JSON.stringify(payload), day: kind === 'mood' ? beijingDate() : null, user });
  if (!result.affectedRows) throw new ShiguangError('空间已停止访问', 403);
  return findEntry(space, id);
}
export async function changeEntry(space: string, user: string, resource: string, id: string, data: Record<string, unknown>, remove = false) {
  const current = await findEntry(space, id);
  if (current.kind !== entryKind(resource)) throw new ShiguangError('内容类型不匹配', 404);
  if (!canManageEntry(current, user)) throw new ShiguangError(current.kind === 'mood' ? '只能管理自己当天的心情' : '只能管理自己发布的内容', 403);
  const version = integer(data.version, 1, 2147483647);
  const payload = remove ? current.payload : entryPayload(current.kind, data.payload);
  if (!remove) await validateMemberMedia(space, user, payload);
  const params = { id, space, version, payload: JSON.stringify(payload), today: beijingDate(), user };
  const where = `id={{id}} AND space_id={{space}} AND version={{version}} AND ${ACTIVE_SPACE_SQL}
    ${current.kind === 'mood' ? 'AND mood_date={{today}} AND created_by={{user}}' : ''}`;
  const result = await executeSQL(remove ? `DELETE FROM shiguang_entries WHERE ${where}`
    : `UPDATE shiguang_entries SET payload={{payload}},updated_at=UTC_TIMESTAMP(3),version=version+1 WHERE ${where}`, params);
  if (!result.affectedRows) throw new ShiguangError('内容已变化或空间已停止访问，请刷新', 409);
  return remove ? { id } : findEntry(space, id);
}
export async function listReplies(space: string, entryId: string, page = 0) {
  const entry = await findEntry(space, entryId);
  if (entry.kind !== 'whisper') throw new ShiguangError('仅絮语支持回复');
  const offset = integer(page, 0, 100000) * 30;
  const result = await rows(`SELECT * FROM shiguang_replies WHERE space_id={{space}} AND entry_id={{entryId}} ORDER BY created_at DESC,id DESC LIMIT 31 OFFSET ${offset}`, { space, entryId });
  return { items: result.slice(0, 30).map(toReply), hasMore: result.length > 30 };
}
export async function createReply(space: string, user: string, data: Record<string, unknown>) {
  const entryId = uuid(data.entryId);
  const entry = await findEntry(space, entryId);
  if (entry.kind !== 'whisper') throw new ShiguangError('仅絮语支持回复');
  const id = uuid(data.id), content = text(data.content, '回复', 2000);
  const existing = await rows('SELECT * FROM shiguang_replies WHERE id={{id}}', { id });
  if (existing[0]) {
    if (existing[0].created_by !== user || existing[0].entry_id !== entryId || existing[0].space_id !== space) throw new ShiguangError('请求编号已占用', 409);
    return toReply(existing[0]);
  }
  const result = await executeSQL(`INSERT INTO shiguang_replies(id,entry_id,space_id,content,created_by,created_at)
    SELECT {{id}},{{entryId}},{{space}},{{content}},{{user}},UTC_TIMESTAMP(3) WHERE ${ACTIVE_SPACE_SQL}`, { id, entryId, space, content, user });
  if (!result.affectedRows) throw new ShiguangError('空间已停止访问', 403);
  return { id };
}
export async function changeReply(space: string, user: string, id: string, data: Record<string, unknown>, remove = false) {
  const content = remove ? '' : text(data.content, '回复', 2000);
  const params = { id: uuid(id), space, user, version: integer(data.version, 1, 2147483647), content };
  const where = `id={{id}} AND space_id={{space}} AND created_by={{user}} AND version={{version}} AND ${ACTIVE_SPACE_SQL}`;
  const result = await executeSQL(remove ? `DELETE FROM shiguang_replies WHERE ${where}`
    : `UPDATE shiguang_replies SET content={{content}},version=version+1 WHERE ${where}`, params);
  if (!result.affectedRows) throw new ShiguangError('仅可管理自己的回复；记录也可能已变化，请刷新', 409);
  return { id };
}
