import { requireAdmin } from '@/lib/shiguang/access';
import { body, respond } from '@/lib/shiguang/http';
import { getSpace, updateMember, updateSpace } from '@/lib/shiguang/spaces';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return respond(async () => { await requireAdmin(request); return getSpace((await context.params).id); });
}
export async function PUT(request: Request, context: Context) {
  return respond(async () => { const admin = await requireAdmin(request), data = await body(request), { id } = await context.params;
    return data.operation === 'member' ? updateMember(id, admin.id, data, true) : updateSpace(admin.id, id, data); });
}
export async function DELETE(request: Request, context: Context) {
  return respond(async () => { const admin = await requireAdmin(request); return updateSpace(admin.id, (await context.params).id, await body(request), true); });
}
