'use client';

import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export default function OptionalSection({
  label,
  filled = false,
  status,
  variant = 'default',
  children,
}: {
  label: string;
  filled?: boolean;
  status?: string;
  variant?: 'default' | 'attachments';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return <section className={`sg-optional${open ? ' sg-optional--open' : ''}${variant === 'attachments' ? ' sg-optional--attachments' : ''}`}>
    <button type="button" className="sg-optional-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="sg-optional-label">{label}</span>
      <span className="sg-optional-state">
        {(status || filled) && <em>{status || '已填写'}</em>}
        <ChevronDown aria-hidden="true" />
      </span>
    </button>
    {open && <div className="sg-optional-content">{children}</div>}
  </section>;
}
