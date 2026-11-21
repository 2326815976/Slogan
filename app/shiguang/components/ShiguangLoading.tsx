'use client';

import MiniProgramRecoveryScreen from '@/components/MiniProgramRecoveryScreen';

export default function ShiguangLoading({ description, className = '' }: {
  description: string;
  className?: string;
}) {
  return <MiniProgramRecoveryScreen
    title="拾光中..."
    description={description}
    className={className || 'min-h-[320px] flex-1'}
  />;
}
