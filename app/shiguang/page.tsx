'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Heart, CalendarHeart, Sparkles, ScrollText, MessageCircleHeart, Smile, Camera, Ticket, LockKeyhole } from 'lucide-react';
import PrimaryPageShell from '@/components/shell/PrimaryPageShell';
import SecondaryPageShell from '@/components/shell/SecondaryPageShell';
import { spaceRequest, uploadSpaceMedia } from '@/lib/shiguang/client';
import { useSpace } from './components/SpaceContext';

const modules = [
  ['anniversary', '纪念日', CalendarHeart], ['wish', '许愿池', Sparkles], ['promise', '心约', ScrollText],
  ['whisper', '絮语', MessageCircleHeart], ['mood', '心情', Smile], ['collection', '拾物采集', Camera], ['tickets', '心意奖券', Ticket],
] as const;
export default function Page() {
  const { summary, refresh } = useSpace();
  const { space, userId } = summary;
  const self = space.members.find(m => m.userId === userId)!;
  const [editing, setEditing] = useState(false), [name, setName] = useState(''), [avatar, setAvatar] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function openAlbum() {
    try { const link = await spaceRequest<{ webPath: string }>('/album'); window.location.assign(link.webPath); }
    catch (e) { setError((e as Error).message); }
  }
  const Shell = summary.publishState === 'beta' ? SecondaryPageShell : PrimaryPageShell;
  return <Shell title={space.name} badge="把日子，慢慢写成我们的故事" contentClassName="sg-content sg-stack">
    {error && <p className="sg-error" role="alert">{error}</p>}
    <section className="sg-card overflow-hidden !p-0">
      <img src={space.cover} alt={`${space.name}封面`} className="w-full max-h-64 object-cover" />
      <div className="flex justify-around items-center p-5 gap-4">
        {space.members.map((m, index) => <div key={m.userId} className="contents">
          {index === 1 && <Heart className="text-rose-400 shrink-0" />}
          <div className="text-center flex flex-col items-center gap-2">
            {m.avatar ? <img src={m.avatar} alt="" className="sg-avatar" /> : <span className="sg-avatar grid place-items-center text-2xl">{m.name.slice(0, 1)}</span>}
            <strong>{m.name}</strong>
            <Link href="/shiguang/mood" className="text-sm">{summary.moods.find(e => e.createdBy === m.userId)?.payload.mood || '今日未记录'}</Link>
            {m.userId === userId && <button className="sg-link text-xs" onClick={() => { setName(self.name); setAvatar(self.avatar); setEditing(true); }}>编辑我的空间资料</button>}
          </div>
        </div>)}
      </div>
    </section>
    {space.letter && <details className="sg-card"><summary className="cursor-pointer font-semibold">写给我们的信</summary><p className="sg-text mt-4">{space.letter}</p></details>}
    <div className="sg-grid">
      <button className="sg-card flex flex-col items-start gap-3 text-left" onClick={() => void openAlbum()}><LockKeyhole size={24} /><strong>专属空间</strong><span className="sg-muted break-all">{space.albumId}</span></button>
      {modules.map(([key, label, Icon]) => <Link key={key} href={`/shiguang/${key}`} className="sg-card flex flex-col items-start gap-3"><Icon size={24} /><strong>{label}</strong><span className="sg-muted">一起收藏小小的幸福</span></Link>)}
    </div>
    {editing && <div className="sg-modal" role="dialog" aria-modal="true" aria-label="我的空间资料"><section className="sg-card">
      <form className="sg-form" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await spaceRequest('/profile', 'POST', { name, avatar }); await refresh(); setEditing(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
        <h2>我的空间资料</h2><p className="sg-muted">仅用于拾光空间</p>
        <label>名称<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>头像<input type="file" accept="image/*" disabled={busy} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); try { setAvatar(await uploadSpaceMedia(f)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }} /></label>
        {avatar && <img className="sg-avatar" src={avatar} alt="头像预览" />}
        <div className="sg-actions"><button className="sg-button" disabled={busy}>保存</button><button type="button" className="sg-link" onClick={() => setEditing(false)}>取消</button></div>
      </form>
    </section></div>}
  </Shell>;
}
