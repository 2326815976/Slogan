'use client';

import { Heart, Pencil, Trash2 } from 'lucide-react';
import type { ShiguangSpace, SpaceMember } from '@/lib/shiguang/types';

interface Props {
  space: ShiguangSpace;
  busy: boolean;
  onEdit: () => void;
  onEditMember: (member: SpaceMember) => void;
  onRemove: () => void;
}

/** 空间列表只展示管理资料，成员私密内容仍由用户端访问。 */
export default function SpaceCard({ space, busy, onEdit, onEditMember, onRemove }: Props) {
  const status = space.deletedAt ? '已删除' : space.enabled ? '启用中' : '已禁用';
  return <article className="sg-card sg-admin-space">
    <div className="sg-admin-cover">
      <img src={space.cover} alt={`${space.name}封面`} />
      <span className={`sg-admin-status ${space.enabled && !space.deletedAt ? 'is-enabled' : ''}`}>{status}</span>
    </div>
    <div className="sg-admin-body">
      <h2>{space.name}</h2>
      <p className="sg-muted sg-admin-id">空间 ID · {space.id}</p>
      <div className="sg-admin-members">
        {space.members.map(member => <div className="sg-admin-member" key={member.userId}>
          {member.avatar ? <img src={member.avatar} alt="" className="sg-avatar" /> : <span className="sg-avatar sg-admin-avatar"><Heart size={18} /></span>}
          <div className="sg-admin-member-name"><span className="sg-muted">{member.role === 'boy' ? '男生' : '女生'}</span><strong>{member.name}</strong></div>
          {!space.deletedAt && <button className="booking-pill-btn booking-pill-btn--ghost" disabled={busy} onClick={() => onEditMember(member)}>编辑资料</button>}
        </div>)}
      </div>
      <p className="sg-muted sg-admin-id">专属返图空间 · {space.albumId}</p>
      {!space.deletedAt && <div className="sg-admin-actions">
        <button className="booking-pill-btn booking-pill-btn--primary" disabled={busy} onClick={onEdit}><Pencil size={16} />编辑空间</button>
        <button className="booking-pill-btn booking-pill-btn--danger" disabled={busy} onClick={onRemove}><Trash2 size={16} />删除空间</button>
      </div>}
    </div>
  </article>;
}
