SET NAMES utf8mb4;

SET @restore_album_id := (
  SELECT CASE WHEN COUNT(DISTINCT a.id) = 1 THEN MIN(a.id) END
  FROM albums a JOIN shiguang_spaces s ON s.album_id = a.id
  WHERE CAST(a.title AS BINARY) = CAST('关于我们' AS BINARY)
    AND s.enabled = 1 AND s.deleted_at IS NULL
);

UPDATE shiguang_spaces
SET album_members_only = 0
WHERE album_id = @restore_album_id AND album_members_only = 1;

SELECT @restore_album_id IS NOT NULL AS matched_one_bound_album,
  ROW_COUNT() AS updated_bindings;

SELECT a.title, COUNT(*) AS preserved_bindings, MAX(s.album_members_only) AS album_members_only
FROM albums a JOIN shiguang_spaces s ON s.album_id = a.id
WHERE a.id = @restore_album_id
GROUP BY a.id, a.title;
