import { requireMember } from '@/lib/shiguang/access';
import { respond } from '@/lib/shiguang/http';
import { summary } from '@/lib/shiguang/spaces';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return respond(async () => { const access = await requireMember(request); return summary(access.spaceId, access.user.id, request.headers.get('x-shiguang-channel') === 'miniprogram' ? 'miniprogram' : 'web'); });
}
