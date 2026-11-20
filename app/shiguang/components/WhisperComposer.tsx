'use client';

import { LoaderCircle, Pause, Play, Plus, Trash2, Video, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { spaceRequest, uploadSpaceMedia } from '@/lib/shiguang/client';
import { extractTopics, firstTopic } from '@/lib/shiguang/topics';
import type { EntryMedia } from '@/lib/shiguang/types';
import AudioPlayer, { type AudioPlayerHandle } from './AudioPlayer';
import AudioRecorder from './AudioRecorder';

type DraftMedia = EntryMedia & {
  id: string;
  preview: string;
  uploading: boolean;
  failed: boolean;
};
const recordingWaveBars = [8, 14, 22, 12, 26, 17, 10, 24, 31, 19, 11, 28, 16, 23, 10, 29, 18, 13, 25, 8, 20, 14, 27, 11];

export default function WhisperComposer({ disabled = false, onPublished }: {
  disabled?: boolean;
  onPublished: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const audioPlayer = useRef<AudioPlayerHandle>(null);
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [audio, setAudio] = useState('');
  const [audioBusy, setAudioBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState('00:00');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState('00:00');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = disabled || busy || uploading || audioBusy;
  const topics = extractTopics(content);
  const validMedia = media.filter(item => item.reference && !item.uploading && !item.failed);
  const hasPayload = Boolean(content.trim() || audio || validMedia.length);

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
    setMedia(current => {
      const target = current.find(item => item.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return current.filter(item => item.id !== id);
    });
  }

  function replaceAudio(reference: string) {
    setAudio(reference);
    setAudioPlaying(false);
    setAudioDuration('00:00');
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
      const draft: DraftMedia = {
        id: crypto.randomUUID(),
        type,
        reference: '',
        preview: URL.createObjectURL(file),
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

  async function uploadAudio(file?: File) {
    if (!file || locked) return;
    setAudioBusy(true);
    setError('');
    try {
      replaceAudio(await uploadSpaceMedia(file, false, file.name, true));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setAudioBusy(false);
    }
  }

  async function publish() {
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
      await spaceRequest('/whisper', 'POST', { id: crypto.randomUUID(), payload });
      media.forEach(item => URL.revokeObjectURL(item.preview));
      setContent('');
      setMedia([]);
      setAudio('');
      dialog.current?.close();
      await onPublished();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="whisper-publish-fab" disabled={disabled} onClick={openComposer}
      aria-label="发表絮语" aria-haspopup="dialog">
      <Plus aria-hidden="true" />
    </button>

    <dialog ref={dialog} className="whisper-publish-dialog" aria-labelledby="whisper-publish-title"
      onCancel={event => { if (locked) event.preventDefault(); }}>
      <form className="whisper-publish-form" onSubmit={event => { event.preventDefault(); void publish(); }}>
        <header className="whisper-publish-header">
          <h2 id="whisper-publish-title">发表絮语</h2>
          <button type="button" disabled={locked} onClick={closeComposer} aria-label="关闭"><X aria-hidden="true" /></button>
        </header>

        <textarea ref={editor} className="whisper-publish-input" rows={5} maxLength={10000} value={content}
          disabled={busy} placeholder="写点什么…" aria-label="絮语正文"
          onChange={event => setContent(event.target.value)} />

        {topics.length > 0 && <div className="whisper-publish-topics">
          {topics.map(topic => <span key={topic}>#{topic}</span>)}
        </div>}

        <div className="whisper-media-grid">
          {media.map(item => <div key={item.id} className={`whisper-media-slot${item.failed ? ' whisper-media-slot--failed' : ''}`}>
            {item.type === 'image'
              ? <img src={item.preview} alt="" />
              : <><video src={item.preview} muted playsInline preload="metadata" /><span className="whisper-media-slot__video"><Video /></span></>}
            {item.uploading && <span className="whisper-media-slot__loading"><LoaderCircle /></span>}
            <button type="button" className="whisper-media-slot__remove" disabled={locked} onClick={() => removeMedia(item.id)} aria-label="移除媒体">
              <Trash2 />
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

        <div className="whisper-audio-bar">
          {audio
            ? <button type="button" className="whisper-audio-bar__play-button" disabled={locked}
              onClick={() => audioPlayer.current?.toggle()} aria-label={audioPlaying ? '暂停录音' : '播放录音'}>
              {audioPlaying ? <Pause /> : <Play />}
            </button>
            : <AudioRecorder disabled={busy || uploading} onChange={replaceAudio} onError={setError} onBusy={setAudioBusy}
              onRecordingChange={setRecording} onDuration={setRecordingDuration} />}
          <div className="whisper-audio-bar__main">
            {audio && <span className="whisper-audio-bar__player-source">
              <AudioPlayer ref={audioPlayer} src={audio} hideControl embedded
                onPlayingChange={setAudioPlaying} onDurationChange={setAudioDuration} />
            </span>}
            <div className={`whisper-audio-bar__preview${recording || audioPlaying ? ' whisper-audio-bar__preview--active' : ''}`}>
              <span className="whisper-audio-bar__wave" aria-hidden="true">
                {recordingWaveBars.map((height, index) => <span key={index} style={{ height }} />)}
              </span>
              <span className="whisper-audio-bar__duration">
                {recording ? recordingDuration : audio ? audioDuration : '00:00'}
              </span>
            </div>
          </div>
          {audio
            ? <button type="button" className="whisper-audio-bar__clear" disabled={locked}
              onClick={() => { setAudio(''); setAudioPlaying(false); setAudioDuration('00:00'); }}>×</button>
            : <button type="button" className="whisper-audio-bar__upload" disabled={locked}
              onClick={() => audioInput.current?.click()} aria-label="上传录音"><Plus /></button>}
          <input ref={audioInput} type="file" accept=".mp3,.m4a,.aac,.wav,audio/*" hidden
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void uploadAudio(file);
            }} />
        </div>

        {error && <p className="whisper-publish-error" role="alert">{error}</p>}

        <footer className="whisper-publish-actions">
          <button className="whisper-publish-submit" disabled={locked || !hasPayload}>
            {busy ? '发布中…' : '发布絮语'}
          </button>
        </footer>
      </form>
    </dialog>
  </>;
}
