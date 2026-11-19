'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import PrimaryPageShell from '@/components/shell/PrimaryPageShell';
import SecondaryPageShell from '@/components/shell/SecondaryPageShell';
import { spaceRequest, uploadSpaceMedia } from '@/lib/shiguang/client';
import { useSpace } from './components/SpaceContext';
import SpaceOverview from './components/SpaceOverview';
import TodayMood from './components/TodayMood';
import HomeModules from './components/HomeModules';
import styles from './components/HomeModules.module.css';

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
  return <Shell title={space.name} badge="💕 记录我们的专属时光 💕" contentClassName={`sg-content sg-stack ${styles.home}`}>
    {error && <p className="sg-error" role="alert">{error}</p>}
    <section className={styles.members} aria-label="空间成员">
      {space.members.map(member => <div key={member.userId} className={`${styles.member} ${member.role === 'boy' ? styles.boy : styles.girl}`}>
        <div className={styles.portrait}>
          {member.avatar ? <img src={member.avatar} alt="" /> : <span>{member.name.slice(0, 1)}</span>}
          {member.userId === userId && <button type="button" aria-label="编辑我的空间资料" onClick={() => { setName(self.name); setAvatar(self.avatar); setEditing(true); }}><Pencil /></button>}
        </div>
        <div className={styles.memberInfo}>
          <strong>{member.name}</strong>
          {member.userId === userId ? <TodayMood /> : <span className="sg-mood">{summary.moods.find(entry => entry.createdBy === member.userId)?.payload.mood || '今日未记录'}</span>}
        </div>
      </div>)}
    </section>
    <SpaceOverview key={`${space.id}:${space.albumId}`} onOpenAlbum={openAlbum} />
    {space.letter && <details className="sg-card sg-letter"><summary>写给我们的信</summary><p className="sg-text mt-4">{space.letter}</p></details>}
    <HomeModules key={`${space.id}:${userId}`} userId={userId} balance={summary.balances[userId] || 0} members={space.members} />
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
