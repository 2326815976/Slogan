'use client';

import {
  AudioLines,
  Camera,
  ChevronDown,
  Image as ImageIcon,
  LoaderCircle,
  Mic,
  Music2,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { uploadSpaceMedia } from '@/lib/shiguang/client';
import AudioPlayer from './AudioPlayer';
import AudioRecorder from './AudioRecorder';
import MessageMedia from './MessageMedia';
import WhisperAudioBar from './WhisperAudioBar';

type Attachments = { audio?: string; image?: string; video?: string };
const attachmentTypes = [
  { field: 'image', label: '图片', accept: 'image/jpeg,image/png,image/gif,image/webp' },
  { field: 'video', label: '视频', accept: 'video/mp4,video/quicktime,.mp4,.mov' },
  { field: 'audio', label: '音频', accept: '.mp3,.m4a,.aac,.wav' },
] as const;

function AttachmentVideoThumbnail({ src }: { src: string }) {
  const [ready, setReady] = useState(false);

  return <span className="sg-media-selected__visual sg-media-selected__visual--video" aria-hidden="true">
    <Video />
    <video src={src} preload="auto" muted playsInline style={{ visibility: ready ? 'visible' : 'hidden' }}
      onLoadedMetadata={event => {
        const video = event.currentTarget;
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA && video.duration > 0) {
          video.currentTime = Math.min(0.05, video.duration / 2);
        }
      }}
      onLoadedData={() => setReady(true)} onSeeked={() => setReady(true)} onError={() => setReady(false)} />
  </span>;
}

