import { NextResponse } from 'next/server';
import {
  isRetryableSqlError,
  logSqlError,
  TRANSIENT_BACKEND_ERROR_CODE,
  TRANSIENT_BACKEND_ERROR_MESSAGE,
} from '@/lib/cloudbase/sql-executor';
import { buildWebShellRuntime } from '@/lib/page-center/runtime';
import { getSessionUserFromRequest } from '@/lib/auth/context';
import { withSpaceNavigation } from '@/lib/shiguang/navigation';

export const dynamic = 'force-dynamic';

const WEB_RUNTIME_CACHE_TTL_MS = 5 * 1000;

let webShellRuntimeCache:
  | {
      data: Awaited<ReturnType<typeof buildWebShellRuntime>>;
      expiresAt: number;
    }
  | null = null;

export async function GET(request: Request) {
  const now = Date.now();

  try {
    const data = webShellRuntimeCache && webShellRuntimeCache.expiresAt > now ? webShellRuntimeCache.data : await buildWebShellRuntime();
    if (!webShellRuntimeCache || webShellRuntimeCache.expiresAt <= now) {
      webShellRuntimeCache = { data, expiresAt: now + WEB_RUNTIME_CACHE_TTL_MS };
    }
    // 全局缓存仅存公共页面配置，成员菜单必须在缓存外按会话计算。
    const user = await getSessionUserFromRequest(request);
    return NextResponse.json(await withSpaceNavigation(data, user?.id), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (isRetryableSqlError(error)) {
      logSqlError('读取 Web 页面壳运行时失败:', error);
      return NextResponse.json(
        {
          error: {
            message: TRANSIENT_BACKEND_ERROR_MESSAGE,
            code: TRANSIENT_BACKEND_ERROR_CODE,
          },
        },
        { status: 503 }
      );
    }

    logSqlError('读取 Web 页面壳运行时失败:', error);
    return NextResponse.json({ error: '读取 Web 页面壳运行时失败' }, { status: 500 });
  }
}
