import { requireAdmin } from '@/lib/shiguang/access';
import { body, respond } from '@/lib/shiguang/http';
import { adminOptions, adminSpaces, createSpace } from '@/lib/shiguang/spaces';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return respond(async () => { await requireAdmin(request); const url = new URL(request.url); return url.searchParams.has('options') ? adminOptions() : adminSpaces(Number(url.searchParams.get('page') || 0)); });
}
export async function POST(request: Request) {
  return respond(async () => { const admin = await requireAdmin(request); return createSpace(admin.id, await body(request)); });
}
