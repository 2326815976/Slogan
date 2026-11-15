import { NextResponse } from 'next/server';
import { ensureAdminSession } from '@/app/api/admin/_utils/ensure-admin-session';
import {
  ADMIN_USER_NOTE_MAX_LENGTH,
  deleteAdminManagedUser,
  findAdminManagedUser,
  normalizeAdminUserNote,
  setAdminUserDisabled,
  setAdminUserNote,
} from '../_server';

export const dynamic = 'force-dynamic';

function resolveTargetId(rawId: string | undefined): string {
  return String(rawId ?? '').trim();
}

function createGuardErrorResponse(message: string, status = 409) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await ensureAdminSession();
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const { id } = await params;
    const userId = resolveTargetId(id);
    if (!userId) {
      return createGuardErrorResponse('用户 ID 非法', 400);
    }

    const body = (await request.json().catch(() => null)) as {
      isDisabled?: unknown;
      adminNote?: unknown;
    } | null;
    const hasDisabledInput = Object.prototype.hasOwnProperty.call(body ?? {}, 'isDisabled');
    const hasNoteInput = Object.prototype.hasOwnProperty.call(body ?? {}, 'adminNote');
    if (hasDisabledInput === hasNoteInput) {
      return createGuardErrorResponse('请提供且仅提供一种用户更新内容', 400);
    }

    const targetUser = await findAdminManagedUser(userId);
    if (!targetUser) {
      return createGuardErrorResponse('目标用户不存在', 404);
    }

    if (hasNoteInput) {
      if (String(body?.adminNote ?? '').length > ADMIN_USER_NOTE_MAX_LENGTH) {
        return createGuardErrorResponse(`备注最多 ${ADMIN_USER_NOTE_MAX_LENGTH} 个字符`, 400);
      }
      const normalizedNote = normalizeAdminUserNote(body?.adminNote);
      const data = await setAdminUserNote(userId, normalizedNote);
      return NextResponse.json({ success: true, data });
    }

    if (typeof body?.isDisabled !== 'boolean') {
      return createGuardErrorResponse('缺少禁用状态参数', 400);
    }
    if (targetUser.id === adminCheck.userId) {
      return createGuardErrorResponse('不支持禁用当前登录管理员');
    }
    if (targetUser.role === 'admin') {
      return createGuardErrorResponse('管理员账号暂不支持禁用');
    }

    const data = await setAdminUserDisabled(userId, body.isDisabled);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message =
      error instanceof Error && error.message === 'user_not_found'
        ? '目标用户不存在'
        : error instanceof Error
          ? error.message
          : '更新用户状态失败';
    const status = message === '目标用户不存在' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await ensureAdminSession();
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const { id } = await params;
    const userId = resolveTargetId(id);
    if (!userId) {
      return createGuardErrorResponse('用户 ID 非法', 400);
    }

    const targetUser = await findAdminManagedUser(userId);
    if (!targetUser) {
      return createGuardErrorResponse('目标用户不存在', 404);
    }
    if (targetUser.id === adminCheck.userId) {
      return createGuardErrorResponse('不支持删除当前登录管理员');
    }
    if (targetUser.role === 'admin') {
      return createGuardErrorResponse('管理员账号暂不支持删除');
    }

    const result = await deleteAdminManagedUser(userId);
    return NextResponse.json({
      success: true,
      warning: result.warning,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message === 'user_not_found'
        ? '目标用户不存在'
        : error instanceof Error
          ? error.message
          : '删除用户失败';
    const status = message === '目标用户不存在' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
