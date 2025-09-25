-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('doorbell', 'voice_message', 'knock')),
  status VARCHAR(50) NOT NULL DEFAULT 'unanswered' CHECK (status IN ('answered', 'unanswered', 'ignored')),
  response_time BIGINT,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE visits;
-- +goose StatementEnd