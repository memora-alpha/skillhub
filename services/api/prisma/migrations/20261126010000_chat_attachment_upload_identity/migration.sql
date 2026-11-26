ALTER TABLE stored_files
  ADD COLUMN chat_upload_key_digest text,
  ADD COLUMN chat_upload_command_digest text;

CREATE UNIQUE INDEX stored_files_chat_upload_key_digest_key
  ON stored_files (chat_upload_key_digest);
