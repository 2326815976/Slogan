import 'server-only';
import { rows } from './db';
import { ShiguangError } from './validation';

export function publicAlbumClause(albumId: string) {
  return `NOT EXISTS (SELECT 1 FROM shiguang_spaces private_space
    WHERE private_space.album_id=${albumId} AND private_space.album_members_only=1)`;
}

export function publicPhotoClause(photoId: string, { materializeSource = false } = {}) {
  const privatePhotoJoin = `album_photos source_photo JOIN shiguang_spaces private_space
    ON private_space.album_id=source_photo.album_id AND private_space.album_members_only=1`;
  const source = materializeSource
    ? `(SELECT DISTINCT source_photo.id FROM ${privatePhotoJoin}) source_photo`
    : privatePhotoJoin;
  return `NOT EXISTS (SELECT 1 FROM ${source}
    WHERE source_photo.id=${photoId} OR MD5(CONCAT('wall:',source_photo.id))=REPLACE(${photoId},'-',''))`;
}

export async function checkAlbumAccess(albumId: string, userId?: string) {
  const result = await rows(`SELECT NOT (${publicAlbumClause('{{album}}')}) AS protected_album,
    EXISTS (SELECT 1 FROM shiguang_spaces s JOIN shiguang_members m ON m.space_id=s.id
      JOIN shiguang_members partner ON partner.space_id=s.id AND partner.user_id<>m.user_id
      WHERE s.album_id={{album}} AND s.album_members_only=1 AND s.enabled=1 AND s.deleted_at <=> NULL
        AND m.released_at <=> NULL AND partner.released_at <=> NULL AND m.user_id={{user}}) AS is_member`,
    { album: albumId, user: userId || '' });
  if (!result[0]) throw new ShiguangError('相册权限服务暂不可用', 503);
  const protectedAlbum = Boolean(Number(result[0].protected_album));
  if (protectedAlbum && (!userId || !Number(result[0].is_member))) throw new ShiguangError('无权访问此相册', 403);
  return protectedAlbum;
}

export function privateAlbumAssetPath(id: string, variant: 'cover' | 'thumbnail' | 'preview' | 'original') {
  return `/api/shiguang/album-assets/${encodeURIComponent(id)}?variant=${variant}`;
}

export function protectAlbumPhotoUrls(photo: Record<string, unknown>) {
  const id = String(photo.id);
  photo.url = photo.preview_url = privateAlbumAssetPath(id, 'preview');
  photo.thumbnail_url = privateAlbumAssetPath(id, 'thumbnail');
  photo.original_url = privateAlbumAssetPath(id, 'original');
}
