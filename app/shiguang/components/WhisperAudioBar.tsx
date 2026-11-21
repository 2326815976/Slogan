'use client';

import { Pause, Play, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { uploadSpaceMedia } from '@/lib/shiguang/client';
import AudioPlayer, { type AudioPlayerHandle } from './AudioPlayer';
import AudioRecorder from './AudioRecorder';

const recordingWaveBars = [8, 14, 22, 12, 26, 17, 10, 24, 31, 19, 11, 28, 16, 23, 10, 29, 18, 13, 25, 8, 20, 14, 27, 11];

export default function WhisperAudioBar({ audio, disabled, audioBusy, onChange, onBusy, onError }: {
  audio: string;
  disabled: boolean;
  audioBusy: boolean;
  onChange: (reference: string) => void;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
}) {
  const audioInput = useRef<HTMLInputElement>(null);
  const audioPlayer = useRef<AudioPlayerHandle>(null);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState('00:00');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const locked = disabled || audioBusy;

  function replaceAudio(reference: string) {
    onChange(reference);
    setAudioPlaying(false);
  }

  async function uploadAudio(file?: File) {
    if (!file || locked) return;
    onBusy(true);
    onError('');
    try {
      replaceAudio(await uploadSpaceMedia(file, false, file.name, true));
    } catch (cause) {
      onError((cause as Error).message);
    } finally {
      onBusy(false);
    }
  }

  return <div className="whisper-audio-bar">
    {audio
      ? <button type="button" className="whisper-audio-bar__play-button compact-button" disabled={locked}
        onClick={() => audioPlayer.current?.toggle()} aria-label={audioPlaying ? '暂停录音' : '播放录音'}>
        {audioPlaying ? <Pause /> : <Play />}
      </button>
      : <AudioRecorder disabled={locked} onChange={replaceAudio} onError={onError} onBusy={onBusy}
        onRecordingChange={setRecording} onDuration={setRecordingDuration} />}
    <div className="whisper-audio-bar__main">
      {audio ? <AudioPlayer ref={audioPlayer} src={audio} variant="progress" hideControl embedded disabled={locked}
        onPlayingChange={setAudioPlaying} /> : <div className={`whisper-audio-bar__preview${recording ? ' whisper-audio-bar__preview--active' : ''}`}>
        <span className="whisper-audio-bar__wave" aria-hidden="true">
          {recordingWaveBars.map((height, index) => <span key={index} style={{ height }} />)}
        </span>
        <span className="whisper-audio-bar__duration">
          {recording ? recordingDuration : '00:00'}
        </span>
      </div>}
    </div>
    {audio
      ? <button type="button" className="whisper-audio-bar__clear" disabled={locked}
        aria-label="清除录音" onClick={() => replaceAudio('')}>×</button>
      : <button type="button" className="whisper-audio-bar__upload" disabled={locked}
        onClick={() => audioInput.current?.click()} aria-label="上传录音"><Plus /></button>}
    <input ref={audioInput} type="file" accept=".mp3,.m4a,.aac,.wav,audio/*" hidden
      onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        void uploadAudio(file);
      }} />
  </div>;
}
