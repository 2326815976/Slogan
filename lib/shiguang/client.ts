'use client';

export class SpaceRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function spaceRequest<T>(path = '', method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path.startsWith('admin/') ? path : `shiguang${path}`}`, {
    method, credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new SpaceRequestError(typeof result.error === 'string' ? result.error : '请求失败，请重试', response.status);
  return result.data as T;
}
export async function uploadSpaceMedia(file: Blob, admin = false, filename = 'recording.webm'): Promise<string> {
  const form = new FormData();
  form.append('file', file, file instanceof File ? file.name : filename);
  if (admin) form.append('purpose', 'admin');
  const response = await fetch('/api/shiguang/media', { method: 'POST', body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '上传失败');
  return result.data.reference;
}
export function displayTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