export default function MessageAttachments({ value, disabled, onChange, onBusy, replyActions }: {
  value: Attachments;
  disabled: boolean;
  onChange: (field: keyof Attachments, reference: string) => void;
  onBusy: (busy: boolean) => void;
  replyActions?: ReactNode;
}) {
  const [audioBusy, setAudioBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'image' | 'video'>();
  const [recording, setRecording] = useState(false);
  const [audioOpen, setAudioOpen] = useState(() => Boolean(value.audio));
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ field: keyof Attachments; name: string; preview?: string; failed?: boolean }>();
  const camera = useRef<HTMLVideoElement>(null);
  const mixedMedia = useRef<HTMLInputElement>(null);
  const nativeVideo = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localPreview = selected?.preview;
  const hasAttachment = Boolean(value.image || value.video || value.audio);

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  useEffect(() => {
    if (!cameraMode) return;
    let active = true;
    let stream: MediaStream | undefined;
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器无法打开相机');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, ...(cameraMode === 'video' ? { width: { ideal: 1280 } } : {}) },
          audio: cameraMode === 'video',
        });
        if (active && camera.current) camera.current.srcObject = stream;
        else stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        if (active) { setError((error as Error).message); setCameraMode(undefined); onBusy(false); }
      }
    })();
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state === 'recording') recorder.current.stop();
        recorder.current = null;
      }
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [cameraMode, onBusy]);

  async function uploadFile(field: keyof Attachments, file: Blob, filename?: string) {
    const selection = {
      field,
      name: file instanceof File ? file.name : filename || '附件',
      preview: field === 'image' || field === 'video' ? URL.createObjectURL(file) : undefined,
    };
    setSelected(selection);
    setUploadOpen(false);
    setUploading(true);
    onBusy(true);
    setError('');
    try {
      onChange(field, await uploadSpaceMedia(file, false, filename, true));
      setSelected(undefined);
    } catch (error) {
      setSelected({ ...selection, failed: true });
      setError((error as Error).message);
    }
    finally { setUploading(false); onBusy(false); }
  }

  function selectMixedFile(file?: File) {
    if (!file || locked || hasAttachment) return;
    setAudioOpen(false);
    if (file.type.startsWith('image/')) {
      void uploadFile('image', file);
      return;
    }
    if (file.type.startsWith('video/')) {
      void uploadFile('video', file);
      return;
    }
    setError('请选择图片或视频');
  }

  function capturePhoto() {
    const video = camera.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0);
    setCameraMode(undefined);
    canvas.toBlob(file => {
      if (file) void uploadFile('image', file, 'camera.jpg');
      else { setError('拍照失败，请重试'); onBusy(false); }
    }, 'image/jpeg', 0.97);
  }

  function openCamera(mode: 'image' | 'video') {
    setUploadOpen(false);
    if (mode === 'video' && (!navigator.mediaDevices?.getUserMedia || !videoFormat())) {
      nativeVideo.current?.click();
      return;
    }
    setError('');
    setCameraMode(mode);
    onBusy(true);
  }

  function closeCamera() {
    if (recorder.current) recorder.current.onstop = null;
    setRecording(false);
    setCameraMode(undefined);
    onBusy(false);
  }

  function recordVideo() {
    if (recorder.current?.state === 'recording') { recorder.current.stop(); return; }
    if (recording) return;
    const stream = camera.current?.srcObject;
    const mimeType = videoFormat();
    if (!(stream instanceof MediaStream) || !mimeType) return;
    try {
      const capture = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000, audioBitsPerSecond: 96_000 });
      const chunks: BlobPart[] = [];
      capture.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      capture.onstop = () => {
        setRecording(false);
        setCameraMode(undefined);
        const video = new Blob(chunks, { type: 'video/mp4' });
        if (video.size) void uploadFile('video', video, 'video.mp4');
        else { setError('视频录制失败，请重试'); onBusy(false); }
      };
      capture.onerror = () => { closeCamera(); setError('视频录制失败，请重试'); };
      capture.start();
      recorder.current = capture;
      setRecording(true);
      timer.current = setTimeout(() => { if (capture.state === 'recording') capture.stop(); }, 30_000);
    } catch (error) { setError((error as Error).message); }
  }

  const locked = disabled || audioBusy || uploading || !!cameraMode;
  const pendingVisual = selected?.field === 'video' && selected.preview
    ? <AttachmentVideoThumbnail key={selected.preview} src={selected.preview} />
    : <span className="sg-media-selected__visual">
      {selected?.preview ? <img src={selected.preview} alt="" /> : selected?.failed ? <Upload /> : <LoaderCircle />}
    </span>;
  if (replyActions !== undefined) {
    return <fieldset className="whisper-quick-attachments" aria-label="评论操作">
      <div className="entries-comment-input-row">
        <button type="button" className="entries-comment-tool" disabled={locked || hasAttachment}
          onClick={() => setUploadOpen(open => !open)} aria-expanded={uploadOpen && !hasAttachment}
          aria-label="添加附件" title="添加附件">
          <Plus aria-hidden="true" />
        </button>
        {replyActions}
      </div>
      {uploadOpen && !hasAttachment && <div className="sg-media-file-picker entries-comment-attachment-menu" role="group" aria-label="选择附件类型">
        <button type="button" className="sg-media-file-choice sg-media-file-choice--image" disabled={locked} onClick={() => mixedMedia.current?.click()}>
          <ImageIcon aria-hidden="true" />
          <span>图片或视频</span>
        </button>
        <button type="button" className="sg-media-file-choice sg-media-file-choice--audio" disabled={locked} onClick={() => {
          setSelected(undefined);
          setError('');
          setUploadOpen(false);
          setAudioOpen(true);
        }}>
          <Mic aria-hidden="true" />
          <span>语音</span>
        </button>
      </div>}
      <input ref={mixedMedia} type="file" accept="image/*,video/*" hidden
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          selectMixedFile(file);
        }} />

      {audioOpen && (value.audio || (!value.image && !value.video)) && <WhisperAudioBar audio={value.audio || ''} disabled={disabled || uploading} audioBusy={audioBusy}
        onChange={audio => onChange('audio', audio)} onError={setError}
        onBusy={busy => { setAudioBusy(busy); onBusy(busy); }} />}

      <div className="sg-media-selected-list">
        {selected && <div className={`sg-media-selected sg-media-selected--pending${selected.failed ? ' sg-media-selected--failed' : ''}`} role="status">
          {pendingVisual}
          <span className="sg-media-selected__copy">
            <strong>{selected.failed ? '上传未完成' : '正在上传'}</strong>
            <small title={selected.name}>{selected.name}</small>
          </span>
          {selected.failed
            ? <button type="button" className="sg-media-icon-button sg-media-icon-button--danger" disabled={locked} aria-label="移除失败的附件" onClick={() => { setSelected(undefined); setError(''); }}><Trash2 /></button>
            : <span className="sg-media-selected__status" aria-label="正在上传"><LoaderCircle /></span>}
        </div>}

        {value.image && <div className="sg-media-selected">
          <a className="sg-media-selected__main" href={value.image} target="_blank" rel="noreferrer" aria-label="查看原图">
            <span className="sg-media-selected__visual">
              <img src={`${value.image}?variant=preview`} alt="" />
            </span>
            <span className="sg-media-selected__copy">
              <strong>图片附件</strong>
              <small>点击预览</small>
            </span>
          </a>
          <button type="button" className="sg-media-icon-button" disabled={locked} aria-label="移除图片" onClick={() => onChange('image', '')}><Trash2 /></button>
        </div>}

        {value.video && <div className="sg-media-selected sg-media-selected--expandable">
          <details className="sg-media-selected__details">
            <summary>
              <AttachmentVideoThumbnail key={value.video} src={value.video} />
              <span className="sg-media-selected__copy">
                <strong>视频附件</strong>
                <small>点击展开播放</small>
              </span>
              <ChevronDown className="sg-media-selected__trailing sg-media-selected__chevron" aria-hidden="true" />
            </summary>
            <div className="sg-media-selected__preview"><MessageMedia video={value.video} /></div>
          </details>
          <button type="button" className="sg-media-icon-button" disabled={locked} aria-label="移除视频" onClick={() => onChange('video', '')}><Trash2 /></button>
        </div>}

      </div>
      {error && <p role="alert" className="sg-error">{error}</p>}
    </fieldset>;
  }

  return <fieldset className="sg-media-composer sg-media-composer--editor" aria-label="添加附件">
    <div className="sg-media-action-grid">
      <button
        type="button"
        className={`sg-media-action sg-media-action--upload${uploadOpen ? ' sg-media-action--active' : ''}`}
        disabled={locked}
        aria-expanded={uploadOpen}
        onClick={() => setUploadOpen(open => !open)}
      >
        <span className="sg-media-action__icon"><Upload /></span>
        <span className="sg-media-action__label">上传附件</span>
      </button>
      <AudioRecorder
        disabled={disabled || uploading || !!cameraMode}
        onChange={audio => onChange('audio', audio)}
        onError={setError}
        onBusy={busy => {
          if (busy) setUploadOpen(false);
          setAudioBusy(busy);
          onBusy(busy);
        }}
      />
      <button type="button" className="sg-media-action sg-media-action--camera" disabled={locked} onClick={() => openCamera('image')}>
        <span className="sg-media-action__icon"><Camera /></span>
        <span className="sg-media-action__label">拍照</span>
      </button>
      <button type="button" className="sg-media-action sg-media-action--video" disabled={locked} onClick={() => openCamera('video')}>
        <span className="sg-media-action__icon"><Video /></span>
        <span className="sg-media-action__label">录像</span>
      </button>
    </div>

    {uploadOpen && <div className="sg-media-file-picker" role="group" aria-label="选择附件类型">
      {attachmentTypes.map(({ field, label, accept }) => {
        const TypeIcon = field === 'image' ? ImageIcon : field === 'video' ? Video : Music2;
        return <label key={field} className={`sg-media-file-choice sg-media-file-choice--${field}`}>
          <TypeIcon aria-hidden="true" />
          <span>{value[field] ? `更换${label}` : `选择${label}`}</span>
          <input type="file" accept={accept} disabled={locked} onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void uploadFile(field, file);
          }} />
        </label>;
      })}
    </div>}

    <div className="sg-media-selected-list">
      {selected && <div className={`sg-media-selected sg-media-selected--pending${selected.failed ? ' sg-media-selected--failed' : ''}`} role="status">
        {pendingVisual}
        <span className="sg-media-selected__copy">
          <strong>{selected.failed ? '上传未完成' : '正在上传'}</strong>
          <small title={selected.name}>{selected.name}</small>
        </span>
        {selected.failed
          ? <button type="button" className="sg-media-icon-button sg-media-icon-button--danger" disabled={locked} aria-label="移除失败的附件" onClick={() => { setSelected(undefined); setError(''); }}><Trash2 /></button>
          : <span className="sg-media-selected__status" aria-label="正在上传"><LoaderCircle /></span>}
      </div>}

      {value.image && <div className="sg-media-selected">
        <a className="sg-media-selected__main" href={value.image} target="_blank" rel="noreferrer" aria-label="查看原图">
          <span className="sg-media-selected__visual">
            <img src={`${value.image}?variant=preview`} alt="" onError={event => {
              const image = event.currentTarget;
              if (value.image && image.getAttribute('src') !== value.image) image.src = value.image;
            }} />
          </span>
          <span className="sg-media-selected__copy">
            <strong>图片附件</strong>
            <small>点击预览</small>
          </span>
        </a>
        <button type="button" className="sg-media-icon-button" disabled={locked} aria-label="移除图片" onClick={() => onChange('image', '')}><Trash2 /></button>
      </div>}

      {value.video && <div className="sg-media-selected sg-media-selected--expandable">
        <details className="sg-media-selected__details">
          <summary>
            <AttachmentVideoThumbnail key={value.video} src={value.video} />
            <span className="sg-media-selected__copy">
              <strong>视频附件</strong>
              <small>点击展开播放</small>
            </span>
            <ChevronDown className="sg-media-selected__trailing sg-media-selected__chevron" aria-hidden="true" />
          </summary>
          <div className="sg-media-selected__preview"><MessageMedia video={value.video} /></div>
        </details>
        <button type="button" className="sg-media-icon-button" disabled={locked} aria-label="移除视频" onClick={() => onChange('video', '')}><Trash2 /></button>
      </div>}

      {value.audio && <div className="sg-media-selected sg-media-selected--audio">
        <div className="sg-media-selected__audio-head">
          <span className="sg-media-selected__visual sg-media-selected__visual--audio"><AudioLines /></span>
          <span className="sg-media-selected__copy">
            <strong>音频附件</strong>
            <small>点击播放</small>
          </span>
        </div>
        <button type="button" className="sg-media-icon-button" disabled={locked} aria-label="移除音频" onClick={() => onChange('audio', '')}><Trash2 /></button>
        <div className="sg-media-selected__player"><AudioPlayer src={value.audio} /></div>
      </div>}
    </div>

    {cameraMode && <div className="sg-media-camera">
      <div className="sg-media-camera__head">
        <span><Camera aria-hidden="true" />{cameraMode === 'image' ? '拍照' : '录像'}</span>
        <button type="button" aria-label={recording ? '取消录像' : '关闭相机'} onClick={closeCamera}><X /></button>
      </div>
      <video ref={camera} autoPlay muted playsInline aria-label="相机画面" />
      <div className="sg-media-camera__actions">
        <button type="button" className="sg-button" onClick={cameraMode === 'image' ? capturePhoto : recordVideo}>
          {cameraMode === 'image' ? '拍摄' : recording ? '结束录像' : '开始录像'}
        </button>
        <span>{cameraMode === 'video' ? '最长 30 秒' : '画面仅用于本次上传'}</span>
      </div>
    </div>}
    <input ref={nativeVideo} type="file" hidden capture="environment" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) void uploadFile('video', file);
    }} />
    {error && <p role="alert" className="sg-error">{error}</p>}
  </fieldset>;
}

function videoFormat() {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['video/mp4;codecs=avc1.42001E,mp4a.40.2', 'video/mp4'].find(format => MediaRecorder.isTypeSupported(format));
}
