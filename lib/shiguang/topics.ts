export type TopicSegment = { text: string; topic?: string };

const topicPattern = /#([^\s#，。！？、,.!?;:：；（）()\[\]{}<>《》]{1,30})/gu;

export function cleanTopic(value: unknown): string {
  return String(value ?? '').trim().replace(/#+/g, '').replace(/[\s%_\\]+/g, '').slice(0, 30);
}

export function topicSegments(content: unknown): TopicSegment[] {
  const source = String(content ?? '');
  if (!source) return [];
  const segments: TopicSegment[] = [];
  let cursor = 0;
  for (const match of source.matchAll(topicPattern)) {
    const index = match.index ?? 0;
    const topic = cleanTopic(match[1]);
    if (!topic) continue;
    if (index > cursor) segments.push({ text: source.slice(cursor, index) });
    segments.push({ text: `#${topic}`, topic });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor) });
  return segments.length ? segments : [{ text: source }];
}

export function extractTopics(content: unknown): string[] {
  return [...new Set(topicSegments(content).flatMap(segment => segment.topic ? [segment.topic] : []))];
}

export function firstTopic(content: unknown): string {
  return extractTopics(content)[0] || '';
}
