-- 拾光空间线上实测清理记录（已执行完成，2026-11-17）
-- 环境：slogan-3gf3tz4nf12fa5ef；无结构变更。
-- 部署版本：slogan-092（100% 流量）；Web 提交 aee2795，小程序提交 9ae0c07。
-- 线上通过 86 项核心 API 断言，以及启停/软删除、历史心情、浏览器 UI 和默认入口检查。
-- 仅针对本轮新建的 4 个测试账号、1 个拾光空间、1 个返图空间。
-- 创建夹具时的随机密码散列及会话文件已从操作记录移除，避免误复用。
-- 正常业务的永久绑定和软删除规则不变；下列硬删除仅用于本轮隔离测试数据。
-- 已验证软删除后仍保留 2 个成员、8 条内容、4 张奖券，再执行清理。
-- 3 个加密云媒体对象已删除，逐个下载返回 STORAGE_FILE_NONEXIST。
-- 末尾 16 类残留查询均为 0。

DELETE FROM shiguang_replies WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f';
DELETE FROM shiguang_operations WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f';
DELETE FROM shiguang_tickets WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f';
DELETE FROM shiguang_grants WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f';
DELETE FROM shiguang_prizes WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f';
DELETE FROM shiguang_wallets WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f';
DELETE FROM shiguang_entries WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f';
DELETE FROM shiguang_members WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f';
DELETE FROM shiguang_media WHERE uploaded_by IN ('d9a2d8d2-e6eb-497d-80eb-2bbbff2ae0fb','f3cc4536-ace0-44e4-bc6c-648fcea08526','65eb7db7-e1a8-4454-b7e5-98b0fca4ee23','bf1d8d96-a44d-44d9-b890-eea72635ed27');
DELETE FROM shiguang_spaces WHERE id='0f205540-e986-4087-a3f3-e63863af472f';
DELETE FROM user_album_bindings WHERE album_id='962784bc-5289-498d-8143-e5c69628ef79';
DELETE FROM album_photos WHERE album_id='962784bc-5289-498d-8143-e5c69628ef79';
DELETE FROM album_folders WHERE album_id='962784bc-5289-498d-8143-e5c69628ef79';
DELETE FROM albums WHERE id='962784bc-5289-498d-8143-e5c69628ef79';
DELETE FROM user_active_logs WHERE user_id IN ('d9a2d8d2-e6eb-497d-80eb-2bbbff2ae0fb','f3cc4536-ace0-44e4-bc6c-648fcea08526','65eb7db7-e1a8-4454-b7e5-98b0fca4ee23','bf1d8d96-a44d-44d9-b890-eea72635ed27');
DELETE FROM user_sessions WHERE user_id IN ('d9a2d8d2-e6eb-497d-80eb-2bbbff2ae0fb','f3cc4536-ace0-44e4-bc6c-648fcea08526','65eb7db7-e1a8-4454-b7e5-98b0fca4ee23','bf1d8d96-a44d-44d9-b890-eea72635ed27');
DELETE FROM profiles WHERE id IN ('d9a2d8d2-e6eb-497d-80eb-2bbbff2ae0fb','f3cc4536-ace0-44e4-bc6c-648fcea08526','65eb7db7-e1a8-4454-b7e5-98b0fca4ee23','bf1d8d96-a44d-44d9-b890-eea72635ed27');
DELETE FROM users WHERE id IN ('d9a2d8d2-e6eb-497d-80eb-2bbbff2ae0fb','f3cc4536-ace0-44e4-bc6c-648fcea08526','65eb7db7-e1a8-4454-b7e5-98b0fca4ee23','bf1d8d96-a44d-44d9-b890-eea72635ed27');

-- 清理后核验（只读）
SELECT 'shiguang_replies' AS resource,COUNT(*) AS remaining FROM shiguang_replies WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f'
UNION ALL
SELECT 'shiguang_operations' AS resource,COUNT(*) AS remaining FROM shiguang_operations WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f'
UNION ALL
SELECT 'shiguang_tickets' AS resource,COUNT(*) AS remaining FROM shiguang_tickets WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f'
UNION ALL
SELECT 'shiguang_grants' AS resource,COUNT(*) AS remaining FROM shiguang_grants WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f'
UNION ALL
SELECT 'shiguang_prizes' AS resource,COUNT(*) AS remaining FROM shiguang_prizes WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f'
UNION ALL
SELECT 'shiguang_wallets' AS resource,COUNT(*) AS remaining FROM shiguang_wallets WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f'
UNION ALL
SELECT 'shiguang_entries' AS resource,COUNT(*) AS remaining FROM shiguang_entries WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f'
UNION ALL
SELECT 'shiguang_members' AS resource,COUNT(*) AS remaining FROM shiguang_members WHERE space_id='0f205540-e986-4087-a3f3-e63863af472f'
UNION ALL
SELECT 'shiguang_spaces' AS resource,COUNT(*) AS remaining FROM shiguang_spaces WHERE id='0f205540-e986-4087-a3f3-e63863af472f'
UNION ALL
SELECT 'shiguang_media' AS resource,COUNT(*) AS remaining FROM shiguang_media WHERE uploaded_by IN ('d9a2d8d2-e6eb-497d-80eb-2bbbff2ae0fb','f3cc4536-ace0-44e4-bc6c-648fcea08526','65eb7db7-e1a8-4454-b7e5-98b0fca4ee23','bf1d8d96-a44d-44d9-b890-eea72635ed27')
UNION ALL
SELECT 'users' AS resource,COUNT(*) AS remaining FROM users WHERE id IN ('d9a2d8d2-e6eb-497d-80eb-2bbbff2ae0fb','f3cc4536-ace0-44e4-bc6c-648fcea08526','65eb7db7-e1a8-4454-b7e5-98b0fca4ee23','bf1d8d96-a44d-44d9-b890-eea72635ed27')
UNION ALL
SELECT 'profiles' AS resource,COUNT(*) AS remaining FROM profiles WHERE id IN ('d9a2d8d2-e6eb-497d-80eb-2bbbff2ae0fb','f3cc4536-ace0-44e4-bc6c-648fcea08526','65eb7db7-e1a8-4454-b7e5-98b0fca4ee23','bf1d8d96-a44d-44d9-b890-eea72635ed27')
UNION ALL
SELECT 'user_sessions' AS resource,COUNT(*) AS remaining FROM user_sessions WHERE user_id IN ('d9a2d8d2-e6eb-497d-80eb-2bbbff2ae0fb','f3cc4536-ace0-44e4-bc6c-648fcea08526','65eb7db7-e1a8-4454-b7e5-98b0fca4ee23','bf1d8d96-a44d-44d9-b890-eea72635ed27')
UNION ALL
SELECT 'user_active_logs' AS resource,COUNT(*) AS remaining FROM user_active_logs WHERE user_id IN ('d9a2d8d2-e6eb-497d-80eb-2bbbff2ae0fb','f3cc4536-ace0-44e4-bc6c-648fcea08526','65eb7db7-e1a8-4454-b7e5-98b0fca4ee23','bf1d8d96-a44d-44d9-b890-eea72635ed27')
UNION ALL
SELECT 'albums' AS resource,COUNT(*) AS remaining FROM albums WHERE id='962784bc-5289-498d-8143-e5c69628ef79'
UNION ALL
SELECT 'user_album_bindings' AS resource,COUNT(*) AS remaining FROM user_album_bindings WHERE album_id='962784bc-5289-498d-8143-e5c69628ef79';
