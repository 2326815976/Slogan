import 'server-only';
import { executeSQL, extractErrorMessage } from '@/lib/cloudbase/sql-executor';
import { tcb } from 'tencentcloud-sdk-nodejs-tcb';
import { env } from '@/lib/env';
import { ShiguangError } from './validation';

export type Row = Record<string, unknown>;
export async function rows(sql: string, params: Record<string, unknown> = {}): Promise<Row[]> {
  return (await executeSQL(sql, params)).rows as Row[];
}
// 数据模型 SDK 不支持 CALL；仅事务过程使用官方 RunSql，其余查询沿用 SQL 执行器。
// 字符串按 UTF-8 十六进制编码，过程名固定，禁止传入任意 SQL。
export async function callProcedure(name: 'shiguang_create_v1' | 'shiguang_ticket_v1', args: (string | number)[]): Promise<void> {
  const values = args.map(value => typeof value === 'number'
    ? String(value)
    : `CONVERT(X'${Buffer.from(value, 'utf8').toString('hex')}' USING utf8mb4)`);
  const client = new tcb.v20180608.Client({
    credential: { secretId: env.CLOUDBASE_SECRET_ID(), secretKey: env.CLOUDBASE_SECRET_KEY() },
    region: env.CLOUDBASE_SQL_REGION() || 'ap-shanghai',
    profile: { httpProfile: { reqTimeout: 20 } },
  });
  await client.RunSql({ EnvId: env.CLOUDBASE_ID(), Sql: `CALL ${name}(${values.join(',')})`, ReadOnly: false });
}
export function timestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const s = String(value ?? '');
  return s && !/[zZ]|[+-]\d{2}:\d{2}$/.test(s) ? `${s.replace(' ', 'T')}Z` : s;
}
const ERROR_MESSAGES: Record<string, string> = {
  SG_DIFFERENT_USERS: '男生和女生必须是不同账号', SG_USER_BOUND: '所选用户已绑定拾光空间，禁用或删除后也不能重新绑定',
  SG_USER_UNAVAILABLE: '所选用户不存在或已禁用', SG_ADMIN_REQUIRED: '需要管理员权限', SG_ALBUM_UNAVAILABLE: '请选择现存的专属返图空间',
  SG_REQUEST_CONFLICT: '该请求编号已用于其他操作，请刷新后重试', SG_SPACE_UNAVAILABLE: '拾光空间已禁用或删除', SG_MEMBER_REQUIRED: '仅空间成员可访问',
  SG_INVALID_AMOUNT: '每次可给予 1 至 1000 次机会', SG_BALANCE_LIMIT: '对方剩余次数已达到上限', SG_NO_CHANCES: '抽奖次数不足',
  SG_EMPTY_POOL: '对方尚未设置奖池', SG_INVALID_INPUT: '请检查填写内容', SG_PROVIDER_REQUIRED: '仅提供人可以核销这张奖券',
};
export function publicError(error: unknown): { message: string; status: number } {
  if (error instanceof ShiguangError) return { message: error.message, status: error.status };
  const detail = extractErrorMessage(error);
  const matched = Object.keys(ERROR_MESSAGES).find(code => detail.includes(code));
  if (matched) return { message: ERROR_MESSAGES[matched], status: matched.includes('REQUIRED') ? 403 : 409 };
  if (/duplicate entry/i.test(detail)) return { message: '记录已存在，请刷新；成员不可重复绑定，每日心情只能有一条', status: 409 };
  console.error('[shiguang]', { message: detail });
  return { message: '拾光服务暂时不可用，请稍后重试', status: 503 };
}
