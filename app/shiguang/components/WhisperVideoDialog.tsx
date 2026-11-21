'use client';

import { X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

export default function WhisperVideoDialog({ src, onClose }: {
  src: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    const panel = dialog.current;
    if (panel && !panel.open) panel.showModal();
    void video.current?.play().catch(() => undefined);
  }, []);

  return <dialog ref={dialog} className="whisper-video-preview" aria-label="播放视频" onClose={onClose}>
    <div className="whisper-video-preview__layout">
      <header className="whisper-video-preview__topbar">
        <button type="button" className="whisper-video-preview__close" aria-label="退出全屏" onClick={() => dialog.current?.close()}>
          <X aria-hidden="true" />
        </button>
      </header>
      {failed
        ? <p className="whisper-video-preview__error" role="alert">视频暂时无法播放，请重新打开</p>
        : <video ref={video} className="whisper-video-preview__player" src={src} controls autoPlay playsInline
          onError={() => setFailed(true)} />}
    </div>
  </dialog>;
}
