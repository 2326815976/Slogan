-- 拾光空间：仅新增对象。MySQL 8.0；先审阅 38_shiguang_design.md。
-- 每个 statement-break 之间是一条完整语句，存储过程体不可按分号拆分。
CREATE TABLE IF NOT EXISTS shiguang_spaces (
  id CHAR(36) NOT NULL PRIMARY KEY,
  _openid VARCHAR(64) NOT NULL DEFAULT '',
  name VARCHAR(100) NOT NULL,
  cover VARCHAR(1024) NOT NULL DEFAULT '',
  letter TEXT NOT NULL,
  album_id CHAR(36) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  deleted_at DATETIME(3) NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version INT UNSIGNED NOT NULL DEFAULT 1,
  KEY idx_sg_space_state (enabled, deleted_at),
  KEY idx_sg_space_album (album_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='拾光空间；删除仅标记 deleted_at';
-- statement-break
CREATE TABLE IF NOT EXISTS shiguang_members (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  _openid VARCHAR(64) NOT NULL DEFAULT '',
  space_id CHAR(36) NOT NULL,
  member_role ENUM('boy','girl') NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar VARCHAR(1024) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  UNIQUE KEY uk_sg_member_role (space_id, member_role),
  CONSTRAINT fk_sg_member_space FOREIGN KEY (space_id) REFERENCES shiguang_spaces(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='永久唯一绑定；账号删除不级联';
-- statement-break
CREATE TABLE IF NOT EXISTS shiguang_entries (
  id CHAR(36) NOT NULL PRIMARY KEY,
  _openid VARCHAR(64) NOT NULL DEFAULT '',
  space_id CHAR(36) NOT NULL,
  kind ENUM('anniversary','wish','promise','whisper','mood','collection') NOT NULL,
  payload JSON NOT NULL,
  mood_date DATE NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uk_sg_daily_mood (space_id, created_by, mood_date),
  KEY idx_sg_entries_list (space_id, kind, created_at, id),
  CONSTRAINT fk_sg_entry_space FOREIGN KEY (space_id) REFERENCES shiguang_spaces(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='拾光内容，创建人及时间不可编辑';
-- statement-break
CREATE TABLE IF NOT EXISTS shiguang_replies (
  id CHAR(36) NOT NULL PRIMARY KEY,
  _openid VARCHAR(64) NOT NULL DEFAULT '',
  entry_id CHAR(36) NOT NULL,
  space_id CHAR(36) NOT NULL,
  content TEXT NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version INT UNSIGNED NOT NULL DEFAULT 1,
  KEY idx_sg_replies_entry (entry_id, created_at),
  CONSTRAINT fk_sg_reply_entry FOREIGN KEY (entry_id) REFERENCES shiguang_entries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='絮语回复，仅作者管理';
-- statement-break
CREATE TABLE IF NOT EXISTS shiguang_prizes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  _openid VARCHAR(64) NOT NULL DEFAULT '',
  space_id CHAR(36) NOT NULL,
  provider_id CHAR(36) NOT NULL,
  drawer_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version INT UNSIGNED NOT NULL DEFAULT 1,
  KEY idx_sg_prizes_pool (space_id, provider_id),
  CONSTRAINT fk_sg_prize_space FOREIGN KEY (space_id) REFERENCES shiguang_spaces(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='个人提供的转盘奖池';
-- statement-break
CREATE TABLE IF NOT EXISTS shiguang_wallets (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  _openid VARCHAR(64) NOT NULL DEFAULT '',
  space_id CHAR(36) NOT NULL,
  balance INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_sg_wallet_member FOREIGN KEY (user_id) REFERENCES shiguang_members(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='抽奖机会，仅事务过程更新';
-- statement-break
CREATE TABLE IF NOT EXISTS shiguang_grants (
  id CHAR(36) NOT NULL PRIMARY KEY,
  _openid VARCHAR(64) NOT NULL DEFAULT '',
  space_id CHAR(36) NOT NULL,
  giver_id CHAR(36) NOT NULL,
  receiver_id CHAR(36) NOT NULL,
  amount INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  KEY idx_sg_grants_list (space_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='给予次数记录';
-- statement-break
CREATE TABLE IF NOT EXISTS shiguang_tickets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  _openid VARCHAR(64) NOT NULL DEFAULT '',
  space_id CHAR(36) NOT NULL,
  source ENUM('draw','gift') NOT NULL,
  prize_id CHAR(36) NULL,
  provider_id CHAR(36) NOT NULL,
  holder_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  status ENUM('unused','used') NOT NULL DEFAULT 'unused',
  obtained_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  used_at DATETIME(3) NULL,
  KEY idx_sg_tickets_list (space_id, obtained_at, id),
  CONSTRAINT fk_sg_ticket_space FOREIGN KEY (space_id) REFERENCES shiguang_spaces(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='已获得奖券快照，不关联奖池级联';
-- statement-break
CREATE TABLE IF NOT EXISTS shiguang_operations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  _openid VARCHAR(64) NOT NULL DEFAULT '',
  space_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NOT NULL,
  operation VARCHAR(16) NOT NULL,
  fingerprint CHAR(64) NOT NULL,
  result_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  KEY idx_sg_ops_space (space_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='奖券幂等记录，不自动清理';
-- statement-break
CREATE TABLE IF NOT EXISTS shiguang_media (
  id CHAR(36) NOT NULL PRIMARY KEY,
  _openid VARCHAR(64) NOT NULL DEFAULT '',
  space_id CHAR(36) NULL,
  uploaded_by CHAR(36) NOT NULL,
  purpose ENUM('admin','member') NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_id VARCHAR(1024) NOT NULL,
  byte_length INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  KEY idx_sg_media_space (space_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='加密图片与录音的权限索引';
-- statement-break
CREATE PROCEDURE IF NOT EXISTS shiguang_create_v1(
  IN p_id CHAR(36), IN p_admin CHAR(36), IN p_boy CHAR(36), IN p_girl CHAR(36),
  IN p_name VARCHAR(100), IN p_cover VARCHAR(1024), IN p_letter TEXT,
  IN p_album CHAR(36), IN p_enabled TINYINT
)
main: BEGIN
  DECLARE v_count INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  IF p_boy = p_girl THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_DIFFERENT_USERS'; END IF;
  SELECT COUNT(*) INTO v_count FROM users WHERE id = p_admin AND role = 'admin' AND deleted_at IS NULL AND is_disabled = 0;
  IF v_count <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_ADMIN_REQUIRED'; END IF;
  -- 创建请求重试时复用客户端空间 UUID，不能额外创建或绑定。
  IF EXISTS(SELECT 1 FROM shiguang_spaces WHERE id = p_id AND created_by = p_admin) THEN
    SELECT COUNT(*) INTO v_count FROM shiguang_members WHERE space_id = p_id AND ((member_role = 'boy' AND user_id = p_boy) OR (member_role = 'girl' AND user_id = p_girl));
    IF v_count <> 2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_REQUEST_CONFLICT'; END IF;
    COMMIT;
    LEAVE main;
  END IF;
  SELECT COUNT(*) INTO v_count FROM users WHERE id IN (p_boy,p_girl) AND deleted_at IS NULL AND is_disabled = 0;
  IF v_count <> 2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_USER_UNAVAILABLE'; END IF;
  IF NOT EXISTS(SELECT 1 FROM albums WHERE id = p_album AND id <> '00000000-0000-0000-0000-000000000000') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_ALBUM_UNAVAILABLE'; END IF;
  IF EXISTS(SELECT 1 FROM shiguang_members WHERE user_id IN (p_boy,p_girl)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_USER_BOUND'; END IF;
  INSERT INTO shiguang_spaces(id,name,cover,letter,album_id,enabled,created_by) VALUES(p_id,p_name,p_cover,p_letter,p_album,p_enabled,p_admin);
  INSERT INTO shiguang_members(user_id,space_id,member_role,name,avatar)
    SELECT u.id,p_id,IF(u.id=p_boy,'boy','girl'),LEFT(COALESCE(NULLIF(p.name,''),IF(u.id=p_boy,'男生','女生')),100),COALESCE(p.avatar,'')
    FROM users u LEFT JOIN profiles p ON p.id=u.id WHERE u.id IN(p_boy,p_girl);
  INSERT INTO shiguang_wallets(user_id,space_id,balance) VALUES(p_boy,p_id,0),(p_girl,p_id,0);
  COMMIT;
END;
-- statement-break
CREATE PROCEDURE IF NOT EXISTS shiguang_ticket_v1(
  IN p_space CHAR(36), IN p_actor CHAR(36), IN p_request CHAR(36), IN p_operation VARCHAR(16),
  IN p_fingerprint CHAR(64), IN p_amount INT, IN p_name VARCHAR(100), IN p_content TEXT, IN p_ticket CHAR(36)
)
main: BEGIN
  DECLARE v_active INT DEFAULT 0;
  DECLARE v_partner CHAR(36) DEFAULT NULL;
  DECLARE v_balance INT DEFAULT 0;
  DECLARE v_prize CHAR(36) DEFAULT NULL;
  DECLARE v_name VARCHAR(100);
  DECLARE v_content TEXT;
  DECLARE v_result CHAR(36);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  -- 同一空间所有奖券操作串行化；禁用/删除空间也会竞争这把行锁。
  SELECT IF(enabled=1 AND deleted_at IS NULL,1,0) INTO v_active FROM shiguang_spaces WHERE id=p_space FOR UPDATE;
  IF v_active <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_SPACE_UNAVAILABLE'; END IF;
  IF NOT EXISTS(SELECT 1 FROM shiguang_members WHERE space_id=p_space AND user_id=p_actor) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_MEMBER_REQUIRED'; END IF;
  SELECT user_id INTO v_partner FROM shiguang_members WHERE space_id=p_space AND user_id<>p_actor;
  IF v_partner IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_MEMBER_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM shiguang_operations WHERE id=p_request) THEN
    IF NOT EXISTS(SELECT 1 FROM shiguang_operations WHERE id=p_request AND space_id=p_space AND actor_id=p_actor AND operation=p_operation AND fingerprint=p_fingerprint) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_REQUEST_CONFLICT'; END IF;
    COMMIT;
    LEAVE main;
  END IF;
  SET v_result=p_request;
  IF p_operation='grant' THEN
    IF p_amount IS NULL OR p_amount<1 OR p_amount>1000 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_INVALID_AMOUNT'; END IF;
    UPDATE shiguang_wallets SET balance=balance+p_amount WHERE user_id=v_partner AND space_id=p_space AND balance<=1000000-p_amount;
    IF ROW_COUNT()<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_BALANCE_LIMIT'; END IF;
    INSERT INTO shiguang_grants(id,space_id,giver_id,receiver_id,amount) VALUES(v_result,p_space,p_actor,v_partner,p_amount);
  ELSEIF p_operation='draw' THEN
    SELECT balance INTO v_balance FROM shiguang_wallets WHERE user_id=p_actor AND space_id=p_space FOR UPDATE;
    IF v_balance<1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_NO_CHANCES'; END IF;
    SELECT id,name,content INTO v_prize,v_name,v_content FROM shiguang_prizes WHERE space_id=p_space AND provider_id=v_partner AND drawer_id=p_actor ORDER BY RAND() LIMIT 1 FOR UPDATE;
    IF v_prize IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_EMPTY_POOL'; END IF;
    UPDATE shiguang_wallets SET balance=balance-1 WHERE user_id=p_actor AND space_id=p_space AND balance>0;
    INSERT INTO shiguang_tickets(id,space_id,source,prize_id,provider_id,holder_id,name,content) VALUES(v_result,p_space,'draw',v_prize,v_partner,p_actor,v_name,v_content);
  ELSEIF p_operation='gift' THEN
    IF CHAR_LENGTH(TRIM(p_name))<1 OR CHAR_LENGTH(TRIM(p_content))<1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_INVALID_INPUT'; END IF;
    INSERT INTO shiguang_tickets(id,space_id,source,provider_id,holder_id,name,content) VALUES(v_result,p_space,'gift',p_actor,v_partner,p_name,p_content);
  ELSEIF p_operation='redeem' THEN
    SET v_result=p_ticket;
    IF NOT EXISTS(SELECT 1 FROM shiguang_tickets WHERE id=p_ticket AND space_id=p_space AND provider_id=p_actor) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_PROVIDER_REQUIRED'; END IF;
    UPDATE shiguang_tickets SET status='used',used_at=UTC_TIMESTAMP(3) WHERE id=p_ticket AND space_id=p_space AND provider_id=p_actor AND status='unused';
  ELSE
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_INVALID_INPUT';
  END IF;
  INSERT INTO shiguang_operations(id,space_id,actor_id,operation,fingerprint,result_id) VALUES(p_request,p_space,p_actor,p_operation,p_fingerprint,v_result);
  COMMIT;
END;
