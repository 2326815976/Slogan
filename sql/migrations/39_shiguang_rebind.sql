-- 先审阅 39_shiguang_rebind_design.md，备份并授权后执行。
-- 已有迁移 38；每个 statement-break 之间是一条完整语句。
ALTER TABLE shiguang_wallets
  DROP FOREIGN KEY fk_sg_wallet_member,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (user_id, space_id);
-- statement-break
ALTER TABLE shiguang_members
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (user_id, space_id),
  ADD COLUMN released_at DATETIME(3) NULL,
  ADD COLUMN active_user_id CHAR(36) GENERATED ALWAYS AS
    (CASE WHEN released_at IS NULL THEN user_id ELSE NULL END) STORED,
  ADD UNIQUE KEY uk_sg_active_user (active_user_id),
  COMMENT='未删除空间唯一绑定，已删除空间成员历史保留';
-- statement-break
ALTER TABLE shiguang_wallets
  ADD CONSTRAINT fk_sg_wallet_member FOREIGN KEY (user_id, space_id)
    REFERENCES shiguang_members(user_id, space_id) ON DELETE RESTRICT;
-- statement-break
UPDATE shiguang_members m JOIN shiguang_spaces s ON s.id=m.space_id
  SET m.released_at=s.deleted_at
  WHERE s.deleted_at IS NOT NULL AND m.released_at IS NULL;
-- statement-break
CREATE PROCEDURE shiguang_create_v2(
  IN p_id CHAR(36), IN p_admin CHAR(36), IN p_boy CHAR(36), IN p_girl CHAR(36),
  IN p_name VARCHAR(100), IN p_cover VARCHAR(1024), IN p_letter TEXT,
  IN p_album CHAR(36), IN p_enabled TINYINT
)
main: BEGIN
  DECLARE v_count INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  IF p_boy = p_girl THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_DIFFERENT_USERS'; END IF;
  SELECT COUNT(*) INTO v_count FROM users WHERE id=p_admin AND role='admin' AND deleted_at IS NULL AND is_disabled=0;
  IF v_count<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_ADMIN_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM shiguang_spaces WHERE id=p_id AND created_by=p_admin) THEN
    IF EXISTS(SELECT 1 FROM shiguang_spaces WHERE id=p_id AND deleted_at IS NOT NULL) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_SPACE_UNAVAILABLE';
    END IF;
    SELECT COUNT(*) INTO v_count FROM shiguang_members WHERE space_id=p_id
      AND ((member_role='boy' AND user_id=p_boy) OR (member_role='girl' AND user_id=p_girl));
    IF v_count<>2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_REQUEST_CONFLICT'; END IF;
    COMMIT;
    LEAVE main;
  END IF;
  SELECT COUNT(*) INTO v_count FROM users WHERE id IN (p_boy,p_girl) AND deleted_at IS NULL AND is_disabled=0;
  IF v_count<>2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_USER_UNAVAILABLE'; END IF;
  IF NOT EXISTS(SELECT 1 FROM albums WHERE id=p_album AND id<>'00000000-0000-0000-0000-000000000000') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_ALBUM_UNAVAILABLE';
  END IF;
  -- 兼容旧版本软删除：在新建事务中补齐释放，保留旧资料和历史钱包。
  UPDATE shiguang_members m JOIN shiguang_spaces s ON s.id=m.space_id
    SET m.released_at=s.deleted_at
    WHERE m.user_id IN (p_boy,p_girl) AND s.deleted_at IS NOT NULL AND m.released_at IS NULL;
  IF EXISTS(SELECT 1 FROM shiguang_members WHERE active_user_id IN (p_boy,p_girl)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_USER_BOUND';
  END IF;
  INSERT INTO shiguang_spaces(id,name,cover,letter,album_id,enabled,created_by)
    VALUES(p_id,p_name,p_cover,p_letter,p_album,p_enabled,p_admin);
  INSERT INTO shiguang_members(user_id,space_id,member_role,name,avatar)
    SELECT u.id,p_id,IF(u.id=p_boy,'boy','girl'),LEFT(COALESCE(NULLIF(p.name,''),IF(u.id=p_boy,'男生','女生')),100),COALESCE(p.avatar,'')
    FROM users u LEFT JOIN profiles p ON p.id=u.id WHERE u.id IN (p_boy,p_girl);
  INSERT INTO shiguang_wallets(user_id,space_id,balance) VALUES(p_boy,p_id,0),(p_girl,p_id,0);
  COMMIT;
END;
