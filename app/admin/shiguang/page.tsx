'use client';

import { useCallback, useEffect, useState } from 'react';
import { spaceRequest, uploadSpaceMedia } from '@/lib/shiguang/client';
import type { AdminOptions, PageResult, ShiguangSpace, SpaceMember } from '@/lib/shiguang/types';
import '../../shiguang/shiguang.css';

export default function Page() {
  const [items, setItems] = useState<ShiguangSpace[]>([]), [options, setOptions] = useState<AdminOptions>({ users: [], albums: [] });
  const [page, setPage] = useState(0), [more, setMore] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ShiguangSpace | null | undefined>(), [member, setMember] = useState<{ space: string; member: SpaceMember }>();
  const [form, setForm] = useState({ id: '', name: '', cover: '', letter: '', albumId: '', boyId: '', girlId: '', enabled: true });
  const [query, setQuery] = useState('');
  const load = useCallback(async (n = 0) => { const result = await spaceRequest<PageResult<ShiguangSpace>>(`admin/shiguang?page=${n}`); setItems(result.items); setMore(result.hasMore); setPage(n); }, []);
  useEffect(() => { void Promise.all([load(), spaceRequest<AdminOptions>('admin/shiguang?options=1').then(setOptions)]).catch(e => setError(e.message)); }, [load]);
  async function upload(file?: File, avatar = false) {
    if (!file) return; setBusy(true);
    try { const url = await uploadSpaceMedia(file, true); if (avatar) setMember(m => m && ({ ...m, member: { ...m.member, avatar: url } })); else setForm(f => ({ ...f, cover: url })); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function open(space?: ShiguangSpace) {
    setEditing(space || null); setError(''); setForm({ id: space?.id || crypto.randomUUID(), name: space?.name || '', cover: space?.cover || '', letter: space?.letter || '', albumId: space?.albumId || '', boyId: '', girlId: '', enabled: space?.enabled ?? true });
  }
  const availableUsers = options.users.filter(u => !u.bound && u.label.toLowerCase().includes(query.toLowerCase()));
  return <div className="sg-content sg-stack !max-w-6xl">
    <div className="sg-actions justify-between"><div><h1 className="text-2xl font-bold">拾光空间管理</h1><p className="sg-muted">管理两人空间、信件与永久成员绑定</p></div><button className="sg-button" onClick={() => open()}>创建拾光空间</button></div>
    {error && <p role="alert" className="sg-error">{error}</p>}
    {editing !== undefined && <form className="sg-card sg-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try {
      const { boyId, girlId, ...common } = form;
      await spaceRequest(`admin/shiguang${editing ? `/${editing.id}` : ''}`, editing ? 'PUT' : 'POST', editing ? { ...common, version: editing.version } : form);
      setEditing(undefined); await load(); setOptions(await spaceRequest<AdminOptions>('admin/shiguang?options=1'));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
      <h2 className="font-semibold">{editing ? '编辑空间' : '创建空间'}</h2>
      <label>名称<input required maxLength={100} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
      <label>封面<input type="file" accept="image/*" disabled={busy} onChange={e => void upload(e.target.files?.[0])} /></label>{form.cover && <img className="w-48 h-28 object-cover rounded-xl" src={form.cover} alt="封面预览" />}
      <label>状态<select value={String(form.enabled)} onChange={e => setForm(f => ({ ...f, enabled: e.target.value === 'true' }))}><option value="true">启用</option><option value="false">禁用</option></select></label>
      <label>信件<textarea maxLength={20000} value={form.letter} onChange={e => setForm(f => ({ ...f, letter: e.target.value }))} /></label>
      <label>绑定专属返图空间<select required value={form.albumId} onChange={e => setForm(f => ({ ...f, albumId: e.target.value }))}><option value="">请选择</option>{options.albums.map(a => <option key={a.id} value={a.id}>{a.title} · {a.id}</option>)}</select></label>
      {!editing && <><p className="sg-error">两名成员必须不同，绑定后永久保留，禁用或删除空间也不能解绑、换绑。</p><label>筛选用户<input value={query} onChange={e => setQuery(e.target.value)} placeholder="名称、手机号、备注" /></label>{(['boyId', 'girlId'] as const).map(key => <label key={key}>{key === 'boyId' ? '男生' : '女生'}<select required value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}><option value="">请选择用户</option>{options.users.filter(u => !u.bound && (availableUsers.some(a => a.id === u.id) || form[key] === u.id)).map(u => <option key={u.id} value={u.id} disabled={form[key === 'boyId' ? 'girlId' : 'boyId'] === u.id}>{u.label}</option>)}</select></label>)}</>}
      <div className="sg-actions"><button className="sg-button" disabled={busy || !form.cover}>{busy ? '保存中…' : '保存'}</button><button type="button" disabled={busy} className="sg-link" onClick={() => setEditing(undefined)}>取消</button></div>
    </form>}
    {member && <form className="sg-card sg-form" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await spaceRequest(`admin/shiguang/${member.space}`, 'PUT', { operation: 'member', userId: member.member.userId, name: member.member.name, avatar: member.member.avatar }); setMember(undefined); await load(page); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><h2>编辑空间成员资料</h2><label>名称<input required maxLength={100} value={member.member.name} onChange={e => setMember({ ...member, member: { ...member.member, name: e.target.value } })} /></label><label>头像<input type="file" accept="image/*" disabled={busy} onChange={e => void upload(e.target.files?.[0], true)} /></label>{member.member.avatar && <img src={member.member.avatar} alt="头像预览" className="sg-avatar" />}<div className="sg-actions"><button className="sg-button" disabled={busy}>保存资料</button><button type="button" className="sg-link" onClick={() => setMember(undefined)}>取消</button></div></form>}
    {items.map(s => <article className="sg-card" key={s.id}><div className="sg-actions"><img className="w-20 h-16 object-cover rounded-xl" src={s.cover} alt="" /><div><h2 className="font-semibold">{s.name} · {s.deletedAt ? '已删除' : s.enabled ? '启用' : '禁用'}</h2><p className="sg-muted">{s.id}</p></div></div><div className="sg-actions mt-3">{s.members.map(m => <div key={m.userId}>{m.role === 'boy' ? '男生' : '女生'}：{m.name}{!s.deletedAt && <button className="sg-link" onClick={() => setMember({ space: s.id, member: { ...m } })}>编辑资料</button>}</div>)}</div>{!s.deletedAt && <div className="sg-actions"><button className="sg-link" disabled={busy} onClick={() => open(s)}>编辑空间</button><button className="sg-link sg-danger" disabled={busy} onClick={async () => { if (!confirm('删除后将停止双方访问，保留永久绑定和全部历史数据。确认删除？')) return; setBusy(true); try { await spaceRequest(`admin/shiguang/${s.id}`, 'DELETE', { version: s.version }); await load(page); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>删除空间</button></div>}</article>)}
    <div className="sg-actions"><button disabled={!page} className="sg-link" onClick={() => void load(page - 1).catch(e => setError(e.message))}>上一页</button><span>{page + 1}</span><button disabled={!more} className="sg-link" onClick={() => void load(page + 1).catch(e => setError(e.message))}>下一页</button></div>
  </div>;
}
