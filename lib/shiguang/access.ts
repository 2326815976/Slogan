import 'server-only';
import { resolveAuthContextFromRequest } from '@/lib/auth/context';
import { rows } from './db';
import { ShiguangError } from './validation';
import type { AuthUser } from '@/lib/auth/types';
import { canVisitPublishedSpace } from './publication';

export async function requireUser(request: Request): Promise<AuthUser> {
  const auth = await resolveAuthContextFromRequest(request);
  if (auth.transientFailure) throw new ShiguangError('登录服务暂时不可用', 503);
  if (!auth.context.user) throw new ShiguangError('请先登录', 401);
  return auth.context.user;
}
export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await requireUser(request);
  if (user.role !== 'admin') throw new ShiguangError('需要管理员权限', 403);
  return user;
}
export async function activeMembership(userId: string): Promise<{ spaceId: string; partnerId: string } | null> {
  const result = await rows(`SELECT m.space_id, partner.user_id AS partner_id FROM shiguang_members m
    JOIN shiguang_spaces s ON s.id=m.space_id JOIN shiguang_members partner ON partner.space_id=s.id AND partner.user_id<>m.user_id
    WHERE m.user_id={{user}} AND s.enabled=1 AND s.deleted_at <=> NULL LIMIT 1`, { user: userId });
  return result[0] ? { spaceId: String(result[0].space_id), partnerId: String(result[0].partner_id) } : null;
}
export async function requireMember(request: Request) {
  const user = await requireUser(request);
  const membership = await activeMembership(user.id);
  if (!membership) throw new ShiguangError('未绑定可用拾光空间，或空间已禁用、删除', 403);
  const channel = request.headers.get('x-shiguang-channel') === 'miniprogram' ? 'miniprogram' : 'web';
  if (!(await canVisitPublishedSpace(user.id, channel))) throw new ShiguangError('拾光空间尚未上线或未获得内测资格', 403);
  return { user, ...membership };
}
// 每次写入都带空间有效状态条件，不能靠客户端隐藏按钮保护数据。
export const ACTIVE_SPACE_SQL = 'EXISTS (SELECT 1 FROM shiguang_spaces s WHERE s.id={{space}} AND s.enabled=1 AND s.deleted_at <=> NULL)';
