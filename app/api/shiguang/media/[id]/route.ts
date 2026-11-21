import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { publicError } from '@/lib/shiguang/db';
import { requireUser } from '@/lib/shiguang/access';
import { playableRecording } from '@/lib/shiguang/audio-compat';
import { downloadImagePreview, downloadMedia, mediaRecord } from '@/lib/shiguang/media';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params, record = await mediaRecord(id, user);
    const query = new URL(request.url).searchParams;
    const isPreview = query.get('variant') === 'preview';
    const { content, mime } = isPreview
      ? { content: await downloadImagePreview(record), mime: 'image/webp' }
      : await playableRecording(await downloadMedia(record), String(record.mime_type), String(record.file_id));
    const headers = { 'Content-Type': mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
    if (query.get('view') === 'avatar') {
      if (!headers['Content-Type'].startsWith('image/')) {
        return NextResponse.json({ error: '头像必须是图片' }, { status: 415, headers: { 'Cache-Control': 'private, no-store' } });
      }
      const preview = await sharp(content, { limitInputPixels: 40000000 })
        .rotate()
        .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      return NextResponse.json({ data: { image: preview.toString('base64') } }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return new NextResponse(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${content.length}` } });
      const start = Number(match[1]), end = Math.min(match[2] ? Number(match[2]) : content.length - 1, content.length - 1);
      if (start > end || start >= content.length) return new NextResponse(null, { status: 416, headers });
      return new NextResponse(new Uint8Array(content.subarray(start, end + 1)), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${content.length}`, 'Content-Length': String(end - start + 1) } });
    }
    return new NextResponse(new Uint8Array(content), { headers: { ...headers, 'Content-Length': String(content.length) } });
  } catch (error) { const result = publicError(error); return NextResponse.json({ error: result.message }, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } }); }
}
