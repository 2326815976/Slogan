'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { spaceRequest, SpaceRequestError } from '@/lib/shiguang/client';
import type { ShiguangSummary } from '@/lib/shiguang/types';

const Context = createContext<{ summary: ShiguangSummary; refresh: () => Promise<void> } | null>(null);
export function useSpace() {
  const context = useContext(Context);
  if (!context) throw new Error('拾光空间尚未加载');
  return context;
}
export default function SpaceContext({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [summary, setSummary] = useState<ShiguangSummary>();
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { setSummary(await spaceRequest<ShiguangSummary>()); setError(''); }
    catch (e) {
      if (e instanceof SpaceRequestError && [401, 403].includes(e.status)) {
        setSummary(undefined); router.replace('/');
      }
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, [router]);
  useEffect(() => {
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    // 短轮询使对方给予的次数与空间启禁用及时生效。
    const timer = setInterval(onVisible, 5000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);
  if (!summary) return <div className="p-8 text-center" role="status">{error || '正在打开我们的拾光…'}{error && <button onClick={() => void refresh()} className="sg-button">重试</button>}</div>;
  return <Context.Provider value={{ summary, refresh }}>{error && <p role="alert" className="sg-error">{error}</p>}{children}</Context.Provider>;
}
