'use client';

import { LoaderCircle, Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { uploadSpaceMedia } from '@/lib/shiguang/client';
import { recordingWave } from '@/lib/shiguang/recording-wave';

const aacFormat = 'audio/mp4;codecs=mp4a.40.2';

function formatRecordingDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export default function AudioRecorder({ disabled, onChange, onBusy, onError, onRecordingChange, onDuration }: {
  disabled: boolean;
  onChange: (url: string) => void;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  onRecordingChange?: (recording: boolean) => void;
  onDuration?: (duration: string) => void;
}) {
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false), [pending, setPending] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); if (durationTimer.current) clearInterval(durationTimer.current); if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); }; }, []);
  async function upload(blob: Blob, recordedAac: boolean) {
    onBusy(true); setPending(true); onError('');
    try {
      if (!blob.size) throw new Error('没有录到音频，请重试');
      const isM4a = recordedAac && blob.type === 'audio/mp4';
      const file = isM4a ? blob : await recordingWave(blob);
      if (!alive.current) return;
      const url = await uploadSpaceMedia(file, false, isM4a ? 'recording.m4a' : 'recording.wav', true);
      if (alive.current) onChange(url);
    }
    catch (error) { if (alive.current) onError((error as Error).message); }
    finally { if (alive.current) { onBusy(false); setPending(false); } }
  }
  async function start() {
    if (pending || recording) return;
    setPending(true); onBusy(true); onError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('当前浏览器不支持录音，请选择音频文件');
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
      if (!alive.current) { stream.current.getTracks().forEach(t => t.stop()); return; }
      const mimeType = [aacFormat, 'audio/webm', 'audio/ogg'].find(format => MediaRecorder.isTypeSupported(format));
      const r = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      r.onerror = () => {
        r.onstop = null;
        if (timer.current) clearTimeout(timer.current);
        if (durationTimer.current) clearInterval(durationTimer.current);
        stream.current?.getTracks().forEach(track => track.stop());
        if (alive.current) { setRecording(false); onRecordingChange?.(false); setPending(false); onBusy(false); onError('录音失败，请重试'); }
      };
      r.onstop = () => {
        stream.current?.getTracks().forEach(t => t.stop());
        if (timer.current) clearTimeout(timer.current);
        if (durationTimer.current) clearInterval(durationTimer.current);
        if (alive.current) {
          setRecording(false);
          onRecordingChange?.(false);
          void upload(new Blob(chunks, { type: r.mimeType.split(';')[0] }), mimeType === aacFormat);
        }
      };
      recorder.current = r; r.start(); setRecording(true); setPending(false);
      onRecordingChange?.(true);
      onDuration?.('00:00');
      const startedAt = Date.now();
      durationTimer.current = setInterval(() => {
        if (alive.current) onDuration?.(formatRecordingDuration((Date.now() - startedAt) / 1000));
      }, 250);
      timer.current = setTimeout(() => { if (r.state === 'recording') r.stop(); }, 180000);
    } catch (error) { stream.current?.getTracks().forEach(t => t.stop()); if (alive.current) { onError((error as Error).message); setPending(false); onBusy(false); } }
  }
  return <button type="button" className={`sg-media-action sg-media-action--audio${recording ? ' sg-media-action--recording' : ''}`}
    title="最长 3 分钟录音" aria-label={recording ? '结束录音' : pending ? '正在处理录音' : '录音'}
    disabled={pending || (disabled && !recording)} onClick={() => recording ? recorder.current?.stop() : void start()}>
    <span className={`sg-media-action__icon${pending ? ' sg-media-action__icon--loading' : ''}`}>
      {pending ? <LoaderCircle /> : recording ? <Square /> : <Mic />}
    </span>
    <span className="sg-media-action__label">{recording ? '结束' : pending ? '处理中' : '录音'}</span>
  </button>;
}
