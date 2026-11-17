import 'server-only';
import { rows } from './db';
import { checkUserPageBetaAccess } from '@/lib/page-center/user-beta';

export async function publication(channel: 'web' | 'miniprogram' = 'web'): Promise<'online' | 'beta' | 'offline'> {
  const result = await rows(`SELECT r.publish_state FROM app_page_publish_rules r JOIN app_page_registry p ON p.id=r.page_id
    WHERE p.page_key='shiguang' AND r.channel={{channel}} LIMIT 1`, { channel });
  const state = result[0]?.publish_state;
  return state === 'offline' || state === 'beta' ? state : 'online';
}
export async function canVisitPublishedSpace(userId: string, channel: 'web' | 'miniprogram' = 'web') {
  const state = await publication(channel);
  if (state === 'online') return true;
  if (state === 'offline') return false;
  try { return Boolean(await checkUserPageBetaAccess(userId, 'shiguang', channel)); }
  catch (error) {
    // 内测资格拒绝属于正常状态；数据库异常交由上层报告。
    if (error instanceof Error && /未开放|已下线|已过期|未获得|无权|未解锁|内测资格/.test(error.message)) return false;
    throw error;
  }
}
