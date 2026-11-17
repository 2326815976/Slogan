'use client';

import { useMemo } from 'react';
import CaptureLabPage, { type CaptureStorage, type CaptureWallCard } from '@/app/capture-lab/CaptureLabPage';
import { spaceRequest, uploadSpaceMedia } from '@/lib/shiguang/client';
import type { Entry, PageResult } from '@/lib/shiguang/types';
import { useSpace } from '../components/SpaceContext';

export default function Page() {
  const { summary } = useSpace();
  const memberKey = JSON.stringify(summary.space.members.map(m => [m.userId, m.name]));
  const storage = useMemo<CaptureStorage>(() => {
    const members = JSON.parse(memberKey) as [string, string][];
    const toCard = (entry: Entry): CaptureWallCard => ({ id: entry.id, title: entry.payload.name || '', sourceName: members.find(m => m[0] === entry.createdBy)?.[1] || '', cutoutObjectUrl: entry.payload.image || '', subjectWidth: entry.payload.width || 1, subjectHeight: entry.payload.height || 1, createdAt: entry.createdAt, locationLabel: entry.payload.location || '', storyText: entry.payload.content || '', styleIndex: 0, createdBy: entry.createdBy, creatorName: members.find(m => m[0] === entry.createdBy)?.[1], version: entry.version });
    // 将已有采集界面接到空间存储；原内测路由仍使用本地会话。
    const pending = new Map<string, { id: string; image?: string }>();
    return {
      userId: summary.userId,
      async load() {
        const cards: CaptureWallCard[] = [];
        for (let page = 0; ; page++) {
          const result = await spaceRequest<PageResult<Entry>>(`/collection?page=${page}`);
          cards.push(...result.items.map(toCard));
          if (!result.hasMore) return cards;
        }
      },
      async save(card, create) {
        let image = card.cutoutObjectUrl, id = card.id;
        if (create) {
          let request = pending.get(card.id);
          if (!request) { request = { id: crypto.randomUUID() }; pending.set(card.id, request); }
          id = request.id;
          if (!request.image) request.image = await uploadSpaceMedia(await (await fetch(card.cutoutObjectUrl)).blob(), false, 'collection.png');
          image = request.image;
        }
        const result = await spaceRequest<Entry>(`/collection${create ? '' : `/${id}`}`, create ? 'POST' : 'PUT', { id, version: card.version, payload: { name: card.title, image, width: card.subjectWidth, height: card.subjectHeight, location: card.locationLabel, content: card.storyText } });
        pending.delete(card.id);
        return toCard(result);
      },
      async remove(card) { await spaceRequest(`/collection/${card.id}`, 'DELETE', { version: card.version }); },
    };
  }, [summary.userId, memberKey]);
  return <CaptureLabPage storage={storage} />;
}
