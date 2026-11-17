'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { spaceRequest, uploadSpaceMedia } from '@/lib/shiguang/client';
import type { AdminOptions, PageResult, ShiguangSpace, SpaceMember } from '@/lib/shiguang/types';
import AdminDialog from './AdminDialog';
import SpaceCard from './SpaceCard';
import '../../shiguang/shiguang.css';
import './admin-shiguang.css';

export default function Page() {
  const [items, setItems] = useState<ShiguangSpace[]>([]);
  const [options, setOptions] = useState<AdminOptions>({ users: [], albums: [] });
  const [page, setPage] = useState(0), [more, setMore] = useState(false);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ShiguangSpace | null | undefined>();
  const [member, setMember] = useState<{ space: string; member: SpaceMember }>();
  const [form, setForm] = useState({ id: '', name: '', cover: '', letter: '', albumId: '', boyId: '', girlId: '', enabled: true });
  const [query, setQuery] = useState('');
  const load = useCallback(async (n = 0) => {
    setLoading(true);
    try {
      const result = await spaceRequest<PageResult<ShiguangSpace>>(`admin/shiguang?page=${n}`);
      setItems(result.items); setMore(result.hasMore); setPage(n);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void Promise.all([load(), spaceRequest<AdminOptions>('admin/shiguang?options=1').then(setOptions)]).catch(e => setError(e.message));
  }, [load]);

  async function upload(file?: File, avatar = false) {
    if (!file || busy) return;
    setBusy(true); setError('');
    try {
      const url = await uploadSpaceMedia(file, true);
      if (avatar) setMember(m => m && ({ ...m, member: { ...m.member, avatar: url } }));
      else setForm(f => ({ ...f, cover: url }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function open(space?: ShiguangSpace) {
    setEditing(space || null); setError(''); setQuery('');
    setForm({ id: space?.id || crypto.randomUUID(), name: space?.name || '', cover: space?.cover || '', letter: space?.letter || '', albumId: space?.albumId || '', boyId: '', girlId: '', enabled: space?.enabled ?? true });
  }
  function close() {
    if (busy) return;
    setEditing(undefined); setMember(undefined); setError('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      // 编辑仅提交空间资料，保留既有成员绑定与版本校验。
      const { boyId, girlId, ...common } = form;
      await spaceRequest(`admin/shiguang${editing ? `/${editing.id}` : ''}`, editing ? 'PUT' : 'POST', editing ? { ...common, version: editing.version } : form);
      setEditing(undefined);
      await Promise.all([load(editing ? page : 0), spaceRequest<AdminOptions>('admin/shiguang?options=1').then(setOptions)]);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !member) return;
    setBusy(true); setError('');
    try {
      await spaceRequest(`admin/shiguang/${member.space}`, 'PUT', { operation: 'member', userId: member.member.userId, name: member.member.name, avatar: member.member.avatar });
      setMember(undefined); await load(page);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(space: ShiguangSpace) {
    if (busy || !confirm('删除后将停止双方访问，保留永久绑定和全部历史数据。确认删除？')) return;
    setBusy(true); setError('');
    try { await spaceRequest(`admin/shiguang/${space.id}`, 'DELETE', { version: space.version }); await load(page); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return <div className="sg-content sg-stack sg-admin">
    <div className="sg-admin-header">
      <h1>拾光空间管理</h1>
      <button className="booking-pill-btn booking-pill-btn--primary" disabled={busy} onClick={() => open()}><Plus size={16} />添加空间</button>
    </div>
    {error && editing === undefined && !member && <p role="alert" className="sg-error">{error}</p>}
    {!items.length && <div className="sg-card sg-admin-empty">{loading ? '加载中…' : '暂无拾光空间'}</div>}
    <div className="sg-admin-list">{items.map(space => <SpaceCard key={space.id} space={space} busy={busy}
      onEdit={() => open(space)}
      onEditMember={value => { setError(''); setMember({ space: space.id, member: { ...value } }); }}
      onRemove={() => void remove(space)} />)}</div>
    {(page > 0 || more) && <div className="booking-pagination">
      <button disabled={!page || busy || loading} className="booking-page-btn booking-page-btn--ghost" onClick={() => void load(page - 1).catch(e => setError(e.message))}>上一页</button>
      <span className="booking-page-indicator">第 {page + 1} 页</span>
      <button disabled={!more || busy || loading} className="booking-page-btn booking-page-btn--ghost" onClick={() => void load(page + 1).catch(e => setError(e.message))}>下一页</button>
    </div>}

    {editing !== undefined && <AdminDialog title={editing ? '编辑拾光空间' : '创建拾光空间'} busy={busy} disabled={!form.cover} error={error} submitLabel="保存空间" onClose={close} onSubmit={save}>
      <label className="booking-modal__field"><span className="booking-modal__label">名称</span><input className="booking-modal__input" required maxLength={100} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
      <div className="booking-modal__field"><span className="booking-modal__label">封面</span>
        {form.cover && <img className="sg-admin-cover-preview" src={form.cover} alt="封面预览" />}
        <label className="booking-pill-btn booking-pill-btn--ghost sg-admin-upload">{form.cover ? '更换封面' : '上传封面'}<input aria-label="上传封面" type="file" accept="image/*" disabled={busy} onChange={e => void upload(e.target.files?.[0])} /></label>
      </div>
      <label className="booking-modal__field"><span className="booking-modal__label">状态</span><select className="booking-modal__input" value={String(form.enabled)} onChange={e => setForm(f => ({ ...f, enabled: e.target.value === 'true' }))}><option value="true">启用</option><option value="false">禁用</option></select></label>
      <label className="booking-modal__field"><span className="booking-modal__label">信件</span><textarea className="booking-modal__textarea" maxLength={20000} value={form.letter} onChange={e => setForm(f => ({ ...f, letter: e.target.value }))} /></label>
      <label className="booking-modal__field"><span className="booking-modal__label">绑定专属返图空间</span><select className="booking-modal__input" required value={form.albumId} onChange={e => setForm(f => ({ ...f, albumId: e.target.value }))}><option value="">请选择</option>{options.albums.map(a => <option key={a.id} value={a.id}>{a.title} · {a.id}</option>)}</select></label>
      {!editing && <>
        <label className="booking-modal__field"><span className="booking-modal__label">筛选用户</span><input className="booking-modal__input" value={query} onChange={e => setQuery(e.target.value)} placeholder="手机号、备注名" /></label>
        {(['boyId', 'girlId'] as const).map(key => <label className="booking-modal__field" key={key}><span className="booking-modal__label">{key === 'boyId' ? '男生' : '女生'}</span><select className="booking-modal__input" required value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
          <option value="">请选择用户</option>
          {options.users.filter(u => !u.bound && (u.label.toLowerCase().includes(query.trim().toLowerCase()) || form[key] === u.id)).map(u => <option key={u.id} value={u.id} disabled={form[key === 'boyId' ? 'girlId' : 'boyId'] === u.id}>{u.label}</option>)}
        </select></label>)}
      </>}
    </AdminDialog>}
    {member && <AdminDialog title="编辑空间成员资料" busy={busy} error={error} submitLabel="保存资料" onClose={close} onSubmit={saveMember}>
      <label className="booking-modal__field"><span className="booking-modal__label">名称</span><input className="booking-modal__input" required maxLength={100} value={member.member.name} onChange={e => setMember({ ...member, member: { ...member.member, name: e.target.value } })} /></label>
      <div className="booking-modal__field"><span className="booking-modal__label">头像</span>
        {member.member.avatar && <img src={member.member.avatar} alt="头像预览" className="sg-avatar" />}
        <label className="booking-pill-btn booking-pill-btn--ghost sg-admin-upload">更换头像<input aria-label="上传头像" type="file" accept="image/*" disabled={busy} onChange={e => void upload(e.target.files?.[0], true)} /></label>
      </div>
    </AdminDialog>}
  </div>;
}
