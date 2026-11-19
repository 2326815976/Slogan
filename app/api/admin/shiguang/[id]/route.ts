import { activeMembership, requireAdmin } from '@/lib/shiguang/access';
import { body, respond } from '@/lib/shiguang/http';
import { adminSpaceView, getSpace, updateMember, updateSpace } from '@/lib/shiguang/spaces';
import { ShiguangError } from '@/lib/shiguang/validation';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return respond(async () => { const admin = await requireAdmin(request); return adminSpaceView(await getSpace((await context.params).id), admin.id); });
}
export async function PUT(request: Request, context: Context) {
  return respond(async () => { const admin = await requireAdmin(request), data = await body(request), { id } = await context.params;
    if (data.operation === 'member') {
      if ((await activeMembership(admin.id))?.spaceId !== id) throw new ShiguangError('仅空间成员可编辑成员资料', 403);
      return updateMember(id, admin.id, data, true);
    }
    return adminSpaceView(await updateSpace(admin.id, id, data) as Awaited<ReturnType<typeof getSpace>>, admin.id);
  });
}
export async function DELETE(request: Request, context: Context) {
  return respond(async () => { const admin = await requireAdmin(request); return updateSpace(admin.id, (await context.params).id, await body(request), true); });
}
