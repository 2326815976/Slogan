'use client';

import { useEffect, useRef, useState } from 'react';
import { uploadSpaceMedia } from '@/lib/shiguang/client';

export default function AudioRecorder({ value, onChange, onBusy }: { value?: string; onChange: (url: string) => void; onBusy: (busy: boolean) => void }) {
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recording, setRecording] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); }; }, []);
  async function upload(blob: Blob, name?: string) {
    onBusy(true); setPending(true);
    try { const url = await uploadSpaceMedia(blob, false, name); if (alive.current) onChange(url); }
    catch (e) { if (alive.current) setError((e as Error).message); }
    finally { if (alive.current) { onBusy(false); setPending(false); } }
  }
  async function start() {
    if (pending || recording) return;
    setPending(true); onBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('当前浏览器不支持录音，请选择音频文件');
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { stream.current.getTracks().forEach(t => t.stop()); return; }
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      r.onstop = () => {
        stream.current?.getTracks().forEach(t => t.stop());
        if (timer.current) clearTimeout(timer.current);
        if (alive.current) { setRecording(false); void upload(new Blob(chunks, { type: r.mimeType.split(';')[0] }), r.mimeType.includes('mp4') ? 'recording.m4a' : 'recording.webm'); }
      };
      recorder.current = r; r.start(); setRecording(true); setPending(false); setError('');
      timer.current = setTimeout(() => { if (r.state === 'recording') r.stop(); }, 180000);
    } catch (e) { stream.current?.getTracks().forEach(t => t.stop()); if (alive.current) { setError((e as Error).message); setPending(false); onBusy(false); } }
  }
  return <div className="sg-stack">
    <div className="sg-actions"><button type="button" className="sg-button" disabled={pending} onClick={() => recording ? recorder.current?.stop() : void start()}>{recording ? '结束录音' : pending ? '处理中…' : '开始录音'}</button><span className="sg-muted">最长 3 分钟</span></div>
    <label>或选择音频<input type="file" accept="audio/*" disabled={recording || pending} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); }} /></label>
    {value && <audio controls src={value} className="max-w-full" />}{error && <p role="alert" className="sg-error">{error}</p>}
  </div>;
}
