import { requireMember } from '@/lib/shiguang/access';
import { createEntry, createReply, listEntries, listReplies } from '@/lib/shiguang/entries';
import { body, respond } from '@/lib/shiguang/http';
import { albumLink, updateMember } from '@/lib/shiguang/spaces';
import { listGiftCards, listPrizes, listTicketHistory, saveOffering, ticketOperation } from '@/lib/shiguang/tickets';
import { memberMediaLinks } from '@/lib/shiguang/media';
import { ShiguangError } from '@/lib/shiguang/validation';
type Context = { params: Promise<{ resource: string }> };
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: Context) {
  return respond(async () => {
    const { resource } = await context.params, access = await requireMember(request), url = new URL(request.url);
    if (resource === 'album') return albumLink(access.spaceId);
    if (resource === 'prizes') return listPrizes(access.spaceId);
    if (resource === 'gift-cards') return listGiftCards(access.spaceId);
    if (resource === 'tickets' || resource === 'grants') return listTicketHistory(access.spaceId, resource, Number(url.searchParams.get('page') || 0));
    if (resource === 'replies') return listReplies(access.spaceId, url.searchParams.get('entryId') || '', Number(url.searchParams.get('page') || 0));
    return listEntries(access.spaceId, resource, url);
  });
}
export async function POST(request: Request, context: Context) {
  return respond(async () => {
    const { resource } = await context.params;
    if (resource === 'media-links') {
      const data = await body(request);
      if (!Array.isArray(data.ids) || !data.ids.every(id => typeof id === 'string')) throw new ShiguangError('媒体参数错误');
      return memberMediaLinks(request, data.ids as string[]);
    }
    const access = await requireMember(request), data = await body(request);
    if (resource === 'actions') return ticketOperation(access.spaceId, access.user.id, data);
    if (resource === 'profile') return updateMember(access.spaceId, access.user.id, data);
    if (resource === 'prizes' || resource === 'gift-cards') return saveOffering(resource, access.spaceId, access.user.id, access.partnerId, data);
    if (resource === 'replies') return createReply(access.spaceId, access.user.id, data);
    return createEntry(access.spaceId, access.user.id, resource, data);
  });
}
