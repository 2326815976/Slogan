import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import { getCloudBaseApp } from '@/lib/cloudbase/sdk';
import { env } from '@/lib/env';
import { executeSQL } from '@/lib/cloudbase/sql-executor';
import { activeMembership, requireMember, requireUser } from './access';
import { rows, type Row } from './db';
import { ShiguangError, uuid } from './validation';
import type { AuthUser } from '@/lib/auth/types';

const AUDIO_TYPES = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/x-m4a']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
function secret() {
  const value = process.env.SHIGUANG_MEDIA_SECRET || env.CLOUDBASE_SECRET_KEY();
  if (!value) throw new ShiguangError('空间媒体密钥尚未配置', 503);
  return value;
}
function mediaKey() { return createHash('sha256').update(`slogan-shiguang-media-v1:${secret()}`).digest(); }
export function encryptMedia(plain: Buffer): Buffer {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', mediaKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from('SG01'), iv, cipher.getAuthTag(), encrypted]);
}
export function decryptMedia(encrypted: Buffer): Buffer {
  if (encrypted.subarray(0, 4).toString() !== 'SG01') throw new Error('Invalid Shiguang media');
  const decipher = createDecipheriv('aes-256-gcm', mediaKey(), encrypted.subarray(4, 16));
  decipher.setAuthTag(encrypted.subarray(16, 32));
  return Buffer.concat([decipher.update(encrypted.subarray(32)), decipher.final()]);
}
async function canReadMedia(user: Pick<AuthUser, 'id' | 'role'>, row: Row) {
  const membership = await activeMembership(user.id);
  if (row.space_id) return row.space_id === membership?.spaceId;
  const ref = `/api/shiguang/media/${row.id}`;
  const linked = membership ? await rows(`SELECT s.id FROM shiguang_spaces s WHERE s.id={{space}} AND
    (s.cover={{ref}} OR EXISTS(SELECT 1 FROM shiguang_members m WHERE m.space_id=s.id AND m.avatar={{ref}}))`, { space: membership.spaceId, ref }) : [];
  if (linked.length) return true;
  if (row.purpose !== 'admin' || user.role !== 'admin' || row.uploaded_by !== user.id) return false;
  const references = await rows(`SELECT 1 FROM shiguang_spaces WHERE cover={{ref}}
    UNION ALL SELECT 1 FROM shiguang_members WHERE avatar={{ref}} LIMIT 1`, { ref });
  return references.length === 0;
}
export async function mediaRecord(id: string, user: Pick<AuthUser, 'id' | 'role'>) {
  const result = await rows('SELECT * FROM shiguang_media WHERE id={{id}}', { id: uuid(id) });
  if (!result[0] || !await canReadMedia(user, result[0])) throw new ShiguangError('无权读取空间媒体', 403);
  return result[0];
}
export async function uploadMedia(request: Request) {
  const user = await requireUser(request);
  if (Number(request.headers.get('content-length') || 0) > 16 * 1024 * 1024) throw new ShiguangError('文件过大', 413);
  const form = await request.formData();
  const admin = form.get('purpose') === 'admin';
  if (admin && user.role !== 'admin') throw new ShiguangError('需要管理员权限', 403);
  const membership = admin ? null : await requireMember(request);
  const file = form.get('file');
  if (!(file instanceof File)) throw new ShiguangError('请选择图片或录音');
  const type = file.type.split(';')[0].toLowerCase();
  if (!IMAGE_TYPES.has(type) && (!AUDIO_TYPES.has(type) || admin)) throw new ShiguangError('仅支持常见图片与音频格式');
  const maxSize = IMAGE_TYPES.has(type) ? 8 * 1024 * 1024 : 15 * 1024 * 1024;
  if (file.size === 0 || file.size > maxSize) throw new ShiguangError(`文件大小应在 1 字节至 ${maxSize / 1024 / 1024}MB 之间`);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (IMAGE_TYPES.has(type)) {
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(buffer, { limitInputPixels: 40000000 }).metadata();
    if (!['jpeg', 'png', 'webp', 'gif'].includes(metadata.format || '')) throw new ShiguangError('图片格式无效');
  }
  const id = randomUUID();
  const result = await getCloudBaseApp().uploadFile({ cloudPath: `shiguang/${id}.bin`, fileContent: encryptMedia(buffer) }) as { fileID?: string };
  if (!result.fileID) throw new ShiguangError('上传未完成，请重试', 503);
  // 管理员上传封面时尚未绑定空间，避免 SDK 将 null 写成字符串。
  await executeSQL(`INSERT INTO shiguang_media(id,space_id,uploaded_by,purpose,mime_type,file_id,byte_length,created_at)
    VALUES({{id}},${membership ? '{{space}}' : 'NULL'},{{user}},{{purpose}},{{type}},{{file}},{{size}},UTC_TIMESTAMP(3))`,
  { id, space: membership?.spaceId || null, user: user.id, purpose: admin ? 'admin' : 'member', type, file: result.fileID, size: buffer.length });
  return { reference: `/api/shiguang/media/${id}` };
}
export async function memberMediaLinks(request: Request, ids: string[]) {
  const user = await requireUser(request);
  if (ids.length > 100) throw new ShiguangError('媒体数量过多');
  const result: Record<string, string> = {};
  for (const id of new Set(ids)) {
    try { await mediaRecord(id, user); }
    catch (error) {
      if (error instanceof ShiguangError && error.status === 403) continue;
      throw error;
    }
    const path = `/api/shiguang/media/${id}`;
    result[path] = path;
  }
  return result;
}
export async function downloadMedia(row: Row) {
  const result = await getCloudBaseApp().downloadFile({ fileID: String(row.file_id) }) as { fileContent: Buffer };
  return decryptMedia(Buffer.from(result.fileContent));
}
