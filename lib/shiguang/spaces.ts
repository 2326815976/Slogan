import 'server-only';
import { executeSQL } from '@/lib/cloudbase/sql-executor';
import { ACTIVE_SPACE_SQL } from './access';
import { callProcedure, rows, timestamp, type Row } from './db';
import { toEntry } from './entries';
import { beijingDate, integer, mediaReference, object, ShiguangError, text, uuid } from './validation';
import type { AdminOptions, ShiguangSpace, ShiguangSummary, SpaceMember } from './types';
import { publication } from './publication';

function member(r: Row): SpaceMember { return { userId: String(r.user_id), role: r.member_role === 'boy' ? 'boy' : 'girl', name: String(r.name), avatar: String(r.avatar || '') }; }
function space(r: Row, members: SpaceMember[]): ShiguangSpace {
  return { id: String(r.id), name: String(r.name), cover: String(r.cover || ''), letter: String(r.letter || ''), albumId: String(r.album_id), enabled: Boolean(Number(r.enabled)), deletedAt: r.deleted_at ? timestamp(r.deleted_at) : null, createdAt: timestamp(r.created_at), version: Number(r.version), members };
}
export async function getSpace(id: string): Promise<ShiguangSpace> {
  const [spaces, members] = await Promise.all([rows('SELECT * FROM shiguang_spaces WHERE id={{id}}', { id }), rows('SELECT * FROM shiguang_members WHERE space_id={{id}} ORDER BY member_role', { id })]);
  if (!spaces[0]) throw new ShiguangError('空间不存在', 404);
  return space(spaces[0], members.map(member));
}
export async function summary(spaceId: string, userId: string, channel: 'web' | 'miniprogram' = 'web'): Promise<ShiguangSummary> {
  const today = beijingDate();
  const [current, moods, wallets] = await Promise.all([getSpace(spaceId), rows('SELECT * FROM shiguang_entries WHERE space_id={{spaceId}} AND kind=\'mood\' AND mood_date={{today}}', { spaceId, today }), rows('SELECT user_id,balance FROM shiguang_wallets WHERE space_id={{spaceId}}', { spaceId })]);
  return { userId, today, space: current, moods: moods.map(toEntry), balances: Object.fromEntries(wallets.map(r => [String(r.user_id), Number(r.balance)])), publishState: await publication(channel) === 'beta' ? 'beta' : 'online' };
}
export async function adminSpaces(page: number) {
  const result = await rows(`SELECT * FROM shiguang_spaces ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET ${integer(page, 0, 100000) * 20}`);
  const members = result.length ? await rows(`SELECT * FROM shiguang_members WHERE space_id IN (${result.map((_, i) => `{{s${i}}}`).join(',')})`, Object.fromEntries(result.map((r, i) => [`s${i}`, r.id]))) : [];
  return { items: result.slice(0, 20).map(r => space(r, members.filter(m => m.space_id === r.id).map(member))), hasMore: result.length > 20 };
}
export async function adminOptions(): Promise<AdminOptions> {
  const [users, albums] = await Promise.all([
    rows(`SELECT u.id,p.name,u.phone,u.admin_note,m.space_id FROM users u LEFT JOIN profiles p ON p.id=u.id
      LEFT JOIN shiguang_members m ON m.user_id=u.id WHERE u.deleted_at <=> NULL AND u.is_disabled=0 ORDER BY u.created_at DESC LIMIT 2000`),
    rows("SELECT id,title FROM albums WHERE id <> '00000000-0000-0000-0000-000000000000' ORDER BY created_at DESC LIMIT 2000"),
  ]);
  // 管理员选人统一使用手机号和备注名，不暴露微信账号生成的邮箱。
  return { users: users.map(r => ({ id: String(r.id), name: String(r.name || '未命名用户'), label: `${String(r.phone || '').trim() || '未绑定手机号'} · ${String(r.admin_note || '').trim() || '未设置备注'}`, bound: Boolean(r.space_id) })), albums: albums.map(r => ({ id: String(r.id), title: String(r.title) })) };
}
async function validateAdminImage(ref: string, adminId: string, spaceId?: string) {
  if (!ref) return;
  const id = ref.split('/').pop();
  const result = await rows(`SELECT id FROM shiguang_media WHERE id={{id}} AND mime_type LIKE 'image/%'
    AND (uploaded_by={{admin}} OR space_id={{space}})`, { id, admin: adminId, space: spaceId || '' });
  if (!result[0]) throw new ShiguangError('请上传可用图片');
}
export async function createSpace(adminId: string, data: Record<string, unknown>) {
  const id = uuid(data.id), boyId = uuid(data.boyId), girlId = uuid(data.girlId), albumId = uuid(data.albumId);
  if (boyId === girlId) throw new ShiguangError('男生女生必须为不同账号');
  const name = text(data.name, '空间名称', 100), cover = mediaReference(data.cover, true), letter = text(data.letter, '信件', 20000, false);
  if (typeof data.enabled !== 'boolean') throw new ShiguangError('空间状态错误');
  await validateAdminImage(cover, adminId);
  await callProcedure('shiguang_create_v1', [id, adminId, boyId, girlId, name, cover, letter, albumId, data.enabled ? 1 : 0]);
  return getSpace(id);
}
export async function updateSpace(adminId: string, id: string, data: Record<string, unknown>, remove = false) {
  const current = await getSpace(uuid(id));
  if (current.deletedAt) throw new ShiguangError('已删除空间不支持编辑', 409);
  if ('boyId' in data || 'girlId' in data) throw new ShiguangError('成员绑定后不可解绑或换绑');
  const version = integer(data.version, 1, 2147483647);
  if (remove) {
    const result = await executeSQL('UPDATE shiguang_spaces SET enabled=0,deleted_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3),version=version+1 WHERE id={{id}} AND version={{version}} AND deleted_at <=> NULL', { id, version });
    if (!result.affectedRows) throw new ShiguangError('空间已变化，请刷新', 409);
    return { id };
  }
  const name = text(data.name, '空间名称', 100), cover = mediaReference(data.cover, true), letter = text(data.letter, '信件', 20000, false), albumId = uuid(data.albumId);
  if (typeof data.enabled !== 'boolean') throw new ShiguangError('空间状态错误');
  if (cover !== current.cover) await validateAdminImage(cover, adminId, id);
  const albums = await rows('SELECT id FROM albums WHERE id={{albumId}}', { albumId });
  if (!albums.length) throw new ShiguangError('返图空间不存在');
  const result = await executeSQL('UPDATE shiguang_spaces SET name={{name}},cover={{cover}},letter={{letter}},album_id={{albumId}},enabled={{enabled}},updated_at=UTC_TIMESTAMP(3),version=version+1 WHERE id={{id}} AND version={{version}} AND deleted_at <=> NULL', { id, version, name, cover, letter, albumId, enabled: data.enabled ? 1 : 0 });
  if (!result.affectedRows) throw new ShiguangError('空间已变化，请刷新', 409);
  return getSpace(id);
}
export async function updateMember(spaceId: string, actorId: string, data: Record<string, unknown>, admin = false) {
  const userId = admin ? uuid(data.userId) : actorId;
  const name = text(data.name, '空间名称', 100), avatar = text(data.avatar, '头像', 1024, false);
  const current = await rows('SELECT avatar FROM shiguang_members WHERE space_id={{space}} AND user_id={{user}}', { space: spaceId, user: userId });
  if (!current[0]) throw new ShiguangError('成员不存在', 404);
  if (avatar && avatar !== current[0].avatar) {
    mediaReference(avatar, true);
    const mediaId = avatar.split('/').pop();
    const media = await rows(`SELECT id FROM shiguang_media WHERE id={{mediaId}} AND uploaded_by={{actor}} AND mime_type LIKE 'image/%' ${admin ? '' : 'AND space_id={{space}}'}`, { mediaId, actor: actorId, space: spaceId });
    if (!media[0]) throw new ShiguangError('头像不属于当前操作者', 403);
  }
  await executeSQL(`UPDATE shiguang_members SET name={{name}},avatar={{avatar}} WHERE user_id={{user}} AND space_id={{space}} ${admin ? '' : `AND ${ACTIVE_SPACE_SQL}`}`, { name, avatar, user: userId, space: spaceId });
  // 资料未变化时 MySQL 也可能返回零行；单独确认状态，避免误报或停用竞态。
  if (!admin && !(await rows(`SELECT id FROM shiguang_spaces WHERE id={{space}} AND ${ACTIVE_SPACE_SQL}`, { space: spaceId })).length) throw new ShiguangError('空间已停止访问', 403);
  return { userId };
}
export async function albumLink(spaceId: string) {
  const result = await rows('SELECT a.access_key FROM shiguang_spaces s JOIN albums a ON a.id=s.album_id WHERE s.id={{space}} AND s.enabled=1 AND s.deleted_at <=> NULL', { space: spaceId });
  if (!result[0]) throw new ShiguangError('绑定的返图空间已不存在', 404);
  const key = String(result[0].access_key);
  return { webPath: `/album/${encodeURIComponent(key)}`, miniPath: `/pages/album/detail?key=${encodeURIComponent(key)}` };
}
