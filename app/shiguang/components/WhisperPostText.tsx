'use client';

import { useEffect, useId, useRef, useState } from 'react';
import TopicText from './TopicText';

export default function WhisperPostText({ content, onTopicClick }: {
  content: string;
  onTopicClick?: (topic: string) => void;
}) {
  const textId = useId();
  const preview = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLParagraphElement>(null);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const clip = preview.current;
    const paragraph = text.current;
    if (!clip || !paragraph || expanded) return;
    const measure = () => setHasMore(paragraph.offsetHeight > clip.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(clip);
    observer.observe(paragraph);
    return () => observer.disconnect();
  }, [content, expanded]);

  const folded = hasMore && !expanded;

  return <div className={`entries-post-body whisper-post-text${folded ? ' whisper-post-text--folded' : ''}`}>
    <div ref={preview} className={expanded ? 'whisper-post-text__clip' : 'whisper-post-text__clip whisper-post-text__clip--folded'}>
      <p id={textId} ref={text} className="entries-post-text"><TopicText content={content} onTopicClick={onTopicClick} /></p>
    </div>
    {hasMore && <div className={`whisper-post-text__tail${folded ? ' whisper-post-text__tail--folded' : ''}`}>
      {!expanded && <span aria-hidden="true">......</span>}
      <button type="button" className="whisper-post-text__toggle" aria-expanded={expanded} aria-controls={textId}
        onClick={() => setExpanded(previous => !previous)}>
        {expanded ? '收起全文' : '展开全文'}
        <span className={`whisper-post-text__chevron${expanded ? ' whisper-post-text__chevron--up' : ''}`} aria-hidden="true" />
      </button>
    </div>}
  </div>;
}
