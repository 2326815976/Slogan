'use client';

import { Pause, Play } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

const waveHeights = [7, 12, 18, 10, 22, 14, 8, 20, 28, 16, 9, 24, 13, 19, 8, 25, 15, 11, 21, 7, 17, 12, 24, 9];

export function formatDuration(value: number) {
  const seconds = Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export async function decodeAudioDuration(src: string, signal: AbortSignal) {
  if (typeof OfflineAudioContext === 'undefined') return 0;
  const response = await fetch(src, { signal });
  if (!response.ok) return 0;
  const buffer = await response.arrayBuffer();
  if (signal.aborted) return 0;
  const context = new OfflineAudioContext(1, 1, 24000);
  const { duration } = await context.decodeAudioData(buffer);
  return !signal.aborted && Number.isFinite(duration) && duration > 0 ? duration : 0;
}

export type AudioPlayerHandle = {
  toggle: () => void;
  pause: () => void;
};

const AudioPlayer = forwardRef<AudioPlayerHandle, {
  src: string;
  variant?: 'wave' | 'progress';
  hideControl?: boolean;
  embedded?: boolean;
  disabled?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  onDurationChange?: (duration: string) => void;
}>(function AudioPlayer({ src, variant = 'wave', hideControl = false, embedded = false, disabled = false, onPlayingChange, onDurationChange }, ref) {
  const audio = useRef<HTMLAudioElement>(null);
  const frame = useRef<number | null>(null);
  const lastDuration = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const updateTimeline = useCallback((player: HTMLAudioElement) => {
    const nextDuration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : lastDuration.current;
    if (nextDuration > 0 && (lastDuration.current === 0 || Math.abs(nextDuration - lastDuration.current) > 0.25)) {
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
    if (player) updateTimeline(player);
    return () => player?.pause();
  }, [onPlayingChange, src, updateTimeline]);

  useEffect(() => {
    const player = audio.current;
    if (variant !== 'progress' || !src || !player || typeof OfflineAudioContext === 'undefined') return;
    const request = new AbortController();
    let timer: number | undefined;
    const readDuration = async () => {
      if (lastDuration.current > 0 || player.error) return;
      try {
        const decodedDuration = await decodeAudioDuration(src, request.signal);
        if (request.signal.aborted || lastDuration.current > 0 || decodedDuration <= 0) return;
        lastDuration.current = decodedDuration;
        updateTimeline(player);
        onDurationChange?.(formatDuration(lastDuration.current));
      } catch {}
    };
    const schedule = () => { timer = window.setTimeout(() => void readDuration(), 1500); };
    const observer = player.parentElement && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer?.disconnect();
        schedule();
      })
      : null;
    if (observer && player.parentElement) observer.observe(player.parentElement);
    else schedule();
    return () => {
      observer?.disconnect();
      window.clearTimeout(timer);
      request.abort();
    };
  }, [onDurationChange, src, updateTimeline, variant]);

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
    if (!player || disabled) return;
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

  useImperativeHandle(ref, () => ({
    toggle: () => void toggle(),
    pause: () => {
      const player = audio.current;
      if (!player) return;
      updateTimeline(player);
      player.pause();
    },
  }));

  const seekInput = <input className="sg-audio-player__seek" type="range" min="0" max="1000"
    value={Math.round(progress * 1000)} disabled={disabled || duration <= 0} aria-label="录音播放进度"
    aria-valuetext={`${formatDuration(progress * duration)} / ${formatDuration(duration)}`}
    onChange={event => {
      const player = audio.current;
      if (!player || duration <= 0) return;
      player.currentTime = Number(event.currentTarget.value) / 1000 * duration;
      updateTimeline(player);
    }} />;

  return <div className={`sg-audio-player${variant === 'progress' ? ' sg-audio-player--progress' : ''}${playing ? ' sg-audio-player--playing' : ''}${hideControl ? ' sg-audio-player--without-control' : ''}${embedded ? ' sg-audio-player--embedded' : ''}`} title={error || undefined}>
    {!hideControl && <button type="button" className="sg-audio-player__control compact-button" disabled={disabled}
      aria-label={playing ? '暂停录音' : '播放录音'} aria-pressed={playing} onClick={() => void toggle()}>
      {playing ? <Pause /> : <Play />}
    </button>}
    {variant === 'progress'
      ? <>
        <span className="sg-audio-player__progress-wave" aria-hidden="true">
          <span /><span /><span /><span /><span />
          <span /><span /><span /><span />
        </span>
        <span className="sg-audio-player__progress">
          <span className="sg-audio-player__progress-fill" aria-hidden="true" style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}>
            <span className="sg-audio-player__progress-thumb" />
          </span>
          {seekInput}
        </span>
      </>
      : <span className="sg-audio-player__wave">
        <span className="sg-audio-player__wave-layer" aria-hidden="true">
          {waveHeights.map((height, index) => <span key={index} className="sg-audio-player__bar" style={{ height: `${height}px` }} />)}
        </span>
        <span className="sg-audio-player__wave-layer sg-audio-player__wave-layer--active" aria-hidden="true"
          style={{ clipPath: `inset(0 ${Math.max(0, 100 - progress * 100)}% 0 0)` }}>
          {waveHeights.map((height, index) => <span key={index} className="sg-audio-player__bar" style={{ height: `${height}px` }} />)}
        </span>
      </span>}
    <span className="sg-audio-player__duration">
      {variant === 'progress' && duration <= 0 ? '—' : formatDuration(duration)}
    </span>
    <audio key={src} ref={audio} className="sg-audio-player__native" src={src} preload="metadata"
      onLoadedMetadata={event => updateTimeline(event.currentTarget)}
      onCanPlay={event => updateTimeline(event.currentTarget)}
      onDurationChange={event => updateTimeline(event.currentTarget)}
      onTimeUpdate={event => updateTimeline(event.currentTarget)}
      onPlay={event => {
        updateTimeline(event.currentTarget);
        setPlaying(true);
        onPlayingChange?.(true);
      }}
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
  </div>;
});

export default AudioPlayer;
