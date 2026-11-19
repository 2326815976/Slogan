SET NAMES utf8mb4;

SET @add_album_show_shot_metadata := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'albums'
      AND column_name = 'show_shot_metadata'
  ),
  'SELECT 1',
  'ALTER TABLE `albums` ADD COLUMN `show_shot_metadata` TINYINT(1) NOT NULL DEFAULT 0'
);
PREPARE stmt_album_show_shot_metadata FROM @add_album_show_shot_metadata;
EXECUTE stmt_album_show_shot_metadata;
DEALLOCATE PREPARE stmt_album_show_shot_metadata;
