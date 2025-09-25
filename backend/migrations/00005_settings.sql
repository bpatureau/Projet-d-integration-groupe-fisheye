-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
  dnd BOOLEAN NOT NULL DEFAULT FALSE,
  motd JSONB CHECK (motd IS NULL OR jsonb_typeof(motd) = 'object'),
  schedule JSONB CHECK (schedule IS NULL OR jsonb_typeof(schedule) = 'object'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE settings;
-- +goose StatementEnd