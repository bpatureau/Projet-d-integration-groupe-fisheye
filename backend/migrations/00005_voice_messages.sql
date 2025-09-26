-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS voice_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  duration BIGINT NOT NULL,
  is_listened BOOLEAN NOT NULL DEFAULT FALSE,
  listened_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_listened_at CHECK (
    (is_listened = FALSE) OR (is_listened = TRUE AND listened_at IS NOT NULL)
  )
)
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE voice_messages;
-- +goose StatementEnd