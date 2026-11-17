import { requireMember } from '@/lib/shiguang/access';
import { changeEntry, changeReply } from '@/lib/shiguang/entries';
import { body, respond } from '@/lib/shiguang/http';
import { savePrize } from '@/lib/shiguang/tickets';
type Context = { params: Promise<{ resource: string; id: string }> };
async function change(request: Request, context: Context, remove: boolean) {
  return respond(async () => {
    const { resource, id } = await context.params, access = await requireMember(request), data = await body(request);
    if (resource === 'prizes') return savePrize(access.spaceId, access.user.id, access.partnerId, data, id, remove);
    if (resource === 'replies') return changeReply(access.spaceId, access.user.id, id, data, remove);
    return changeEntry(access.spaceId, access.user.id, resource, id, data, remove);
  });
}
export const PUT = (request: Request, context: Context) => change(request, context, false);
export const DELETE = (request: Request, context: Context) => change(request, context, true);
