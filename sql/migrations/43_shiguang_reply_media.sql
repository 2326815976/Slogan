-- 发布絮语附件功能前执行。已有回复以空附件字段保留原文。
ALTER TABLE shiguang_replies
  ADD COLUMN audio VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN image VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN video VARCHAR(64) NOT NULL DEFAULT '';
-- statement-break
-- 压缩图和原图由同一条私有媒体记录授权。
ALTER TABLE shiguang_media ADD COLUMN preview_file_id VARCHAR(1024) NULL;
