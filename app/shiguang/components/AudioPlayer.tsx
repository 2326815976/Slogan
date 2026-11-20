'use client';

import { Pause, Play } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

const waveHeights = [7, 12, 18, 10, 22, 14, 8, 20, 28, 16, 9, 24, 13, 19, 8, 25, 15, 11, 21, 7, 17, 12, 24, 9];

function formatDuration(value: number) {
  const seconds = Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export type AudioPlayerHandle = {
  toggle: () => void;
};

const AudioPlayer = forwardRef<AudioPlayerHandle, {
  src: string;
  variant?: 'wave' | 'progress';
  hideControl?: boolean;
  embedded?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  onDurationChange?: (duration: string) => void;
}>(function AudioPlayer({ src, variant = 'wave', hideControl = false, embedded = false, onPlayingChange, onDurationChange }, ref) {
  const audio = useRef<HTMLAudioElement>(null);
  const frame = useRef<number | null>(null);
  const progressTrack = useRef<HTMLSpanElement>(null);
  const lastDuration = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const updateTimeline = useCallback((player: HTMLAudioElement) => {
    const nextDuration = Number.isFinite(player.duration) ? player.duration : 0;
    if (nextDuration > 0 && Math.abs(nextDuration - lastDuration.current) > 0.25) {
      lastDuration.current = nextDuration;
      onDurationChange?.(formatDuration(nextDuration));
    }
    setDuration(nextDuration);
    setProgress(nextDuration > 0 ? Math.min(1, player.currentTime / nextDuration) : 0);
  }, [onDurationChange]);

  useEffect(() => {
    const player = audio.current;
    player?.pause();
    setPlaying(false);
    onPlayingChange?.(false);
    setDuration(0);
    setProgress(0);
    setError('');
    lastDuration.current = 0;
    return () => player?.pause();
  }, [onPlayingChange, src]);

  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const player = audio.current;
      if (!player) return;
      updateTimeline(player);
      if (!player.paused) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [playing, updateTimeline]);

  async function toggle() {
    const player = audio.current;
    if (!player) return;
    setError('');
    if (!player.paused) {
      player.pause();
      return;
    }
    try {
      if (player.error) player.load();
      await player.play();
    } catch {
      setPlaying(false);
      onPlayingChange?.(false);
      setError('音频暂时无法播放');
    }
  }

  useImperativeHandle(ref, () => ({ toggle: () => void toggle() }), []);

  return <button type="button" className={`sg-audio-player${variant === 'progress' ? ' sg-audio-player--progress' : ''}${playing ? ' sg-audio-player--playing' : ''}${hideControl ? ' sg-audio-player--without-control' : ''}${embedded ? ' sg-audio-player--embedded' : ''}`}
    aria-label={playing ? '暂停录音' : '播放录音'} aria-pressed={playing} title={error || (playing ? '暂停录音' : '播放录音')}
    onClick={event => {
      const track = progressTrack.current;
      if (variant === 'progress' && track && event.target instanceof Element && track.contains(event.target)) {
        const rect = track.getBoundingClientRect();
        const next = rect.width > 0 ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0;
        const player = audio.current;
        if (player && Number.isFinite(player.duration)) {
          player.currentTime = player.duration * next;
          updateTimeline(player);
        }
        return;
      }
      void toggle();
    }}>
    {!hideControl && <span className="sg-audio-player__control" aria-hidden="true">
      {playing ? <Pause /> : <Play />}
    </span>}
    {variant === 'progress'
      ? <span ref={progressTrack} className="sg-audio-player__progress" aria-hidden="true">
        <span className="sg-audio-player__progress-fill" style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}>
          <span className="sg-audio-player__progress-thumb" />
        </span>
      </span>
      : <span className="sg-audio-player__wave" aria-hidden="true">
        <span className="sg-audio-player__wave-layer">
          {waveHeights.map((height, index) => <span key={index} className="sg-audio-player__bar" style={{ height: `${height}px` }} />)}
        </span>
        <span className="sg-audio-player__wave-layer sg-audio-player__wave-layer--active"
          style={{ clipPath: `inset(0 ${Math.max(0, 100 - progress * 100)}% 0 0)` }}>
          {waveHeights.map((height, index) => <span key={index} className="sg-audio-player__bar" style={{ height: `${height}px` }} />)}
        </span>
      </span>}
    <span className="sg-audio-player__duration">{variant === 'progress' ? `${formatDuration(duration * progress)} / ${formatDuration(duration)}` : formatDuration(duration)}</span>
    <audio ref={audio} className="sg-audio-player__native" src={src} preload="metadata"
      onLoadedMetadata={event => updateTimeline(event.currentTarget)}
      onDurationChange={event => updateTimeline(event.currentTarget)}
      onTimeUpdate={event => updateTimeline(event.currentTarget)}
      onPlay={() => { setPlaying(true); onPlayingChange?.(true); }}
      onPause={() => { setPlaying(false); onPlayingChange?.(false); }}
      onEnded={event => {
        event.currentTarget.currentTime = 0;
        setPlaying(false);
        onPlayingChange?.(false);
        setProgress(0);
      }}
      onError={() => {
        setPlaying(false);
        onPlayingChange?.(false);
        setError('音频暂时无法播放');
      }} />
  </button>;
});

export default AudioPlayer;
