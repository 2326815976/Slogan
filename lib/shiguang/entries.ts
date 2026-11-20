import 'server-only';
import { executeSQL } from '@/lib/cloudbase/sql-executor';
import { ACTIVE_SPACE_SQL } from './access';
import { rows, timestamp, type Row } from './db';
import { beijingDate, canManageEntry, date, entryKind, entryPayload, integer, messageContent, object, ShiguangError, uuid } from './validation';
import type { Entry, EntryPayload, Reply } from './types';
import { cleanTopic } from './topics';

const SORT_ORDER_SQL = "CAST(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.sortOrder')) AS UNSIGNED)";
const CREATED_ORDER_SQL = 'created_at DESC,id DESC';
const ANNIVERSARY_ORDER_SQL = `COALESCE(${SORT_ORDER_SQL}, 0) ASC,${CREATED_ORDER_SQL}`;
const WISH_STATUS_ORDER_SQL = "CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(payload, '$.status')) = 'fulfilled' THEN 1 ELSE 0 END";
const WISH_ORDER_SQL = `${WISH_STATUS_ORDER_SQL} ASC,COALESCE(${SORT_ORDER_SQL}, 100000) ASC,${CREATED_ORDER_SQL}`;

export function toEntry(row: Row): Entry {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  return { id: String(row.id), kind: entryKind(String(row.kind)), payload: object(payload) as EntryPayload,
    createdBy: String(row.created_by), createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
    moodDate: row.mood_date ? (row.mood_date instanceof Date ? row.mood_date.toISOString() : String(row.mood_date)).slice(0, 10) : null, version: Number(row.version) };
}
function toReply(row: Row): Reply {
  return { id: String(row.id), entryId: String(row.entry_id), content: String(row.content), audio: String(row.audio ?? ''), image: String(row.image ?? ''), video: String(row.video ?? ''),
    createdBy: String(row.created_by), createdAt: timestamp(row.created_at), version: Number(row.version) };
}
export async function validateMemberMedia(space: string, user: string, payload: EntryPayload) {
  const requested = [
    ...(['image', 'audio', 'video'] as const).map(type => ({ type, ref: payload[type] })),
    ...(payload.media || []).map(item => ({ type: item.type, ref: item.reference })),
  ];
  for (const { type, ref } of requested) {
    if (!ref) continue;
    const mediaId = ref.split('/').pop();
    const result = await rows('SELECT id,mime_type FROM shiguang_media WHERE id={{id}} AND space_id={{space}} AND uploaded_by={{user}} AND purpose=\'member\'', { id: mediaId, space, user });
    if (!result[0] || !String(result[0].mime_type).startsWith(`${type}/`)) throw new ShiguangError('媒体不属于当前成员或类型错误', 403);
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
  const author = kind === 'whisper' ? url.searchParams.get('author') : '';
  const topic = kind === 'whisper' ? cleanTopic(url.searchParams.get('topic')) : '';
  const keyword = kind === 'whisper' ? String(url.searchParams.get('q') || '').trim().slice(0, 100) : '';
  const order = kind === 'anniversary' ? ANNIVERSARY_ORDER_SQL : kind === 'wish' ? WISH_ORDER_SQL : CREATED_ORDER_SQL;
  const filters: string[] = [];
  const params: Record<string, unknown> = { space, kind };
  if (kind === 'mood' && day) {
    filters.push('mood_date={{day}}');
    params.day = date(day);
  }
  if (kind === 'whisper') {
    if (day) {
      filters.push('DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))={{day}}');
      params.day = date(day);
    }
    if (author) {
      filters.push('created_by={{author}}');
      params.author = uuid(author);
    }
    if (topic) {
      filters.push("(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.title'))={{topic}} OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.content')) LIKE CONCAT('%#',{{topic}},'%'))");
      params.topic = topic;
    }
    if (keyword) {
      filters.push("(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.content')) LIKE CONCAT('%',{{keyword}},'%') OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.title')) LIKE CONCAT('%',{{keyword}},'%'))");
      params.keyword = keyword;
    }
  }
  const result = await rows(`SELECT * FROM shiguang_entries WHERE space_id={{space}} AND kind={{kind}}
    ${filters.length ? `AND ${filters.join(' AND ')}` : ''} ORDER BY ${order} LIMIT 31 OFFSET ${page * 30}`, params);
  return { items: result.slice(0, 30).map(toEntry), hasMore: result.length > 30 };
}
export async function listAnniversaries(space: string): Promise<Entry[]> {
  const result = await rows(`SELECT * FROM shiguang_entries WHERE space_id={{space}} AND kind='anniversary' ORDER BY ${ANNIVERSARY_ORDER_SQL}`, { space });
  return result.map(toEntry);
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
  const input = remove ? current.payload : object(data.payload);
  // 旧客户端未传排序时保留原值，编辑名称或日期不会意外改变轮播顺序。
  const payload = remove ? current.payload : entryPayload(current.kind,
    current.kind === 'anniversary' || current.kind === 'wish' ? { sortOrder: current.payload.sortOrder, ...input } : input);
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
  const id = uuid(data.id), message = messageContent(data, '回复', 2000);
  const existing = await rows('SELECT * FROM shiguang_replies WHERE id={{id}}', { id });
  if (existing[0]) {
    if (existing[0].created_by !== user || existing[0].entry_id !== entryId || existing[0].space_id !== space) throw new ShiguangError('请求编号已占用', 409);
    return toReply(existing[0]);
  }
  await validateMemberMedia(space, user, message);
  const result = await executeSQL(`INSERT INTO shiguang_replies(id,entry_id,space_id,content,audio,image,video,created_by,created_at)
    SELECT {{id}},{{entryId}},{{space}},{{content}},{{audio}},{{image}},{{video}},{{user}},UTC_TIMESTAMP(3) WHERE ${ACTIVE_SPACE_SQL}`, { id, entryId, space, user, ...message });
  if (!result.affectedRows) throw new ShiguangError('空间已停止访问', 403);
  return { id };
}
export async function changeReply(space: string, user: string, id: string, data: Record<string, unknown>, remove = false) {
  const params = { id: uuid(id), space, user, version: integer(data.version, 1, 2147483647) };
  const where = `id={{id}} AND space_id={{space}} AND created_by={{user}} AND version={{version}} AND ${ACTIVE_SPACE_SQL}`;
  const message = remove ? null : messageContent(data, '回复', 2000);
  if (message) await validateMemberMedia(space, user, message);
  const mediaUpdates = ['audio', 'image', 'video'].filter(field => field in data).map(field => `,${field}={{${field}}}`).join('');
  const result = message
    ? await executeSQL(`UPDATE shiguang_replies SET content={{content}}${mediaUpdates},version=version+1 WHERE ${where}`, { ...params, ...message })
    : await executeSQL(`DELETE FROM shiguang_replies WHERE ${where}`, params);
  if (!result.affectedRows) throw new ShiguangError('仅可管理自己的回复；记录也可能已变化，请刷新', 409);
  return { id };
}
