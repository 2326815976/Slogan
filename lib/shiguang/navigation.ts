import 'server-only';
import type { WebShellRuntime } from '@/lib/page-center/config';
import { activeMembership } from './access';
import { publication } from './publication';

export async function withSpaceNavigation(runtime: WebShellRuntime, userId?: string): Promise<WebShellRuntime> {
  const navItems = runtime.navItems.filter(item => item.pageKey !== 'shiguang');
  if (!userId || !(await activeMembership(userId)) || await publication('web') !== 'online') return { ...runtime, navItems };
  return { ...runtime, homePath: '/shiguang', navItems: [
    { pageKey: 'shiguang', href: '/shiguang', label: '拾光', guestLabel: '拾光', iconKey: 'hearts', isHomeEntry: true },
    ...navItems.map(item => ({ ...item, isHomeEntry: false })),
  ] };
}
