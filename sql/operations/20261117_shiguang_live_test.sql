-- 拾光空间线上实测清理记录（已执行完成，2026-11-17）
-- 环境：slogan-3gf3tz4nf12fa5ef；无结构变更。
-- 仅针对本轮新建的 4 个测试账号、1 个拾光空间、1 个返图空间。
-- 创建夹具时的随机密码散列及会话文件已从操作记录移除，避免误复用。
-- 正常业务的永久绑定和软删除规则不变；下列硬删除仅用于本轮隔离测试数据。
-- 已验证软删除后仍保留 2 个成员、8 条内容、4 张奖券，再执行清理。
-- 3 个加密云媒体对象已删除，逐个下载返回 STORAGE_FILE_NONEXIST。
-- 末尾 16 类残留查询均为 0。

DELETE FROM shiguang_replies WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98';
DELETE FROM shiguang_operations WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98';
DELETE FROM shiguang_tickets WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98';
DELETE FROM shiguang_grants WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98';
DELETE FROM shiguang_prizes WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98';
DELETE FROM shiguang_wallets WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98';
DELETE FROM shiguang_entries WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98';
DELETE FROM shiguang_members WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98';
DELETE FROM shiguang_media WHERE uploaded_by IN ('9f3cf244-610b-4229-837d-8cf66eeb2874','fd62be60-511b-49e5-9c3a-52e331619c59','6c8b415b-ccb9-4f9b-910c-ec0f43fb1d0a','1bf59f1d-09bd-4d77-a3fe-86cbbd62c08a');
DELETE FROM shiguang_spaces WHERE id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98';
DELETE FROM user_album_bindings WHERE album_id='25438626-0eb6-4b2a-af9a-39f61bd5a58b';
DELETE FROM album_photos WHERE album_id='25438626-0eb6-4b2a-af9a-39f61bd5a58b';
DELETE FROM album_folders WHERE album_id='25438626-0eb6-4b2a-af9a-39f61bd5a58b';
DELETE FROM albums WHERE id='25438626-0eb6-4b2a-af9a-39f61bd5a58b';
DELETE FROM user_active_logs WHERE user_id IN ('9f3cf244-610b-4229-837d-8cf66eeb2874','fd62be60-511b-49e5-9c3a-52e331619c59','6c8b415b-ccb9-4f9b-910c-ec0f43fb1d0a','1bf59f1d-09bd-4d77-a3fe-86cbbd62c08a');
DELETE FROM user_sessions WHERE user_id IN ('9f3cf244-610b-4229-837d-8cf66eeb2874','fd62be60-511b-49e5-9c3a-52e331619c59','6c8b415b-ccb9-4f9b-910c-ec0f43fb1d0a','1bf59f1d-09bd-4d77-a3fe-86cbbd62c08a');
DELETE FROM profiles WHERE id IN ('9f3cf244-610b-4229-837d-8cf66eeb2874','fd62be60-511b-49e5-9c3a-52e331619c59','6c8b415b-ccb9-4f9b-910c-ec0f43fb1d0a','1bf59f1d-09bd-4d77-a3fe-86cbbd62c08a');
DELETE FROM users WHERE id IN ('9f3cf244-610b-4229-837d-8cf66eeb2874','fd62be60-511b-49e5-9c3a-52e331619c59','6c8b415b-ccb9-4f9b-910c-ec0f43fb1d0a','1bf59f1d-09bd-4d77-a3fe-86cbbd62c08a');

-- 清理后核验（只读）
SELECT 'shiguang_replies' AS resource,COUNT(*) AS remaining FROM shiguang_replies WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98'
UNION ALL
SELECT 'shiguang_operations' AS resource,COUNT(*) AS remaining FROM shiguang_operations WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98'
UNION ALL
SELECT 'shiguang_tickets' AS resource,COUNT(*) AS remaining FROM shiguang_tickets WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98'
UNION ALL
SELECT 'shiguang_grants' AS resource,COUNT(*) AS remaining FROM shiguang_grants WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98'
UNION ALL
SELECT 'shiguang_prizes' AS resource,COUNT(*) AS remaining FROM shiguang_prizes WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98'
UNION ALL
SELECT 'shiguang_wallets' AS resource,COUNT(*) AS remaining FROM shiguang_wallets WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98'
UNION ALL
SELECT 'shiguang_entries' AS resource,COUNT(*) AS remaining FROM shiguang_entries WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98'
UNION ALL
SELECT 'shiguang_members' AS resource,COUNT(*) AS remaining FROM shiguang_members WHERE space_id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98'
UNION ALL
SELECT 'shiguang_spaces' AS resource,COUNT(*) AS remaining FROM shiguang_spaces WHERE id='92dd1515-c96b-4b0d-a6fc-7b2acdac4e98'
UNION ALL
SELECT 'shiguang_media' AS resource,COUNT(*) AS remaining FROM shiguang_media WHERE uploaded_by IN ('9f3cf244-610b-4229-837d-8cf66eeb2874','fd62be60-511b-49e5-9c3a-52e331619c59','6c8b415b-ccb9-4f9b-910c-ec0f43fb1d0a','1bf59f1d-09bd-4d77-a3fe-86cbbd62c08a')
UNION ALL
SELECT 'users' AS resource,COUNT(*) AS remaining FROM users WHERE id IN ('9f3cf244-610b-4229-837d-8cf66eeb2874','fd62be60-511b-49e5-9c3a-52e331619c59','6c8b415b-ccb9-4f9b-910c-ec0f43fb1d0a','1bf59f1d-09bd-4d77-a3fe-86cbbd62c08a')
UNION ALL
SELECT 'profiles' AS resource,COUNT(*) AS remaining FROM profiles WHERE id IN ('9f3cf244-610b-4229-837d-8cf66eeb2874','fd62be60-511b-49e5-9c3a-52e331619c59','6c8b415b-ccb9-4f9b-910c-ec0f43fb1d0a','1bf59f1d-09bd-4d77-a3fe-86cbbd62c08a')
UNION ALL
SELECT 'user_sessions' AS resource,COUNT(*) AS remaining FROM user_sessions WHERE user_id IN ('9f3cf244-610b-4229-837d-8cf66eeb2874','fd62be60-511b-49e5-9c3a-52e331619c59','6c8b415b-ccb9-4f9b-910c-ec0f43fb1d0a','1bf59f1d-09bd-4d77-a3fe-86cbbd62c08a')
UNION ALL
SELECT 'user_active_logs' AS resource,COUNT(*) AS remaining FROM user_active_logs WHERE user_id IN ('9f3cf244-610b-4229-837d-8cf66eeb2874','fd62be60-511b-49e5-9c3a-52e331619c59','6c8b415b-ccb9-4f9b-910c-ec0f43fb1d0a','1bf59f1d-09bd-4d77-a3fe-86cbbd62c08a')
UNION ALL
SELECT 'albums' AS resource,COUNT(*) AS remaining FROM albums WHERE id='25438626-0eb6-4b2a-af9a-39f61bd5a58b'
UNION ALL
SELECT 'user_album_bindings' AS resource,COUNT(*) AS remaining FROM user_album_bindings WHERE album_id='25438626-0eb6-4b2a-af9a-39f61bd5a58b';
