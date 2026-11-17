import { ENTRY_KINDS, SHARED_KINDS, type Entry, type EntryKind, type EntryPayload } from './types';

export class ShiguangError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = 'ShiguangError'; }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ShiguangError('请求格式错误');
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max: number, required = true): string {
  if (value != null && typeof value !== 'string') throw new ShiguangError(`${label}格式错误`);
  const result = String(value ?? '').trim();
  if ((required && !result) || result.length > max) throw new ShiguangError(`${label}${!result ? '不能为空' : `不能超过 ${max} 字`}`);
  return result;
}
export function uuid(value: unknown): string {
  const result = text(value, '标识', 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new ShiguangError('标识格式错误');
  return result.toLowerCase();
}
export function integer(value: unknown, min: number, max: number): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) throw new ShiguangError(`请输入 ${min} 到 ${max} 的整数`);
  return result;
}
export function entryKind(value: string): EntryKind {
  if (!ENTRY_KINDS.includes(value as EntryKind)) throw new ShiguangError('不支持的内容类型', 404);
  return value as EntryKind;
}
export function beijingDate(now = new Date()): string { return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10); }
export function date(value: unknown): string {
  const result = text(value, '日期', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(`${result}T00:00:00Z`)) || new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result) throw new ShiguangError('日期格式错误');
  return result;
}
export function mediaReference(value: unknown, required = false): string {
  const result = text(value, '媒体', 1024, required);
  if (result && !/^\/api\/shiguang\/media\/[0-9a-f-]{36}$/.test(result)) throw new ShiguangError('请先上传空间图片或录音');
  return result;
}
export function entryPayload(kind: EntryKind, input: unknown): EntryPayload {
  const p = object(input);
  switch (kind) {
    case 'anniversary':
      if (p.direction !== 'up' && p.direction !== 'down') throw new ShiguangError('请选择正数或倒数');
      return { name: text(p.name, '名称', 100), date: date(p.date), direction: p.direction };
    case 'wish':
      if (p.status !== 'pending' && p.status !== 'fulfilled') throw new ShiguangError('许愿状态错误');
      return { content: text(p.content, '愿望', 5000), status: p.status };
    case 'promise': return { title: text(p.title, '标题', 100), content: text(p.content, '内容', 10000) };
    case 'whisper':
      if (p.type !== 'text' && p.type !== 'audio') throw new ShiguangError('请选择文字或音频');
      return { title: text(p.title, '标题', 100), type: p.type, content: text(p.content, '内容', 10000, p.type === 'text'), audio: p.type === 'audio' ? mediaReference(p.audio, true) : '' };
    case 'mood': return { mood: text(p.mood, '心情', 30), description: text(p.description, '描述', 1000, false) };
    case 'collection': return { name: text(p.name, '名称', 100), image: mediaReference(p.image, true), location: text(p.location, '地点', 200, false), content: text(p.content, '内容', 10000, false), width: integer(p.width ?? 1, 1, 20000), height: integer(p.height ?? 1, 1, 20000) };
  }
}
export function canManageEntry(entry: Pick<Entry, 'kind' | 'createdBy' | 'moodDate'>, userId: string, today = beijingDate()): boolean {
  if (entry.kind === 'mood') return entry.createdBy === userId && entry.moodDate === today;
  return SHARED_KINDS.includes(entry.kind) || entry.createdBy === userId;
}
export function anniversaryDays(p: EntryPayload, today = beijingDate()): number {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${p.date}T00:00:00Z`)) / 86400000);
  return p.direction === 'down' ? -days : days;
}
