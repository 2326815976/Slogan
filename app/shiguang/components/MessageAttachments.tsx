'use client';

import { useEffect, useRef, useState } from 'react';
import { uploadSpaceMedia } from '@/lib/shiguang/client';
import AudioRecorder from './AudioRecorder';
import MessageMedia from './MessageMedia';

type Attachments = { audio?: string; image?: string; video?: string };
const attachmentTypes = [
  { field: 'image', label: '图片', accept: 'image/jpeg,image/png,image/gif,image/webp' },
  { field: 'video', label: '视频', accept: 'video/mp4,video/quicktime,.mp4,.mov' },
  { field: 'audio', label: '音频', accept: '.mp3,.m4a,.aac,.wav' },
] as const;

export default function MessageAttachments({ value, disabled, onChange, onBusy }: {
  value: Attachments;
  disabled: boolean;
  onChange: (field: keyof Attachments, reference: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [audioBusy, setAudioBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'image' | 'video'>();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ name: string; preview?: string; failed?: boolean }>();
  const camera = useRef<HTMLVideoElement>(null);
  const nativeVideo = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localPreview = selected?.preview;

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
      name: file instanceof File ? file.name : filename || '附件',
      preview: field === 'image' ? URL.createObjectURL(file) : undefined,
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
  return <fieldset className="sg-media-composer">
    <legend>附件（选填）</legend>
    <button type="button" className="sg-media-upload" disabled={locked} aria-expanded={uploadOpen} onClick={() => setUploadOpen(open => !open)}>
      <span>上传附件</span><small>图片 · 视频 · 音频</small><span className={`sg-media-chevron${uploadOpen ? ' sg-media-chevron--open' : ''}`} aria-hidden="true" />
    </button>
    {uploadOpen && <div className="sg-media-tools">
      {attachmentTypes.map(({ field, label, accept }) => <label key={field} className="sg-media-tool sg-media-file">
        {value[field] ? `更换${label}` : label}
        <input type="file" accept={accept} disabled={locked} onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void uploadFile(field, file);
        }} />
      </label>)}
    </div>}
    {selected && <div className="sg-media-item" role="status">
      {selected.preview && <img className="sg-media-thumbnail shrink-0" src={selected.preview} alt="" />}
      <span className="min-w-0 flex-1 truncate" title={selected.name}>{selected.name}</span>
      <span className="sg-muted shrink-0">{selected.failed ? '上传失败，未添加' : '正在上传…'}</span>
      {selected.failed && <button type="button" className="sg-media-remove" disabled={locked} onClick={() => { setSelected(undefined); setError(''); }}>移除</button>}
    </div>}
    <div className="sg-media-tools">
      <AudioRecorder disabled={disabled || uploading || !!cameraMode} onChange={audio => onChange('audio', audio)} onError={setError} onBusy={busy => {
        if (busy) setUploadOpen(false);
        setAudioBusy(busy);
        onBusy(busy);
      }} />
      <button type="button" className="sg-media-tool" disabled={locked} onClick={() => openCamera('image')}>拍照</button>
      <button type="button" className="sg-media-tool" disabled={locked} onClick={() => openCamera('video')}>录像</button>
    </div>
    {cameraMode && <div className="sg-media-composer">
      <video ref={camera} autoPlay muted playsInline aria-label="相机画面" className="max-h-64 max-w-full rounded-xl" />
      <div className="sg-actions">
        <button type="button" className="sg-button" onClick={cameraMode === 'image' ? capturePhoto : recordVideo}>
          {cameraMode === 'image' ? '拍摄' : recording ? '结束录像' : '开始录像（最多 30 秒）'}
        </button>
        <button type="button" className="sg-link" onClick={closeCamera}>{recording ? '取消录像' : '关闭相机'}</button>
      </div>
    </div>}
    <input ref={nativeVideo} type="file" hidden capture="environment" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) void uploadFile('video', file);
    }} />
    {value.image && <div className="sg-media-item">
      <a className="sg-media-preview" href={value.image} target="_blank" rel="noreferrer" aria-label="查看原图">
        <img className="sg-media-thumbnail" src={`${value.image}?variant=preview`} alt="" onError={event => {
          const image = event.currentTarget;
          if (value.image && image.getAttribute('src') !== value.image) image.src = value.image;
        }} />查看原图
      </a>
      <button type="button" className="sg-media-remove" disabled={locked} aria-label="移除图片" onClick={() => onChange('image', '')}>移除</button>
    </div>}
    {value.video && <div className="sg-media-item">
      <details className="sg-media-video"><summary>播放视频</summary><MessageMedia video={value.video} /></details>
      <button type="button" className="sg-media-remove" disabled={locked} aria-label="移除视频" onClick={() => onChange('video', '')}>移除</button>
    </div>}
    {value.audio && <div className="sg-media-item">
      <audio controls preload="none" src={value.audio} aria-label="音频附件" />
      <button type="button" className="sg-media-remove" disabled={locked} aria-label="移除音频" onClick={() => onChange('audio', '')}>移除</button>
    </div>}
    {error && <p role="alert" className="sg-error">{error}</p>}
  </fieldset>;
}

function videoFormat() {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['video/mp4;codecs=avc1.42001E,mp4a.40.2', 'video/mp4'].find(format => MediaRecorder.isTypeSupported(format));
}
