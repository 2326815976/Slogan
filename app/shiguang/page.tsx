'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Heart, CalendarHeart, Sparkles, ScrollText, MessageCircleHeart, Camera, Ticket, LockKeyhole } from 'lucide-react';
import PrimaryPageShell from '@/components/shell/PrimaryPageShell';
import SecondaryPageShell from '@/components/shell/SecondaryPageShell';
import { spaceRequest, uploadSpaceMedia } from '@/lib/shiguang/client';
import { useSpace } from './components/SpaceContext';
import TodayMood from './components/TodayMood';

const modules = [
  ['anniversary', '纪念日', CalendarHeart, '记住每个特别的日子'], ['wish', '许愿池', Sparkles, '让小愿望慢慢实现'], ['promise', '心约', ScrollText, '写下两个人的约定'],
  ['whisper', '絮语', MessageCircleHeart, '有些话，只想说给你'], ['collection', '拾物采集', Camera, '收藏路上的小美好'], ['tickets', '心意奖券', Ticket, '把偏爱变成小惊喜'],
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
    <section className="sg-card sg-hero">
      <img src={space.cover} alt={`${space.name}封面`} className="sg-hero-cover" />
      <div className="sg-members">
        {space.members.map((m, index) => <div key={m.userId} className="contents">
          {index === 1 && <Heart className="text-rose-400 shrink-0" />}
          <div className="sg-member">
            {m.avatar ? <img src={m.avatar} alt="" className="sg-avatar" /> : <span className="sg-avatar grid place-items-center text-2xl">{m.name.slice(0, 1)}</span>}
            <strong>{m.name}</strong>
            {m.userId === userId ? <TodayMood /> : <span className="sg-mood">{summary.moods.find(entry => entry.createdBy === m.userId)?.payload.mood || '记录心情'}</span>}
            {m.userId === userId && <button className="sg-link" onClick={() => { setName(self.name); setAvatar(self.avatar); setEditing(true); }}>编辑我的资料</button>}
          </div>
        </div>)}
      </div>
    </section>
    {space.letter && <details className="sg-card sg-letter"><summary>写给我们的信</summary><p className="sg-text mt-4">{space.letter}</p></details>}
    <div className="sg-grid">
      <button className="sg-card sg-module" onClick={() => void openAlbum()}><span className="sg-module-icon"><LockKeyhole size={22} /></span><strong>专属空间</strong><span className="sg-muted">重温镜头里的我们</span><span className="sg-muted sg-module-id">{space.albumId}</span></button>
      {modules.map(([key, label, Icon, description]) => <Link key={key} href={`/shiguang/${key}`} className="sg-card sg-module"><span className="sg-module-icon"><Icon size={22} /></span><strong>{label}</strong><span className="sg-muted">{description}</span></Link>)}
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
