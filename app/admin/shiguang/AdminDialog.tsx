'use client';

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  busy: boolean;
  disabled?: boolean;
  error: string;
  submitLabel: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/** 沿用后台弹窗样式；原生 dialog 负责焦点约束及返回焦点。 */
export default function AdminDialog({ title, busy, disabled, error, submitLabel, children, onClose, onSubmit }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return <dialog ref={dialog} className="booking-modal-mask sg-admin-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form className="booking-modal booking-modal--form album-create-modal" onSubmit={onSubmit}>
      <div className="booking-modal__head">
        <h2 id={titleId} className="booking-modal__title">{title}</h2>
        <button type="button" className="icon-button action-icon-btn action-icon-btn--close" aria-label="关闭" disabled={busy} onClick={onClose}><X size={18} /></button>
      </div>
      <div className="booking-modal__body album-create-modal__body">{children}</div>
      {error && <p role="alert" className="sg-error sg-admin-dialog-error">{error}</p>}
      <button type="submit" className="booking-modal__submit album-create-modal__submit" disabled={busy || disabled}>{busy ? '保存中…' : submitLabel}</button>
    </form>
  </dialog>;
}
