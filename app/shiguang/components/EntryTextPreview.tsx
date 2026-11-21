'use client';

import { useEffect, useId, useRef, useState } from 'react';

export type EntryText = { title: string; content: string } & (
  | { kind?: 'plain' | 'mood'; subtitle?: string }
  | { kind: 'promise'; author: string; authorAvatar?: string; recordTime: string }
);

export function PromiseAuthorAvatar({ author, avatar }: { author: string; avatar?: string }) {
  return <span className="entries-post-avatar entries-promise-avatar" aria-hidden="true">
    <span>{author.slice(0, 1)}</span>
    {avatar && <img src={avatar} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
  </span>;
}

export default function EntryTextPreview({ content, onRead }: { content: string; onRead: () => void }) {
  const preview = useRef<HTMLDivElement>(null);
  const description = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const clip = preview.current;
    const text = description.current;
    if (!clip || !text) return;
    const measure = () => setOverflows(text.offsetHeight > clip.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(clip);
    observer.observe(text);
    return () => observer.disconnect();
  }, [content]);

  return <div className="entry-text-preview">
    <div ref={preview} className="entry-text-preview__clip">
      <p ref={description} className="entry-text-description">{content}</p>
    </div>
    {overflows && <div className="entry-text-preview__end">
      <span aria-hidden="true">......</span>
      <button type="button" className="entry-text-preview__read" aria-haspopup="dialog" onClick={onRead}>阅读全文</button>
    </div>}
  </div>;
}

export function EntryTextDialog({ entry, onClose }: { entry: EntryText | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const promise = entry?.kind === 'promise' ? entry : null;
  const isMood = entry?.kind === 'mood';
  const readingLabel = promise ? '心约正文' : isMood ? '心情正文' : undefined;
  const subtitle = entry?.kind === 'promise' ? undefined : entry?.subtitle;

  useEffect(() => {
    const element = dialog.current;
    if (entry && element && !element.open) element.showModal();
  }, [entry]);

  return <dialog ref={dialog} className={`sg-ticket-dialog${promise ? ' sg-ticket-dialog--paper' : ''}`} aria-labelledby={titleId} onClose={onClose}>
    <div className="sg-ticket-dialog__header">
      {promise ? <div className="promise-reading__heading">
        <h2 id={titleId} className="promise-reading__title" title={promise.title}>{promise.title}</h2>
        <div className="promise-reading__rule" aria-hidden="true"><span /></div>
      </div> : <div>
        <h2 id={titleId} className="sg-list-title">{entry?.title}</h2>
        {subtitle && <p className="sg-list-meta">{subtitle}</p>}
      </div>}
      <button type="button" className="sg-ticket-dialog__close" aria-label="关闭" onClick={() => dialog.current?.close()}>×</button>
    </div>
    <div className="sg-ticket-dialog__body" tabIndex={readingLabel ? 0 : undefined}
      role={readingLabel ? 'region' : undefined} aria-label={readingLabel}>
      <p className={`entry-text-description${promise ? ' promise-reading__content' : isMood ? ' mood-reading__content' : ''}`}>{entry?.content}</p>
    </div>
    {promise && <div className="promise-reading__byline">
      <div className="promise-reading__author">
        <PromiseAuthorAvatar author={promise.author} avatar={promise.authorAvatar} />
        <dl>
          <dt>记录人</dt>
          <dd>{promise.author}</dd>
        </dl>
      </div>
      {promise.recordTime && <dl>
        <dt>记录时间</dt>
        <dd>{promise.recordTime}</dd>
      </dl>}
    </div>}
  </dialog>;
}
