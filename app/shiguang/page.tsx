'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import PrimaryPageShell from '@/components/shell/PrimaryPageShell';
import SecondaryPageShell from '@/components/shell/SecondaryPageShell';
import { spaceRequest, uploadSpaceMedia } from '@/lib/shiguang/client';
import { useSpace } from './components/SpaceContext';
import SpaceOverview from './components/SpaceOverview';
import TodayMood from './components/TodayMood';
import HomeModules from './components/HomeModules';
import styles from './components/HomeModules.module.css';

async function prepareAvatar(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (Math.max(image.naturalWidth, image.naturalHeight) <= 512 && file.size <= 256 * 1024) return file;
  } finally {
    URL.revokeObjectURL(url);
  }
  const { compressImage } = await import('@/lib/utils/image-compression');
  return compressImage(file, { maxWidthOrHeight: 512, maxSizeMB: .25 });
}

export default function Page() {
  const { summary, refresh } = useSpace();
  const { space, userId } = summary;
  const self = space.members.find(m => m.userId === userId)!;
  const [editing, setEditing] = useState(false), [name, setName] = useState(''), [avatar, setAvatar] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
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
          {member.userId === userId ? <TodayMood /> : <Link href="/shiguang/mood" className="sg-mood sg-mood-link" aria-label="查看心情记录">
            {summary.moods.find(entry => entry.createdBy === member.userId)?.payload.mood || '今日未记录'}
          </Link>}
        </div>
      </div>)}
    </section>
    <SpaceOverview key={`${space.id}:${space.albumId}`} onOpenAlbum={openAlbum} />
    {space.letter && <details className="sg-card sg-letter"><summary>写给我们的信</summary><p className="sg-text mt-4">{space.letter}</p></details>}
    <HomeModules key={`${space.id}:${userId}`} userId={userId} balance={summary.balances[userId] || 0} members={space.members} />
    {editing && <div className="sg-modal" role="dialog" aria-modal="true" aria-labelledby="space-profile-title">
      <form className="sg-form space-profile-form" onSubmit={async event => {
        event.preventDefault();
        setBusy(true);
        try {
          await spaceRequest('/profile', 'POST', { name, avatar });
          await refresh();
          setEditing(false);
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}>
        <div>
          <h2 id="space-profile-title">编辑空间资料</h2>
          <p className="sg-muted">名称与头像仅用于拾光空间</p>
        </div>
        <input ref={avatarInput} type="file" accept="image/*" hidden disabled={busy} onChange={async event => {
          const file = event.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            setAvatar(await uploadSpaceMedia(await prepareAvatar(file)));
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }} />
        <button type="button" className="space-profile-avatar-action" disabled={busy} aria-label={avatar ? '更换头像' : '选择头像'} onClick={() => avatarInput.current?.click()}>
          {avatar ? <img src={avatar} alt="" /> : <span className="space-profile-avatar-initial" aria-hidden="true">{name.slice(0, 1) || '我'}</span>}
          <span className="space-profile-avatar-edit" aria-hidden="true"><Pencil /></span>
        </button>
        <label>空间昵称<input required maxLength={100} placeholder="请输入昵称" value={name} onChange={e => setName(e.target.value)} /></label>
        <div className="sg-actions"><button className="sg-button" disabled={busy}>保存</button><button type="button" className="sg-link" onClick={() => setEditing(false)}>取消</button></div>
      </form>
    </div>}
  </Shell>;
}
