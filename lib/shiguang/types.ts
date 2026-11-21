export const ENTRY_KINDS = ['anniversary', 'wish', 'promise', 'whisper', 'mood', 'collection'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const KIND_LABELS: Record<EntryKind, string> = {
  anniversary: '纪念日', wish: '许愿池', promise: '心约', whisper: '絮语', mood: '心情', collection: '拾物采集',
};
export const SHARED_KINDS: readonly EntryKind[] = ['anniversary', 'wish', 'promise'];
export interface EntryMedia {
  type: 'image' | 'video';
  reference: string;
}
export interface EntryPayload {
  name?: string;
  title?: string;
  content?: string;
  date?: string;
  direction?: 'up' | 'down';
  sortOrder?: number;
  status?: 'pending' | 'fulfilled';
  type?: 'text' | 'audio';
  audio?: string;
  mood?: string;
  description?: string;
  image?: string;
  video?: string;
  media?: EntryMedia[];
  location?: string;
  width?: number;
  height?: number;
}
export interface SpaceMember { userId: string; role: 'boy' | 'girl'; name: string; avatar: string }
export interface ShiguangSpace {
  id: string; name: string; cover: string; letter: string; albumId: string; enabled: boolean;
  deletedAt: string | null; createdAt: string; version: number; members: SpaceMember[];
}
export interface Entry {
  id: string; kind: EntryKind; payload: EntryPayload; createdBy: string; createdAt: string;
  updatedAt: string; moodDate: string | null; version: number; replyCount?: number;
}
export interface Reply { id: string; entryId: string; content: string; audio?: string; image?: string; video?: string; createdBy: string; createdAt: string; version: number }
export type ReplyPage = PageResult<Reply> & { replyCount?: number };
export interface Prize {
  id: string; name: string; content: string; image: string; providerId: string; drawerId: string; createdAt: string; version: number;
}
export type PrizeSummary = Pick<Prize, 'id' | 'name' | 'providerId'>;
export interface GiftCard {
  id: string; name: string; content: string; image: string; providerId: string; holderId: string; createdAt: string; version: number;
}
export interface Ticket {
  id: string; name: string; content: string; image: string; source: 'draw' | 'gift'; providerId: string; holderId: string;
  status: 'unused' | 'used'; obtainedAt: string; usedAt: string | null; prizeId: string | null;
}
export interface Grant { id: string; giverId: string; receiverId: string; amount: number; createdAt: string }
export interface ShiguangSummary {
  userId: string; today: string; space: ShiguangSpace; moods: Entry[]; balances: Record<string, number>;
  album: { id: string; title: string; cover: string; coverUrl: string } | null;
  anniversaries: Entry[];
  publishState: 'online' | 'beta';
}
export interface PageResult<T> { items: T[]; hasMore: boolean }
export interface AdminOptions {
  users: { id: string; name: string; label: string; bound: boolean }[];
  albums: { id: string; title: string; label: string }[];
}
