SET @add_shiguang_album_members_only := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'shiguang_spaces'
      AND column_name = 'album_members_only'
  ),
  'SELECT 1',
  'ALTER TABLE `shiguang_spaces` ADD COLUMN `album_members_only` TINYINT(1) NOT NULL DEFAULT 1'
);
PREPARE stmt_shiguang_album_members_only FROM @add_shiguang_album_members_only;
EXECUTE stmt_shiguang_album_members_only;
DEALLOCATE PREPARE stmt_shiguang_album_members_only;
