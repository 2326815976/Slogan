import { redirect } from 'next/navigation';
import PoseViewer from './PoseViewer';
import { buildWebShellRuntime } from '@/lib/page-center/runtime';
import { getSessionUserFromServerCookies } from '@/lib/auth/context';
import { withSpaceNavigation } from '@/lib/shiguang/navigation';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] || '').trim() : String(value || '').trim();
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const presentation = readSearchParam(resolvedSearchParams.presentation);
  const pageKey = readSearchParam(resolvedSearchParams.page_key);
  const isPreviewMode = presentation === 'preview' && Boolean(pageKey);

  if (!isPreviewMode) {
    let homePath = '/';
    try {
      const user = await getSessionUserFromServerCookies();
      const runtime = await withSpaceNavigation(await buildWebShellRuntime(), user?.id);
      homePath = String(runtime.homePath || '/').trim();
    } catch (error) {
      console.error('[home] 读取默认入口失败', error instanceof Error ? error.message : 'unknown');
      // 运行时读取失败时，回退为默认首页内容
    }
    if (homePath && homePath !== '/') redirect(homePath);
  }

  return <PoseViewer initialTags={[]} initialPose={null} initialPoses={[]} />;
}
