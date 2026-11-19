import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getCloudBaseApp } from '@/lib/cloudbase/sdk';
import { resolveCloudBaseFileId } from '@/lib/cloudbase/storage';
import { requireMember } from '@/lib/shiguang/access';
import { publicError, rows } from '@/lib/shiguang/db';
import { ShiguangError, uuid } from '@/lib/shiguang/validation';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const imageTypes = new Map([['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp'], ['gif', 'image/gif'], ['heif', 'image/avif']]);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { spaceId } = await requireMember(request);
    const id = uuid((await context.params).id);
    const variant = new URL(request.url).searchParams.get('variant');
    const album = await rows('SELECT a.id, a.cover_url FROM albums a JOIN shiguang_spaces s ON s.album_id=a.id WHERE s.id={{space}} AND s.enabled=1 AND s.deleted_at <=> NULL', { space: spaceId });
    if (!album[0]) throw new ShiguangError('照片不可用', 404);

    let source: unknown;
    if (variant === 'cover') {
      if (album[0].id === id) source = album[0].cover_url;
    } else {
      const [photo] = await rows('SELECT url, thumbnail_url, preview_url, original_url FROM album_photos WHERE id={{id}} AND album_id={{album}}', { id, album: album[0].id });
      if (photo) {
        if (variant === 'thumbnail') source = photo.thumbnail_url || photo.preview_url || photo.original_url || photo.url;
        if (variant === 'preview') source = photo.preview_url || photo.original_url || photo.thumbnail_url || photo.url;
        if (variant === 'original') source = photo.original_url || photo.url || photo.preview_url || photo.thumbnail_url;
      }
    }
    const fileId = resolveCloudBaseFileId(String(source ?? ''));
    if (!fileId) throw new ShiguangError('照片不可用', 404);
    const file = await getCloudBaseApp().downloadFile({ fileID: fileId }) as { fileContent: Buffer };
    const bytes = Buffer.from(file.fileContent);
    const { format } = await sharp(bytes).metadata();
    const mime = imageTypes.get(format || '');
    if (!mime) throw new ShiguangError('照片格式不可用', 415);
    return new NextResponse(new Uint8Array(bytes), { headers: { ...headers, 'Content-Type': mime } });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ error: result.message }, { status: result.status, headers });
  }
}
