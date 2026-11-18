-- MySQL 8.0.30。按 statement-break 拆分执行，过程体须完整提交。
ALTER TABLE shiguang_prizes ADD COLUMN image VARCHAR(64) NOT NULL DEFAULT '';
-- statement-break
ALTER TABLE shiguang_tickets ADD COLUMN image VARCHAR(64) NOT NULL DEFAULT '';
-- statement-break
CREATE TABLE IF NOT EXISTS shiguang_gift_cards (
  id CHAR(36) NOT NULL PRIMARY KEY,
  _openid VARCHAR(64) NOT NULL DEFAULT '',
  space_id CHAR(36) NOT NULL,
  provider_id CHAR(36) NOT NULL,
  holder_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  image VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  sent_at DATETIME(3) NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  KEY idx_sg_gift_cards_list (space_id, sent_at, created_at, id),
  CONSTRAINT fk_sg_gift_card_space FOREIGN KEY (space_id) REFERENCES shiguang_spaces(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='空间成员提供的单张可赠卡券';
-- statement-break
CREATE PROCEDURE IF NOT EXISTS shiguang_issue_ticket_v2(
  IN p_space CHAR(36), IN p_actor CHAR(36), IN p_request CHAR(36), IN p_operation VARCHAR(16),
  IN p_fingerprint CHAR(64), IN p_card CHAR(36), IN p_version INT UNSIGNED
)
main: BEGIN
  DECLARE v_active INT DEFAULT 0;
  DECLARE v_partner CHAR(36) DEFAULT NULL;
  DECLARE v_prize CHAR(36) DEFAULT NULL;
  DECLARE v_name VARCHAR(100);
  DECLARE v_content TEXT;
  DECLARE v_image VARCHAR(64);
  DECLARE v_sent_at DATETIME(3);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  START TRANSACTION;
  SELECT IF(enabled=1 AND deleted_at IS NULL,1,0) INTO v_active FROM shiguang_spaces WHERE id=p_space FOR UPDATE;
  IF v_active <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_SPACE_UNAVAILABLE'; END IF;
  IF NOT EXISTS(SELECT 1 FROM shiguang_members WHERE space_id=p_space AND user_id=p_actor) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_MEMBER_REQUIRED';
  END IF;
  SELECT user_id INTO v_partner FROM shiguang_members WHERE space_id=p_space AND user_id<>p_actor;
  IF v_partner IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_MEMBER_REQUIRED'; END IF;

  IF EXISTS(SELECT 1 FROM shiguang_operations WHERE id=p_request) THEN
    IF NOT EXISTS(SELECT 1 FROM shiguang_operations WHERE id=p_request AND space_id=p_space AND actor_id=p_actor
        AND operation=p_operation AND fingerprint=p_fingerprint) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_REQUEST_CONFLICT';
    END IF;
    COMMIT;
    LEAVE main;
  END IF;

  IF p_operation='draw' THEN
    UPDATE shiguang_wallets SET balance=balance-1 WHERE user_id=p_actor AND space_id=p_space AND balance>0;
    IF ROW_COUNT()<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_NO_CHANCES'; END IF;
    SELECT id,name,content,image INTO v_prize,v_name,v_content,v_image FROM shiguang_prizes
      WHERE space_id=p_space AND provider_id=v_partner AND drawer_id=p_actor ORDER BY RAND() LIMIT 1 FOR UPDATE;
    IF v_prize IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_EMPTY_POOL'; END IF;
    INSERT INTO shiguang_tickets(id,space_id,source,prize_id,provider_id,holder_id,name,content,image)
      VALUES(p_request,p_space,'draw',v_prize,v_partner,p_actor,v_name,v_content,v_image);
  ELSEIF p_operation='send-card' THEN
    SET v_sent_at=UTC_TIMESTAMP(3);
    UPDATE shiguang_gift_cards SET sent_at=v_sent_at,version=version+1 WHERE id=p_card AND space_id=p_space
      AND provider_id=p_actor AND holder_id=v_partner AND version=p_version AND sent_at IS NULL;
    IF ROW_COUNT()<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_GIFT_UNAVAILABLE'; END IF;
    INSERT INTO shiguang_tickets(id,space_id,source,provider_id,holder_id,name,content,image,obtained_at)
      SELECT p_request,space_id,'gift',provider_id,holder_id,name,content,image,v_sent_at FROM shiguang_gift_cards WHERE id=p_card;
  ELSE
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SG_INVALID_INPUT';
  END IF;

  INSERT INTO shiguang_operations(id,space_id,actor_id,operation,fingerprint,result_id)
    VALUES(p_request,p_space,p_actor,p_operation,p_fingerprint,p_request);
  COMMIT;
END;
