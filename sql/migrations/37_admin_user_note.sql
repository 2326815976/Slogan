-- ================================================================================================
-- Project: Slogan
-- Date: 2026-11-15
-- Purpose: add an admin-only note field to users for user management
-- Safe to run repeatedly.
-- ================================================================================================

SET NAMES utf8mb4;
SET time_zone = '+08:00';

SET @has_users := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
);

SET @has_users_admin_note := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'admin_note'
);

SET @add_users_admin_note_sql := IF(
  @has_users = 1 AND @has_users_admin_note = 0,
  'ALTER TABLE `users` ADD COLUMN `admin_note` VARCHAR(500) NULL AFTER `role`',
  'SELECT 1'
);
PREPARE stmt_add_users_admin_note FROM @add_users_admin_note_sql;
EXECUTE stmt_add_users_admin_note;
DEALLOCATE PREPARE stmt_add_users_admin_note;

SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'users'
  AND column_name = 'admin_note';
