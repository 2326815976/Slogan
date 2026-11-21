'use client';

import { LoaderCircle, Play, Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { spaceRequest, uploadSpaceMedia } from '@/lib/shiguang/client';
import { extractTopics, firstTopic, topicSegments } from '@/lib/shiguang/topics';
import type { Entry, EntryMedia, EntryPayload } from '@/lib/shiguang/types';
import WhisperAudioBar from './WhisperAudioBar';
import WhisperVideoDialog from './WhisperVideoDialog';

type DraftMedia = EntryMedia & {
  id: string;
  preview: string;
  uploading: boolean;
  failed: boolean;
};

function initialMedia(payload?: EntryPayload): DraftMedia[] {
  const seen = new Set<string>();
  const items: EntryMedia[] = [
    ...(payload?.media || []),
    ...(payload?.image ? [{ type: 'image' as const, reference: payload.image }] : []),
    ...(payload?.video ? [{ type: 'video' as const, reference: payload.video }] : []),
  ];
  return items.flatMap(({ type, reference }) => {
    const id = `${type}:${reference}`;
    if (!reference || seen.has(id)) return [];
    seen.add(id);
    return [{ id, type, reference, preview: reference, uploading: false, failed: false }];
  }).slice(0, 3);
}

function VideoThumbnail({ src, disabled, onPlay }: { src: string; disabled: boolean; onPlay: () => void }) {
  const [duration, setDuration] = useState('');

  return <>
    <video src={`${src}#t=0.001`} muted playsInline preload="metadata" aria-hidden="true"
      onLoadedMetadata={event => {
        const length = event.currentTarget.duration;
        if (!Number.isFinite(length) || length <= 0) return;
        const seconds = Math.max(1, Math.round(length));
        setDuration(`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
      }} />
    <button type="button" className="whisper-media-slot__video compact-button" aria-label="播放视频" aria-haspopup="dialog"
      disabled={disabled} onClick={onPlay}>
      <Play fill="currentColor" aria-hidden="true" />
    </button>
    {duration && <span className="whisper-media-slot__duration">{duration}</span>}
  </>;
}

export default function WhisperComposer({ disabled = false, entry, onCancel, onSaved }: {
  disabled?: boolean;
  entry?: Entry;
  onCancel?: () => void;
  onSaved: () => Promise<void>;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const editorHighlight = useRef<HTMLDivElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());
  const [content, setContent] = useState(entry?.payload.content ?? entry?.payload.description ?? entry?.payload.title ?? '');
  const [media, setMedia] = useState(() => initialMedia(entry?.payload));
  const [audio, setAudio] = useState(entry?.payload.audio || '');
  const [audioBusy, setAudioBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [videoPreview, setVideoPreview] = useState('');
  const locked = disabled || busy || uploading || audioBusy;
  const topics = extractTopics(content);
  const validMedia = media.filter(item => item.reference && !item.uploading && !item.failed);
  const hasPayload = Boolean(content.trim() || audio || validMedia.length);

  useEffect(() => {
    const previews = previewUrls.current;
    return () => previews.forEach(preview => URL.revokeObjectURL(preview));
  }, []);

  useEffect(() => {
    if (!entry) return;
    dialog.current?.showModal();
    editor.current?.focus();
  }, [entry]);

  function openComposer() {
    if (disabled) return;
    setError('');
    dialog.current?.showModal();
    requestAnimationFrame(() => editor.current?.focus());
  }

  function closeComposer() {
    if (locked) return;
    dialog.current?.close();
  }

  function removeMedia(id: string) {
    if (locked) return;
    const target = media.find(item => item.id === id);
    if (target && previewUrls.current.delete(target.preview)) URL.revokeObjectURL(target.preview);
    setMedia(current => current.filter(item => item.id !== id));
  }

  async function addMedia(files: FileList | null) {
    const selected = Array.from(files || []).slice(0, Math.max(0, 3 - media.length));
    if (!selected.length || locked) return;
    setUploading(true);
    setError('');
    for (const file of selected) {
      const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : '';
      if (!type) {
        setError('仅支持图片或视频');
        continue;
      }
      const preview = URL.createObjectURL(file);
      previewUrls.current.add(preview);
      const draft: DraftMedia = {
        id: crypto.randomUUID(),
        type,
        reference: '',
        preview,
        uploading: true,
        failed: false,
      };
      setMedia(current => current.length >= 3 ? current : [...current, draft]);
      try {
        const reference = await uploadSpaceMedia(file, false, file.name, true);
        setMedia(current => current.map(item => item.id === draft.id ? { ...item, reference, uploading: false } : item));
      } catch (cause) {
        setMedia(current => current.map(item => item.id === draft.id ? { ...item, uploading: false, failed: true } : item));
        setError((cause as Error).message);
      }
    }
    setUploading(false);
  }

  async function save() {
    if (!hasPayload || locked) return;
    setBusy(true);
    setError('');
    try {
      const payload = {
        content: content.trim(),
        title: firstTopic(content),
        audio,
        media: validMedia.map(({ type, reference }) => ({ type, reference })),
        type: audio ? 'audio' as const : 'text' as const,
      };
      await spaceRequest(entry ? `/whisper/${entry.id}` : '/whisper', entry ? 'PUT' : 'POST', {
        id: entry?.id || crypto.randomUUID(), payload, version: entry?.version,
      });
      previewUrls.current.forEach(preview => URL.revokeObjectURL(preview));
      previewUrls.current.clear();
      setContent('');
      setMedia([]);
      setAudio('');
      dialog.current?.close();
      await onSaved();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    {!entry && <button type="button" className="whisper-publish-fab" disabled={disabled} onClick={openComposer}
      aria-label="发表絮语" aria-haspopup="dialog">
      <Plus aria-hidden="true" />
    </button>}

    <dialog ref={dialog} className="whisper-publish-dialog" aria-labelledby={titleId} onClose={onCancel}
      onCancel={event => { if (locked) event.preventDefault(); }}>
      <form className="whisper-publish-form" onSubmit={event => { event.preventDefault(); void save(); }}>
        <header className="whisper-publish-header">
          <h2 id={titleId}>{entry ? '编辑絮语' : '发表絮语'}</h2>
          <button type="button" disabled={locked} onClick={closeComposer} aria-label="关闭"><X aria-hidden="true" /></button>
        </header>

        <div className="whisper-publish-content">
          <div className="whisper-publish-editor">
            <div ref={editorHighlight} className="whisper-publish-highlight" aria-hidden="true">
              {topicSegments(content, true).map((segment, index) => segment.topic
                ? <span key={index} className="whisper-publish-highlight__topic">{segment.text}</span>
                : segment.text)}
              {content.endsWith('\n') && '\u200b'}
            </div>
            <textarea ref={editor} className="whisper-publish-input" rows={5} maxLength={10000} value={content}
              disabled={busy} placeholder="写点什么…" aria-label="絮语正文"
              onChange={event => setContent(event.target.value)}
              onScroll={event => {
                if (editorHighlight.current) editorHighlight.current.scrollTop = event.currentTarget.scrollTop;
              }} />
          </div>
          {topics.length > 0 && <div className="whisper-publish-topics">
            {topics.map(topic => <span key={topic}>#{topic}</span>)}
          </div>}
        </div>

        <div className="whisper-media-grid">
          {media.map(item => <div key={item.id} className={`whisper-media-slot${item.failed ? ' whisper-media-slot--failed' : ''}`}>
            {item.type === 'image'
              ? <img src={item.preview} alt="" />
              : <VideoThumbnail src={item.preview} disabled={locked} onPlay={() => setVideoPreview(item.preview)} />}
            {item.uploading && <span className="whisper-media-slot__loading"><LoaderCircle /></span>}
            <button type="button" className="whisper-media-slot__remove" disabled={locked} onClick={() => removeMedia(item.id)} aria-label="移除媒体">
              <X />
            </button>
          </div>)}
          {media.length < 3 && <button type="button" className="whisper-media-add" disabled={locked}
            onClick={() => mediaInput.current?.click()} aria-label="添加图片或视频">
            <Plus />
          </button>}
        </div>
        <input ref={mediaInput} type="file" accept="image/*,video/*" multiple hidden
          onChange={event => {
            const files = event.target.files;
            event.target.value = '';
            void addMedia(files);
          }} />

        <WhisperAudioBar audio={audio} disabled={disabled || busy || uploading} audioBusy={audioBusy}
          onChange={setAudio} onBusy={setAudioBusy} onError={setError} />

        {error && <p className="whisper-publish-error" role="alert">{error}</p>}

        <footer className="whisper-publish-actions">
          <button className="whisper-publish-submit" disabled={locked || !hasPayload}>
            {entry ? (busy ? '保存中…' : '保存') : (busy ? '发布中…' : '发布絮语')}
          </button>
        </footer>
      </form>
    </dialog>
    {videoPreview && <WhisperVideoDialog src={videoPreview} onClose={() => setVideoPreview('')} />}
  </>;
}
