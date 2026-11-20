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
export async function uploadSpaceMedia(file: Blob, admin = false, filename = 'recording.webm', attachment = false): Promise<string> {
  const form = new FormData();
  form.append('file', file, file instanceof File ? file.name : filename);
  if (admin) form.append('purpose', 'admin');
  if (attachment) form.append('attachment', '1');
  const response = await fetch('/api/shiguang/media', { method: 'POST', body: form });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof result?.error === 'string' && result.error ? result.error : response.status === 413 ? '文件过大' : `上传失败（${response.status}）`);
  const reference = result?.data?.reference;
  if (typeof reference !== 'string' || !reference) throw new Error('未收到附件地址，请重试');
  return reference;
}
export function displayTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
export function displayMinute(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
}
