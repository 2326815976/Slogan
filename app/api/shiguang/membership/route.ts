import { getSessionUserFromRequest } from '@/lib/auth/context';
import { activeMembership } from '@/lib/shiguang/access';
import { respond } from '@/lib/shiguang/http';
import { publication } from '@/lib/shiguang/publication';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return respond(async () => {
    const user = await getSessionUserFromRequest(request);
    const channel = request.headers.get('x-shiguang-channel') === 'miniprogram' ? 'miniprogram' : 'web';
    const active = Boolean(user && await activeMembership(user.id));
    const state = await publication(channel);
    return { enabled: active && state === 'online', publishState: state, userId: user?.id || '' };
  });
}
