import { NextResponse } from 'next/server';
import { publicError } from '@/lib/shiguang/db';
import { downloadMedia, mediaRecord, mediaUser } from '@/lib/shiguang/media';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params, user = await mediaUser(request, id), record = await mediaRecord(id, user);
    const content = await downloadMedia(record);
    const headers = { 'Content-Type': String(record.mime_type), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return new NextResponse(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${content.length}` } });
      const start = Number(match[1]), end = Math.min(match[2] ? Number(match[2]) : content.length - 1, content.length - 1);
      if (start > end || start >= content.length) return new NextResponse(null, { status: 416, headers });
      return new NextResponse(new Uint8Array(content.subarray(start, end + 1)), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${content.length}`, 'Content-Length': String(end - start + 1) } });
    }
    return new NextResponse(new Uint8Array(content), { headers: { ...headers, 'Content-Length': String(content.length) } });
  } catch (error) { const result = publicError(error); return NextResponse.json({ error: result.message }, { status: result.status }); }
}
